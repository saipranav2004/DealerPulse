import { describe, expect, it } from 'vitest';

import { getDataset, NOW, toMonthKey } from '@/lib/data';

describe('dataset loader', () => {
  const dataset = getDataset();

  it('loads the documented dataset shape', () => {
    expect(dataset.leads).toHaveLength(510);
    expect(dataset.branches).toHaveLength(5);
    expect(dataset.reps).toHaveLength(30);
    expect(dataset.deliveries).toHaveLength(160);
    expect(dataset.targets).toHaveLength(35);
  });

  it('splits reps into 25 sales officers and 5 branch managers', () => {
    expect(dataset.reps.filter((rep) => rep.role === 'sales_officer')).toHaveLength(25);
    expect(dataset.reps.filter((rep) => rep.role === 'branch_manager')).toHaveLength(5);
  });

  it('pins NOW to the maximum last_activity_at in the dataset', () => {
    const maxActivity = Math.max(
      ...dataset.leads.map((lead) => lead.lastActivityAt.getTime()),
    );
    expect(NOW.toISOString()).toBe('2025-12-31T19:10:00.000Z');
    expect(maxActivity).toBe(NOW.getTime());
  });

  it('parses every timestamp to a Date at load, not at call sites', () => {
    for (const lead of dataset.leads) {
      expect(lead.createdAt).toBeInstanceOf(Date);
      expect(lead.lastActivityAt).toBeInstanceOf(Date);
      expect(Number.isNaN(lead.createdAt.getTime())).toBe(false);
      for (const entry of lead.statusHistory) {
        expect(entry.timestamp).toBeInstanceOf(Date);
        expect(Number.isNaN(entry.timestamp.getTime())).toBe(false);
      }
    }
    for (const delivery of dataset.deliveries) {
      expect(delivery.orderDate).toBeInstanceOf(Date);
      expect(delivery.deliveryDate).toBeInstanceOf(Date);
    }
  });

  it('memoizes: repeated loads return the same object identity', () => {
    expect(getDataset()).toBe(dataset);
    expect(getDataset().leads).toBe(dataset.leads);
  });
});

describe('status / history reconciliation', () => {
  const dataset = getDataset();

  it('reconciles exactly 14 leads', () => {
    expect(dataset.reconciliation.reconciledCount).toBe(14);
    expect(dataset.reconciliation.reconciledIds).toHaveLength(14);
  });

  it('reconciles precisely the leads whose status was absent from their history', () => {
    const flagged = dataset.leads.filter((lead) => lead.reconciled).map((lead) => lead.id);
    expect(flagged.sort()).toEqual([...dataset.reconciliation.reconciledIds].sort());
  });

  it('appends a synthetic terminal entry rather than rewriting history', () => {
    for (const id of dataset.reconciliation.reconciledIds) {
      const lead = dataset.indexes.leadsById.get(id);
      expect(lead).toBeDefined();
      if (!lead) continue;

      const synthetic = lead.statusHistory.filter((entry) => entry.synthetic);
      expect(synthetic).toHaveLength(1);
      expect(synthetic[0].status).toBe(lead.status);
      expect(synthetic[0].timestamp.getTime()).toBe(lead.lastActivityAt.getTime());

      // Original entries survive untouched.
      const original = lead.statusHistory.filter((entry) => !entry.synthetic);
      expect(original.length).toBe(lead.statusHistory.length - 1);
    }
  });

  it('leaves every lead with its current status present in history', () => {
    for (const lead of dataset.leads) {
      expect(lead.stagesReached.has(lead.status)).toBe(true);
    }
  });

  it('only ever needed reconciliation for lost leads in this dataset', () => {
    for (const id of dataset.reconciliation.reconciledIds) {
      expect(dataset.indexes.leadsById.get(id)?.status).toBe('lost');
    }
  });
});

describe('lookup indexes', () => {
  const dataset = getDataset();

  it('indexes leads by branch, covering every lead exactly once', () => {
    let total = 0;
    for (const branch of dataset.branches) {
      const leads = dataset.indexes.leadsByBranch.get(branch.id);
      expect(leads).toBeDefined();
      total += leads?.length ?? 0;
    }
    expect(total).toBe(510);
  });

  it('indexes leads by rep, with an empty bucket for zero-lead reps', () => {
    let total = 0;
    for (const rep of dataset.reps) {
      const leads = dataset.indexes.leadsByRep.get(rep.id);
      expect(leads).toBeDefined();
      total += leads?.length ?? 0;
    }
    expect(total).toBe(510);

    const withLeads = dataset.reps.filter(
      (rep) => (dataset.indexes.leadsByRep.get(rep.id)?.length ?? 0) > 0,
    );
    expect(withLeads).toHaveLength(25);
  });

  it('indexes deliveries by lead id', () => {
    expect(dataset.indexes.deliveriesByLeadId.size).toBe(160);
    for (const delivery of dataset.deliveries) {
      expect(dataset.indexes.deliveriesByLeadId.get(delivery.leadId)).toBe(delivery);
    }
  });

  it('indexes targets by (branch, month)', () => {
    expect(dataset.indexes.targetsByBranchMonth.size).toBe(35);
    expect(dataset.indexes.targetsByBranchMonth.get('B1|2025-06')?.targetUnits).toBe(39);
  });
});

describe('toMonthKey', () => {
  it('buckets by UTC month regardless of host timezone', () => {
    expect(toMonthKey(new Date('2025-06-01T18:46:00Z'))).toBe('2025-06');
    expect(toMonthKey(new Date('2025-12-31T23:59:59Z'))).toBe('2025-12');
    expect(toMonthKey(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01');
  });
});
