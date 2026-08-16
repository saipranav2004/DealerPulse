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
import { Shortcuts } from '@/components/shortcuts';
import { CommandPalette, type CommandItem } from '@/components/command-palette';
import { SavedViews } from '@/components/saved-views';
import { counted, formatNumber } from '@/lib/format';
import { DATA_CURRENT_AS_OF } from '@/lib/build-info';
import {
  ALL_MODELS,
  ALL_SOURCES,
  DEFAULT_PERIOD,
  PERIOD_PRESETS,
  SOURCE_LABELS,
  activeFilters,
  describeFilters,
  hrefWithFilters,
  isFiltered,
  periodFor,
  PERIOD_BASES,
  toQueryString,
  withBasis,
  withView,
  withoutAxis,
  type FilterState,
} from '@/lib/url-filters';
import type { Branch } from '@/lib/types';

export { DATA_CURRENT_AS_OF } from '@/lib/build-info';

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

export type NavKey = 'overview' | 'actions' | 'leads' | 'models';

/**
 * Shape, not decoration: on the tab bar the label is 11px and an icon is what
 * the eye actually lands on. They are never used beside a label elsewhere.
 */
const NAV_ICON: Record<NavKey, React.ReactNode> = {
  overview: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M3 12.5 7.5 8l3.5 3.5L17 5.5" />
      <path d="M3 16.5h14" />
    </svg>
  ),
  actions: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M10 2.5 18 16.5H2Z" />
      <path d="M10 8v3.2" />
      <path d="M10 13.6v.1" />
    </svg>
  ),
  leads: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M3.5 5h13M3.5 10h13M3.5 15h8" />
    </svg>
  ),
  models: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M3 12.5h14l-1.4-4.2A2 2 0 0 0 13.7 7H6.3a2 2 0 0 0-1.9 1.3Z" />
      <path d="M5.5 15.5v-3M14.5 15.5v-3" />
    </svg>
  ),
};

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
  viewAs = null,
  branches = [],
  commands,
  totalLeads,
}: {
  reconciledCount: number;
  subtitle?: string;
  current?: NavKey;
  actionCount?: number;
  filters?: FilterState;
  /** Branch id the viewer is acting as, or null for the group view. */
  viewAs?: string | null;
  branches?: readonly Branch[];
  /** Built on the server so the browser never needs the dataset to search it. */
  commands?: CommandItem[];
  /**
   * Total leads in the dataset — reported, never written down.
   *
   * Required rather than optional: as an optional prop with an em-dash
   * fallback, one page that forgot to pass it rendered "Leads loaded —",
   * which reads as "we could not compute this" rather than as a mistake.
   */
  totalLeads: number;
}) {
  const asBranch = viewAs ? branches.find((b) => b.id === viewAs) : undefined;

  /**
   * In a branch manager's view, "Overview" means *their* branch — the group
   * overview leads with whichever branch is worst, which for four managers in
   * five is somebody else's problem.
   */
  const navHref = (item: (typeof NAV)[number]) => {
    const base =
      asBranch && item.key === 'overview' ? `/branch/${asBranch.id}` : item.href;
    const scoped = filters
      ? hrefWithFilters(base, asBranch ? { ...filters, branchIds: [asBranch.id] } : filters)
      : base;
    return withView(scoped, viewAs);
  };

  return (
    <header className="topbar">
      <Link href={withView('/', viewAs)} className="mark">
        DealerPulse
      </Link>
      {commands ? <CommandPalette items={commands} /> : null}
      {subtitle ? <span className="org marker-hide-sm">{subtitle}</span> : null}

      <nav className="nav" aria-label="Main">
        {NAV.map((item) => (
          <Link
            key={item.key}
            href={navHref(item)}
            className={item.key === current ? 'nav-link on' : 'nav-link'}
            aria-current={item.key === current ? 'page' : undefined}
          >
            {item.key === 'overview' && asBranch ? 'My branch' : item.label}
            {item.key === 'actions' && actionCount !== undefined && actionCount > 0 ? (
              <span className="nav-badge" aria-label={`${actionCount} items need attention`}>
                {actionCount}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      {/*
        Phones get the same four destinations as a thumb-reachable tab bar
        instead. In the top bar they wrapped onto their own row and pushed the
        first real content most of a screen down.
      */}
      <nav className="tabbar" aria-label="Main">
        {NAV.map((item) => (
          <Link
            key={item.key}
            href={navHref(item)}
            className={item.key === current ? 'tabbar-link on' : 'tabbar-link'}
            aria-current={item.key === current ? 'page' : undefined}
          >
            <span className="tabbar-ico" aria-hidden="true">
              {NAV_ICON[item.key]}
            </span>
            <span className="tabbar-txt">
              {item.key === 'overview' && asBranch ? 'My branch' : item.label}
            </span>
            {item.key === 'actions' && actionCount !== undefined && actionCount > 0 ? (
              <span className="nav-badge" aria-label={`${actionCount} items need attention`}>
                {actionCount}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      <span className="sp" />
      {branches.length > 0 ? (
        <details className="menu" data-filter-menu="">
          <summary className="marker-btn" aria-label="Change who you are viewing as">
            <span className="dim vw-label">Viewing as</span>
            <u>{asBranch ? `${asBranch.name.replace(' Toyota', '')} manager` : 'Group CEO'}</u>
          </summary>
          <div className="menu-pop to-right">
            <Link href="/" className={asBranch ? 'menu-item' : 'menu-item on'}>
              <span className="menu-tick" aria-hidden="true">
                {asBranch ? '' : '✓'}
              </span>
              Group CEO — all branches
            </Link>
            <div className="menu-sep" />
            {branches.map((branch) => (
              <Link
                key={branch.id}
                href={`/branch/${branch.id}?as=${branch.id}`}
                className={branch.id === viewAs ? 'menu-item on' : 'menu-item'}
              >
                <span className="menu-tick" aria-hidden="true">
                  {branch.id === viewAs ? '✓' : ''}
                </span>
                {branch.name.replace(' Toyota', '')} manager
              </Link>
            ))}
          </div>
        </details>
      ) : null}
      {/*
        The freshness contract. "Data current as of" is a claim, and a reader is
        entitled to know exactly what it means here: the clock is pinned to the
        dataset's last activity, not to now, so the same URL gives the same
        numbers today and in a year. Saying that out loud is the difference
        between a fixture and a dashboard that is quietly stale.
      */}
      <details className="menu" data-filter-menu="">
        <summary className="marker marker-btn" aria-label={`Data current as of ${DATA_CURRENT_AS_OF} — what this means`}>
          <i className="dot" aria-hidden="true" />
          <span className="marker-hide-sm">Data current as of {DATA_CURRENT_AS_OF}</span>
          <span className="marker-date-sm" aria-hidden="true">
            {DATA_CURRENT_AS_OF}
          </span>
        </summary>
        <div className="menu-pop to-right" style={{ minWidth: 300, padding: 'var(--s3)' }}>
          <p className="t-label" style={{ marginBottom: 8 }}>
            What “current as of” means
          </p>
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px' }}>
            <dt className="t-small">Latest activity in the data</dt>
            <dd className="num t-small" style={{ margin: 0, textAlign: 'right' }}>
              {DATA_CURRENT_AS_OF}
            </dd>
            <dt className="t-small">“Now”, for every age and overdue figure</dt>
            <dd className="num t-small" style={{ margin: 0, textAlign: 'right' }}>
              pinned there
            </dd>
            <dt className="t-small">Refreshes on its own</dt>
            <dd className="num t-small" style={{ margin: 0, textAlign: 'right' }}>
              no
            </dd>
          </dl>
          <p className="t-micro" style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--rule)' }}>
            Every duration on this screen is measured from that instant rather than from the wall clock, so a
            lead that is 195 days idle stays 195 days idle. Nothing here polls a live system; the figures
            change only when the underlying export does.
          </p>
        </div>
      </details>
      <ThemeToggle />
      <Shortcuts />
      <details className="menu" data-filter-menu="">
        <summary className="marker-btn" aria-label={`${reconciledCount} records reconciled — data quality`}>
          <u>
            {reconciledCount} <span className="recon-word">records </span>reconciled
          </u>
        </summary>
        <div className="menu-pop to-right" style={{ minWidth: 300, padding: 'var(--s3)' }}>
          <p className="t-label" style={{ marginBottom: 8 }}>
            Data quality
          </p>
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px' }}>
            <dt className="t-small">Leads loaded</dt>
            <dd className="num t-small" style={{ margin: 0, textAlign: 'right' }}>
              {formatNumber(totalLeads)}
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

/**
 * One filter option, expressed once and rendered twice.
 *
 * The two presentations are genuinely different interfaces, not one interface
 * at two sizes: on a pointer device a row of dropdown chips is fast, and on a
 * phone it was actively broken — three native `<details>` popovers could be
 * open at once, stacked on top of each other and on top of the page. So the
 * phone gets a full-screen sheet with every group laid out at once, and the
 * options are built from a single description so the two can never disagree.
 */
interface FilterOption {
  key: string;
  label: string;
  href: string;
  selected: boolean;
}

interface FilterGroup {
  key: string;
  /** Chip label, e.g. "Period". */
  label: string;
  /** Chip value, e.g. "Jun – Dec". */
  value: string;
  active: boolean;
  options: FilterOption[];
}

function OptionLink({ option }: { option: FilterOption }) {
  return (
    <Link href={option.href} className={option.selected ? 'menu-item on' : 'menu-item'}>
      <span className="menu-tick" aria-hidden="true">
        {option.selected ? '✓' : ''}
      </span>
      {option.label}
    </Link>
  );
}

/**
 * A dropdown chip. `name` makes the group an exclusive accordion in browsers
 * that support it; `data-filter-menu` lets the tiny enhancement script in the
 * layout close siblings everywhere else. Without one of the two, opening a
 * second menu leaves the first one open underneath it.
 */
function FilterMenu({ group }: { group: FilterGroup }) {
  return (
    <details className="menu" name="dp-filter" data-filter-menu="">
      <summary className={group.active ? 'filter is-active' : 'filter'}>
        <span className="k">{group.label}</span>
        {group.value}
        <span className="caret" aria-hidden="true">
          ▾
        </span>
      </summary>
      <div className="menu-pop">
        {group.options.map((option) =>
          option.key === '--sep--' ? (
            <div className="menu-sep" key={option.key} />
          ) : (
            <OptionLink key={option.key} option={option} />
          ),
        )}
      </div>
    </details>
  );
}

/** The global filter bar. `basePath` keeps filters pointed at the current screen. */
/**
 * A default name for a saved view, assembled from what is actually selected.
 * "Lakeside · Q4 2025 · Leads" beats "Saved view 3" when there are eight of
 * them in a list six months later.
 */
function viewName(state: FilterState, basePath: string, branches: readonly Branch[]): string {
  const screen =
    basePath === '/' ? 'Overview'
    : basePath === '/leads' ? 'Leads'
    : basePath === '/actions' ? 'Act now'
    : basePath === '/models' ? 'Vehicles'
    : basePath.replace(/^\//, '');
  const parts = describeFilters(state, (id) =>
    (branches.find((b) => b.id === id)?.name ?? id).replace(' Toyota', ''),
  );
  return parts.length > 0 ? `${parts.join(' · ')} · ${screen}` : screen;
}

export function FilterBar({
  state,
  branches,
  basePath,
  leadCount,
  leadingSlot,
  branchScope,
}: {
  state: FilterState;
  branches: readonly Branch[];
  basePath: string;
  leadCount: number;
  leadingSlot?: React.ReactNode;
  /**
   * Set on routes that are already scoped to one branch. There, a branch
   * *filter* is a trap: picking a different branch produced "0 of 510 leads"
   * and the recovery link carried the conflict forward. So on those routes the
   * control navigates to the branch instead of filtering within it.
   */
  branchScope?: { branchId: string };
}) {
  const period = periodFor(state);
  const scopedBranch = branchScope ? branches.find((b) => b.id === branchScope.branchId) : undefined;

  const branchLabel = scopedBranch
    ? scopedBranch.name.replace(' Toyota', '')
    : state.branchIds.length === 0
      ? `All ${branches.length}`
      : state.branchIds.length === 1
        ? (branches.find((b) => b.id === state.branchIds[0])?.name.replace(' Toyota', '') ??
          state.branchIds[0])
        : `${state.branchIds.length} selected`;
  const modelLabel =
    state.models.length === 0
      ? 'All'
      : state.models.length === 1
        ? state.models[0]
        : `${state.models.length} selected`;
  const sourceLabel =
    state.sources.length === 0
      ? 'All'
      : state.sources.length === 1
        ? SOURCE_LABELS[state.sources[0]]
        : `${state.sources.length} selected`;

  const separator: FilterOption = { key: '--sep--', label: '', href: '', selected: false };
  const groups: FilterGroup[] = [
    {
      key: 'period',
      label: 'Period',
      value: period.shortLabel,
      active: state.periodId !== DEFAULT_PERIOD.id,
      options: [
        ...PERIOD_PRESETS.map((preset) => ({
          key: preset.id,
          label: preset.label,
          href: `${basePath}${toQueryString({ ...state, periodId: preset.id })}`,
          selected: preset.id === state.periodId,
        })),
        // Over the full dataset every lead is in scope on either basis, so the
        // choice would be a control that does nothing.
        ...(state.periodId === DEFAULT_PERIOD.id
          ? []
          : [
              separator,
              ...PERIOD_BASES.map((entry) => ({
                key: `basis-${entry.id}`,
                label: entry.label,
                href: `${basePath}${toQueryString(withBasis(state, entry.id))}`,
                selected: state.basis === entry.id,
              })),
            ]),
      ],
    },
    scopedBranch
      ? {
          key: 'branch',
          label: 'Viewing',
          value: branchLabel,
          active: true,
          options: [
            {
              key: 'all',
              label: 'All branches (overview)',
              href: `/${toQueryString(withoutAxis(state, 'branch'))}`,
              selected: false,
            },
            separator,
            ...branches.map((branch) => ({
              key: branch.id,
              label: branch.name,
              href: `/branch/${branch.id}${toQueryString(withoutAxis(state, 'branch'))}`,
              selected: branch.id === scopedBranch.id,
            })),
          ],
        }
      : {
          key: 'branch',
          label: 'Branch',
          value: branchLabel,
          active: state.branchIds.length > 0,
          options: [
            {
              key: 'all',
              label: 'All branches',
              href: `${basePath}${toQueryString(withoutAxis(state, 'branch'))}`,
              selected: state.branchIds.length === 0,
            },
            separator,
            ...branches.map((branch) => ({
              key: branch.id,
              label: branch.name,
              href: `${basePath}${toQueryString({ ...state, branchIds: toggle(state.branchIds, branch.id) })}`,
              selected: state.branchIds.includes(branch.id),
            })),
          ],
        },
    {
      key: 'model',
      label: 'Vehicle',
      value: modelLabel,
      active: state.models.length > 0,
      options: [
        {
          key: 'all',
          label: 'All vehicles',
          href: `${basePath}${toQueryString(withoutAxis(state, 'model'))}`,
          selected: state.models.length === 0,
        },
        separator,
        ...ALL_MODELS.map((model) => ({
          key: model,
          label: model,
          href: `${basePath}${toQueryString({ ...state, models: toggle(state.models, model) as FilterState['models'] })}`,
          selected: state.models.includes(model),
        })),
      ],
    },
    {
      key: 'source',
      label: 'Source',
      value: sourceLabel,
      active: state.sources.length > 0,
      options: [
        {
          key: 'all',
          label: 'All sources',
          href: `${basePath}${toQueryString(withoutAxis(state, 'source'))}`,
          selected: state.sources.length === 0,
        },
        separator,
        ...ALL_SOURCES.map((source) => ({
          key: source,
          label: SOURCE_LABELS[source],
          href: `${basePath}${toQueryString({ ...state, sources: toggle(state.sources, source) as FilterState['sources'] })}`,
          selected: state.sources.includes(source),
        })),
      ],
    },
  ];

  const activeCount = groups.filter((group) => group.active && group.key !== 'branch').length +
    (scopedBranch ? 0 : state.branchIds.length > 0 ? 1 : 0);

  return (
    <div className="filterbar">
      {leadingSlot}

      {/* Pointer-sized: a row of dropdown chips. */}
      <div className="fb-chips">
        {groups.map((group) => (
          <FilterMenu key={group.key} group={group} />
        ))}
      </div>

      {/* Phone-sized: one button opening a sheet that holds every group. */}
      <details className="fb-sheet" data-filter-menu="">
        <summary className={activeCount > 0 ? 'filter is-active' : 'filter'}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M2 4h12M4.5 8h7M7 12h2" strokeLinecap="round" />
          </svg>
          Filters
          {activeCount > 0 ? <span className="fb-count num">{activeCount}</span> : null}
        </summary>
        <div className="fb-panel">
          <div className="fb-panel-in">
            {groups.map((group) => (
              <section key={group.key} className="fb-group">
                <h2 className="t-label">{group.label}</h2>
                <div className="fb-opts">
                  {group.options.map((option) =>
                    option.key === '--sep--' ? null : <OptionLink key={option.key} option={option} />,
                  )}
                </div>
              </section>
            ))}
            <div className="fb-actions">
              <span className="t-micro num">{counted(leadCount, 'lead')} match</span>
              <span className="sp" />
              {isFiltered(state) ? (
                <Link href={basePath} className="btn">
                  Clear all
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </details>

      <span className="sp" />
      {/* The filters already live in the URL, so a saved view is just a name
          and a query string — no second source of truth to drift. */}
      <SavedViews
        currentHref={`${basePath}${toQueryString(state)}`}
        suggestedName={viewName(state, basePath, branches)}
      />
      {isFiltered(state) ? (
        <Link href={basePath} className="btn btn-quiet btn-sm fb-clear">
          Clear all
        </Link>
      ) : null}
      <span className="t-micro num fb-count-label" aria-live="polite" aria-atomic="true">
        {counted(leadCount, 'lead')}
      </span>
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
  const active = activeFilters(state, branchName);

  return (
    <div className="subset-bar">
      <span className="bar-i" aria-hidden="true" />
      <span>
        {inheritedNote ? (
          <>{inheritedNote} </>
        ) : (
          <>
            Filtered view — <b>{formatNumber(shown)} of {counted(total, 'lead')}</b>. Every figure below is
            computed on this subset.
          </>
        )}
      </span>
      {/*
        One chip per selected value, each dropping only itself. These were a
        joined sentence before, which meant the only way out of a two-branch
        selection was to clear every filter on the page.
      */}
      {active.length > 0 ? (
        <span className="fchips" data-flip="chips">
          {active.map((filter) => (
            <Link
              key={filter.key}
              data-flip-key={filter.key}
              className="fchip"
              href={`${basePath}${toQueryString(filter.without)}`}
              aria-label={`Remove filter ${filter.label}`}
              scroll={false}
            >
              <span className="fchip-k">{filter.kind}</span>
              {filter.label}
              <span className="fchip-x" aria-hidden="true">
                ×
              </span>
            </Link>
          ))}
        </span>
      ) : null}
      <span className="sp" />
      {/* The basis changes what the period *means*, so it is offered as a
          one-click switch here rather than only inside the period menu. */}
      {state.periodId !== DEFAULT_PERIOD.id ? (
        <Link
          href={`${basePath}${toQueryString(withBasis(state, state.basis === 'cohort' ? 'calendar' : 'cohort'))}`}
          className="btn btn-sm"
        >
          {state.basis === 'cohort' ? 'Show activity in period' : 'Show leads created in period'}
        </Link>
      ) : null}
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
