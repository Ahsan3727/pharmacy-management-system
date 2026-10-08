import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Modal, ModalHeader } from '../components/Modal';
import { Toast, useToast } from '../components/Toast';
import { BarcodeLabelModal, BarcodeLabelData } from '../components/BarcodeLabelModal';
import { fmt, fmtQty, fmtMmYy, daysUntil, expiryClass } from '../lib/fmt';

const CATEGORIES = [
  'Antibiotics & Anti-infectives',
  'Cardiovascular & Antihypertensives',
  'Analgesics & Pain Relief (NSAIDs)',
  'Gastrointestinal & Antacids',
  'Antidiabetic & Endocrinology',
  'Respiratory & Anti-allergic',
  'Dermatology & Topicals',
  'Neurology & Psychiatric',
  'Vitamins, Minerals & Supplements',
  'Ophthalmic & Otic (Eye/Ear)',
  'Women Health & Hormones',
  'Medical Devices & Surgical',
  'General & Other',
];

const STORAGE_OPTIONS = [
  { value: 'room_temperature', label: '🌡️ Room Temp (15–25°C)' },
  { value: 'cold_chain_2_8', label: '❄️ Cold Chain / Refrigerator (2–8°C)' },
  { value: 'cool_below_20', label: '🍃 Cool Place (<20°C)' },
  { value: 'protect_from_light', label: '🕶️ Protect from Direct Light' },
];

function AddMedicineModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast, show } = useToast();

  const [form, setForm] = useState({
    name: '',
    genericName: '',
    strength: '',
    form: 'Tablet',
    company: '',
    category: 'General & Other',
    storageCondition: 'room_temperature',
    prescriptionType: 'otc',
    packSize: 10,
    packsPerBox: 10,
    looseUnit: 'tab',
    packUnit: 'strip',
    minStock: 20,
    rack: '',
    barcodes: '',
    isControlled: false,
    gstRateBP: 0,
  });

  const [hasOpeningStock, setHasOpeningStock] = useState(true);
  const [stockForm, setStockForm] = useState({
    batchNo: '',
    expiry: '',
    packs: 10,
    purchasePriceRs: '',
    salePriceRs: '',
    mrpRs: '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const setStock = (k: string, v: any) => setStockForm((f) => ({ ...f, [k]: v }));

  // Live calculations for opening stock
  const pCost = parseFloat(stockForm.purchasePriceRs) || 0;
  const pSale = parseFloat(stockForm.salePriceRs) || 0;
  const pMrp = parseFloat(stockForm.mrpRs) || pSale;
  const totalBaseUnits = hasOpeningStock ? (stockForm.packs || 0) * (form.packSize || 1) : 0;
  const unitCostRs = form.packSize > 0 ? pCost / form.packSize : 0;
  const unitSaleRs = form.packSize > 0 ? pSale / form.packSize : 0;
  const marginPct = pSale > 0 ? (((pSale - pCost) / pSale) * 100).toFixed(1) : '0';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (hasOpeningStock) {
      if (!stockForm.batchNo.trim()) {
        setError('Batch number is required for opening stock');
        return;
      }
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(stockForm.expiry)) {
        setError('Expiry date must be in MM/YY format (e.g. 12/27)');
        return;
      }
      if (pSale < pCost) {
        if (!confirm('Sale price is less than purchase cost (selling at a loss). Continue?')) return;
      }
      if (pMrp > 0 && pSale > pMrp) {
        setError('Sale price cannot exceed MRP by law.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload: any = {
        ...form,
        isControlled: form.prescriptionType === 'controlled_narcotic',
        barcodes: form.barcodes.split(',').map((s) => s.trim()).filter(Boolean),
      };

      if (hasOpeningStock) {
        payload.openingStock = {
          batchNo: stockForm.batchNo.trim().toUpperCase(),
          expiry: stockForm.expiry.trim(),
          packs: Math.max(1, stockForm.packs),
          purchasePricePerPack: Math.round(pCost * 100),
          salePricePerPack: Math.round(pSale * 100),
          mrpPerPack: Math.round(pMrp * 100),
        };
      }

      await api.post('/medicines', payload);
      qc.invalidateQueries({ queryKey: ['medicines'] });
      show(hasOpeningStock ? `✅ Medicine added with ${stockForm.packs} packs in stock!` : '✅ Medicine added to master catalog');
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Failed to save medicine');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth={680}>
      <ModalHeader title="💊 Add Medicine & Stock Intake" onClose={onClose} />
      <form onSubmit={handleSave} style={{ display: 'grid', gap: 14 }}>
        {/* Section 1: Identification */}
        <div style={{ background: 'var(--bg-card, rgba(255,255,255,0.03))', padding: 12, borderRadius: 8, border: '1px solid var(--bd)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--mut)', marginBottom: 8 }}>
            1. Master Details & Clinical Classification
          </div>
          <div className="f3">
            <label>
              BRAND NAME *
              <input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Augmentin" />
            </label>
            <label>
              GENERIC SALT *
              <input required value={form.genericName} onChange={(e) => set('genericName', e.target.value)} placeholder="Amoxicillin + Clavulanate" />
            </label>
            <label>
              STRENGTH
              <input value={form.strength} onChange={(e) => set('strength', e.target.value)} placeholder="625mg" />
            </label>
            <label>
              DOSAGE FORM
              <input value={form.form} onChange={(e) => set('form', e.target.value)} placeholder="Tablet / Syrup / Injection" />
            </label>
            <label>
              MANUFACTURER / COMPANY
              <input value={form.company} onChange={(e) => set('company', e.target.value)} placeholder="GSK / Abbott / Getz" />
            </label>
            <label>
              SHELF RACK / LOCATION
              <input value={form.rack} onChange={(e) => set('rack', e.target.value)} placeholder="Rack A-12" />
            </label>
            <label style={{ gridColumn: 'span 2' }}>
              THERAPEUTIC CATEGORY
              <select value={form.category} onChange={(e) => set('category', e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>
              PRESCRIPTION SCHEDULE
              <select value={form.prescriptionType} onChange={(e) => set('prescriptionType', e.target.value)}>
                <option value="otc">OTC (Over the Counter)</option>
                <option value="rx_general">Rx (Prescription Required)</option>
                <option value="controlled_narcotic">⚠️ Schedule B/D Controlled Narcotic</option>
              </select>
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              STORAGE CONDITION & TEMPERATURE
              <select value={form.storageCondition} onChange={(e) => set('storageCondition', e.target.value)}>
                {STORAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>
        </div>

        {/* Section 2: Packaging Hierarchy */}
        <div style={{ background: 'var(--bg-card, rgba(255,255,255,0.03))', padding: 12, borderRadius: 8, border: '1px solid var(--bd)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--mut)', marginBottom: 8 }}>
            2. Packaging & Units of Measure (UOM)
          </div>
          <div className="f3">
            <label>
              PACK UNIT
              <select value={form.packUnit} onChange={(e) => set('packUnit', e.target.value)}>
                {['strip', 'bottle', 'tube', 'pack', 'box', 'vial'].map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
            <label>
              LOOSE DISPENSE UNIT
              <select value={form.looseUnit} onChange={(e) => set('looseUnit', e.target.value)}>
                {['tab', 'cap', 'ml', 'pc', 'sachet', 'amp', 'vial'].map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
            <label>
              PACK SIZE ({form.looseUnit}s per {form.packUnit}) *
              <input type="number" min={1} required value={form.packSize} onChange={(e) => set('packSize', parseInt(e.target.value) || 1)} />
            </label>
            <label>
              PACKS PER OUTER BOX
              <input type="number" min={1} value={form.packsPerBox} onChange={(e) => set('packsPerBox', parseInt(e.target.value) || 1)} />
            </label>
            <label>
              MIN STOCK ALERT ({form.looseUnit}s)
              <input type="number" min={0} value={form.minStock} onChange={(e) => set('minStock', parseInt(e.target.value) || 0)} />
            </label>
            <label>
              BARCODE(S)
              <input value={form.barcodes} onChange={(e) => set('barcodes', e.target.value)} placeholder="Scan or enter barcode" />
            </label>
          </div>
          {/* Packaging Formula Badge */}
          <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(56, 189, 248, 0.08)', borderRadius: 6, fontSize: 12, color: 'var(--br, #38bdf8)' }}>
            📦 <b>Packaging Formula:</b> 1 Outer Box = {form.packsPerBox} {form.packUnit}s = <b>{form.packsPerBox * form.packSize} {form.looseUnit}s</b>
          </div>
        </div>

        {/* Section 3: 1-Click Initial Opening Stock */}
        <div style={{
          background: hasOpeningStock ? 'rgba(34, 197, 94, 0.04)' : 'transparent',
          border: `1px solid ${hasOpeningStock ? 'rgba(34, 197, 94, 0.3)' : 'var(--bd)'}`,
          padding: 12,
          borderRadius: 8
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hasOpeningStock ? 10 : 0 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: hasOpeningStock ? 'var(--ok, #22c55e)' : 'inherit' }}>
                ⚡ 1-Click Opening Stock Intake
              </div>
              <small style={{ color: 'var(--mut)' }}>Create medicine + place initial physical batch directly on shelf for immediate POS sale</small>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={hasOpeningStock}
                onChange={(e) => setHasOpeningStock(e.target.checked)}
                style={{ width: 'auto', margin: 0 }}
              />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Enable Stock Intake</span>
            </label>
          </div>

          {hasOpeningStock && (
            <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
              <div className="f3">
                <label>
                  BATCH NO. *
                  <input
                    required={hasOpeningStock}
                    value={stockForm.batchNo}
                    onChange={(e) => setStock('batchNo', e.target.value.toUpperCase())}
                    placeholder="AUG204"
                    style={{ textTransform: 'uppercase' }}
                  />
                </label>
                <label>
                  EXPIRY (MM/YY) *
                  <input
                    required={hasOpeningStock}
                    value={stockForm.expiry}
                    onChange={(e) => setStock('expiry', e.target.value)}
                    placeholder="12/27"
                    maxLength={5}
                  />
                </label>
                <label>
                  PACKS ON SHELF *
                  <input
                    type="number"
                    min={1}
                    required={hasOpeningStock}
                    value={stockForm.packs}
                    onChange={(e) => setStock('packs', parseInt(e.target.value) || 1)}
                  />
                </label>
                <label>
                  PURCHASE COST / PACK (Rs) *
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    required={hasOpeningStock}
                    value={stockForm.purchasePriceRs}
                    onChange={(e) => setStock('purchasePriceRs', e.target.value)}
                    placeholder="250.00"
                  />
                </label>
                <label>
                  RETAIL SALE / PACK (Rs) *
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    required={hasOpeningStock}
                    value={stockForm.salePriceRs}
                    onChange={(e) => setStock('salePriceRs', e.target.value)}
                    placeholder="300.00"
                  />
                </label>
                <label>
                  PRINTED MRP / PACK (Rs)
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={stockForm.mrpRs}
                    onChange={(e) => setStock('mrpRs', e.target.value)}
                    placeholder="300.00"
                  />
                </label>
              </div>

              {/* Financial Metrics Strip */}
              {pSale > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.04)',
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 12
                }}>
                  <span>Total Sellable Units: <b>{totalBaseUnits} {form.looseUnit}s</b></span>
                  <span>Loose Unit Sale: <b>Rs {unitSaleRs.toFixed(2)}</b> / {form.looseUnit}</span>
                  <span>Loose Cost: <b>Rs {unitCostRs.toFixed(2)}</b> / {form.looseUnit}</span>
                  <span className="pill ok" style={{ fontWeight: 700 }}>Margin: {marginPct}%</span>
                </div>
              )}
            </div>
          )}
        </div>

        {error && <p style={{ color: 'var(--er)', fontWeight: 600, margin: 0 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Saving…' : hasOpeningStock ? '⚡ Add Medicine & Stock' : 'Add Medicine Only'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function MedicinesPage() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [coldChainOnly, setColdChainOnly] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [labelTarget, setLabelTarget] = useState<BarcodeLabelData | null>(null);
  const { toast, show: showToast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['medicines', 'list'],
    queryFn: async () => (await api.get('/medicines', { params: { limit: 200 } })).data.data,
    staleTime: 60000,
  });

  const medicines: any[] = data?.items ?? [];
  const filtered = medicines.filter((m) => {
    const matchSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.genericName.toLowerCase().includes(search.toLowerCase()) ||
      (m.company ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (m.category ?? '').toLowerCase().includes(search.toLowerCase());

    const matchCategory = selectedCategory === 'ALL' || m.category === selectedCategory;
    const matchColdChain = !coldChainOnly || m.storageCondition === 'cold_chain_2_8';

    return matchSearch && matchCategory && matchColdChain;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>💊 Medicine Master & Stock</h3>
          <small style={{ color: 'var(--mut)' }}>Central catalog, packaging specs, storage conditions and shelf inventory</small>
        </div>
        <button className="btn" onClick={() => setAddOpen(true)}>+ Add Medicine & Stock</button>
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="sw" style={{ flex: 1, minWidth: 240, margin: 0 }}>
          <input
            type="search"
            placeholder="Search by brand, generic salt, company, category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ borderRadius: 8 }}
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{ width: 'auto', minWidth: 200, borderRadius: 8, height: 38 }}
        >
          <option value="ALL">All Therapeutic Classes</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <button
          className={coldChainOnly ? 'btn' : 'btn btn-ghost'}
          onClick={() => setColdChainOnly((v) => !v)}
          style={{ height: 38, fontSize: 12 }}
        >
          ❄️ Cold Chain Only
        </button>
      </div>

      <div className="gw">
        <table className="gt">
          <thead>
            <tr>
              <th>Medicine / Salt</th>
              <th>Category</th>
              <th>Packaging Hierarchy</th>
              <th>Shelf Location</th>
              <th className="r">Stock on Shelf</th>
              <th className="r">Pack Price</th>
              <th>Safety Flags</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>Loading medicine catalog…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--mut)' }}>
                {search || selectedCategory !== 'ALL' || coldChainOnly
                  ? 'No medicines match the selected filters.'
                  : 'No medicines in catalog yet. Click "+ Add Medicine & Stock" to begin!'}
              </td></tr>
            ) : (
              filtered.map((m) => {
                const stock = m.totalStock ?? 0;
                const isOutOfStock = stock === 0;
                const isLowStock = stock > 0 && stock <= m.minStock;

                return (
                  <tr key={m._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <b>{m.name}</b>
                        {m.strength && <span style={{ color: 'var(--mut)', fontSize: 12 }}>{m.strength}</span>}
                        {m.form && <small style={{ opacity: 0.7 }}>· {m.form}</small>}
                      </div>
                      <small style={{ color: 'var(--mut)' }}>{m.genericName} · {m.company ?? '–'}</small>
                    </td>

                    <td>
                      <span className="pill" style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)' }}>
                        {m.category || 'General'}
                      </span>
                    </td>

                    <td>
                      <div>{m.packSize} {m.looseUnit}s / {m.packUnit}</div>
                      {m.packsPerBox > 1 && (
                        <small style={{ color: 'var(--mut)' }}>{m.packsPerBox} {m.packUnit}s / box</small>
                      )}
                    </td>

                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{m.rack ?? '–'}</span>
                    </td>

                    <td className="r">
                      <div>
                        {isOutOfStock ? (
                          <span className="pill er" style={{ fontWeight: 700 }}>0 Out of Stock</span>
                        ) : isLowStock ? (
                          <span className="pill wn" style={{ fontWeight: 700 }}>{stock} {m.looseUnit}s (Low)</span>
                        ) : (
                          <span className="pill ok" style={{ fontWeight: 700 }}>{stock} {m.looseUnit}s</span>
                        )}
                      </div>
                      {!isOutOfStock && (
                        <small style={{ color: 'var(--mut)' }}>
                          {fmtQty(stock, m.packSize, m.packUnit, m.looseUnit)}
                        </small>
                      )}
                    </td>

                    <td className="r">
                      {m.salePricePerPack ? (
                        <div>
                          <b>{fmt(m.salePricePerPack)}</b>
                          <small style={{ display: 'block', color: 'var(--mut)' }}>
                            {fmt(Math.round(m.salePricePerPack / m.packSize))}/{m.looseUnit}
                          </small>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--mut)' }}>–</span>
                      )}
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {m.storageCondition === 'cold_chain_2_8' && (
                          <span
                            className="pill"
                            title="2–8°C Refrigerator (Insulin / Vaccine)"
                            style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#0284c7', fontSize: 10, fontWeight: 700 }}
                          >
                            ❄️ 2–8°C
                          </span>
                        )}
                        {(m.prescriptionType === 'controlled_narcotic' || m.isControlled) && (
                          <span className="pill wn" style={{ fontSize: 10, fontWeight: 700 }} title="Controlled Drug">
                            Rx
                          </span>
                        )}
                        {m.barcodes?.length > 0 && (
                          <span className="pill" style={{ fontSize: 10 }} title={`Barcodes: ${m.barcodes.join(', ')}`}>
                            📷
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 11, padding: '3px 8px' }}
                        title="Generate thermal barcode label"
                        onClick={() =>
                          setLabelTarget({
                            medicineName: m.name,
                            strength: m.strength,
                            genericName: m.genericName,
                            pricePerPack: m.salePricePerPack,
                            rack: m.rack,
                            barcode: m.barcodes?.[0] || m.barcode,
                            company: m.company,
                          })
                        }
                      >
                        🏷️ Label
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AddMedicineModal open={addOpen} onClose={() => setAddOpen(false)} />
      {labelTarget && (
        <BarcodeLabelModal
          open={!!labelTarget}
          item={labelTarget}
          onClose={() => setLabelTarget(null)}
        />
      )}
      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}
