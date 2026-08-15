/**
 * Page chrome: the utility bar, the filter bar, the subset notice and the
 * breadcrumb.
 *
 * All of it renders on the server. The filter menus are native `<details>`
 * elements containing links, so the whole filter system works with no client
 * JavaScript and stays keyboard-operable by default.
 */

import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { formatNumber } from '@/lib/format';
import {
  ALL_MODELS,
  ALL_SOURCES,
  DEFAULT_PERIOD,
  PERIOD_PRESETS,
  SOURCE_LABELS,
  describeFilters,
  hrefWithFilters,
  isFiltered,
  periodFor,
  toQueryString,
  withoutAxis,
  type FilterState,
} from '@/lib/url-filters';
import type { Branch } from '@/lib/types';

export const DATA_CURRENT_AS_OF = '31 Dec 2025';

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

export type NavKey = 'overview' | 'actions' | 'leads' | 'models';

const NAV: { key: NavKey; label: string; href: string }[] = [
  { key: 'overview', label: 'Overview', href: '/' },
  { key: 'actions', label: 'Act now', href: '/actions' },
  { key: 'leads', label: 'Leads', href: '/leads' },
  { key: 'models', label: 'Vehicles', href: '/models' },
];

/**
 * Utility bar: identity, primary navigation, data currency, data quality.
 *
 * The navigation exists because without it the Action Center — the screen this
 * product argues is the most valuable — was reachable only by scrolling to the
 * bottom of the Overview. The badge carries the number of things waiting, so
 * the reason to click is visible before the click.
 */
