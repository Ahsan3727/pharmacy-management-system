import { Router } from 'express';
import mongoose from 'mongoose';
import { authenticate, allRoles, managerOrOwner, AuthRequest } from '../../middleware/auth';
import { SaleReturn } from '../sales/returnModel';
import { SupplierReturn } from '../purchases/returnModel';
import { Sale } from '../sales/model';
import { Batch } from '../batches/model';
import { Medicine } from '../medicines/model';
import { Supplier } from '../suppliers/model';
import { StockMovement } from '../stock/movementModel';
import { Customer } from '../customers/model';
import { CustomerLedger } from '../customers/ledgerModel';
import { Settings } from '../settings/model';
import { nextReturnNo, nextDebitNoteNo } from '../sales/counterModel';
import { SaleReturnSchema, CreateSupplierReturnSchema } from '@hs-pharma/shared';
import { AppError } from '../../common/errors';
import { formatMoney } from '@hs-pharma/shared';
import { formatMmYy, formatDate, todayUtc } from '../../common/dates';

const router = Router();
router.use(authenticate);

// ─── Customer Returns ────────────────────────────────────────────────────────

// POST /api/v1/returns/customer
router.post('/customer', allRoles, async (req: AuthRequest, res, next) => {
  try {
    const body = SaleReturnSchema.parse(req.body);

    const sale = await Sale.findById(body.saleId);
    if (!sale) throw new AppError('NOT_FOUND', 404, 'Sale not found');
    if (sale.status === 'void') throw new AppError('VOID_SALE', 400, 'Cannot return items from a voided sale');

    const result = await mongoose.connection.transaction(async (session) => {
      const returnItems: any[] = [];
      let totalRefund = 0;

      for (const reqItem of body.items) {
        const line = sale.items[reqItem.saleItemIndex];
        if (!line) {
          throw new AppError('INVALID_ITEM', 400, `Item index ${reqItem.saleItemIndex} does not exist on sale`);
        }

        const previouslyReturned = line.returnedQty ?? 0;
        const availableToReturn = line.qty - previouslyReturned;
        if (reqItem.quantity > availableToReturn) {
          throw new AppError(
            'QTY_EXCEEDED',
            400,
            `Cannot return ${reqItem.quantity} units of ${line.nameSnapshot}. Maximum available to return is ${availableToReturn}`
          );
        }

        // Calculate proportional net refund per unit (accounting for overall sale discount)
        const discountFactor = 1 - (sale.discountBP / 10000);
        const lineNetTotal = Math.round(line.lineTotal * discountFactor);
        const unitRefundPrice = Math.floor(lineNetTotal / line.qty);
        const itemRefund = unitRefundPrice * reqItem.quantity;
        totalRefund += itemRefund;

        // Fetch medicine for pack size
        const med = await Medicine.findById(line.medicineId).session(session);
        const packSize = med?.packSize ?? 1;

        if (reqItem.restock) {
          // Increment batch stock
          const batch = await Batch.findById(line.batchId).session(session);
          if (batch) {
            batch.qtyOnHand += reqItem.quantity;
            if (batch.status === 'depleted') batch.status = 'active';
            await batch.save({ session });
          }

          // Write StockMovement
          await StockMovement.create(
            [{
              batchId: line.batchId,
              medicineId: line.medicineId,
              type: 'RETURN',
              qty: reqItem.quantity,
              unitCost: Math.round(line.costSnapshot / packSize),
              refType: 'SaleReturn',
              refId: sale.invoiceNo,
              userId: req.user!._id,
              note: `Restocked customer return (${body.reason})`,
            }],
            { session }
          );
        } else {
          // Damaged/Quarantined return: does not increment stock, logs damage
          await StockMovement.create(
            [{
              batchId: line.batchId,
              medicineId: line.medicineId,
              type: 'DAMAGE',
              qty: 0,
              unitCost: Math.round(line.costSnapshot / packSize),
              refType: 'SaleReturn',
              refId: sale.invoiceNo,
              userId: req.user!._id,
              note: `Customer return damaged/compromised (${body.reason})`,
            }],
            { session }
          );
        }

        // Update returned quantity on sale line
        line.returnedQty = previouslyReturned + reqItem.quantity;

        returnItems.push({
          saleItemIndex: reqItem.saleItemIndex,
          medicineId: line.medicineId,
          batchId: line.batchId,
          nameSnapshot: line.nameSnapshot,
          batchNoSnapshot: line.batchNoSnapshot,
          qtyReturned: reqItem.quantity,
          unitRefundPrice,
          refundAmount: itemRefund,
          restock: reqItem.restock,
        });
      }

      // Handle refund accounting
      if (body.refundMethod === 'udhaar_reduction' && sale.customerId) {
        await Customer.updateOne(
          { _id: sale.customerId },
          { $inc: { balance: -totalRefund } },
          { session }
        );

        await CustomerLedger.create(
          [{
            customerId: sale.customerId,
            type: 'RETURN_ADJUST',
            amount: -totalRefund,
            date: todayUtc(),
            refType: 'SaleReturn',
            refId: sale.invoiceNo,
            note: `Refund for return against ${sale.invoiceNo}`,
            userId: req.user!._id,
          }],
          { session }
        );
      }

      const returnNo = await nextReturnNo(session);

      const [retDoc] = await SaleReturn.create(
        [{
          returnNo,
          saleId: sale._id,
          saleInvoiceNo: sale.invoiceNo,
          customerId: sale.customerId,
          customerNameSnapshot: sale.customerNameSnapshot,
          items: returnItems,
          totalRefund,
          refundMethod: body.refundMethod,
          reason: body.reason,
          processedBy: req.user!._id,
          processedByName: req.user!.name,
        }],
        { session }
      );

      await sale.save({ session });

      return retDoc;
    });

    res.status(201).json({ ok: true, data: result });
  } catch (err) { next(err); }
});

