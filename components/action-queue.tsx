'use client';

/**
 * The work queue.
 *
 * Selection and the acted-on state are genuinely ephemeral client state, so
 * this is a client component. It receives pre-formatted, serializable rows —
 * the dataset never crosses the boundary.
 *
 * Actions are optimistic and persist to localStorage. The UI says so plainly:
 * there is no write-back to a dealer management system, and pretending
 * otherwise would be the kind of lie that gets a tool switched off.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '@/lib/format';

export interface QueueRowData {
  leadId: string;
  title: string;
  meta: string;
  owner: string;
  branch: string;
  ageDays: number;
  lateness: number | null;
  moneyLabel: string;
  dealValue: number;
  band: 'critical' | 'warning' | 'normal';
  severity: number;
  actionLabel: string;
  href: string;
}

/**
 * What was done to a row, and when.
 *
 * v1 stored a bare label string. Keeping the timestamp lets a snooze expire on
 * its own instead of hiding a lead forever, and lets the handled list be sorted
 * by recency when a manager wants to undo the last thing they did.
 */
export interface ActedEntry {
  label: string;
  at: number;
  /** Set for a snooze: the row returns to the queue after this instant. */
  until?: number;
}

type ActedState = Record<string, ActedEntry>;

const STORAGE_KEY = 'dealerpulse.queue.actions.v2';
const LEGACY_KEY = 'dealerpulse.queue.actions.v1';

const SNOOZE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Rows shown at once. This dataset's largest queue is 47, but a real dealer
 * group's stalled-order list is thousands, and a queue that renders all of them
 * stops being usable long before it stops rendering. Selection and "select all"
 * deliberately operate on the visible page, so a bulk action can never touch a
 * row the user has not seen.
 */
const PAGE_SIZE = 25;

/** Read one entry defensively; anything unrecognised is discarded, not trusted. */
function readEntry(value: unknown): ActedEntry | null {
  if (typeof value === 'string') return { label: value, at: 0 }; // v1 record
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.label === 'string') {
      return {
        label: record.label,
        at: typeof record.at === 'number' ? record.at : 0,
        until: typeof record.until === 'number' ? record.until : undefined,
      };
    }
  }
  return null;
}

