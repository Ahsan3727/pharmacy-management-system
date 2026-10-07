import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { fmt, fmtDate, fmtDateTime, daysUntil, expiryClass } from '../lib/fmt';

export function DashboardPage() {
  const [dateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const { user } = useAuthStore();

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
  const todaySales = recentSales.filter((s: any) =>
    new Date(s.createdAt).toDateString() === new Date().toDateString()
  );
  const todayTotal = todaySales.reduce((a: number, s: any) => a + s.total, 0);
  const todayCount = todaySales.length;
  const totalUdhaar = (customers ?? []).reduce((a: number, c: any) => a + c.balance, 0);

  return (
    <div className="main in" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <h3>📊 Dashboard</h3>

      {/* KPI cards */}
      <div className="kp">
        <div className="k s">
          <small>Today's Sales</small>
          <b>{fmt(todayTotal)}</b>
          <small>{todayCount} bills</small>
        </div>
        {user?.role === 'owner' && (
          <div className="k s">
            <small>Total Udhaar</small>
            <b>{fmt(totalUdhaar)}</b>
            <small>{customers?.length ?? 0} customers</small>
          </div>
        )}
        <div className={`k s ${lowStock && lowStock.length > 0 ? 'wn' : ''}`}>
          <small>Low Stock</small>
          <b>{lowStock?.length ?? 0}</b>
          <small>medicines</small>
        </div>
        <div className={`k s ${nearExpiry && nearExpiry.length > 0 ? 'wn' : ''}`}>
          <small>Near Expiry</small>
          <b>{nearExpiry?.length ?? 0}</b>
          <small>batches</small>
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
