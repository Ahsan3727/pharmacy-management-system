import { Router } from 'express';
import { authenticate, allRoles, managerOrOwner, ownerOnly, AuthRequest } from '../../middleware/auth';
import { Batch } from '../batches/model';
import { Medicine } from '../medicines/model';
import { StockMovement } from './movementModel';
import { Settings } from '../settings/model';
import { StockAdjustSchema, WriteOffSchema } from '@hs-pharma/shared';
import { AppError } from '../../common/errors';
import { todayUtc } from '../../common/dates';
import mongoose from 'mongoose';

const router = Router();
router.use(authenticate);

// GET /api/v1/stock/low
router.get('/low', allRoles, async (req, res, next) => {
  try {
    const meds = await Medicine.find({ isActive: true });
    const low = [];
    for (const m of meds) {
      const batches = await Batch.find({ medicineId: m._id, status: 'active', qtyOnHand: { $gt: 0 } });
      const total = batches.reduce((a, b) => a + b.qtyOnHand, 0);
      if (total <= m.minStock) low.push({ medicine: m, totalStock: total, batches });
    }
    res.json({ ok: true, data: low });
  } catch (err) { next(err); }
});

// GET /api/v1/stock/near-expiry
router.get('/near-expiry', allRoles, async (req, res, next) => {
  try {
    const settings = await Settings.findOne();
    const days = settings?.nearExpiryDays ?? 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    const batches = await Batch.find({
      status: 'active',
      qtyOnHand: { $gt: 0 },
      expiryDate: { $gte: new Date(todayUtc()), $lte: cutoff },
    }).sort({ expiryDate: 1 }).populate('medicineId');

    res.json({ ok: true, data: batches });
  } catch (err) { next(err); }
});

// GET /api/v1/stock/expired
router.get('/expired', allRoles, async (req, res, next) => {
  try {
    const batches = await Batch.find({
      qtyOnHand: { $gt: 0 },
      expiryDate: { $lt: new Date(todayUtc()) },
    }).sort({ expiryDate: 1 }).populate('medicineId');
    res.json({ ok: true, data: batches });
  } catch (err) { next(err); }
});

// POST /api/v1/stock/writeoff
router.post('/writeoff', managerOrOwner, async (req: AuthRequest, res, next) => {
  try {
    const body = WriteOffSchema.parse(req.body);
    const batch = await Batch.findById(body.batchId);
    if (!batch) throw new AppError('NOT_FOUND', 404, 'Batch not found');
    if (batch.qtyOnHand === 0) throw new AppError('EMPTY', 400, 'Batch already empty');

    await mongoose.connection.transaction(async (session) => {
      const qty = batch.qtyOnHand;
      await StockMovement.create(
        [{
          batchId: batch._id,
          medicineId: batch.medicineId,
          type: 'EXPIRY_WRITEOFF',
          qty: -qty,
          refType: 'WriteOff',
          refId: 'WO-' + Date.now(),
          userId: req.user!._id,
          note: body.reason,
        }],
        { session }
      );
      await Batch.updateOne(
        { _id: batch._id },
        { qtyOnHand: 0, status: 'depleted' },
        { session }
      );
    });

    res.json({ ok: true, data: { message: 'Batch written off' } });
  } catch (err) { next(err); }
});

// POST /api/v1/stock/adjust
router.post('/adjust', managerOrOwner, async (req: AuthRequest, res, next) => {
  try {
    const body = StockAdjustSchema.parse(req.body);
    const batch = await Batch.findById(body.batchId);
    if (!batch) throw new AppError('NOT_FOUND', 404, 'Batch not found');

    const diff = body.countedQty - batch.qtyOnHand;
    if (diff === 0) { res.json({ ok: true, data: { message: 'No change' } }); return; }

    await mongoose.connection.transaction(async (session) => {
      await StockMovement.create(
        [{
          batchId: batch._id,
          medicineId: batch.medicineId,
          type: 'ADJUSTMENT',
          qty: diff,
          refType: 'Adjustment',
          refId: 'ADJ-' + Date.now(),
          userId: req.user!._id,
          note: body.reason,
        }],
        { session }
      );
      await Batch.updateOne(
        { _id: batch._id },
        { qtyOnHand: body.countedQty },
        { session }
      );
    });

    res.json({ ok: true, data: { adjusted: diff } });
  } catch (err) { next(err); }
});

// ─── Cycle Count Stock Audits ────────────────────────────────────────────────

