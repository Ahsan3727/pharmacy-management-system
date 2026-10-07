import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Modal, ModalHeader } from '../components/Modal';
import { Toast, useToast } from '../components/Toast';
import { fmt, fmtMmYy, daysUntil, expiryClass } from '../lib/fmt';

function AddMedicineModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast, show } = useToast();
  const [form, setForm] = useState({
    name: '', genericName: '', strength: '', form: '', company: '',
    packSize: 10, looseUnit: 'tab', packUnit: 'strip', minStock: 0, rack: '',
    barcodes: '', isControlled: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/medicines', {
        ...form,
        barcodes: form.barcodes.split(',').map((s) => s.trim()).filter(Boolean),
      });
      qc.invalidateQueries({ queryKey: ['medicines'] });
      show('✅ Medicine added');
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth={560}>
      <ModalHeader title="Add New Medicine" onClose={onClose} />
      <form onSubmit={handleSave} style={{ display: 'grid', gap: 10 }}>
        <div className="f3">
          <label>BRAND NAME *<input required value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
          <label>GENERIC NAME *<input required value={form.genericName} onChange={(e) => set('genericName', e.target.value)} /></label>
          <label>STRENGTH<input value={form.strength} onChange={(e) => set('strength', e.target.value)} placeholder="500mg" /></label>
          <label>FORM<input value={form.form} onChange={(e) => set('form', e.target.value)} placeholder="Tablet" /></label>
          <label>COMPANY<input value={form.company} onChange={(e) => set('company', e.target.value)} /></label>
          <label>RACK<input value={form.rack} onChange={(e) => set('rack', e.target.value)} placeholder="A-12" /></label>
          <label>PACK SIZE *<input type="number" min={1} required value={form.packSize} onChange={(e) => set('packSize', parseInt(e.target.value))} /></label>
          <label>LOOSE UNIT
            <select value={form.looseUnit} onChange={(e) => set('looseUnit', e.target.value)}>
              {['tab', 'cap', 'ml', 'pc', 'sachet', 'amp', 'vial'].map((u) => <option key={u}>{u}</option>)}
            </select>
          </label>
          <label>PACK UNIT
            <select value={form.packUnit} onChange={(e) => set('packUnit', e.target.value)}>
              {['strip', 'bottle', 'tube', 'pack', 'box', 'vial'].map((u) => <option key={u}>{u}</option>)}
            </select>
          </label>
          <label>MIN STOCK (units)<input type="number" min={0} value={form.minStock} onChange={(e) => set('minStock', parseInt(e.target.value))} /></label>
          <label style={{ gridColumn: '1 / -1' }}>BARCODES (comma-separated)<input value={form.barcodes} onChange={(e) => set('barcodes', e.target.value)} placeholder="6000000001, 6000000002" /></label>
          <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.isControlled} onChange={(e) => set('isControlled', e.target.checked)} style={{ width: 'auto' }} />
            Controlled drug (requires prescription)
          </label>
        </div>
        {error && <p style={{ color: 'var(--er)', fontWeight: 600 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Add Medicine'}</button>
        </div>
      </form>
    </Modal>
  );
}

export function MedicinesPage() {
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const { toast, show: showToast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['medicines', 'list'],
    queryFn: async () => (await api.get('/medicines', { params: { limit: 200 } })).data.data,
    staleTime: 60000,
  });

  const medicines: any[] = data?.items ?? [];
  const filtered = medicines.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.genericName.toLowerCase().includes(search.toLowerCase()) ||
      (m.company ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3>💊 Medicine Master</h3>
        <button className="btn" onClick={() => setAddOpen(true)}>+ Add Medicine</button>
      </div>

      <div className="sw" style={{ marginBottom: 12 }}>
        <input
          type="search"
          placeholder="Search by name, generic, company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ borderRadius: 8 }}
        />
      </div>

      <div className="gw">
        <table className="gt">
          <thead>
            <tr>
              <th>Brand Name</th>
              <th>Generic</th>
              <th>Company</th>
              <th>Pack Size</th>
              <th>Rack</th>
              <th className="r">Min Stock</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>
                {search ? `No results for "${search}"` : 'No medicines yet. Add one!'}
              </td></tr>
            ) : (
              filtered.map((m) => (
                <tr key={m._id}>
                  <td>
                    <b>{m.name}</b>
                    {m.strength && <small>{m.strength}{m.form ? ` · ${m.form}` : ''}</small>}
                  </td>
                  <td style={{ color: 'var(--mut)' }}>{m.genericName}</td>
                  <td style={{ color: 'var(--mut)' }}>{m.company}</td>
                  <td>{m.packSize} {m.looseUnit}s / {m.packUnit}</td>
                  <td>{m.rack ?? '–'}</td>
                  <td className="r">{m.minStock}</td>
                  <td>
                    {m.isControlled && <span className="pill wn">Rx</span>}
                    {m.barcodes?.length > 0 && <span className="pill" style={{ marginLeft: 4 }}>📷</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddMedicineModal open={addOpen} onClose={() => setAddOpen(false)} />
      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}
