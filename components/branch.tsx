/**
 * Branch detail modules. The benchmark funnel is the centrepiece: the break
 * step is promoted structurally and typographically, so it reads first even
 * with all colour removed.
 */

import Link from 'next/link';
import type { FunnelComparison } from '@/lib/analytics/funnel';
import type { CycleTimeResult } from '@/lib/analytics/cycleTime';
import type { LossAnalysisResult } from '@/lib/analytics/lossAnalysis';
import type { RepRollup, RepsResult } from '@/lib/analytics/reps';
import type { TargetsResult } from '@/lib/analytics/targets';
import { counted, formatCurrency, formatDurationHours, formatNumber, formatPercentValue, plural } from '@/lib/format';
import { hrefWithFilters, type FilterState } from '@/lib/url-filters';
import { Bar, DeltaPoints, Glyph, LowN, Panel, RateText, pct } from '@/components/ui';
import { InsufficientData } from '@/components/states';
import type { Branch, FunnelStage } from '@/lib/types';

const STAGE_LABEL: Record<FunnelStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  test_drive: 'Test drive',
  negotiation: 'Negotiation',
  order_placed: 'Order placed',
  delivered: 'Delivered',
};

/* -------------------------------------------------------------------------- */

export function BranchHeader({
  branch,
  leads,
  winRate,
  winRateVsBenchmark,
  deliveredRevenue,
  deliveredUnits,
  managers,
  filters,
}: {
  branch: Branch;
  leads: number;
  winRate: React.ReactNode;
  winRateVsBenchmark: number | null;
  deliveredRevenue: number;
  deliveredUnits: number;
  managers: RepRollup[];
  filters: FilterState;
}) {
  const idleManagers = managers.filter((manager) => manager.hasNoLeads);

  return (
    <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--rule)', padding: 'var(--s5)' }}>
      {/* `auto auto` for the two stat columns squeezed the identity block to a
          one-word-per-line ribbon on a phone. `.ent-head` gives the stats their
          own row below 768 instead. */}
      <div className="ent-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s3)', flexWrap: 'wrap' }}>
            <h1 className="t-h1">{branch.name}</h1>
            <span className="t-small muted">
              {branch.city} · {branch.id}
            </span>
          </div>
          <p className="t-small" style={{ marginTop: 6 }}>
            {managers.length > 0 ? (
              <>
                Manager <strong style={{ color: 'var(--ink)' }}>{managers[0].name}</strong> ·{' '}
              </>
            ) : null}
            {counted(leads, 'lead')} in this period
          </p>
        </div>
        <div style={{ borderLeft: '1px solid var(--rule)', paddingLeft: 'var(--s5)' }}>
          <p className="t-label" style={{ marginBottom: 4 }}>
            Leads that became a sale
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span className="t-metric-s">{winRate}</span>
            {winRateVsBenchmark !== null ? (
              <span className={winRateVsBenchmark < 0 ? 'chip chip-crit num' : 'chip chip-pos num'}>
                <DeltaPoints points={winRateVsBenchmark * 100} /> vs group
              </span>
            ) : null}
          </div>
        </div>
        <div style={{ borderLeft: '1px solid var(--rule)', paddingLeft: 'var(--s5)' }}>
          <p className="t-label" style={{ marginBottom: 4 }}>
            Delivered revenue
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="t-metric-s">{formatCurrency(deliveredRevenue)}</span>
            <span className="t-micro num">{deliveredUnits} units</span>
          </div>
        </div>
      </div>

      {idleManagers.length > 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--s3)',
            marginTop: 'var(--s4)',
            padding: 'var(--s3)',
            background: 'var(--warning-wash)',
            borderRadius: 'var(--r-md)',
          }}
        >
          <span className="warn" style={{ marginTop: 3, flex: 'none' }}>
            <Glyph kind="warning" />
          </span>
          <div>
            <p className="t-small" style={{ color: 'var(--ink)' }}>
              <strong>
                {idleManagers.map((m) => m.name).join(', ')} hold{idleManagers.length === 1 ? 's' : ''} no
                leads.
              </strong>{' '}
              The branch manager is assigned zero pipeline, so every lead sits with a sales officer. This is
              true at all five branches — a structural choice rather than a fault of this branch — but it
              means no one here carries a book against which a manager&rsquo;s own follow-up discipline
              could be measured.
            </p>
            <Link
              href={hrefWithFilters('/', filters)}
              className="btn btn-quiet btn-sm"
              style={{ marginTop: 6, paddingLeft: 0 }}
            >
              Compare branches →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The benchmark funnel. Two bars per stage: the pale bar is the same lead pool
 * at peer rates, the solid bar is reality. The widening gap between them is
 * the loss, drawn as area rather than asserted in a caption.
 */
