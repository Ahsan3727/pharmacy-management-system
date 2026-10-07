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

export default router;
