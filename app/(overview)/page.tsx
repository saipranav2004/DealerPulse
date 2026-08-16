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
import { computeCohorts, computeDeliveryActivity, summariseTrend } from '@/lib/analytics/cohorts';
import { computeMomentum } from '@/lib/analytics/momentum';
import { computeKpiSet, computeKpis } from '@/lib/analytics/kpis';
import { computeLeadTimeline } from '@/lib/analytics/leadTimeline';
import { computeLossAnalysis } from '@/lib/analytics/lossAnalysis';
import { computeSources } from '@/lib/analytics/sources';
import { computeTargets } from '@/lib/analytics/targets';
import { computeVerdictOutcome } from '@/lib/analytics/verdict';
import { getDataset } from '@/lib/data';
import { selectLeads } from '@/lib/filters';
import {
  hrefWithFilters,
  parseFilterState,
  parseViewAs,
  periodFor,
  toFilters,
  toQueryString,
  type SearchParams,
} from '@/lib/url-filters';
import { FilterBar, SubsetBar, TopBar } from '@/components/chrome';
import { LeadDrawer } from '@/components/lead-drawer';
import {
  BranchComparison,
  ForecastPanel,
  MoneyAtRisk,
  MomentumStrip,
  RevenueTrend,
  SourceTable,
  TargetsContext,
  VerdictBand,
  VitalSigns,
  WhereDealsDie,
} from '@/components/overview';
import { computeForecast } from '@/lib/analytics/forecast';
import { counted, formatMonthKey } from '@/lib/format';
import { EmptyByFilter } from '@/components/states';

/**
 * Rendered on demand, like every other route.
 *
 * Without this the index was the one segment eligible for a full-route cache,
 * and a stale copy of it outlived several deploys — the bare link a reviewer
 * clicks served older code than every `?period=…` URL of the same build. The
 * build stamp in the footer makes a recurrence visible instead of silent.
 */
export const dynamic = 'force-dynamic';

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const dataset = getDataset();
  const baseState = parseFilterState(
    params,
    dataset.branches.map((branch) => branch.id),
  );
  const viewAs = parseViewAs(params, dataset.branches.map((b) => b.id));
  // A role is authoritative, not decorative: a branch manager's view is
  // scoped to their branch even if the branch parameter is missing.
  const state = viewAs ? { ...baseState, branchIds: [viewAs] } : baseState;
  const filters = toFilters(state);

  const leads = selectLeads(dataset, filters);
  const kpis = computeKpiSet(dataset, filters);
  const kpiTrend = computeKpis(dataset, filters);
  const branches = computeBranches(dataset, filters);
  const { verdict, abstention } = computeVerdictOutcome(dataset, filters);
  const actions = computeActionCenter(dataset, filters);
  const loss = computeLossAnalysis(dataset, filters);
  const sources = computeSources(dataset, filters);
  const targets = computeTargets(dataset, filters);
  const cohorts = computeCohorts(dataset, filters);
  const activity = computeDeliveryActivity(dataset, filters);
  const forecast = computeForecast(dataset, filters);

  const trendSummary = summariseTrend(activity);
  const period = periodFor(state);
  const momentum = computeMomentum(
    dataset,
    filters,
    { kind: 'company' },
    forecast.expectedDeliveries,
    { from: new Date(period.from), to: new Date(period.to) },
  );
  const trendPoints = activity.map((point) => ({
    label: formatMonthKey(point.month),
    shortLabel: formatMonthKey(point.month).split(' ')[0],
    value: point.revenue,
  }));

  const leadParam = typeof params.lead === 'string' ? params.lead : undefined;
  const timeline = leadParam ? computeLeadTimeline(dataset, leadParam) : null;

  const stalledByBranch = dataset.branches.map(
    (branch) => actions.stalled.items.filter((item) => item.branchId === branch.id).length,
  );

  return (
    <div className="app">
      <TopBar
        reconciledCount={dataset.reconciliation.reconciledCount}
        viewAs={viewAs}
        branches={dataset.branches}
        subtitle={`Toyota Group · ${dataset.branches.length} branches`}
        current="overview"
        actionCount={actions.stalled.count + actions.cold.count}
        filters={state}
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
            <VerdictBand verdict={verdict} abstention={abstention} branches={branches} filters={state} />

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
              filters={state}
            />

            <div className="grid">
              <BranchComparison
                branches={branches}
                focusBranchId={verdict?.branchId ?? null}
                filters={state}
              />
              <MoneyAtRisk stalled={actions.stalled} filters={state} />
              <MomentumStrip momentum={momentum} />
              <RevenueTrend points={trendPoints} summary={trendSummary} basis={state.basis} />
              <ForecastPanel forecast={forecast} filters={state} />
              <WhereDealsDie loss={loss} />
              <SourceTable sources={sources} />
              <TargetsContext targets={targets} totalLeads={leads.length} />
            </div>

            <div style={{ padding: '0 var(--s5) var(--s7)' }}>
              <Link href={hrefWithFilters('/actions', state)} className="btn btn-lg">
                Open the Action Center — {counted(actions.stalled.count + actions.cold.count, 'item')}{' '}
                {actions.stalled.count + actions.cold.count === 1 ? 'needs' : 'need'} a decision
              </Link>
            </div>
          </>
        )}
      </main>

      {timeline ? <LeadDrawer timeline={timeline} closeHref={`/${toQueryString(state)}`} /> : null}
    </div>
  );
}