export function BenchmarkFunnel({
  comparison,
  branchName,
  minSample = 10,
}: {
  comparison: FunnelComparison;
  branchName: string;
  minSample?: number;
}) {
  const total = comparison.leads || 1;
  const breakKey = comparison.breakStep ? `${comparison.breakStep.from}-${comparison.breakStep.to}` : null;

  return (
    <Panel
      title="Conversion funnel"
      subtitle={`Solid = ${branchName.replace(' Toyota', '')} · pale = the same ${counted(comparison.leads, 'lead')} at peer rates`}
      className="c7"
      aside={<span className="chip"><span className="num">{comparison.leads}</span> leads</span>}
      footer={
        comparison.breakStep ? (
          <p className="t-micro">
            {/*
              "Every step trails the peer group" was printed whenever a worst
              step existed — including for branches that beat their peers at
              four steps out of five, which made the caption contradict the
              deltas printed directly above it. The claim is now tested.
            */}
            {comparison.steps.every((s) => s.deltaPoints < 0)
              ? 'Every step trails the peer group, but one loses '
              : 'The single largest loss is '}
            <strong style={{ color: 'var(--ink)' }}>
              {Math.round(comparison.breakStep.leadsLost)} of{' '}
              {counted(comparison.breakStep.fromCount, 'lead')} in a
              single move
            </strong>
            . At peer rates {comparison.leads === 1 ? 'that lead' : `those ${formatNumber(comparison.leads)} leads`} would have produced{' '}
            <span className="num">{comparison.deliveriesAtPeerRates.toFixed(0)}</span> deliveries;{' '}
            {/* "instead of" implies the peer figure is the better one. It is
                not always — several branches are ahead of their peers. */}
            this branch produced <span className="num">{comparison.actualDeliveries}</span>.
          </p>
        ) : (
          <p className="t-micro">
            No step falls behind the peer group by more than chance. A healthy funnel should look
            unremarkable.
          </p>
        )
      }
    >
      <div data-funnel="idle">
        {comparison.stages.map((stage, index) => {
          const step = comparison.steps[index];
          const isBreak = step !== undefined && breakKey === `${step.from}-${step.to}`;
          const last = index === comparison.stages.length - 1;

          const prevStage = index > 0 ? comparison.stages[index - 1] : null;
          const droppedHere = prevStage ? prevStage.count - stage.count : 0;
          /* The pale bar behind each stage is the peer group's shape, and it
             carried no number anywhere on the page. */
          const peerGap = stage.peerCount - stage.count;

          return (
            <div key={stage.stage}>
              <div className={index === 0 ? 'fnl-stage is-first' : 'fnl-stage'}>
                {/*
                  The bar answers "how many"; the panel answers the two
                  questions the bar provokes — how many did not get here, and
                  what would the peer group have had at this point. Hover and
                  keyboard focus reveal the same panel.
                */}
                <div className="fnl-tip" role="note">
                  <p className="fnl-tip-h">{STAGE_LABEL[stage.stage]}</p>
                  <p className="fnl-tip-r">
                    <span className="num">{formatNumber(stage.count)}</span> of{' '}
                    <span className="num">{formatNumber(total)}</span> leads reach this stage
                  </p>
                  {prevStage ? (
                    <p className="fnl-tip-r">
                      <span className="num">{formatNumber(droppedHere)}</span>{' '}
                      {plural(droppedHere, 'lead', 'leads')} did not arrive from{' '}
                      {STAGE_LABEL[prevStage.stage].toLowerCase()}
                    </p>
                  ) : null}
                  <p className="fnl-tip-r">
                    {peerGap === 0 ? (
                      <>Peers would be at the same count</>
                    ) : (
                      <>
                        Peers would have <span className="num">{formatNumber(stage.peerCount)}</span> here —{' '}
                        <span className={peerGap > 0 ? 'warn' : 'pos'}>
                          {peerGap > 0 ? `${formatNumber(peerGap)} more` : `${formatNumber(-peerGap)} fewer`}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <span
                  className="fnl-lbl"
                  style={last ? { color: 'var(--ink)', fontWeight: 600 } : undefined}
                >
                  {STAGE_LABEL[stage.stage]}
                </span>
                <div className="fnl-track">
                  <div className="fnl-ghost" style={{ width: pct(stage.peerCount / total) }} />
                  {/*
                    The signature moment.

                    On first paint the solid bar grows from zero while the pale
                    peer bar is drawn at full size and never moves — the race
                    between them *is* the argument this page makes, so it is
                    the one place motion carries information rather than
                    attention. It animates `transform`, never `width`, so no
                    layout is triggered and nothing shifts. Staggered 60ms per
                    stage; skipped entirely under reduced motion.
                  */}
                  <div
                    className={`fnl-bar-grow ${comparison.breakStep ? 'fnl-real' : 'fnl-real ok'}`}
                    style={
                      {
                        width: pct(stage.count / total),
                        '--stagger': `${index * 60}ms`,
                      } as React.CSSProperties
                    }
                  />
                </div>
                <span className="fnl-ct" style={last ? { fontWeight: 600 } : undefined}>
                  {stage.count}
                </span>
              </div>

              {step ? (
                <div className={isBreak ? 'fnl-trans brk' : 'fnl-trans'}>
                  <span className="fnl-arrow">↓ {STAGE_LABEL[step.to].toLowerCase()}</span>
                  <div className="fnl-tin">
                    {step.fromCount < minSample ? (
                      <LowN n={step.fromCount} />
                    ) : (
                      <>
                        <span className="fnl-pct">{formatPercentValue(step.branchRate, 0)}</span>
                        <span className="fnl-bench">other branches {formatPercentValue(step.peerRate, 0)}</span>
                        <span className="fnl-delta">
                          <DeltaPoints points={step.deltaPoints} /> points
                        </span>
                        <span className="fnl-lost">
                          {isBreak
                            ? `${step.leadsLost} of ${counted(step.fromCount, 'lead')} leave here${step.from === 'new' ? ' — never called' : ''}`
                            : `${step.leadsLost} lost`}
                        </span>
                      </>
                    )}
                  </div>
                  <span />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */

export function CycleTimePanel({
  branch,
  group,
}: {
  branch: CycleTimeResult;
  group: CycleTimeResult;
}) {
  const rows = branch.dwell.map((step, index) => ({
    step,
    groupMedian: group.dwell[index]?.medianDays ?? null,
  }));
  const anySlow = rows.some(
    (row) =>
      row.step.medianDays !== null && row.groupMedian !== null && row.step.medianDays > row.groupMedian,
  );

  return (
    <Panel
      title="Cycle time"
      subtitle="branch median vs group median"
      padded={false}
      footer={
        <p className="t-micro">
          {anySlow ? (
            <>
              Slower at some stages, but never dramatically.{' '}
              <strong style={{ color: 'var(--ink)' }}>Speed is not the problem — starting is.</strong>
            </>
          ) : (
            <>This branch moves at or faster than the group median at every stage.</>
          )}
        </p>
      }
    >
      <div className="scrollx">
      <table className="tbl tbl-rc">
        <thead>
          <tr>
            <th style={{ paddingLeft: 16 }}>Stage move</th>
            <th className="r">Branch</th>
            <th className="r">Group</th>
            <th className="r" style={{ paddingRight: 16 }}>
              Difference
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ step, groupMedian }) => {
            const delta =
              step.medianDays !== null && groupMedian !== null ? step.medianDays - groupMedian : null;
            return (
              <tr key={`${step.from}-${step.to}`}>
                <td data-rc="id" style={{ paddingLeft: 16 }}>
                  {STAGE_LABEL[step.from]} → {STAGE_LABEL[step.to].toLowerCase()}
                </td>
                <td className="r num" data-l="Branch">{step.medianDays === null ? '—' : `${step.medianDays} d`}</td>
                <td className="r num dim" data-l="Group">{groupMedian === null ? '—' : `${groupMedian} d`}</td>
                <td
                  className={delta !== null && delta > 0 ? 'r num warn' : 'r num dim'}
                  data-l="Difference"
                  style={{ paddingRight: 16 }}
                >
                  {delta === null ? '—' : delta > 0 ? `+${delta}` : delta}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
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

export function BranchLossPanel({ loss }: { loss: LossAnalysisResult }) {
  const max = Math.max(...loss.byStage.map((s) => s.count), 1);
  const seq = ['var(--c-seq-4)', 'var(--c-seq-3)', 'var(--c-seq-2)', 'var(--c-seq-1)'];
  const topStage = loss.byStage[0];

  return (
    <Panel
      title="Where deals die"
      aside={<span className="t-micro num">{loss.lostCount} lost</span>}
      footer={
        topStage && topStage.stage === 'new' ? (
          <p className="t-micro">
            The largest single reason is not competitive — it is{' '}
            <strong style={{ color: 'var(--ink)' }}>absence</strong>. {counted(topStage.count, 'lead')}{' '}
            {plural(topStage.count, 'has', 'have')} no recorded
            contact at all.
          </p>
        ) : undefined
      }
    >
      {loss.lostCount === 0 ? (
        <p className="t-small">No lost leads on this selection.</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 'var(--s4)' }}>
            {loss.byStage.map((stage, index) => (
              <div key={stage.stage}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span className="t-small">{LOSS_STAGE_LABEL[stage.stage] ?? stage.stage}</span>
                  <span className="num" style={{ fontSize: 12 }}>
                    {stage.count}
                  </span>
                </div>
                <Bar value={stage.count} max={max} color={seq[index] ?? 'var(--c-seq-1)'} height={9} />
              </div>
            ))}
          </div>
          <p className="t-label" style={{ marginBottom: 8, paddingTop: 'var(--s3)', borderTop: '1px solid var(--rule)' }}>
            Recorded reason
          </p>
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px var(--s3)', fontSize: 12, margin: 0 }}>
            {loss.byReason.map((reason) => (
              <div key={reason.reason ?? 'none'} style={{ display: 'contents' }}>
                <dt className={reason.reason === null ? 'dim' : 'muted'}>
                  {reason.reason ?? 'Not recorded'}
                </dt>
                <dd className={reason.reason === null ? 'num dim' : 'num'} style={{ margin: 0, textAlign: 'right' }}>
                  {reason.count}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The company-wide rep distribution. Five accent ticks clustered at one end,
 * with the gap to the next rep drawn, is what proves "systemic" faster than a
 * sentence can assert it.
 */
export function DistributionStrip({
  allReps,
  branchRepIds,
  branchName,
}: {
  allReps: RepRollup[];
  branchRepIds: string[];
  branchName: string;
}) {
  const rankable = allReps
    .filter((rep) => rep.winRate.value !== null)
    .sort((a, b) => (a.winRate.value ?? 0) - (b.winRate.value ?? 0));
  if (rankable.length < 5) return null;

  const scale = 0.6;
  const inBranch = (rep: RepRollup) => branchRepIds.includes(rep.repId);
  const branchReps = rankable.filter(inBranch);
  if (branchReps.length === 0) return null;

  const branchWorstRank = rankable.findIndex(inBranch);
  const branchBest = Math.max(...branchReps.map((rep) => rep.winRate.value ?? 0));
  const nextAbove = rankable.find((rep) => !inBranch(rep) && (rep.winRate.value ?? 0) > branchBest);
  const gapPoints = nextAbove ? ((nextAbove.winRate.value ?? 0) - branchBest) * 100 : null;
  /*
   * The claim is statistical: several people do not independently land at the
   * bottom of a distribution. With one or two reps that is simply not true —
   * somebody has to be last — so the sentence is withheld below three rather
   * than emitted as "1 individuals do not independently arrive".
   */
  const MIN_REPS_FOR_SYSTEMIC_CLAIM = 3;
  const allAtBottom =
    branchReps.length >= MIN_REPS_FOR_SYSTEMIC_CLAIM &&
    rankable.slice(0, branchReps.length).every(inBranch);

  return (
    <div className="dist-wrap" style={{ padding: 'var(--s4) var(--s4) var(--s2)', borderBottom: '1px solid var(--rule)' }}>
      <p className="t-label" style={{ marginBottom: 8 }}>
        All {rankable.length} sales officers, company-wide, by share of leads that became a sale
      </p>
      <div className="dist">
        {allAtBottom ? (
          <div className="dist-band" style={{ left: 0, width: pct(branchBest / scale) }} />
        ) : null}
        {gapPoints !== null && allAtBottom ? (
          <div
            className="dist-gap"
            style={{
              left: pct(branchBest / scale),
              width: pct(((nextAbove?.winRate.value ?? 0) - branchBest) / scale),
            }}
          />
        ) : null}
        <div className="dist-axis" />
        {rankable.map((rep) => (
          <div
            key={rep.repId}
            className={inBranch(rep) ? 'dist-t on' : 'dist-t'}
            style={{ left: pct((rep.winRate.value ?? 0) / scale) }}
            title={`${rep.name} ${formatPercentValue(rep.winRate.value ?? 0)}`}
          />
        ))}
        <div style={{ position: 'absolute', left: 0, top: 34 }} className="t-micro num">
          0%
        </div>
        <div style={{ position: 'absolute', right: 0, top: 34 }} className="t-micro num">
          60%
        </div>
      </div>
      {allAtBottom && gapPoints !== null ? (
        <p className="t-small" style={{ marginTop: 6 }}>
          {branchName.replace(' Toyota', '')}&rsquo;s {branchReps.length} officers occupy the{' '}
          <strong style={{ color: 'var(--ink)' }}>
            {branchReps.length} lowest positions in the company
          </strong>
          , and the next rep sits {gapPoints.toFixed(1)} points clear of the best of them.{' '}
          {branchReps.length} individuals do not independently arrive at the bottom of a {rankable.length}
          -person distribution —{' '}
          <strong style={{ color: 'var(--ink)' }}>this is a branch system, not weak hires.</strong>
        </p>
      ) : (
        <p className="t-small" style={{ marginTop: 6 }}>
          {branchName.replace(' Toyota', '')}&rsquo;s{' '}
          {branchReps.length === 1 ? 'officer sits' : 'officers are spread through the company distribution; the lowest sits'}{' '}
          at rank {branchWorstRank + 1} of {rankable.length}.
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

type SortKey = 'name' | 'leads' | 'contacted' | 'win' | 'revenue' | 'firstContact' | 'open' | 'stalled';

/**
 * `foldsAway` columns drop out below 960px. What stays is the branch
 * diagnosis itself — leads in, whether they were called, whether they closed,
 * and how long the first call took.
 */
const SORT_COLUMNS: { key: SortKey; label: string; numeric: boolean; foldsAway?: boolean }[] = [
  { key: 'name', label: 'Rep', numeric: false },
  { key: 'leads', label: 'Leads', numeric: true },
  { key: 'contacted', label: 'Contacted', numeric: true },
  { key: 'win', label: 'Leads → sale', numeric: true },
  { key: 'revenue', label: 'Revenue', numeric: true, foldsAway: true },
  { key: 'firstContact', label: 'Median 1st contact', numeric: true },
  { key: 'open', label: 'Open', numeric: true, foldsAway: true },
  { key: 'stalled', label: 'Stalled', numeric: true, foldsAway: true },
];

function sortValue(rep: RepRollup, key: SortKey): number | string {
  switch (key) {
    case 'name':
      return rep.name;
    case 'leads':
      return rep.leadsHandled;
    case 'contacted':
      return rep.contactedLeads / Math.max(1, rep.leadsHandled);
    case 'win':
      return rep.winRate.value ?? -1;
    case 'revenue':
      return rep.deliveredRevenue;
    case 'firstContact':
      return rep.medianHoursToFirstContact ?? Number.MAX_SAFE_INTEGER;
    case 'open':
      return rep.openCount;
    case 'stalled':
      return rep.stalledCount;
  }
}

export function RepTable({
  reps,
  allReps,
  branchName,
  branchId,
  sort,
  dir,
  basePath,
  filters,
  groupMedianHours,
}: {
  reps: RepsResult;
  allReps: RepRollup[];
  branchName: string;
  branchId: string;
  sort: SortKey;
  dir: 'asc' | 'desc';
  basePath: string;
  filters: FilterState;
  groupMedianHours: number | null;
}) {
  const officers = [...reps.active].sort((a, b) => {
    const left = sortValue(a, sort);
    const right = sortValue(b, sort);
    const compare =
      typeof left === 'string' && typeof right === 'string'
        ? left.localeCompare(right)
        : Number(left) - Number(right);
    return dir === 'asc' ? compare : -compare;
  });
  const idle = reps.inactive;

  return (
    <Panel
      title="Sales officers"
      subtitle="Sortable · select a row for the rep scorecard"
      className="c12"
      padded={false}
      aside={
        <span className="t-micro">
          Company median rep sale rate{' '}
          <span className="num">
            {(() => {
              const rates = allReps
                .map((rep) => rep.winRate.value)
                .filter((value): value is number => value !== null)
                .sort((a, b) => a - b);
              return rates.length > 0
                ? formatPercentValue(rates[Math.ceil((rates.length - 1) * 0.5)])
                : '—';
            })()}
          </span>
        </span>
      }
      footer={
        groupMedianHours !== null ? (
          <p className="t-micro">
            Group median time to first contact is{' '}
            <span className="num">{formatDurationHours(groupMedianHours)}</span>. Reps slower than that are
            marked.
          </p>
        ) : undefined
      }
    >
      <DistributionStrip
        allReps={allReps}
        branchRepIds={reps.reps.map((rep) => rep.repId)}
        branchName={branchName}
      />
      <div className="scrollx">
        <table className="tbl tbl-hover tbl-fold tbl-rc">
          <thead>
            <tr>
              {SORT_COLUMNS.map((column) => {
                const active = column.key === sort;
                const nextDir = active && dir === 'desc' ? 'asc' : 'desc';
                return (
                  <th
                    key={column.key}
                    className={
                      [column.numeric ? 'r' : '', column.foldsAway ? 'fold' : ''].filter(Boolean).join(' ') ||
                      undefined
                    }
                    style={column.key === 'name' ? { paddingLeft: 16 } : undefined}
                    aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <Link
                      href={`${basePath}${hrefWithFilters('', filters, { sort: column.key, dir: nextDir })}`}
                      className="sortbtn"
                      data-active={active ? 'true' : 'false'}
                      data-dir={active ? dir : undefined}
                      scroll={false}
                    >
                      {column.label}
                      <span className={active ? 'arrow' : 'arrow is-idle'} aria-hidden="true">
                        ↓
                      </span>
                    </Link>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {officers.map((rep) => {
              const slow =
                rep.medianHoursToFirstContact !== null &&
                groupMedianHours !== null &&
                rep.medianHoursToFirstContact > groupMedianHours;
              const contacted = rep.contactedRate.value;
              return (
                <tr key={rep.repId}>
                  <td className="pin" data-rc="id" style={{ paddingLeft: 16 }}>
                    <Link href={hrefWithFilters(`/rep/${rep.repId}`, filters)} className="dp-name">
                      <strong>{rep.name}</strong>
                    </Link>
                  </td>
                  <td className="r num" data-l="Leads">{rep.leadsHandled}</td>
                  <td
                    className={contacted !== null && contacted < 0.5 ? 'r num crit' : 'r num'}
                    data-l="Contacted"
                  >
                    <RateText rate={rep.contactedRate} />
                  </td>
                  <td className="r num" data-l="Leads → sale">
                    <RateText rate={rep.winRate} />
                  </td>
                  <td className="r num fold" data-rc="show" data-l="Revenue">{formatCurrency(rep.deliveredRevenue)}</td>
                  <td className={slow ? 'r num warn' : 'r num'} data-l="Median 1st contact">
                    {rep.medianHoursToFirstContact === null
                      ? '—'
                      : formatDurationHours(rep.medianHoursToFirstContact)}
                  </td>
                  <td className="r num fold" data-l="Open">{rep.openCount}</td>
                  <td className="r num fold" data-l="Stalled" style={{ paddingRight: 16 }}>
                    {rep.stalledCount}
                  </td>
                </tr>
              );
            })}
            {idle.map((rep) => (
              <tr key={rep.repId} style={{ background: 'var(--surface-2)' }}>
                <td className="pin muted" data-rc="id" style={{ paddingLeft: 16, background: 'var(--surface-2)' }}>
                  <Link href={hrefWithFilters(`/rep/${rep.repId}`, filters)} className="dp-name">
                    {rep.name}
                  </Link>{' '}
                  <span className="chip">{rep.role === 'branch_manager' ? 'manager' : 'no leads'}</span>
                </td>
                <td className="r num dim" data-l="Leads">0</td>
                <td className="dim" data-rc="wide" colSpan={6} style={{ paddingLeft: 24, fontSize: 11.5 }}>
                  No leads assigned — nothing to score
                </td>
              </tr>
            ))}
            {officers.length === 0 && idle.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 'var(--s5)' }}>
                  <InsufficientData n={0} what={`${branchName} on this selection`} />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <span className="sr-only">Branch {branchId}</span>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */

export function BranchTargets({
  targets,
  branchId,
  leads,
}: {
  targets: TargetsResult;
  branchId: string;
  leads: number;
}) {
  const row = targets.branches.find((branch) => branch.branchId === branchId);
  if (!row) return null;

  const unreachable = row.targetUnits > leads;

  return (
    <section className="panel c12" style={{ background: 'var(--surface-2)' }}>
      <div
        className="panel-bd"
        style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 260px) 1fr', gap: 'var(--s7)', alignItems: 'center' }}
      >
        <div>
          <h2 className="t-label" style={{ marginBottom: 4 }}>
            Target attainment
          </h2>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span className="t-metric-s muted">
              {row.unitAttainment === null ? '—' : formatPercentValue(row.unitAttainment)}
            </span>
            {unreachable ? <span className="chip">baseline under review</span> : null}
          </div>
          <p className="t-micro" style={{ marginTop: 6 }}>
            {row.deliveredUnits} delivered against <span className="num">{formatNumber(row.targetUnits)}</span>{' '}
            targeted units
          </p>
        </div>
        <div>
          <div style={{ position: 'relative', marginBottom: 12, marginTop: 22 }}>
            <div className="bar-track" style={{ height: 14 }}>
              <div
                className="bar-fill"
                style={{
                  width: pct(row.targetUnits > 0 ? row.deliveredUnits / row.targetUnits : 0),
                  background: 'var(--c-context)',
                }}
              />
            </div>
            {unreachable ? (
              <>
                <div
                  style={{
                    position: 'absolute',
                    left: pct(leads / row.targetUnits),
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
                  style={{
                    position: 'absolute',
                    left: pct(leads / row.targetUnits),
                    top: -22,
                    transform: 'translateX(-50%)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {leads} — every lead this branch received
                </div>
              </>
            ) : null}
          </div>
          <p className="t-small" style={{ maxWidth: '84ch' }}>
            {unreachable ? (
              <>
                This branch was given a <span className="num">{formatNumber(row.targetUnits)}</span>-unit
                target and received <span className="num">{leads}</span> leads. Even converting{' '}
                <em>every single lead</em> it could have delivered {leads} —{' '}
                <strong>{formatPercentValue(leads / row.targetUnits, 0)} of its target</strong>. The gap
                between {leads} and {formatNumber(row.targetUnits)} is a lead-supply question for the group,
                not a performance question for this branch. Attainment drives no health signal here.
              </>
            ) : (
              <>
                Attainment is reported for continuity only and drives no health signal on this screen.
              </>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
