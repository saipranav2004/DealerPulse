'use client';

/**
 * Single-lever scenario tool.
 *
 * The copy matters more than the chart. The headline is the conservative
 * result — downstream conversion held where it is today — and the larger
 * peer-rate figure sits in the assumption block with an explanation of what
 * else would have to be true. A simulator that leads with its most flattering
 * number stops being an instrument.
 */

import { useMemo, useState } from 'react';
import { formatCurrency } from '@/lib/format';

export interface WhatIfInputs {
  branchName: string;
  leads: number;
  baselineRate: number;
  peerRate: number;
  baselineContacted: number;
  baselineDelivered: number;
  branchDownstream: number;
  peerDownstream: number;
  averageDealValue: number;
}

export function WhatIf({ inputs }: { inputs: WhatIfInputs }) {
  const [rate, setRate] = useState(() => Math.round(inputs.baselineRate * 100));

  const model = useMemo(() => {
    const fraction = rate / 100;
    const contacted = inputs.leads * fraction;
    const held = contacted * inputs.branchDownstream;
    const atPeer = contacted * inputs.peerDownstream;
    return {
      contacted,
      held,
      atPeer,
      deltaContacted: contacted - inputs.baselineContacted,
      deltaHeld: held - inputs.baselineDelivered,
      deltaAtPeer: atPeer - inputs.baselineDelivered,
      revenueHeld: (held - inputs.baselineDelivered) * inputs.averageDealValue,
      revenueAtPeer: (atPeer - inputs.baselineDelivered) * inputs.averageDealValue,
    };
  }, [rate, inputs]);

  const branchShort = inputs.branchName.replace(' Toyota', '');
  const moved = Math.abs(rate / 100 - inputs.baselineRate) > 0.001;

  return (
    <section className="panel c12">
      <header className="panel-hd">
        <div>
          <h2 className="t-h2">What if first contact improved?</h2>
          <p className="t-micro" style={{ marginTop: 2 }}>
            One lever · {branchShort} · {inputs.leads} leads
          </p>
        </div>
        <span className="chip chip-acc num">peer rate {Math.round(inputs.peerRate * 100)}%</span>
      </header>

      <div className="panel-bd">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 'var(--s7)' }}>
          <div>
            <label htmlFor="whatif-rate" className="t-label" style={{ display: 'block', marginBottom: 'var(--s3)' }}>
              {branchShort} first-contact rate
            </label>
            <div className="slider-wrap">
              <div className="slider-rail" />
              <div className="slider-done" style={{ width: `${rate}%` }} />
              <div className="slider-tick" style={{ left: `${inputs.peerRate * 100}%` }} />
              <input
                id="whatif-rate"
                className="slider-input"
                type="range"
                min={0}
                max={100}
                step={1}
                value={rate}
                onChange={(event) => setRate(Number(event.target.value))}
                aria-valuetext={`${rate} per cent of leads contacted`}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <span className="t-micro num">0%</span>
              <span className="t-micro">peer {Math.round(inputs.peerRate * 100)}%</span>
              <span className="t-micro num">100%</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 'var(--s3)', flexWrap: 'wrap' }}>
              <span className="t-metric">{rate}%</span>
              <span className="t-small muted">
                {Math.round(model.contacted)} of {inputs.leads} leads contacted
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 'var(--s3)', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setRate(Math.round(inputs.baselineRate * 100))}
              >
                Reset to today
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setRate(Math.round(inputs.peerRate * 100))}
              >
                Set to peer rate
              </button>
            </div>
          </div>

          <div>
            <div className="ba">
              <div className="ba-cell">
                <p className="t-label" style={{ marginBottom: 4 }}>
                  Today
                </p>
                <p className="t-metric-s">{inputs.baselineContacted}</p>
                <p className="t-micro">contacted</p>
                <p className="t-metric-s" style={{ marginTop: 8 }}>
                  {inputs.baselineDelivered}
                </p>
                <p className="t-micro">delivered</p>
              </div>
              <div style={{ textAlign: 'center', color: 'var(--ink-3)' }} aria-hidden="true">
                →
              </div>
              <div className={moved ? 'ba-cell is-after' : 'ba-cell'}>
                <p className="t-label" style={{ marginBottom: 4, color: moved ? 'var(--accent)' : undefined }}>
                  At {rate}%
                </p>
                <p className={moved ? 't-metric-s acc' : 't-metric-s'}>{Math.round(model.contacted)}</p>
                <p className="t-micro">
                  contacted{' '}
                  <span className={model.deltaContacted >= 0 ? 'pos num' : 'crit num'}>
                    {model.deltaContacted >= 0 ? '+' : '−'}
                    {Math.abs(Math.round(model.deltaContacted))}
                  </span>
                </p>
                <p className={moved ? 't-metric-s acc' : 't-metric-s'} style={{ marginTop: 8 }}>
                  {Math.round(model.held)}
                </p>
                <p className="t-micro">
                  delivered{' '}
                  <span className={model.deltaHeld >= 0 ? 'pos num' : 'crit num'}>
                    {model.deltaHeld >= 0 ? '+' : '−'}
                    {Math.abs(Math.round(model.deltaHeld))}
                  </span>
                </p>
              </div>
            </div>

            <p
              className="t-body"
              style={{ marginTop: 'var(--s4)', padding: 'var(--s3)', background: 'var(--surface-2)', borderRadius: 'var(--r-md)' }}
            >
              Calling <strong>{rate}%</strong> of {branchShort}&rsquo;s leads would reach{' '}
              <strong>
                {Math.abs(Math.round(model.deltaContacted))} {model.deltaContacted >= 0 ? 'more' : 'fewer'}
              </strong>{' '}
              customers. Holding the branch&rsquo;s own conversion after first contact, that becomes{' '}
              <strong>
                {Math.abs(Math.round(model.deltaHeld))} {model.deltaHeld >= 0 ? 'more' : 'fewer'} deliveries
              </strong>{' '}
              and about <strong className="num">{formatCurrency(Math.abs(model.revenueHeld))}</strong>.
            </p>
          </div>
        </div>

        <div className="assumption" style={{ marginTop: 'var(--s4)' }}>
          <svg className="glyph dim" style={{ marginTop: 4, flex: 'none' }} viewBox="0 0 8 8" aria-hidden="true">
            <circle cx="4" cy="4" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          <div>
            <p className="t-label" style={{ marginBottom: 4 }}>
              What this assumes
            </p>
            <p className="t-small">
              {branchShort}&rsquo;s conversion <em>after</em> first contact stays where it is today —{' '}
              <span className="num">{(inputs.branchDownstream * 100).toFixed(1)}%</span> of contacted leads
              reach delivery, against <span className="num">{(inputs.peerDownstream * 100).toFixed(1)}%</span>{' '}
              across the peer branches. Only the first step moves.
            </p>
            <p className="t-small" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--rule)' }}>
              If those leads also converted at peer rates, the same slider position gives{' '}
              <strong className="num">
                {model.deltaAtPeer >= 0 ? '+' : '−'}
                {Math.abs(Math.round(model.deltaAtPeer))} deliveries
              </strong>{' '}
              and <strong className="num">{formatCurrency(Math.abs(model.revenueAtPeer))}</strong>. That result
              needs the whole funnel fixed, not just the phone calls, which is why it is not the number
              above.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
