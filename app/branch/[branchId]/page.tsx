/**
 * Branch detail — the diagnosis screen.
 *
 * Filters set on the Overview arrive here in the URL and are stated in the
 * subset bar, so branch figures can never silently disagree with the screen
 * the user just left.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BranchSkeleton } from '@/components/skeletons';
import { computeBranches } from '@/lib/analytics/branches';
import { computeActionCenter } from '@/lib/analytics/actionCenter';
import { computeCycleTime } from '@/lib/analytics/cycleTime';
import { compareFunnelToPeers } from '@/lib/analytics/funnel';
import { computeLeadTimeline } from '@/lib/analytics/leadTimeline';
import { computeLossAnalysis } from '@/lib/analytics/lossAnalysis';
import { computeReps, groupMedianHoursToFirstContact } from '@/lib/analytics/reps';
import { computeTargets } from '@/lib/analytics/targets';
import { getDataset } from '@/lib/data';
import { selectLeads } from '@/lib/filters';
import {
  hrefWithFilters,
  parseFilterState,
  parseViewAs,
  toFilters,
  toQueryString,
  withoutBranchScope,
  type SearchParams,
} from '@/lib/url-filters';
import { Breadcrumb, FilterBar, SubsetBar, TopBar } from '@/components/chrome';
import { LeadDrawer } from '@/components/lead-drawer';
import { RateText } from '@/components/ui';
import { EmptyByFilter } from '@/components/states';
import {
  BenchmarkFunnel,
  BranchHeader,
  BranchLossPanel,
  BranchTargets,
  CycleTimePanel,
  RepTable,
} from '@/components/branch';

type SortKey = 'name' | 'leads' | 'contacted' | 'win' | 'revenue' | 'firstContact' | 'open' | 'stalled';
const SORT_KEYS: SortKey[] = ['name', 'leads', 'contacted', 'win', 'revenue', 'firstContact', 'open', 'stalled'];

/**
 * Rendered on demand: the page reads search params, so every filtered view is
 * dynamic anyway.
 */
export const dynamic = 'force-dynamic';

/**
 * Validate the branch id here rather than in the page body.
 *
 * `generateMetadata` runs before the response starts streaming, so a
 * `notFound()` raised here can still set a 404 status. Raising it inside the
 * page body cannot: the `loading.tsx` Suspense boundary has already flushed
 * the shell with a 200 by then.
 */
export async function generateMetadata({ params }: { params: Promise<{ branchId: string }> }) {
  const { branchId } = await params;
  const branch = getDataset().indexes.branchesById.get(branchId);
  if (!branch) notFound();
  return { title: `${branch.name} — DealerPulse` };
}

