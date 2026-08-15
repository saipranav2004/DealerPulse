import { describe, expect, it } from 'vitest';

import { computeFunnel, largestDropOff } from '@/lib/analytics/funnel';
import { getDataset } from '@/lib/data';

const dataset = getDataset();

/** Percentage rendered to a fixed number of decimals, for VERIFY.md comparison. */
function asPercent(value: number | null, decimals = 0): string {
  if (value === null) return 'insufficient_data';
  return `${(value * 100).toFixed(decimals)}%`;
}

describe('computeFunnel — company scope', () => {
  const funnel = computeFunnel(dataset);

  it('counts every lead as having reached "new"', () => {
    expect(funnel.totalLeads).toBe(510);
    expect(funnel.stages.find((s) => s.stage === 'new')?.reached).toBe(510);
  });

  it('counts leads that ever reached each stage, from status_history', () => {
    const reached = (stage: string) => funnel.stages.find((s) => s.stage === stage)?.reached;
    // 80 + 86 + 46 + 80 + 99 across the five branches.
    expect(reached('contacted')).toBe(391);
    expect(reached('test_drive')).toBe(300);
    expect(reached('negotiation')).toBe(235);
    expect(reached('order_placed')).toBe(198);
    expect(reached('delivered')).toBe(160);
  });

  it('reports drop-off per step', () => {
    const step = funnel.steps.find((s) => s.from === 'new' && s.to === 'contacted');
    expect(step?.fromCount).toBe(510);
    expect(step?.toCount).toBe(391);
    expect(step?.dropOff).toBe(119);
  });

  it('identifies the largest absolute drop-off', () => {
    const worst = largestDropOff(funnel);
    expect(worst?.from).toBe('new');
    expect(worst?.to).toBe('contacted');
    expect(worst?.dropOff).toBe(119);
  });
});

describe('computeFunnel — per branch (VERIFY.md table)', () => {
  const expectations = [
    { id: 'B1', leads: 97, contacted: 80, test_drive: 69, negotiation: 53, order_placed: 46, delivered: 40 },
    { id: 'B2', leads: 109, contacted: 86, test_drive: 64, negotiation: 54, order_placed: 43, delivered: 36 },
    { id: 'B3', leads: 79, contacted: 46, test_drive: 27, negotiation: 14, order_placed: 10, delivered: 6 },
    { id: 'B4', leads: 98, contacted: 80, test_drive: 64, negotiation: 48, order_placed: 40, delivered: 31 },
    { id: 'B5', leads: 127, contacted: 99, test_drive: 76, negotiation: 66, order_placed: 59, delivered: 47 },
  ] as const;

  for (const expected of expectations) {
    it(`${expected.id} reaches the documented stage counts`, () => {
      const funnel = computeFunnel(dataset, {}, { kind: 'branch', branchId: expected.id });
      const reached = (stage: string) => funnel.stages.find((s) => s.stage === stage)?.reached;

      expect(funnel.totalLeads).toBe(expected.leads);
      expect(reached('contacted')).toBe(expected.contacted);
      expect(reached('test_drive')).toBe(expected.test_drive);
      expect(reached('negotiation')).toBe(expected.negotiation);
      expect(reached('order_placed')).toBe(expected.order_placed);
      expect(reached('delivered')).toBe(expected.delivered);
    });
  }
});

describe('computeFunnel — step conversion, Lakeside vs the other four', () => {
  const lakeside = computeFunnel(dataset, {}, { kind: 'branch', branchId: 'B3' });
  const others = computeFunnel(dataset, { branchIds: ['B1', 'B2', 'B4', 'B5'] });

  const expectations = [
    { step: 'new->contacted', b3: '58%', rest: '80%' },
    { step: 'contacted->test_drive', b3: '59%', rest: '79%' },
    { step: 'test_drive->negotiation', b3: '52%', rest: '81%' },
    { step: 'negotiation->order_placed', b3: '71%', rest: '85%' },
    { step: 'order_placed->delivered', b3: '60%', rest: '82%' },
  ] as const;

  expectations.forEach((expected, index) => {
    it(`${expected.step} converts at ${expected.b3} in B3 and ${expected.rest} elsewhere`, () => {
      expect(asPercent(lakeside.steps[index].conversion.value)).toBe(expected.b3);
      expect(asPercent(others.steps[index].conversion.value)).toBe(expected.rest);
    });
  });

  it('keeps B3 order_placed->delivered publishable at exactly n=10', () => {
    const step = lakeside.steps[4];
    expect(step.fromCount).toBe(10);
    expect(step.conversion.reason).toBeNull();
    expect(step.conversion.value).toBeCloseTo(0.6, 10);
  });
});

describe('computeFunnel — rep scope', () => {
  it('computes a funnel for a single rep', () => {
    const rep = dataset.reps.find((r) => r.name === 'Venkat Mishra');
    expect(rep).toBeDefined();
    if (!rep) return;

    const funnel = computeFunnel(dataset, {}, { kind: 'rep', repId: rep.id });
    expect(funnel.totalLeads).toBe(22);
    expect(funnel.stages.find((s) => s.stage === 'delivered')?.reached).toBe(1);
  });

  it('returns an empty funnel for a rep holding no leads', () => {
    const manager = dataset.reps.find((r) => r.role === 'branch_manager');
    expect(manager).toBeDefined();
    if (!manager) return;

    const funnel = computeFunnel(dataset, {}, { kind: 'rep', repId: manager.id });
    expect(funnel.totalLeads).toBe(0);
    for (const stage of funnel.stages) {
      expect(stage.reached).toBe(0);
      expect(stage.shareOfLeads.value).toBeNull();
      expect(stage.shareOfLeads.reason).toBe('insufficient_data');
    }
  });
});
