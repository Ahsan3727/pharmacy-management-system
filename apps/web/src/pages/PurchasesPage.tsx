import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Modal, ModalHeader } from '../components/Modal';
import { Toast, useToast } from '../components/Toast';
import { fmt, fmtDate } from '../lib/fmt';

function AddPurchaseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { show } = useToast();
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [lines, setLines] = useState([
    { medicineId: '', medName: '', batchNo: '', expiry: '', packs: 1, bonusPacks: 0, purchasePrice: '', salePrice: '' }
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => (await api.get('/suppliers')).data.data,
    staleTime: 60000,
  });

  const [medSearch, setMedSearch] = useState<Record<number, string>>({});
  const [medResults, setMedResults] = useState<Record<number, any[]>>({});

  const searchMed = async (i: number, q: string) => {
    setMedSearch((s) => ({ ...s, [i]: q }));
    if (!q.trim()) return;
    try {
      const res = await api.get('/medicines/search', { params: { q } });
      setMedResults((r) => ({ ...r, [i]: res.data.data }));
    } catch { /* ignore */ }
  };

  const selectMed = (i: number, med: any) => {
    const updated = [...lines];
    updated[i] = { ...updated[i], medicineId: med._id, medName: med.name };
    setLines(updated);
    setMedSearch((s) => ({ ...s, [i]: '' }));
    setMedResults((r) => ({ ...r, [i]: [] }));
  };

  const setLine = (i: number, k: string, v: any) => {
    const updated = [...lines];
    updated[i] = { ...updated[i], [k]: v };
    setLines(updated);
  };

  const addLine = () => setLines([...lines, { medicineId: '', medName: '', batchNo: '', expiry: '', packs: 1, bonusPacks: 0, purchasePrice: '', salePrice: '' }]);
  const removeLine = (i: number) => setLines(lines.filter((_, j) => j !== i));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/purchases', {
        supplierId,
        supplierInvoiceNo: invoiceNo,
        lines: lines.map((l) => ({
          medicineId: l.medicineId,
          batchNo: l.batchNo,
          expiry: l.expiry,
          packs: l.packs,
          bonusPacks: l.bonusPacks,
          purchasePricePerPack: Math.round(parseFloat(l.purchasePrice) * 100),
          salePricePerPack: Math.round(parseFloat(l.salePrice) * 100),
        })),
      });
      qc.invalidateQueries({ queryKey: ['purchases'] });
      show('✅ Purchase added — stock updated');
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth={720}>
      <ModalHeader title="New Purchase Entry" onClose={onClose} />
      <form onSubmit={handleSave} style={{ display: 'grid', gap: 12 }}>
        <div className="f3">
          <label>SUPPLIER *
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
              <option value="">Choose supplier…</option>
              {(suppliers ?? []).map((s: any) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </label>
          <label>INVOICE NO *<input required value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="INV-2024-001" /></label>
        </div>

        <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 12 }}>
          <h4 style={{ marginBottom: 8 }}>Purchase Lines</h4>
          {lines.map((line, i) => (
            <div key={i} style={{ background: 'var(--gh)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
              <div className="f3">
                {/* Medicine picker */}
                <div style={{ position: 'relative', gridColumn: '1 / 3' }}>
                  <label>MEDICINE *
                    <input
                      value={line.medName || medSearch[i] || ''}
                      onChange={(e) => { searchMed(i, e.target.value); if (line.medName) setLine(i, 'medName', ''); }}
                      placeholder="Search medicine…"
                      required={!line.medicineId}
                    />
                  </label>
                  {medResults[i]?.length > 0 && (
                    <div className="res" style={{ zIndex: 20 }}>
                      {medResults[i].map((m) => (
                        <div key={m._id} style={{ padding: '8px 12px', cursor: 'pointer' }} onClick={() => selectMed(i, m)}>
                          <b>{m.name}</b> <small style={{ display: 'inline' }}>{m.genericName}</small>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <label>BATCH NO *<input required value={line.batchNo} onChange={(e) => setLine(i, 'batchNo', e.target.value)} placeholder="BT001" /></label>
                <label>EXPIRY (MM/YY) *<input required value={line.expiry} onChange={(e) => setLine(i, 'expiry', e.target.value)} placeholder="06/26" /></label>
                <label>PACKS *<input type="number" min={1} required value={line.packs} onChange={(e) => setLine(i, 'packs', parseInt(e.target.value))} /></label>
                <label>BONUS<input type="number" min={0} value={line.bonusPacks} onChange={(e) => setLine(i, 'bonusPacks', parseInt(e.target.value))} /></label>
                <label>PURCHASE PRICE/PACK (Rs) *<input required type="number" step="0.01" min={0} value={line.purchasePrice} onChange={(e) => setLine(i, 'purchasePrice', e.target.value)} placeholder="50.00" /></label>
                <label>SALE PRICE/PACK (Rs) *<input required type="number" step="0.01" min={0} value={line.salePrice} onChange={(e) => setLine(i, 'salePrice', e.target.value)} placeholder="60.00" /></label>
              </div>
              {lines.length > 1 && (
                <button type="button" className="lk" style={{ marginTop: 6, color: 'var(--er)' }} onClick={() => removeLine(i)}>Remove line</button>
              )}
            </div>
          ))}
          <button type="button" className="btn btn-ghost" onClick={addLine}>+ Add Line</button>
        </div>

        {error && <p style={{ color: 'var(--er)', fontWeight: 600 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save Purchase'}</button>
        </div>
      </form>
    </Modal>
  );
}

export function PurchasesPage() {
  const [addOpen, setAddOpen] = useState(false);
  const { toast, show: showToast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['purchases'],
    queryFn: async () => (await api.get('/purchases')).data.data,
    staleTime: 30000,
  });

  const purchases: any[] = data?.items ?? [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3>🛒 Purchase Entry</h3>
        <button className="btn" onClick={() => setAddOpen(true)}>+ New Purchase</button>
      </div>

      <div className="gw">
        <table className="gt">
          <thead>
            <tr>
              <th>Date</th>
              <th>Supplier</th>
              <th>Invoice No</th>
              <th>Lines</th>
              <th className="r">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>Loading…</td></tr>
            ) : purchases.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>No purchases yet</td></tr>
            ) : (
              purchases.map((p) => (
                <tr key={p._id}>
                  <td style={{ fontSize: 12 }}>{fmtDate(p.invoiceDate ?? p.createdAt)}</td>
                  <td><b>{(p.supplierId as any)?.name ?? '–'}</b></td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.supplierInvoiceNo}</td>
                  <td>{p.lines?.length} items</td>
                  <td className="r">{fmt(p.totalAmount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddPurchaseModal open={addOpen} onClose={() => setAddOpen(false)} />
      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}
