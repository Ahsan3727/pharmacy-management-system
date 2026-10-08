import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Modal, ModalHeader } from './Modal';
import { fmt } from '../lib/fmt';

interface ReturnModalProps {
  sale: any;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReturnModal({ sale, open, onClose, onSuccess }: ReturnModalProps) {
  const qc = useQueryClient();

  const [returnItems, setReturnItems] = useState<Record<number, { selected: boolean; qty: number; restock: boolean }>>(() => {
    const init: Record<number, { selected: boolean; qty: number; restock: boolean }> = {};
    sale?.items?.forEach((item: any, idx: number) => {
      const available = item.qty - (item.returnedQty ?? 0);
      init[idx] = { selected: false, qty: Math.min(1, available), restock: true };
    });
    return init;
  });

  const [refundMethod, setRefundMethod] = useState<'cash' | 'udhaar_reduction'>(
    sale?.creditAmount > 0 ? 'udhaar_reduction' : 'cash'
  );
  const [reason, setReason] = useState('Customer returned unused medicines');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [completedReturn, setCompletedReturn] = useState<any>(null);

  if (!sale) return null;

  // Calculate live total refund
  const discountFactor = 1 - ((sale.discountBP ?? 0) / 10000);
  let totalEstimatedRefund = 0;

  sale.items.forEach((item: any, idx: number) => {
    const state = returnItems[idx];
    if (state?.selected && state.qty > 0) {
      const lineNetTotal = Math.round(item.lineTotal * discountFactor);
      const unitRefund = Math.floor(lineNetTotal / item.qty);
      totalEstimatedRefund += unitRefund * state.qty;
    }
  });

  const handleToggle = (idx: number, checked: boolean) => {
    setReturnItems((prev) => ({
      ...prev,
      [idx]: { ...prev[idx], selected: checked },
    }));
  };

  const handleQtyChange = (idx: number, qty: number, maxQty: number) => {
    const clamped = Math.max(1, Math.min(qty, maxQty));
    setReturnItems((prev) => ({
      ...prev,
      [idx]: { ...prev[idx], qty: clamped },
    }));
  };

  const handleRestockToggle = (idx: number, restock: boolean) => {
    setReturnItems((prev) => ({
      ...prev,
      [idx]: { ...prev[idx], restock },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const itemsToReturn = sale.items
      .map((item: any, idx: number) => {
        const state = returnItems[idx];
        if (!state?.selected || state.qty <= 0) return null;
        return {
          saleItemIndex: idx,
          quantity: state.qty,
          restock: state.restock,
        };
      })
      .filter(Boolean);

    if (itemsToReturn.length === 0) {
      setError('Please select at least one item to return');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for the return');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/returns/customer', {
        saleId: sale._id,
        items: itemsToReturn,
        refundMethod,
        reason: reason.trim(),
      });

      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['returns'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      qc.invalidateQueries({ queryKey: ['medicines'] });

      setCompletedReturn(res.data.data);
      onSuccess?.();
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Failed to process return');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = (returnId: string) => {
    const w = window.open(`/api/v1/returns/customer/${returnId}/print`, '_blank', 'width=380,height=600');
    w?.addEventListener('load', () => w.print());
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth={650}>
      <ModalHeader title={`↩️ Customer Return — ${sale.invoiceNo}`} onClose={onClose} />

      {completedReturn ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 42, marginBottom: 8 }}>✅</div>
          <h3 style={{ margin: '0 0 6px' }}>Return Processed Successfully</h3>
          <p style={{ color: 'var(--mut)', margin: '0 0 16px' }}>
            Voucher <b>{completedReturn.returnNo}</b> generated. Refund: <b>{fmt(completedReturn.totalRefund)}</b> ({completedReturn.refundMethod}).
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
            <button className="btn" onClick={() => handlePrint(completedReturn._id)}>
              🖨️ Print Return Voucher
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
          {/* Sale summary banner */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--gh, rgba(255,255,255,0.03))',
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 12
          }}>
            <div>
              <span>Customer: <b>{sale.customerNameSnapshot}</b></span>
              <span style={{ marginLeft: 12, color: 'var(--mut)' }}>Cashier: {sale.soldByName}</span>
            </div>
            <div>
              Original Total: <b>{fmt(sale.total)}</b>
            </div>
          </div>

          {/* Items selector */}
          <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--bd)', borderRadius: 8 }}>
            <table className="gt" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }} />
                  <th>Medicine / Batch</th>
                  <th style={{ textAlign: 'center', width: 90 }}>Return Qty</th>
                  <th style={{ textAlign: 'center', width: 130 }}>Condition</th>
                  <th className="r" style={{ width: 90 }}>Refund</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item: any, idx: number) => {
                  const previouslyReturned = item.returnedQty ?? 0;
                  const available = item.qty - previouslyReturned;
                  const state = returnItems[idx] ?? { selected: false, qty: 1, restock: true };
                  const isExhausted = available <= 0;

                  const lineNetTotal = Math.round(item.lineTotal * discountFactor);
                  const unitRefund = Math.floor(lineNetTotal / item.qty);
                  const lineRefund = state.selected ? unitRefund * state.qty : 0;

                  return (
                    <tr key={idx} style={{ opacity: isExhausted ? 0.45 : 1 }}>
                      <td>
                        <input
                          type="checkbox"
                          disabled={isExhausted}
                          checked={state.selected}
                          onChange={(e) => handleToggle(idx, e.target.checked)}
                          style={{ margin: 0 }}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.nameSnapshot}</div>
                        <small style={{ color: 'var(--mut)' }}>
                          Batch: {item.batchNoSnapshot} · Sold: {item.qty} {isExhausted ? '(Fully Returned)' : `(Avail: ${available})`}
                        </small>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          min={1}
                          max={available}
                          disabled={!state.selected || isExhausted}
                          value={state.qty}
                          onChange={(e) => handleQtyChange(idx, parseInt(e.target.value) || 1, available)}
                          style={{ width: 64, padding: '4px 6px', textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <select
                          disabled={!state.selected || isExhausted}
                          value={state.restock ? 'restock' : 'damage'}
                          onChange={(e) => handleRestockToggle(idx, e.target.value === 'restock')}
                          style={{ fontSize: 11, padding: '4px 6px', height: 28 }}
                        >
                          <option value="restock">📦 Restock Shelf</option>
                          <option value="damage">⚠️ Damaged / Dispose</option>
                        </select>
                      </td>
                      <td className="r" style={{ fontWeight: 600 }}>
                        {state.selected ? fmt(lineRefund) : '–'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Refund method & Reason */}
          <div className="f3">
            <label>
              REFUND METHOD *
              <select
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value as any)}
                required
              >
                <option value="cash">💵 Cash Refund to Customer</option>
                {sale.customerId && (
                  <option value="udhaar_reduction">📒 Deduct from Customer Udhaar Balance</option>
                )}
              </select>
            </label>

            <label style={{ gridColumn: 'span 2' }}>
              RETURN REASON *
              <input
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Unused medicine, doctor modified prescription"
              />
            </label>
          </div>

          {/* Total Refund Banner */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            padding: '10px 14px',
            borderRadius: 8
          }}>
            <span style={{ fontWeight: 600 }}>TOTAL REFUND DUE:</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ok, #22c55e)' }}>
              {fmt(totalEstimatedRefund)}
            </span>
          </div>

          {error && <p style={{ color: 'var(--er)', fontWeight: 600, margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="btn"
              disabled={submitting || totalEstimatedRefund === 0}
            >
              {submitting ? 'Processing…' : 'Confirm & Process Return'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
