/**
 * Rep detail — a scorecard usable in a one-to-one.
 *
 * The benchmark is honest about position and honest about context: it shows
 * where a rep stands without printing a rank like "25th of 25", and it
 * promotes the one metric the individual actually controls.
 */

import Link from 'next/link';
import type { FunnelResult } from '@/lib/analytics/funnel';
import type { LossAnalysisResult } from '@/lib/analytics/lossAnalysis';
import type { RepRollup } from '@/lib/analytics/reps';
import { formatCurrency, formatDurationHours, formatNumber, formatPercentValue } from '@/lib/format';
import { hrefWithFilters, type FilterState } from '@/lib/url-filters';
import { LowN, Panel, Rail, RateText, pct } from '@/components/ui';
import type { FunnelStage, Lead } from '@/lib/types';

const STAGE_LABEL: Record<FunnelStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  test_drive: 'Test drive',
  negotiation: 'Negotiation',
  order_placed: 'Order placed',
  delivered: 'Delivered',
};

export function RepBenchmark({
  rep,
  branchName,
  branchWinRate,
  companyMedian,
  peersInBranch,
}: {
  rep: RepRollup;
  branchName: string;
  branchWinRate: number | null;
  companyMedian: number | null;
  peersInBranch: RepRollup[];
}) {
  const scale = 0.6;
  const repRate = rep.winRate.value;
  const branchPeersBelowMedian =
    companyMedian === null
      ? 0
      : peersInBranch.filter((peer) => (peer.winRate.value ?? 1) < companyMedian).length;

  return (
    <div style={{ marginTop: 'var(--s4)', paddingTop: 'var(--s4)', borderTop: '1px solid var(--rule)' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) minmax(240px, 340px)',
          gap: 'var(--s7)',
          alignItems: 'center',
        }}
      >
        <div>
          <p className="t-label" style={{ marginBottom: 10 }}>
            Sale rate in context
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
              <span className="t-small" style={{ width: 150, flex: 'none' }}>
                {rep.name}
              </span>
              {repRate === null ? (
                <LowN n={rep.winRate.n} />
              ) : (
                <>
                  <Rail value={repRate} scale={scale} focus label={`${rep.name}: share of leads that became a sale`} />
                  <span className="num acc" style={{ width: 48, textAlign: 'right', fontWeight: 600 }}>
                    <RateText rate={rep.winRate} />
                  </span>
                </>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
              <span className="t-small muted" style={{ width: 150, flex: 'none' }}>
                {branchName.replace(' Toyota', '')} branch
              </span>
              {branchWinRate === null ? (
                <span className="t-micro dim">insufficient data</span>
              ) : (
                <>
                  <Rail value={branchWinRate} scale={scale} label="Branch share of leads that became a sale" />
                  <span className="num" style={{ width: 48, textAlign: 'right' }}>
                    {formatPercentValue(branchWinRate)}
                  </span>
                </>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
              <span className="t-small muted" style={{ width: 150, flex: 'none' }}>
                Company median rep
              </span>
              {companyMedian === null ? (
                <span className="t-micro dim">insufficient data</span>
              ) : (
                <>
                  <div className="rail">
                    <div className="rail-track" />
                    <div className="rail-bench" style={{ left: pct(companyMedian / scale) }} />
                  </div>
                  <span className="num" style={{ width: 48, textAlign: 'right' }}>
                    {formatPercentValue(companyMedian)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div style={{ borderLeft: '1px solid var(--rule)', paddingLeft: 'var(--s5)' }}>
          {branchPeersBelowMedian >= 2 ? (
            <p className="t-small" style={{ color: 'var(--ink)' }}>
              {rep.name.split(' ')[0]} sits below the company median —{' '}
              <strong>and so do {branchPeersBelowMedian} of their branch colleagues.</strong> Read this as a
              branch pattern first.
            </p>
          ) : (
            <p className="t-small" style={{ color: 'var(--ink)' }}>
              Most of this branch sits at or above the company median, so this is an individual result
              rather than a branch pattern.
            </p>
          )}
          <p className="t-small" style={{ marginTop: 8 }}>
            The single number this rep personally controls is below.
          </p>
        </div>
      </div>
    </div>
  );
}

export function ControllableNumber({
  rep,
  groupNeverContactedRate,
  groupMedianHours,
}: {
  rep: RepRollup;
  groupNeverContactedRate: number | null;
  groupMedianHours: number | null;
}) {
  const never = rep.neverContactedCount;
  const share = rep.neverContactedRate.value;

  return (
    <Panel title="The controllable number" className="c5">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <span className="t-metric">{never}</span>
        <span className="t-small">of {rep.leadsHandled} leads never contacted</span>
      </div>
      <div
        style={{
          height: 10,
          background: 'var(--surface-3)',
          borderRadius: 2,
          overflow: 'hidden',
          marginBottom: 10,
        }}
      >
        <div
          style={{
            width: pct(rep.leadsHandled > 0 ? never / rep.leadsHandled : 0),
            height: '100%',
            background: 'var(--warning)',
          }}
        />
      </div>
      <p className="t-small">
        {share === null ? (
          <>
            Too few leads on this selection to publish a share — the count above is exact.
          </>
        ) : (
          <>
            <strong style={{ color: 'var(--ink)' }}>{formatPercentValue(share)}</strong> of their leads have
            no contact event at all
            {groupNeverContactedRate !== null ? (
              <>
                , against <span className="num">{formatPercentValue(groupNeverContactedRate)}</span> across
                the group
              </>
            ) : null}
            .
          </>
        )}
        {rep.medianHoursToFirstContact !== null ? (
          <>
            {' '}
            When they do make contact the median wait is{' '}
            <span className="num">{formatDurationHours(rep.medianHoursToFirstContact)}</span>
            {groupMedianHours !== null ? (
              <>
                ; the group median is <span className="num">{formatDurationHours(groupMedianHours)}</span>
              </>
            ) : null}
            .
          </>
        ) : null}
      </p>
      <div style={{ marginTop: 'var(--s3)', paddingTop: 'var(--s3)', borderTop: '1px solid var(--rule)' }}>
        <p className="t-micro">
          The share of leads that become a sale depends on lead quality, branch process and luck. This
          number depends on one person,
          which is why it is the one a review should be about.
        </p>
      </div>
    </Panel>
  );
}

export function RepFunnel({ funnel }: { funnel: FunnelResult }) {
  const total = funnel.totalLeads || 1;
  return (
    <Panel
      title="Funnel"
      className="c4"
      aside={<span className="chip"><span className="num">{funnel.totalLeads}</span> leads</span>}
      footer={<p className="t-micro">Stages under 10 leads show counts only — no rate is published.</p>}
    >
      <div>
        {funnel.stages.map((stage, index) => {
          const step = funnel.steps[index];
          const last = index === funnel.stages.length - 1;
          return (
            <div key={stage.stage}>
              <div className="fnl-stage" style={{ gridTemplateColumns: '90px 1fr 34px' }}>
                <span className="fnl-lbl" style={last ? { color: 'var(--ink)', fontWeight: 600 } : undefined}>
                  {STAGE_LABEL[stage.stage]}
                </span>
                <div className="fnl-track" style={{ height: 18 }}>
                  <div className="fnl-real" style={{ height: 18, width: pct(stage.reached / total) }} />
                </div>
                <span className="fnl-ct" style={{ fontSize: 13, fontWeight: last ? 600 : undefined }}>
                  {stage.reached}
                </span>
              </div>
              {step ? (
                <div className="fnl-trans" style={{ gridTemplateColumns: '90px 1fr 34px' }}>
                  <span className="fnl-arrow">↓</span>
                  <div className="fnl-tin">
                    {step.conversion.value === null ? (
                      <LowN n={step.fromCount} note={`${step.fromCount} leads`} />
                    ) : (
                      <span className="fnl-pct">{formatPercentValue(step.conversion.value, 0)}</span>
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

export function RepLossPanel({ loss }: { loss: LossAnalysisResult }) {
  const atNew = loss.byStage.find((stage) => stage.stage === 'new')?.count ?? 0;
  return (
    <Panel title="Lost reasons" className="c3" aside={<span className="t-micro num">{loss.lostCount}</span>}>
      {loss.lostCount === 0 ? (
        <p className="t-small">No lost leads on this selection.</p>
      ) : (
        <>
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '3px var(--s3)', fontSize: 12, margin: 0 }}>
            {loss.byReason.map((reason) => (
              <div key={reason.reason ?? 'none'} style={{ display: 'contents' }}>
                <dt className={reason.reason === null ? 'dim' : 'muted'}>{reason.reason ?? 'Not recorded'}</dt>
                <dd className={reason.reason === null ? 'num dim' : 'num'} style={{ margin: 0, textAlign: 'right' }}>
                  {reason.count}
                </dd>
              </div>
            ))}
          </dl>
          {atNew > 0 ? (
            <div style={{ marginTop: 'var(--s3)', paddingTop: 'var(--s3)', borderTop: '1px solid var(--rule)' }}>
              <p className="t-micro">
                <strong style={{ color: 'var(--ink)' }}>
                  {atNew} of {loss.lostCount}
                </strong>{' '}
                were lost at <code>new</code> — before any conversation happened, so no reason above actually
                applies to them.
              </p>
            </div>
          ) : null}
        </>
      )}
    </Panel>
  );
}

export function RepOpenLeads({
  leads,
  ageOf,
  filters,
  basePath,
}: {
  leads: readonly Lead[];
  ageOf: (lead: Lead) => number;
  filters: FilterState;
  basePath: string;
}) {
  const sorted = [...leads].sort((a, b) => ageOf(b) - ageOf(a));
  const value = sorted.reduce((sum, lead) => sum + lead.dealValue, 0);

  return (
    <Panel
      title="Open leads"
      className="c12"
      padded={false}
      aside={
        <span className="t-micro num">
          {sorted.length} {sorted.length === 1 ? 'lead' : 'leads'} · {formatCurrency(value)}
        </span>
      }
    >
      {sorted.length === 0 ? (
        <div className="panel-bd">
          <p className="t-small">No open leads. Everything assigned to this rep has reached an outcome.</p>
        </div>
      ) : (
        <div className="scrollx">
        <table className="tbl tbl-hover">
          <thead>
            <tr>
              <th style={{ paddingLeft: 16 }}>Customer</th>
              <th>Stage</th>
              <th>Model</th>
              <th className="r">Value</th>
              <th className="r">Idle</th>
              <th style={{ paddingRight: 16 }} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((lead) => {
              const age = ageOf(lead);
              return (
                <tr key={lead.id}>
                  <td style={{ paddingLeft: 16 }}>
                    <strong>{lead.customerName}</strong>
                  </td>
                  <td>
                    <span className="chip">{STAGE_LABEL[lead.status as FunnelStage] ?? lead.status}</span>
                  </td>
                  <td className="muted">{lead.model}</td>
                  <td className="r num">{formatCurrency(lead.dealValue)}</td>
                  <td className={age > 30 ? 'r num crit' : 'r num'}>{formatNumber(age)} d</td>
                  <td className="r" style={{ paddingRight: 16 }}>
                    <Link
                      href={hrefWithFilters(basePath, filters, { lead: lead.id })}
                      scroll={false}
                      className="btn btn-sm"
                    >
                      Open lead
                    </Link>
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

/** The zero-lead case: five branch managers land here. */
export function RepEmptyState({
  rep,
  branchName,
  branchLeads,
  branchNeverContacted,
  filters,
}: {
  rep: RepRollup;
  branchName: string;
  branchLeads: number;
  branchNeverContacted: number;
  filters: FilterState;
}) {
  return (
    <div className="grid">
      <div className="c12 panel">
        <div className="state">
          <div className="state-in">
            <svg
              className="state-mark"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="15" rx="1.5" />
              <path d="M3 10h18M9 5v15" />
            </svg>
            <h2 className="t-h2">No leads are assigned to {rep.name}</h2>
            <p className="t-small">
              {rep.role === 'branch_manager'
                ? 'Branch managers at all five branches carry zero pipeline, so there is no funnel, sale rate or revenue to show here. That is a reporting structure, not a gap in the data.'
                : 'This rep holds no leads on the current selection, so there is nothing to score. Widen the filters to see their full book.'}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link href={hrefWithFilters(`/branch/${rep.branchId}`, filters)} className="btn btn-primary">
                View {branchName.replace(' Toyota', '')} branch performance
              </Link>
              <Link href={hrefWithFilters('/', filters)} className="btn">
                Compare all branches
              </Link>
            </div>
          </div>
        </div>
        <footer className="panel-ft">
          <p className="t-micro">
            <strong style={{ color: 'var(--ink)' }}>What we can still say:</strong> {rep.name} manages a
            branch holding <span className="num">{formatNumber(branchLeads)}</span> leads, of which{' '}
            <span className="num">{formatNumber(branchNeverContacted)}</span> were never contacted. Manager
            accountability is expressed through the branch, because that is where the data attaches.
          </p>
        </footer>
      </div>
    </div>
  );
}
