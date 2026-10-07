import { Router } from 'express';
import { authenticate, allRoles, managerOrOwner, ownerOnly, AuthRequest } from '../../middleware/auth';
import { Supplier } from './model';
import { CreateSupplierSchema } from '@hs-pharma/shared';
import { AppError } from '../../common/errors';

const router = Router();
router.use(authenticate, managerOrOwner);

router.get('/', async (req, res, next) => {
  try {
    const suppliers = await Supplier.find({ isActive: true }).sort({ name: 1 });
    res.json({ ok: true, data: suppliers });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const s = await Supplier.findById(req.params.id);
    if (!s) throw new AppError('NOT_FOUND', 404, 'Supplier not found');
    res.json({ ok: true, data: s });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const body = CreateSupplierSchema.parse(req.body);
    const s = await Supplier.create(body);
    res.status(201).json({ ok: true, data: s });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const body = CreateSupplierSchema.partial().parse(req.body);
    const s = await Supplier.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!s) throw new AppError('NOT_FOUND', 404, 'Supplier not found');
    res.json({ ok: true, data: s });
  } catch (err) { next(err); }
});

export default router;
