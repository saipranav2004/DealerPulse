/**
 * Statistical primitives shared by the analytics layer, plus the low-n guard.
 * Pure: no I/O, no state, no dependency on the dataset.
 */

import { MIN_RATE_DENOMINATOR } from '@/lib/data';
import type { Rate } from '@/lib/types';

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

/**
 * The low-n guard.
 *
 * Any rate computed on a denominator below `minDenominator` is suppressed:
 * the caller gets `{ value: null, reason: 'insufficient_data', n }` instead of
 * a percentage derived from a handful of leads. A zero denominator is
 * suppressed for the same reason, which is what makes zero-lead reps safe.
 */
export function rate(
  numerator: number,
  denominator: number,
  minDenominator: number = MIN_RATE_DENOMINATOR,
): Rate {
  if (denominator < minDenominator) {
    return { value: null, reason: 'insufficient_data', n: denominator };
  }
  return { value: numerator / denominator, reason: null, n: denominator };
}

/**
 * Percentile using the order-statistic convention: the value at index
 * `ceil((n - 1) * p)` of the ascending sort, with no interpolation.
 *
 * Chosen deliberately. Every percentile reported by this codebase is therefore
 * a value that actually occurs in the data — there is no synthetic "48.2 days"
 * that no lead ever took. This is numpy's `method='higher'`.
 *
 * Note that for an even-sized sample the median is the upper of the two middle
 * values rather than their mean, which keeps whole-day durations whole.
 */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((sorted.length - 1) * p);
  return sorted[index] ?? null;
}

/** Median under the same convention as `percentile`. */
export function median(values: readonly number[]): number | null {
  return percentile(values, 0.5);
}

export function sum(values: readonly number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return sum(values) / values.length;
}

/**
 * Elapsed whole days between two instants.
 *
 * Durations in this codebase are whole units: a lead that has been idle for
 * 7.6 days has been idle for 7 days, and is *not* yet "more than 7 days" old.
 * Every aging threshold and dwell median depends on this rule.
 */
export function wholeDaysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/** Elapsed whole hours between two instants, under the same convention. */
export function wholeHoursBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_HOUR);
}

/**
 * Relative change from `previous` to `current`, as a fraction.
 * Returns null when there is no previous value or it is zero, since a
 * percentage change off a zero base is not meaningful.
 */
export function relativeChange(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return (current - previous) / previous;
}

/** Count array members satisfying a predicate, without allocating. */
export function countWhere<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  let count = 0;
  for (const item of items) if (predicate(item)) count += 1;
  return count;
}

/** Sum a numeric projection over array members, without allocating. */
export function sumBy<T>(items: readonly T[], project: (item: T) => number): number {
  let total = 0;
  for (const item of items) total += project(item);
  return total;
}

/** Tally occurrences of a string key across items, preserving insertion order. */
export function tallyBy<T>(items: readonly T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}
