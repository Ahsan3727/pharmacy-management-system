import { Router } from 'express';
import { authenticate, allRoles, managerOrOwner, ownerOnly, AuthRequest } from '../../middleware/auth';
import { Medicine, generateSearchTokens } from './model';
import { Batch } from '../batches/model';
import { AppError } from '../../common/errors';
import { CreateMedicineSchema } from '@hs-pharma/shared';

const router = Router();
router.use(authenticate);

// GET /api/v1/medicines/search?q=par
router.get('/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    if (!q) { res.json({ ok: true, data: [] }); return; }

    const words = q.split(/\s+/);
    const query = words.length === 1
      ? { searchTokens: { $regex: `^${q}`, $options: 'i' }, isActive: true }
      : { $and: words.map(w => ({ searchTokens: { $regex: `^${w}`, $options: 'i' } })), isActive: true };

    const meds = await Medicine.find(query).limit(12);

    // Add stock info for each
    const result = await Promise.all(
      meds.map(async (m) => {
        const batches = await Batch.find({
          medicineId: m._id,
          status: 'active',
          qtyOnHand: { $gt: 0 },
          expiryDate: { $gte: new Date() },
        }).sort({ expiryDate: 1 }).limit(5);

        const totalStock = batches.reduce((a, b) => a + b.qtyOnHand, 0);
        const nextExpiry = batches[0]?.expiryDate;
        const salePrice = batches[0]?.salePricePerPack;

        return {
          _id: m._id,
          name: m.name,
          genericName: m.genericName,
          strength: m.strength,
          company: m.company,
          packSize: m.packSize,
          packsPerBox: m.packsPerBox,
          looseUnit: m.looseUnit,
          packUnit: m.packUnit,
          rack: m.rack,
          isControlled: m.isControlled,
          barcodes: m.barcodes,
          totalStock,
          nextExpiry,
          salePrice,
          batches: batches.map(b => ({
            _id: b._id,
            batchNo: b.batchNo,
            expiryDate: b.expiryDate,
            qtyOnHand: b.qtyOnHand,
            salePricePerPack: b.salePricePerPack,
          })),
        };
      })
    );

    res.json({ ok: true, data: result });
  } catch (err) { next(err); }
});

// GET /api/v1/medicines/by-barcode/:code
router.get('/by-barcode/:code', async (req, res, next) => {
  try {
    const med = await Medicine.findOne({ barcodes: req.params.code, isActive: true });
    if (!med) throw new AppError('NOT_FOUND', 404, 'Barcode not found');
    res.json({ ok: true, data: med });
  } catch (err) { next(err); }
});

// GET /api/v1/medicines
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(String(req.query.page ?? 1));
    const limit = Math.min(parseInt(String(req.query.limit ?? 50)), 200);
    const skip = (page - 1) * limit;
    const [meds, total] = await Promise.all([
      Medicine.find({ isActive: true }).skip(skip).limit(limit).sort({ name: 1 }),
      Medicine.countDocuments({ isActive: true }),
    ]);
    res.json({ ok: true, data: { items: meds, total, page, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// GET /api/v1/medicines/:id
router.get('/:id', async (req, res, next) => {
  try {
    const med = await Medicine.findById(req.params.id);
    if (!med) throw new AppError('NOT_FOUND', 404, 'Medicine not found');
    res.json({ ok: true, data: med });
  } catch (err) { next(err); }
});

// POST /api/v1/medicines
router.post('/', managerOrOwner, async (req: AuthRequest, res, next) => {
  try {
    const body = CreateMedicineSchema.parse(req.body);

    // Duplicate check
    const existing = await Medicine.findOne({
      name: { $regex: `^${body.name}$`, $options: 'i' },
      strength: body.strength,
      isActive: true,
    });
    if (existing) throw new AppError('DUPLICATE', 409, `${body.name} ${body.strength ?? ''} already exists`);

    // Barcode uniqueness
    if (body.barcodes?.length) {
      const bc = await Medicine.findOne({ barcodes: { $in: body.barcodes } });
      if (bc) throw new AppError('BARCODE_TAKEN', 409, 'A barcode belongs to another medicine');
    }

    const searchTokens = generateSearchTokens(body.name, body.genericName, body.company ?? '');
    const med = await Medicine.create({ ...body, searchTokens });
    res.status(201).json({ ok: true, data: med });
  } catch (err) { next(err); }
});

// PATCH /api/v1/medicines/:id
router.patch('/:id', managerOrOwner, async (req: AuthRequest, res, next) => {
  try {
    const body = CreateMedicineSchema.partial().parse(req.body);
    const med = await Medicine.findById(req.params.id);
    if (!med) throw new AppError('NOT_FOUND', 404, 'Medicine not found');

    if (body.name || body.genericName || body.company) {
      body.searchTokens = generateSearchTokens(
        body.name ?? med.name,
        body.genericName ?? med.genericName,
        body.company ?? med.company ?? ''
      );
    }

    Object.assign(med, body);
    await med.save();
    res.json({ ok: true, data: med });
  } catch (err) { next(err); }
});

// DELETE /api/v1/medicines/:id (soft)
router.delete('/:id', managerOrOwner, async (req, res, next) => {
  try {
    await Medicine.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ ok: true, data: null });
  } catch (err) { next(err); }
});

export default router;
