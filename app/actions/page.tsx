/**
 * Action Center — a prioritised work queue, not a dashboard.
 *
 * Three queues share one set of thresholds derived from the dataset's own
 * dwell medians. The severity rule is printed on the page rather than hidden
 * behind a score.
 */

import Link from 'next/link';
import { computeActionCenter, CRITICAL_LATENESS, STAGE_WEIGHT, WARNING_LATENESS } from '@/lib/analytics/actionCenter';
import { computeLeadTimeline } from '@/lib/analytics/leadTimeline';
import { computeWhatIf } from '@/lib/analytics/whatIf';
import { computeVerdict } from '@/lib/analytics/verdict';
import { getDataset } from '@/lib/data';
import { selectLeads } from '@/lib/filters';
import { formatCurrency, formatNumber } from '@/lib/format';
import {
  hrefWithFilters,
  parseFilterState,
  toFilters,
  toQueryString,
  type SearchParams,
} from '@/lib/url-filters';
import { Breadcrumb, FilterBar, SubsetBar, TopBar } from '@/components/chrome';
import { LeadDrawer } from '@/components/lead-drawer';
import { ActionQueue, type QueueRowData } from '@/components/action-queue';
import { WhatIf } from '@/components/what-if';
import { Glyph } from '@/components/ui';
import type { QueueItem } from '@/lib/analytics/actionCenter';

type QueueId = 'stalled' | 'cold' | 'delays';

const STAGE_LABEL: Record<string, string> = {
  new: 'new',
  contacted: 'contacted',
  test_drive: 'test drive',
  negotiation: 'negotiation',
  order_placed: 'order placed',
};

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function toRow(item: QueueItem, actionLabel: string, href: string, note?: string): QueueRowData {
  return {
    leadId: item.leadId,
    title: `${item.customerName} · ${item.model}`,
    meta: note ?? `${STAGE_LABEL[item.stage] ?? item.stage} since ${DATE.format(item.enteredAt)}`,
    owner: item.repName,
    branch: item.branchName.replace(' Toyota', ''),
    ageDays: item.ageDays,
    lateness: Number.isFinite(item.lateness) ? item.lateness : null,
    moneyLabel: formatCurrency(item.dealValue),
    dealValue: item.dealValue,
    band: item.band,
    severity: item.severity,
    actionLabel,
    href,
  };
}

