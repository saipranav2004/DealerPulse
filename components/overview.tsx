/**
 * Executive Overview modules.
 *
 * Every component here receives already-computed analytics output. None of
 * them decides a threshold, computes a rate, or formats currency inline.
 */

import Link from 'next/link';
import type { BranchesResult } from '@/lib/analytics/branches';
import type { QueueSummary } from '@/lib/analytics/actionCenter';
import type { KpiSet } from '@/lib/analytics/kpis';
import type { LossAnalysisResult } from '@/lib/analytics/lossAnalysis';
import type { SourcesResult } from '@/lib/analytics/sources';
import type { TrendSummary } from '@/lib/analytics/cohorts';
import type { MomentumResult } from '@/lib/analytics/momentum';
import type { TargetsResult } from '@/lib/analytics/targets';
import type { ValueRange, Verdict, VerdictAbstention } from '@/lib/analytics/verdict';
import type { ForecastResult } from '@/lib/analytics/forecast';
import { TrendChart, type TrendPoint } from '@/components/charts';
import {
  counted,
  formatCompactNumber,
  formatCurrency,
  formatMonthKey,
  formatNumber,
  formatPercentValue,
  formatSignedPercent,
  plural,
} from '@/lib/format';
import {
  SOURCE_LABELS,
  hrefWithFilters,
  type FilterState,
  type PeriodBasis,
} from '@/lib/url-filters';
import { Bar, DeltaPoints, Glyph, LowN, MicroBars, Panel, Rail, RateText, Sparkline, pct } from '@/components/ui';

/* -------------------------------------------------------------------------- */

/** Names each end of a money range, so a hover says which basis produced it. */
function rangeTitle(range: ValueRange): string {
  return `${formatCurrency(range.low)} at the ${range.lowBasis}; ${formatCurrency(range.high)} at the ${range.highBasis}`;
}

