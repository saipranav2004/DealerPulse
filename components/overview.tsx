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
import type { TargetsResult } from '@/lib/analytics/targets';
import type { Verdict } from '@/lib/analytics/verdict';
import type { ForecastResult } from '@/lib/analytics/forecast';
import { TrendChart, type TrendPoint } from '@/components/charts';
import {
  formatCompactNumber,
  formatCurrency,
  formatNumber,
  formatPercentValue,
  formatSignedPercent,
} from '@/lib/format';
import { SOURCE_LABELS, hrefWithFilters, type FilterState } from '@/lib/url-filters';
import { Bar, DeltaPoints, Glyph, LowN, MicroBars, Panel, Rail, RateText, Sparkline, pct } from '@/components/ui';

/* -------------------------------------------------------------------------- */

export function VerdictBand({
  verdict,
  branches,
  filters,
}: {
  verdict: Verdict | null;
  branches: BranchesResult;
  filters: FilterState;
}) {
  if (!verdict) {
    return (
      <section className="verdict">
        <p className="t-eyebrow" style={{ marginBottom: 12 }}>
          Finding
        </p>
        <p className="t-verdict verdict-sentence">
          No branch is materially behind the group on this selection.
        </p>
        <p className="verdict-sub">
          Either the filters have narrowed the data below what a comparison needs, or performance is
          genuinely even. Widen the period or clear a filter to compare the full book.
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
          <p className="verdict-sub">
            Bringing first contact to the group&rsquo;s{' '}
            <span className="fig">{formatPercentValue(verdict.breakStep.peerRate, 0)}</span> would be worth
            about <span className="fig">{formatCurrency(verdict.recoverableValue)}</span> over this period.
            The branch is not losing deals it fought for; it is not entering them.
          </p>
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
            {verdict.neverContacted} of {verdict.leads} {verdict.branchName.replace(' Toyota', '')} leads have
            no <code>contacted</code> event in their history.
          </p>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

export function VitalSigns({
  kpis,
  revenueSeries,
  neverContactedSeries,
  branchWinRates,
  stalled,
  stalledByBranch,
  revenueDelta,
}: {
  kpis: KpiSet;
  revenueSeries: number[];
  neverContactedSeries: number[];
  branchWinRates: { id: string; value: number | null }[];
  stalled: QueueSummary;
  stalledByBranch: number[];
  revenueDelta: number | null;
}) {
  const winScale = 0.45;
  const openMax = Math.max(...kpis.openByStage.map((s) => s.count), 1);

  return (
    <section className="vitals" aria-label="Vital signs">
      <div className="vital">
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
      </div>

      <div className="vital">
        <div className="vital-hd">
          <h2 className="t-label">Win rate</h2>
        </div>
        <p className="vital-val">
          <span className="t-metric">
            <RateText rate={kpis.winRate} />
          </span>
        </p>
        <div className="vital-ft">
          <span className="t-micro num">
            {formatNumber(kpis.deliveredUnits)} of {formatNumber(kpis.totalLeads)}
          </span>
          <svg width="64" height="20" viewBox="0 0 64 20" role="img" aria-label="Branch win rates on a shared scale">
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
      </div>

      <div className="vital">
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
      </div>

      <div className="vital is-risk">
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
            {stalled.count} orders
            {stalled.oldestAgeDays !== null ? ` · to ${stalled.oldestAgeDays} d` : ''}
          </span>
          <MicroBars values={stalledByBranch} label="Stalled orders by branch" />
        </div>
      </div>

      <div className="vital vital-hide-md">
        <div className="vital-hd">
          <h2 className="t-label">Never contacted</h2>
        </div>
        <p className="vital-val">
          <span className="t-metric">{formatNumber(kpis.neverContactedCount)}</span>
          <span className="unit">leads</span>
        </p>
        <div className="vital-ft">
          {kpis.neverContactedRate.value === null ? (
            <LowN n={kpis.neverContactedRate.n} />
          ) : (
            <span className="chip chip-warn">
              <span className="num">{formatPercentValue(kpis.neverContactedRate.value)}</span> of intake
            </span>
          )}
          <Sparkline
            values={neverContactedSeries}
            color="var(--warning)"
            label="Leads never contacted, by month created"
          />
        </div>
      </div>
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
      subtitle="Ranked by win rate · grey tick is the group figure"
      className="c8"
      padded={false}
      footer={
        <p className="t-micro">
          Reading across a row shows cause beside effect: the branch with the isolated first-contact mark
          has the isolated win-rate mark.
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
            <span className="t-label">Win rate</span>
          </div>

          {rows.map((branch) => {
            const focus = branch.branchId === focusBranchId;
            const contact = branch.firstContactRate.value;
            const win = branch.winRate.value;
            return (
              <div key={branch.branchId} className={focus ? 'dp-row is-focus' : 'dp-row'} style={{ display: 'contents' }}>
                <div className="dp-cell">
                  <Link href={hrefWithFilters(`/branch/${branch.branchId}`, filters)} className="dp-name">
                    {branch.name.replace(' Toyota', '')} <span className="dim">{branch.city}</span>
                  </Link>
                </div>
                <div className="dp-cell">
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
                  {win === null ? (
                    <LowN n={branch.winRate.n} />
                  ) : (
                    <>
                      <Rail
                        value={win}
                        benchmark={groupWin}
                        scale={winScale}
                        focus={focus}
                        label={`${branch.name} win rate ${formatPercentValue(win)}`}
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
      className="c4"
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
        <table className="tbl tbl-hover">
          <thead>
            <tr>
              <th style={{ paddingLeft: 16 }}>Customer</th>
              <th>Branch</th>
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
                </td>
                <td className="muted">{item.branchName.replace(' Toyota', '')}</td>
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
      className="c6"
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
export function ForecastPanel({ forecast, filters }: { forecast: ForecastResult; filters: FilterState }) {
  if (forecast.openCount === 0) {
    return (
      <Panel title="What is still coming" className="c6">
        <p className="t-small">No open leads on this selection, so there is nothing left to forecast.</p>
      </Panel>
    );
  }

  const low = forecast.expectedRevenueExcludingStalled;
  const high = forecast.expectedRevenue;

  return (
    <Panel
      title="What is still coming"
      subtitle="Open pipeline weighted by how each stage has actually converted"
      className="c6"
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
export function RevenueTrend({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) return null;
  const first = points[0].value;
  const last = points[points.length - 1].value;
  const change = first > 0 ? (last - first) / first : null;

  return (
    <Panel
      title="Revenue delivered each month"
      subtitle="Cars handed over, by the month they were handed over"
      className="c6"
      aside={
        change !== null ? (
          <span className={change >= 0 ? 'chip chip-pos' : 'chip chip-crit'}>
            <span className="num">{formatSignedPercent(change)}</span> since {points[0].shortLabel}
          </span>
        ) : undefined
      }
      footer={
        <p className="t-micro">
          December is the largest month on record here. Cars ordered earlier in the year complete in
          December, so this line leads the cohort view rather than contradicting it.
        </p>
      }
    >
      <TrendChart points={points} title="Delivered revenue by month" valueLabel="Delivered revenue" />
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */

export function SourceTable({ sources }: { sources: SourcesResult }) {
  const worst = sources.sources.reduce<{ id: string; value: number } | null>((low, row) => {
    const value = row.winRate.value;
    if (value === null) return low;
    return low === null || value < low.value ? { id: row.source, value } : low;
  }, null);

  return (
    <Panel
      title="Lead source"
      subtitle="Win rate against average deal value"
      className="c6"
      padded={false}
      footer={
        worst ? (
          <p className="t-micro">
            <strong style={{ color: 'var(--ink)' }}>{SOURCE_LABELS[worst.id as keyof typeof SOURCE_LABELS]}</strong>{' '}
            converts worst on this selection. Either the leads are unqualified or nobody is calling them back.
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
              <th className="r">Win rate</th>
              <th className="r" style={{ paddingRight: 16 }}>
                Avg deal
              </th>
            </tr>
          </thead>
          <tbody>
            {sources.sources.map((row) => {
              const isWorst = worst !== null && row.source === worst.id;
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
 * arithmetic ceiling on deliveries at a 100% win rate.
 */
export function TargetsContext({ targets, totalLeads }: { targets: TargetsResult; totalLeads: number }) {
  const targetUnits = targets.group.targetUnits;
  const delivered = targets.group.deliveredUnits;
  const attainment = targets.group.revenueAttainment;
  const ceilingUnreachable = targetUnits > totalLeads;

  return (
    <section className="panel c12" style={{ background: 'var(--surface-2)' }}>
      <div
        className="panel-bd"
        style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', gap: 'var(--s7)', alignItems: 'center' }}
      >
        <div>
          <h2 className="t-label" style={{ marginBottom: 6 }}>
            Target attainment
          </h2>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span className="t-metric-s muted">
              {attainment === null ? '—' : formatPercentValue(attainment)}
            </span>
            {ceilingUnreachable ? <span className="chip">baseline under review</span> : null}
          </div>
          <p className="t-micro" style={{ marginTop: 8 }}>
            {formatNumber(delivered)} delivered against {formatNumber(targetUnits)} targeted units
          </p>
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
                The target totals <span className="num">{formatNumber(targetUnits)}</span> units. Only{' '}
                <span className="num">{formatNumber(totalLeads)}</span> leads were created in the same period.
                Even at a 100% win rate the group could deliver {formatNumber(totalLeads)} — the target is{' '}
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
