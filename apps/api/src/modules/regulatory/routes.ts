import { Router } from 'express';
import { authenticate, managerOrOwner, AuthRequest } from '../../middleware/auth';
import { Sale } from '../sales/model';
import { Medicine } from '../medicines/model';
import { Settings } from '../settings/model';
import { formatDate, formatDateTime, formatMmYy } from '../../common/dates';

const router = Router();
router.use(authenticate, managerOrOwner);

// GET /api/v1/regulatory/form9
router.get('/form9', async (req: AuthRequest, res, next) => {
  try {
    const { dateFrom, dateTo, search } = req.query;

    const query: Record<string, unknown> = {
      status: 'ok',
    };

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) (query.createdAt as any).$gte = new Date(String(dateFrom));
      if (dateTo) {
        const d = new Date(String(dateTo));
        d.setUTCHours(23, 59, 59, 999);
        (query.createdAt as any).$lte = d;
      }
    }

    // Find sales that have narcoticDetails or controlled drugs
    const sales = await Sale.find(query).sort({ createdAt: -1 }).limit(200);

    // Get all controlled medicine IDs
    const controlledMeds = await Medicine.find({
      $or: [{ isControlled: true }, { prescriptionType: 'controlled_narcotic' }],
    }).select('_id name');
    const controlledMedIds = new Set(controlledMeds.map((m) => m._id.toString()));

    const entries: any[] = [];

    for (const s of sales) {
      const hasNarcoticFlag = !!s.narcoticDetails;
      for (const item of s.items) {
        const isControlledItem = controlledMedIds.has(item.medicineId.toString());

        if (hasNarcoticFlag || isControlledItem) {
          entries.push({
            saleId: s._id,
            invoiceNo: s.invoiceNo,
            date: s.createdAt,
            patientName: s.narcoticDetails?.patientName || s.customerNameSnapshot || 'Walk-in Patient',
            patientCnic: s.narcoticDetails?.patientCnic || '–',
            doctorName: s.narcoticDetails?.doctorName || s.prescription || '–',
            doctorRegNo: s.narcoticDetails?.doctorRegNo || '–',
            prescriptionDate: s.narcoticDetails?.prescriptionDate || formatDate(s.createdAt),
            prescriptionSlipNo: s.narcoticDetails?.prescriptionSlipNo || '–',
            medicineName: item.nameSnapshot,
            batchNo: item.batchNoSnapshot,
            expiryDate: item.expirySnapshot,
            qty: item.qty,
            unitLabel: item.unitLabel,
            packPrice: item.packPrice,
            lineTotal: item.lineTotal,
            soldByName: s.soldByName,
          });
        }
      }
    }

    const filtered = search
      ? entries.filter(
          (e) =>
            e.patientName.toLowerCase().includes(String(search).toLowerCase()) ||
            e.doctorName.toLowerCase().includes(String(search).toLowerCase()) ||
            e.medicineName.toLowerCase().includes(String(search).toLowerCase()) ||
            e.invoiceNo.toLowerCase().includes(String(search).toLowerCase()) ||
            e.patientCnic.includes(String(search))
        )
      : entries;

    res.json({ ok: true, data: filtered });
  } catch (err) { next(err); }
});

// GET /api/v1/regulatory/form9/print
router.get('/form9/print', async (req: AuthRequest, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;

    const query: Record<string, unknown> = { status: 'ok' };
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) (query.createdAt as any).$gte = new Date(String(dateFrom));
      if (dateTo) {
        const d = new Date(String(dateTo));
        d.setUTCHours(23, 59, 59, 999);
        (query.createdAt as any).$lte = d;
      }
    }

    const settings = await Settings.findOne() ?? {
      shopName: 'HS Pharma',
      address: '',
      phone: '',
    };

    const sales = await Sale.find(query).sort({ createdAt: 1 }).limit(300);
    const controlledMeds = await Medicine.find({
      $or: [{ isControlled: true }, { prescriptionType: 'controlled_narcotic' }],
    }).select('_id');
    const controlledMedIds = new Set(controlledMeds.map((m) => m._id.toString()));

    const rows: string[] = [];
    let sr = 1;

    for (const s of sales) {
      const hasNarcoticFlag = !!s.narcoticDetails;
      for (const item of s.items) {
        if (hasNarcoticFlag || controlledMedIds.has(item.medicineId.toString())) {
          rows.push(`
            <tr>
              <td style="text-align: center;">${sr++}</td>
              <td>${formatDate(s.createdAt)}</td>
              <td>
                <b>${s.narcoticDetails?.patientName || s.customerNameSnapshot}</b><br>
                <small>CNIC: ${s.narcoticDetails?.patientCnic || '–'}</small>
              </td>
              <td>
                <b>${s.narcoticDetails?.doctorName || s.prescription || '–'}</b><br>
                <small>Reg: ${s.narcoticDetails?.doctorRegNo || '–'}</small>
              </td>
              <td>
                <b>${item.nameSnapshot}</b><br>
                <small>Batch: ${item.batchNoSnapshot}</small>
              </td>
              <td style="text-align: center; font-weight: bold;">
                ${item.qty} (${item.unitLabel ?? 'units'})
              </td>
              <td>${s.invoiceNo}</td>
              <td>${s.soldByName}</td>
            </tr>
          `);
        }
      }
    }

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Form-9 Narcotic Register</title>
<style>
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body { width: 100%; max-width: 1000px; margin: 20px auto; padding: 24px; color: #111; line-height: 1.35; }
  .hd { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
  .hd h1 { margin: 0; font-size: 20px; }
  .hd h2 { margin: 4px 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 11px; }
  th, td { border: 1px solid #444; padding: 6px 8px; vertical-align: top; }
  th { background: #f0f0f0; font-weight: bold; text-align: left; }
  .ft { margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; }
  .sign-box { border-top: 1px solid #000; width: 220px; text-align: center; padding-top: 4px; }
  @media print {
    body { padding: 0; margin: 0; }
  }
</style>
</head>
<body>
  <div class="hd">
    <h1>${settings.shopName}</h1>
    ${settings.address ? `<div>${settings.address}</div>` : ''}
    <h2>FORM-9: REGISTER OF PURCHASE & SALE OF CONTROLLED / NARCOTIC SUBSTANCES</h2>
    <div style="font-size: 11px; margin-top: 4px; color: #444;">(Maintained under Rule 9 of Drug Rules & Pharmacy Council Regulations)</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 35px; text-align: center;">Sr.</th>
        <th style="width: 75px;">Date</th>
        <th>Patient Name & CNIC</th>
        <th>Prescriber & Reg #</th>
        <th>Drug & Batch</th>
        <th style="width: 70px; text-align: center;">Qty Dispensed</th>
        <th style="width: 100px;">Invoice #</th>
        <th style="width: 90px;">Dispenser</th>
      </tr>
    </thead>
    <tbody>
      ${rows.length > 0 ? rows.join('') : '<tr><td colspan="8" style="text-align: center; padding: 20px;">No controlled drug dispensing records found for the period.</td></tr>'}
    </tbody>
  </table>

  <div class="ft">
    <div class="sign-box">Qualified Pharmacist / Incharge</div>
    <div class="sign-box">Government Drug Inspector (Stamp & Date)</div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) { next(err); }
});

export default router;
