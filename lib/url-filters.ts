/**
 * Filters live in the URL.
 *
 * That gives three things this product needs: filters survive navigation into
 * a drill-down, a filtered view is shareable as a link, and the server can
 * compute the page without shipping the dataset to the browser.
 *
 * This module is the only place that translates between search params and the
 * typed `Filters` object the analytics layer consumes.
 */

import type { Filters, LeadSource, VehicleModel } from '@/lib/types';

export type SearchParams = Record<string, string | string[] | undefined>;

export interface PeriodPreset {
  id: string;
  label: string;
  shortLabel: string;
  from: string;
  to: string;
}

/** `all` must stay first: it is the default and the "widen" target. */
export const PERIOD_PRESETS: readonly PeriodPreset[] = [
  { id: 'all', label: 'Jun – Dec 2025', shortLabel: 'Jun – Dec', from: '2025-06-01T00:00:00.000Z', to: '2025-12-31T23:59:59.999Z' },
  { id: 'q4', label: 'Oct – Dec 2025', shortLabel: 'Oct – Dec', from: '2025-10-01T00:00:00.000Z', to: '2025-12-31T23:59:59.999Z' },
  { id: 'q3', label: 'Jul – Sep 2025', shortLabel: 'Jul – Sep', from: '2025-07-01T00:00:00.000Z', to: '2025-09-30T23:59:59.999Z' },
  { id: '2025-12', label: 'December 2025', shortLabel: 'Dec', from: '2025-12-01T00:00:00.000Z', to: '2025-12-31T23:59:59.999Z' },
  { id: '2025-11', label: 'November 2025', shortLabel: 'Nov', from: '2025-11-01T00:00:00.000Z', to: '2025-11-30T23:59:59.999Z' },
  { id: '2025-10', label: 'October 2025', shortLabel: 'Oct', from: '2025-10-01T00:00:00.000Z', to: '2025-10-31T23:59:59.999Z' },
  { id: '2025-09', label: 'September 2025', shortLabel: 'Sep', from: '2025-09-01T00:00:00.000Z', to: '2025-09-30T23:59:59.999Z' },
  { id: '2025-08', label: 'August 2025', shortLabel: 'Aug', from: '2025-08-01T00:00:00.000Z', to: '2025-08-31T23:59:59.999Z' },
  { id: '2025-07', label: 'July 2025', shortLabel: 'Jul', from: '2025-07-01T00:00:00.000Z', to: '2025-07-31T23:59:59.999Z' },
  { id: '2025-06', label: 'June 2025', shortLabel: 'Jun', from: '2025-06-01T00:00:00.000Z', to: '2025-06-30T23:59:59.999Z' },
] as const;

export const DEFAULT_PERIOD = PERIOD_PRESETS[0];

export const ALL_MODELS: readonly VehicleModel[] = [
  'Camry',
  'Fortuner',
  'Glanza',
  'Hilux',
  'Innova Crysta',
  'Innova Hycross',
  'Urban Cruiser Hyryder',
] as const;

export const ALL_SOURCES: readonly LeadSource[] = [
  'walk_in',
  'website',
  'referral',
  'social_media',
  'phone_enquiry',
  'auto_expo',
] as const;

export const SOURCE_LABELS: Record<LeadSource, string> = {
  walk_in: 'Walk-in',
  website: 'Website',
  referral: 'Referral',
  social_media: 'Social media',
  phone_enquiry: 'Phone enquiry',
  auto_expo: 'Auto expo',
};

/** The filter state as it appears in the URL, before becoming a `Filters`. */
export interface FilterState {
  periodId: string;
  branchIds: string[];
  models: VehicleModel[];
  sources: LeadSource[];
}