export function TopBar({
  reconciledCount,
  subtitle,
  current,
  actionCount,
  filters,
}: {
  reconciledCount: number;
  subtitle?: string;
  current?: NavKey;
  actionCount?: number;
  filters?: FilterState;
}) {
  return (
    <header className="topbar">
      <Link href="/" className="mark">
        DealerPulse
      </Link>
      {subtitle ? <span className="org marker-hide-sm">{subtitle}</span> : null}

      <nav className="nav" aria-label="Main">
        {NAV.map((item) => (
          <Link
            key={item.key}
            href={filters ? hrefWithFilters(item.href, filters) : item.href}
            className={item.key === current ? 'nav-link on' : 'nav-link'}
            aria-current={item.key === current ? 'page' : undefined}
          >
            {item.label}
            {item.key === 'actions' && actionCount !== undefined && actionCount > 0 ? (
              <span className="nav-badge" aria-label={`${actionCount} items need attention`}>
                {actionCount}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      <span className="sp" />
      <span className="marker">
        <i className="dot" aria-hidden="true" />
        <span className="marker-hide-sm">Data current as of {DATA_CURRENT_AS_OF}</span>
        <span className="marker-date-sm" aria-hidden="true">
          {DATA_CURRENT_AS_OF}
        </span>
        <span className="sr-only">Data current as of {DATA_CURRENT_AS_OF}</span>
      </span>
      <ThemeToggle />
      <details className="menu">
        <summary className="marker-btn" aria-label={`${reconciledCount} records reconciled — data quality`}>
          <u>{reconciledCount} records reconciled</u>
        </summary>
        <div className="menu-pop to-right" style={{ minWidth: 300, padding: 'var(--s3)' }}>
          <p className="t-label" style={{ marginBottom: 8 }}>
            Data quality
          </p>
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px' }}>
            <dt className="t-small">Leads loaded</dt>
            <dd className="num t-small" style={{ margin: 0, textAlign: 'right' }}>
              510
            </dd>
            <dt className="t-small">Status missing from history</dt>
            <dd className="num t-small" style={{ margin: 0, textAlign: 'right' }}>
              {reconciledCount}
            </dd>
            <dt className="t-small">Effect on funnel counts</dt>
            <dd className="num t-small" style={{ margin: 0, textAlign: 'right' }}>
              none
            </dd>
          </dl>
          <p className="t-micro" style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--rule)' }}>
            All {reconciledCount} are lost leads whose loss was never written to history. The terminal event
            is reconstructed from <code>status</code> at last activity. They carry no lost reason and appear
            as “not recorded” in every reason breakdown.
          </p>
        </div>
      </details>
    </header>
  );
}

function FilterMenu({
  label,
  value,
  active,
  children,
}: {
  label: string;
  value: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="menu">
      <summary className={active ? 'filter is-active' : 'filter'}>
        <span className="k">{label}</span>
        {value}
        <span className="caret" aria-hidden="true">
          ▾
        </span>
      </summary>
      <div className="menu-pop">{children}</div>
    </details>
  );
}

/** The global filter bar. `basePath` keeps filters pointed at the current screen. */
export function FilterBar({
  state,
  branches,
  basePath,
  leadCount,
  leadingSlot,
}: {
  state: FilterState;
  branches: readonly Branch[];
  basePath: string;
  leadCount: number;
  leadingSlot?: React.ReactNode;
}) {
  const period = periodFor(state);
  const branchLabel =
    state.branchIds.length === 0
      ? `All ${branches.length}`
      : state.branchIds.length === 1
        ? (branches.find((b) => b.id === state.branchIds[0])?.name ?? state.branchIds[0])
        : `${state.branchIds.length} selected`;
  const modelLabel = state.models.length === 0 ? 'All' : state.models.length === 1 ? state.models[0] : `${state.models.length} selected`;
  const sourceLabel =
    state.sources.length === 0
      ? 'All'
      : state.sources.length === 1
        ? SOURCE_LABELS[state.sources[0]]
        : `${state.sources.length} selected`;

  return (
    <div className="filterbar">
      {leadingSlot}
      <FilterMenu label="Period" value={period.shortLabel} active={state.periodId !== DEFAULT_PERIOD.id}>
        {PERIOD_PRESETS.map((preset) => (
          <Link
            key={preset.id}
            href={`${basePath}${toQueryString({ ...state, periodId: preset.id })}`}
            className={preset.id === state.periodId ? 'menu-item on' : 'menu-item'}
          >
            <span className="menu-tick" aria-hidden="true">
              {preset.id === state.periodId ? '✓' : ''}
            </span>
            {preset.label}
          </Link>
        ))}
      </FilterMenu>

      <FilterMenu label="Branch" value={branchLabel} active={state.branchIds.length > 0}>
        <Link
          href={`${basePath}${toQueryString(withoutAxis(state, 'branch'))}`}
          className={state.branchIds.length === 0 ? 'menu-item on' : 'menu-item'}
        >
          <span className="menu-tick" aria-hidden="true">
            {state.branchIds.length === 0 ? '✓' : ''}
          </span>
          All branches
        </Link>
        <div className="menu-sep" />
        {branches.map((branch) => {
          const on = state.branchIds.includes(branch.id);
          return (
            <Link
              key={branch.id}
              href={`${basePath}${toQueryString({ ...state, branchIds: toggle(state.branchIds, branch.id) })}`}
              className={on ? 'menu-item on' : 'menu-item'}
            >
              <span className="menu-tick" aria-hidden="true">
                {on ? '✓' : ''}
              </span>
              {branch.name}
            </Link>
          );
        })}
      </FilterMenu>

      <FilterMenu label="Model" value={modelLabel} active={state.models.length > 0}>
        <Link
          href={`${basePath}${toQueryString(withoutAxis(state, 'model'))}`}
          className={state.models.length === 0 ? 'menu-item on' : 'menu-item'}
        >
          <span className="menu-tick" aria-hidden="true">
            {state.models.length === 0 ? '✓' : ''}
          </span>
          All models
        </Link>
        <div className="menu-sep" />
        {ALL_MODELS.map((model) => {
          const on = state.models.includes(model);
          return (
            <Link
              key={model}
              href={`${basePath}${toQueryString({ ...state, models: toggle(state.models, model) as FilterState['models'] })}`}
              className={on ? 'menu-item on' : 'menu-item'}
            >
              <span className="menu-tick" aria-hidden="true">
                {on ? '✓' : ''}
              </span>
              {model}
            </Link>
          );
        })}
      </FilterMenu>

      <FilterMenu label="Source" value={sourceLabel} active={state.sources.length > 0}>
        <Link
          href={`${basePath}${toQueryString(withoutAxis(state, 'source'))}`}
          className={state.sources.length === 0 ? 'menu-item on' : 'menu-item'}
        >
          <span className="menu-tick" aria-hidden="true">
            {state.sources.length === 0 ? '✓' : ''}
          </span>
          All sources
        </Link>
        <div className="menu-sep" />
        {ALL_SOURCES.map((source) => {
          const on = state.sources.includes(source);
          return (
            <Link
              key={source}
              href={`${basePath}${toQueryString({ ...state, sources: toggle(state.sources, source) as FilterState['sources'] })}`}
              className={on ? 'menu-item on' : 'menu-item'}
            >
              <span className="menu-tick" aria-hidden="true">
                {on ? '✓' : ''}
              </span>
              {SOURCE_LABELS[source]}
            </Link>
          );
        })}
      </FilterMenu>

      <span className="sp" />
      {isFiltered(state) ? (
        <Link href={basePath} className="btn btn-quiet btn-sm">
          Clear all
        </Link>
      ) : null}
      <span className="t-micro num">{formatNumber(leadCount)} leads</span>
    </div>
  );
}

/**
 * The "you are looking at a subset" signal. Rendered whenever any axis is
 * constrained, so a user who scrolls past the filter bar still cannot mistake
 * a slice for the whole book.
 */
export function SubsetBar({
  state,
  branches,
  basePath,
  shown,
  total,
  inheritedNote,
}: {
  state: FilterState;
  branches: readonly Branch[];
  basePath: string;
  shown: number;
  total: number;
  inheritedNote?: string;
}) {
  if (!isFiltered(state) && !inheritedNote) return null;
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? id;
  const parts = describeFilters(state, branchName);

  return (
    <div className="subset-bar">
      <span className="bar-i" aria-hidden="true" />
      <span>
        {inheritedNote ? (
          <>{inheritedNote} </>
        ) : (
          <>
            Filtered view — <b>{formatNumber(shown)} of {formatNumber(total)} leads</b>. Every figure below
            is computed on this subset.
          </>
        )}
        {parts.length > 0 ? <span className="dim"> · {parts.join(' · ')}</span> : null}
      </span>
      <span className="sp" />
      <Link href={basePath} className="btn btn-sm">
        Clear filters
      </Link>
    </div>
  );
}

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="crumb" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} style={{ display: 'contents' }}>
          {index > 0 ? <span aria-hidden="true">›</span> : null}
          {item.href ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <span className="cur" aria-current="page">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** Re-export so pages can build filter-preserving links without extra imports. */
export { hrefWithFilters };
