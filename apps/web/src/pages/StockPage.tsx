import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, openAuthedHtml } from '../lib/api';
import { fmt, fmtMmYy, fmtDate, fmtDateTime, daysUntil, expiryClass } from '../lib/fmt';
import { SupplierReturnModal } from '../components/SupplierReturnModal';
import { BarcodeLabelModal, BarcodeLabelData } from '../components/BarcodeLabelModal';
import { CycleCountModal } from '../components/CycleCountModal';
import { ConfirmModal } from '../components/Modal';
import { Toast, useToast } from '../components/Toast';

export function StockPage() {
  const [tab, setTab] = useState<'expiry' | 'low' | 'expired' | 'audits'>('expiry');
  const [returnTarget, setReturnTarget] = useState<{ batch: any; medicine: any } | null>(null);
  const [labelTarget, setLabelTarget] = useState<BarcodeLabelData | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [writeOffTarget, setWriteOffTarget] = useState<{ batchId: string; name: string } | null>(null);
  const { toast, show: showToast } = useToast();

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

  const { data: audits = [], isLoading: loadingAudits, refetch: refetchAudits } = useQuery({
    queryKey: ['stock-audits'],
    queryFn: async () => (await api.get('/stock/audits')).data.data,
    staleTime: 60000,
    enabled: tab === 'audits',
  });

  const handleWriteOff = (batchId: string, name: string) => {
    setWriteOffTarget({ batchId, name });
  };

  const confirmWriteOff = async () => {
    if (!writeOffTarget) return;
    try {
      await api.post('/stock/writeoff', { batchId: writeOffTarget.batchId, reason: 'Expiry write-off' });
      showToast(`✅ Expired stock written off for ${writeOffTarget.name}`);
      setWriteOffTarget(null);
    } catch (err: any) {
      showToast(`❌ ${err.response?.data?.error?.message ?? 'Write-off failed'}`);
    }
  };

  const handlePrintAudit = async (auditId: string) => {
    try {
      await openAuthedHtml(`/api/v1/stock/audits/${auditId}/print`, { autoPrint: true });
    } catch {
      showToast('❌ Failed to open audit print sheet');
    }
  };

  return (
    <div className="page-wrap" style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Top Header with Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📦</span> Stock & Inventory Management
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--mut)', fontSize: 13 }}>
            Monitor FEFO expiries, low stock levels, physical cycle counts, and shelf barcode labels.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn"
            onClick={() => setAuditOpen(true)}
            style={{
              background: '#0284c7',
              borderColor: '#0284c7',
              color: '#fff',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>📋</span> New Cycle Count Audit
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="seg" style={{ marginBottom: 16, width: 'fit-content' }}>
        <button className={tab === 'expiry' ? 'on' : ''} onClick={() => setTab('expiry')}>
          Near Expiry {nearExpiry?.length > 0 && `(${nearExpiry.length})`}
        </button>
        <button className={tab === 'low' ? 'on' : ''} onClick={() => setTab('low')}>
          Low Stock {lowStock?.length > 0 && `(${lowStock.length})`}
        </button>
        <button className={tab === 'expired' ? 'on' : ''} onClick={() => setTab('expired')}>
          Expired {expired?.length > 0 && `(${expired.length})`}
        </button>
        <button className={tab === 'audits' ? 'on' : ''} onClick={() => setTab('audits')}>
          Cycle Count Audits {audits?.length > 0 && `(${audits.length})`}
        </button>
      </div>

      {/* Tab 1: Near Expiry */}
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
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingNear ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>Loading…</td></tr>
              ) : (nearExpiry ?? []).length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>✅ No batches expiring soon</td></tr>
              ) : (
                (nearExpiry ?? []).map((b: any) => {
                  const days = daysUntil(b.expiryDate);
                  const cls = expiryClass(days);
                  return (
                    <tr key={b._id}>
                      <td>
                        <b>{b.medicineId?.name ?? '–'}</b>
                        <small>{b.medicineId?.genericName}</small>
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>{b.batchNo}</td>
                      <td>{fmtMmYy(b.expiryDate)}</td>
                      <td className="r"><span className={`pill ${cls}`}>{days}d</span></td>
                      <td className="r" style={{ fontWeight: 600 }}>{b.qtyOnHand}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-ghost"
                            style={{ fontSize: 11, padding: '3px 8px' }}
                            title="Generate thermal barcode label"
                            onClick={() =>
                              setLabelTarget({
                                medicineName: b.medicineId?.name,
                                strength: b.medicineId?.strength,
                                genericName: b.medicineId?.genericName,
                                batchNo: b.batchNo,
                                expiryDate: b.expiryDate,
                                pricePerPack: b.salePricePerPack,
                                rack: b.medicineId?.rack,
                                barcode: b.medicineId?.barcode || b.batchNo,
                              })
                            }
                          >
                            🏷️ Label
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ fontSize: 11, padding: '3px 8px' }}
                            title="Return stock to distributor"
                            onClick={() => setReturnTarget({ batch: b, medicine: b.medicineId })}
                          >
                            ↩️ Return
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Low Stock */}
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
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingLow ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>Loading…</td></tr>
              ) : (lowStock ?? []).length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>✅ All medicines adequately stocked</td></tr>
              ) : (
                (lowStock ?? []).map((item: any) => (
                  <tr key={item.medicine._id}>
                    <td><b>{item.medicine.name}</b><small>{item.medicine.strength}</small></td>
                    <td style={{ color: 'var(--mut)' }}>{item.medicine.genericName}</td>
                    <td className="r" style={{ fontWeight: 700, color: item.totalStock === 0 ? 'var(--er)' : 'var(--wn)' }}>
                      {item.totalStock}
                    </td>
                    <td className="r">{item.medicine.minStock}</td>
                    <td><span className="pill">{item.medicine.rack ?? '–'}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 11, padding: '3px 8px' }}
                        onClick={() =>
                          setLabelTarget({
                            medicineName: item.medicine.name,
                            strength: item.medicine.strength,
                            genericName: item.medicine.genericName,
                            rack: item.medicine.rack,
                            barcode: item.medicine.barcode,
                          })
                        }
                      >
                        🏷️ Label
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Expired */}
      {tab === 'expired' && (
        <div className="gw">
          <table className="gt">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Batch</th>
                <th>Expired</th>
                <th className="r">Stock</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
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
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 11, padding: '4px 8px' }}
                          title="Return to distributor for credit"
                          onClick={() => setReturnTarget({ batch: b, medicine: b.medicineId })}
                        >
                          ↩️ Return
                        </button>
                        <button
                          className="btn"
                          style={{ fontSize: 11, padding: '4px 8px', background: 'var(--er)' }}
                          onClick={() => handleWriteOff(b._id, b.medicineId?.name ?? b.batchNo)}
                        >
                          Write Off
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Cycle Count Audits History */}
      {tab === 'audits' && (
        <div className="gw">
          <table className="gt">
            <thead>
              <tr>
                <th>Audit # & Date</th>
                <th>Scope</th>
                <th>Audited By</th>
                <th className="r">Batches Audited</th>
                <th className="r">Net Variance Qty</th>
                <th className="r">Financial Variance</th>
                <th style={{ textAlign: 'right' }}>Voucher</th>
              </tr>
            </thead>
            <tbody>
              {loadingAudits ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>Loading audits…</td></tr>
              ) : (audits ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--mut)' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                    <b>No Cycle Count Audits recorded yet</b>
                    <p style={{ margin: '4px 0 0', fontSize: 12 }}>Click "New Cycle Count Audit" above to perform a physical inventory reconciliation.</p>
                  </td>
                </tr>
              ) : (
                (audits ?? []).map((a: any) => {
                  const varVal = a.totalVarianceValue ?? 0;
                  const varQty = a.totalVarianceQty ?? 0;
                  return (
                    <tr key={a._id}>
                      <td>
                        <b style={{ color: '#0284c7' }}>{a.auditNo}</b>
                        <small style={{ display: 'block', color: 'var(--mut)' }}>{fmtDateTime(a.createdAt)}</small>
                      </td>
                      <td>
                        <span className="pill">
                          {a.rack ? `Rack ${a.rack}` : a.category ? a.category : 'Full Pharmacy'}
                        </span>
                      </td>
                      <td>
                        👤 {a.conductedByName}
                      </td>
                      <td className="r">
                        <b>{a.items?.length ?? 0}</b> batches
                      </td>
                      <td className="r">
                        <span style={{ fontWeight: 700, color: varQty === 0 ? '#16a34a' : varQty < 0 ? '#dc2626' : '#0284c7' }}>
                          {varQty > 0 ? `+${varQty}` : varQty}
                        </span>
                      </td>
                      <td className="r">
                        <span style={{ fontWeight: 700, color: varVal === 0 ? '#16a34a' : varVal < 0 ? '#dc2626' : '#16a34a' }}>
                          {varVal < 0 ? '-' : '+'}{fmt(Math.abs(varVal))}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={() => handlePrintAudit(a._id)}
                        >
                          🖨️ Print
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Supplier Return Modal */}
      {returnTarget && (
        <SupplierReturnModal
          batch={returnTarget.batch}
          medicine={returnTarget.medicine}
          open={!!returnTarget}
          onClose={() => setReturnTarget(null)}
          onSuccess={() => {
            setReturnTarget(null);
            showToast('✅ Supplier return processed');
          }}
        />
      )}

      {/* Barcode Thermal Label Modal */}
      {labelTarget && (
        <BarcodeLabelModal
          open={!!labelTarget}
          item={labelTarget}
          onClose={() => setLabelTarget(null)}
        />
      )}

      {/* Cycle Count Modal */}
      <CycleCountModal
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        onSuccess={(newAudit) => {
          showToast(`✅ Cycle count ${newAudit.auditNo} reconciled`);
          refetchAudits();
        }}
      />

      {/* Stock Write-off Confirmation Modal */}
      <ConfirmModal
        open={!!writeOffTarget}
        title="Confirm Stock Write-Off"
        message={`Write off expired stock for "${writeOffTarget?.name}"? This action cannot be undone.`}
        confirmText="Write Off Stock"
        danger
        onConfirm={confirmWriteOff}
        onClose={() => setWriteOffTarget(null)}
      />

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}
