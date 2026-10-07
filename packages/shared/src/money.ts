// ─── Money helpers ───────────────────────────────────────────────────────────
// ALL money is stored as integers in the smallest currency unit (paisa).
// Rs 10.00 = 1000 paisa.  NEVER use floats.

export type Money = number; // integer, always in paisa

/** Multiply then divide with integer rounding. Core of all loose-unit pricing. */
export const mulDiv = (a: number, b: number, c: number): Money =>
  Math.round((a * b) / c);

/** Percentage via basis points. 10% = 1000 bp. */
export const pct = (amount: Money, bp: number): Money =>
  Math.round((amount * bp) / 10000);

/** Price for selling qtyBase loose units from a pack priced at packPrice. */
export const loosePrice = (
  qtyBase: number,
  packPrice: Money,
  packSize: number
): Money => mulDiv(qtyBase, packPrice, packSize);

/** Round to nearest Rs 100 (the roundOff on bills). */
export const roundToHundred = (amount: Money): Money =>
  Math.round(amount / 100) * 100;

/** Display: 150000 paisa → "Rs 1,500.00" */
export const formatMoney = (paisa: Money): string =>
  'Rs ' +
  (paisa / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function assertMoney(n: number): asserts n is Money {
  if (!Number.isSafeInteger(n))
    throw new Error(`Money must be a safe integer (paisa), got: ${n}`);
}
