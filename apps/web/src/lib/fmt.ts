/** All money amounts are paisa (integer). Never floats. */
export const fmt = (paisa: number): string => {
  const isNeg = paisa < 0;
  const abs = Math.abs(paisa);
  const str = (abs / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (isNeg ? '-Rs ' : 'Rs ') + str;
};

export const fmtQty = (qty: number, packSize: number, packUnit: string, looseUnit: string): string => {
  const packs = Math.floor(qty / packSize);
  const loose = qty % packSize;
  const parts = [];
  if (packs) parts.push(`${packs} ${packUnit}${packs > 1 ? 's' : ''}`);
  if (loose) parts.push(`${loose} ${looseUnit}${loose > 1 ? 's' : ''}`);
  return parts.join(' + ') || `${qty}`;
};

export const fmtMmYy = (iso: string | Date): string => {
  const s = typeof iso === 'string' ? iso : iso.toISOString();
  return `${s.slice(5, 7)}/${s.slice(2, 4)}`;
};

export const fmtDate = (iso: string | Date): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtDateTime = (iso: string | Date): string => {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export const daysUntil = (iso: string | Date): number => {
  const exp = new Date(iso).getTime();
  const now = Date.now();
  return Math.round((exp - now) / 86400000);
};

export const expiryClass = (days: number, criticalDays = 30): 'ok' | 'wn' | 'er' => {
  if (days < 0) return 'er';
  if (days < criticalDays) return 'er';
  if (days < criticalDays * 3) return 'wn';
  return 'ok';
};

export const newClientRequestId = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
