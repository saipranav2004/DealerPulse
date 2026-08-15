import { describe, expect, it } from 'vitest';

import { computeKpis, computeKpiSet } from '@/lib/analytics/kpis';
import { getDataset } from '@/lib/data';
import { formatCurrency } from '@/lib/format';

const dataset = getDataset();

describe('computeKpiSet — company totals (VERIFY.md)', () => {
  const kpis = computeKpiSet(dataset);

  it('reports 160 delivered units', () => {
    expect(kpis.deliveredUnits).toBe(160);
  });

  it('reports delivered revenue of ₹38.88 Cr', () => {
    expect(kpis.deliveredRevenue).toBe(388_760_000);
    expect(formatCurrency(kpis.deliveredRevenue)).toBe('₹38.88 Cr');
  });

  it('reports a 31.4% win rate on all 510 leads', () => {
    expect(kpis.winRate.n).toBe(510);
    expect(kpis.winRate.value).not.toBeNull();
    expect(((kpis.winRate.value ?? 0) * 100).toFixed(1)).toBe('31.4');
  });

  it('reports 62 open leads worth ₹15.15 Cr', () => {
    expect(kpis.openPipelineCount).toBe(62);
    expect(kpis.openPipelineValue).toBe(151_540_000);
    expect(formatCurrency(kpis.openPipelineValue)).toBe('₹15.15 Cr');
  });

  it('reports lost value of ₹69.65 Cr across 288 lost leads', () => {
    expect(kpis.lostCount).toBe(288);
    expect(formatCurrency(kpis.lostValue)).toBe('₹69.65 Cr');
  });

  it('reports average deal value across all leads', () => {
    expect(kpis.averageDealValue).not.toBeNull();
    // ₹1,23,68,10,000 over 510 leads; delivered leads average slightly higher.
    expect(Math.round(kpis.averageDealValue ?? 0)).toBe(2_425_118);
    expect(Math.round(kpis.averageDeliveredDealValue ?? 0)).toBe(2_429_750);
  });

  it('accounts for every lead as delivered, lost or open', () => {
    expect(kpis.deliveredUnits + kpis.lostCount + kpis.openPipelineCount).toBe(510);
  });

  it('breaks open leads down by the stage they sit in', () => {
    expect(kpis.openByStage).toEqual([
      { stage: 'new', count: 5, value: expect.any(Number) },
      { stage: 'contacted', count: 10, value: expect.any(Number) },
      { stage: 'test_drive', count: 6, value: expect.any(Number) },
      { stage: 'negotiation', count: 3, value: expect.any(Number) },
      { stage: 'order_placed', count: 38, value: expect.any(Number) },
    ]);
    expect(kpis.openByStage.reduce((sum, s) => sum + s.count, 0)).toBe(62);
    expect(kpis.openByStage.reduce((sum, s) => sum + s.value, 0)).toBe(kpis.openPipelineValue);
  });

  it('excludes delivered from the open breakdown', () => {
    expect(kpis.openByStage.some((s) => s.stage === 'delivered')).toBe(false);
  });
});

describe('computeKpiSet — scoped', () => {
  it('scopes to a branch', () => {
    const kpis = computeKpiSet(dataset, {}, { kind: 'branch', branchId: 'B3' });
    expect(kpis.totalLeads).toBe(79);
    expect(kpis.deliveredUnits).toBe(6);
  });

  it('scopes to a rep', () => {
    const rep = dataset.reps.find((r) => r.name === 'Priya Choudhury');
    expect(rep).toBeDefined();
    if (!rep) return;
    const kpis = computeKpiSet(dataset, {}, { kind: 'rep', repId: rep.id });
    expect(kpis.totalLeads).toBe(14);
    expect(kpis.deliveredUnits).toBe(8);
  });

  it('suppresses the win rate for a zero-lead rep instead of reporting 0%', () => {
    const manager = dataset.reps.find((r) => r.role === 'branch_manager');
    expect(manager).toBeDefined();
    if (!manager) return;

    const kpis = computeKpiSet(dataset, {}, { kind: 'rep', repId: manager.id });
    expect(kpis.totalLeads).toBe(0);
    expect(kpis.winRate.value).toBeNull();
    expect(kpis.winRate.reason).toBe('insufficient_data');
    expect(kpis.averageDealValue).toBeNull();
  });
});

describe('computeKpis — period over period', () => {
  it('returns no deltas without a date range', () => {
    const result = computeKpis(dataset);
    expect(result.previous).toBeNull();
    expect(result.deltas).toBeNull();
  });

  it('compares a period against the preceding window of equal length', () => {
    const result = computeKpis(dataset, {
      dateRange: {
        from: new Date('2025-10-01T00:00:00Z'),
        to: new Date('2025-10-31T23:59:59.999Z'),
      },
    });

    // October created 90 leads. The comparison window matches October's
    // 31-day *length*, so it runs 31 Aug - 30 Sep: September's 70 leads plus
    // the 2 created on 31 August.
    expect(result.current.totalLeads).toBe(90);
    expect(result.previous?.totalLeads).toBe(72);
    expect(result.deltas?.totalLeads.absolute).toBe(18);
    expect(result.deltas?.totalLeads.relative).toBeCloseTo(18 / 72, 10);
  });

  it('expresses win-rate movement in fractional points', () => {
    const result = computeKpis(dataset, {
      dateRange: {
        from: new Date('2025-10-01T00:00:00Z'),
        to: new Date('2025-10-31T23:59:59.999Z'),
      },
    });
    const current = result.current.winRate.value ?? 0;
    const previous = result.previous?.winRate.value ?? 0;
    expect(result.deltas?.winRatePoints).toBeCloseTo(current - previous, 10);
  });
});
