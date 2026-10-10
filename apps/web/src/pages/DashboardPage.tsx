import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { fmt, fmtDateTime, daysUntil, expiryClass } from '../lib/fmt';
import { fetchRevenueSummary } from '../lib/revenueApi';

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const todayIso = new Date().toISOString().slice(0, 10);

  const { data: todayRev } = useQuery({
    queryKey: ['revenue', 'summary', todayIso, todayIso],
    queryFn: () => fetchRevenueSummary(todayIso, todayIso),
    staleTime: 30000,
  });

  const { data: salesData } = useQuery({
    queryKey: ['sales', 'recent'],
    queryFn: async () => (await api.get('/sales', { params: { limit: 8 } })).data.data,
    staleTime: 30000,
  });

  const { data: lowStock } = useQuery({
    queryKey: ['stock', 'low'],
    queryFn: async () => (await api.get('/stock/low')).data.data,
    staleTime: 60000,
  });

  const { data: nearExpiry } = useQuery({
    queryKey: ['stock', 'near-expiry'],
    queryFn: async () => (await api.get('/stock/near-expiry')).data.data,
    staleTime: 60000,
  });

  const { data: customers } = useQuery({
    queryKey: ['customers', 'outstanding'],
    queryFn: async () => (await api.get('/customers/outstanding')).data.data,
    staleTime: 60000,
  });

  const recentSales = salesData?.sales ?? [];
  const totalUdhaar = (customers ?? []).reduce((a: number, c: any) => a + c.balance, 0);

  const todayTotal = todayRev?.revenue ?? 0;
  const todayBills = todayRev?.billCount ?? 0;
  const todayAvg = todayRev?.avgBillValue ?? 0;
  const todayProfit = todayRev?.grossProfit ?? 0;
  const cashPaid = todayRev?.cashCollected ?? 0;
  const cardPaid = todayRev?.cardCollected ?? 0;
  const udhaarGiven = todayRev?.udhaarGiven ?? 0;
  const payTotal = todayTotal || 1;

  // Triage urgency calculations
  const expiringWithin30Days = (nearExpiry ?? []).filter((b: any) => daysUntil(b.expiryDate) <= 30);
  const lowStockCount = lowStock?.length ?? 0;
  const customerDebtCount = customers?.length ?? 0;
  const totalAlerts = expiringWithin30Days.length + lowStockCount + (user?.role !== 'cashier' ? customerDebtCount : 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>📊 Operations Dashboard</h3>
        <span style={{ fontSize: 12, color: 'var(--mut)' }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>

      {/* ─── 1. Needs Attention Triage Section (Leads Dashboard) ─── */}
      <div className={`triage-card ${totalAlerts === 0 ? 'clear' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>{totalAlerts > 0 ? '⚠️' : '✅'}</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>
              {totalAlerts > 0 ? `Needs Attention (${totalAlerts} items)` : 'All Operational Checks Clear'}
            </span>
          </div>
          {totalAlerts > 0 && (
            <span className="status-chip warn" style={{ fontSize: 10 }}>Action Required</span>
          )}
        </div>

        {totalAlerts === 0 ? (
          <p style={{ margin: 0, color: 'var(--mut)', fontSize: 13 }}>
            Stock inventory levels and expiry thresholds are healthy. No pending operational blocks detected.
          </p>
        ) : (
          <div className="triage-grid">
            {expiringWithin30Days.length > 0 && (
              <div className="triage-item" onClick={() => navigate('/stock')}>
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--accent-orange)' }}>
                    ⏳ {expiringWithin30Days.length} {expiringWithin30Days.length === 1 ? 'batch' : 'batches'}
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--mut)' }}>Expiring within 30 days</div>
                </div>
                <span className="lk" style={{ fontSize: 11 }}>Review Stock ➔</span>
              </div>
            )}

            {lowStockCount > 0 && (
              <div className="triage-item" onClick={() => navigate('/stock')}>
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--status-expired)' }}>
                    📉 {lowStockCount} {lowStockCount === 1 ? 'item' : 'items'}
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--mut)' }}>Below minimum stock level</div>
                </div>
                <span className="lk" style={{ fontSize: 11 }}>View Reorder ➔</span>
              </div>
            )}

            {user?.role !== 'cashier' && customerDebtCount > 0 && (
              <div className="triage-item" onClick={() => navigate('/customers')}>
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--status-warn)' }}>
                    📒 {customerDebtCount} {customerDebtCount === 1 ? 'customer' : 'customers'}
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--mut)' }}>Outstanding udhaar: {fmt(totalUdhaar)}</div>
                </div>
                <span className="lk" style={{ fontSize: 11 }}>View Ledgers ➔</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── 2. Financial Overview Cards ─── */}
      <div className="two">
        <div className="card">
          <small>Today's Sales</small>
          <div className="tot">{fmt(todayTotal)}</div>
          <small>
            {todayBills} bills · average {fmt(todayAvg)}
            {user?.role === 'owner' ? ` · profit ${fmt(todayProfit)}` : ''}
          </small>
          <div className="sb" style={{ margin: '8px 0' }}>
            <i style={{ width: `${(cashPaid / payTotal) * 100}%`, background: 'var(--br)' }} />
            <i style={{ width: `${(cardPaid / payTotal) * 100}%`, background: '#2a7fb8' }} />
            <i style={{ width: `${(udhaarGiven / payTotal) * 100}%`, background: '#e8730c' }} />
          </div>
          <small>Cash {fmt(cashPaid)} · Card {fmt(cardPaid)} · Udhaar {fmt(udhaarGiven)}</small>
        </div>

        <div className="card">
          <small>Udhaar Outstanding</small>
          <div className="tot">{fmt(totalUdhaar)}</div>
          <small>{customers?.length ?? 0} customers currently owe money</small>
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => navigate('/customers')}>
              Open Customer Ledgers ➔
            </button>
          </div>
        </div>
      </div>

      {/* ─── 3. KPI Metrics ─── */}
      <div className="kp">
        <div className={`k s ${lowStock && lowStock.length > 0 ? 'wn' : ''}`} onClick={() => navigate('/stock')}>
          <small>Low Stock</small>
          <b>{lowStock?.length ?? 0}</b>
          <small>medicines to restock</small>
        </div>
        <div className={`k s ${nearExpiry && nearExpiry.length > 0 ? 'wn' : ''}`} onClick={() => navigate('/stock')}>
          <small>Near Expiry</small>
          <b>{nearExpiry?.length ?? 0}</b>
          <small>batches within 90 days</small>
        </div>
        <div className="k s">
          <small>Cash Collected Today</small>
          <b>{fmt(cashPaid)}</b>
          <small>physical cash at till</small>
        </div>
        <div className="k s">
          <small>Bills Generated</small>
          <b>{todayBills}</b>
          <small>customer receipts</small>
        </div>
      </div>

      <div className="two">
        {/* Recent sales */}
        <div className="card">
          <h3>Recent Sales</h3>
          <div className="gw">
            <table className="gt">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th className="r">Total</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--mut)', padding: 20 }}>No sales today</td></tr>
                ) : (
                  recentSales.map((s: any) => (
                    <tr key={s._id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{s.invoiceNo}</td>
                      <td>{s.customerNameSnapshot}</td>
                      <td className="r">{fmt(s.total)}</td>
                      <td style={{ fontSize: 11, color: 'var(--mut)' }}>{fmtDateTime(s.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Low stock */}
          <div className="card">
            <h3>⚠ Low Stock</h3>
            {!lowStock?.length ? (
              <p style={{ color: 'var(--mut)' }}>✅ All medicines adequately stocked</p>
            ) : (
              <div className="gw">
                <table className="gt mini">
                  <thead><tr><th>Medicine</th><th className="r">Stock</th><th className="r">Min</th></tr></thead>
                  <tbody>
                    {lowStock.map((item: any) => (
                      <tr key={item.medicine._id}>
                        <td>{item.medicine.name}</td>
                        <td className="r" style={{ color: 'var(--er)', fontWeight: 700 }}>{item.totalStock}</td>
                        <td className="r">{item.medicine.minStock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Near expiry */}
          <div className="card">
            <h3>📅 Near Expiry</h3>
            {!nearExpiry?.length ? (
              <p style={{ color: 'var(--mut)' }}>✅ No batches expiring soon</p>
            ) : (
              <div className="gw">
                <table className="gt mini">
                  <thead><tr><th>Medicine</th><th>Batch</th><th className="r">Days</th><th className="r">Stock</th></tr></thead>
                  <tbody>
                    {nearExpiry.slice(0, 10).map((b: any) => {
                      const days = daysUntil(b.expiryDate);
                      const cls = expiryClass(days);
                      return (
                        <tr key={b._id} className={cls === 'er' ? 'xp' : ''}>
                          <td>{b.medicineId?.name ?? '–'}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{b.batchNo}</td>
                          <td className="r">
                            <span className={`pill ${cls}`}>{days}d</span>
                          </td>
                          <td className="r">{b.qtyOnHand}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Outstanding Udhaar */}
          {user?.role !== 'cashier' && (
            <div className="card">
              <h3>📒 Outstanding Udhaar</h3>
              {!customers?.length ? (
                <p style={{ color: 'var(--mut)' }}>✅ No outstanding balances</p>
              ) : (
                <div className="gw">
                  <table className="gt mini">
                    <thead><tr><th>Customer</th><th className="r">Balance</th></tr></thead>
                    <tbody>
                      {customers.slice(0, 8).map((c: any) => (
                        <tr key={c._id}>
                          <td>{c.name}</td>
                          <td className="r" style={{ fontWeight: 700, color: 'var(--er)' }}>{fmt(c.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
