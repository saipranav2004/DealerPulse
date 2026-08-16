/**
 * "How this was calculated" — reachable from the verdict band.
 *
 * A product that states a conclusion has to be willing to show its working.
 * Every number on this page is computed, not written down.
 */

import Link from 'next/link';
import { computeVerdict } from '@/lib/analytics/verdict';
import { computeActionCenter } from '@/lib/analytics/actionCenter';
import { getDataset, MIN_RATE_DENOMINATOR, MIN_VERDICT_DENOMINATOR, NOW } from '@/lib/data';
import { formatCurrency, formatNumber, formatPercentValue } from '@/lib/format';
import { TopBar, Breadcrumb } from '@/components/chrome';

export default function MethodPage() {
  const dataset = getDataset();
  const verdict = computeVerdict(dataset);
  const actions = computeActionCenter(dataset);

  return (
    <div className="app">
      <TopBar reconciledCount={dataset.reconciliation.reconciledCount} />
      <div className="filterbar">
        <Breadcrumb items={[{ label: 'Overview', href: '/' }, { label: 'How this was calculated' }]} />
      </div>

      <main id="main" className="grid">
        <div className="c8 panel">
          <header className="panel-hd">
            <h1 className="t-h2">How the verdict is derived</h1>
          </header>
          <div className="panel-bd">
            {verdict ? (
              <>
                <p className="t-body muted" style={{ marginBottom: 'var(--s4)' }}>
                  The rule is deliberately simple so it can be checked. Find the branch furthest below the
                  group sale rate, then find the funnel step where that branch loses the most leads{' '}
                  <em>relative to what its peers would have converted</em>. Steps are ranked by leads lost,
                  not by percentage-point gap.
                </p>
                <div className="scrollx">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Step</th>
                      <th className="r">Branch</th>
                      <th className="r">Peers</th>
                      <th className="r">Lost</th>
                      <th className="r">Peers would lose</th>
                      <th className="r">Extra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verdict.steps.map((step) => {
                      const isBreak = step.from === verdict.breakStep.from;
                      return (
                        <tr key={`${step.from}-${step.to}`} className={isBreak ? 'row-focus' : undefined}>
                          <td>
                            {step.from} → {step.to}
                          </td>
                          <td className="r num">{formatPercentValue(step.branchRate, 0)}</td>
                          <td className="r num dim">{formatPercentValue(step.peerRate, 0)}</td>
                          <td className="r num">{step.leadsLost}</td>
                          <td className="r num dim">{step.expectedLost.toFixed(1)}</td>
                          <td className="r num" style={{ fontWeight: isBreak ? 600 : undefined }}>
                            {step.extraLost.toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                <p className="t-small" style={{ marginTop: 'var(--s4)' }}>
                  The largest <strong>Extra</strong> is the break step. Note that{' '}
                  <code>test_drive → negotiation</code> has the widest percentage-point gap, but it operates
                  on a smaller pool, so it costs fewer leads than the first step.
                </p>
                <p className="t-small" style={{ marginTop: 'var(--s3)' }}>
                  Whole-funnel recoverable value is{' '}
                  <span className="num">{verdict.deliveriesAtPeerRates.toFixed(1)}</span> deliveries at peer
                  rates minus <span className="num">{verdict.actualDeliveries}</span> actual ={' '}
                  <span className="num">{verdict.recoverableDeliveries.toFixed(1)}</span> deliveries. Priced
                  at the branch&rsquo;s delivered mix (
                  <span className="num">{formatCurrency(verdict.averageDeliveredValue)}</span>) and at the
                  mean across all its leads (
                  <span className="num">{formatCurrency(verdict.averageDealValue)}</span>), that is{' '}
                  <strong className="num">{formatCurrency(verdict.recoverable.low)}</strong> to{' '}
                  <strong className="num">{formatCurrency(verdict.recoverable.high)}</strong>. Both bases are
                  defensible — recovered leads are drawn from the general pool, but a branch has usually
                  delivered only part of it — so the product quotes the range. Which basis lands on which end
                  is not fixed, so the bounds are sorted rather than assumed: the low figure here is the{' '}
                  {verdict.recoverable.lowBasis}.
                </p>
                <p className="t-small" style={{ marginTop: 'var(--s3)' }}>
                  <strong>This is not the value of fixing first contact.</strong> Raising first contact to
                  the peer rate while holding the branch&rsquo;s own conversion after the call yields{' '}
                  <span className="num">{verdict.firstContactDeliveries.toFixed(1)}</span> extra deliveries,
                  or <strong className="num">{formatCurrency(verdict.firstContact.low)}</strong> to{' '}
                  <strong className="num">{formatCurrency(verdict.firstContact.high)}</strong> — roughly
                  a tenth of the whole-funnel figure. The overview states both, and the what-if simulator on{' '}
                  <code>/actions</code> computes them with this same function.
                </p>
              </>
            ) : (
              <p className="t-small">No branch is materially behind on the full dataset.</p>
            )}
          </div>
        </div>

        <div className="c4 stack">
          <div className="panel">
            <header className="panel-hd">
              <h2 className="t-h2">Rules that apply everywhere</h2>
            </header>
            <div className="panel-bd">
              <dl style={{ margin: 0, display: 'grid', gap: 'var(--s3)' }}>
                <div>
                  <dt className="t-label">Current time</dt>
                  <dd className="t-small" style={{ margin: 0 }}>
                    Pinned to <span className="num">{NOW.toISOString().slice(0, 10)}</span>, the latest
                    activity in the dataset. Never the wall clock.
                  </dd>
                </div>
                <div>
                  <dt className="t-label">Durations</dt>
                  <dd className="t-small" style={{ margin: 0 }}>
                    Whole elapsed days, floored. A lead idle 7.6 days is 7 days old and does not clear a
                    &ldquo;more than 7 days&rdquo; bar.
                  </dd>
                </div>
                <div>
                  <dt className="t-label">Low-sample guard</dt>
                  <dd className="t-small" style={{ margin: 0 }}>
                    Any rate on fewer than <span className="num">{MIN_RATE_DENOMINATOR}</span> leads is
                    withheld and shown as an em dash.
                  </dd>
                </div>
                <div>
                  <dt className="t-label">Window boundaries</dt>
                  <dd className="t-small" style={{ margin: 0 }}>
                    Every period is inclusive at both ends. A lead is overdue when its expected close date
                    falls strictly before the pinned current time — so a lead due{' '}
                    <span className="num">31 Dec</span> at midnight counts as overdue by the evening of the
                    31st. On this dataset no close date lands exactly on the pinned instant, so{' '}
                    <code>&lt;</code> and <code>&le;</code> give the same{' '}
                    <span className="num">31</span> leads; the strict form is used so the two can never
                    diverge silently.
                  </dd>
                </div>
                <div>
                  <dt className="t-label">Period basis</dt>
                  <dd className="t-small" style={{ margin: 0 }}>
                    <strong>Activity</strong> selects leads that last moved inside the window — for a
                    delivered lead that is its delivery date, so a calendar quarter over deliveries is that
                    quarter&rsquo;s revenue. <strong>Leads created</strong> selects by creation date and
                    answers how an intake converted. Conversion screens default to the second; everything
                    else to the first.
                  </dd>
                </div>
                <div>
                  <dt className="t-label">Naming a branch</dt>
                  <dd className="t-small" style={{ margin: 0 }}>
                    A rate needs <span className="num">{MIN_RATE_DENOMINATOR}</span> leads; naming a branch as
                    the problem needs <span className="num">{MIN_VERDICT_DENOMINATOR}</span>, and needs every
                    branch to clear it. A branch too small to rate is too small to exonerate, so below that
                    floor the finding is withheld rather than pointed at whoever happens to be rateable.
                  </dd>
                </div>
                <div>
                  <dt className="t-label">Percentiles</dt>
                  <dd className="t-small" style={{ margin: 0 }}>
                    Order statistics with no interpolation, so every published percentile is a value some
                    lead actually took.
                  </dd>
                </div>
                <div>
                  <dt className="t-label">Reconciliation</dt>
                  <dd className="t-small" style={{ margin: 0 }}>
                    <span className="num">{dataset.reconciliation.reconciledCount}</span> leads had a status
                    missing from their history. A terminal event was reconstructed; funnel counts are
                    unaffected.
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="panel">
            <header className="panel-hd">
              <h2 className="t-h2">Queue thresholds</h2>
            </header>
            <div className="panel-bd">
              <p className="t-small" style={{ marginBottom: 'var(--s3)' }}>
                Derived from this dataset&rsquo;s dwell medians, not round numbers.
              </p>
              <div className="scrollx">
              <table className="tbl">
                <tbody>
                  {actions.coldThresholds.map((threshold) => (
                    <tr key={threshold.stage}>
                      <td>{threshold.stage}</td>
                      <td className="r num dim">median {threshold.normalDays} d</td>
                      <td className="r num">cold after {threshold.coldAfterDays} d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <p className="t-small" style={{ marginTop: 'var(--s3)' }}>
                A flat seven-day rule would flag{' '}
                <span className="num">
                  {formatNumber(
                    dataset.leads.filter(
                      (lead) =>
                        lead.status !== 'delivered' &&
                        lead.status !== 'lost' &&
                        Math.floor((NOW.getTime() - lead.lastActivityAt.getTime()) / 86_400_000) > 7,
                    ).length,
                  )}
                </span>{' '}
                open leads. Most are stalled orders already in their own queue, which is why the cold queue
                holds <span className="num">{actions.cold.count}</span>.
              </p>
            </div>
          </div>
        </div>

        <div className="c12" style={{ paddingBottom: 'var(--s7)' }}>
          <Link href="/" className="btn btn-lg btn-quiet">
            ← Back to overview
          </Link>
        </div>
      </main>
    </div>
  );
}
