'use client';

/**
 * Two-lever scenario tool.
 *
 * The copy matters more than the chart. A branch that is behind is usually
 * behind in two different places, before the call and after it, and those are
 * very differently sized jobs. One slider each, so the reader has to choose
 * which one they are claiming to fix rather than being handed a blended
 * number. The assumption block names whichever levers actually moved: a
 * simulator that quietly leads with its most flattering result stops being an
 * instrument.
 */

import { useMemo, useState } from 'react';
import { formatCurrency, formatNumber, plural } from '@/lib/format';

export interface WhatIfInputs {
  branchName: string;
  leads: number;
  baselineRate: number;
  peerRate: number;
  baselineContacted: number;
  baselineDelivered: number;
  /** Real delivered revenue, summed from deal values — not count × average. */
  baselineRevenue: number;
  branchDownstream: number;
  peerDownstream: number;
  averageDealValue: number;
}

/** One labelled range input with a peer tick. */
function Lever({
  id,
  label,
  value,
  onChange,
  peer,
  valueText,
  caption,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (next: number) => void;
  peer: number;
  valueText: string;
  caption: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="t-label" style={{ display: 'block', marginBottom: 'var(--s3)' }}>
        {label}
      </label>
      <div className="slider-wrap">
        <div className="slider-rail" />
        <div className="slider-done" style={{ width: `${value}%` }} />
        <div className="slider-tick" style={{ left: `${peer}%` }} />
        <input
          id={id}
          className="slider-input"
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-valuetext={valueText}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span className="t-micro num">0%</span>
        <span className="t-micro">peer {peer}%</span>
        <span className="t-micro num">100%</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 'var(--s3)', flexWrap: 'wrap' }}>
        <span className="t-metric">{value}%</span>
        <span className="t-small muted">{caption}</span>
      </div>
    </div>
  );
}

