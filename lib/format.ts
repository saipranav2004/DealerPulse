/**
 * The only place currency, counts and durations are turned into strings.
 * Nothing anywhere else formats currency inline.
 *
 * Currency is Indian throughout: lakh (₹1,00,000) and crore (₹1,00,00,000).
 * Never `$`, `M` or `B`.
 */

import type { Rate } from '@/lib/types';

const LAKH = 100_000;
const CRORE = 10_000_000;

/** Placeholder shown wherever a value is unavailable or suppressed. */
export const EM_DASH = '—';

/**
 * Indian digit grouping (2,2,3 from the right) without relying on ICU locale
 * data being present in the host runtime.
 */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3);
  const tail = digits.slice(-3);
  return `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${tail}`;
}

function formatFixed(value: number, decimals: number): string {
  const rounded = value.toFixed(decimals);
  const [whole, fraction] = rounded.split('.');
  const sign = whole.startsWith('-') ? '-' : '';
  const grouped = groupIndian(sign ? whole.slice(1) : whole);
  return `${sign}${grouped}${fraction ? `.${fraction}` : ''}`;
}

/**
 * Compact Indian currency: `₹38.88 Cr`, `₹24.99 L`, `₹42,000`.
 *
 * Values of one crore or more are expressed in crore, one lakh or more in
 * lakh, and anything smaller in exact rupees.
 */
export function formatCurrency(value: number, decimals = 2): string {
  const abs = Math.abs(value);
  if (abs >= CRORE) return `₹${formatFixed(value / CRORE, decimals)} Cr`;
  if (abs >= LAKH) return `₹${formatFixed(value / LAKH, decimals)} L`;
  return `₹${formatFixed(value, 0)}`;
}

/** Exact rupees with Indian grouping: `₹7,50,000`. Used where precision matters. */
export function formatCurrencyExact(value: number): string {
  return `₹${formatFixed(value, 0)}`;
}

/** Plain count with Indian grouping: `1,426`. */
export function formatNumber(value: number, decimals = 0): string {
  return formatFixed(value, decimals);
}

/**
 * Compact count using Indian magnitude words: `1.4K`, `2.31 L`, `1.2 Cr`.
 * For unit counts, not money — no ₹ sign.
 */
export function formatCompactNumber(value: number, decimals = 1): string {
  const abs = Math.abs(value);
  if (abs >= CRORE) return `${formatFixed(value / CRORE, decimals)} Cr`;
  if (abs >= LAKH) return `${formatFixed(value / LAKH, decimals)} L`;
  if (abs >= 1_000) return `${formatFixed(value / 1_000, decimals)}K`;
  return formatFixed(value, 0);
}

/** `31.4%` from a fraction in [0, 1]. */
export function formatPercentValue(fraction: number, decimals = 1): string {
  return `${(fraction * 100).toFixed(decimals)}%`;
}

/**
 * Format a guarded rate. A rate suppressed by the low-n guard renders as the
 * placeholder rather than a misleading percentage.
 */
export function formatRate(rate: Rate, decimals = 1): string {
  if (rate.value === null) return EM_DASH;
  return formatPercentValue(rate.value, decimals);
}

/** `195 days`, `1 day`, `0 days`. */
export function formatDurationDays(days: number): string {
  const rounded = Math.round(days * 10) / 10;
  const unit = Math.abs(rounded) === 1 ? 'day' : 'days';
  return `${formatNumber(rounded, Number.isInteger(rounded) ? 0 : 1)} ${unit}`;
}

/**
 * Durations measured in hours, promoted to days once they exceed two days so
 * that "how long to first contact" stays readable at both ends of the range.
 */
export function formatDurationHours(hours: number): string {
  if (Math.abs(hours) >= 48) return formatDurationDays(hours / 24);
  const rounded = Math.round(hours * 10) / 10;
  const unit = Math.abs(rounded) === 1 ? 'hour' : 'hours';
  return `${formatNumber(rounded, Number.isInteger(rounded) ? 0 : 1)} ${unit}`;
}

/** Signed delta for period-over-period display: `+12.5%`, `-3.0%`, `—`. */
export function formatSignedPercent(fraction: number | null, decimals = 1): string {
  if (fraction === null) return EM_DASH;
  const sign = fraction > 0 ? '+' : '';
  return `${sign}${(fraction * 100).toFixed(decimals)}%`;
}

/** `2025-06` rendered as `Jun 2025`. */
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

export function formatMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const index = Number(month) - 1;
  const name = MONTH_NAMES[index];
  return name ? `${name} ${year}` : monthKey;
}

/**
 * Pluralise a counted noun.
 *
 * Every templated count in this product is a claim a reader can catch being
 * wrong, and "1 leads" undermines the numbers next to it. Irregular plurals are
 * passed explicitly rather than guessed.
 */
export function plural(count: number, one: string, many = `${one}s`): string {
  return count === 1 ? one : many;
}

/** `formatNumber` plus the correctly inflected noun — "1 lead", "12 leads". */
export function counted(count: number, one: string, many = `${one}s`): string {
  return `${formatNumber(count)} ${plural(count, one, many)}`;
}
