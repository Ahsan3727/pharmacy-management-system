import { Router } from 'express';
import { Sale } from '../sales/model';
import { Expense } from '../expenses/model';
import { CustomerLedger } from '../customers/ledgerModel';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { todayUtc } from '../../common/dates';

const router = Router();
router.use(authenticate);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDateRange(query: any): { from: string; to: string } {
  const today = todayUtc();
  const from = String(query.from ?? today);
  const to   = String(query.to   ?? today);
  return { from: from < to ? from : to, to: from < to ? to : from };
}

/** Shift a YYYY-MM-DD date by N days */
function shiftDate(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayCount(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
}

// ─── Summary ──────────────────────────────────────────────────────────────────
// GET /api/v1/revenue/summary?from=YYYY-MM-DD&to=YYYY-MM-DD

router.get('/summary', async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = parseDateRange(req.query);
    const isOwner = req.user!.role === 'owner';
    const n = dayCount(from, to);

    // Current period aggregation
    const [agg] = await Sale.aggregate([
      { $match: { createdAt: { $gte: new Date(from), $lt: new Date(shiftDate(to, 1)) } } },
      {
        $facet: {
          ok: [
            { $match: { status: 'ok' } },
            {
              $group: {
                _id: null,
                revenue:   { $sum: '$total' },
                subtotal:  { $sum: '$subtotal' },
                cashPaid:  { $sum: '$cashPaid' },
                cardPaid:  { $sum: '$cardPaid' },
                credit:    { $sum: '$creditAmount' },
                discounts: { $sum: '$discount' },
                cost: {
                  $sum: {
                    $reduce: {
                      input: '$items',
                      initialValue: 0,
                      in: {
                        $add: [
                          '$$value',
                          { $multiply: ['$$this.costSnapshot', { $divide: ['$$this.qty', { $ifNull: ['$$this.packSize', 1] }] }] },
                        ],
                      },
                    },
                  },
                },
                bills: { $sum: 1 },
              },
            },
          ],
          voided: [
            { $match: { status: 'void' } },
            { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$total' } } },
          ],
        },
      },
    ]);

    const ok      = agg?.ok?.[0]      ?? { revenue: 0, subtotal: 0, cashPaid: 0, cardPaid: 0, credit: 0, discounts: 0, cost: 0, bills: 0 };
    const voided  = agg?.voided?.[0]  ?? { count: 0, amount: 0 };

    // Use lineTotal sum for cost (more accurate)
    const costAgg = await Sale.aggregate([
      { $match: { status: 'ok', createdAt: { $gte: new Date(from), $lt: new Date(shiftDate(to, 1)) } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: null,
          cost: {
            $sum: {
              $multiply: [
                '$items.costSnapshot',
                { $divide: ['$items.qty', { $ifNull: ['$items.packSize', 1] }] },
              ],
            },
          },
          revenue: { $sum: '$items.lineTotal' },
        },
      },
    ]);

    const itemCost = costAgg?.[0]?.cost ?? 0;

    // Previous period
    const prevFrom = shiftDate(from, -n);
    const prevTo   = shiftDate(from, -1);
    const [prevAgg] = await Sale.aggregate([
      { $match: { status: 'ok', createdAt: { $gte: new Date(prevFrom), $lt: new Date(shiftDate(prevTo, 1)) } } },
      { $group: { _id: null, revenue: { $sum: '$total' } } },
    ]);
    const prevRevenue = prevAgg?.revenue ?? 0;
    const changePct = prevRevenue > 0 ? Math.round(((ok.revenue - prevRevenue) / prevRevenue) * 1000) / 10 : null;

    // Expenses in period
    const expenses = await Expense.find({ date: { $gte: from, $lte: to } });
    const totalExpenses = expenses.reduce((s, e) => s + e.amountPaisa, 0);

    // Udhaar recovered
    const ledgerAgg = await CustomerLedger.aggregate([
      { $match: { type: 'PAYMENT', date: { $gte: from, $lte: to } } },
      { $group: { _id: null, recovered: { $sum: { $abs: '$amount' } } } },
    ]);
    const udhaarRecovered = ledgerAgg?.[0]?.recovered ?? 0;

    const grossProfit   = ok.revenue - Math.round(itemCost);
    const grossMarginPct = ok.revenue > 0 ? Math.round((grossProfit / ok.revenue) * 1000) / 10 : 0;
    const netProfit     = grossProfit - totalExpenses;
    const netMarginPct  = ok.revenue > 0 ? Math.round((netProfit / ok.revenue) * 1000) / 10 : 0;

    const payload: Record<string, any> = {
      period:        { from, to, days: n },
      revenue:       ok.revenue,
      billCount:     ok.bills,
      avgBillValue:  ok.bills > 0 ? Math.round(ok.revenue / ok.bills) : 0,
      cashCollected: ok.cashPaid,
      cardCollected: ok.cardPaid,
      udhaarGiven:   ok.credit,
      udhaarRecovered,
      discountsGiven:ok.discounts,
      voidedCount:   voided.count,
      voidedAmount:  voided.amount,
      prevRevenue,
      changePct,
      totalExpenses,
    };

    // Owner-only fields
    if (isOwner) {
      payload.cost          = Math.round(itemCost);
      payload.grossProfit   = grossProfit;
      payload.grossMarginPct = grossMarginPct;
      payload.netProfit     = netProfit;
      payload.netMarginPct  = netMarginPct;
    }

    res.json({ ok: true, data: payload });
  } catch (err) { next(err); }
});

