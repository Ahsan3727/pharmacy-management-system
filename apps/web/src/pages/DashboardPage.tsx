import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { fmt, fmtDate, fmtDateTime, daysUntil, expiryClass } from '../lib/fmt';
import { fetchRevenueSummary } from '../lib/revenueApi';

export function DashboardPage() {
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

  return (
    <div className="main in" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <h3>📊 Dashboard</h3>

      {/* Top row */}
      <div className="two">
        <div className="card">
          <small>Today's sales</small>
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
          <small>Udhaar outstanding</small>
          <div className="tot">{fmt(totalUdhaar)}</div>
          <small>{customers?.length ?? 0} customers owe money</small>
        </div>
      </div>

      {/* KPI cards */}
      <div className="kp">
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
        <div className="k s">
          <small>Cash Collected Today</small>
          <b>{fmt(cashPaid)}</b>
          <small>at register</small>
        </div>
        <div className="k s">
          <small>Bills Today</small>
          <b>{todayBills}</b>
          <small>invoices</small>
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
