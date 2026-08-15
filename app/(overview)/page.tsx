/**
 * Executive Overview.
 *
 * A server component: the dataset never reaches the browser, and every figure
 * is computed by the analytics layer before render. Filters arrive as search
 * params, so a filtered view is a shareable URL.
 */

import Link from 'next/link';
import { computeActionCenter } from '@/lib/analytics/actionCenter';
import { computeBranches } from '@/lib/analytics/branches';
import { computeCohorts, computeDeliveryActivity } from '@/lib/analytics/cohorts';
import { computeKpiSet, computeKpis } from '@/lib/analytics/kpis';
import { computeLeadTimeline } from '@/lib/analytics/leadTimeline';
import { computeLossAnalysis } from '@/lib/analytics/lossAnalysis';
import { computeSources } from '@/lib/analytics/sources';
import { computeTargets } from '@/lib/analytics/targets';
import { computeVerdict } from '@/lib/analytics/verdict';
import { getDataset } from '@/lib/data';
import { selectLeads } from '@/lib/filters';
import { hrefWithFilters, parseFilterState, toFilters, toQueryString, type SearchParams } from '@/lib/url-filters';
import { FilterBar, SubsetBar, TopBar } from '@/components/chrome';
import { LeadDrawer } from '@/components/lead-drawer';
import {
  BranchComparison,
  MoneyAtRisk,
  SourceTable,
  TargetsContext,
  VerdictBand,
  VitalSigns,
  WhereDealsDie,
} from '@/components/overview';
import { EmptyByFilter } from '@/components/states';

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const dataset = getDataset();
  const state = parseFilterState(
    params,
    dataset.branches.map((branch) => branch.id),
  );
  const filters = toFilters(state);

  const leads = selectLeads(dataset, filters);
  const kpis = computeKpiSet(dataset, filters);
  const kpiTrend = computeKpis(dataset, filters);
  const branches = computeBranches(dataset, filters);
  const verdict = computeVerdict(dataset, filters);
  const actions = computeActionCenter(dataset, filters);
  const loss = computeLossAnalysis(dataset, filters);
  const sources = computeSources(dataset, filters);
  const targets = computeTargets(dataset, filters);
  const cohorts = computeCohorts(dataset, filters);
  const activity = computeDeliveryActivity(dataset, filters);

  const leadParam = typeof params.lead === 'string' ? params.lead : undefined;
  const timeline = leadParam ? computeLeadTimeline(dataset, leadParam) : null;

  const stalledByBranch = dataset.branches.map(
    (branch) => actions.stalled.items.filter((item) => item.branchId === branch.id).length,
  );

  return (
    <div className="app">
      <TopBar
        reconciledCount={dataset.reconciliation.reconciledCount}
        subtitle={`Toyota Group · ${dataset.branches.length} branches`}
      />
      <FilterBar state={state} branches={dataset.branches} basePath="/" leadCount={leads.length} />
      <SubsetBar
        state={state}
        branches={dataset.branches}
        basePath="/"
        shown={leads.length}
        total={dataset.leads.length}
      />

      <main id="main">
        {leads.length === 0 ? (
          <EmptyByFilter state={state} branches={dataset.branches} basePath="/" />
        ) : (
          <>
            <VerdictBand verdict={verdict} branches={branches} filters={state} />

            <VitalSigns
              kpis={kpis}
              revenueSeries={activity.map((point) => point.revenue)}
              neverContactedSeries={cohorts.cohorts.map((point) => point.neverContacted)}
              branchWinRates={branches.branches.map((branch) => ({
                id: branch.branchId,
                value: branch.winRate.value,
              }))}
              stalled={actions.stalled}
              stalledByBranch={stalledByBranch}
              revenueDelta={kpiTrend.deltas?.deliveredRevenue.relative ?? null}
            />

            <div className="grid">
              <BranchComparison
                branches={branches}
                focusBranchId={verdict?.branchId ?? null}
                filters={state}
              />
              <MoneyAtRisk stalled={actions.stalled} filters={state} />
              <WhereDealsDie loss={loss} />
              <SourceTable sources={sources} />
              <TargetsContext targets={targets} totalLeads={leads.length} />
            </div>

            <div style={{ padding: '0 var(--s5) var(--s7)' }}>
              <Link href={hrefWithFilters('/actions', state)} className="btn btn-lg">
                Open the Action Center — {actions.stalled.count + actions.cold.count} items need a decision
              </Link>
            </div>
          </>
        )}
      </main>

      {timeline ? <LeadDrawer timeline={timeline} closeHref={`/${toQueryString(state)}`} /> : null}
    </div>
  );
}
