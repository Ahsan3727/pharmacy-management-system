import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal, ModalHeader } from './Modal';
import { api } from '../lib/api';
import { fmt, fmtDate } from '../lib/fmt';
import { sounds } from '../lib/sound';

interface CycleCountModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (audit: any) => void;
}

export function CycleCountModal({ open, onClose, onSuccess }: CycleCountModalProps) {
  const qc = useQueryClient();
  const [step, setStep] = useState<'filter' | 'counting'>('filter');
  const [selectedRack, setSelectedRack] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [blindCount, setBlindCount] = useState(false);
  const [notes, setNotes] = useState('');

  // Local count entries state: Map of batchId -> countedQty
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch unique racks and categories from medicines
  const { data: medicines = [] } = useQuery({
    queryKey: ['medicines-for-racks'],
    queryFn: async () => (await api.get('/medicines')).data.data?.medicines ?? [],
    enabled: open,
  });

  const availableRacks = Array.from(
    new Set(medicines.map((m: any) => m.rack).filter(Boolean))
  ) as string[];

  // Fetch count sheet items
  const { data: sheetItems = [], isLoading: loadingSheet, refetch: fetchSheet } = useQuery({
    queryKey: ['stock-sheet', selectedRack, selectedCategory],
    queryFn: async () => {
      const res = await api.get('/stock/sheet', {
        params: {
          rack: selectedRack || undefined,
          category: selectedCategory || undefined,
        },
      });
      return res.data.data;
    },
    enabled: step === 'counting',
  });

  // When sheet items load, initialize counts
  useEffect(() => {
    if (sheetItems.length > 0) {
      const initial: Record<string, number> = {};
      sheetItems.forEach((item: any) => {
        initial[item.batchId] = blindCount ? 0 : item.systemQty;
      });
      setCounts(initial);
    }
  }, [sheetItems, blindCount]);

  const handleStartCount = () => {
    setStep('counting');
    fetchSheet();
  };

  const handleQtyChange = (batchId: string, val: number) => {
    setCounts((prev) => ({ ...prev, [batchId]: Math.max(0, val) }));
  };

  // Compute variance metrics
  let totalVarianceQty = 0;
  let totalVarianceValue = 0;
  let totalDiscrepancies = 0;

  sheetItems.forEach((item: any) => {
    const counted = counts[item.batchId] ?? item.systemQty;
    const diff = counted - item.systemQty;
    if (diff !== 0) {
      totalDiscrepancies++;
      totalVarianceQty += diff;
      totalVarianceValue += diff * item.unitCost;
    }
  });

  const handleCommitAudit = async () => {
    if (sheetItems.length === 0 || submitting) return;
    setError('');
    setSubmitting(true);

    try {
      const payload = {
        rack: selectedRack || undefined,
        category: selectedCategory || undefined,
        notes: notes || undefined,
        items: sheetItems.map((item: any) => ({
          medicineId: item.medicineId,
          batchId: item.batchId,
          medicineName: item.medicineName,
          batchNo: item.batchNo,
          systemQty: item.systemQty,
          countedQty: counts[item.batchId] ?? item.systemQty,
          unitCost: item.unitCost,
        })),
      };

      const res = await api.post('/stock/audits', payload);
      sounds.success();
      qc.invalidateQueries({ queryKey: ['stock'] });
      qc.invalidateQueries({ queryKey: ['stock-audits'] });
      onSuccess(res.data.data);
      onClose();
    } catch (err: any) {
      sounds.warn();
      setError(err.response?.data?.error?.message ?? 'Failed to reconcile stock audit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth={880}>
      <ModalHeader
        title="📋 Physical Cycle Count Stock Audit"
        onClose={onClose}
      />

      {step === 'filter' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ background: 'var(--sf2, rgba(0,0,0,0.03))', padding: 14, borderRadius: 8, fontSize: 13 }}>
            <b>Audit Purpose:</b> Routine cycle counting verifies physical shelf inventory against system records, detects leakage/theft early, and prevents shutdown-based stocktakes.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--mut)', display: 'block', marginBottom: 6 }}>
                Select Rack / Shelf
              </label>
              <select
                value={selectedRack}
                onChange={(e) => setSelectedRack(e.target.value)}
                style={{ width: '100%', borderRadius: 8 }}
              >
                <option value="">All Racks (Full Pharmacy)</option>
                {availableRacks.map((r) => (
                  <option key={r} value={r}>
                    Rack {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--mut)', display: 'block', marginBottom: 6 }}>
                Staff Audit Notes (Optional)
              </label>
              <input
                placeholder="e.g. Monthly Antibiotics shelf audit"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ width: '100%', borderRadius: 8 }}
              />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={blindCount}
              onChange={(e) => setBlindCount(e.target.checked)}
            />
            <b>Blind Count Mode</b> (Hide system quantities so staff must count from scratch)
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleStartCount}
              style={{ background: '#0284c7', borderColor: '#0284c7', color: '#fff', fontWeight: 600 }}
            >
              Generate Count Sheet →
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {/* Header metrics banner */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--sf2, rgba(0,0,0,0.03))',
              padding: '12px 16px',
              borderRadius: 8,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <span style={{ fontSize: 12, color: 'var(--mut)' }}>Auditing Scope: </span>
              <b>{selectedRack ? `Rack ${selectedRack}` : 'Full Inventory'}</b>
              <span style={{ margin: '0 8px', color: 'var(--mut)' }}>·</span>
              <span style={{ fontSize: 12, color: 'var(--mut)' }}>Items: </span>
              <b>{sheetItems.length} batches</b>
            </div>

            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div>
                <small style={{ color: 'var(--mut)', display: 'block' }}>Discrepancies</small>
                <b style={{ color: totalDiscrepancies > 0 ? '#ef4444' : '#16a34a' }}>
                  {totalDiscrepancies} items
                </b>
              </div>

              <div>
                <small style={{ color: 'var(--mut)', display: 'block' }}>Net Valuation Impact</small>
                <b style={{ color: totalVarianceValue < 0 ? '#ef4444' : totalVarianceValue > 0 ? '#0284c7' : '#16a34a' }}>
                  {totalVarianceValue < 0 ? '-' : '+'}{fmt(Math.abs(totalVarianceValue))}
                </b>
              </div>
            </div>
          </div>

          {error && (
            <div style={{ background: 'var(--erb)', color: 'var(--er)', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}>
              ⚠ {error}
            </div>
          )}

          {/* Interactive Sheet Table */}
          {loadingSheet ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--mut)' }}>Loading inventory count sheet...</div>
          ) : sheetItems.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--mut)' }}>
              No active stock batches found for this selection.
            </div>
          ) : (
            <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid var(--bd)', borderRadius: 8 }}>
              <table className="gt" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--sf)', textAlign: 'left', borderBottom: '1px solid var(--bd)' }}>
                    <th style={{ padding: '8px 12px' }}>Medicine & Batch</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Rack</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>System Qty</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', width: 170 }}>Physical Count</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {sheetItems.map((item: any) => {
                    const counted = counts[item.batchId] ?? (blindCount ? 0 : item.systemQty);
                    const diff = counted - item.systemQty;
                    const diffColor = diff === 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#0284c7';

                    return (
                      <tr key={item.batchId} style={{ borderBottom: '1px solid var(--bd)' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ fontWeight: 600 }}>{item.medicineName}</div>
                          <small style={{ color: 'var(--mut)' }}>
                            Batch: <b>{item.batchNo}</b> · Exp: {fmtDate(item.expiryDate)}
                          </small>
                        </td>

                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span className="pill" style={{ fontSize: 11 }}>
                            {item.rack}
                          </span>
                        </td>

                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                          {item.systemQty} <small>{item.looseUnit}s</small>
                        </td>

                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="alt"
                              style={{ width: 26, height: 26, padding: 0 }}
                              onClick={() => handleQtyChange(item.batchId, counted - 1)}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={0}
                              value={counted}
                              onChange={(e) => handleQtyChange(item.batchId, parseInt(e.target.value) || 0)}
                              style={{ width: 64, textAlign: 'center', padding: '4px 6px', borderRadius: 6 }}
                            />
                            <button
                              type="button"
                              className="alt"
                              style={{ width: 26, height: 26, padding: 0 }}
                              onClick={() => handleQtyChange(item.batchId, counted + 1)}
                            >
                              +
                            </button>
                          </div>
                        </td>

                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <span style={{ fontWeight: 700, color: diffColor }}>
                            {diff > 0 ? `+${diff}` : diff} {item.looseUnit}s
                          </span>
                          {diff !== 0 && (
                            <small style={{ display: 'block', color: 'var(--mut)' }}>
                              {diff < 0 ? '-' : '+'}{fmt(Math.abs(diff * item.unitCost))}
                            </small>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setStep('filter')}>
              ← Change Scope
            </button>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                disabled={submitting || sheetItems.length === 0}
                onClick={handleCommitAudit}
                style={{
                  background: totalDiscrepancies > 0 ? '#ea580c' : '#16a34a',
                  borderColor: totalDiscrepancies > 0 ? '#ea580c' : '#16a34a',
                  color: '#fff',
                  fontWeight: 600,
                }}
              >
                {submitting ? 'Reconciling...' : `Reconcile & Apply Adjustments (${totalDiscrepancies} diffs)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
