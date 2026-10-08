/**
 * Date utilities for the pharmacy system.
 * - All dates stored in UTC in MongoDB
 * - Expiry dates stored as the LAST DAY of the entered month
 * - Display in shop timezone (Asia/Karachi)
 */

const TIMEZONE = process.env.TZ || 'Asia/Karachi';

/** Today's date string in YYYY-MM-DD (UTC) */
export const todayUtc = (): string => new Date().toISOString().slice(0, 10);

/** Convert MM/YY expiry input to the last day of that month (ISO date string) */
export function expiryToDate(mmyy: string): string {
  const match = mmyy.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
  if (!match) throw new Error('Expiry must be MM/YY');
  const month = parseInt(match[1], 10);
  const year = 2000 + parseInt(match[2], 10);
  // Last day of the month: set month to next month, day 0
  const d = new Date(Date.UTC(year, month, 0));
  return d.toISOString().slice(0, 10);
}

/** Format date for display: YYYY-MM-DD or Date → DD/MM/YY */
export const formatDate = (iso: string | Date): string => {
  const str = typeof iso === 'string' ? iso.slice(0, 10) : iso.toISOString().slice(0, 10);
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y.slice(2)}`;
};

/** MM/YY display from ISO date string */
export const formatMmYy = (iso: string | Date): string => {
  const d = typeof iso === 'string' ? iso : iso.toISOString();
  return `${d.slice(5, 7)}/${d.slice(2, 4)}`;
};

/** Days until expiry (negative = already expired) */
export const daysUntilExpiry = (expiryDate: string | Date): number => {
  const expiry = typeof expiryDate === 'string' ? expiryDate : expiryDate.toISOString().slice(0, 10);
  const today = todayUtc();
  return Math.round((Date.parse(expiry) - Date.parse(today)) / 86400000);
};
