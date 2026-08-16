/**
 * Lead detail, rendered as a drawer over whatever screen the user was on.
 * Driven by a `?lead=` search param, so it is shareable and the page beneath
 * keeps its scroll position and filters.
 */

import Link from 'next/link';
import { DrawerShell } from '@/components/drawer-shell';
import { Glyph, pct } from '@/components/ui';
import type { LeadTimeline } from '@/lib/analytics/leadTimeline';
import { formatCurrency, formatCurrencyExact, formatNumber } from '@/lib/format';
import { SOURCE_LABELS } from '@/lib/url-filters';
import type { LeadSource, LeadStatus } from '@/lib/types';

const STAGE_LABEL: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  test_drive: 'Test drive',
  negotiation: 'Negotiation',
  order_placed: 'Order placed',
  delivered: 'Delivered',
  lost: 'Lost',
};

const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const TIME = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
  hour12: false,
});

/**
 * Notes in the source data occasionally contain an unrendered `{}` template
 * placeholder. It is highlighted rather than printed as if it were intentional.
 */
function Note({ text }: { text: string }) {
  const parts = text.split('{}');
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, index) => (
        <span key={index}>
          {part}
          {index < parts.length - 1 ? (
            <span
              title="Unrendered template placeholder in the source record"
              style={{
                background: 'var(--warning-wash)',
                color: 'var(--warning)',
                padding: '0 3px',
                borderRadius: 2,
              }}
            >
              {'{}'}
            </span>
          ) : null}
        </span>
      ))}
    </>
  );
}

