import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { Modal, ModalHeader } from '../components/Modal';
import { Toast, useToast } from '../components/Toast';
import { fmt, fmtMmYy, fmtDate, fmtDateTime, daysUntil, expiryClass, newClientRequestId } from '../lib/fmt';
import { sounds } from '../lib/sound';

// ─── Medicine search ─────────────────────────────────────────────────────────

function MedicineSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cart = useCartStore();

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await api.get('/medicines/search', { params: { q } });
        setResults(res.data.data);
        setOpen(true);
      } catch { /* ignore */ }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  // Keyboard shortcut: F2 focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const select = (med: any, batch: any) => {
    if (!batch || batch.qtyOnHand === 0) return;
    const lineTotal = Math.round((1 * batch.salePricePerPack) / med.packSize);
    cart.addItem({
      medicineId: med._id,
      batchId: batch._id,
      name: `${med.name}${med.strength ? ' ' + med.strength : ''}`,
      batchNo: batch.batchNo,
      expiryDate: batch.expiryDate,
      packSize: med.packSize,
      looseUnit: med.looseUnit,
      packUnit: med.packUnit,
      qty: 1,
      packPrice: batch.salePricePerPack,
      lineTotal,
      maxQty: batch.qtyOnHand,
    });
    sounds.scan();
    setQ('');
    setResults([]);
    inputRef.current?.focus();
  };

  return (
    <div className="sw">
      <input
        ref={inputRef}
        id="med-search"
        type="search"
        placeholder="Search medicine by name, generic, company… (F2)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <div className="res">
          {results.map((med) => (
            <div
              key={med._id}
              style={{ borderBottom: '1px solid var(--bd)', cursor: med.totalStock > 0 ? 'pointer' : 'default' }}
            >
              {/* Medicine header row */}
              <div
                style={{ padding: '8px 12px', opacity: med.totalStock === 0 ? 0.5 : 1 }}
                onClick={() => med.batches?.[0] && select(med, med.batches[0])}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>{med.name}{med.strength ? ` ${med.strength}` : ''}</span>
                  <span style={{ color: 'var(--mut)', fontSize: 12 }}>
                    {med.totalStock} {med.looseUnit}s · Rack {med.rack ?? '–'}
                  </span>
                </div>
                <small>{med.genericName} · {med.company}</small>
              </div>
              {/* Batch selector if multiple */}
              {med.batches?.length > 1 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '0 12px 8px' }}>
                  {med.batches.map((b: any) => {
                    const days = daysUntil(b.expiryDate);
                    const cls = expiryClass(days);
                    return (
                      <button key={b._id} className="alt" onClick={() => select(med, b)}>
                        {b.batchNo} · exp {fmtMmYy(b.expiryDate)} · <b>{fmt(b.salePricePerPack)}</b>
                        {cls !== 'ok' && <span className={`pill ${cls}`} style={{ marginLeft: 4 }}>{days}d</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {open && q && results.length === 0 && (
        <div className="res"><p className="nm">No medicines found for "{q}"</p></div>
      )}
    </div>
  );
}

// ─── Cart table ──────────────────────────────────────────────────────────────

function CartTable() {
  const cart = useCartStore();
  const { items, removeItem, updateQty } = cart;

  if (items.length === 0) {
    return (
      <div style={{
        display: 'grid', placeItems: 'center', minHeight: 150,
        color: 'var(--mut)', textAlign: 'center', padding: 20
      }}>
        <div>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🛒</div>
          <div>Search for a medicine above to add it</div>
          <small>or press F2 to focus search</small>
        </div>
      </div>
    );
  }

  return (
    <div className="gw" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      <table className="gt">
        <thead>
          <tr>
            <th>Medicine / Batch</th>
            <th>Qty</th>
            <th className="r">Price/Pack</th>
            <th className="r">Total</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const days = daysUntil(item.expiryDate);
            const cls = expiryClass(days);
            return (
              <tr key={`${item.medicineId}-${item.batchId}-${i}`}>
                <td>
                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                  <small>
                    {item.batchNo} · exp {fmtMmYy(item.expiryDate)}
                    {cls !== 'ok' && <span className={`pill ${cls}`} style={{ marginLeft: 6 }}>{days < 0 ? 'Expired' : `${days}d`}</span>}
                  </small>
                </td>
                <td>
                  <div className="qt">
                    <button onClick={() => { updateQty(i, item.qty - 1); sounds.step(); }}>−</button>
                    <input
                      type="number"
                      min={1}
                      max={item.maxQty}
                      value={item.qty}
                      onChange={(e) => { updateQty(i, parseInt(e.target.value) || 1); sounds.step(); }}
                    />
                    <button onClick={() => { updateQty(i, item.qty + 1); sounds.step(); }}>+</button>
                  </div>
                  <small>{item.packUnit}s: {Math.floor(item.qty / item.packSize)} + {item.qty % item.packSize} {item.looseUnit}s</small>
                </td>
                <td className="r">{fmt(item.packPrice)}</td>
                <td className="r" style={{ fontWeight: 600 }}>{fmt(item.lineTotal)}</td>
                <td>
                  <button
                    className="x"
                    onClick={() => removeItem(i)}
                    aria-label={`Remove ${item.name}`}
                  >✕</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Billing footer ──────────────────────────────────────────────────────────

function BillingFooter({ onCommit }: { onCommit: () => void }) {
  const cart = useCartStore();
  const { user } = useAuthStore();
  const subtotal = cart.subtotal();
  const discount = cart.discount();
  const total = cart.total();
  const change = cart.paymentMode === 'cash' ? cart.cashPaid - total : 0;

  return (
    <div className="ft">
      {/* Payment mode */}
      <div className="seg" style={{ marginRight: 4 }}>
        {(['cash', 'card', 'credit', 'split'] as const).map((m) => (
          <button key={m} className={cart.paymentMode === m ? 'on' : ''} onClick={() => cart.setPaymentMode(m)}>
            {m === 'cash' ? '💵' : m === 'card' ? '💳' : m === 'credit' ? '📒' : '⚡'} {m}
          </button>
        ))}
      </div>

      {/* Discount */}
      <label style={{ flexShrink: 0 }}>
        DISC %
        <input
          type="number"
          min={0}
          max={user?.role === 'owner' ? 100 : user?.role === 'manager' ? 15 : 5}
          step={0.5}
          style={{ width: 70 }}
          value={(cart.discountBP / 100).toFixed(1)}
          onChange={(e) => cart.setDiscount(Math.round(parseFloat(e.target.value || '0') * 100))}
        />
      </label>

      {/* Prescription */}
      <label style={{ flex: 1, minWidth: 120 }}>
        RX / DOCTOR
        <input
          type="text"
          placeholder="Dr. name or Rx no."
          value={cart.prescription}
          onChange={(e) => cart.setPrescription(e.target.value)}
        />
      </label>

      {/* Totals */}
      <div className="sm" style={{ marginLeft: 'auto' }}>
        <span>Sub: <b>{fmt(subtotal)}</b></span>
        {discount > 0 && <span>Disc: <b>-{fmt(discount)}</b></span>}
        {change > 0 && <span>Change: <b>{fmt(change)}</b></span>}
      </div>

      {/* Net total */}
      <div className="net" style={{ minWidth: 130 }}>
        <small>Total</small>
        <b>{fmt(total)}</b>
      </div>

      {/* Commit */}
      <button
        id="commit-btn"
        className="btn btn-big"
        onClick={onCommit}
        disabled={cart.items.length === 0}
      >
        Commit Sale (F9)
      </button>
    </div>
  );
}

// ─── Bill / receipt modal ─────────────────────────────────────────────────────

function BillModal({ saleId, onClose }: { saleId: string | null; onClose: () => void }) {
  if (!saleId) return null;

  const printUrl = `/api/v1/sales/${saleId}/print`;

  const handlePrint = () => {
    const w = window.open(printUrl, '_blank', 'width=380,height=600');
    w?.addEventListener('load', () => w.print());
  };

  return (
    <Modal open={!!saleId} onClose={onClose}>
      <ModalHeader title="Sale Complete" onClose={onClose} />
      <p style={{ color: 'var(--mut)', marginBottom: 14 }}>Bill ready. Print the thermal receipt.</p>
      <div className="acts">
        <button className="btn btn-ghost" onClick={onClose}>New Sale</button>
        <button className="btn" onClick={handlePrint}>🖨 Print Bill</button>
      </div>
      <div style={{ marginTop: 10 }}>
        <a href={printUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--br)' }}>
          Open receipt in new tab
        </a>
      </div>
    </Modal>
  );
}

// ─── Customer picker ─────────────────────────────────────────────────────────

function CustomerPicker() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const cart = useCartStore();

  const { data } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => (await api.get('/customers')).data.data,
    staleTime: 60000,
  });

  const filtered = (data ?? []).filter(
    (c: any) =>
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      (c.phone && c.phone.includes(q))
  );

  return (
    <div style={{ position: 'relative', marginBottom: 8 }}>
      <input
        id="customer-search"
        type="search"
        placeholder="Customer name / phone (optional — for udhaar)"
        value={cart.customerName ? `${cart.customerName}` : q}
        onChange={(e) => { setQ(e.target.value); cart.setCustomer(null, null); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        style={{ borderRadius: 8 }}
      />
      {cart.customerId && (
        <button
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, cursor: 'pointer' }}
          onClick={() => { cart.setCustomer(null, null); setQ(''); }}
        >✕</button>
      )}
      {open && q && filtered.length > 0 && (
        <div className="res">
          {filtered.slice(0, 8).map((c: any) => (
            <div
              key={c._id}
              style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
              onClick={() => { cart.setCustomer(c._id, c.name); setQ(''); setOpen(false); }}
            >
              <span>{c.name} <small style={{ display: 'inline' }}>{c.phone}</small></span>
              {c.balance > 0 && <span className="pill wn" style={{ marginLeft: 8 }}>{fmt(c.balance)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main billing page ───────────────────────────────────────────────────────

export function BillingPage() {
  const cart = useCartStore();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const { toast, show: showToast } = useToast();
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState('');

  // Keyboard shortcut: F9 = commit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F9') { e.preventDefault(); handleCommit(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const handleCommit = async () => {
    if (cart.items.length === 0 || committing) return;
    setError('');
    setCommitting(true);
    try {
      const res = await api.post('/sales', {
        clientRequestId: newClientRequestId(),
        customerId: cart.customerId ?? undefined,
        items: cart.items.map((i) => ({
          medicineId: i.medicineId,
          quantity: i.qty,
          batchId: i.batchId,
        })),
        discountBP: cart.discountBP,
        paymentMode: cart.paymentMode,
        cashPaid: cart.cashPaid,
        cardPaid: cart.cardPaid,
        prescription: cart.prescription || undefined,
      });
      const sale = res.data.data;
      setLastSaleId(sale._id);
      cart.clear();
      qc.invalidateQueries({ queryKey: ['customers'] });
      sounds.success();
      showToast(`✅ Bill ${sale.invoiceNo} committed`);
    } catch (err: any) {
      sounds.warn();
      setError(err.response?.data?.error?.message ?? 'Sale failed');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="bw" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 10 }}>
        <h3>🏥 Point of Sale</h3>
        <CustomerPicker />
        <MedicineSearch />
      </div>

      {error && (
        <div style={{
          background: 'var(--erb)', color: 'var(--er)',
          borderRadius: 8, padding: '8px 12px', marginBottom: 8, fontWeight: 600, fontSize: 13,
        }}>
          ⚠ {error}
        </div>
      )}

      <CartTable />

      <BillingFooter onCommit={handleCommit} />

      <BillModal saleId={lastSaleId} onClose={() => setLastSaleId(null)} />
      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}
