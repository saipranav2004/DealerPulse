import { describe, expect, it } from 'vitest';

import {
  EM_DASH,
  formatCompactNumber,
  formatCurrency,
  formatCurrencyExact,
  formatDurationDays,
  formatDurationHours,
  formatMonthKey,
  formatNumber,
  formatPercentValue,
  formatRate,
  formatSignedPercent,
} from '@/lib/format';

describe('formatCurrency — Indian lakh/crore', () => {
  it('renders crore for values of ₹1,00,00,000 and above', () => {
    expect(formatCurrency(388_760_000)).toBe('₹38.88 Cr');
    expect(formatCurrency(151_540_000)).toBe('₹15.15 Cr');
    expect(formatCurrency(696_510_000)).toBe('₹69.65 Cr');
    expect(formatCurrency(3_130_141_531)).toBe('₹313.01 Cr');
    expect(formatCurrency(85_860_000)).toBe('₹8.59 Cr');
    expect(formatCurrency(10_000_000)).toBe('₹1.00 Cr');
  });

  it('renders lakh between ₹1,00,000 and ₹1,00,00,000', () => {
    expect(formatCurrency(2_499_714.29)).toBe('₹25.00 L');
    expect(formatCurrency(2_207_700)).toBe('₹22.08 L');
    expect(formatCurrency(100_000)).toBe('₹1.00 L');
  });

  it('renders exact rupees below a lakh', () => {
    expect(formatCurrency(42_000)).toBe('₹42,000');
    expect(formatCurrency(0)).toBe('₹0');
  });

  it('never uses dollar, million or billion notation', () => {
    for (const value of [1e3, 1e5, 1e7, 1e9]) {
      const formatted = formatCurrency(value);
      expect(formatted).toContain('₹');
      expect(formatted).not.toMatch(/[$]|\bM\b|\bB\b/);
    }
  });

  it('handles negative values', () => {
    expect(formatCurrency(-15_154_000)).toBe('₹-1.52 Cr');
  });
});

describe('formatCurrencyExact — Indian digit grouping', () => {
  it('groups in the 2,2,3 pattern', () => {
    expect(formatCurrencyExact(750_000)).toBe('₹7,50,000');
    expect(formatCurrencyExact(5_600_000)).toBe('₹56,00,000');
    expect(formatCurrencyExact(100)).toBe('₹100');
    expect(formatCurrencyExact(1_000)).toBe('₹1,000');
    expect(formatCurrencyExact(10_000_000)).toBe('₹1,00,00,000');
  });
});

describe('formatNumber and formatCompactNumber', () => {
  it('groups counts Indian-style', () => {
    expect(formatNumber(1426)).toBe('1,426');
    expect(formatNumber(510)).toBe('510');
  });

  it('compacts large counts with Indian magnitudes', () => {
    expect(formatCompactNumber(1_426)).toBe('1.4K');
    expect(formatCompactNumber(510)).toBe('510');
    expect(formatCompactNumber(250_000)).toBe('2.5 L');
    expect(formatCompactNumber(12_000_000)).toBe('1.2 Cr');
  });
});

describe('formatRate — the low-n guard at the display layer', () => {
  it('renders a percentage for a rate that met the minimum denominator', () => {
    expect(formatRate({ value: 0.3137, reason: null, n: 510 })).toBe('31.4%');
    expect(formatRate({ value: 0.582, reason: null, n: 79 }, 0)).toBe('58%');
  });

  it('renders a placeholder for a suppressed rate, never 0%', () => {
    expect(formatRate({ value: null, reason: 'insufficient_data', n: 0 })).toBe(EM_DASH);
    expect(formatRate({ value: null, reason: 'insufficient_data', n: 4 })).toBe(EM_DASH);
  });

  it('formats a bare fraction', () => {
    expect(formatPercentValue(0.457)).toBe('45.7%');
  });
});

describe('formatSignedPercent', () => {
  it('signs positive movement and leaves negatives as-is', () => {
    expect(formatSignedPercent(0.125)).toBe('+12.5%');
    expect(formatSignedPercent(-0.03)).toBe('-3.0%');
    expect(formatSignedPercent(0)).toBe('0.0%');
  });

  it('renders a placeholder when there is no comparison', () => {
    expect(formatSignedPercent(null)).toBe(EM_DASH);
  });
});

describe('duration formatters', () => {
  it('formats whole days with correct pluralisation', () => {
    expect(formatDurationDays(195)).toBe('195 days');
    expect(formatDurationDays(1)).toBe('1 day');
    expect(formatDurationDays(0)).toBe('0 days');
  });

  it('formats hours and promotes to days past two days', () => {
    expect(formatDurationHours(18)).toBe('18 hours');
    expect(formatDurationHours(1)).toBe('1 hour');
    expect(formatDurationHours(72)).toBe('3 days');
  });
});

describe('formatMonthKey', () => {
  it('renders a month key for display', () => {
    expect(formatMonthKey('2025-06')).toBe('Jun 2025');
    expect(formatMonthKey('2025-12')).toBe('Dec 2025');
  });
});