// GET /api/v1/returns/customer
router.get('/customer', allRoles, async (req, res, next) => {
  try {
    const page = parseInt(String(req.query.page ?? 1));
    const limit = Math.min(parseInt(String(req.query.limit ?? 20)), 100);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (req.query.saleInvoiceNo) filter.saleInvoiceNo = req.query.saleInvoiceNo;
    if (req.query.customerId) filter.customerId = req.query.customerId;

    const [items, total] = await Promise.all([
      SaleReturn.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      SaleReturn.countDocuments(filter),
    ]);

    res.json({ ok: true, data: { items, total, page, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// GET /api/v1/returns/customer/:id/print
router.get('/customer/:id/print', allRoles, async (req, res, next) => {
  try {
    const ret = await SaleReturn.findById(req.params.id);
    if (!ret) throw new AppError('NOT_FOUND', 404, 'Return record not found');

    const settings = await Settings.findOne() ?? {
      shopName: 'HS Pharma',
      address: '',
      phone: '',
      billFooter: 'Thank you.',
    };

    const rows = ret.items.map((i) =>
      `<div class="ln"><span>${i.nameSnapshot}<small>${i.batchNoSnapshot} · Qty: ${i.qtyReturned} · ${i.restock ? 'Restocked' : 'Damaged'}</small></span><b>${formatMoney(i.refundAmount)}</b></div>`
    ).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Return ${ret.returnNo}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: monospace; }
  body { width: 76mm; padding: 3mm 4mm; font-size: 11px; line-height: 1.35; color: #000; }
  .hd { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 6px; }
  .hd h2 { font-size: 14px; font-weight: bold; }
  .meta { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 4px; }
  .ln { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3px; }
  .ln span { flex: 1; margin-right: 4px; }
  .ln small { display: block; font-size: 9px; color: #444; }
  .tot { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; margin: 6px 0; }
  .tot .r { display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; }
  .ft { text-align: center; font-size: 9px; margin-top: 6px; }
</style>
</head>
<body>
  <div class="hd">
    <h2>${settings.shopName}</h2>
    ${settings.address ? `<div>${settings.address}</div>` : ''}
    ${settings.phone ? `<div>Tel: ${settings.phone}</div>` : ''}
    <div style="font-weight: bold; margin-top: 4px;">CUSTOMER RETURN VOUCHER</div>
  </div>

  <div class="meta"><span>Return #: <b>${ret.returnNo}</b></span><span>Inv: ${ret.saleInvoiceNo}</span></div>
  <div class="meta"><span>Date: ${formatDate(ret.createdAt)}</span><span>By: ${ret.processedByName}</span></div>
  <div class="meta"><span>Customer: ${ret.customerNameSnapshot}</span><span>Method: ${ret.refundMethod}</span></div>
  <div class="meta"><span>Reason: <i>${ret.reason}</i></span></div>

  <div style="margin: 6px 0; border-top: 1px dashed #000; padding-top: 4px;">
    ${rows}
  </div>

  <div class="tot">
    <div class="r"><span>TOTAL REFUND:</span><span>${formatMoney(ret.totalRefund)}</span></div>
  </div>

  <div class="ft">
    <div>Goods returned and accounted for.</div>
    <div>${settings.billFooter}</div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) { next(err); }
});

// ─── Supplier Returns (Debit Notes) ──────────────────────────────────────────

// POST /api/v1/returns/supplier
router.post('/supplier', managerOrOwner, async (req: AuthRequest, res, next) => {
  try {
    const body = CreateSupplierReturnSchema.parse(req.body);

    const supplier = await Supplier.findById(body.supplierId);
    if (!supplier) throw new AppError('NOT_FOUND', 404, 'Supplier not found');

    const result = await mongoose.connection.transaction(async (session) => {
      const debitItems: any[] = [];
      let totalCreditAmount = 0;

      for (const item of body.items) {
        const batch = await Batch.findById(item.batchId).session(session);
        if (!batch) throw new AppError('NOT_FOUND', 404, `Batch ${item.batchId} not found`);

        const med = await Medicine.findById(batch.medicineId).session(session);
        if (!med) throw new AppError('NOT_FOUND', 404, 'Medicine not found for batch');

        const baseUnits = item.packs * med.packSize;
        if (batch.qtyOnHand < baseUnits) {
          throw new AppError(
            'INSUFFICIENT_STOCK',
            400,
            `Cannot return ${item.packs} packs (${baseUnits} units) of ${med.name}. Only ${batch.qtyOnHand} units on hand.`
          );
        }

        // Deduct stock from batch
        batch.qtyOnHand -= baseUnits;
        if (batch.qtyOnHand === 0) batch.status = 'depleted';
        await batch.save({ session });

        const creditTotal = item.packs * item.unitCreditPricePerPack;
        totalCreditAmount += creditTotal;

        // Log StockMovement
        await StockMovement.create(
          [{
            batchId: batch._id,
            medicineId: med._id,
            type: 'PURCHASE_RETURN',
            qty: -baseUnits,
            unitCost: Math.round(item.unitCreditPricePerPack / med.packSize),
            refType: 'SupplierReturn',
            userId: req.user!._id,
            note: `Supplier debit return (${item.reason})`,
          }],
          { session }
        );

        debitItems.push({
          medicineId: med._id,
          batchId: batch._id,
          medicineName: `${med.name} ${med.strength ?? ''}`.trim(),
          batchNo: batch.batchNo,
          expiryDate: batch.expiryDate,
          packs: item.packs,
          packSize: med.packSize,
          baseUnits,
          unitCreditPricePerPack: item.unitCreditPricePerPack,
          creditTotal,
          reason: item.reason,
        });
      }

      // Reduce supplier balance (accounts payable credit)
      await Supplier.updateOne(
        { _id: supplier._id },
        { $inc: { balance: -totalCreditAmount } },
        { session }
      );

      const debitNoteNo = await nextDebitNoteNo(session);

      const [retDoc] = await SupplierReturn.create(
        [{
          debitNoteNo,
          supplierId: supplier._id,
          supplierName: supplier.name,
          items: debitItems,
          totalCreditAmount,
          note: body.note ?? '',
          processedBy: req.user!._id,
          processedByName: req.user!.name,
        }],
        { session }
      );

      return retDoc;
    });

    res.status(201).json({ ok: true, data: result });
  } catch (err) { next(err); }
});

// GET /api/v1/returns/supplier
router.get('/supplier', managerOrOwner, async (req, res, next) => {
  try {
    const page = parseInt(String(req.query.page ?? 1));
    const limit = Math.min(parseInt(String(req.query.limit ?? 20)), 100);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (req.query.supplierId) filter.supplierId = req.query.supplierId;

    const [items, total] = await Promise.all([
      SupplierReturn.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      SupplierReturn.countDocuments(filter),
    ]);

    res.json({ ok: true, data: { items, total, page, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// GET /api/v1/returns/supplier/:id/print
router.get('/supplier/:id/print', managerOrOwner, async (req, res, next) => {
  try {
    const doc = await SupplierReturn.findById(req.params.id);
    if (!doc) throw new AppError('NOT_FOUND', 404, 'Debit note not found');

    const settings = await Settings.findOne() ?? {
      shopName: 'HS Pharma',
      address: '',
      phone: '',
      billFooter: 'Thank you.',
    };

    const rows = doc.items.map((i) =>
      `<tr>
        <td><b>${i.medicineName}</b><br><small>Batch: ${i.batchNo} · Exp: ${formatMmYy(i.expiryDate)} · Reason: ${i.reason}</small></td>
        <td style="text-align: right;">${i.packs} pk</td>
        <td style="text-align: right;">${formatMoney(i.unitCreditPricePerPack)}</td>
        <td style="text-align: right;"><b>${formatMoney(i.creditTotal)}</b></td>
      </tr>`
    ).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Debit Note ${doc.debitNoteNo}</title>
<style>
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body { width: 100%; max-width: 800px; margin: 20px auto; padding: 24px; color: #111; line-height: 1.4; }
  .hd { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
  .hd h1 { margin: 0 0 4px; font-size: 24px; }
  .badge { display: inline-block; background: #000; color: #fff; padding: 4px 10px; font-weight: bold; font-size: 13px; border-radius: 4px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
  th { background: #f3f4f6; text-align: left; padding: 8px 10px; border-bottom: 2px solid #ccc; }
  td { padding: 8px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
  .total-card { margin-left: auto; width: 280px; padding: 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; }
  .total-row { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; }
  .sign { display: flex; justify-content: space-between; margin-top: 50px; font-size: 12px; }
  .sign div { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 4px; }
</style>
</head>
<body>
  <div class="hd">
    <div>
      <h1>${settings.shopName}</h1>
      <div>${settings.address}</div>
      <div>Tel: ${settings.phone}</div>
    </div>
    <div style="text-align: right;">
      <div class="badge">VENDOR DEBIT NOTE</div>
      <div style="font-size: 16px; font-weight: bold; margin-top: 6px;">${doc.debitNoteNo}</div>
      <div style="color: #666; font-size: 12px;">Date: ${formatDate(doc.createdAt)}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div>
      <b>Issued To (Supplier):</b>
      <div style="font-size: 15px; font-weight: bold; margin-top: 2px;">${doc.supplierName}</div>
      ${doc.note ? `<div style="margin-top: 4px; color: #555;">Note: ${doc.note}</div>` : ''}
    </div>
    <div style="text-align: right;">
      <b>Processed By:</b>
      <div>${doc.processedByName}</div>
      <div style="color: #666;">Status: Adjusted from Payable Balance</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Returned Item & Reason</th>
        <th style="text-align: right;">Packs</th>
        <th style="text-align: right;">Credit Rate</th>
        <th style="text-align: right;">Total Credit</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="total-card">
    <div class="total-row">
      <span>Total Debit Credit:</span>
      <span>${formatMoney(doc.totalCreditAmount)}</span>
    </div>
  </div>

  <div class="sign">
    <div>Prepared by Store Incharge</div>
    <div>Distributor Receiving & Stamp</div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) { next(err); }
});

export default router;
