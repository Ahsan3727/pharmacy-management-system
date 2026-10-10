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

export function ConfirmModal({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} maxWidth={420}>
      <ModalHeader title={title} onClose={onClose} />
      <p style={{ color: 'var(--ink)', fontSize: 14, margin: '8px 0 18px', lineHeight: 1.5 }}>
        {message}
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          {cancelText}
        </button>
        <button
          type="button"
          className="btn"
          style={danger ? { background: 'var(--er, #b91c1c)', borderColor: 'var(--er, #b91c1c)' } : undefined}
          onClick={() => {
            onConfirm();
            onClose();
          }}
          autoFocus
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}

export function PromptModal({
  open,
  title,
  message,
  placeholder = '',
  defaultValue = '',
  confirmText = 'Submit',
  cancelText = 'Cancel',
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (val: string) => void;
  onClose: () => void;
}) {
  const [val, setVal] = React.useState(defaultValue);

  React.useEffect(() => {
    if (open) setVal(defaultValue);
  }, [open, defaultValue]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!val.trim()) return;
    onConfirm(val.trim());
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth={440}>
      <ModalHeader title={title} onClose={onClose} />
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
        {message && (
          <p style={{ color: 'var(--mut)', fontSize: 13, margin: 0, lineHeight: 1.4 }}>
            {message}
          </p>
        )}
        <input
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={placeholder}
          autoFocus
          required
          style={{ width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8 }}
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {cancelText}
          </button>
          <button type="submit" className="btn" disabled={!val.trim()}>
            {confirmText}
          </button>
        </div>
      </form>
    </Modal>
  );
}
