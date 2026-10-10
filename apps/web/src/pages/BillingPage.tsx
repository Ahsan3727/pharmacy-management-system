import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, openAuthedHtml } from '../lib/api';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { Modal, ModalHeader } from '../components/Modal';
import { NarcoticModal } from '../components/NarcoticModal';
import { Toast, useToast } from '../components/Toast';
import { fmt, fmtMmYy, daysUntil, expiryClass } from '../lib/fmt';
import { sounds } from '../lib/sound';

// ─── Medicine Search & Catalog Intake ───────────────────────────────────────

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
      storageCondition: med.storageCondition,
      prescriptionType: med.prescriptionType ?? (med.isControlled ? 'controlled_narcotic' : 'otc'),
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
        placeholder="Search medicine by brand, salt, company… (Press F2)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <div className="res">
          {results.map((med) => {
            // Find earliest expiring valid batch for FEFO indicator
            const unexpiredBatches = (med.batches || []).filter((b: any) => daysUntil(b.expiryDate) > 0);
            const firstToSellBatchId = unexpiredBatches[0]?._id;

            return (
              <div
                key={med._id}
                style={{ borderBottom: '1px solid var(--bd)', cursor: med.totalStock > 0 ? 'pointer' : 'default' }}
              >
                {/* Medicine header row */}
                <div
                  style={{ padding: '9px 12px', opacity: med.totalStock === 0 ? 0.5 : 1 }}
                  onClick={() => med.batches?.[0] && select(med, med.batches[0])}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600 }}>{med.name}{med.strength ? ` ${med.strength}` : ''}</span>
                      {med.storageCondition === 'cold_chain_2_8' && (
                        <span className="status-chip" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#0284c7' }}>
                          ❄️ 2–8°C
                        </span>
                      )}
                      {(med.prescriptionType === 'controlled_narcotic' || med.isControlled) && (
                        <span className="status-chip rx" title="Controlled Narcotic (Form-9)">
                          Rx Form-9
                        </span>
                      )}
                    </div>
                    <span style={{ color: 'var(--mut)', fontSize: 12 }}>
                      {med.totalStock} {med.looseUnit}s · Rack {med.rack ?? '–'}
                    </span>
                  </div>
                  <small>{med.genericName} · {med.company}{med.category ? ` · ${med.category}` : ''}</small>
                </div>
                {/* Batch selector with FEFO badge */}
                {med.batches?.length > 1 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 12px 9px' }}>
                    {med.batches.map((b: any) => {
                      const days = daysUntil(b.expiryDate);
                      const cls = expiryClass(days);
                      const isFefo = b._id === firstToSellBatchId;
                      return (
                        <button key={b._id} className="alt" onClick={() => select(med, b)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          {isFefo && <span className="fefo-badge">⭐ FEFO 1st</span>}
                          <span>{b.batchNo} · exp {fmtMmYy(b.expiryDate)} · <b>{fmt(b.salePricePerPack)}</b></span>
                          {cls !== 'ok' && <span className={`pill ${cls}`}>{days}d</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {open && q && results.length === 0 && (
        <div className="res"><p className="nm">No medicines found for "{q}"</p></div>
      )}
    </div>
  );
}

// ─── Customer Picker ────────────────────────────────────────────────────────

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
        placeholder="Customer name / phone (optional — for ledger or credit)"
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
          title="Clear customer"
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
              {c.balance > 0 && <span className="status-chip warn">{fmt(c.balance)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Pinned Till Receipt Component ──────────────────────────────────────────

function TillReceiptPanel({ onCommit }: { onCommit: () => void }) {
  const cart = useCartStore();
  const { user } = useAuthStore();
  const { items, removeItem, updateQty } = cart;

  const subtotal = cart.subtotal();
  const discount = cart.discount();
  const total = cart.total();
  const change = cart.paymentMode === 'cash' ? cart.cashPaid - total : 0;

  // Clamped discounts: cashier max 5%, manager max 15%, owner max 100%
  const maxDiscountPct = user?.role === 'owner' ? 100 : user?.role === 'manager' ? 15 : 5;

  const handleDiscountChange = (valStr: string) => {
    const raw = parseFloat(valStr || '0');
    const clamped = Math.max(0, Math.min(raw, maxDiscountPct));
    cart.setDiscount(Math.round(clamped * 100));
  };

  return (
    <div className="till-receipt">
      {/* 1. Receipt Top Header */}
      <div className="receipt-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--pine)', letterSpacing: '-0.01em' }}>
              🧾 LIVE TILL RECEIPT
            </div>
            <small style={{ color: 'var(--mut)', margin: 0 }}>
              {cart.customerName ? `Customer: ${cart.customerName}` : 'Walk-in Customer'}
            </small>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="status-chip ok" style={{ fontSize: 10 }}>
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Scrollable Receipt Line Items */}
      <div className="receipt-lines">
        {items.length === 0 ? (
          <div style={{
            display: 'grid', placeItems: 'center', height: '100%', minHeight: 180,
            color: 'var(--mut)', textAlign: 'center', padding: 20
          }}>
            <div>
              <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.6 }}>🛒</div>
              <div style={{ fontWeight: 600, color: 'var(--ink)' }}>Till is empty</div>
              <small>Search medicine on left (F2) to add items</small>
            </div>
          </div>
        ) : (
          items.map((item, i) => {
            const days = daysUntil(item.expiryDate);
            const cls = expiryClass(days);
            const isControlled = item.prescriptionType === 'controlled_narcotic';

            return (
              <div
                key={`${item.medicineId}-${item.batchId}-${i}`}
                className={`receipt-line-item ${isControlled ? 'controlled' : ''}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span>{item.name}</span>
                      {isControlled && (
                        <span className="status-chip rx" style={{ fontSize: 9.5 }}>Rx Form-9</span>
                      )}
                    </div>
                    <small style={{ color: 'var(--mut)' }}>
                      Batch {item.batchNo} · exp {fmtMmYy(item.expiryDate)}
                      {cls !== 'ok' && (
                        <span className={`pill ${cls}`} style={{ marginLeft: 6, fontSize: 10 }}>
                          {days < 0 ? 'Expired' : `${days}d`}
                        </span>
                      )}
                    </small>
                  </div>
                  <button
                    className="x"
                    onClick={() => removeItem(i)}
                    aria-label={`Remove ${item.name}`}
                    style={{ marginTop: -4 }}
                  >✕</button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
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
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--mut)' }}>
                      {fmt(item.packPrice)} / {item.packUnit}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>
                      {fmt(item.lineTotal)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. Pinned Receipt Totals & Payment Commit */}
      <div className="receipt-totals">
        {/* Payment mode selector */}
        <div className="seg" style={{ width: '100%' }}>
          {(['cash', 'card', 'credit', 'split'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={cart.paymentMode === m ? 'on' : ''}
              onClick={() => cart.setPaymentMode(m)}
              style={{ flex: 1, padding: '6px 8px', fontSize: 12 }}
            >
              {m === 'cash' ? '💵 Cash' : m === 'card' ? '💳 Card' : m === 'credit' ? '📒 Udhaar' : '⚡ Split'}
            </button>
          ))}
        </div>

        {/* Discount & Rx Doctor Inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8 }}>
          <label>
            <span>DISCOUNT % <small style={{ display: 'inline', color: 'var(--mut)' }}>(max {maxDiscountPct}%)</small></span>
            <input
              type="number"
              min={0}
              max={maxDiscountPct}
              step={0.5}
              value={(cart.discountBP / 100).toFixed(1)}
              onChange={(e) => handleDiscountChange(e.target.value)}
              style={{ padding: '6px 8px' }}
            />
          </label>
          <label>
            <span>RX / PRESCRIBER</span>
            <input
              type="text"
              placeholder="Dr. / Clinic"
              value={cart.prescription}
              onChange={(e) => cart.setPrescription(e.target.value)}
              style={{ padding: '6px 8px' }}
            />
          </label>
        </div>

        {/* Calculation summary line */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--mut)' }}>
          <span>Subtotal: <b style={{ color: 'var(--ink)' }}>{fmt(subtotal)}</b></span>
          {discount > 0 && <span style={{ color: 'var(--accent-orange)' }}>Disc: <b>-{fmt(discount)}</b></span>}
          {change > 0 && <span style={{ color: 'var(--status-ok)' }}>Change: <b>{fmt(change)}</b></span>}
        </div>

        {/* Net Total Display */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, var(--pine), #124B38)',
          color: '#fff',
          padding: '10px 16px',
          borderRadius: 10
        }}>
          <div>
            <div style={{ fontSize: 11, color: '#A0CABA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Amount Due
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'Bricolage Grotesque, Figtree, sans-serif' }}>
              {fmt(total)}
            </div>
          </div>
          <button
            id="commit-btn"
            className="btn btn-big"
            onClick={onCommit}
            disabled={items.length === 0}
            style={{ padding: '10px 18px', fontSize: 14 }}
          >
            Commit (F9)
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Thermal Bill Modal (Uses openAuthedHtml Blob Proxy) ───────────────────

function BillModal({ saleId, onClose }: { saleId: string | null; onClose: () => void }) {
  if (!saleId) return null;

  const printUrl = `/api/v1/sales/${saleId}/print`;

  const handlePrint = async () => {
    try {
      await openAuthedHtml(printUrl, { autoPrint: true });
    } catch {
      alert('Failed to print receipt. Please check server connection.');
    }
  };

  return (
    <Modal open={!!saleId} onClose={onClose} maxWidth={400}>
      <ModalHeader title="✅ Sale Committed" onClose={onClose} />
      <p style={{ color: 'var(--mut)', marginBottom: 14 }}>
        Thermal receipt is ready for printing. Click below to print.
      </p>
      <div className="acts">
        <button className="btn btn-ghost" onClick={onClose}>New Sale</button>
        <button className="btn" onClick={handlePrint}>🖨 Print Bill</button>
      </div>
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <button
          className="lk"
          onClick={handlePrint}
          style={{ fontSize: 12 }}
        >
          Re-open receipt in popup
        </button>
      </div>
    </Modal>
  );
}

// ─── Main Billing Cockpit Page ──────────────────────────────────────────────

export function BillingPage() {
  const cart = useCartStore();
  const qc = useQueryClient();
  const { toast, show: showToast } = useToast();
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState('');
  const [narcoticModalOpen, setNarcoticModalOpen] = useState(false);
  const [mobileBillSheetOpen, setMobileBillSheetOpen] = useState(false);

  // Global F9 hotkey to commit sale
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F9') { e.preventDefault(); handleCommit(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const executeCommit = async (narcoticDetails?: any) => {
    if (cart.items.length === 0 || committing) return;
    setError('');
    setCommitting(true);

    try {
      // Use idempotent clientRequestId from cartStore
      const reqId = cart.ensureClientRequestId();

      const res = await api.post('/sales', {
        clientRequestId: reqId,
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
        narcoticDetails: narcoticDetails || undefined,
      });

      const sale = res.data.data;
      setLastSaleId(sale._id);
      cart.clear();
      setNarcoticModalOpen(false);
      setMobileBillSheetOpen(false);
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      sounds.success();
      showToast(`✅ Bill ${sale.invoiceNo} committed`);
    } catch (err: any) {
      sounds.warn();
      setError(err.response?.data?.error?.message ?? 'Sale failed');
    } finally {
      setCommitting(false);
    }
  };

  const handleCommit = () => {
    if (cart.items.length === 0 || committing) return;
    const hasNarcotic = cart.items.some((i) => i.prescriptionType === 'controlled_narcotic');
    if (hasNarcotic) {
      setNarcoticModalOpen(true);
      return;
    }
    executeCommit();
  };

  return (
    <div style={{ height: '100%', minHeight: 0 }}>
      {/* Two-Pane POS Cockpit Grid */}
      <div className="pos-cockpit">
        {/* Left Pane: Customer selection, Fast Search & Quick Catalog */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>🏥 Point of Sale</h3>
            <div style={{ fontSize: 12, color: 'var(--mut)' }}>
              <kbd style={{ padding: '2px 6px', background: 'var(--gh)', borderRadius: 4, border: '1px solid var(--bd)' }}>F2</kbd> Search · <kbd style={{ padding: '2px 6px', background: 'var(--gh)', borderRadius: 4, border: '1px solid var(--bd)' }}>F9</kbd> Commit
            </div>
          </div>

          <CustomerPicker />
          <MedicineSearch />

          {error && (
            <div style={{
              background: 'var(--status-expired-bg)', color: 'var(--status-expired)',
              borderRadius: 8, padding: '8px 12px', fontWeight: 600, fontSize: 13,
            }}>
              ⚠ {error}
            </div>
          )}

          {/* Useful Quick Tips Card */}
          <div className="card" style={{ padding: 14, marginTop: 'auto', background: 'rgba(12, 58, 43, 0.02)' }}>
            <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--pine)', marginBottom: 4 }}>
              💡 POS Keyboard Shortcuts
            </div>
            <div style={{ fontSize: 12, color: 'var(--mut)', lineHeight: 1.5 }}>
              • Press <b>F2</b> anytime to jump focus directly to medicine search.<br />
              • Batches marked <span className="fefo-badge">⭐ FEFO 1st</span> are closest to expiry and should be dispensed first.<br />
              • Press <b>F9</b> to instantly finalize and commit bill.
            </div>
          </div>
        </div>

        {/* Right Pane: Pinned Till Receipt */}
        <TillReceiptPanel onCommit={handleCommit} />
      </div>

      {/* Mobile Floating Bill Sheet Trigger */}
      {cart.items.length > 0 && (
        <div
          className="floating-bill-bar"
          onClick={() => setMobileBillSheetOpen(true)}
          title="Tap to review bill and pay"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🛒</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {cart.items.length} {cart.items.length === 1 ? 'item' : 'items'} in bill
              </div>
              <small style={{ color: '#C5E2D5', margin: 0 }}>Tap to review & pay</small>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{fmt(cart.total())}</div>
            <div style={{ fontSize: 11, color: '#C5E2D5' }}>Review Bill ➔</div>
          </div>
        </div>
      )}

      {/* Mobile Till Sheet Modal */}
      {mobileBillSheetOpen && (
        <Modal open={mobileBillSheetOpen} onClose={() => setMobileBillSheetOpen(false)} maxWidth={500}>
          <ModalHeader title="🛒 Current Bill" onClose={() => setMobileBillSheetOpen(false)} />
          <TillReceiptPanel onCommit={handleCommit} />
        </Modal>
      )}

      {/* Thermal Bill Modal */}
      <BillModal saleId={lastSaleId} onClose={() => setLastSaleId(null)} />

      {/* Form-9 Narcotic Verification Modal */}
      <NarcoticModal
        open={narcoticModalOpen}
        onClose={() => setNarcoticModalOpen(false)}
        defaultPatientName={cart.customerName ?? ''}
        controlledItems={cart.items
          .filter((i) => i.prescriptionType === 'controlled_narcotic')
          .map((i) => i.name)}
        onConfirm={(details) => executeCommit(details)}
      />

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}
