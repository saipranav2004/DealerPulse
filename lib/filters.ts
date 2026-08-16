/**
 * Lead selection: turns a `Filters` object plus a `Scope` into the set of
 * leads an analytics function should operate on.
 *
 * Selection reads the dataset indexes rather than scanning all 510 leads, and
 * results are memoized by serialized filter key so that a dashboard rendering
 * a dozen metrics against the same filter selects once.
 */

import type { Dataset } from '@/lib/data';
import type { Filters, Lead, Scope } from '@/lib/types';

/** The unfiltered, company-wide scope. */
export const COMPANY_SCOPE: Scope = { kind: 'company' };

/** No constraint on any axis. */
export const NO_FILTERS: Filters = {};

/**
 * Stable string key for a filter/scope pair. Array fields are sorted so that
 * `['B2','B1']` and `['B1','B2']` share a cache entry.
 */
export function filterKey(filters: Filters, scope: Scope): string {
  const parts: string[] = [];
  parts.push(
    scope.kind === 'company'
      ? 'company'
      : scope.kind === 'branch'
        ? `branch:${scope.branchId}`
        : `rep:${scope.repId}`,
  );
  parts.push(
    filters.dateRange
      ? `date:${filters.dateRange.from.toISOString()}..${filters.dateRange.to.toISOString()}`
      : 'date:*',
  );
  // Must be in the key: without it a cohort and a calendar selection over the
  // same window would share a cache entry and serve each other's leads.
  parts.push(
    filters.activityRange
      ? `act:${filters.activityRange.from.toISOString()}..${filters.activityRange.to.toISOString()}`
      : 'act:*',
  );
  parts.push(filters.branchIds ? `branch:${[...filters.branchIds].sort().join(',')}` : 'branch:*');
  parts.push(filters.models ? `model:${[...filters.models].sort().join(',')}` : 'model:*');
  parts.push(filters.sources ? `source:${[...filters.sources].sort().join(',')}` : 'source:*');
  return parts.join('|');
}

/**
 * Narrow to the candidate set using indexes before any per-lead predicate runs.
 * Rep scope is the narrowest, then branch scope, then a branch-id filter.
 */
function candidates(dataset: Dataset, filters: Filters, scope: Scope): readonly Lead[] {
  if (scope.kind === 'rep') {
    return dataset.indexes.leadsByRep.get(scope.repId) ?? [];
  }

  if (scope.kind === 'branch') {
    return dataset.indexes.leadsByBranch.get(scope.branchId) ?? [];
  }

  if (filters.branchIds) {
    const collected: Lead[] = [];
    for (const branchId of filters.branchIds) {
      const bucket = dataset.indexes.leadsByBranch.get(branchId);
      if (bucket) collected.push(...bucket);
    }
    return collected;
  }

  return dataset.leads;
}

function matches(lead: Lead, filters: Filters, scope: Scope): boolean {
  // A branch-id filter still applies under rep scope, and a rep in another
  // branch legitimately selects nothing.
  if (filters.branchIds && !filters.branchIds.includes(lead.branchId)) return false;
  if (filters.models && !filters.models.includes(lead.model)) return false;
  if (filters.sources && !filters.sources.includes(lead.source)) return false;

  if (filters.dateRange) {
    const created = lead.createdAt.getTime();
    if (created < filters.dateRange.from.getTime()) return false;
    if (created > filters.dateRange.to.getTime()) return false;
  }

  if (filters.activityRange) {
    const moved = lead.lastActivityAt.getTime();
    if (moved < filters.activityRange.from.getTime()) return false;
    if (moved > filters.activityRange.to.getTime()) return false;
  }

  if (scope.kind === 'branch' && lead.branchId !== scope.branchId) return false;
  if (scope.kind === 'rep' && lead.assignedTo !== scope.repId) return false;

  return true;
}

/**
 * Cache keyed first by dataset identity (so a different dataset can never read
 * another's cache) and then by serialized filter key.
 */
const selectionCache = new WeakMap<Dataset, Map<string, readonly Lead[]>>();

/**
 * The leads in scope for a given filter. Memoized; the returned array is
 * shared and must be treated as read-only.
 */
export function selectLeads(
  dataset: Dataset,
  filters: Filters = NO_FILTERS,
  scope: Scope = COMPANY_SCOPE,
): readonly Lead[] {
  let perDataset = selectionCache.get(dataset);
  if (!perDataset) {
    perDataset = new Map();
    selectionCache.set(dataset, perDataset);
  }

  const key = filterKey(filters, scope);
  const cached = perDataset.get(key);
  if (cached) return cached;

  const pool = candidates(dataset, filters, scope);
  const noPredicates =
    !filters.branchIds &&
    !filters.models &&
    !filters.sources &&
    !filters.dateRange &&
    !filters.activityRange &&
    scope.kind !== 'rep';

  const selected = noPredicates ? pool : pool.filter((lead) => matches(lead, filters, scope));

  perDataset.set(key, selected);
  return selected;
}

/**
 * The period immediately preceding `range`, of identical length. Used for
 * period-over-period deltas. Returns null when no range is set, since
 * "previous period" is undefined for an unbounded filter.
 */
export function previousPeriod(filters: Filters): Filters | null {
  if (!filters.dateRange) return null;
  const { from, to } = filters.dateRange;
  const span = to.getTime() - from.getTime();
  return {
    ...filters,
    dateRange: {
      from: new Date(from.getTime() - span - 1),
      to: new Date(from.getTime() - 1),
    },
  };
}