export function WhatIf({ inputs }: { inputs: WhatIfInputs }) {
  const baseContact = Math.round(inputs.baselineRate * 100);
  const baseClose = Math.round(inputs.branchDownstream * 100);
  const peerContact = Math.round(inputs.peerRate * 100);
  const peerClose = Math.round(inputs.peerDownstream * 100);

  const [contactRate, setContactRate] = useState(baseContact);
  const [closeRate, setCloseRate] = useState(baseClose);

  const model = useMemo(() => {
    /*
     * Both sliders are whole per cents, so at "today" they land a fraction of
     * a car away from the real baseline — 58% of 79 is 45.8, not 46. The
     * counts hid that behind rounding, but a rupee figure does not: the panel
     * would open saying nothing has changed while showing −₹0.99 L. At the
     * current rates the scenario *is* today, so say so exactly.
     */
    if (contactRate === baseContact && closeRate === baseClose) {
      return {
        contacted: inputs.baselineContacted,
        delivered: inputs.baselineDelivered,
        deltaContacted: 0,
        deltaDelivered: 0,
        revenue: inputs.baselineRevenue,
        deltaRevenue: 0,
      };
    }
    const contacted = inputs.leads * (contactRate / 100);
    const delivered = contacted * (closeRate / 100);
    const deltaDelivered = delivered - inputs.baselineDelivered;
    return {
      contacted,
      delivered,
      deltaContacted: contacted - inputs.baselineContacted,
      deltaDelivered,
      /*
       * Today's figure is the real sum; only the cars the scenario adds are
       * priced at the average enquiry. Pricing all of them that way would put
       * a number on screen that disagrees with every other revenue figure in
       * the product.
       */
      revenue: inputs.baselineRevenue + deltaDelivered * inputs.averageDealValue,
      deltaRevenue: deltaDelivered * inputs.averageDealValue,
    };
  }, [contactRate, closeRate, inputs, baseContact, baseClose]);

  const branchShort = inputs.branchName.replace(' Toyota', '');
  const contactMoved = contactRate !== baseContact;
  const closeMoved = closeRate !== baseClose;
  const moved = contactMoved || closeMoved;
  // Rounded once, so the prose and the cells above it can never disagree about
  // whether anything moved.
  const contactedDelta = Math.round(model.deltaContacted);
  const deliveredDelta = Math.round(model.deltaDelivered);

  const reset = () => {
    setContactRate(baseContact);
    setCloseRate(baseClose);
  };

  return (
    <section className="panel c12">
      <header className="panel-hd">
        <div>
          <h2 className="t-h2">What if {branchShort} improved?</h2>
          <p className="t-micro" style={{ marginTop: 2 }}>
            Two levers · {branchShort} · {inputs.leads} leads
          </p>
        </div>
        <span className="chip chip-acc num">
          peer {peerContact}% / {peerClose}%
        </span>
      </header>

      <div className="panel-bd">
        <div className="wi-cols">
          <div className="wi-levers">
            <Lever
              id="whatif-contact"
              label={`${branchShort} first-contact rate`}
              value={contactRate}
              onChange={setContactRate}
              peer={peerContact}
              valueText={`${contactRate} per cent of leads contacted`}
              caption={`${Math.round(model.contacted)} of ${inputs.leads} leads contacted`}
            />

            <Lever
              id="whatif-close"
              label={`${branchShort} sale rate after the call`}
              value={closeRate}
              onChange={setCloseRate}
              peer={peerClose}
              valueText={`${closeRate} per cent of contacted leads become a sale`}
              caption={`${Math.round(model.delivered)} of ${Math.round(model.contacted)} contacted become a sale`}
            />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-sm" onClick={reset}>
                Reset to today
              </button>
              {/* The two presets are the two figures the overview keeps apart.
                  Naming them here is what stops the pair being read as one. */}
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setContactRate(peerContact);
                  setCloseRate(baseClose);
                }}
              >
                Fix the calls only
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setContactRate(peerContact);
                  setCloseRate(peerClose);
                }}
              >
                Match peers on both
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
                <p className="t-micro">became a sale</p>
                <p className="t-metric-s num" style={{ marginTop: 8 }}>
                  {formatCurrency(inputs.baselineRevenue)}
                </p>
                <p className="t-micro">delivered revenue</p>
              </div>
              <div style={{ textAlign: 'center', color: 'var(--ink-3)' }} aria-hidden="true">
                →
              </div>
              <div className={moved ? 'ba-cell is-after' : 'ba-cell'}>
                <p className="t-label" style={{ marginBottom: 4, color: moved ? 'var(--accent)' : undefined }}>
                  At {contactRate}% / {closeRate}%
                </p>
                <p className={moved ? 't-metric-s acc' : 't-metric-s'}>{Math.round(model.contacted)}</p>
                <p className="t-micro">
                  contacted{' '}
                  <span className={model.deltaContacted >= 0 ? 'pos num' : 'crit num'}>
                    {model.deltaContacted >= 0 ? '+' : '−'}
                    {Math.abs(contactedDelta)}
                  </span>
                </p>
                <p className={moved ? 't-metric-s acc' : 't-metric-s'} style={{ marginTop: 8 }}>
                  {Math.round(model.delivered)}
                </p>
                <p className="t-micro">
                  became a sale{' '}
                  <span className={model.deltaDelivered >= 0 ? 'pos num' : 'crit num'}>
                    {model.deltaDelivered >= 0 ? '+' : '−'}
                    {Math.abs(deliveredDelta)}
                  </span>
                </p>
                <p className={moved ? 't-metric-s acc num' : 't-metric-s num'} style={{ marginTop: 8 }}>
                  {formatCurrency(model.revenue)}
                </p>
                <p className="t-micro">
                  delivered revenue{' '}
                  <span className={model.deltaRevenue >= 0 ? 'pos num' : 'crit num'}>
                    {model.deltaRevenue >= 0 ? '+' : '−'}
                    {formatCurrency(Math.abs(model.deltaRevenue))}
                  </span>
                </p>
              </div>
            </div>

            {/* At the branch's current rates the sliders model no change, and
                "0 fewer customers … 0 fewer deliveries and about ₹0" is a
                sentence about nothing. Say that instead. */}
            <p
              className="t-body"
              style={{ marginTop: 'var(--s4)', padding: 'var(--s3)', background: 'var(--surface-2)', borderRadius: 'var(--r-md)' }}
            >
              {!moved ? (
                <>
                  <strong>
                    {contactRate}% / {closeRate}%
                  </strong>{' '}
                  is where {branchShort} already sits, so this models no change. Drag either slider, or take
                  one of the presets, to see what moving it is worth.
                </>
              ) : (
                <>
                  Calling <strong>{contactRate}%</strong> of {branchShort}&rsquo;s leads
                  {contactedDelta === 0 ? (
                    <> reaches the same number of customers</>
                  ) : (
                    <>
                      {' '}
                      would reach{' '}
                      <strong>
                        {formatNumber(Math.abs(contactedDelta))} {contactedDelta > 0 ? 'more' : 'fewer'}{' '}
                        {plural(Math.abs(contactedDelta), 'customer')}
                      </strong>
                    </>
                  )}
                  , and closing <strong>{closeRate}%</strong> of those gives{' '}
                  {deliveredDelta === 0 ? (
                    <>
                      <strong>no change in sales</strong> once the numbers are rounded to whole cars.
                    </>
                  ) : (
                    <>
                      <strong>
                        {formatNumber(Math.abs(deliveredDelta))} {deliveredDelta > 0 ? 'more' : 'fewer'}{' '}
                        {plural(Math.abs(deliveredDelta), 'sale')}
                      </strong>{' '}
                      and about <strong className="num">{formatCurrency(Math.abs(model.deltaRevenue))}</strong>{' '}
                      {model.deltaRevenue >= 0 ? 'more' : 'less'} delivered revenue.
                    </>
                  )}
                </>
              )}
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
              Today {branchShort} contacts <span className="num">{baseContact}%</span> of its leads and turns{' '}
              <span className="num">{(inputs.branchDownstream * 100).toFixed(1)}%</span>{' '}
              of those into a sale, against <span className="num">{peerContact}%</span> and{' '}
              <span className="num">{(inputs.peerDownstream * 100).toFixed(1)}%</span> across the peer
              branches. Extra sales are priced at the branch&rsquo;s average enquiry,{' '}
              <span className="num">{formatCurrency(inputs.averageDealValue)}</span>.
            </p>
            {/* Which lever moved is the whole point. Picking up the phone more
                often is a rota change; closing better once you are on it is
                months of coaching. A reader who moves both and reads one
                number has been misled by the tool, not by the data. */}
            <p className="t-small" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--rule)' }}>
              {!moved ? (
                <>Nothing has been moved yet, so the two columns above are the same.</>
              ) : contactMoved && !closeMoved ? (
                <>
                  Only the <strong>first step</strong> has moved. This is the cheap fix: it is a rota and a
                  call list, and it can start this week.
                </>
              ) : closeMoved && !contactMoved ? (
                <>
                  Only the <strong>step after the call</strong> has moved, and that one is not a rota change.
                  Closing like the peer branches is coaching, pricing and follow up discipline, so read this
                  as months of work rather than a week.
                </>
              ) : (
                <>
                  <strong>Both levers have moved.</strong> That means more calls <em>and</em> better closing
                  on those calls, which are two separate jobs on two very different timelines. If you only
                  intend to fix the phone calls, take the &ldquo;Fix the calls only&rdquo; preset, because
                  this number is not what that buys you.
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