// GET /api/v1/stock/sheet - interactive count sheet by rack/category
router.get('/sheet', managerOrOwner, async (req: AuthRequest, res, next) => {
  try {
    const { rack, category } = req.query;
    const medQuery: Record<string, unknown> = { isActive: true };
    if (rack) medQuery.rack = String(rack);
    if (category) medQuery.category = String(category);

    const meds = await Medicine.find(medQuery).sort({ name: 1 });
    const medIds = meds.map((m) => m._id);

    const batches = await Batch.find({
      medicineId: { $in: medIds },
      status: 'active',
      qtyOnHand: { $gte: 0 },
    }).sort({ expiryDate: 1 });

    const medMap = new Map(meds.map((m) => [m._id.toString(), m]));

    const sheetItems = batches.map((b) => {
      const med = medMap.get(b.medicineId.toString());
      const packSize = med?.packSize || 1;
      const unitCost = Math.round(b.purchasePricePerPack / packSize);
      return {
        medicineId: med?._id,
        medicineName: `${med?.name ?? 'Unknown'}${med?.strength ? ' ' + med.strength : ''}`,
        rack: med?.rack ?? '–',
        category: med?.category ?? 'General',
        packSize,
        looseUnit: med?.looseUnit ?? 'unit',
        packUnit: med?.packUnit ?? 'pack',
        batchId: b._id,
        batchNo: b.batchNo,
        expiryDate: b.expiryDate,
        systemQty: b.qtyOnHand,
        unitCost,
        purchasePricePerPack: b.purchasePricePerPack,
        salePricePerPack: b.salePricePerPack,
      };
    });

    res.json({ ok: true, data: sheetItems });
  } catch (err) { next(err); }
});

// POST /api/v1/stock/audits - commit physical cycle count reconciliation
router.post('/audits', managerOrOwner, async (req: AuthRequest, res, next) => {
  try {
    const { CreateStockAuditSchema } = await import('@hs-pharma/shared');
    const { StockAudit } = await import('./auditModel');
    const { nextAuditNo } = await import('../sales/counterModel');
    const body = CreateStockAuditSchema.parse(req.body);

    const audit = await mongoose.connection.transaction(async (session) => {
      const auditNo = await nextAuditNo(session);

      let totalVarianceQty = 0;
      let totalVarianceValue = 0;

      const processedItems = [];

      for (const item of body.items) {
        const variance = item.countedQty - item.systemQty;
        const varianceValue = variance * item.unitCost;
        totalVarianceQty += variance;
        totalVarianceValue += varianceValue;

        processedItems.push({
          medicineId: new mongoose.Types.ObjectId(item.medicineId),
          batchId: new mongoose.Types.ObjectId(item.batchId),
          medicineName: item.medicineName,
          batchNo: item.batchNo,
          systemQty: item.systemQty,
          countedQty: item.countedQty,
          variance,
          unitCost: item.unitCost,
          varianceValue,
        });

        // Apply physical reconciliation if there is a discrepancy
        if (variance !== 0) {
          await Batch.updateOne(
            { _id: item.batchId },
            { qtyOnHand: item.countedQty },
            { session }
          );

          await StockMovement.create(
            [{
              batchId: new mongoose.Types.ObjectId(item.batchId),
              medicineId: new mongoose.Types.ObjectId(item.medicineId),
              type: 'ADJUSTMENT',
              qty: variance,
              unitCost: item.unitCost,
              refType: 'StockAudit',
              refId: auditNo,
              userId: req.user!._id,
              note: `Cycle count audit: system ${item.systemQty} → counted ${item.countedQty} (diff ${variance})`,
            }],
            { session }
          );
        }
      }

      const [created] = await StockAudit.create(
        [{
          auditNo,
          rack: body.rack,
          category: body.category,
          conductedBy: req.user!._id,
          conductedByName: req.user!.name,
          status: 'completed',
          items: processedItems,
          totalVarianceQty,
          totalVarianceValue,
          notes: body.notes,
        }],
        { session }
      );

      return created;
    });

    res.status(201).json({ ok: true, data: audit });
  } catch (err) { next(err); }
});

// GET /api/v1/stock/audits - list past stock audits
router.get('/audits', managerOrOwner, async (req: AuthRequest, res, next) => {
  try {
    const { StockAudit } = await import('./auditModel');
    const audits = await StockAudit.find().sort({ createdAt: -1 }).limit(100);
    res.json({ ok: true, data: audits });
  } catch (err) { next(err); }
});

// GET /api/v1/stock/audits/:id - audit detail
router.get('/audits/:id', managerOrOwner, async (req: AuthRequest, res, next) => {
  try {
    const { StockAudit } = await import('./auditModel');
    const audit = await StockAudit.findById(req.params.id);
    if (!audit) throw new AppError('NOT_FOUND', 404, 'Stock audit not found');
    res.json({ ok: true, data: audit });
  } catch (err) { next(err); }
});

