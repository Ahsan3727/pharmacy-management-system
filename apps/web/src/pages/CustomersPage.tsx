import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Modal, ModalHeader } from '../components/Modal';
import { Toast, useToast } from '../components/Toast';
import { fmt, fmtDate } from '../lib/fmt';

function CustomerLedgerModal({ customer, onClose }: { customer: any; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const qc = useQueryClient();
  const { show } = useToast();

  const { data: ledger } = useQuery({
    queryKey: ['ledger', customer._id],
    queryFn: async () => (await api.get(`/customers/${customer._id}/ledger`)).data.data,
  });

  const entries: any[] = ledger?.entries ?? [];

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPaying(true);
    try {
      await api.post(`/customers/${customer._id}/payments`, {
        amount: Math.round(parseFloat(amount) * 100),
        method,
        note,
      });
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['ledger', customer._id] });
      show('✅ Payment recorded');
      setAmount('');
      setNote('');
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Failed');
    } finally {
      setPaying(false);
    }
  };

  return (
    <Modal open onClose={onClose} maxWidth={620}>
      <ModalHeader title={`${customer.name} — Ledger`} onClose={onClose} />
      <div style={{ display: 'grid', gap: 14 }}>
        {/* Balance summary */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="k s" style={{ flex: 1 }}>
            <small>Balance</small>
            <b style={{ color: customer.balance > 0 ? 'var(--er)' : 'var(--ok)' }}>{fmt(customer.balance)}</b>
          </div>
          <div className="k s" style={{ flex: 1 }}>
            <small>Credit Limit</small>
            <b>{fmt(customer.creditLimit)}</b>
          </div>
        </div>

        {/* Payment form */}
        {customer.balance > 0 && (
          <form onSubmit={handlePayment} style={{ background: 'var(--okb)', borderRadius: 10, padding: 12, display: 'grid', gap: 8 }}>
            <h4>Receive Payment</h4>
            <div className="f3">
              <label>AMOUNT (Rs) *<input type="number" step="0.01" min={0.01} required value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
              <label>METHOD
                <select value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="transfer">Transfer</option>
                </select>
              </label>
              <label style={{ gridColumn: '1 / -1' }}>NOTE<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
            </div>
            {error && <p style={{ color: 'var(--er)', fontWeight: 600 }}>{error}</p>}
            <button type="submit" className="btn" disabled={paying}>{paying ? 'Recording…' : 'Record Payment'}</button>
          </form>
        )}

        {/* Ledger entries */}
        <div className="gw" style={{ maxHeight: 350 }}>
          <table className="gt mini">
            <thead>
              <tr><th>Date</th><th>Type</th><th>Note</th><th className="r">Amount</th></tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: 'var(--mut)' }}>No entries</td></tr>
              ) : (
                entries.map((e) => (
                  <tr key={e._id}>
                    <td>{e.date}</td>
                    <td><span className={`pill ${e.amount > 0 ? 'wn' : 'ok'}`}>{e.type}</span></td>
                    <td>{e.note ?? e.refId}</td>
                    <td className="r" style={{ color: e.amount > 0 ? 'var(--er)' : 'var(--ok)', fontWeight: 600 }}>
                      {e.amount > 0 ? '+' : ''}{fmt(e.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

export function CustomersPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const { toast, show } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', phone: '', address: '', creditLimit: '' });
  const [saving, setSaving] = useState(false);

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => (await api.get('/customers')).data.data,
    staleTime: 30000,
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/customers', {
        ...form,
        creditLimit: Math.round(parseFloat(form.creditLimit || '0') * 100),
      });
      qc.invalidateQueries({ queryKey: ['customers'] });
      show('✅ Customer added');
      setAddOpen(false);
      setForm({ name: '', phone: '', address: '', creditLimit: '' });
    } catch (err: any) {
      alert(err.response?.data?.error?.message ?? 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3>👤 Customers & Udhaar</h3>
        <button className="btn" onClick={() => setAddOpen(true)}>+ Add Customer</button>
      </div>

      <div className="gw">
        <table className="gt">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th className="r">Balance</th>
              <th className="r">Limit</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>Loading…</td></tr>
            ) : (customers ?? []).length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>No customers yet</td></tr>
            ) : (
              (customers ?? []).map((c: any) => (
                <tr key={c._id} onClick={() => setSelected(c)}>
                  <td><b>{c.name}</b></td>
                  <td style={{ color: 'var(--mut)' }}>{c.phone ?? '–'}</td>
                  <td className="r">
                    {c.balance > 0
                      ? <span className="pill er">{fmt(c.balance)}</span>
                      : <span style={{ color: 'var(--ok)', fontWeight: 600 }}>✅ Paid</span>
                    }
                  </td>
                  <td className="r" style={{ color: 'var(--mut)' }}>{fmt(c.creditLimit)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add customer modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)}>
        <ModalHeader title="Add Customer" onClose={() => setAddOpen(false)} />
        <form onSubmit={handleAdd} style={{ display: 'grid', gap: 10 }}>
          <label>NAME *<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>PHONE<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label>ADDRESS<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
          <label>CREDIT LIMIT (Rs)<input type="number" step="0.01" min={0} value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} placeholder="5000" /></label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
            <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Add Customer'}</button>
          </div>
        </form>
      </Modal>

      {selected && <CustomerLedgerModal customer={selected} onClose={() => setSelected(null)} />}
      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}
