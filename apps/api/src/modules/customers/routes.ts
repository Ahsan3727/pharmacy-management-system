import { Router } from 'express';
import { authenticate, allRoles, managerOrOwner, AuthRequest } from '../../middleware/auth';
import { Customer } from './model';
import { CustomerLedger } from './ledgerModel';
import { CreateCustomerSchema, CustomerPaymentSchema } from '@hs-pharma/shared';
import { AppError } from '../../common/errors';
import { todayUtc } from '../../common/dates';
import mongoose from 'mongoose';

const router = Router();
router.use(authenticate);

// GET /api/v1/customers/outstanding
router.get('/outstanding', allRoles, async (req, res, next) => {
  try {
    const customers = await Customer.find({ balance: { $gt: 0 }, isActive: true })
      .sort({ balance: -1 });
    res.json({ ok: true, data: customers });
  } catch (err) { next(err); }
});

// GET /api/v1/customers
router.get('/', allRoles, async (req, res, next) => {
  try {
    const customers = await Customer.find({ isActive: true }).sort({ name: 1 });
    res.json({ ok: true, data: customers });
  } catch (err) { next(err); }
});

// GET /api/v1/customers/:id/ledger
router.get('/:id/ledger', allRoles, async (req, res, next) => {
  try {
    const page = parseInt(String(req.query.page ?? 1));
    const limit = Math.min(parseInt(String(req.query.limit ?? 20)), 100);
    const [entries, total] = await Promise.all([
      CustomerLedger.find({ customerId: req.params.id })
        .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      CustomerLedger.countDocuments({ customerId: req.params.id }),
    ]);
    res.json({ ok: true, data: { entries, total, page, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// GET /api/v1/customers/:id
router.get('/:id', allRoles, async (req, res, next) => {
  try {
    const c = await Customer.findById(req.params.id);
    if (!c) throw new AppError('NOT_FOUND', 404, 'Customer not found');
    res.json({ ok: true, data: c });
  } catch (err) { next(err); }
});

// POST /api/v1/customers
router.post('/', allRoles, async (req, res, next) => {
  try {
    const body = CreateCustomerSchema.parse(req.body);
    const c = await Customer.create(body);
    res.status(201).json({ ok: true, data: c });
  } catch (err) { next(err); }
});

// PATCH /api/v1/customers/:id
router.patch('/:id', managerOrOwner, async (req, res, next) => {
  try {
    const body = CreateCustomerSchema.partial().parse(req.body);
    const c = await Customer.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!c) throw new AppError('NOT_FOUND', 404, 'Customer not found');
    res.json({ ok: true, data: c });
  } catch (err) { next(err); }
});

// POST /api/v1/customers/:id/payments
router.post('/:id/payments', allRoles, async (req: AuthRequest, res, next) => {
  try {
    const body = CustomerPaymentSchema.parse(req.body);
    const today = todayUtc();

    await mongoose.connection.transaction(async (session) => {
      const customer = await Customer.findById(req.params.id).session(session);
      if (!customer) throw new AppError('NOT_FOUND', 404, 'Customer not found');
      if (body.amount > customer.balance)
        throw new AppError('OVERPAYMENT', 400, `Amount exceeds balance of Rs ${customer.balance / 100}`);

      await CustomerLedger.create(
        [{
          customerId: customer._id,
          type: 'PAYMENT',
          amount: -body.amount,
          method: body.method,
          note: body.note,
          refType: 'Payment',
          refId: `RCPT-${Date.now()}`,
          userId: req.user!._id,
          date: today,
        }],
        { session }
      );
      await Customer.updateOne(
        { _id: customer._id },
        { $inc: { balance: -body.amount } },
        { session }
      );
    });

    const updated = await Customer.findById(req.params.id);
    res.json({ ok: true, data: updated });
  } catch (err) { next(err); }
});

export default router;
