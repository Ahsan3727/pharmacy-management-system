import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { fmt, fmtDate, fmtDateTime } from '../lib/fmt';
import { ReturnModal } from '../components/ReturnModal';
import { Modal, ModalHeader } from '../components/Modal';

export function SalesHistoryPage() {
  const [tab, setTab] = useState<'sales' | 'returns'>('sales');
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('');
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [returnSale, setReturnSale] = useState<any>(null);

  // Sales Query
  const { data: salesData, isLoading: loadingSales } = useQuery({
    queryKey: ['sales', page, dateFrom, dateTo, status],
    queryFn: async () => (await api.get('/sales', { params: { page, limit: 20, dateFrom, dateTo, status } })).data.data,
    enabled: tab === 'sales',
    staleTime: 30000,
  });

  // Returns Query
  const { data: returnsData, isLoading: loadingReturns } = useQuery({
    queryKey: ['returns', 'customer', page],
    queryFn: async () => (await api.get('/returns/customer', { params: { page, limit: 20 } })).data.data,
    enabled: tab === 'returns',
    staleTime: 30000,
  });

  const sales: any[] = salesData?.sales ?? [];
  const totalSalePages = salesData?.pages ?? 1;

  const returns: any[] = returnsData?.items ?? [];
  const totalReturnPages = returnsData?.pages ?? 1;

  const handlePrintSale = (saleId: string) => {
    const w = window.open(`/api/v1/sales/${saleId}/print`, '_blank', 'width=380,height=600');
    w?.addEventListener('load', () => w.print());
  };

  const handlePrintReturn = (returnId: string) => {
    const w = window.open(`/api/v1/returns/customer/${returnId}/print`, '_blank', 'width=380,height=600');
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>🧾 Sales & Customer Returns</h3>
          <small style={{ color: 'var(--mut)' }}>Audit trails, invoice lookup, item returns and refund vouchers</small>
        </div>
      </div>

      {/* Segmented Tab Bar */}
      <div className="seg" style={{ marginBottom: 14, width: 'fit-content' }}>
        <button className={tab === 'sales' ? 'on' : ''} onClick={() => { setTab('sales'); setPage(1); }}>
          🧾 Invoices & Sales
        </button>
        <button className={tab === 'returns' ? 'on' : ''} onClick={() => { setTab('returns'); setPage(1); }}>
          ↩️ Customer Returns {returnsData?.total ? `(${returnsData.total})` : ''}
        </button>
      </div>

      {tab === 'sales' && (
        <>
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
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingSales ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>Loading sales…</td></tr>
                ) : sales.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>No sales found</td></tr>
                ) : (
                  sales.map((s) => (
                    <tr key={s._id} onClick={() => setSelectedSale(s)} style={{ cursor: 'pointer', opacity: s.status === 'void' ? 0.6 : 1 }}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{s.invoiceNo}</td>
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
                          : <span className="pill ok">OK</span>
                        }
                      </td>
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          {s.status === 'ok' && (
                            <button
                              className="btn btn-ghost"
                              style={{ padding: '3px 8px', fontSize: 11 }}
                              title="Process Customer Return"
                              onClick={() => setReturnSale(s)}
                            >
                              ↩️ Return
                            </button>
                          )}
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '3px 8px', fontSize: 11 }}
                            title="Print Thermal Bill"
                            onClick={() => handlePrintSale(s._id)}
                          >
                            🖨️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalSalePages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
              <button className="btn btn-ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
              <span style={{ alignSelf: 'center', color: 'var(--mut)' }}>Page {page} of {totalSalePages}</span>
              <button className="btn btn-ghost" disabled={page === totalSalePages} onClick={() => setPage((p) => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}

      {tab === 'returns' && (
        <>
          <div className="gw">
            <table className="gt">
              <thead>
                <tr>
                  <th>Return #</th>
                  <th>Original Invoice</th>
                  <th>Customer</th>
                  <th>Items Returned</th>
                  <th className="r">Refund Amount</th>
                  <th>Refund Method</th>
                  <th>Date & Handled By</th>
                  <th style={{ textAlign: 'right' }}>Print</th>
                </tr>
              </thead>
              <tbody>
                {loadingReturns ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>Loading customer returns…</td></tr>
                ) : returns.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>No customer returns processed yet.</td></tr>
                ) : (
                  returns.map((r) => (
                    <tr key={r._id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--wn)' }}>{r.returnNo}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.saleInvoiceNo}</td>
                      <td>{r.customerNameSnapshot}</td>
                      <td>
                        <span style={{ fontSize: 12 }}>
                          {r.items?.map((i: any) => `${i.nameSnapshot} (${i.qtyReturned} ${i.restock ? 'restocked' : 'damaged'})`).join(', ')}
                        </span>
                      </td>
                      <td className="r" style={{ fontWeight: 700, color: 'var(--er)' }}>
                        -{fmt(r.totalRefund)}
                      </td>
                      <td>
                        <span className={`pill ${r.refundMethod === 'cash' ? 'ok' : 'wn'}`}>
                          {r.refundMethod === 'cash' ? '💵 Cash' : '📒 Udhaar Reduction'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: 11 }}>{fmtDateTime(r.createdAt)}</div>
                        <small style={{ color: 'var(--mut)' }}>By {r.processedByName}</small>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '3px 8px', fontSize: 11 }}
                          onClick={() => handlePrintReturn(r._id)}
                        >
                          🖨️ Slip
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalReturnPages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
              <button className="btn btn-ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
              <span style={{ alignSelf: 'center', color: 'var(--mut)' }}>Page {page} of {totalReturnPages}</span>
              <button className="btn btn-ghost" disabled={page === totalReturnPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}

      {/* Sale Detail Modal */}
      {selectedSale && (
        <Modal open={!!selectedSale} onClose={() => setSelectedSale(null)} maxWidth={600}>
          <ModalHeader title={`Invoice Details: ${selectedSale.invoiceNo}`} onClose={() => setSelectedSale(null)} />
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, background: 'var(--gh)', padding: 10, borderRadius: 8 }}>
              <div>
                <div>Customer: <b>{selectedSale.customerNameSnapshot}</b></div>
                <small style={{ color: 'var(--mut)' }}>Sold by: {selectedSale.soldByName} on {fmtDateTime(selectedSale.createdAt)}</small>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{fmt(selectedSale.total)}</div>
                <span className={`pill ${selectedSale.status === 'ok' ? 'ok' : 'er'}`}>{selectedSale.status.toUpperCase()}</span>
              </div>
            </div>

            <div style={{ border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden' }}>
              <table className="gt" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Batch</th>
                    <th className="r">Qty</th>
                    <th className="r">Returned</th>
                    <th className="r">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSale.items?.map((item: any, i: number) => (
                    <tr key={i}>
                      <td><b>{item.nameSnapshot}</b></td>
                      <td style={{ fontFamily: 'monospace' }}>{item.batchNoSnapshot}</td>
                      <td className="r">{item.qty}</td>
                      <td className="r" style={{ color: (item.returnedQty ?? 0) > 0 ? 'var(--er)' : 'var(--mut)' }}>
                        {item.returnedQty ?? 0}
                      </td>
                      <td className="r">{fmt(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              {selectedSale.status === 'ok' && (
                <>
                  <button
                    className="btn"
                    onClick={() => {
                      const s = selectedSale;
                      setSelectedSale(null);
                      setReturnSale(s);
                    }}
                  >
                    ↩️ Process Return
                  </button>
                  <button className="btn btn-ghost" onClick={() => handleVoid(selectedSale)}>
                    Void Sale
                  </button>
                </>
              )}
              <button className="btn btn-ghost" onClick={() => handlePrintSale(selectedSale._id)}>
                🖨️ Print Bill
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Customer Return Modal */}
      {returnSale && (
        <ReturnModal
          sale={returnSale}
          open={!!returnSale}
          onClose={() => setReturnSale(null)}
          onSuccess={() => setReturnSale(null)}
        />
      )}
    </div>
  );
}
