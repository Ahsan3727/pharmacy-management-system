import { describe, it, expect } from 'vitest';
import { mulDiv, pct, loosePrice, roundToHundred, formatMoney } from '@hs-pharma/shared';

describe('Financial Math & Paisa Integer Engine', () => {
  it('mulDiv performs integer rounding without floating precision loss', () => {
    // 3 units from pack of 10 at Rs 15.00 (1500 paisa)
    expect(mulDiv(3, 1500, 10)).toBe(450); // 450 paisa = Rs 4.50
    // Loose calculation with rounding
    expect(mulDiv(1, 100, 3)).toBe(33); // 33.333... rounded to 33 paisa
  });

  it('pct calculates basis points correctly', () => {
    // 10% discount on Rs 1000.00 (100000 paisa) with 1000 BP
    expect(pct(100000, 1000)).toBe(10000); // 10000 paisa = Rs 100.00
    // 5% discount (500 BP) on Rs 250.00 (25000 paisa)
    expect(pct(25000, 500)).toBe(1250);
  });

  it('loosePrice calculates proportional pack pricing', () => {
    expect(loosePrice(2, 2000, 10)).toBe(400); // 2 tabs from 10-tab pack at Rs 20
  });

  it('roundToHundred rounds bill totals to nearest Rupee (100 paisa)', () => {
    expect(roundToHundred(12340)).toBe(12300);
    expect(roundToHundred(12360)).toBe(12400);
    expect(roundToHundred(12350)).toBe(12400);
  });

  it('formatMoney formats integer paisa to Indian Rupee notation', () => {
    expect(formatMoney(150000)).toBe('Rs 1,500.00');
    expect(formatMoney(50)).toBe('Rs 0.50');
  });
});
