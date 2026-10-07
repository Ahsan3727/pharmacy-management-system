import { Router } from 'express';
import mongoose from 'mongoose';
import { authenticate, managerOrOwner, AuthRequest } from '../../middleware/auth';
import { CreatePurchaseSchema } from '@hs-pharma/shared';
import { Purchase } from './model';
import { Medicine } from '../medicines/model';
import { Batch } from '../batches/model';
import { Supplier } from '../suppliers/model';
import { StockMovement } from '../stock/movementModel';
import { AppError } from '../../common/errors';
import { expiryToDate } from '../../common/dates';
import { mulDiv } from '@hs-pharma/shared';

const router = Router();
router.use(authenticate, managerOrOwner);

// POST /api/v1/purchases
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const body = CreatePurchaseSchema.parse(req.body);

    const supplier = await Supplier.findById(body.supplierId);
    if (!supplier) throw new AppError('NOT_FOUND', 404, 'Supplier not found');

    // Duplicate invoice check
    const dup = await Purchase.findOne({ supplierId: body.supplierId, supplierInvoiceNo: body.supplierInvoiceNo });
    if (dup) throw new AppError('DUPLICATE_INVOICE', 409, `Invoice ${body.supplierInvoiceNo} already entered for ${supplier.name}`);

    const savedLines: any[] = [];
    let totalAmount = 0;

    const result = await mongoose.connection.transaction(async (session) => {
      for (const line of body.lines) {
        const med = await Medicine.findById(line.medicineId).session(session);
        if (!med) throw new AppError('NOT_FOUND', 404, `Medicine ${line.medicineId} not found`);

        const expiryDate = new Date(expiryToDate(line.expiry));
        if (expiryDate < new Date()) throw new AppError('EXPIRY_PAST', 400, `Expiry ${line.expiry} has already passed`);

        const totalPacks = line.packs + line.bonusPacks;
        const baseUnits = totalPacks * med.packSize;
        // Effective purchase price per pack after bonus (cost spread over paid qty only)
        const effectivePP = line.bonusPacks > 0
          ? mulDiv(line.purchasePricePerPack, line.packs, totalPacks)
          : line.purchasePricePerPack;

        // Batch merge: same batchNo + expiry + prices → top up existing
        let batch = await Batch.findOne({
          medicineId: med._id,
          batchNo: line.batchNo.toUpperCase(),
          expiryDate,
          purchasePricePerPack: effectivePP,
          salePricePerPack: line.salePricePerPack,
        }).session(session);

        if (batch) {
          batch.qtyOnHand += baseUnits;
          await batch.save({ session });
        } else {
          [batch] = await Batch.create(
            [{
              medicineId: med._id,
              batchNo: line.batchNo.toUpperCase(),
              expiryDate,
              purchasePricePerPack: effectivePP,
              salePricePerPack: line.salePricePerPack,
              mrpPerPack: line.mrpPerPack,
              qtyOnHand: baseUnits,
              status: 'active',
            }],
            { session }
          );
        }

        // Stock movement
        await StockMovement.create(
          [{
            batchId: batch._id,
            medicineId: med._id,
            type: 'PURCHASE',
            qty: baseUnits,
            unitCost: Math.round(effectivePP / med.packSize),
            refType: 'Purchase',
            refId: body.supplierInvoiceNo,
            userId: req.user!._id,
          }],
          { session }
        );

        const lineTotal = line.packs * line.purchasePricePerPack;
        totalAmount += lineTotal;

        savedLines.push({
          medicineId: med._id,
          batchId: batch._id,
          batchNo: line.batchNo.toUpperCase(),
          expiryDate,
          packs: line.packs,
          bonusPacks: line.bonusPacks,
          totalBaseUnits: baseUnits,
          purchasePricePerPack: effectivePP,
          salePricePerPack: line.salePricePerPack,
          lineTotal,
        });

        // Update medicine cached prices
        await Medicine.updateOne(
          { _id: med._id },
          { purchasePricePerPack: effectivePP, salePricePerPack: line.salePricePerPack },
          { session }
        );
      }

      // Update supplier balance
      await Supplier.updateOne(
        { _id: supplier._id },
        { $inc: { balance: totalAmount } },
        { session }
      );

      const [purchase] = await Purchase.create(
        [{
          supplierId: supplier._id,
          supplierInvoiceNo: body.supplierInvoiceNo,
          invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : new Date(),
          lines: savedLines,
          totalAmount,
          paidAmount: 0,
          createdBy: req.user!._id,
        }],
        { session }
      );

      return purchase;
    });

    res.status(201).json({ ok: true, data: result });
  } catch (err) { next(err); }
});

// GET /api/v1/purchases
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(String(req.query.page ?? 1));
    const limit = Math.min(parseInt(String(req.query.limit ?? 20)), 100);
    const [items, total] = await Promise.all([
      Purchase.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
        .populate('supplierId', 'name'),
      Purchase.countDocuments(),
    ]);
    res.json({ ok: true, data: { items, total, page, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// GET /api/v1/purchases/:id
router.get('/:id', async (req, res, next) => {
  try {
    const p = await Purchase.findById(req.params.id).populate('supplierId', 'name');
    if (!p) throw new AppError('NOT_FOUND', 404, 'Purchase not found');
    res.json({ ok: true, data: p });
  } catch (err) { next(err); }
});

export default router;
