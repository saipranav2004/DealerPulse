/**
 * Leads Explorer — the rows behind every aggregate.
 *
 * Search, status, sort and page all live in the URL, so any view is shareable
 * and the whole screen works without client JavaScript. The only client code
 * is the CSV export.
 */

import Link from 'next/link';
import { buildLeadTable, type LeadSortKey, type LeadStatusFilter } from '@/lib/analytics/leadTable';
import { computeActionCenter } from '@/lib/analytics/actionCenter';
import { computeLeadTimeline } from '@/lib/analytics/leadTimeline';
import { getDataset } from '@/lib/data';
import { formatCurrency, formatNumber } from '@/lib/format';
import {
  SOURCE_LABELS,
  hrefWithFilters,
  parseFilterState,
  parseViewAs,
  toFilters,
  toQueryString,
  type SearchParams,
} from '@/lib/url-filters';
import { Breadcrumb, FilterBar, SubsetBar, TopBar } from '@/components/chrome';
import { LeadDrawer } from '@/components/lead-drawer';
import { ExportButton } from '@/components/export-button';
import { EmptyByFilter } from '@/components/states';
import type { LeadSource, LeadStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUS_TABS: { key: LeadStatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Still open' },
  { key: 'uncontacted', label: 'Never called' },
  { key: 'stalled', label: 'Paid, undelivered' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'lost', label: 'Lost' },
];

const SORT_KEYS: LeadSortKey[] = ['customer', 'branch', 'rep', 'model', 'stage', 'value', 'age', 'created'];

/**
 * `foldsAway` columns are dropped below 960px, where eight columns cannot fit
 * without a horizontal scroll no one discovers. Nothing is lost: branch and
 * owner reappear under the customer name at that width, and idle days are on
 * the lead itself.
 */
const COLUMNS: { key: LeadSortKey; label: string; numeric?: boolean; foldsAway?: boolean }[] = [
  { key: 'customer', label: 'Customer' },
  { key: 'branch', label: 'Branch', foldsAway: true },
  { key: 'rep', label: 'Owner', foldsAway: true },
  { key: 'model', label: 'Vehicle' },
  { key: 'stage', label: 'Stage' },
  { key: 'value', label: 'Value', numeric: true },
  { key: 'age', label: 'Idle', numeric: true, foldsAway: true },
];

/** A lead is live while it is neither delivered nor lost. */
const isLive = (status: LeadStatus) => status !== 'delivered' && status !== 'lost';

const STAGE_LABEL: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  test_drive: 'Test drive',
  negotiation: 'Negotiation',
  order_placed: 'Order placed',
  delivered: 'Delivered',
  lost: 'Lost',
};

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const dataset = getDataset();
  const baseState = parseFilterState(params, dataset.branches.map((b) => b.id));
  const viewAs = parseViewAs(params, dataset.branches.map((b) => b.id));
  // A role is authoritative, not decorative: a branch manager's view is
  // scoped to their branch even if the branch parameter is missing.
  const state = viewAs ? { ...baseState, branchIds: [viewAs] } : baseState;
  const filters = toFilters(state);
  const basePath = '/leads';

  const one = (key: string) => (typeof params[key] === 'string' ? (params[key] as string) : undefined);

  const query = one('q') ?? '';
  const statusRaw = one('status') ?? 'all';
  const status = (STATUS_TABS.some((t) => t.key === statusRaw) ? statusRaw : 'all') as LeadStatusFilter;
  const sortRaw = one('sort') ?? 'value';
  const sort = (SORT_KEYS.includes(sortRaw as LeadSortKey) ? sortRaw : 'value') as LeadSortKey;
  const dir = one('dir') === 'asc' ? 'asc' : 'desc';
  const page = Number.parseInt(one('page') ?? '1', 10) || 1;

  const table = buildLeadTable(dataset, filters, { query, status, sort, dir, page });
  const actions = computeActionCenter(dataset, filters);
  const actionCount = actions.stalled.count + actions.cold.count;

  const leadParam = one('lead');
  const timeline = leadParam ? computeLeadTimeline(dataset, leadParam) : null;

  /** Preserve every table control when building a link that changes one of them. */
  const tableHref = (over: Record<string, string | undefined>) =>
    `${basePath}${toQueryString(state, {
      q: query || undefined,
      status: status === 'all' ? undefined : status,
      sort: sort === 'value' ? undefined : sort,
      dir: dir === 'desc' ? undefined : dir,
      page: page === 1 ? undefined : String(page),
      ...over,
    })}`;

  const exportRows = table.rows.map((row) => [
    row.id,
    row.customerName,
    row.branchName,
    row.repName,
    row.model,
    SOURCE_LABELS[row.source as LeadSource] ?? row.source,
    STAGE_LABEL[row.status],
    String(row.dealValue),
    String(row.idleDays),
  ]);

  return (
    <div className="app">
      <TopBar
        reconciledCount={dataset.reconciliation.reconciledCount}
        viewAs={viewAs}
        branches={dataset.branches}
        current="leads"
        actionCount={actionCount}
        filters={state}
      />
      <FilterBar
        state={state}
        branches={dataset.branches}
        basePath={basePath}
        leadCount={table.counts.all}
        leadingSlot={
          <>
            <Breadcrumb items={[{ label: 'Overview', href: hrefWithFilters('/', state) }, { label: 'Leads' }]} />
            <span style={{ width: 1, height: 18, background: 'var(--rule)', margin: '0 8px' }} aria-hidden="true" />
          </>
        }
      />
      <SubsetBar
        state={state}
        branches={dataset.branches}
        basePath={basePath}
        shown={table.counts.all}
        total={dataset.leads.length}
      />

      <main id="main">
        <div
          style={{
            background: 'var(--surface)',
            borderBottom: '1px solid var(--rule)',
            padding: 'var(--s4) var(--s5)',
            display: 'flex',
            gap: 'var(--s3)',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {/* A plain GET form, so search works with JavaScript disabled. */}
          <form method="get" action={basePath} style={{ display: 'contents' }}>
            {state.periodId !== 'all' ? <input type="hidden" name="period" value={state.periodId} /> : null}
            {state.branchIds.length > 0 ? (
              <input type="hidden" name="branch" value={state.branchIds.join(',')} />
            ) : null}
            {state.models.length > 0 ? <input type="hidden" name="model" value={state.models.join(',')} /> : null}
            {state.sources.length > 0 ? <input type="hidden" name="source" value={state.sources.join(',')} /> : null}
            {status !== 'all' ? <input type="hidden" name="status" value={status} /> : null}
            <label className="search">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--ink-3)" strokeWidth="1.5" aria-hidden="true">
                <circle cx="7" cy="7" r="4.5" />
                <path d="m10.5 10.5 3 3" />
              </svg>
              <span className="sr-only">Search leads</span>
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Search customer, rep, branch, vehicle…"
                autoComplete="off"
              />
            </label>
            <button type="submit" className="btn btn-sm">
              Search
            </button>
            {query ? (
              <Link href={tableHref({ q: undefined, page: undefined })} className="btn btn-quiet btn-sm">
                Clear
              </Link>
            ) : null}
          </form>

          <span className="sp" />
          <span className="t-micro num">
            {formatNumber(table.total)} {table.total === 1 ? 'lead' : 'leads'} ·{' '}
            {formatCurrency(table.totalValue)}
          </span>
          <ExportButton
            headers={['Lead', 'Customer', 'Branch', 'Owner', 'Vehicle', 'Source', 'Stage', 'Value', 'Idle days']}
            rows={exportRows}
            filename="dealerpulse-leads.csv"
          />
        </div>

        <div style={{ padding: 'var(--s3) var(--s5)', background: 'var(--surface)', borderBottom: '1px solid var(--rule)' }}>
          <nav className="seg" aria-label="Filter by status">
            {STATUS_TABS.map((tab) => (
              <Link
                key={tab.key}
                href={tableHref({ status: tab.key === 'all' ? undefined : tab.key, page: undefined })}
                className={tab.key === status ? 'on' : undefined}
                aria-current={tab.key === status ? 'true' : undefined}
              >
                {tab.label}
                <span className="ct">{formatNumber(table.counts[tab.key])}</span>
              </Link>
            ))}
          </nav>
        </div>

        {table.total === 0 ? (
          query ? (
            <div className="state">
              <div className="state-in">
                <h2 className="t-h2">No lead matches “{query}”</h2>
                <p className="t-small">
                  Search covers customer name, rep, branch, vehicle, lead id and phone number.
                </p>
                <Link href={tableHref({ q: undefined, status: undefined, page: undefined })} className="btn btn-primary">
                  Clear search
                </Link>
              </div>
            </div>
          ) : (
            <EmptyByFilter state={state} branches={dataset.branches} basePath={basePath} />
          )
        ) : (
          <>
            <div style={{ padding: 'var(--s4) var(--s5)' }}>
              <div className="panel" style={{ overflow: 'hidden' }}>
                <div className="scrollx">
                  <table className="tbl tbl-hover tbl-fold tbl-cards">
                    <thead>
                      <tr>
                        {COLUMNS.map((column) => {
                          const active = column.key === sort;
                          const nextDir = active && dir === 'desc' ? 'asc' : 'desc';
                          return (
                            <th
                              key={column.key}
                              className={
                                [column.numeric ? 'r' : '', column.foldsAway ? 'fold' : '']
                                  .filter(Boolean)
                                  .join(' ') || undefined
                              }
                              style={column.key === 'customer' ? { paddingLeft: 16 } : undefined}
                              aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                            >
                              <Link
                                href={tableHref({ sort: column.key, dir: nextDir, page: undefined })}
                                className="sortbtn"
                                data-active={active ? 'true' : 'false'}
                              >
                                {column.label}
                                {active ? <span aria-hidden="true">{dir === 'asc' ? '↑' : '↓'}</span> : null}
                              </Link>
                            </th>
                          );
                        })}
                        <th style={{ paddingRight: 16 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {table.pageRows.map((row) => (
                        <tr key={row.id}>
                          <td className="pin cell-name" style={{ paddingLeft: 16 }}>
                            <Link
                              href={tableHref({ lead: row.id })}
                              scroll={false}
                              className="dp-name"
                              style={{ fontWeight: 500 }}
                            >
                              {row.customerName}
                            </Link>
                            <div className="t-micro num">{row.id}</div>
                            {/* Only rendered once the branch/owner columns fold away. */}
                            <div className="t-micro unfold">
                              {row.branchName.replace(' Toyota', '')} · {row.repName}
                              {isLive(row.status) ? ` · idle ${row.idleDays} d` : ''}
                            </div>
                          </td>
                          <td className="muted fold">{row.branchName.replace(' Toyota', '')}</td>
                          <td className="muted fold">{row.repName}</td>
                          <td className="muted cell-model">{row.model}</td>
                          <td className="cell-stage">
                            <span
                              className={
                                row.isStalled
                                  ? 'chip chip-crit'
                                  : row.status === 'delivered'
                                    ? 'chip chip-pos'
                                    : row.status === 'lost'
                                      ? 'chip'
                                      : 'chip chip-acc'
                              }
                            >
                              {row.isStalled ? 'Paid, undelivered' : STAGE_LABEL[row.status]}
                            </span>
                          </td>
                          <td className="r num cell-value">{formatCurrency(row.dealValue)}</td>
                          {/* Idle time only means something while a lead is still live.
                              A delivered car sitting "144 days" is finished, not urgent. */}
                          <td
                            className={
                              isLive(row.status) && row.idleDays > 30
                                ? 'r num crit fold'
                                : 'r num dim fold'
                            }
                          >
                            {isLive(row.status) ? `${row.idleDays} d` : '—'}
                          </td>
                          <td className="r cell-act" style={{ paddingRight: 16 }}>
                            <Link href={tableHref({ lead: row.id })} scroll={false} className="btn btn-sm">
                              Open
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <footer className="panel-ft">
                  <div className="pager">
                    <span className="t-micro">
                      Showing {formatNumber((table.page - 1) * table.pageSize + 1)}–
                      {formatNumber(Math.min(table.page * table.pageSize, table.total))} of{' '}
                      {formatNumber(table.total)}
                    </span>
                    <span className="gap" />
                    {table.page > 1 ? (
                      <Link href={tableHref({ page: String(table.page - 1) })} className="btn btn-sm">
                        ← Previous
                      </Link>
                    ) : (
                      <button type="button" className="btn btn-sm" disabled>
                        ← Previous
                      </button>
                    )}
                    <span className="t-micro num">
                      Page {table.page} of {table.pageCount}
                    </span>
                    {table.page < table.pageCount ? (
                      <Link href={tableHref({ page: String(table.page + 1) })} className="btn btn-sm">
                        Next →
                      </Link>
                    ) : (
                      <button type="button" className="btn btn-sm" disabled>
                        Next →
                      </button>
                    )}
                  </div>
                </footer>
              </div>
              <p className="t-micro" style={{ marginTop: 'var(--s3)' }}>
                Every lead in the dataset is here. Sort any column, narrow by status, or search by name,
                rep, branch, vehicle or phone. Export gives you all {formatNumber(table.total)} matching
                rows, not just this page.
              </p>
            </div>
          </>
        )}
      </main>

      {timeline ? (
        <LeadDrawer timeline={timeline} closeHref={tableHref({ lead: undefined })} />
      ) : null}
    </div>
  );
}
