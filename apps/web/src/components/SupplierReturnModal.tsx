import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Modal, ModalHeader } from './Modal';
import { fmt, fmtMmYy } from '../lib/fmt';

interface SupplierReturnModalProps {
  batch: any;
  medicine: any;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SupplierReturnModal({ batch, medicine, open, onClose, onSuccess }: SupplierReturnModalProps) {
  const qc = useQueryClient();

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => (await api.get('/suppliers')).data.data,
    staleTime: 60000,
  });

  const packSize = medicine?.packSize ?? 1;
  const availablePacks = batch ? Math.floor(batch.qtyOnHand / packSize) : 0;
  const defaultPriceRs = batch?.purchasePricePerPack ? (batch.purchasePricePerPack / 100).toFixed(2) : '0.00';

  const [supplierId, setSupplierId] = useState<string>(batch?.supplierId ?? '');
  const [packs, setPacks] = useState<number>(Math.max(1, availablePacks));
  const [creditPriceRs, setCreditPriceRs] = useState<string>(defaultPriceRs);
  const [reason, setReason] = useState<string>('near_expiry');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [completedDebitNote, setCompletedDebitNote] = useState<any>(null);

  if (!batch || !medicine) return null;

  const pCredit = parseFloat(creditPriceRs) || 0;
  const totalCreditPaisa = Math.round(packs * pCredit * 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!supplierId) {
      setError('Please select a distributor / supplier');
      return;
    }

    if (packs <= 0 || packs > availablePacks) {
      setError(`Packs must be between 1 and ${availablePacks}`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/returns/supplier', {
        supplierId,
        items: [
          {
            batchId: batch._id,
            medicineId: medicine._id,
            packs,
            unitCreditPricePerPack: Math.round(pCredit * 100),
            reason,
          },
        ],
        note: note.trim(),
      });

      qc.invalidateQueries({ queryKey: ['stock'] });
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      qc.invalidateQueries({ queryKey: ['medicines'] });

      setCompletedDebitNote(res.data.data);
      onSuccess?.();
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Failed to process supplier return');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = (debitNoteId: string) => {
    const w = window.open(`/api/v1/returns/supplier/${debitNoteId}/print`, '_blank', 'width=800,height=700');
    w?.addEventListener('load', () => w.print());
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth={580}>
      <ModalHeader title="📦 Return Stock to Supplier (Debit Note)" onClose={onClose} />

      {completedDebitNote ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 42, marginBottom: 8 }}>✅</div>
          <h3 style={{ margin: '0 0 6px' }}>Debit Note Generated</h3>
          <p style={{ color: 'var(--mut)', margin: '0 0 16px' }}>
            Debit Note <b>{completedDebitNote.debitNoteNo}</b> created for <b>{completedDebitNote.supplierName}</b>.
            Total credit amount: <b>{fmt(completedDebitNote.totalCreditAmount)}</b>.
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
            <button className="btn" onClick={() => handlePrint(completedDebitNote._id)}>
              🖨️ Print Vendor Debit Note
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
          {/* Batch item summary card */}
          <div style={{
            background: 'var(--gh, rgba(255,255,255,0.03))',
            padding: '12px 14px',
            borderRadius: 8,
            border: '1px solid var(--bd)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <b style={{ fontSize: 15 }}>{medicine.name} {medicine.strength ?? ''}</b>
                <div style={{ color: 'var(--mut)', fontSize: 12 }}>{medicine.genericName} · {medicine.company}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>Batch: {batch.batchNo}</div>
                <div style={{ fontSize: 12, color: 'var(--mut)' }}>Exp: {fmtMmYy(batch.expiryDate)}</div>
              </div>
            </div>

            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--bd)', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span>Stock on Hand: <b>{batch.qtyOnHand} units ({availablePacks} packs)</b></span>
              <span>Purchase Cost: <b>{fmt(batch.purchasePricePerPack)} / pack</b></span>
            </div>
          </div>

          <div className="f3">
            <label style={{ gridColumn: 'span 2' }}>
              DISTRIBUTOR / SUPPLIER *
              <select
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">Select Supplier to Debit…</option>
                {(suppliers ?? []).map((s: any) => (
                  <option key={s._id} value={s._id}>{s.name} (Balance: {fmt(s.balance ?? 0)})</option>
                ))}
              </select>
            </label>

            <label>
              REASON *
              <select value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="near_expiry">Near Expiry Return</option>
                <option value="expired">Expired Return</option>
                <option value="damaged">Damaged / Broken Packaging</option>
                <option value="recall">Manufacturer Recall</option>
                <option value="excess_stock">Excess Stock Adjustment</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label>
              PACKS TO RETURN *
              <input
                type="number"
                min={1}
                max={availablePacks}
                required
                value={packs}
                onChange={(e) => setPacks(parseInt(e.target.value) || 1)}
              />
            </label>

            <label>
              AGREED CREDIT / PACK (Rs) *
              <input
                type="number"
                step="0.01"
                min={0}
                required
                value={creditPriceRs}
                onChange={(e) => setCreditPriceRs(e.target.value)}
              />
            </label>

            <label>
              NOTE / REF
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Sales Rep confirmation ref"
              />
            </label>
          </div>

          {/* Credit calculation banner */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            padding: '10px 14px',
            borderRadius: 8
          }}>
            <div>
              <span style={{ fontWeight: 600 }}>TOTAL CREDIT APPLIED TO SUPPLIER:</span>
              <div style={{ fontSize: 11, color: 'var(--mut)' }}>
                {packs} packs × Rs {pCredit.toFixed(2)} = {packs * packSize} units deducted from inventory
              </div>
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--br, #38bdf8)' }}>
              {fmt(totalCreditPaisa)}
            </span>
          </div>

          {error && <p style={{ color: 'var(--er)', fontWeight: 600, margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="btn"
              disabled={submitting || availablePacks === 0}
            >
              {submitting ? 'Generating Debit Note…' : 'Generate Vendor Debit Note'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
