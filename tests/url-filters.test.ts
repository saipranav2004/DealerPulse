/**
 * Filters live in the URL, so this translation layer is load-bearing: a bug
 * here silently changes what every figure on the page is computed from.
 */

import { describe, expect, it } from 'vitest';

import { getDataset } from '@/lib/data';
import { selectLeads } from '@/lib/filters';
import {
  DEFAULT_PERIOD,
  EMPTY_FILTER_STATE,
  PERIOD_PRESETS,
  describeFilters,
  hrefWithFilters,
  isFiltered,
  parseFilterState,
  periodFor,
  toFilters,
  toQueryString,
  withoutAxis,
} from '@/lib/url-filters';

const dataset = getDataset();
const branchIds = dataset.branches.map((branch) => branch.id);
const branchName = (id: string) => dataset.branches.find((b) => b.id === id)?.name ?? id;

describe('parseFilterState', () => {
  it('defaults to the full range with no constraints', () => {
    const state = parseFilterState({}, branchIds);
    expect(state).toEqual(EMPTY_FILTER_STATE);
    expect(isFiltered(state)).toBe(false);
  });

  it('reads every axis', () => {
    const state = parseFilterState(
      { period: 'q4', branch: 'B3,B1', model: 'Camry', source: 'walk_in,website' },
      branchIds,
    );
    expect(state.periodId).toBe('q4');
    expect(state.branchIds).toEqual(['B3', 'B1']);
    expect(state.models).toEqual(['Camry']);
    expect(state.sources).toEqual(['walk_in', 'website']);
  });

  it('accepts repeated params as well as comma-separated', () => {
    const state = parseFilterState({ branch: ['B1', 'B2'] }, branchIds);
    expect(state.branchIds).toEqual(['B1', 'B2']);
  });

  /** A hand-edited URL must never crash a page or silently narrow the data. */
  it('discards unknown values rather than trusting them', () => {
    const state = parseFilterState(
      { period: 'not-a-period', branch: 'B9,B3', model: 'Spaceship', source: 'carrier_pigeon' },
      branchIds,
    );
    expect(state.periodId).toBe(DEFAULT_PERIOD.id);
    expect(state.branchIds).toEqual(['B3']);
    expect(state.models).toEqual([]);
    expect(state.sources).toEqual([]);
  });

  it('ignores empty and whitespace entries', () => {
    const state = parseFilterState({ branch: 'B1,,  ,B2' }, branchIds);
    expect(state.branchIds).toEqual(['B1', 'B2']);
  });
});

describe('toFilters', () => {
  it('omits the default period so the unfiltered memo key stays stable', () => {
    expect(toFilters(EMPTY_FILTER_STATE)).toEqual({});
  });

  it('produces a date range for a real preset', () => {
    const filters = toFilters({ ...EMPTY_FILTER_STATE, periodId: 'q4' });
    expect(filters.dateRange?.from.toISOString()).toBe('2025-10-01T00:00:00.000Z');
    expect(filters.dateRange?.to.toISOString()).toBe('2025-12-31T23:59:59.999Z');
  });

  it('selects the leads the period claims to cover', () => {
    for (const preset of PERIOD_PRESETS) {
      const filters = toFilters({ ...EMPTY_FILTER_STATE, periodId: preset.id });
      const leads = selectLeads(dataset, filters);
      expect(leads.length).toBeGreaterThan(0);
      for (const lead of leads) {
        expect(lead.createdAt.getTime()).toBeGreaterThanOrEqual(new Date(preset.from).getTime());
        expect(lead.createdAt.getTime()).toBeLessThanOrEqual(new Date(preset.to).getTime());
      }
    }
  });

  it('covers all 510 leads on the default period', () => {
    expect(selectLeads(dataset, toFilters(EMPTY_FILTER_STATE))).toHaveLength(510);
  });

  it('splits the year into non-overlapping months that sum to the whole', () => {
    const months = PERIOD_PRESETS.filter((preset) => preset.id.startsWith('2025-'));
    const total = months.reduce(
      (sum, preset) => sum + selectLeads(dataset, toFilters({ ...EMPTY_FILTER_STATE, periodId: preset.id })).length,
      0,
    );
    expect(total).toBe(510);
  });
});

describe('toQueryString and round-tripping', () => {
  it('produces an empty string for the default state', () => {
    expect(toQueryString(EMPTY_FILTER_STATE)).toBe('');
  });

  it('round-trips every axis back to the same state', () => {
    const original = {
      periodId: 'q3',
      branchIds: ['B2', 'B4'],
      models: ['Camry' as const, 'Hilux' as const],
      sources: ['referral' as const],
    };
    const query = toQueryString(original);
    const params = Object.fromEntries(new URLSearchParams(query.slice(1)).entries());
    expect(parseFilterState(params, branchIds)).toEqual(original);
  });

  it('carries extra params without disturbing the filters', () => {
    const query = toQueryString({ ...EMPTY_FILTER_STATE, periodId: 'q4' }, { lead: 'L0022' });
    expect(query).toContain('period=q4');
    expect(query).toContain('lead=L0022');
  });

  it('drops empty extras', () => {
    expect(toQueryString(EMPTY_FILTER_STATE, { sort: undefined, dir: '' })).toBe('');
  });

  it('builds hrefs that preserve filters across navigation', () => {
    const state = parseFilterState({ period: 'q4', branch: 'B3' }, branchIds);
    expect(hrefWithFilters('/branch/B3', state)).toBe('/branch/B3?period=q4&branch=B3');
    expect(hrefWithFilters('/', EMPTY_FILTER_STATE)).toBe('/');
  });
});

describe('withoutAxis', () => {
  it('clears exactly one axis and leaves the rest', () => {
    const state = parseFilterState(
      { period: 'q4', branch: 'B3', model: 'Camry', source: 'walk_in' },
      branchIds,
    );
    expect(withoutAxis(state, 'branch')).toEqual({ ...state, branchIds: [] });
    expect(withoutAxis(state, 'model')).toEqual({ ...state, models: [] });
    expect(withoutAxis(state, 'source')).toEqual({ ...state, sources: [] });
    expect(withoutAxis(state, 'period')).toEqual({ ...state, periodId: DEFAULT_PERIOD.id });
  });
});

describe('describeFilters', () => {
  it('names every active constraint in words', () => {
    const state = parseFilterState({ period: 'q4', branch: 'B3', source: 'social_media' }, branchIds);
    expect(describeFilters(state, branchName)).toEqual([
      'Oct – Dec 2025',
      'Lakeside Toyota',
      'Social media',
    ]);
  });

  it('says nothing when nothing is constrained', () => {
    expect(describeFilters(EMPTY_FILTER_STATE, branchName)).toEqual([]);
  });
});

describe('periodFor', () => {
  it('falls back to the default for an unknown id', () => {
    expect(periodFor({ ...EMPTY_FILTER_STATE, periodId: 'nonsense' }).id).toBe(DEFAULT_PERIOD.id);
  });
});
