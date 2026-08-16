/**
 * Rep detail. Handles the zero-lead case explicitly: five branch managers
 * hold no pipeline, and the screen states that as a finding rather than
 * rendering a wall of zeros.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { computeActionCenter } from '@/lib/analytics/actionCenter';
import { computeBranches } from '@/lib/analytics/branches';
import { computeFunnel } from '@/lib/analytics/funnel';
import { computeKpiSet } from '@/lib/analytics/kpis';
import { computeLeadTimeline } from '@/lib/analytics/leadTimeline';
import { computeLossAnalysis } from '@/lib/analytics/lossAnalysis';
import { computeReps, groupMedianHoursToFirstContact } from '@/lib/analytics/reps';
import { NOW, getDataset } from '@/lib/data';
import { selectLeads } from '@/lib/filters';
import { isOpen } from '@/lib/lead';
import { median, wholeDaysBetween } from '@/lib/stats';
import { formatCurrency, formatNumber } from '@/lib/format';
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
import { RepSkeleton } from '@/components/skeletons';
import { LeadDrawer } from '@/components/lead-drawer';
import { RateText } from '@/components/ui';
import {
  ControllableNumber,
  RepBenchmark,
  RepEmptyState,
  RepFunnel,
  RepLossPanel,
  RepOpenLeads,
} from '@/components/rep';

/** Rendered on demand: search params make every filtered view dynamic. */
export const dynamic = 'force-dynamic';

/**
 * Validated here so an unknown rep id returns a real 404 — see the note on the
 * branch route for why this cannot live in the page body.
 */
export async function generateMetadata({ params }: { params: Promise<{ repId: string }> }) {
  const { repId } = await params;
  const rep = getDataset().indexes.repsById.get(repId);
  if (!rep) notFound();
  return { title: `${rep.name} — DealerPulse` };
}

export default async function RepPage({
  params,
  searchParams,
}: {
  params: Promise<{ repId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { repId } = await params;
  const query = await searchParams;
  const dataset = getDataset();

  const repRecord = dataset.indexes.repsById.get(repId);
  if (!repRecord) notFound();

  // Scoped to one rep, so a branch filter can only ever contradict the route.
  const state = withoutBranchScope(parseFilterState(query, dataset.branches.map((b) => b.id)));
  const viewAs = parseViewAs(query, dataset.branches.map((b) => b.id));
  const filters = toFilters(state);
  const basePath = `/rep/${repId}`;
  const scope = { kind: 'rep' as const, repId };

  const allReps = computeReps(dataset, filters);
  const rep = allReps.reps.find((entry) => entry.repId === repId);
  if (!rep) notFound();

  const branch = dataset.indexes.branchesById.get(rep.branchId);
  const branchName = branch?.name ?? rep.branchId;
  const branches = computeBranches(dataset, filters);
  const branchRow = branches.branches.find((entry) => entry.branchId === rep.branchId);

  const companyReps = computeReps(dataset);
  const companyRates = companyReps.active
    .map((entry) => entry.winRate.value)
    .filter((value): value is number => value !== null);
  const companyMedian = median(companyRates);

  const funnel = computeFunnel(dataset, filters, scope);
  const loss = computeLossAnalysis(dataset, filters, scope);
  const groupKpis = computeKpiSet(dataset, filters);
  const groupHours = groupMedianHoursToFirstContact(dataset, filters);
  const actions = computeActionCenter(dataset, filters);

  const repLeads = selectLeads(dataset, filters, scope);
  const openLeads = repLeads.filter(isOpen);
  const branchLeads = selectLeads(dataset, filters, { kind: 'branch', branchId: rep.branchId });
  const branchKpis = computeKpiSet(dataset, filters, { kind: 'branch', branchId: rep.branchId });

  const peersInBranch = allReps.active.filter(
    (entry) => entry.branchId === rep.branchId && entry.repId !== repId,
  );

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
        leadCount={repLeads.length}
        branchScope={{ branchId: rep.branchId }}
        leadingSlot={
          <>
            <Breadcrumb
              items={[
                { label: 'Overview', href: hrefWithFilters('/', state) },
                { label: branchName, href: hrefWithFilters(`/branch/${rep.branchId}`, state) },
                { label: rep.name },
              ]}
            />
            <span style={{ width: 1, height: 18, background: 'var(--rule)', margin: '0 8px' }} aria-hidden="true" />
          </>
        }
      />
      <SubsetBar
        state={state}
        branches={dataset.branches}
        basePath={basePath}
        shown={repLeads.length}
        total={dataset.leads.length}
      />

      <main id="main">
        <Suspense fallback={<RepSkeleton />}>
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--rule)', padding: 'var(--s5)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--s5)', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <h1 className="t-h1">{rep.name}</h1>
              <p className="t-small" style={{ marginTop: 4 }}>
                {rep.role === 'branch_manager' ? 'Branch manager' : 'Sales officer'} · {branchName},{' '}
                {branch?.city} · {formatNumber(rep.leadsHandled)} leads in this period
              </p>
            </div>
            {!rep.hasNoLeads ? (
              <div style={{ display: 'flex', gap: 'var(--s6)', flexWrap: 'wrap' }}>
                <div>
                  <p className="t-label">Leads → sale</p>
                  <span className="t-metric-s">
                    <RateText rate={rep.winRate} />
                  </span>
                </div>
                <div>
                  <p className="t-label">Revenue</p>
                  <span className="t-metric-s">{formatCurrency(rep.deliveredRevenue)}</span>
                </div>
                <div>
                  <p className="t-label">Leads</p>
                  <span className="t-metric-s">{rep.leadsHandled}</span>
                </div>
              </div>
            ) : (
              <span className="chip">{rep.role === 'branch_manager' ? 'manager' : 'no leads'}</span>
            )}
          </div>

          {!rep.hasNoLeads ? (
            <RepBenchmark
              rep={rep}
              branchName={branchName}
              branchWinRate={branchRow?.winRate.value ?? null}
              companyMedian={companyMedian}
              peersInBranch={peersInBranch}
            />
          ) : null}
        </div>

        {rep.hasNoLeads ? (
          <RepEmptyState
            rep={rep}
            branchName={branchName}
            branchLeads={branchLeads.length}
            branchNeverContacted={branchKpis.neverContactedCount}
            filters={state}
          />
        ) : (
          <div className="grid">
            <ControllableNumber
              rep={rep}
              groupNeverContactedRate={groupKpis.neverContactedRate.value}
              groupMedianHours={groupHours}
            />
            <RepFunnel funnel={funnel} />
            <RepLossPanel loss={loss} />
            <RepOpenLeads
              leads={openLeads}
              ageOf={(lead) => wholeDaysBetween(lead.lastActivityAt, NOW)}
              filters={state}
              basePath={basePath}
            />
          </div>
        )}

        <div style={{ padding: '0 var(--s5) var(--s7)' }}>
          <Link href={hrefWithFilters(`/branch/${rep.branchId}`, state)} className="btn btn-lg btn-quiet">
            ← Back to {branchName.replace(' Toyota', '')}
          </Link>
        </div>
        </Suspense>
      </main>

      {timeline ? <LeadDrawer timeline={timeline} closeHref={`${basePath}${toQueryString(state)}`} /> : null}
    </div>
  );
}
