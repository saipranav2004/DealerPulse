import { describe, expect, it } from 'vitest';

import {
  computeReps,
  groupMedianHoursToFirstContact,
  leadLoadRange,
  rankRepsByWinRate,
} from '@/lib/analytics/reps';
import { getDataset } from '@/lib/data';

const dataset = getDataset();
const result = computeReps(dataset);

function asPercent(value: number | null, decimals = 1): string {
  if (value === null) return 'insufficient_data';
  return `${(value * 100).toFixed(decimals)}%`;
}

describe('computeReps — roster coverage', () => {
  it('reports every rep on the roster, active or not', () => {
    expect(result.reps).toHaveLength(30);
    expect(result.active).toHaveLength(25);
    expect(result.inactive).toHaveLength(5);
  });

  it('accounts for all 510 leads', () => {
    const total = result.reps.reduce((sum, rep) => sum + rep.leadsHandled, 0);
    expect(total).toBe(510);
  });
});

describe('computeReps — the five zero-lead branch managers', () => {
  it('identifies exactly the branch managers as the zero-lead reps', () => {
    expect(result.inactive).toHaveLength(5);
    for (const rep of result.inactive) {
      expect(rep.role).toBe('branch_manager');
      expect(rep.leadsHandled).toBe(0);
      expect(rep.hasNoLeads).toBe(true);
    }
    // One manager per branch.
    expect(new Set(result.inactive.map((rep) => rep.branchId)).size).toBe(5);
  });

  it('suppresses their win rate rather than reporting 0%', () => {
    for (const rep of result.inactive) {
      expect(rep.winRate.value).toBeNull();
      expect(rep.winRate.reason).toBe('insufficient_data');
      expect(rep.winRate.n).toBe(0);
    }
  });

  it('reports zeroed totals without dividing by zero', () => {
    for (const rep of result.inactive) {
      expect(rep.deliveredUnits).toBe(0);
      expect(rep.deliveredRevenue).toBe(0);
      expect(rep.openCount).toBe(0);
      expect(rep.stalledCount).toBe(0);
      expect(rep.medianHoursToFirstContact).toBeNull();
      expect(Number.isNaN(rep.deliveredRevenue)).toBe(false);
    }
  });

  it('keeps them out of both league tables', () => {
    const worst = rankRepsByWinRate(result, 'worst', 30);
    const best = rankRepsByWinRate(result, 'best', 30);
    for (const rep of result.inactive) {
      expect(worst.some((r) => r.repId === rep.repId)).toBe(false);
      expect(best.some((r) => r.repId === rep.repId)).toBe(false);
    }
  });
});

describe('rankRepsByWinRate — VERIFY.md extremes', () => {
  it('lists the five worst, all from Lakeside', () => {
    const worst = rankRepsByWinRate(result, 'worst', 5);
    const rendered = worst.map(
      (rep) => `${rep.name} ${asPercent(rep.winRate.value)} (n=${rep.leadsHandled})`,
    );
    expect(rendered).toEqual([
      'Venkat Mishra 4.5% (n=22)',
      'Revathi Pandey 7.1% (n=14)',
      'Kavitha Joshi 7.7% (n=13)',
      'Vikram Patel 8.3% (n=12)',
      'Sanjay Rao 11.1% (n=18)',
    ]);
    expect(worst.every((rep) => rep.branchId === 'B3')).toBe(true);
  });

  it('lists the five best', () => {
    const best = rankRepsByWinRate(result, 'best', 5);
    const rendered = best.map(
      (rep) => `${rep.name} ${asPercent(rep.winRate.value)} (n=${rep.leadsHandled})`,
    );
    expect(rendered).toEqual([
      'Priya Choudhury 57.1% (n=14)',
      'Suresh Nair 50.0% (n=22)',
      'Sanjay Kulkarni 48.0% (n=25)',
      'Prakash Gupta 42.9% (n=28)',
      'Ananya Pandey 42.1% (n=19)',
    ]);
  });
});

describe('leadLoadRange', () => {
  it('spans 11 to 33 leads per active rep', () => {
    expect(leadLoadRange(result)).toEqual({ min: 11, max: 33 });
  });
});

