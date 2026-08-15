import { describe, expect, it } from 'vitest';

import { computeVerdict } from '@/lib/analytics/verdict';
import { computeWhatIf } from '@/lib/analytics/whatIf';
import { getDataset } from '@/lib/data';
import { formatCurrency } from '@/lib/format';

const dataset = getDataset();

describe('computeVerdict', () => {
  const verdict = computeVerdict(dataset);

  it('identifies Lakeside as the branch furthest below the group', () => {
    expect(verdict).not.toBeNull();
    if (!verdict) return;
    expect(verdict.branchId).toBe('B3');
    expect(verdict.branchName).toBe('Lakeside Toyota');
    expect(verdict.city).toBe('Bangalore');
    expect(verdict.leads).toBe(79);
  });

  it('reports the branch and group win rates', () => {
    if (!verdict) return;
    expect((verdict.branchWinRate * 100).toFixed(1)).toBe('7.6');
    expect((verdict.groupWinRate * 100).toFixed(1)).toBe('31.4');
    expect((verdict.peerMin * 100).toFixed(1)).toBe('31.6');
    expect((verdict.peerMax * 100).toFixed(1)).toBe('41.2');
  });

  it('picks the break step by leads lost, not by percentage-point gap', () => {
    if (!verdict) return;
    // test_drive -> negotiation has the widest points gap (-29) but loses
    // fewer leads than the first step, which loses 17 more than peers would.
    const widestGap = [...verdict.steps].sort((a, b) => a.deltaPoints - b.deltaPoints)[0];
    expect(widestGap.from).toBe('test_drive');

    expect(verdict.breakStep.from).toBe('new');
    expect(verdict.breakStep.to).toBe('contacted');
    expect(verdict.breakStep.extraLost).toBeCloseTo(17.237, 2);
    expect(verdict.breakStep.leadsLost).toBe(33);
    expect(verdict.breakStep.fromCount).toBe(79);
    expect(verdict.breakStep.toCount).toBe(46);
  });

  it('has the break step as the largest extraLost of all five', () => {
    if (!verdict) return;
    for (const step of verdict.steps) {
      expect(verdict.breakStep.extraLost).toBeGreaterThanOrEqual(step.extraLost);
    }
    expect(verdict.steps).toHaveLength(5);
  });

  it('counts leads that were never contacted', () => {
    if (!verdict) return;
    expect(verdict.neverContacted).toBe(33);
    expect((verdict.neverContactedShare * 100).toFixed(1)).toBe('41.8');
  });

  it('values the recoverable gap at peer rates', () => {
    if (!verdict) return;
    expect(verdict.actualDeliveries).toBe(6);
    expect(verdict.deliveriesAtPeerRates).toBeCloseTo(28.227, 2);
    expect(verdict.recoverableDeliveries).toBeCloseTo(22.227, 2);
    expect(Math.round(verdict.recoverableValue)).toBe(55_185_797);
    expect(formatCurrency(verdict.recoverableValue)).toBe('₹5.52 Cr');
  });

  it('returns null when the filter leaves fewer than two comparable branches', () => {
    expect(computeVerdict(dataset, { branchIds: ['B3'] })).toBeNull();
  });
});

describe('computeWhatIf', () => {
  const result = computeWhatIf(dataset, 'B3', 0.8);

  it('models the branch at the target first-contact rate', () => {
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.leads).toBe(79);
    expect((result.baselineRate * 100).toFixed(1)).toBe('58.2');
    expect(result.scenarioRate).toBe(0.8);
    expect((result.peerRate * 100).toFixed(1)).toBe('80.0');
    expect(result.baseline.contacted).toBe(46);
    expect(result.baseline.delivered).toBe(6);
  });

  it('holds downstream conversion constant for the headline figure', () => {
    if (!result) return;
    expect(result.branchDownstream).toBeCloseTo(0.130435, 6);
    expect(result.held.contacted).toBeCloseTo(63.2, 6);
    expect(result.held.delivered).toBeCloseTo(8.2435, 3);
    expect(result.deltaContacted).toBeCloseTo(17.2, 6);
    expect(result.deltaDelivered).toBeCloseTo(2.2435, 3);
    expect(Math.round(result.deltaRevenue)).toBe(5_570_074);
  });

  it('reports the peer-downstream variant separately and much larger', () => {
    if (!result) return;
    expect(result.peerDownstream).toBeCloseTo(0.446377, 6);
    expect(result.deltaDeliveredAtPeerRates).toBeCloseTo(22.211, 2);
    expect(Math.round(result.deltaRevenueAtPeerRates)).toBe(55_145_169);
    expect(result.deltaRevenueAtPeerRates).toBeGreaterThan(result.deltaRevenue * 5);
  });

  it('returns the baseline unchanged when the scenario matches today', () => {
    const same = computeWhatIf(dataset, 'B3', 46 / 79);
    expect(same).not.toBeNull();
    if (!same) return;
    expect(same.deltaContacted).toBeCloseTo(0, 6);
    expect(same.held.delivered).toBeCloseTo(6, 4);
  });

  it('clamps the rate to [0, 1]', () => {
    const over = computeWhatIf(dataset, 'B3', 1.8);
    const under = computeWhatIf(dataset, 'B3', -0.5);
    expect(over?.scenarioRate).toBe(1);
    expect(under?.scenarioRate).toBe(0);
    expect(under?.held.delivered).toBe(0);
  });

  it('returns null for an unknown branch', () => {
    expect(computeWhatIf(dataset, 'B99', 0.8)).toBeNull();
  });
});

describe('never-contacted KPI', () => {
  it('counts leads with no contacted event group-wide', async () => {
    const { computeKpiSet } = await import('@/lib/analytics/kpis');
    const kpis = computeKpiSet(dataset);
    expect(kpis.neverContactedCount).toBe(119);
    expect(kpis.neverContactedRate.value).not.toBeNull();
    expect(((kpis.neverContactedRate.value ?? 0) * 100).toFixed(1)).toBe('23.3');
  });

  it('counts them for a single branch', async () => {
    const { computeKpiSet } = await import('@/lib/analytics/kpis');
    const kpis = computeKpiSet(dataset, {}, { kind: 'branch', branchId: 'B3' });
    expect(kpis.neverContactedCount).toBe(33);
  });
});