export default async function BranchPage({
  params,
  searchParams,
}: {
  params: Promise<{ branchId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { branchId } = await params;
  const query = await searchParams;
  const dataset = getDataset();

  const branch = dataset.indexes.branchesById.get(branchId);
  if (!branch) notFound();

  // The branch axis cannot apply on a route already scoped to one branch.
  const state = withoutBranchScope(parseFilterState(query, dataset.branches.map((b) => b.id)));
  const viewAs = parseViewAs(query, dataset.branches.map((b) => b.id));
  const filters = toFilters(state);
  const basePath = `/branch/${branchId}`;

  const sortParam = typeof query.sort === 'string' ? query.sort : '';
  const sort: SortKey = SORT_KEYS.includes(sortParam as SortKey) ? (sortParam as SortKey) : 'win';
  const dir: 'asc' | 'desc' = query.dir === 'asc' ? 'asc' : 'desc';

  const scope = { kind: 'branch' as const, branchId };
  const leads = selectLeads(dataset, filters, scope);
  const allBranches = computeBranches(dataset, filters);
  const row = allBranches.branches.find((entry) => entry.branchId === branchId);
  const comparison = compareFunnelToPeers(dataset, filters, branchId);
  const loss = computeLossAnalysis(dataset, filters, scope);
  const branchCycle = computeCycleTime(dataset, filters, scope);
  const groupCycle = computeCycleTime(dataset, filters);
  const branchReps = computeReps(dataset, filters);
  const companyReps = computeReps(dataset);
  const targets = computeTargets(dataset, filters);
  const groupHours = groupMedianHoursToFirstContact(dataset, filters);
  const actions = computeActionCenter(dataset, filters);

  const repsInBranch = {
    reps: branchReps.reps.filter((rep) => rep.branchId === branchId),
    active: branchReps.active.filter((rep) => rep.branchId === branchId),
    inactive: branchReps.inactive.filter((rep) => rep.branchId === branchId),
  };
  const managers = repsInBranch.reps.filter((rep) => rep.role === 'branch_manager');

  const leadParam = typeof query.lead === 'string' ? query.lead : undefined;
  const timeline = leadParam ? computeLeadTimeline(dataset, leadParam) : null;

  return (
    <div className="app">
      <TopBar
        reconciledCount={dataset.reconciliation.reconciledCount}
        filters={state}
        viewAs={viewAs}
        branches={dataset.branches}
        actionCount={actions.stalled.count + actions.cold.count}
      />
      <FilterBar
        state={state}
        branches={dataset.branches}
        basePath={basePath}
        leadCount={leads.length}
        branchScope={{ branchId }}
        leadingSlot={
          <>
            <Breadcrumb
              items={[
                { label: 'Overview', href: hrefWithFilters('/', state) },
                { label: branch.name },
              ]}
            />
            <span
              style={{ width: 1, height: 18, background: 'var(--rule)', margin: '0 8px' }}
              aria-hidden="true"
            />
          </>
        }
      />
      <SubsetBar
        state={state}
        branches={dataset.branches}
        basePath={basePath}
        shown={leads.length}
        total={dataset.leads.length}
        inheritedNote={
          state.periodId !== 'all' || state.models.length > 0 || state.sources.length > 0
            ? 'Carried from Overview.'
            : undefined
        }
      />

      <main id="main">
        <Suspense fallback={<BranchSkeleton />}>
        {leads.length === 0 || !row ? (
          <EmptyByFilter state={state} branches={dataset.branches} basePath={basePath} />
        ) : (
          <>
            <BranchHeader
              branch={branch}
              leads={leads.length}
              winRate={<RateText rate={row.winRate} />}
              winRateVsBenchmark={row.winRateVsBenchmark}
              deliveredRevenue={row.deliveredRevenue}
              deliveredUnits={row.deliveredUnits}
              managers={managers}
              filters={state}
            />

            <div className="grid">
              {comparison ? (
                <BenchmarkFunnel comparison={comparison} branchName={branch.name} />
              ) : (
                <div className="c7 panel">
                  <div className="panel-bd">
                    <p className="t-small">
                      No peer branches are in scope, so this funnel has nothing to compare against. Clear the
                      branch filter to see the benchmark.
                    </p>
                  </div>
                </div>
              )}

              <div className="c5 stack">
                <CycleTimePanel branch={branchCycle} group={groupCycle} />
                <BranchLossPanel loss={loss} />
              </div>

              <RepTable
                reps={repsInBranch}
                allReps={companyReps.active}
                branchName={branch.name}
                branchId={branchId}
                sort={sort}
                dir={dir}
                basePath={basePath}
                filters={state}
                groupMedianHours={groupHours}
              />

              <BranchTargets targets={targets} branchId={branchId} leads={leads.length} />
            </div>

            <div style={{ padding: '0 var(--s5) var(--s7)', display: 'flex', gap: 'var(--s2)', flexWrap: 'wrap' }}>
              <Link href={hrefWithFilters('/actions', { ...state, branchIds: [branchId] })} className="btn btn-lg">
                Open this branch&rsquo;s action queue
              </Link>
              <Link href={hrefWithFilters('/', state)} className="btn btn-lg btn-quiet">
                ← Back to overview
              </Link>
            </div>
          </>
        )}
        </Suspense>
      </main>

      {timeline ? (
        <LeadDrawer timeline={timeline} closeHref={`${basePath}${toQueryString(state, { sort: sortParam || undefined, dir: query.dir === 'asc' ? 'asc' : undefined })}`} />
      ) : null}
    </div>
  );
}