export default async function ActionCenterPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = await searchParams;
  const dataset = getDataset();
  const state = parseFilterState(query, dataset.branches.map((b) => b.id));
  const filters = toFilters(state);
  const basePath = '/actions';

  const queueParam = typeof query.q === 'string' ? query.q : 'stalled';
  const queue: QueueId = queueParam === 'cold' || queueParam === 'delays' ? queueParam : 'stalled';

  const leads = selectLeads(dataset, filters);
  const actions = computeActionCenter(dataset, filters);
  const verdict = computeVerdict(dataset, filters);
  const whatIf = verdict ? computeWhatIf(dataset, verdict.branchId, verdict.breakStep.peerRate, filters) : null;

  const leadParam = typeof query.lead === 'string' ? query.lead : undefined;
  const timeline = leadParam ? computeLeadTimeline(dataset, leadParam) : null;
  const closeHref = `${basePath}${toQueryString(state, { q: queue === 'stalled' ? undefined : queue })}`;

  const stalledRows = actions.stalled.items.map((item) =>
    toRow(
      item,
      'Chase delivery',
      hrefWithFilters(basePath, state, { q: 'stalled', lead: item.leadId }),
      `Order placed ${DATE.format(item.enteredAt)} · no delivery record`,
    ),
  );
  const coldRows = actions.cold.items.map((item) =>
    toRow(item, 'Call today', hrefWithFilters(basePath, state, { q: 'cold', lead: item.leadId })),
  );

  const branchCounts = dataset.branches
    .map((branch) => ({
      name: branch.name.replace(' Toyota', ''),
      count: actions.stalled.items.filter((item) => item.branchId === branch.id).length,
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);

  const tabs: { id: QueueId; label: string; count: number }[] = [
    { id: 'stalled', label: 'Stalled orders', count: actions.stalled.count },
    { id: 'cold', label: 'Cold leads', count: actions.cold.count },
    { id: 'delays', label: 'Delivery delays', count: actions.delays.count },
  ];

  return (
    <div className="app">
      <TopBar reconciledCount={dataset.reconciliation.reconciledCount} subtitle="Action Center" />
      <FilterBar
        state={state}
        branches={dataset.branches}
        basePath={basePath}
        leadCount={leads.length}
        leadingSlot={
          <>
            <Breadcrumb
              items={[{ label: 'Overview', href: hrefWithFilters('/', state) }, { label: 'Action Center' }]}
            />
            <span style={{ width: 1, height: 18, background: 'var(--rule)', margin: '0 8px' }} aria-hidden="true" />
          </>
        }
      />
      <SubsetBar
        state={state}
        branches={dataset.branches}
        basePath={basePath}
        shown={leads.length}
        total={dataset.leads.length}
      />

      <main id="main">
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--rule)', padding: 'var(--s4) var(--s5) 0' }}>
          <nav className="tabs" aria-label="Queues">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={`${basePath}${toQueryString(state, { q: tab.id === 'stalled' ? undefined : tab.id })}`}
                className={tab.id === queue ? 'tab on' : 'tab'}
                aria-current={tab.id === queue ? 'page' : undefined}
              >
                {tab.label} <span className="ct num">{tab.count}</span>
              </Link>
            ))}
          </nav>
        </div>

        {queue === 'stalled' ? (
          <>
            <div
              style={{
                padding: 'var(--s4) var(--s5)',
                background: 'var(--surface)',
                borderBottom: '1px solid var(--rule)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--s4)',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <p className="t-label" style={{ marginBottom: 3 }}>
                  Booked, undelivered
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span className="t-metric crit">{formatCurrency(actions.stalled.value)}</span>
                  <span className="t-small muted">across {actions.stalled.count} orders</span>
                </div>
              </div>
              <span style={{ width: 1, height: 38, background: 'var(--rule)' }} aria-hidden="true" />
              <div>
                <p className="t-label" style={{ marginBottom: 3 }}>
                  Oldest
                </p>
                <span className="t-metric-s">
                  {actions.stalled.oldestAgeDays === null ? '—' : `${actions.stalled.oldestAgeDays} d`}
                </span>
              </div>
              <span style={{ width: 1, height: 38, background: 'var(--rule)' }} aria-hidden="true" />
              <div>
                <p className="t-label" style={{ marginBottom: 3 }}>
                  Normal order → delivery
                </p>
                <span className="t-metric-s muted">{actions.normalDays.order_placed} d</span>
              </div>
              <span className="sp" />
              {branchCounts.length > 0 ? (
                <div className="queue-branches" style={{ textAlign: 'right' }}>
                  <p className="t-label" style={{ marginBottom: 3 }}>
                    By branch
                  </p>
                  <p className="t-data">
                    {branchCounts.map((entry) => `${entry.name} ${entry.count}`).join(' · ')}
                  </p>
                </div>
              ) : null}
            </div>

            <details className="menu" style={{ padding: 'var(--s3) var(--s5) 0' }}>
              <summary className="btn btn-sm" style={{ display: 'inline-flex' }}>
                Why this order?
              </summary>
              <div
                style={{
                  marginTop: 'var(--s3)',
                  padding: 'var(--s4)',
                  background: 'var(--ink)',
                  color: 'var(--surface)',
                  borderRadius: 'var(--r-md)',
                  maxWidth: 560,
                }}
              >
                <p style={{ fontSize: 12, fontWeight: 600, margin: '0 0 8px' }}>The severity rule</p>
                <code
                  style={{
                    display: 'block',
                    fontFamily: 'var(--mono)',
                    fontSize: 11.5,
                    background: 'rgba(255,255,255,.08)',
                    padding: 'var(--s3)',
                    borderRadius: 'var(--r-sm)',
                    margin: '0 0 10px',
                  }}
                >
                  value in lakh × (age ÷ normal days) × stage weight
                </code>
                <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,.75)', margin: 0 }}>
                  Stage weights: order placed {STAGE_WEIGHT.order_placed.toFixed(1)} · negotiation{' '}
                  {STAGE_WEIGHT.negotiation.toFixed(1)} · test drive {STAGE_WEIGHT.test_drive.toFixed(1)} ·
                  contacted {STAGE_WEIGHT.contacted.toFixed(1)} · new {STAGE_WEIGHT.new.toFixed(1)}. Money
                  already committed outranks money still being discussed. A row is critical past{' '}
                  {CRITICAL_LATENESS}× normal and a warning past {WARNING_LATENESS}×.
                </p>
                {actions.stalled.items[0] ? (
                  <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,.75)', marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.16)' }}>
                    Top row: {actions.stalled.items[0].customerName} —{' '}
                    {(actions.stalled.items[0].dealValue / 100000).toFixed(1)} ×{' '}
                    {actions.stalled.items[0].lateness.toFixed(1)} × {STAGE_WEIGHT.order_placed.toFixed(1)} ={' '}
                    <span className="num">{actions.stalled.items[0].severity.toFixed(0)}</span>
                  </p>
                ) : null}
              </div>
            </details>

            <ActionQueue
              rows={stalledRows}
              queueName="stalled-orders"
              emptyTitle="Every stalled order is being chased"
              emptyDetail="No placed order on this selection is missing a delivery record. Nothing here needs you today."
            />
          </>
        ) : null}

        {queue === 'cold' ? (
          <>
            <div
              style={{
                padding: 'var(--s4) var(--s5)',
                background: 'var(--surface)',
                borderBottom: '1px solid var(--rule)',
              }}
            >
              <p className="t-label" style={{ marginBottom: 8 }}>
                Thresholds, derived from this dataset&rsquo;s dwell medians
              </p>
              <div style={{ display: 'flex', gap: 'var(--s5)', flexWrap: 'wrap' }}>
                {actions.coldThresholds.map((threshold) => (
                  <div key={threshold.stage}>
                    <p className="t-micro">Waiting at {STAGE_LABEL[threshold.stage] ?? threshold.stage}</p>
                    <p className="t-data">
                      cold after <span className="num">{threshold.coldAfterDays} d</span>
                      <span className="dim"> (median {threshold.normalDays} d)</span>
                    </p>
                  </div>
                ))}
              </div>
              <p className="t-small" style={{ marginTop: 'var(--s3)', maxWidth: '86ch' }}>
                A lead is cold once it has idled twice as long as its stage normally takes to advance. Stalled
                orders are excluded — they have their own queue, and listing them twice would train you to
                ignore one of the counts.
              </p>
            </div>
            <ActionQueue
              rows={coldRows}
              queueName="cold-leads"
              emptyTitle="No lead has gone cold"
              emptyDetail="Every open lead on this selection is still inside the normal window for its stage."
            />
          </>
        ) : null}

        {queue === 'delays' ? (
          <div style={{ padding: 'var(--s5)' }}>
            <div className="panel">
              <header className="panel-hd">
                <div>
                  <h2 className="t-h2">Delivery delays</h2>
                  <p className="t-micro" style={{ marginTop: 2 }}>
                    {actions.delays.count} of {actions.delays.totalDeliveries} deliveries took longer than 21
                    days
                  </p>
                </div>
                <span className="chip">already delivered</span>
              </header>
              <div className="panel-bd" style={{ paddingBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--s3)', marginBottom: 'var(--s4)' }}>
                  <span className="dim" style={{ marginTop: 3 }}>
                    <Glyph kind="info" />
                  </span>
                  <p className="t-small" style={{ maxWidth: '86ch' }}>
                    These cars have already been handed over, so no row here has a live next step. It is kept
                    as a review list for the supply side rather than as work for this morning — which is why
                    it carries no bulk actions.
                  </p>
                </div>
              </div>
              <div className="panel-bd" style={{ paddingTop: 0 }}>
                <p className="t-label" style={{ marginBottom: 8 }}>
                  Recorded cause
                </p>
                <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px var(--s3)', margin: 0, maxWidth: 460 }}>
                  {actions.delays.byReason.map((reason) => (
                    <div key={reason.reason ?? 'none'} style={{ display: 'contents' }}>
                      <dt className={reason.reason === null ? 'dim t-small' : 'muted t-small'}>
                        {reason.reason ?? 'Not recorded'}
                      </dt>
                      <dd className="num t-small" style={{ margin: 0, textAlign: 'right' }}>
                        {reason.count}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="panel-bd" style={{ paddingTop: 0 }}>
                <div className="scrollx">
                  <table className="tbl tbl-hover" style={{ minWidth: 640 }}>
                    <thead>
                      <tr>
                        <th style={{ paddingLeft: 0 }}>Customer</th>
                        <th>Branch</th>
                        <th>Cause</th>
                        <th className="r">Value</th>
                        <th className="r">Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {actions.delays.items.slice(0, 12).map((item) => (
                        <tr key={item.leadId}>
                          <td style={{ paddingLeft: 0 }}>
                            <Link
                              href={hrefWithFilters(basePath, state, { q: 'delays', lead: item.leadId })}
                              scroll={false}
                              className="dp-name"
                            >
                              {item.customerName}
                            </Link>
                          </td>
                          <td className="muted">{item.branchName.replace(' Toyota', '')}</td>
                          <td className="muted">{item.delayReason ?? 'Not recorded'}</td>
                          <td className="r num">{formatCurrency(item.dealValue)}</td>
                          <td className="r num warn">{item.daysToDeliver}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {actions.delays.count > 12 ? (
                  <p className="t-micro" style={{ marginTop: 'var(--s3)' }}>
                    Showing the 12 slowest of {formatNumber(actions.delays.count)}.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {whatIf ? (
          <div className="grid" style={{ paddingTop: 0 }}>
            <WhatIf
              inputs={{
                branchName: whatIf.branchName,
                leads: whatIf.leads,
                baselineRate: whatIf.baselineRate,
                peerRate: whatIf.peerRate,
                baselineContacted: whatIf.baseline.contacted,
                baselineDelivered: whatIf.baseline.delivered,
                branchDownstream: whatIf.branchDownstream,
                peerDownstream: whatIf.peerDownstream,
                averageDealValue: whatIf.averageDealValue,
              }}
            />
          </div>
        ) : null}
      </main>

      {timeline ? <LeadDrawer timeline={timeline} closeHref={closeHref} /> : null}
    </div>
  );
}
