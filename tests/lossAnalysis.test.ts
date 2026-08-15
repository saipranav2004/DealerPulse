import { describe, expect, it } from 'vitest';

import { computeLossAnalysis } from '@/lib/analytics/lossAnalysis';
import { getDataset } from '@/lib/data';
import { formatCurrency } from '@/lib/format';

const dataset = getDataset();
const result = computeLossAnalysis(dataset);

describe('computeLossAnalysis — where deals die (VERIFY.md)', () => {
  it('covers 288 lost leads worth ₹69.65 Cr', () => {
    expect(result.lostCount).toBe(288);
    expect(formatCurrency(result.lostValue)).toBe('₹69.65 Cr');
  });

  it('attributes losses to the stage occupied before the loss', () => {
    const count = (stage: string) => result.byStage.find((s) => s.stage === stage)?.count;
    expect(count('new')).toBe(114);
    expect(count('contacted')).toBe(81);
    expect(count('test_drive')).toBe(59);
    expect(count('negotiation')).toBe(34);
  });

  it('sums stage buckets to the lost total', () => {
    expect(result.byStage.reduce((sum, s) => sum + s.count, 0)).toBe(288);
  });

  it('orders stage buckets by funnel position', () => {
    expect(result.byStage.map((s) => s.stage)).toEqual([
      'new',
      'contacted',
      'test_drive',
      'negotiation',
    ]);
  });

  it('records no losses after an order was placed', () => {
    expect(result.byStage.some((s) => s.stage === 'order_placed')).toBe(false);
  });
});

describe('computeLossAnalysis — reasons', () => {
  const count = (reason: string) =>
    result.byReason.find((r) => r.reason === reason)?.count;

  it('matches the documented reason distribution', () => {
    expect(count('Better offer elsewhere')).toBe(40);
    expect(count('Not ready to purchase')).toBe(40);
    expect(count('Financing not approved')).toBe(38);
    expect(count('Unresponsive after follow-up')).toBe(38);
    expect(count('Budget constraints')).toBe(36);
    expect(count('Chose competitor brand')).toBe(30);
    expect(count('Dissatisfied with test drive')).toBe(28);
    expect(count('Relocated to another city')).toBe(24);
  });

  it('sums the eight recorded reasons to 274', () => {
    const recorded = result.byReason
      .filter((r) => r.reason !== null)
      .reduce((sum, r) => sum + r.count, 0);
    expect(recorded).toBe(274);
  });

  it('reports the 14 leads with no reason on file rather than dropping them', () => {
    expect(result.unspecifiedCount).toBe(14);
    expect(result.byReason.reduce((sum, r) => sum + r.count, 0)).toBe(288);
  });

  it('is exactly the reconciled leads that carry no reason', () => {
    const unspecified = dataset.leads.filter(
      (lead) => lead.status === 'lost' && lead.lostReason === null,
    );
    expect(unspecified).toHaveLength(14);
    expect(unspecified.every((lead) => lead.reconciled)).toBe(true);
  });

  it('sorts recorded reasons by frequency and puts unspecified last', () => {
    const recorded = result.byReason.filter((r) => r.reason !== null);
    for (let i = 1; i < recorded.length; i += 1) {
      expect(recorded[i - 1].count).toBeGreaterThanOrEqual(recorded[i].count);
    }
    expect(result.byReason[result.byReason.length - 1].reason).toBeNull();
  });
});

describe('computeLossAnalysis — scoped', () => {
  it('scopes to a branch', () => {
    const lakeside = computeLossAnalysis(dataset, {}, { kind: 'branch', branchId: 'B3' });
    expect(lakeside.lostCount).toBe(79 - 6 - 4 - lakesideOpenNonStalled());
    expect(lakeside.lostCount).toBeGreaterThan(0);
  });

  function lakesideOpenNonStalled(): number {
    const leads = dataset.indexes.leadsByBranch.get('B3') ?? [];
    return leads.filter(
      (lead) =>
        lead.status !== 'delivered' && lead.status !== 'lost' && lead.status !== 'order_placed',
    ).length;
  }

  it('returns an empty analysis for a rep with no leads', () => {
    const manager = dataset.reps.find((rep) => rep.role === 'branch_manager');
    expect(manager).toBeDefined();
    if (!manager) return;
    const empty = computeLossAnalysis(dataset, {}, { kind: 'rep', repId: manager.id });
    expect(empty.lostCount).toBe(0);
    expect(empty.byStage).toHaveLength(0);
    expect(empty.byReason).toHaveLength(0);
  });
});
