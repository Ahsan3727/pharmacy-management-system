import React, { useState } from 'react';
import { Modal, ModalHeader } from './Modal';

interface NarcoticModalProps {
  open: boolean;
  onClose: () => void;
  defaultPatientName?: string;
  controlledItems: string[];
  onConfirm: (details: {
    doctorName: string;
    doctorRegNo: string;
    patientCnic: string;
    patientName: string;
    prescriptionDate?: string;
    prescriptionSlipNo?: string;
  }) => void;
}

export function NarcoticModal({
  open,
  onClose,
  defaultPatientName = '',
  controlledItems,
  onConfirm,
}: NarcoticModalProps) {
  const [form, setForm] = useState({
    doctorName: '',
    doctorRegNo: '',
    patientCnic: '',
    patientName: defaultPatientName || '',
    prescriptionDate: new Date().toISOString().slice(0, 10),
    prescriptionSlipNo: '',
  });

  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.doctorName.trim()) {
      setError('Prescribing doctor name is required by law');
      return;
    }
    if (!form.doctorRegNo.trim()) {
      setError('Doctor PMDC / Medical Council registration number is required');
      return;
    }
    if (!form.patientCnic.trim()) {
      setError('Patient CNIC / National ID number is required');
      return;
    }
    if (!form.patientName.trim()) {
      setError('Patient name is required');
      return;
    }

    onConfirm({
      doctorName: form.doctorName.trim(),
      doctorRegNo: form.doctorRegNo.trim().toUpperCase(),
      patientCnic: form.patientCnic.trim(),
      patientName: form.patientName.trim(),
      prescriptionDate: form.prescriptionDate,
      prescriptionSlipNo: form.prescriptionSlipNo.trim() || undefined,
    });
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth={540}>
      <ModalHeader title="⚠️ Form-9 Controlled Drug Verification" onClose={onClose} />
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
        {/* Regulatory alert banner */}
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          padding: '10px 12px',
          borderRadius: 8,
          fontSize: 12
        }}>
          <b style={{ color: 'var(--er, #ef4444)' }}>DRAP / Drug Rules Compliance Alert:</b>
          <p style={{ margin: '4px 0 0', color: 'var(--mut)' }}>
            This sale contains regulated controlled/narcotic substances:
            <b style={{ color: 'inherit', marginLeft: 4 }}>{controlledItems.join(', ')}</b>.
            By statutory regulation, prescriber license and patient identity must be recorded into the official Form-9 register.
          </p>
        </div>

        <div className="f3">
          <label>
            PRESCRIBING DOCTOR *
            <input
              required
              value={form.doctorName}
              onChange={(e) => set('doctorName', e.target.value)}
              placeholder="Dr. Tariq Mahmood"
            />
          </label>

          <label>
            DOCTOR PMDC / REG. # *
            <input
              required
              value={form.doctorRegNo}
              onChange={(e) => set('doctorRegNo', e.target.value.toUpperCase())}
              placeholder="PMDC-48291-P"
            />
          </label>

          <label>
            PATIENT FULL NAME *
            <input
              required
              value={form.patientName}
              onChange={(e) => set('patientName', e.target.value)}
              placeholder="Patient Name"
            />
          </label>

          <label>
            PATIENT CNIC / ID *
            <input
              required
              value={form.patientCnic}
              onChange={(e) => set('patientCnic', e.target.value)}
              placeholder="35201-1234567-1"
            />
          </label>

          <label>
            PRESCRIPTION DATE *
            <input
              type="date"
              required
              value={form.prescriptionDate}
              onChange={(e) => set('prescriptionDate', e.target.value)}
            />
          </label>

          <label>
            SLIP / RX REF #
            <input
              value={form.prescriptionSlipNo}
              onChange={(e) => set('prescriptionSlipNo', e.target.value)}
              placeholder="RX-9821"
            />
          </label>
        </div>

        {error && <p style={{ color: 'var(--er)', fontWeight: 600, margin: 0 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" style={{ background: 'var(--er, #ef4444)' }}>
            Verify & Authorize Dispensing
          </button>
        </div>
      </form>
    </Modal>
  );
}
