import { Router } from 'express';
import { z } from 'zod';
import { authenticate, ownerOnly, AuthRequest } from '../../middleware/auth';
import { Expense, EXPENSE_CATEGORIES } from './model';
import { AppError } from '../../common/errors';

const router = Router();
router.use(authenticate);

const CreateExpenseSchema = z.object({
  date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  category: z.enum(EXPENSE_CATEGORIES),
  amount:   z.number().positive('Amount must be positive'),  // in rupees from client
  note:     z.string().trim().max(200).optional(),
});

// POST /api/v1/expenses
router.post('/', ownerOnly, async (req: AuthRequest, res, next) => {
  try {
    const body = CreateExpenseSchema.parse(req.body);
    const expense = await Expense.create({
      date:        body.date,
      category:    body.category,
      amountPaisa: Math.round(body.amount * 100),  // Rs → paisa
      note:        body.note ?? '',
      createdBy:   req.user!.name,
    });
    res.status(201).json({ ok: true, data: expense });
  } catch (err) { next(err); }
});

// GET /api/v1/expenses?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', ownerOnly, async (req: AuthRequest, res, next) => {
  try {
    const from = String(req.query.from ?? '');
    const to   = String(req.query.to   ?? '');

    const filter: Record<string, any> = {};
    if (from) filter.date = { ...filter.date, $gte: from };
    if (to)   filter.date = { ...filter.date, $lte: to };

    const expenses = await Expense.find(filter).sort({ date: -1, createdAt: -1 });
    res.json({ ok: true, data: expenses });
  } catch (err) { next(err); }
});

// DELETE /api/v1/expenses/:id
router.delete('/:id', ownerOnly, async (req, res, next) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) throw new AppError('NOT_FOUND', 404, 'Expense not found');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
