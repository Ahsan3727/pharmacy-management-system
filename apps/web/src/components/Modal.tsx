import React from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
}

export function Modal({ open, onClose, children, maxWidth = 500 }: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="rcw"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal
    >
      <div className="rcb" style={{ maxWidth }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      <button className="x" onClick={onClose} aria-label="Close">✕</button>
    </div>
  );
}