// GET /api/v1/stock/audits/:id/print - printable audit report HTML
router.get('/audits/:id/print', managerOrOwner, async (req: AuthRequest, res, next) => {
  try {
    const { StockAudit } = await import('./auditModel');
    const { formatDateTime } = await import('../../common/dates');
    const audit = await StockAudit.findById(req.params.id);
    if (!audit) throw new AppError('NOT_FOUND', 404, 'Stock audit not found');

    const settings = (await Settings.findOne()) ?? { shopName: 'HS Pharma', address: '' };

    const rows = audit.items.map((item, idx) => {
      const varColor = item.variance === 0 ? '#16a34a' : item.variance < 0 ? '#dc2626' : '#2563eb';
      const varSign = item.variance > 0 ? `+${item.variance}` : `${item.variance}`;
      return `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td><b>${item.medicineName}</b></td>
          <td>${item.batchNo}</td>
          <td style="text-align: right;">${item.systemQty}</td>
          <td style="text-align: right; font-weight: bold;">${item.countedQty}</td>
          <td style="text-align: right; color: ${varColor}; font-weight: bold;">${varSign}</td>
          <td style="text-align: right;">Rs ${(item.unitCost / 100).toFixed(2)}</td>
          <td style="text-align: right; font-weight: bold; color: ${varColor};">
            Rs ${(item.varianceValue / 100).toFixed(2)}
          </td>
        </tr>
      `;
    });

    const netVariancePaisa = audit.totalVarianceValue;
    const netFormatted = `Rs ${(netVariancePaisa / 100).toFixed(2)}`;

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Stock Audit - ${audit.auditNo}</title>
<style>
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body { width: 100%; max-width: 900px; margin: 20px auto; padding: 24px; color: #111; line-height: 1.35; }
  .hd { border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
  .hd h1 { margin: 0; font-size: 20px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; margin-top: 10px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; vertical-align: top; }
  th { background: #f4f4f4; font-weight: bold; }
  .ft { margin-top: 36px; display: flex; justify-content: space-between; font-size: 11px; }
  .sign-box { border-top: 1px solid #000; width: 220px; text-align: center; padding-top: 4px; }
  @media print { body { padding: 0; margin: 0; } }
</style>
</head>
<body>
  <div class="hd">
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <h1>${settings.shopName}</h1>
        <div style="font-size: 12px; color: #555;">${settings.address}</div>
        <h2 style="margin: 6px 0 0; font-size: 15px; text-transform: uppercase;">Physical Cycle Count Audit Report</h2>
      </div>
      <div style="text-align: right;">
        <h3 style="margin: 0; color: #0284c7;">${audit.auditNo}</h3>
        <small style="color: #666;">Date: ${formatDateTime(audit.createdAt)}</small>
      </div>
    </div>
    <div class="meta">
      <div>Scope: <b>${audit.rack ? `Rack: ${audit.rack}` : audit.category ? `Category: ${audit.category}` : 'Full Inventory'}</b></div>
      <div>Audited By: <b>${audit.conductedByName}</b></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 30px; text-align: center;">#</th>
        <th>Medicine Description</th>
        <th>Batch #</th>
        <th style="text-align: right;">System Qty</th>
        <th style="text-align: right;">Counted Qty</th>
        <th style="text-align: right;">Variance</th>
        <th style="text-align: right;">Unit Cost</th>
        <th style="text-align: right;">Variance Value</th>
      </tr>
    </thead>
    <tbody>
      ${rows.join('')}
    </tbody>
    <tfoot>
      <tr style="background: #f9f9f9; font-weight: bold;">
        <td colspan="5" style="text-align: right;">Total Net Variance:</td>
        <td style="text-align: right;">${audit.totalVarianceQty > 0 ? `+${audit.totalVarianceQty}` : audit.totalVarianceQty}</td>
        <td></td>
        <td style="text-align: right; color: ${audit.totalVarianceValue < 0 ? '#dc2626' : '#16a34a'};">
          ${netFormatted}
        </td>
      </tr>
    </tfoot>
  </table>

  ${audit.notes ? `<p style="margin-top: 16px; font-size: 12px; color: #555;"><b>Audit Notes:</b> ${audit.notes}</p>` : ''}

  <div class="ft">
    <div class="sign-box">Audited By (${audit.conductedByName})</div>
    <div class="sign-box">Pharmacist / Store Incharge Signature</div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) { next(err); }
});

export default router;
