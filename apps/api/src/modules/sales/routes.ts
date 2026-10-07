import { Router } from 'express';
import { authenticate, allRoles, managerOrOwner, ownerOnly, AuthRequest } from '../../middleware/auth';
import { createSale, voidSale, getSales } from './service';
import { Sale } from './model';
import { CreateSaleSchema } from '@hs-pharma/shared';
import { AppError } from '../../common/errors';
import { Settings } from '../settings/model';
import { formatMmYy } from '../../common/dates';
import { formatMoney } from '@hs-pharma/shared';
import mongoose from 'mongoose';

const router = Router();
router.use(authenticate);

// POST /api/v1/sales
router.post('/', allRoles, async (req: AuthRequest, res, next) => {
  try {
    const body = CreateSaleSchema.parse(req.body);
    const user = req.user!;
    const sale = await createSale(body, {
      _id: new mongoose.Types.ObjectId(user._id),
      name: user.name,
      role: user.role,
    });
    res.status(201).json({ ok: true, data: sale });
  } catch (err) { next(err); }
});

// GET /api/v1/sales
router.get('/', allRoles, async (req, res, next) => {
  try {
    const result = await getSales({
      page: parseInt(String(req.query.page ?? 1)),
      limit: parseInt(String(req.query.limit ?? 20)),
      customerId: req.query.customerId as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      status: req.query.status as string,
    });

    const user = (req as AuthRequest).user!;
    // Strip cost/profit from non-owners
    const items = result.sales.map(s => {
      const obj = s.toObject();
      if (user.role !== 'owner') {
        obj.items = obj.items.map((i: any) => { delete i.costSnapshot; return i; });
        delete obj.cashPaid; // keep only what cashier needs
      }
      return obj;
    });

    res.json({ ok: true, data: { ...result, sales: items } });
  } catch (err) { next(err); }
});

// GET /api/v1/sales/:id
router.get('/:id', allRoles, async (req: AuthRequest, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) throw new AppError('NOT_FOUND', 404, 'Sale not found');

    const obj = sale.toObject() as any;
    if (req.user!.role !== 'owner') {
      obj.items = obj.items.map((i: any) => { delete i.costSnapshot; return i; });
    }
    res.json({ ok: true, data: obj });
  } catch (err) { next(err); }
});

// GET /api/v1/sales/:id/print  → returns HTML for the thermal receipt
router.get('/:id/print', allRoles, async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) throw new AppError('NOT_FOUND', 404, 'Sale not found');
    const settings = await Settings.findOne() ?? { shopName: 'HS Pharma', address: '', phone: '', billFooter: 'Thank you.' };

    const rows = sale.items.map(i =>
      `<div class="ln"><span>${i.nameSnapshot}<small>${i.batchNoSnapshot} · exp ${formatMmYy(i.expirySnapshot)} · ${i.unitLabel}</small></span><b>${formatMoney(i.lineTotal)}</b></div>`
    ).join('');

    const html = `<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<style>
  @page{size:80mm auto;margin:0}
  body{font:12px/1.4 'Courier New',monospace;color:#000;padding:3mm}
  h2{font-size:14px;text-align:center;margin:0}
  .c{text-align:center}.ln{display:flex;justify-content:space-between;gap:4px}
  .ln b{white-space:nowrap}
  hr{border:0;border-top:1px dashed #000;margin:4px 0}
  small{display:block;font-size:10px;color:#444}
  .big{font-size:15px;font-weight:700}
</style>
</head><body>
<h2>${settings.shopName}</h2>
<p class="c">${settings.address}<br>${settings.phone}</p>
<hr>
<p>${sale.invoiceNo}${sale.status === 'void' ? ' (VOID)' : ''}<br>
${new Date(sale.createdAt).toLocaleString('en-GB')}<br>
Cashier: ${sale.soldByName}<br>
Customer: ${sale.customerNameSnapshot}${sale.prescription ? '<br>Rx: ' + sale.prescription : ''}</p>
<hr>${rows}<hr>
<div class="ln"><span>Subtotal</span><b>${formatMoney(sale.subtotal)}</b></div>
${sale.discount ? `<div class="ln"><span>Discount</span><b>-${formatMoney(sale.discount)}</b></div>` : ''}
${sale.roundOff ? `<div class="ln"><span>Round off</span><b>${sale.roundOff > 0 ? '+' : ''}${formatMoney(Math.abs(sale.roundOff))}</b></div>` : ''}
<div class="ln big"><span>TOTAL</span><b>${formatMoney(sale.total)}</b></div>
${sale.cashPaid ? `<div class="ln"><span>Cash</span><b>${formatMoney(sale.cashPaid)}</b></div>` : ''}
${sale.cardPaid ? `<div class="ln"><span>Card</span><b>${formatMoney(sale.cardPaid)}</b></div>` : ''}
${sale.creditAmount ? `<div class="ln"><span>Udhaar</span><b>${formatMoney(sale.creditAmount)}</b></div>
<div class="ln"><span>Prev balance</span><b>${formatMoney(sale.customerBalanceBefore ?? 0)}</b></div>
<div class="ln"><span>New balance</span><b>${formatMoney(sale.customerBalanceAfter ?? 0)}</b></div>` : ''}
<hr><p class="c">${settings.billFooter}</p>
</body></html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) { next(err); }
});

// POST /api/v1/sales/:id/void  (owner only)
router.post('/:id/void', ownerOnly, async (req: AuthRequest, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) throw new AppError('REASON_REQUIRED', 400, 'Void reason is required');
    const user = req.user!;
    const sale = await voidSale(req.params.id, reason, {
      _id: new mongoose.Types.ObjectId(user._id),
      name: user.name,
      role: user.role,
    });
    res.json({ ok: true, data: sale });
  } catch (err) { next(err); }
});

export default router;