export function LeadDrawer({ timeline, closeHref }: { timeline: LeadTimeline; closeHref: string }) {
  const lost = timeline.status === 'lost';

  return (
    <DrawerShell closeHref={closeHref} label={`Lead detail — ${timeline.customerName}`}>
      <header className="drawer-hd">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            {timeline.isStalledOrder ? (
              <span className="chip chip-crit">
                <Glyph kind="critical" />
                Money at risk
              </span>
            ) : null}
            {lost ? <span className="chip">Lost</span> : null}
            <span className="t-micro num">{timeline.leadId}</span>
          </div>
          <h2 className="t-h1">{timeline.customerName}</h2>
          <p className="t-small" style={{ marginTop: 2 }}>
            {timeline.model} · <span className="num">{formatCurrencyExact(timeline.dealValue)}</span>
          </p>
        </div>
        <Link href={closeHref} scroll={false} className="btn btn-quiet" aria-label="Close lead detail" style={{ width: 30, padding: 0 }}>
          ×
        </Link>
      </header>

      <div style={{ padding: 'var(--s4)', borderBottom: '1px solid var(--rule)' }}>
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s3) var(--s4)', margin: 0 }}>
          <div>
            <dt className="t-label">Phone</dt>
            <dd className="t-data" style={{ margin: 0 }}>
              {timeline.phone}
            </dd>
          </div>
          <div>
            <dt className="t-label">Source</dt>
            <dd className="t-data" style={{ margin: 0 }}>
              {SOURCE_LABELS[timeline.source as LeadSource] ?? timeline.source}
            </dd>
          </div>
          <div>
            <dt className="t-label">Assigned</dt>
            <dd className="t-data" style={{ margin: 0 }}>
              <Link href={`/rep/${timeline.repId}`} className="dp-name">
                {timeline.repName}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="t-label">Branch</dt>
            <dd className="t-data" style={{ margin: 0 }}>
              <Link href={`/branch/${timeline.branchId}`} className="dp-name">
                {timeline.branchName.replace(' Toyota', '')}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="t-label">Expected close</dt>
            <dd className="t-data" style={{ margin: 0 }}>
              {DATE.format(timeline.expectedCloseDate)}
            </dd>
          </div>
          <div>
            <dt className="t-label">Days past</dt>
            <dd
              className={timeline.daysPastExpectedClose > 0 && timeline.isStalledOrder ? 't-data crit' : 't-data'}
              style={{ margin: 0 }}
            >
              {timeline.daysPastExpectedClose > 0 ? formatNumber(timeline.daysPastExpectedClose) : '—'}
            </dd>
          </div>
        </dl>
      </div>

      <div style={{ padding: 'var(--s4)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--s4)' }}>
          <h3 className="t-h2">Status history</h3>
          <span className="t-micro">gap vs median dwell</span>
        </div>

        <ol className="tl" style={{ listStyle: 'none', margin: 0, padding: 0, paddingLeft: 22 }}>
          {timeline.nodes.map((node, index) => (
            /* The drawer is a transient overlay, so its reveal replays each
               time it opens — unlike the funnel, which argues a point once. */
            <li key={`${node.status}-${index}`} style={{ '--i': index } as React.CSSProperties}>
              {node.gapDays !== null ? (
                <div className={node.overdue ? 'tl-gap over' : 'tl-gap'}>
                  <span className="num">{node.gapDays} d</span>
                  {node.medianDays !== null ? <> · median {node.medianDays} d</> : null}
                  {/*
                    The dwell bar. Scaled so the longer of the two ends at 91%
                    of the track: an overdue stage therefore always shows its
                    fill running visibly past the median tick, which is the
                    whole point of drawing it rather than printing two numbers.
                  */}
                  {node.medianDays !== null && node.medianDays > 0 ? (
                    (() => {
                      const scale = Math.max(node.gapDays, node.medianDays) / 0.91;
                      return (
                        <span
                          className="dwell"
                          role="img"
                          aria-label={`${node.gapDays} days against a median of ${node.medianDays}`}
                        >
                          <span className="dwell-fill" style={{ width: pct(node.gapDays / scale) }} />
                          <span className="dwell-tick" style={{ left: pct(node.medianDays / scale) }} />
                        </span>
                      );
                    })()
                  ) : null}
                </div>
              ) : null}
              <div className={`tl-node ${node.status === 'lost' ? 'bad' : 'done'}`}>
                <div className="tl-hd">
                  <span className="tl-stage">{STAGE_LABEL[node.status]}</span>
                  <span className="tl-ts">
                    {DATE.format(node.timestamp)} · {TIME.format(node.timestamp)}
                  </span>
                  {node.synthetic ? <span className="chip">reconstructed</span> : null}
                </div>
                {node.note ? (
                  <p
                    className="tl-note"
                    style={
                      node.note === 'Full payment received'
                        ? { color: 'var(--ink)', fontWeight: 500 }
                        : undefined
                    }
                  >
                    <Note text={node.note} />
                  </p>
                ) : null}
                {node.status === 'lost' && timeline.lostReason ? (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 'var(--s3)',
                      background: 'var(--critical-wash)',
                      borderRadius: 'var(--r-md)',
                    }}
                  >
                    <p className="t-label" style={{ color: 'var(--critical)', marginBottom: 3 }}>
                      Reason recorded
                    </p>
                    <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                      {timeline.lostReason}
                    </p>
                  </div>
                ) : null}
                {node.status === 'lost' && !timeline.lostReason ? (
                  <p className="t-micro" style={{ marginTop: 6 }}>
                    No reason was recorded for this loss.
                  </p>
                ) : null}
              </div>
            </li>
          ))}

          {timeline.openDwell ? (
            <li>
              <div
                className={timeline.openDwell.overdue ? 'tl-gap over' : 'tl-gap'}
                style={
                  timeline.openDwell.overdue
                    ? {
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 4,
                        padding: 'var(--s3)',
                        borderLeftWidth: 3,
                        marginBottom: 'var(--s3)',
                      }
                    : undefined
                }
              >
                {timeline.openDwell.overdue ? (
                  <>
                    <span
                      style={{
                        fontSize: 19,
                        fontWeight: 600,
                        fontFamily: 'var(--mono)',
                        letterSpacing: '-.02em',
                      }}
                    >
                      {formatNumber(timeline.openDwell.days)} days
                    </span>
                    <span style={{ fontSize: 11.5 }}>
                      median for this stage is <span className="num">{timeline.openDwell.medianDays} d</span>
                      {timeline.openDwell.ratio !== null ? (
                        <>
                          {' '}
                          · this is <span className="num">{timeline.openDwell.ratio.toFixed(1)}×</span> over
                        </>
                      ) : null}
                    </span>
                    <div
                      style={{
                        width: '100%',
                        height: 6,
                        background: 'var(--critical-wash)',
                        borderRadius: 2,
                        position: 'relative',
                        marginTop: 4,
                      }}
                    >
                      <div style={{ width: '100%', height: '100%', background: 'var(--critical)', borderRadius: 2 }} />
                      {timeline.openDwell.ratio !== null && timeline.openDwell.ratio > 1 ? (
                        <div
                          style={{
                            position: 'absolute',
                            left: `${(1 / timeline.openDwell.ratio) * 100}%`,
                            top: -3,
                            bottom: -3,
                            width: 2,
                            background: 'var(--ink)',
                          }}
                          aria-hidden="true"
                        />
                      ) : null}
                    </div>
                    <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
                      black tick = where a normal move would have completed
                    </span>
                  </>
                ) : (
                  <>
                    <span className="num">{timeline.openDwell.days} d</span> waiting
                    {timeline.openDwell.medianDays !== null ? <> · median {timeline.openDwell.medianDays} d</> : null}
                  </>
                )}
              </div>
              <div className="tl-node now">
                <div className="tl-hd">
                  <span className="tl-stage">Waiting at {STAGE_LABEL[timeline.status].toLowerCase()}</span>
                  <span className="tl-ts">now · 31 Dec 2025</span>
                </div>
                {timeline.isStalledOrder ? (
                  <p className="tl-note">No delivery record exists for this lead.</p>
                ) : null}
              </div>
            </li>
          ) : null}
        </ol>

        {timeline.reconciled ? (
          <div
            style={{
              marginTop: 'var(--s4)',
              paddingTop: 'var(--s3)',
              borderTop: '1px solid var(--rule)',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <span className="dim" style={{ marginTop: 3 }}>
              <Glyph kind="info" />
            </span>
            <p className="t-micro">
              This record&rsquo;s terminal event was reconstructed during load — one of the 14 reconciled
              records. Its outcome is known from <code>status</code>; the transition was never written to
              history.
            </p>
          </div>
        ) : null}

        <p className="t-micro" style={{ marginTop: 'var(--s4)' }}>
          Total deal value <span className="num">{formatCurrency(timeline.dealValue)}</span>
        </p>
      </div>
    </DrawerShell>
  );
}
