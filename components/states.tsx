/**
 * Empty, error and low-sample states.
 *
 * Every one of them names the specific situation and offers a way out. None
 * apologises, and none is a shrug.
 */

import Link from 'next/link';
import { describeFilters, toQueryString, withoutAxis, type FilterState } from '@/lib/url-filters';
import type { Branch } from '@/lib/types';

function FunnelIcon() {
  return (
    <svg className="state-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M3 5h18l-7 8v6l-4 2v-8z" />
    </svg>
  );
}

function TickIcon() {
  return (
    <svg
      className="state-mark"
      style={{ color: 'var(--positive)' }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M4 12.5l5.5 5.5L20 7" />
    </svg>
  );
}

/** No rows match the current filters. Lists them and offers a one-click widen. */
export function EmptyByFilter({
  state,
  branches,
  basePath,
}: {
  state: FilterState;
  branches: readonly Branch[];
  basePath: string;
}) {
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? id;
  const parts = describeFilters(state, branchName);

  return (
    <div className="state">
      <div className="state-in">
        <FunnelIcon />
        <h2 className="t-h2">No leads match these filters</h2>
        <p className="t-small">
          {parts.length > 0 ? `${parts.join(' · ')} returns nothing.` : 'This selection returns nothing.'}
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
          {state.models.length > 0 ? (
            <Link href={`${basePath}${toQueryString(withoutAxis(state, 'model'))}`} className="btn">
              Clear model
            </Link>
          ) : null}
          {state.sources.length > 0 ? (
            <Link href={`${basePath}${toQueryString(withoutAxis(state, 'source'))}`} className="btn">
              Clear source
            </Link>
          ) : null}
          {state.branchIds.length > 0 ? (
            <Link href={`${basePath}${toQueryString(withoutAxis(state, 'branch'))}`} className="btn">
              Clear branch
            </Link>
          ) : null}
          <Link href={`${basePath}${toQueryString(withoutAxis(state, 'period'))}`} className="btn btn-primary">
            Widen to Jun – Dec
          </Link>
        </div>
      </div>
    </div>
  );
}

/** A queue with nothing in it, framed as an achievement rather than a fault. */
export function EmptyBySuccess({
  title,
  detail,
  note,
}: {
  title: string;
  detail: string;
  note?: string;
}) {
  return (
    <div className="state" style={{ background: 'var(--positive-wash)' }}>
      <div className="state-in">
        <TickIcon />
        <h2 className="t-h2" style={{ color: 'var(--positive)' }}>
          {title}
        </h2>
        <p className="t-small">{detail}</p>
        {note ? <p className="t-micro">{note}</p> : null}
      </div>
    </div>
  );
}

/** Insufficient data to publish a rate. */
export function InsufficientData({ n, what }: { n: number; what: string }) {
  return (
    <div
      style={{
        padding: 'var(--s3)',
        border: '1px dashed var(--rule-strong)',
        borderRadius: 'var(--r-md)',
        background: 'var(--surface-2)',
      }}
    >
      <p className="t-small" style={{ color: 'var(--ink)' }}>
        <strong>Insufficient data.</strong> Rates need at least 10 leads.
      </p>
      <p className="t-small" style={{ marginTop: 4 }}>
        {what} returns {n} {n === 1 ? 'lead' : 'leads'}. Counts are shown; percentages are withheld.
      </p>
    </div>
  );
}
