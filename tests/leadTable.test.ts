import { describe, expect, it } from 'vitest';

import { DEFAULT_PAGE_SIZE, buildLeadTable, openLeadRows } from '@/lib/analytics/leadTable';
import { getDataset } from '@/lib/data';

const dataset = getDataset();

describe('buildLeadTable — shape', () => {
  const table = buildLeadTable(dataset);

  it('returns every lead by default', () => {
    expect(table.total).toBe(510);
    expect(table.pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(table.pageRows).toHaveLength(25);
    expect(table.pageCount).toBe(Math.ceil(510 / 25));
  });

  it('totals value across all matches, not just the visible page', () => {
    const everything = dataset.leads.reduce((sum, lead) => sum + lead.dealValue, 0);
    expect(table.totalValue).toBe(everything);
  });

  it('counts each status bucket against the searched set', () => {
    expect(table.counts.all).toBe(510);
    expect(table.counts.open).toBe(62);
    expect(table.counts.delivered).toBe(160);
    expect(table.counts.lost).toBe(288);
    expect(table.counts.stalled).toBe(38);
    expect(table.counts.uncontacted).toBe(119);
  });

  it('resolves names rather than leaving ids', () => {
    const row = table.pageRows[0];
    expect(row.branchName).toMatch(/Toyota$/);
    expect(row.repName).not.toMatch(/^SR\d+$/);
  });
});

describe('buildLeadTable — search', () => {
  it('finds a lead by customer name', () => {
    const table = buildLeadTable(dataset, {}, { query: 'Omkar Varma' });
    expect(table.total).toBe(1);
    expect(table.pageRows[0].id).toBe('L0022');
  });

  it('finds leads by rep, branch, model and id', () => {
    expect(buildLeadTable(dataset, {}, { query: 'Venkat Mishra' }).total).toBe(22);
    expect(buildLeadTable(dataset, {}, { query: 'Lakeside' }).total).toBe(79);
    expect(buildLeadTable(dataset, {}, { query: 'Fortuner' }).total).toBe(94);
    expect(buildLeadTable(dataset, {}, { query: 'L0022' }).total).toBe(1);
  });

  it('is case-insensitive and trims', () => {
    expect(buildLeadTable(dataset, {}, { query: '  oMkAr vArMa ' }).total).toBe(1);
  });

  it('returns nothing for a term that matches nothing', () => {
    const table = buildLeadTable(dataset, {}, { query: 'zzzznotathing' });
    expect(table.total).toBe(0);
    expect(table.pageRows).toHaveLength(0);
    expect(table.pageCount).toBe(1);
    expect(table.totalValue).toBe(0);
  });

  it('narrows the status counts to the search, not the whole book', () => {
    const table = buildLeadTable(dataset, {}, { query: 'Lakeside' });
    expect(table.counts.all).toBe(79);
    expect(table.counts.delivered).toBe(6);
    expect(table.counts.stalled).toBe(4);
  });
});

describe('buildLeadTable — status narrowing', () => {
  it('filters to each bucket', () => {
    expect(buildLeadTable(dataset, {}, { status: 'open' }).total).toBe(62);
    expect(buildLeadTable(dataset, {}, { status: 'delivered' }).total).toBe(160);
    expect(buildLeadTable(dataset, {}, { status: 'lost' }).total).toBe(288);
    expect(buildLeadTable(dataset, {}, { status: 'uncontacted' }).total).toBe(119);
  });

  it('stalled means an order with no delivery record', () => {
    const table = buildLeadTable(dataset, {}, { status: 'stalled' });
    expect(table.total).toBe(38);
    for (const row of table.rows) {
      expect(row.status).toBe('order_placed');
      expect(row.isStalled).toBe(true);
    }
  });
});

describe('buildLeadTable — sorting', () => {
  it('sorts by value descending by default', () => {
    const rows = buildLeadTable(dataset).rows;
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i - 1].dealValue).toBeGreaterThanOrEqual(rows[i].dealValue);
    }
    expect(rows[0].dealValue).toBe(5_600_000);
  });

  it('sorts ascending when asked', () => {
    const rows = buildLeadTable(dataset, {}, { sort: 'value', dir: 'asc' }).rows;
    expect(rows[0].dealValue).toBe(750_000);
  });

  it('sorts by every key without throwing', () => {
    for (const sort of ['customer', 'branch', 'rep', 'model', 'stage', 'value', 'age', 'created'] as const) {
      const rows = buildLeadTable(dataset, {}, { sort }).rows;
      expect(rows).toHaveLength(510);
    }
  });

  it('breaks ties on id so paging is stable', () => {
    // Many leads share a deal value; the order must be deterministic.
    const first = buildLeadTable(dataset, {}, { sort: 'value', page: 3 }).pageRows.map((r) => r.id);
    const second = buildLeadTable(dataset, {}, { sort: 'value', page: 3 }).pageRows.map((r) => r.id);
    expect(first).toEqual(second);
  });

  it('never puts a row on two pages', () => {
    const seen = new Set<string>();
    const table = buildLeadTable(dataset);
    for (let page = 1; page <= table.pageCount; page += 1) {
      for (const row of buildLeadTable(dataset, {}, { page }).pageRows) {
        expect(seen.has(row.id)).toBe(false);
        seen.add(row.id);
      }
    }
    expect(seen.size).toBe(510);
  });
});

describe('buildLeadTable — paging', () => {
  it('clamps a page below one', () => {
    expect(buildLeadTable(dataset, {}, { page: -5 }).page).toBe(1);
  });

  it('clamps a page past the end', () => {
    const table = buildLeadTable(dataset, {}, { page: 9999 });
    expect(table.page).toBe(table.pageCount);
    expect(table.pageRows.length).toBeGreaterThan(0);
  });

  it('honours a custom page size', () => {
    const table = buildLeadTable(dataset, {}, { pageSize: 100 });
    expect(table.pageRows).toHaveLength(100);
    expect(table.pageCount).toBe(6);
  });

  it('never divides by a zero page size', () => {
    const table = buildLeadTable(dataset, {}, { pageSize: 0 });
    expect(table.pageSize).toBe(1);
    expect(Number.isFinite(table.pageCount)).toBe(true);
  });
});

describe('buildLeadTable — with filters and scope', () => {
  it('respects the global filters', () => {
    expect(buildLeadTable(dataset, { branchIds: ['B3'] }).total).toBe(79);
  });

  it('respects a rep scope', () => {
    const table = buildLeadTable(dataset, {}, {}, { kind: 'rep', repId: 'SR16' });
    expect(table.total).toBe(22);
  });

  it('combines a filter, a search and a status', () => {
    const table = buildLeadTable(dataset, { branchIds: ['B3'] }, { query: 'Venkat', status: 'lost' });
    expect(table.total).toBe(20);
    for (const row of table.rows) {
      expect(row.branchId).toBe('B3');
      expect(row.repName).toContain('Venkat');
      expect(row.status).toBe('lost');
    }
  });
});

describe('openLeadRows', () => {
  it('returns open leads oldest first', () => {
    const rows = openLeadRows(dataset);
    expect(rows).toHaveLength(62);
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i - 1].idleDays).toBeGreaterThanOrEqual(rows[i].idleDays);
    }
    expect(rows[0].idleDays).toBe(195);
  });
});
