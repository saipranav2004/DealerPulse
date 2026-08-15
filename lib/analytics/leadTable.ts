/**
 * The lead table behind the explorer.
 *
 * Search, status narrowing, sorting and paging are data operations, so they
 * live here as one pure function rather than being scattered through a
 * component. That makes the whole explorer testable without rendering it.
 */

import { NOW } from '@/lib/data';
import { selectLeads } from '@/lib/filters';
import { isOpen, isStalledOrder } from '@/lib/lead';
import { wholeDaysBetween } from '@/lib/stats';
import type { Dataset } from '@/lib/data';
import type { Filters, Lead, LeadStatus, Scope } from '@/lib/types';

export type LeadStatusFilter = 'all' | 'open' | 'delivered' | 'lost' | 'stalled' | 'uncontacted';

export type LeadSortKey =
  | 'customer'
  | 'branch'
  | 'rep'
  | 'model'
  | 'stage'
  | 'value'
  | 'age'
  | 'created';

export interface LeadRow {
  id: string;
  customerName: string;
  phone: string;
  branchId: string;
  branchName: string;
  repId: string;
  repName: string;
  model: string;
  source: string;
  status: LeadStatus;
  dealValue: number;
  /** Whole days since the last activity on this lead. */
  idleDays: number;
  createdAt: Date;
  expectedCloseDate: Date;
  isStalled: boolean;
  everContacted: boolean;
}

export interface LeadTableQuery {
  query?: string;
  status?: LeadStatusFilter;
  sort?: LeadSortKey;
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface LeadTableResult {
  rows: LeadRow[];
  /** Rows on the current page. */
  pageRows: LeadRow[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  /** Totals across every matching row, not just the visible page. */
  totalValue: number;
  counts: Record<LeadStatusFilter, number>;
}

const STAGE_ORDER: Record<LeadStatus, number> = {
  new: 0,
  contacted: 1,
  test_drive: 2,
  negotiation: 3,
  order_placed: 4,
  delivered: 5,
  lost: 6,
};

function matchesQuery(row: LeadRow, needle: string): boolean {
  if (needle === '') return true;
  return (
    row.customerName.toLowerCase().includes(needle) ||
    row.repName.toLowerCase().includes(needle) ||
    row.branchName.toLowerCase().includes(needle) ||
    row.model.toLowerCase().includes(needle) ||
    row.id.toLowerCase().includes(needle) ||
    row.phone.includes(needle)
  );
}

function matchesStatus(row: LeadRow, status: LeadStatusFilter): boolean {
  switch (status) {
    case 'all':
      return true;
    case 'open':
      return row.status !== 'delivered' && row.status !== 'lost';
    case 'delivered':
      return row.status === 'delivered';
    case 'lost':
      return row.status === 'lost';
    case 'stalled':
      return row.isStalled;
    case 'uncontacted':
      return !row.everContacted;
  }
}

function toRow(lead: Lead, dataset: Dataset): LeadRow {
  return {
    id: lead.id,
    customerName: lead.customerName,
    phone: lead.phone,
    branchId: lead.branchId,
    branchName: dataset.indexes.branchesById.get(lead.branchId)?.name ?? lead.branchId,
    repId: lead.assignedTo,
    repName: dataset.indexes.repsById.get(lead.assignedTo)?.name ?? lead.assignedTo,
    model: lead.model,
    source: lead.source,
    status: lead.status,
    dealValue: lead.dealValue,
    idleDays: wholeDaysBetween(lead.lastActivityAt, NOW),
    createdAt: lead.createdAt,
    expectedCloseDate: lead.expectedCloseDate,
    isStalled: isStalledOrder(lead, dataset),
    everContacted: lead.stagesReached.has('contacted'),
  };
}

function compare(a: LeadRow, b: LeadRow, key: LeadSortKey): number {
  switch (key) {
    case 'customer':
      return a.customerName.localeCompare(b.customerName);
    case 'branch':
      return a.branchName.localeCompare(b.branchName);
    case 'rep':
      return a.repName.localeCompare(b.repName);
    case 'model':
      return a.model.localeCompare(b.model);
    case 'stage':
      return STAGE_ORDER[a.status] - STAGE_ORDER[b.status];
    case 'value':
      return a.dealValue - b.dealValue;
    case 'age':
      return a.idleDays - b.idleDays;
    case 'created':
      return a.createdAt.getTime() - b.createdAt.getTime();
  }
}

export const DEFAULT_PAGE_SIZE = 25;

/**
 * Build the table. Sorting is always total — ties break on lead id — so paging
 * is stable and a row never appears on two pages.
 */
export function buildLeadTable(
  dataset: Dataset,
  filters: Filters = {},
  query: LeadTableQuery = {},
  scope: Scope = { kind: 'company' },
): LeadTableResult {
  const {
    query: rawQuery = '',
    status = 'all',
    sort = 'value',
    dir = 'desc',
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  } = query;

  const needle = rawQuery.trim().toLowerCase();
  const all = selectLeads(dataset, filters, scope).map((lead) => toRow(lead, dataset));
  const searched = needle === '' ? all : all.filter((row) => matchesQuery(row, needle));

  const counts: Record<LeadStatusFilter, number> = {
    all: searched.length,
    open: searched.filter((row) => matchesStatus(row, 'open')).length,
    delivered: searched.filter((row) => matchesStatus(row, 'delivered')).length,
    lost: searched.filter((row) => matchesStatus(row, 'lost')).length,
    stalled: searched.filter((row) => matchesStatus(row, 'stalled')).length,
    uncontacted: searched.filter((row) => matchesStatus(row, 'uncontacted')).length,
  };

  const rows = searched.filter((row) => matchesStatus(row, status));
  const sign = dir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    const primary = compare(a, b, sort);
    return primary !== 0 ? primary * sign : a.id.localeCompare(b.id);
  });

  const safeSize = Math.max(1, pageSize);
  const pageCount = Math.max(1, Math.ceil(rows.length / safeSize));
  const safePage = Math.min(Math.max(1, Math.floor(page)), pageCount);
  const start = (safePage - 1) * safeSize;

  return {
    rows,
    pageRows: rows.slice(start, start + safeSize),
    total: rows.length,
    page: safePage,
    pageCount: pageCount,
    pageSize: safeSize,
    totalValue: rows.reduce((sum, row) => sum + row.dealValue, 0),
    counts,
  };
}

/** Every open lead, oldest first — used by the "needs attention" shortcut. */
export function openLeadRows(dataset: Dataset, filters: Filters = {}): LeadRow[] {
  return selectLeads(dataset, filters)
    .filter(isOpen)
    .map((lead) => toRow(lead, dataset))
    .sort((a, b) => b.idleDays - a.idleDays);
}
