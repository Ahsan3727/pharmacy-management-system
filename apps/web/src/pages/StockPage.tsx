import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { fmt, fmtMmYy, daysUntil, expiryClass } from '../lib/fmt';

export function StockPage() {
  const [tab, setTab] = useState<'low' | 'expiry' | 'expired'>('expiry');

  const { data: lowStock, isLoading: loadingLow } = useQuery({
    queryKey: ['stock', 'low'],
    queryFn: async () => (await api.get('/stock/low')).data.data,
    staleTime: 60000,
  });

  const { data: nearExpiry, isLoading: loadingNear } = useQuery({
    queryKey: ['stock', 'near-expiry'],
    queryFn: async () => (await api.get('/stock/near-expiry')).data.data,
    staleTime: 60000,
  });

  const { data: expired, isLoading: loadingExpired } = useQuery({
    queryKey: ['stock', 'expired'],
    queryFn: async () => (await api.get('/stock/expired')).data.data,
    staleTime: 60000,
  });

  const handleWriteOff = async (batchId: string, name: string) => {
    if (!confirm(`Write off expired stock for ${name}? This cannot be undone.`)) return;
    try {
      await api.post('/stock/writeoff', { batchId, reason: 'Expiry write-off' });
      alert('Written off successfully');
    } catch (err: any) {
      alert(err.response?.data?.error?.message ?? 'Failed');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3>📦 Stock Management</h3>
      </div>

      <div className="seg" style={{ marginBottom: 14, width: 'fit-content' }}>
        <button className={tab === 'expiry' ? 'on' : ''} onClick={() => setTab('expiry')}>
          Near Expiry {nearExpiry?.length > 0 && `(${nearExpiry.length})`}
        </button>
        <button className={tab === 'low' ? 'on' : ''} onClick={() => setTab('low')}>
          Low Stock {lowStock?.length > 0 && `(${lowStock.length})`}
        </button>
        <button className={tab === 'expired' ? 'on' : ''} onClick={() => setTab('expired')}>
          Expired {expired?.length > 0 && `(${expired.length})`}
        </button>
      </div>

      {tab === 'expiry' && (
        <div className="gw">
          <table className="gt">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Batch</th>
                <th>Expiry</th>
                <th className="r">Days Left</th>
                <th className="r">Stock (units)</th>
              </tr>
            </thead>
            <tbody>
              {loadingNear ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>Loading…</td></tr>
              ) : (nearExpiry ?? []).length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>✅ No batches expiring soon</td></tr>
              ) : (
                (nearExpiry ?? []).map((b: any) => {
                  const days = daysUntil(b.expiryDate);
                  const cls = expiryClass(days);
                  return (
                    <tr key={b._id}>
                      <td><b>{b.medicineId?.name ?? '–'}</b><small>{b.medicineId?.genericName}</small></td>
                      <td style={{ fontFamily: 'monospace' }}>{b.batchNo}</td>
                      <td>{fmtMmYy(b.expiryDate)}</td>
                      <td className="r"><span className={`pill ${cls}`}>{days}d</span></td>
                      <td className="r">{b.qtyOnHand}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'low' && (
        <div className="gw">
          <table className="gt">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Generic</th>
                <th className="r">Current Stock</th>
                <th className="r">Min Stock</th>
                <th>Rack</th>
              </tr>
            </thead>
            <tbody>
              {loadingLow ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>Loading…</td></tr>
              ) : (lowStock ?? []).length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>✅ All medicines adequately stocked</td></tr>
              ) : (
                (lowStock ?? []).map((item: any) => (
                  <tr key={item.medicine._id}>
                    <td><b>{item.medicine.name}</b><small>{item.medicine.strength}</small></td>
                    <td style={{ color: 'var(--mut)' }}>{item.medicine.genericName}</td>
                    <td className="r" style={{ fontWeight: 700, color: item.totalStock === 0 ? 'var(--er)' : 'var(--wn)' }}>
                      {item.totalStock}
                    </td>
                    <td className="r">{item.medicine.minStock}</td>
                    <td>{item.medicine.rack ?? '–'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'expired' && (
        <div className="gw">
          <table className="gt">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Batch</th>
                <th>Expired</th>
                <th className="r">Stock</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loadingExpired ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>Loading…</td></tr>
              ) : (expired ?? []).length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>✅ No expired batches with stock</td></tr>
              ) : (
                (expired ?? []).map((b: any) => (
                  <tr key={b._id}>
                    <td><b>{b.medicineId?.name ?? '–'}</b></td>
                    <td style={{ fontFamily: 'monospace' }}>{b.batchNo}</td>
                    <td><span className="pill er">{fmtMmYy(b.expiryDate)}</span></td>
                    <td className="r">{b.qtyOnHand}</td>
                    <td>
                      <button className="btn" style={{ fontSize: 11, padding: '4px 10px', background: 'var(--er)' }}
                        onClick={() => handleWriteOff(b._id, b.medicineId?.name ?? b.batchNo)}>
                        Write Off
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