function loadActed(): ActedState {
  if (typeof window === 'undefined') return {};
  const out: ActedState = {};
  for (const key of [LEGACY_KEY, STORAGE_KEY]) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      for (const [leadId, value] of Object.entries(parsed as Record<string, unknown>)) {
        const entry = readEntry(value);
        if (entry) out[leadId] = entry;
      }
    } catch {
      // A corrupt or unavailable store must never break the queue.
    }
  }
  // An expired snooze is not a decision — the row comes back on its own.
  const now = Date.now();
  for (const [leadId, entry] of Object.entries(out)) {
    if (entry.until !== undefined && entry.until <= now) delete out[leadId];
  }
  return out;
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function ActionQueue({
  rows,
  queueName,
  emptyTitle,
  emptyDetail,
}: {
  rows: QueueRowData[];
  queueName: string;
  emptyTitle: string;
  emptyDetail: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acted, setActed] = useState<ActedState>({});
  const [hydrated, setHydrated] = useState(false);
  const [page, setPage] = useState(1);
  const [showHandled, setShowHandled] = useState(false);
  /** The last action, kept so it can be undone in one click. */
  const [lastAction, setLastAction] = useState<{ label: string; ids: string[] } | null>(null);

  /*
   * Handled rows leave the queue. A counter that never falls is the reason a
   * work queue stops being opened; the rows are one toggle away, not gone.
   */
  const handledIds = useMemo(
    () => new Set(rows.filter((row) => acted[row.leadId]).map((row) => row.leadId)),
    [rows, acted],
  );
  const visibleRows = useMemo(
    () => (showHandled ? rows : rows.filter((row) => !handledIds.has(row.leadId))),
    [rows, showHandled, handledIds],
  );

  const pageCount = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(
    () => visibleRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [visibleRows, safePage],
  );

  // A filter change can shorten the queue under a reader who has paged forward.
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [rows]);

  // Acting on a row can empty the page it was on.
  useEffect(() => {
    setPage((current) => Math.min(current, Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE))));
  }, [visibleRows.length]);

  useEffect(() => {
    setActed(loadActed());
    setHydrated(true);
  }, []);

  const persist = useCallback((next: ActedState) => {
    setActed(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage can be full or blocked; the optimistic UI still stands.
    }
  }, []);

  const toggle = useCallback((leadId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }, []);

  const allSelected = pageRows.length > 0 && pageRows.every((row) => selected.has(row.leadId));
  const toggleAll = useCallback(() => {
    setSelected((current) =>
      pageRows.every((row) => current.has(row.leadId))
        ? new Set()
        : new Set(pageRows.map((row) => row.leadId)),
    );
  }, [pageRows]);

  const selectedRows = useMemo(() => rows.filter((row) => selected.has(row.leadId)), [rows, selected]);
  const selectedValue = selectedRows.reduce((sum, row) => sum + row.dealValue, 0);

  const apply = useCallback(
    (label: string, ids: string[], snooze = false) => {
      const now = Date.now();
      const next = { ...acted };
      for (const id of ids) {
        next[id] = { label, at: now, until: snooze ? now + SNOOZE_DAYS * DAY_MS : undefined };
      }
      persist(next);
      setSelected(new Set());
      setLastAction({ label, ids });
    },
    [acted, persist],
  );

  const undo = useCallback(
    (ids: string[]) => {
      const next = { ...acted };
      for (const id of ids) delete next[id];
      persist(next);
      setLastAction(null);
    },
    [acted, persist],
  );

  const resetAll = useCallback(() => {
    persist({});
    setLastAction(null);
    setShowHandled(false);
  }, [persist]);

  const exportCsv = useCallback(
    (which: QueueRowData[]) => {
      const header = ['Lead', 'Customer', 'Owner', 'Branch', 'Age (days)', 'Value', 'Severity'];
      const lines = [
        header.join(','),
        ...which.map((row) =>
          [
            row.leadId,
            csvEscape(row.title),
            csvEscape(row.owner),
            csvEscape(row.branch),
            String(row.ageDays),
            csvEscape(row.moneyLabel),
            row.severity.toFixed(0),
          ].join(','),
        ),
      ];
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `dealerpulse-${queueName}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    },
    [queueName],
  );

  const remaining = rows.length - handledIds.size;

  if (rows.length === 0) {
    return (
      <div className="state" style={{ background: 'var(--positive-wash)' }}>
        <div className="state-in">
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
          <h2 className="t-h2" style={{ color: 'var(--positive)' }}>
            {emptyTitle}
          </h2>
          <p className="t-small">{emptyDetail}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {selected.size > 0 ? (
        <div style={{ padding: 'var(--s3) var(--s5)' }}>
          <div className="bulkbar">
            <span className="num" style={{ fontWeight: 600 }}>
              {selected.size} selected
            </span>
            <span style={{ opacity: 0.6, fontSize: 12 }} className="num">
              {formatCurrency(selectedValue)}
            </span>
            <span className="sp" />
            <button type="button" className="btn" onClick={() => apply('Assigned', [...selected])}>
              Assign
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => apply(`Snoozed ${SNOOZE_DAYS} days`, [...selected], true)}
            >
              Snooze {SNOOZE_DAYS} days
            </button>
            <button type="button" className="btn" onClick={() => apply('Marked contacted', [...selected])}>
              Mark contacted
            </button>
            <button type="button" className="btn" onClick={() => apply('Dismissed', [...selected])}>
              Dismiss
            </button>
            <button type="button" className="btn" onClick={() => exportCsv(selectedRows)}>
              Export
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              style={{ color: 'rgba(255,255,255,.7)' }}
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      <div style={{ margin: '0 var(--s5) var(--s5)', border: '1px solid var(--rule)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
        <div className="q-head">
          <span aria-hidden="true" />
          <button
            type="button"
            className="chk"
            role="checkbox"
            aria-checked={allSelected}
            aria-label={allSelected ? 'Deselect all rows on this page' : 'Select all rows on this page'}
            onClick={toggleAll}
          >
            ✓
          </button>
          <span className="t-label">What</span>
          <span className="t-label">Owner</span>
          <span className="t-label" style={{ textAlign: 'right' }}>
            Age
          </span>
          <span className="t-label" style={{ textAlign: 'right' }}>
            Value
          </span>
          <span className="t-label" style={{ textAlign: 'right' }}>
            Next step
          </span>
        </div>

        {pageRows.map((row) => {
          const isSelected = selected.has(row.leadId);
          const actedLabel = hydrated ? acted[row.leadId] : undefined;
          return (
            <div
              key={row.leadId}
              className={`q-row${isSelected ? ' is-sel' : ''}${actedLabel ? ' is-done' : ''}`}
            >
              <span
                className={`q-sev${row.band === 'critical' ? ' s-crit' : row.band === 'warning' ? ' s-warn' : ''}`}
                title={`Severity ${row.severity.toFixed(0)}`}
                aria-hidden="true"
              />
              <button
                type="button"
                className="chk"
                role="checkbox"
                aria-checked={isSelected}
                aria-label={`Select ${row.title}`}
                onClick={() => toggle(row.leadId)}
              >
                ✓
              </button>
              <div className="q-what">
                <p className="q-title">{row.title}</p>
                <p className="q-meta">{row.meta}</p>
              </div>
              <span className="q-owner">
                {row.owner}
                <br />
                <span className="t-micro">{row.branch}</span>
              </span>
              <span className={row.band === 'critical' ? 'q-age crit' : 'q-age'}>
                {row.ageDays} d
                {row.lateness !== null ? (
                  <>
                    <br />
                    <span className="t-micro">{row.lateness.toFixed(1)}× longer than normal</span>
                  </>
                ) : null}
              </span>
              <span className={row.band === 'critical' ? 'q-money crit' : 'q-money'}>{row.moneyLabel}</span>
              <span className="q-act">
                {actedLabel ? (
                  <>
                    <span className="chip chip-pos">{actedLabel.label}</span>
                    <button type="button" className="btn btn-quiet btn-sm" onClick={() => undo([row.leadId])}>
                      Undo
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={row.band === 'critical' ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
                    onClick={() => apply('Assigned', [row.leadId])}
                  >
                    {row.actionLabel}
                  </button>
                )}
              </span>
            </div>
          );
        })}

        <div
          style={{
            padding: 'var(--s3) var(--s4)',
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--s3)',
            flexWrap: 'wrap',
          }}
        >
          <p className="t-micro">
            {visibleRows.length === 0
              ? 'Every item here has been handled'
              : `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(
                  safePage * PAGE_SIZE,
                  visibleRows.length,
                )} of ${visibleRows.length}`}
            {' · '}
            <b>{remaining}</b> still {remaining === 1 ? 'needs' : 'need'} a decision
          </p>
          {hydrated && handledIds.size > 0 ? (
            <button
              type="button"
              className="btn btn-sm"
              aria-pressed={showHandled}
              onClick={() => {
                setShowHandled((current) => !current);
                setPage(1);
              }}
            >
              {showHandled ? 'Hide' : 'Show'} handled ({handledIds.size})
            </button>
          ) : null}
          <span className="sp" />
          {pageCount > 1 ? (
            <span className="pager" style={{ gap: 6 }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={safePage === 1}
              >
                ← Previous
              </button>
              <span className="t-micro num">
                Page {safePage} of {pageCount}
              </span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                disabled={safePage === pageCount}
              >
                Next →
              </button>
            </span>
          ) : null}
          <button type="button" className="btn btn-sm" onClick={() => exportCsv(rows)}>
            Export all {rows.length}
          </button>
          {hydrated && handledIds.size > 0 ? (
            <details className="menu" data-filter-menu="">
              <summary className="btn btn-sm">Reset</summary>
              <div className="menu-pop to-right" style={{ padding: 'var(--s3)', minWidth: 240 }}>
                <p className="t-small" style={{ marginBottom: 'var(--s3)' }}>
                  Clears every action recorded in this browser and returns{' '}
                  <span className="num">{handledIds.size}</span>{' '}
                  {handledIds.size === 1 ? 'item' : 'items'} to the queue.
                </p>
                <button type="button" className="btn btn-primary btn-sm" onClick={resetAll}>
                  Reset all actions
                </button>
              </div>
            </details>
          ) : null}
        </div>
      </div>

      {/*
        One-click undo for the action just taken. It is a strip rather than a
        floating toast: a work queue is read top to bottom, and a control that
        disappears on a timer is a control a careful user cannot rely on.
      */}
      {hydrated && lastAction !== null ? (
        <div className="undo-bar" role="status">
          <span>
            <b>{lastAction.label}</b> · {lastAction.ids.length}{' '}
            {lastAction.ids.length === 1 ? 'item' : 'items'}
          </span>
          <span className="sp" />
          <button type="button" className="btn btn-sm" onClick={() => undo(lastAction.ids)}>
            Undo
          </button>
          <button type="button" className="btn btn-sm btn-quiet" onClick={() => setLastAction(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {hydrated && Object.keys(acted).length > 0 ? (
        <div
          style={{
            margin: '0 var(--s5) var(--s5)',
            padding: 'var(--s2) var(--s4)',
            background: 'var(--warning-wash)',
            borderRadius: 'var(--r-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <svg className="glyph warn" viewBox="0 0 8 8" aria-hidden="true">
            <circle cx="4" cy="4" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          <p className="t-micro warn">
            <b>{Object.keys(acted).length}</b> {Object.keys(acted).length === 1 ? 'action' : 'actions'} saved
            in this browser only. A snooze returns on its own after {SNOOZE_DAYS} days; everything else stays
            until you reset it. DealerPulse has no write access to the dealer management system, so none of
            this reaches a colleague&rsquo;s screen.
          </p>
        </div>
      ) : null}
    </>
  );
}