function readList(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function readOne(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Parse search params into filter state, discarding anything unrecognised so
 * that a hand-edited URL can never crash a page or silently narrow the data.
 */
export function parseFilterState(params: SearchParams, validBranchIds: readonly string[]): FilterState {
  const periodCandidate = readOne(params.period);
  const periodId = PERIOD_PRESETS.some((preset) => preset.id === periodCandidate)
    ? (periodCandidate as string)
    : DEFAULT_PERIOD.id;

  const branchIds = readList(params.branch).filter((id) => validBranchIds.includes(id));
  const models = readList(params.model).filter((m): m is VehicleModel =>
    (ALL_MODELS as readonly string[]).includes(m),
  );
  const sources = readList(params.source).filter((s): s is LeadSource =>
    (ALL_SOURCES as readonly string[]).includes(s),
  );

  return { periodId, branchIds, models, sources };
}

export function periodFor(state: FilterState): PeriodPreset {
  return PERIOD_PRESETS.find((preset) => preset.id === state.periodId) ?? DEFAULT_PERIOD;
}

/**
 * Convert filter state into the typed object the analytics layer takes.
 * The default period covers the whole dataset, so it is omitted rather than
 * applied — that keeps the memo key stable for the common unfiltered case.
 */
export function toFilters(state: FilterState): Filters {
  const filters: Filters = {};
  const period = periodFor(state);

  if (period.id !== DEFAULT_PERIOD.id) {
    filters.dateRange = { from: new Date(period.from), to: new Date(period.to) };
  }
  if (state.branchIds.length > 0) filters.branchIds = state.branchIds;
  if (state.models.length > 0) filters.models = state.models;
  if (state.sources.length > 0) filters.sources = state.sources;

  return filters;
}

/** True when any axis is constrained — drives the subset bar. */
export function isFiltered(state: FilterState): boolean {
  return (
    state.periodId !== DEFAULT_PERIOD.id ||
    state.branchIds.length > 0 ||
    state.models.length > 0 ||
    state.sources.length > 0
  );
}

/** Human-readable list of active constraints, for the subset bar and empty states. */
export function describeFilters(
  state: FilterState,
  branchName: (id: string) => string,
): string[] {
  const parts: string[] = [];
  if (state.periodId !== DEFAULT_PERIOD.id) parts.push(periodFor(state).label);
  if (state.branchIds.length > 0) parts.push(state.branchIds.map(branchName).join(', '));
  if (state.models.length > 0) parts.push(state.models.join(', '));
  if (state.sources.length > 0) parts.push(state.sources.map((s) => SOURCE_LABELS[s]).join(', '));
  return parts;
}

/**
 * Serialize filter state back to a query string. Default values are omitted so
 * that the unfiltered URL stays clean.
 */
export function toQueryString(state: FilterState, extra: Record<string, string | undefined> = {}): string {
  const params = new URLSearchParams();
  if (state.periodId !== DEFAULT_PERIOD.id) params.set('period', state.periodId);
  if (state.branchIds.length > 0) params.set('branch', state.branchIds.join(','));
  if (state.models.length > 0) params.set('model', state.models.join(','));
  if (state.sources.length > 0) params.set('source', state.sources.join(','));
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== '') params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** Build an href to `path` preserving the current filters. */
export function hrefWithFilters(
  path: string,
  state: FilterState,
  extra: Record<string, string | undefined> = {},
): string {
  return `${path}${toQueryString(state, extra)}`;
}

/** The same state with one axis cleared. */
export function withoutAxis(state: FilterState, axis: 'period' | 'branch' | 'model' | 'source'): FilterState {
  return {
    periodId: axis === 'period' ? DEFAULT_PERIOD.id : state.periodId,
    branchIds: axis === 'branch' ? [] : state.branchIds,
    models: axis === 'model' ? [] : state.models,
    sources: axis === 'source' ? [] : state.sources,
  };
}

export const EMPTY_FILTER_STATE: FilterState = {
  periodId: DEFAULT_PERIOD.id,
  branchIds: [],
  models: [],
  sources: [],
};