describe('computeReps — median hours to first contact', () => {
  it('reports a whole-hour median for reps who contacted leads', () => {
    for (const rep of result.active) {
      expect(rep.contactedLeads).toBeGreaterThan(0);
      expect(rep.medianHoursToFirstContact).not.toBeNull();
      expect(Number.isInteger(rep.medianHoursToFirstContact ?? 0.5)).toBe(true);
      expect(rep.medianHoursToFirstContact ?? -1).toBeGreaterThanOrEqual(0);
    }
  });

  it('counts only leads that were actually contacted in the denominator', () => {
    for (const rep of result.active) {
      expect(rep.contactedLeads).toBeLessThanOrEqual(rep.leadsHandled);
    }
  });
});

describe('computeReps — guarded contact rates', () => {
  it('reports contacted and never-contacted as guarded rates', () => {
    const venkat = result.reps.find((rep) => rep.name === 'Venkat Mishra');
    expect(venkat).toBeDefined();
    if (!venkat) return;
    expect(venkat.leadsHandled).toBe(22);
    expect(venkat.contactedLeads).toBe(10);
    expect(venkat.neverContactedCount).toBe(12);
    expect(((venkat.contactedRate.value ?? 0) * 100).toFixed(1)).toBe('45.5');
    expect(((venkat.neverContactedRate.value ?? 0) * 100).toFixed(1)).toBe('54.5');
  });

  it('keeps contacted and never-contacted complementary', () => {
    for (const rep of result.active) {
      expect(rep.contactedLeads + rep.neverContactedCount).toBe(rep.leadsHandled);
    }
  });

  it('suppresses both rates for a zero-lead rep', () => {
    for (const rep of result.inactive) {
      expect(rep.contactedRate.value).toBeNull();
      expect(rep.neverContactedRate.value).toBeNull();
      expect(rep.neverContactedCount).toBe(0);
    }
  });

  it('suppresses both rates under a filter that leaves too few leads', () => {
    const narrow = computeReps(dataset, { branchIds: ['B3'], models: ['Camry'] });
    const withFew = narrow.active.filter((rep) => rep.leadsHandled > 0 && rep.leadsHandled < 10);
    expect(withFew.length).toBeGreaterThan(0);
    for (const rep of withFew) {
      expect(rep.contactedRate.value).toBeNull();
      expect(rep.winRate.value).toBeNull();
    }
  });
});

describe('groupMedianHoursToFirstContact', () => {
  it('is 46 hours across the 391 leads that were ever contacted', () => {
    expect(groupMedianHoursToFirstContact(dataset)).toBe(46);
  });

  /**
   * Guards a real mistake: the whole-day dwell median for new → contacted is
   * 1 day, which reads as "within 24 hours". The true median is 46 hours, so
   * some reps who look slow against 24h are in fact at or under the benchmark.
   */
  it('is not the same as the whole-day dwell median', () => {
    const hours = groupMedianHoursToFirstContact(dataset);
    expect(hours).not.toBeNull();
    expect(hours).toBeGreaterThan(24);
    expect(Math.floor((hours ?? 0) / 24)).toBe(1);
  });

  it('does not mark the fastest Lakeside rep as slow', () => {
    const groupHours = groupMedianHoursToFirstContact(dataset) ?? 0;
    const vikram = result.reps.find((rep) => rep.name === 'Vikram Patel');
    expect(vikram?.medianHoursToFirstContact).toBe(42);
    expect(vikram?.medianHoursToFirstContact ?? 0).toBeLessThan(groupHours);
  });

  it('returns null when nobody in scope was contacted', () => {
    const manager = dataset.reps.find((rep) => rep.role === 'branch_manager');
    expect(manager).toBeDefined();
    if (!manager) return;
    expect(groupMedianHoursToFirstContact(dataset, {}, { kind: 'rep', repId: manager.id })).toBeNull();
  });
});

describe('computeReps — open and stalled counts', () => {
  it('sums stalled orders to the documented company total', () => {
    const stalled = result.reps.reduce((sum, rep) => sum + rep.stalledCount, 0);
    expect(stalled).toBe(38);
  });

  it('sums open leads to the documented company total', () => {
    const open = result.reps.reduce((sum, rep) => sum + rep.openCount, 0);
    expect(open).toBe(62);
  });
});