export function VerdictBand({
  verdict,
  abstention,
  branches,
  filters,
}: {
  verdict: Verdict | null;
  abstention: VerdictAbstention | null;
  branches: BranchesResult;
  filters: FilterState;
}) {
  if (!verdict) {
    /*
     * "No branch is materially behind" reads as an all-clear, and on a thin
     * window that is a claim the data cannot support. The two cases are now
     * told apart and worded differently.
     */
    const reason = abstention?.reason ?? 'insufficient-sample';
    const belowFloor = abstention?.belowFloor ?? 0;
    const total = branches.branches.length;
    const headline =
      reason === 'no-branch-behind'
        ? 'No branch is materially behind the group on this selection.'
        : reason === 'not-enough-branches'
          ? 'Only one branch is in view, so there is nothing to compare it against.'
          : 'Not enough leads in this window to name a branch.';
    return (
      <section className="verdict">
        <p className="t-eyebrow" style={{ marginBottom: 12 }}>
          Finding
        </p>
        <p className="t-verdict verdict-sentence">{headline}</p>
        <p className="verdict-sub">
          {reason === 'no-branch-behind' ? (
            <>
              Every branch clears the sample floor here and none is meaningfully behind the group. That is a
              genuine result, not a gap in the data.
            </>
          ) : reason === 'not-enough-branches' ? (
            <>
              This finding names the branch furthest below its peers, which needs at least two branches with
              enough leads to rate. Clear the branch filter to compare the full book.
            </>
          ) : (
            <>
              Naming the worst branch means having cleared the others, and{' '}
              <span className="fig">{belowFloor}</span> of <span className="fig">{total}</span>{' '}
              {plural(total, 'branch', 'branches')}{' '}
              {plural(belowFloor, 'sits', 'sit')} below the{' '}
              <span className="fig">{abstention?.floor ?? 30}</span>-lead floor a verdict requires — a branch
              too small to rate is also too small to exonerate. Widen the period to compare the full book.
            </>
          )}
        </p>
      </section>
    );
  }

  const contactScale = 0.9;
  const sorted = [...branches.branches].sort(
    (a, b) => (b.firstContactRate.value ?? 0) - (a.firstContactRate.value ?? 0),
  );

  return (
    <section className="verdict" aria-labelledby="verdict-heading">
      <div className="verdict-in">
        <div>
          <div className="verdict-eye">
            <span className="t-eyebrow">Finding</span>
            <span style={{ width: 14, height: 1, background: 'var(--rule-strong)' }} aria-hidden="true" />
            <span className="t-eyebrow">Lead response · all branches</span>
          </div>
          <h1 id="verdict-heading" className="t-verdict verdict-sentence">
            {verdict.branchName.replace(' Toyota', '')} converts{' '}
            <span className="fig">{formatPercentValue(verdict.branchWinRate)}</span> of its leads where the
            group converts <span className="fig">{formatPercentValue(verdict.groupWinRate)}</span> — and the
            break is at the first step:{' '}
            <b>
              {formatPercentValue(verdict.neverContactedShare, 0)} of {verdict.branchName.replace(' Toyota', '')}{' '}
              leads are never called.
            </b>
          </h1>
          {/* Two numbers, never merged — and shown as two cells rather than two
              paragraphs. Quoting the whole-funnel figure inside the sentence
              about phone calls overstated the lever tenfold; as a pair of
              labelled amounts the distinction is structural, and a reader who
              skips the prose entirely still cannot conflate them. */}
          <div className="impact">
            <div className="impact-cell">
              <p className="t-label">Fix first contact</p>
              {/* Both ends carry their own symbol: stripping it from the second
                  meant reformatting currency here, and currency has exactly one
                  formatter in this codebase. */}
              <p className="impact-val num" title={rangeTitle(verdict.firstContact)}>
                {formatCurrency(verdict.firstContact.low)} – {formatCurrency(verdict.firstContact.high)}
              </p>
              <p className="t-micro">
                Calling the {formatPercentValue(verdict.neverContactedShare, 0)} nobody calls, at the branch&rsquo;s
                own conversion after the call.
              </p>
            </div>
            <div className="impact-cell is-focus">
              <p className="t-label">Fix the whole funnel</p>
              <p className="impact-val num" title={rangeTitle(verdict.recoverable)}>
                {formatCurrency(verdict.recoverable.low)} – {formatCurrency(verdict.recoverable.high)}
              </p>
              <p className="t-micro">
                Matching the other branches at every step. First contact is where most of those leads go.
              </p>
            </div>
          </div>
          <div className="verdict-acts">
            <Link
              href={hrefWithFilters(`/branch/${verdict.branchId}`, filters)}
              className="btn btn-primary btn-lg"
            >
              Open {verdict.branchName.replace(' Toyota', '')} diagnosis
            </Link>
            <Link href="/method" className="btn btn-lg btn-quiet">
              How this was calculated
            </Link>
          </div>
        </div>

        <div className="evidence">
          <p className="t-label" style={{ marginBottom: 10 }}>
            Leads ever contacted
          </p>
          {sorted.map((branch) => {
            const focus = branch.branchId === verdict.branchId;
            const value = branch.firstContactRate.value;
            return (
              <div key={branch.branchId} className={focus ? 'ev-row is-focus' : 'ev-row'}>
                <span className="nm">{branch.name.replace(' Toyota', '')}</span>
                {value === null ? (
                  <span className="t-micro dim">insufficient data</span>
                ) : (
                  <Rail
                    value={value}
                    scale={contactScale}
                    focus={focus}
                    label={`${branch.name} first contact ${formatPercentValue(value)}`}
                  />
                )}
                <span className="vl">
                  <RateText rate={branch.firstContactRate} />
                </span>
              </div>
            );
          })}
          <p
            className="t-micro"
            style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--rule)' }}
          >
            {verdict.neverContacted} of {verdict.leads} {verdict.branchName.replace(' Toyota', '')}{' '}
            {plural(verdict.leads, 'lead')} {plural(verdict.neverContacted, 'has', 'have')} no{' '}
            <code>contacted</code> event in their history.
          </p>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * A vital sign that opens the rows behind it.
 *
 * This is the highest-value affordance on the product: a KPI a reader cannot
 * drill into is a number they have to take on trust. Every card links to the
 * `/leads` slice that produces it, so the evidence is one click away.
 */
function Vital({
  href,
  label,
  className = 'vital',
  children,
}: {
  href: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Link href={href} className="vital-link" aria-label={`${label} — open the leads behind this`}>
        {children}
        <span className="vital-go" aria-hidden="true">
          See the leads behind this →
        </span>
      </Link>
    </div>
  );
}

export function VitalSigns({
  kpis,
  revenueSeries,
  neverContactedSeries,
  branchWinRates,
  stalled,
  stalledByBranch,
  revenueDelta,
  filters,
}: {
  kpis: KpiSet;
  revenueSeries: number[];
  neverContactedSeries: number[];
  branchWinRates: { id: string; value: number | null }[];
  stalled: QueueSummary;
  stalledByBranch: number[];
  revenueDelta: number | null;
  filters: FilterState;
}) {
  const winScale = 0.45;
  const openMax = Math.max(...kpis.openByStage.map((s) => s.count), 1);

  return (
    <section className="vitals" aria-label="Vital signs">
      <Vital href={hrefWithFilters('/leads', filters, { status: 'delivered' })} label="Delivered revenue">
        <div className="vital-hd">
          <h2 className="t-label">Delivered revenue</h2>
        </div>
        <p className="vital-val">
          <span className="t-metric">{formatCurrency(kpis.deliveredRevenue).replace(/ (Cr|L)$/, '')}</span>
          <span className="unit">{formatCurrency(kpis.deliveredRevenue).match(/(Cr|L)$/)?.[0] ?? ''}</span>
        </p>
        <div className="vital-ft">
          {revenueDelta === null ? (
            <span className="t-micro num">{kpis.deliveredUnits} units</span>
          ) : (
            <span className={revenueDelta >= 0 ? 'chip chip-pos' : 'chip chip-crit'}>
              <span className="num">{formatSignedPercent(revenueDelta)}</span> vs prior
            </span>
          )}
          <Sparkline values={revenueSeries} label="Delivered revenue by month" />
        </div>
      </Vital>

      <Vital href={hrefWithFilters('/leads', filters, { status: 'delivered' })} label="Leads that became a sale">
        <div className="vital-hd">
          {/* "Win rate" hides its denominator. Every lead is the denominator
              here, not every quote or every test drive. */}
          <h2 className="t-label">Leads that became a sale</h2>
        </div>
        <p className="vital-val">
          <span className="t-metric">
            <RateText rate={kpis.winRate} />
          </span>
        </p>
        <div className="vital-ft">
          <span className="t-micro num">
            {formatNumber(kpis.deliveredUnits)} delivered of {counted(kpis.totalLeads, 'lead')}
          </span>
          <svg width="64" height="20" viewBox="0 0 64 20" role="img" aria-label="Share of leads that became a sale, per branch, on a shared scale">
            <line x1="0" y1="10" x2="64" y2="10" stroke="var(--c-grid)" strokeWidth="2" />
            {branchWinRates.map((branch) =>
              branch.value === null ? null : (
                <circle
                  key={branch.id}
                  cx={Math.min(63, (branch.value / winScale) * 64)}
                  cy="10"
                  r="2.6"
                  fill="var(--c-context)"
                />
              ),
            )}
          </svg>
        </div>
      </Vital>

      <Vital href={hrefWithFilters('/leads', filters, { status: 'open' })} label="Open pipeline">
        <div className="vital-hd">
          <h2 className="t-label">Open pipeline</h2>
        </div>
        <p className="vital-val">
          <span className="t-metric">{formatCurrency(kpis.openPipelineValue).replace(/ (Cr|L)$/, '')}</span>
          <span className="unit">{formatCurrency(kpis.openPipelineValue).match(/(Cr|L)$/)?.[0] ?? ''}</span>
        </p>
        <div className="vital-ft">
          <span className="t-micro num">{formatNumber(kpis.openPipelineCount)} leads</span>
          <svg width="64" height="20" viewBox="0 0 64 20" role="img" aria-label="Open leads by stage">
            {kpis.openByStage.map((stage, index) => {
              const height = Math.max(1, (stage.count / openMax) * 20);
              return (
                <rect
                  key={stage.stage}
                  x={index * 13}
                  y={20 - height}
                  width={10}
                  height={height}
                  fill={index === kpis.openByStage.length - 1 ? 'var(--c-seq-4)' : 'var(--c-seq-2)'}
                />
              );
            })}
          </svg>
        </div>
      </Vital>

      <Vital href={hrefWithFilters('/leads', filters, { status: 'stalled' })} label="Money at risk" className="vital is-risk">
        <div className="vital-hd">
          <span className="crit" aria-hidden="true">
            <Glyph kind="critical" />
          </span>
          <h2 className="t-label" style={{ color: 'var(--critical)' }}>
            Money at risk
          </h2>
        </div>
        <p className="vital-val">
          <span className="t-metric crit">{formatCurrency(stalled.value).replace(/ (Cr|L)$/, '')}</span>
          <span className="unit crit">{formatCurrency(stalled.value).match(/(Cr|L)$/)?.[0] ?? ''}</span>
        </p>
        <div className="vital-ft">
          <span className="t-micro num">
            {counted(stalled.count, 'order')}
            {stalled.oldestAgeDays !== null ? ` · to ${stalled.oldestAgeDays} d` : ''}
          </span>
          <MicroBars values={stalledByBranch} label="Stalled orders by branch" />
        </div>
      </Vital>

      {/* Sitting beside "Money at risk", a bare count read as a work queue.
          It is not one: almost all of these leads are already lost, and only
          the still-open remainder can be called today. */}
      <Vital href={hrefWithFilters('/leads', filters, { status: 'uncontacted' })} label="Never called" className="vital vital-hide-md">
        <div className="vital-hd">
          <h2 className="t-label">Never called</h2>
        </div>
        <p className="vital-val">
          <span className="t-metric">{formatNumber(kpis.neverContactedCount)}</span>
          <span className="unit">{plural(kpis.neverContactedCount, 'lead')}</span>
        </p>
        <div className="vital-ft">
          {kpis.neverContactedRate.value === null ? (
            <LowN n={kpis.neverContactedRate.n} />
          ) : (
            <span className="chip chip-warn">
              <span className="num">{formatNumber(kpis.neverContactedClosed)}</span> already closed ·{' '}
              <span className="num">{formatNumber(kpis.neverContactedStillOpen)}</span> still callable
            </span>
          )}
          <Sparkline
            values={neverContactedSeries}
            color="var(--warning)"
            label="Leads never contacted, by month created"
          />
        </div>
      </Vital>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

export function BranchComparison({
  branches,
  focusBranchId,
  filters,
}: {
  branches: BranchesResult;
  focusBranchId: string | null;
  filters: FilterState;
}) {
  const contactScale = 0.9;
  const winScale = 0.45;
  const rows = [...branches.branches].sort((a, b) => (b.winRate.value ?? -1) - (a.winRate.value ?? -1));
  const groupWin = branches.benchmark.winRate.value ?? undefined;
  const groupContact = branches.benchmark.firstContactRate.value ?? undefined;

  return (
    <Panel
      title="Branch comparison"
      subtitle="Ranked by the share of leads that became a sale · grey tick is the group figure"
      className="c8 ord-branches"
      padded={false}
      footer={
        <p className="t-micro">
          Reading across a row shows cause beside effect: the branch with the isolated first-contact mark
          has the isolated sale-rate mark.
        </p>
      }
    >
      <div className="panel-bd" style={{ paddingTop: 'var(--s3)' }}>
        <div className="dp">
          <div className="dp-h" />
          <div className="dp-h">
            <span className="t-label">Leads ever contacted</span>
          </div>
          <div className="dp-h">
            <span className="t-label">Leads → sale</span>
          </div>

          {rows.map((branch) => {
            const focus = branch.branchId === focusBranchId;
            const contact = branch.firstContactRate.value;
            const win = branch.winRate.value;
            return (
              <div key={branch.branchId} className={focus ? 'dp-row is-focus' : 'dp-row'}>
                <div className="dp-cell">
                  <Link href={hrefWithFilters(`/branch/${branch.branchId}`, filters)} className="dp-name">
                    {branch.name.replace(' Toyota', '')} <span className="dim">{branch.city}</span>
                  </Link>
                </div>
                <div className="dp-cell">
                  {/* Column headings become per-row labels once the table
                      collapses to one card per branch. */}
                  <span className="dp-lab t-label">Contacted</span>
                  {contact === null ? (
                    <LowN n={branch.firstContactRate.n} />
                  ) : (
                    <>
                      <Rail
                        value={contact}
                        benchmark={groupContact}
                        scale={contactScale}
                        focus={focus}
                        label={`${branch.name} contacted ${formatPercentValue(contact)}`}
                      />
                      <span className="dp-val">
                        <RateText rate={branch.firstContactRate} />
                      </span>
                      <span className="dp-delta">
                        <DeltaPoints
                          points={
                            branch.firstContactVsBenchmark === null
                              ? null
                              : branch.firstContactVsBenchmark * 100
                          }
                        />
                      </span>
                    </>
                  )}
                </div>
                <div className="dp-cell">
                  <span className="dp-lab t-label">Became a sale</span>
                  {win === null ? (
                    <LowN n={branch.winRate.n} />
                  ) : (
                    <>
                      <Rail
                        value={win}
                        benchmark={groupWin}
                        scale={winScale}
                        focus={focus}
                        label={`${branch.name}: ${formatPercentValue(win)} of leads became a sale`}
                      />
                      <span className="dp-val">
                        <RateText rate={branch.winRate} />
                      </span>
                      <span className="dp-delta">
                        <DeltaPoints
                          points={branch.winRateVsBenchmark === null ? null : branch.winRateVsBenchmark * 100}
                        />
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */

export function MoneyAtRisk({ stalled, filters }: { stalled: QueueSummary; filters: FilterState }) {
  const top = stalled.items.slice(0, 5);

  return (
    <Panel
      title="Money at risk"
      subtitle="Paid orders with no delivery record"
      className="c4 ord-risk"
      padded={false}
      aside={<span className="chip chip-crit num">{formatCurrency(stalled.value)}</span>}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)', flexWrap: 'wrap' }}>
          <p className="t-micro">
            {Math.max(0, stalled.count - top.length)} more · normal order-to-delivery is{' '}
            <span className="num">17 days</span>
          </p>
          <span className="sp" />
          <Link href={hrefWithFilters('/actions', filters)} className="btn btn-sm">
            Open queue
          </Link>
        </div>
      }
    >
      {stalled.count === 0 ? (
        <div className="state">
          <div className="state-in">
            <p className="t-h2 pos">No stalled orders</p>
            <p className="t-small">Every placed order on this selection has a delivery record.</p>
          </div>
        </div>
      ) : (
        <div className="scrollx">
        {/* Four columns do not fit a phone. Branch folds under the name. */}
        <table className="tbl tbl-hover tbl-fold-sm">
          <thead>
            <tr>
              <th style={{ paddingLeft: 16 }}>Customer</th>
              <th className="fold">Branch</th>
              <th className="r">Value</th>
              <th className="r" style={{ paddingRight: 16 }}>
                Age
              </th>
            </tr>
          </thead>
          <tbody>
            {top.map((item) => (
              <tr key={item.leadId}>
                <td style={{ paddingLeft: 16 }}>
                  <Link href={hrefWithFilters('/', filters, { lead: item.leadId })} className="dp-name">
                    {item.customerName}
                  </Link>
                  <div className="t-micro unfold">{item.branchName.replace(' Toyota', '')}</div>
                </td>
                <td className="muted fold">{item.branchName.replace(' Toyota', '')}</td>
                <td className="r num">{formatCurrency(item.dealValue)}</td>
                <td className="r num crit" style={{ paddingRight: 16 }}>
                  {item.ageDays} d
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */

const LOSS_STAGE_LABEL: Record<string, string> = {
  new: 'Never contacted',
  contacted: 'Contacted, no test drive',
  test_drive: 'After test drive',
  negotiation: 'In negotiation',
  order_placed: 'After order placed',
};

export function WhereDealsDie({ loss }: { loss: LossAnalysisResult }) {
  const max = Math.max(...loss.byStage.map((s) => s.count), 1);
  const seq = ['var(--c-seq-4)', 'var(--c-seq-3)', 'var(--c-seq-2)', 'var(--c-seq-1)'];

  return (
    <Panel
      title="Where deals die"
      subtitle={`${formatNumber(loss.lostCount)} lost leads · stage occupied before the loss`}
      className="c6 ord-trend"
      footer={
        loss.preTestDriveShare.value !== null ? (
          <p className="t-micro">
            <strong style={{ color: 'var(--ink)' }}>
              {formatPercentValue(loss.preTestDriveShare.value, 0)}
            </strong>{' '}
            of lost deals die before anyone sits in a car. This is a response problem, not a closing problem.
          </p>
        ) : loss.lostCount > 0 ? (
          <p className="t-micro">
            <span className="num">{loss.preTestDriveCount}</span> of {loss.lostCount} died before a test
            drive. Too few losses here to publish a share.
          </p>
        ) : undefined
      }
    >
      {loss.lostCount === 0 ? (
        <p className="t-small">No lost leads on this selection.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loss.byStage.map((stage, index) => (
            <div key={stage.stage}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span className="t-small">{LOSS_STAGE_LABEL[stage.stage] ?? stage.stage}</span>
                <span className="num" style={{ fontSize: 12.5 }}>
                  {stage.count}
                </span>
              </div>
              <Bar value={stage.count} max={max} color={seq[index] ?? 'var(--c-seq-1)'} />
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */

const STAGE_LABEL: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  test_drive: 'Test drive',
  negotiation: 'Negotiation',
  order_placed: 'Order placed',
};

/**
 * What the open pipeline is worth, weighted by how leads at each stage have
 * actually converted. The panel leads with a range rather than a single number
 * because most of the value sits in orders that have already failed to deliver.
 */
/**
 * Movement, placed directly under the vital signs.
 *
 * Every other module states a level. Without this one a reader cannot tell a
 * business that is recovering from one that is sliding — the numbers look
 * identical on the day they are read.
 */
export function MomentumStrip({ momentum }: { momentum: MomentumResult }) {
  if (momentum.insufficientHistory || !momentum.previousMonth) return null;

  return (
    <Panel
      title="What changed last month"
      subtitle={`${formatMonthKey(momentum.currentMonth)} against ${formatMonthKey(momentum.previousMonth)}`}
      className="c12 ord-moved"
      footer={
        momentum.monthsOfPipeline !== null && momentum.paceDeliveries !== null ? (
          <p className="t-micro">
            At the pace of the last <span className="num">{momentum.paceMonths}</span>{' '}
            {plural(momentum.paceMonths, 'month')} —{' '}
            <span className="num">{formatNumber(momentum.paceDeliveries)}</span> cars a month, median — the
            open pipeline is about{' '}
            <strong style={{ color: 'var(--ink)' }}>
              <span className="num">{momentum.monthsOfPipeline.toFixed(1)}</span>{' '}
              {momentum.monthsOfPipeline.toFixed(1) === '1.0' ? 'month' : 'months'}
            </strong>{' '}
            of delivery work. A median is used, not an average: one exceptional month should not set the
            expectation for every future one.
          </p>
        ) : (
          /* Two months cannot produce a median worth the name. The months are
             printed instead, which is both honest and more informative. */
          <p className="t-micro">
            {momentum.paceSeries.length > 0 ? (
              <>
                Too few months in this window to set a pace —{' '}
                <span className="num">
                  {momentum.paceSeries
                    .map((point) => `${formatMonthKey(point.month).split(' ')[0]} ${point.deliveries}`)
                    .join(' · ')}
                </span>
                . Widen the period for a pipeline-months figure.
              </>
            ) : (
              <>No deliveries in this window, so there is no pace to state.</>
            )}
          </p>
        )
      }
    >
      <div className="mv-grid">
        {momentum.movements.map((movement) => {
          const good = movement.change === null ? null : movement.invert ? movement.change < 0 : movement.change > 0;
          const flat = movement.change !== null && Math.abs(movement.change) < 0.005;
          return (
            <div key={movement.label} className="mv">
              <p className="t-label">{movement.label}</p>
              <p className="t-metric-s" style={{ marginTop: 4 }}>
                {movement.kind === 'currency'
                  ? formatCurrency(movement.current)
                  : formatNumber(movement.current)}
              </p>
              <p className="t-micro" style={{ marginTop: 3 }}>
                {movement.change === null ? (
                  <span className="dim">no prior month to compare</span>
                ) : (
                  <>
                    <span className={flat ? 'dim' : good ? 'pos' : 'crit'}>
                      {formatSignedPercent(movement.change)}
                    </span>{' '}
                    <span className="dim">
                      from{' '}
                      {movement.kind === 'currency'
                        ? formatCurrency(movement.previous)
                        : formatNumber(movement.previous)}
                    </span>
                  </>
                )}
              </p>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */

export function ForecastPanel({ forecast, filters }: { forecast: ForecastResult; filters: FilterState }) {
  if (forecast.openCount === 0) {
    return (
      <Panel title="What is still coming" className="c6 ord-forecast">
        <p className="t-small">No open leads on this selection, so there is nothing left to forecast.</p>
      </Panel>
    );
  }

  /* Withheld rather than published as zero — see `basisTooThin`. */
  if (forecast.basisTooThin) {
    return (
      <Panel
        title="What is still coming"
        subtitle="Not enough completed journeys on this selection to weight the pipeline"
        className="c6 ord-forecast"
      >
        <p className="t-small">
          <span className="num">{formatNumber(forecast.openCount)}</span> open leads worth{' '}
          <span className="num">{formatCurrency(forecast.openValue)}</span> are still in play, but the
          narrowest conversion step here rests on{' '}
          <span className="num">{formatNumber(forecast.weakestBasis)}</span> leads. A forecast built on that
          would read as confidence this selection cannot support, so it is withheld.
        </p>
        <p className="t-micro" style={{ marginTop: 'var(--s3)' }}>
          Widen the period to weight these leads against enough completed journeys.
        </p>
      </Panel>
    );
  }

  const low = forecast.expectedRevenueExcludingStalled;
  const high = forecast.expectedRevenue;

  return (
    <Panel
      title="What is still coming"
      subtitle="Open pipeline weighted by how each stage has actually converted"
      className="c6 ord-forecast"
      footer={
        <p className="t-micro">
          Weighted from this period&rsquo;s own conversion rates. A lead sitting at{' '}
          <em>order placed</em> historically delivers{' '}
          {formatPercentValue(forecast.stages[forecast.stages.length - 1]?.probability ?? 0, 0)} of the time.
        </p>
      }
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <span className="t-metric">{formatCurrency(low)}</span>
        <span className="t-small muted">to</span>
        <span className="t-metric">{formatCurrency(high)}</span>
      </div>
      <p className="t-small" style={{ marginBottom: 'var(--s4)' }}>
        from <span className="num">{formatNumber(forecast.openCount)}</span> open leads worth{' '}
        <span className="num">{formatCurrency(forecast.openValue)}</span>
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 'var(--s4)' }}>
        {forecast.stages.map((stage) => (
          <div key={stage.stage} style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
            <span className="t-small" style={{ width: 96, flex: 'none' }}>
              {STAGE_LABEL[stage.stage] ?? stage.stage}
            </span>
            <span className="num t-micro" style={{ width: 54, flex: 'none', textAlign: 'right' }}>
              {stage.openCount} open
            </span>
            <div className="bar-track" style={{ height: 8, flex: 1 }}>
              <div
                className="bar-fill"
                style={{ width: pct(stage.probability), background: 'var(--c-seq-3)' }}
              />
            </div>
            <span className="num t-micro" style={{ width: 78, flex: 'none', textAlign: 'right' }}>
              {formatPercentValue(stage.probability, 0)} likely
            </span>
          </div>
        ))}
      </div>

      {forecast.stalledDominates ? (
        <div className="assumption">
          <span className="warn" style={{ marginTop: 3, flex: 'none' }}>
            <Glyph kind="warning" />
          </span>
          <div>
            <p className="t-label" style={{ marginBottom: 4 }}>
              Why this is a range, not a number
            </p>
            <p className="t-small">
              <strong style={{ color: 'var(--ink)' }}>
                {formatNumber(forecast.stalledCount)} of these are orders already paid for and never
                delivered
              </strong>
              , worth {formatCurrency(forecast.stalledValue)}. Treating them as likely to complete gives the
              upper figure. Excluding them entirely gives the lower one. The truth is in between, and it
              depends on whether anyone chases them.
            </p>
            {forecast.overdueCount > 0 ? (
              <p className="t-small" style={{ marginTop: 6 }}>
                <span className="num">{formatNumber(forecast.overdueCount)}</span> open leads are already
                past the close date their own rep predicted, worth{' '}
                <span className="num">{formatCurrency(forecast.overdueValue)}</span>.
              </p>
            ) : null}
            <Link
              href={hrefWithFilters('/actions', filters)}
              className="btn btn-sm"
              style={{ marginTop: 8 }}
            >
              Chase the {formatNumber(forecast.stalledCount)} stalled orders
            </Link>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */

/** Delivered revenue by month — the plain "are we growing" question. */
export function RevenueTrend({
  points,
  summary,
  basis,
}: {
  points: TrendPoint[];
  summary: TrendSummary | null;
  basis: PeriodBasis;
}) {
  if (points.length < 2) return null;
  const latestLabel = points[points.length - 1].shortLabel;

  return (
    <Panel
      title="Revenue delivered each month"
      subtitle={
        basis === 'cohort'
          ? 'Deliveries from leads created in this period — delivery months may fall outside it'
          : 'Cars handed over, by the month they were handed over'
      }
      className="c6 ord-die"
      aside={
        /* Month on month, not first to last. A trough-to-peak percentage on a
           six-point series is chosen by whichever month was lowest. */
        summary?.monthOverMonth != null ? (
          <span className={summary.monthOverMonth >= 0 ? 'chip chip-pos' : 'chip chip-crit'}>
            <span className="num">{formatSignedPercent(summary.monthOverMonth)}</span> vs last month
          </span>
        ) : undefined
      }
      footer={
        <p className="t-micro">
          {summary?.multipleOfMedian != null && summary.priorMedian != null ? (
            <>
              {latestLabel} is{' '}
              <strong style={{ color: 'var(--ink)' }}>
                <span className="num">{summary.multipleOfMedian.toFixed(1)}×</span>
              </strong>{' '}
              the median of the earlier months (
              <span className="num">{formatCurrency(summary.priorMedian)}</span>).{' '}
            </>
          ) : null}
          Cars ordered earlier in the year complete late, so this line leads the cohort view rather than
          contradicting it.
        </p>
      }
    >
      <TrendChart points={points} title="Delivered revenue by month" valueLabel="Delivered revenue" />
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */

export function SourceTable({ sources }: { sources: SourcesResult }) {
  /*
   * A superlative is only true over the rows that were actually compared.
   *
   * "Walk-in converts worst on this selection" was emitted with four of six
   * source rows suppressed — it was worst of two, and the sentence did not say
   * so. Any "worst"/"best" claim now carries the size of its comparison set,
   * and is withheld entirely when fewer than two rows can be rated.
   */
  const rated = sources.sources.filter((row) => row.winRate.value !== null);
  const worst = rated.reduce<{ id: string; value: number } | null>((low, row) => {
    const value = row.winRate.value as number;
    return low === null || value < low.value ? { id: row.source, value } : low;
  }, null);
  const comparable = rated.length >= 2;

  return (
    <Panel
      title="Lead source"
      subtitle="Share of leads that became a sale, against average deal value"
      className="c6 ord-source"
      padded={false}
      footer={
        worst && comparable ? (
          <p className="t-micro">
            <strong style={{ color: 'var(--ink)' }}>{SOURCE_LABELS[worst.id as keyof typeof SOURCE_LABELS]}</strong>{' '}
            converts worst of the <span className="num">{rated.length}</span>{' '}
            {rated.length === 1 ? 'source' : 'sources'} with enough volume to rate
            {rated.length < sources.sources.length ? (
              <>
                {' '}
                (<span className="num">{sources.sources.length - rated.length}</span> withheld)
              </>
            ) : null}
            . Either the leads are unqualified or nobody is calling them back.
          </p>
        ) : undefined
      }
    >
      {sources.sources.length === 0 ? (
        <div className="panel-bd">
          <p className="t-small">No leads on this selection.</p>
        </div>
      ) : (
        <div className="scrollx">
        <table className="tbl tbl-hover">
          <thead>
            <tr>
              <th style={{ paddingLeft: 16 }}>Source</th>
              <th className="r">Leads</th>
              <th className="r">Leads → sale</th>
              <th className="r" style={{ paddingRight: 16 }}>
                Avg deal
              </th>
            </tr>
          </thead>
          <tbody>
            {sources.sources.map((row) => {
              const isWorst = comparable && worst !== null && row.source === worst.id;
              return (
                <tr key={row.source} style={isWorst ? { background: 'var(--warning-wash)' } : undefined}>
                  <td style={{ paddingLeft: 16, fontWeight: isWorst ? 600 : undefined }}>
                    {SOURCE_LABELS[row.source]}
                  </td>
                  <td className="r num">{row.leads}</td>
                  <td className={isWorst ? 'r num warn' : 'r num'} style={isWorst ? { fontWeight: 600 } : undefined}>
                    <RateText rate={row.winRate} />
                  </td>
                  <td className="r num" style={{ paddingRight: 16 }}>
                    {row.averageDealValue === null ? '—' : formatCurrency(row.averageDealValue)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Targets, shown honestly. The black tick marks total lead volume — the
 * arithmetic ceiling on deliveries even if every lead converted.
 */
export function TargetsContext({ targets, totalLeads }: { targets: TargetsResult; totalLeads: number }) {
  const targetUnits = targets.group.targetUnits;
  const delivered = targets.group.deliveredUnits;
  /*
   * Two attainments, never merged.
   *
   * The panel used to read "attainment 9.7% — 19 delivered against 189
   * targeted units". 19/189 is 10.1%; 9.7% was the *revenue* ratio. A sentence
   * about units must not carry a revenue number.
   */
  const unitAttainment = targets.group.unitAttainment;
  const revenueAttainment = targets.group.revenueAttainment;
  const ceilingUnreachable = targetUnits > totalLeads;

  return (
    <section className="panel c12 ord-targets" style={{ background: 'var(--surface-2)' }}>
      {/* A fixed 280px + 1fr grid squeezed the prose into a one-word-per-line
          ribbon on anything narrower than a laptop. `.split` collapses to a
          single column below 1024. */}
      <div className="panel-bd split">
        {/* A 12% attainment figure invites the reader to conclude the group is
            failing. The real finding is that the target itself is unbuildable,
            so the planning defect leads and the percentage follows it. */}
        <div>
          {ceilingUnreachable ? (
            <>
              <div className="vital-hd" style={{ marginBottom: 6 }}>
                <span className="warn" aria-hidden="true">
                  <Glyph kind="warning" />
                </span>
                <h2 className="t-label" style={{ color: 'var(--warning)' }}>
                  Planning defect · targets
                </h2>
              </div>
              <p className="t-h2" style={{ marginBottom: 6 }}>
                The target cannot be reached at any performance level.
              </p>
              <p className="t-micro">
                Units{' '}
                <span className="num">
                  {unitAttainment === null ? '—' : formatPercentValue(unitAttainment)}
                </span>{' '}
                ({formatNumber(delivered)} of {formatNumber(targetUnits)}) · Revenue{' '}
                <span className="num">
                  {revenueAttainment === null ? '—' : formatPercentValue(revenueAttainment)}
                </span>{' '}
                ({formatCurrency(targets.group.deliveredRevenue)} of{' '}
                {formatCurrency(targets.group.targetRevenue)}) — but both percentages measure the plan, not
                the floor.
              </p>
            </>
          ) : (
            <>
              <h2 className="t-label" style={{ marginBottom: 6 }}>
                Target attainment
              </h2>
              <div style={{ display: 'flex', gap: 'var(--s5)', flexWrap: 'wrap' }}>
                <div>
                  <p className="t-micro">Units</p>
                  <span className="t-metric-s muted">
                    {unitAttainment === null ? '—' : formatPercentValue(unitAttainment)}
                  </span>
                  <p className="t-micro" style={{ marginTop: 2 }}>
                    {formatNumber(delivered)} of {formatNumber(targetUnits)}
                  </p>
                </div>
                <div>
                  <p className="t-micro">Revenue</p>
                  <span className="t-metric-s muted">
                    {revenueAttainment === null ? '—' : formatPercentValue(revenueAttainment)}
                  </span>
                  <p className="t-micro" style={{ marginTop: 2 }}>
                    {formatCurrency(targets.group.deliveredRevenue)} of{' '}
                    {formatCurrency(targets.group.targetRevenue)}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
        <div>
          <div style={{ position: 'relative', marginBottom: 10, marginTop: 22 }}>
            <div className="bar-track" style={{ height: 14 }}>
              <div
                className="bar-fill"
                style={{
                  width: pct(targetUnits > 0 ? delivered / targetUnits : 0),
                  background: 'var(--c-context)',
                }}
              />
            </div>
            {ceilingUnreachable ? (
              <>
                <div
                  style={{
                    position: 'absolute',
                    left: pct(totalLeads / targetUnits),
                    top: -4,
                    bottom: -4,
                    width: 2,
                    background: 'var(--ink)',
                    borderRadius: 1,
                  }}
                  aria-hidden="true"
                />
                <div
                  className="t-micro num bar-annot"
                  style={{ position: 'absolute', left: pct(totalLeads / targetUnits), top: -22, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}
                >
                  {formatNumber(totalLeads)} — every lead that exists
                </div>
              </>
            ) : null}
          </div>
          <p className="t-small" style={{ maxWidth: '84ch' }}>
            {ceilingUnreachable ? (
              <>
                The target totals <span className="num">{counted(targetUnits, 'unit')}</span>. Only{' '}
                <span className="num">{formatNumber(totalLeads)}</span> {plural(totalLeads, 'lead')}{' '}
                {plural(totalLeads, 'was', 'were')} created in the same period.
                Even if every single lead became a sale the group could deliver {formatNumber(totalLeads)} — the
                target is{' '}
                <strong>{formatCompactNumber(targetUnits / Math.max(1, totalLeads), 1)}× total lead volume</strong> and
                cannot be reached by conversion at any performance level. It is shown for continuity and is
                excluded from every health signal on this screen.
              </>
            ) : (
              <>
                Attainment is reported for continuity only. It is never used to colour a branch red on this
                screen, because the target baseline across this dataset is not reliable enough to carry that
                weight.
              </>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