// ─── Daily Breakdown ──────────────────────────────────────────────────────────
// GET /api/v1/revenue/daily?from=YYYY-MM-DD&to=YYYY-MM-DD

router.get('/daily', async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = parseDateRange(req.query);
    const isOwner = req.user!.role === 'owner';
    const n = dayCount(from, to);

    const rows = await Sale.aggregate([
      { $match: { status: 'ok', createdAt: { $gte: new Date(from), $lt: new Date(shiftDate(to, 1)) } } },
      {
        $group: {
          _id:       { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue:   { $sum: '$total' },
          cashPaid:  { $sum: '$cashPaid' },
          cardPaid:  { $sum: '$cardPaid' },
          credit:    { $sum: '$creditAmount' },
          discounts: { $sum: '$discount' },
          bills:     { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Per-day cost (owner only)
    let costByDay: Record<string, number> = {};
    if (isOwner) {
      const costRows = await Sale.aggregate([
        { $match: { status: 'ok', createdAt: { $gte: new Date(from), $lt: new Date(shiftDate(to, 1)) } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            cost: { $sum: { $multiply: ['$items.costSnapshot', { $divide: ['$items.qty', 1] }] } },
          },
        },
      ]);
      costByDay = Object.fromEntries(costRows.map(r => [r._id, Math.round(r.cost)]));
    }

    // Build full date range (fill zeros for missing days)
    const byDate: Record<string, any> = Object.fromEntries(rows.map(r => [r._id, r]));
    const days = [];
    for (let i = 0; i < n; i++) {
      const d = shiftDate(from, i);
      const r = byDate[d];
      const entry: Record<string, any> = {
        date:      d,
        billCount: r?.bills     ?? 0,
        revenue:   r?.revenue   ?? 0,
        cash:      r?.cashPaid  ?? 0,
        card:      r?.cardPaid  ?? 0,
        udhaar:    r?.credit    ?? 0,
        discounts: r?.discounts ?? 0,
      };
      if (isOwner) {
        const cost = costByDay[d] ?? 0;
        entry.cost        = cost;
        entry.grossProfit = (r?.revenue ?? 0) - cost;
      }
      days.push(entry);
    }

    res.json({ ok: true, data: days });
  } catch (err) { next(err); }
});

// ─── Hourly Breakdown ─────────────────────────────────────────────────────────
// GET /api/v1/revenue/hours?from=YYYY-MM-DD&to=YYYY-MM-DD

router.get('/hours', async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = parseDateRange(req.query);

    const rows = await Sale.aggregate([
      { $match: { status: 'ok', createdAt: { $gte: new Date(from), $lt: new Date(shiftDate(to, 1)) } } },
      {
        $group: {
          _id:     { $hour: '$createdAt' },
          revenue: { $sum: '$total' },
          bills:   { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Build full 24-hour array
    const byHour: Record<number, any> = Object.fromEntries(rows.map(r => [r._id, r]));
    const hours = Array.from({ length: 24 }, (_, h) => ({
      hour:    h,
      revenue: byHour[h]?.revenue ?? 0,
      bills:   byHour[h]?.bills   ?? 0,
    }));

    res.json({ ok: true, data: hours });
  } catch (err) { next(err); }
});

// ─── Top Medicines ────────────────────────────────────────────────────────────
// GET /api/v1/revenue/medicines?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=8

router.get('/medicines', async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = parseDateRange(req.query);
    const limit = Math.min(Number(req.query.limit ?? 8), 20);
    const isOwner = req.user!.role === 'owner';

    const rows = await Sale.aggregate([
      { $match: { status: 'ok', createdAt: { $gte: new Date(from), $lt: new Date(shiftDate(to, 1)) } } },
      { $unwind: '$items' },
      {
        $group: {
          _id:     '$items.medicineId',
          name:    { $first: '$items.nameSnapshot' },
          revenue: { $sum: '$items.lineTotal' },
          cost:    { $sum: { $multiply: ['$items.costSnapshot', { $divide: ['$items.qty', 1] }] } },
          qty:     { $sum: '$items.qty' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
    ]);

    const data = rows.map(r => {
      const entry: Record<string, any> = {
        medicineId: r._id,
        name:       r.name,
        revenue:    r.revenue,
        qty:        r.qty,
      };
      if (isOwner) {
        const cost = Math.round(r.cost);
        entry.cost      = cost;
        entry.profit    = r.revenue - cost;
        entry.marginPct = r.revenue > 0 ? Math.round(((r.revenue - cost) / r.revenue) * 1000) / 10 : 0;
      }
      return entry;
    });

    res.json({ ok: true, data });
  } catch (err) { next(err); }
});

// ─── Top Customers ────────────────────────────────────────────────────────────
// GET /api/v1/revenue/customers?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=6

router.get('/customers', async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = parseDateRange(req.query);
    const limit = Math.min(Number(req.query.limit ?? 6), 20);

    const rows = await Sale.aggregate([
      { $match: { status: 'ok', createdAt: { $gte: new Date(from), $lt: new Date(shiftDate(to, 1)) } } },
      {
        $group: {
          _id:          '$customerNameSnapshot',
          revenue:      { $sum: '$total' },
          billCount:    { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
    ]);

    const data = rows.map(r => ({
      customerName: r._id,
      revenue:      r.revenue,
      billCount:    r.billCount,
    }));

    res.json({ ok: true, data });
  } catch (err) { next(err); }
});

// ─── CSV Export ───────────────────────────────────────────────────────────────
// GET /api/v1/revenue/export.csv?from=YYYY-MM-DD&to=YYYY-MM-DD

router.get('/export.csv', async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = parseDateRange(req.query);
    const isOwner = req.user!.role === 'owner';

    const sales = await Sale.find({
      createdAt: { $gte: new Date(from), $lt: new Date(shiftDate(to, 1)) },
    }).sort({ createdAt: 1 });

    const q = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rs = (p: number) => (p / 100).toFixed(2);

    const headers = ['Date', 'Invoice', 'Time', 'Customer', 'Staff', 'Gross', 'Discount', 'Net', 'Cash', 'Card', 'Udhaar', 'Status'];
    if (isOwner) headers.push('Cost', 'Gross Profit');

    const rows = sales.map(s => {
      const dt = new Date(s.createdAt);
      const row = [
        s.createdAt.toISOString().slice(0, 10),
        s.invoiceNo,
        dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        s.customerNameSnapshot,
        s.soldByName,
        rs(s.subtotal),
        rs(s.discount),
        rs(s.total),
        rs(s.cashPaid),
        rs(s.cardPaid),
        rs(s.creditAmount),
        s.status.toUpperCase(),
      ];
      if (isOwner) {
        const cost = s.items.reduce((acc, i) => acc + i.costSnapshot * i.qty, 0);
        row.push(rs(Math.round(cost)), rs(s.total - Math.round(cost)));
      }
      return row.map(q).join(',');
    });

    const csv = '\uFEFF' + [headers.map(q).join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="revenue-${from}_${to}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

export default router;
