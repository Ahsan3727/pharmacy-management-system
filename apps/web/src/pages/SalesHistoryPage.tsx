import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { fmt, fmtDate, fmtDateTime } from '../lib/fmt';

export function SalesHistoryPage() {
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sales', page, dateFrom, dateTo, status],
    queryFn: async () => (await api.get('/sales', { params: { page, limit: 20, dateFrom, dateTo, status } })).data.data,
    staleTime: 30000,
  });

  const sales: any[] = data?.sales ?? [];
  const totalPages = data?.pages ?? 1;

  const handlePrint = (saleId: string) => {
    const w = window.open(`/api/v1/sales/${saleId}/print`, '_blank', 'width=380,height=600');
    w?.addEventListener('load', () => w.print());
  };

  const handleVoid = async (sale: any) => {
    const reason = prompt(`Void reason for ${sale.invoiceNo}?`);
    if (!reason) return;
    try {
      await api.post(`/sales/${sale._id}/void`, { reason });
      alert('Sale voided');
    } catch (err: any) {
      alert(err.response?.data?.error?.message ?? 'Failed');
    }
  };

  return (
    <div>
      <h3 style={{ marginBottom: 12 }}>🧾 Sales History</h3>

      {/* Filters */}
      <div className="f3" style={{ marginBottom: 12 }}>
        <label>FROM<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
        <label>TO<input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
        <label>STATUS
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="ok">Valid</option>
            <option value="void">Void</option>
          </select>
        </label>
      </div>

      <div className="gw">
        <table className="gt">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Customer</th>
              <th>Cashier</th>
              <th>Payment</th>
              <th className="r">Total</th>
              <th>Date</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>Loading…</td></tr>
            ) : sales.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>No sales found</td></tr>
            ) : (
              sales.map((s) => (
                <tr key={s._id} onClick={() => setSelected(s)} style={{ cursor: 'pointer', opacity: s.status === 'void' ? 0.6 : 1 }}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{s.invoiceNo}</td>
                  <td>{s.customerNameSnapshot}</td>
                  <td style={{ color: 'var(--mut)', fontSize: 12 }}>{s.soldByName}</td>
                  <td>
                    {s.cashPaid > 0 && <span className="pill" style={{ marginRight: 3 }}>Cash</span>}
                    {s.cardPaid > 0 && <span className="pill" style={{ marginRight: 3 }}>Card</span>}
                    {s.creditAmount > 0 && <span className="pill wn">Udhaar</span>}
                  </td>
                  <td className="r" style={{ fontWeight: 600 }}>{fmt(s.total)}</td>
                  <td style={{ fontSize: 11, color: 'var(--mut)' }}>{fmtDateTime(s.createdAt)}</td>
                  <td>
                    {s.status === 'void'
                      ? <span className="pill er">VOID</span>
                      : <span className="pill">OK</span>
                    }
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      style={{ fontSize: 11, background: 'none', border: 0, color: 'var(--br)', cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => handlePrint(s._id)}>
                      🖨
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
          <button className="btn btn-ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ alignSelf: 'center', color: 'var(--mut)' }}>Page {page} of {totalPages}</span>
          <button className="btn btn-ghost" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
