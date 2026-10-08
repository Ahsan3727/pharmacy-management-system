import { Router } from 'express';
import { z } from 'zod';
import { authenticate, managerOrOwner, AuthRequest } from '../../middleware/auth';
import { Closing } from './model';
import { Sale } from '../sales/model';
import { CustomerLedger } from '../customers/ledgerModel';
import { todayUtc } from '../../common/dates';
import { AppError } from '../../common/errors';

const router = Router();
router.use(authenticate);

function shiftDate(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const CreateClosingSchema = z.object({
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  openingCash: z.number().int().min(0, 'Opening cash must be non-negative'), // in paisa
  countedCash: z.number().int().min(0, 'Counted cash must be non-negative'), // in paisa
  notes:       z.string().trim().max(500).optional(),
});

// GET /api/v1/closing/today
router.get('/today', managerOrOwner, async (req: AuthRequest, res, next) => {
  try {
    const today = todayUtc();
    const existing = await Closing.findOne({ date: today });

    // Last recorded closing for default opening cash
    const lastClosing = await Closing.findOne().sort({ date: -1 });
    const defaultOpeningCash = lastClosing ? lastClosing.countedCash : 0;

    // Cash sales today
    const [cashSalesAgg] = await Sale.aggregate([
      { $match: { status: 'ok', createdAt: { $gte: new Date(today), $lt: new Date(shiftDate(today, 1)) } } },
      { $group: { _id: null, cash: { $sum: '$cashPaid' } } },
    ]);
    const cashSales = cashSalesAgg?.cash ?? 0;

    // Udhaar cash received today
    const [ledgerAgg] = await CustomerLedger.aggregate([
      {
        $match: {
          type: 'PAYMENT',
          date: today,
          $or: [{ method: 'cash' }, { method: { $exists: false } }, { method: null }],
        },
      },
      { $group: { _id: null, rc: { $sum: { $abs: '$amount' } } } },
    ]);
    const udhaarCashReceived = ledgerAgg?.rc ?? 0;

    const opening = existing ? existing.openingCash : defaultOpeningCash;
    const expectedCash = opening + cashSales + udhaarCashReceived;

    res.json({
      ok: true,
      data: {
        date: today,
        isClosed: !!existing,
        closing: existing,
        defaultOpeningCash,
        cashSales,
        udhaarCashReceived,
        expectedCash,
      },
    });
  } catch (err) { next(err); }
});

// GET /api/v1/closing (history)
router.get('/', managerOrOwner, async (req: AuthRequest, res, next) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? 30)), 100);
    const closings = await Closing.find().sort({ date: -1 }).limit(limit);
    res.json({ ok: true, data: closings });
  } catch (err) { next(err); }
});

// POST /api/v1/closing
router.post('/', managerOrOwner, async (req: AuthRequest, res, next) => {
  try {
    const body = CreateClosingSchema.parse(req.body);
    const date = body.date || todayUtc();

    const existing = await Closing.findOne({ date });
    if (existing) {
      throw new AppError('ALREADY_CLOSED', 409, `Day has already been closed for ${date}`);
    }

    // Cash sales for specified date
    const [cashSalesAgg] = await Sale.aggregate([
      { $match: { status: 'ok', createdAt: { $gte: new Date(date), $lt: new Date(shiftDate(date, 1)) } } },
      { $group: { _id: null, cash: { $sum: '$cashPaid' } } },
    ]);
    const cashSales = cashSalesAgg?.cash ?? 0;

    // Udhaar cash received on date
    const [ledgerAgg] = await CustomerLedger.aggregate([
      {
        $match: {
          type: 'PAYMENT',
          date,
          $or: [{ method: 'cash' }, { method: { $exists: false } }, { method: null }],
        },
      },
      { $group: { _id: null, rc: { $sum: { $abs: '$amount' } } } },
    ]);
    const udhaarCashReceived = ledgerAgg?.rc ?? 0;

    const expectedCash = body.openingCash + cashSales + udhaarCashReceived;
    const difference = body.countedCash - expectedCash;

    const closing = await Closing.create({
      date,
      openingCash:        body.openingCash,
      cashSales,
      udhaarCashReceived,
      expectedCash,
      countedCash:        body.countedCash,
      difference,
      closedBy:           req.user!.name,
      notes:              body.notes ?? '',
    });

    res.status(201).json({ ok: true, data: closing });
  } catch (err) { next(err); }
});

export default router;
