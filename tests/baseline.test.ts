/**
 * The frozen numerical baseline.
 *
 * Every figure here is recomputed **from the raw JSON**, deliberately without
 * going through `lib/analytics`, and then compared against what the analytics
 * layer produces. A bug that changes both in the same direction is the one
 * thing a self-consistent test suite cannot catch, so the two sides of each
 * assertion are computed by different code.
 *
 * This file is the gate. Any change that fails it gets reverted, not debated.
 */

import { describe, expect, it } from 'vitest';
import raw from '@/data/dealership_data.json';
import { MIN_RATE_DENOMINATOR, MIN_VERDICT_DENOMINATOR, NOW, getDataset } from '@/lib/data';
import { computeKpiSet } from '@/lib/analytics/kpis';
import { computeFunnel } from '@/lib/analytics/funnel';
import { computeBranches } from '@/lib/analytics/branches';
import { computeActionCenter } from '@/lib/analytics/actionCenter';
import { computeLossAnalysis } from '@/lib/analytics/lossAnalysis';
import { computeModels } from '@/lib/analytics/models';
import { computeSources } from '@/lib/analytics/sources';
import { computeDeliveryActivity } from '@/lib/analytics/cohorts';
import { computeReps } from '@/lib/analytics/reps';
import { computeVerdictOutcome } from '@/lib/analytics/verdict';
import { computeMomentum } from '@/lib/analytics/momentum';
import { computeTargets } from '@/lib/analytics/targets';
import { computeWhatIf } from '@/lib/analytics/whatIf';
import type { Filters } from '@/lib/types';
import { median } from '@/lib/stats';

/* -- raw-side helpers, independent of lib/analytics -------------------------- */

type RawLead = {
  id: string;
  customer_name: string;
  branch_id: string;
  assigned_to: string;
  model_interested: string;
  source: string;
  status: string;
  deal_value: number;
  created_at: string;
  last_activity_at: string;
  expected_close_date: string;
  status_history: { status: string; timestamp: string }[];
};

const leads = (raw as unknown as { leads: RawLead[] }).leads;
const deliveries = (raw as unknown as { deliveries: { lead_id: string; delivery_date: string }[] })
  .deliveries;

const deliveredIds = new Set(deliveries.map((d) => d.lead_id));
const reached = (lead: RawLead, stage: string) =>
  lead.status === stage || lead.status_history.some((entry) => entry.status === stage);

const FUNNEL = ['new', 'contacted', 'test_drive', 'negotiation', 'order_placed', 'delivered'];

/** Furthest funnel stage a lead ever reached, ignoring the terminal `lost`. */
function furthestStage(lead: RawLead): string {
  let best = 0;
  for (const entry of [...lead.status_history.map((e) => e.status), lead.status]) {
    const index = FUNNEL.indexOf(entry);
    if (index > best) best = index;
  }
  return FUNNEL[best];
}

const dataset = getDataset();

/* -- the anchors ------------------------------------------------------------- */

describe('§0 frozen baseline', () => {
  it('pins "now" to the dataset, never the wall clock', () => {
    const maxActivity = leads.reduce(
      (max, lead) => Math.max(max, Date.parse(lead.last_activity_at)),
      0,
    );
    expect(NOW.toISOString()).toBe('2025-12-31T19:10:00.000Z');
    expect(NOW.getTime()).toBe(maxActivity);
  });

  it('loads 510 leads', () => {
    expect(leads.length).toBe(510);
    expect(dataset.leads.length).toBe(510);
  });

  it('delivers 160 units worth ₹38,87,60,000', () => {
    const delivered = leads.filter((lead) => lead.status === 'delivered');
    const revenue = delivered.reduce((sum, lead) => sum + lead.deal_value, 0);
    expect(delivered.length).toBe(160);
    expect(revenue).toBe(388_760_000);

    const kpis = computeKpiSet(dataset);
    expect(kpis.deliveredUnits).toBe(160);
    expect(kpis.deliveredRevenue).toBe(388_760_000);
  });

  it('wins 31.4% of leads (160/510)', () => {
    const kpis = computeKpiSet(dataset);
    expect(kpis.winRate.value).not.toBeNull();
    expect((kpis.winRate.value as number * 100).toFixed(1)).toBe('31.4');
    expect(kpis.winRate.value).toBeCloseTo(160 / 510, 12);
  });

  it('holds 62 open leads worth ₹15.15 Cr', () => {
    const open = leads.filter((lead) => lead.status !== 'delivered' && lead.status !== 'lost');
    const value = open.reduce((sum, lead) => sum + lead.deal_value, 0);
    expect(open.length).toBe(62);
    expect((value / 10_000_000).toFixed(2)).toBe('15.15');

    const kpis = computeKpiSet(dataset);
    expect(kpis.openPipelineCount).toBe(62);
    expect(kpis.openPipelineValue).toBe(value);
  });

  it('has 38 stalled orders worth ₹8.59 Cr, oldest L0022 at 195 days', () => {
    const stalled = leads.filter(
      (lead) => lead.status === 'order_placed' && !deliveredIds.has(lead.id),
    );
    const value = stalled.reduce((sum, lead) => sum + lead.deal_value, 0);
    expect(stalled.length).toBe(38);
    expect((value / 10_000_000).toFixed(2)).toBe('8.59');

    const queue = computeActionCenter(dataset).stalled;
    expect(queue.count).toBe(38);
    expect(queue.value).toBe(value);
    expect(queue.items[0].leadId).toBe('L0022');
    expect(queue.items[0].customerName).toBe('Omkar Varma');
    expect(queue.items[0].dealValue).toBe(5_050_000);
    expect(queue.oldestAgeDays).toBe(195);
  });

  it('never contacted 119 (23.3%): 114 already closed, 5 still open', () => {
    const never = leads.filter((lead) => !reached(lead, 'contacted'));
    const stillOpen = never.filter(
      (lead) => lead.status !== 'delivered' && lead.status !== 'lost',
    );
    expect(never.length).toBe(119);
    expect(stillOpen.length).toBe(5);
    expect(never.length - stillOpen.length).toBe(114);

    const kpis = computeKpiSet(dataset);
    expect(kpis.neverContactedCount).toBe(119);
    expect(kpis.neverContactedStillOpen).toBe(5);
    expect(kpis.neverContactedClosed).toBe(114);
    expect(((kpis.neverContactedRate.value as number) * 100).toFixed(1)).toBe('23.3');
  });

  it('loses 288 leads: 114 new · 81 contacted · 59 test_drive · 34 negotiation', () => {
    const lost = leads.filter((lead) => lead.status === 'lost');
    const byStage = new Map<string, number>();
    for (const lead of lost) {
      const stage = furthestStage(lead);
      byStage.set(stage, (byStage.get(stage) ?? 0) + 1);
    }
    expect(lost.length).toBe(288);
    expect(byStage.get('new')).toBe(114);
    expect(byStage.get('contacted')).toBe(81);
    expect(byStage.get('test_drive')).toBe(59);
    expect(byStage.get('negotiation')).toBe(34);

    const loss = computeLossAnalysis(dataset);
    expect(loss.lostCount).toBe(288);
    const counts = Object.fromEntries(loss.byStage.map((row) => [row.stage, row.count]));
    expect(counts.new).toBe(114);
    expect(counts.contacted).toBe(81);
    expect(counts.test_drive).toBe(59);
    expect(counts.negotiation).toBe(34);
  });

  it('has 31 open leads past their own expected close date, worth ₹6.89 Cr', () => {
    // Inclusive of 31 Dec: the comparison is strictly "close date is before now".
    const overdue = leads.filter(
      (lead) =>
        lead.status !== 'delivered' &&
        lead.status !== 'lost' &&
        Date.parse(lead.expected_close_date) < NOW.getTime(),
    );
    const value = overdue.reduce((sum, lead) => sum + lead.deal_value, 0);
    expect(overdue.length).toBe(31);
    expect((value / 10_000_000).toFixed(2)).toBe('6.89');
  });

  it('reconstructs 14 terminal statuses missing from history, all lost', () => {
    const missing = leads.filter(
      (lead) => !lead.status_history.some((entry) => entry.status === lead.status),
    );
    expect(missing.length).toBe(14);
    expect(missing.every((lead) => lead.status === 'lost')).toBe(true);
    expect(dataset.reconciliation.reconciledCount).toBe(14);
  });

  it('group funnel steps read 76.7 / 76.7 / 78.3 / 84.3 / 80.8', () => {
    const funnel = computeFunnel(dataset);
    const rates = funnel.steps.map((step) =>
      ((step.toCount / step.fromCount) * 100).toFixed(1),
    );
    expect(rates).toEqual(['76.7', '76.7', '78.3', '84.3', '80.8']);
  });

  it('Lakeside contacts 58.2% and converts 7.6% (6 of 79)', () => {
    const b3 = leads.filter((lead) => lead.branch_id === 'B3');
    const contacted = b3.filter((lead) => reached(lead, 'contacted'));
    const delivered = b3.filter((lead) => lead.status === 'delivered');
    expect(b3.length).toBe(79);
    expect(delivered.length).toBe(6);
    expect(((contacted.length / b3.length) * 100).toFixed(1)).toBe('58.2');
    expect(((delivered.length / b3.length) * 100).toFixed(1)).toBe('7.6');

    const row = computeBranches(dataset).branches.find((entry) => entry.branchId === 'B3');
    expect(row?.leads).toBe(79);
    expect(((row?.winRate.value as number) * 100).toFixed(1)).toBe('7.6');
    expect(((row?.firstContactRate.value as number) * 100).toFixed(1)).toBe('58.2');
  });

  it('company median rep win rate is 33.3% across 25 rated reps', () => {
    const reps = computeReps(dataset).active;
    const rates = reps
      .map((rep) => rep.winRate.value)
      .filter((value): value is number => value !== null);
    expect(rates.length).toBe(25);
    expect(((median(rates) as number) * 100).toFixed(1)).toBe('33.3');
  });

  it('delivers by calendar month: Jul 3.25 · Aug 4.65 · Sep 6.17 · Oct 4.68 · Nov 7.91 · Dec 12.22', () => {
    const byLead = new Map(leads.map((lead) => [lead.id, lead]));
    const byMonth = new Map<string, number>();
    for (const delivery of deliveries) {
      const month = delivery.delivery_date.slice(0, 7);
      const value = byLead.get(delivery.lead_id)?.deal_value ?? 0;
      byMonth.set(month, (byMonth.get(month) ?? 0) + value);
    }
    const asCr = (month: string) => ((byMonth.get(month) ?? 0) / 10_000_000).toFixed(2);
    expect(asCr('2025-07')).toBe('3.25');
    expect(asCr('2025-08')).toBe('4.65');
    expect(asCr('2025-09')).toBe('6.17');
    expect(asCr('2025-10')).toBe('4.68');
    expect(asCr('2025-11')).toBe('7.91');
    expect(asCr('2025-12')).toBe('12.22');

    const activity = computeDeliveryActivity(dataset);
    const fromLayer = Object.fromEntries(activity.map((point) => [point.month, point.revenue]));
    expect((fromLayer['2025-12'] / 10_000_000).toFixed(2)).toBe('12.22');
    expect((fromLayer['2025-10'] / 10_000_000).toFixed(2)).toBe('4.68');
  });

  it('Fortuner leads revenue at ₹12.61 Cr / 30 sold / 94 leads', () => {
    const fortuner = leads.filter((lead) => lead.model_interested === 'Fortuner');
    const sold = fortuner.filter((lead) => lead.status === 'delivered');
    const revenue = sold.reduce((sum, lead) => sum + lead.deal_value, 0);
    expect(fortuner.length).toBe(94);
    expect(sold.length).toBe(30);
    expect((revenue / 10_000_000).toFixed(2)).toBe('12.61');

    const top = computeModels(dataset).topByRevenue;
    expect(top?.model).toBe('Fortuner');
    expect(top?.deliveredRevenue).toBe(revenue);
  });

  it('walk-in converts best at 45.7% and social media worst at 13.9%', () => {
    const rate = (source: string) => {
      const rows = leads.filter((lead) => lead.source === source);
      const won = rows.filter((lead) => lead.status === 'delivered');
      return ((won.length / rows.length) * 100).toFixed(1);
    };
    expect(rate('walk_in')).toBe('45.7');
    expect(rate('social_media')).toBe('13.9');

    const sources = computeSources(dataset).sources;
    const bySource = Object.fromEntries(sources.map((row) => [row.source, row.winRate.value]));
    expect(((bySource.walk_in as number) * 100).toFixed(1)).toBe('45.7');
    expect(((bySource.social_media as number) * 100).toFixed(1)).toBe('13.9');
  });

  it('totals ₹123.68 Cr of deal value across all 510 leads', () => {
    const total = leads.reduce((sum, lead) => sum + lead.deal_value, 0);
    expect((total / 10_000_000).toFixed(2)).toBe('123.68');
  });
});

/* -- P1.1: the two bases the period filter can mean -------------------------- */

describe('period basis', () => {
  const q4 = { from: new Date('2025-10-01T00:00:00.000Z'), to: new Date('2025-12-31T23:59:59.999Z') };

  it('calendar Q4 reports the ₹24.81 Cr that actually arrived', () => {
    const kpis = computeKpiSet(dataset, { activityRange: q4 });
    expect((kpis.deliveredRevenue / 10_000_000).toFixed(2)).toBe('24.81');
    expect(kpis.deliveredUnits).toBe(102);

    // Cross-check against the deliveries table, which the KPI path never reads.
    const byLead = new Map(leads.map((lead) => [lead.id, lead]));
    const inQ4 = deliveries.filter(
      (d) => d.delivery_date >= '2025-10-01' && d.delivery_date <= '2025-12-31',
    );
    const raw = inQ4.reduce((sum, d) => sum + (byLead.get(d.lead_id)?.deal_value ?? 0), 0);
    expect(kpis.deliveredRevenue).toBe(raw);
  });

  it('cohort Q4 reports the ₹17.55 Cr those leads eventually produced', () => {
    const kpis = computeKpiSet(dataset, { dateRange: q4 });
    expect((kpis.deliveredRevenue / 10_000_000).toFixed(2)).toBe('17.55');
  });

  it('keeps the two bases in separate memo entries', () => {
    // A shared cache key here would serve one basis's leads under the other.
    const calendar = computeKpiSet(dataset, { activityRange: q4 }).deliveredRevenue;
    const cohort = computeKpiSet(dataset, { dateRange: q4 }).deliveredRevenue;
    expect(calendar).not.toBe(cohort);
  });

  it('leaves the unfiltered figures untouched on either basis', () => {
    // With no window the basis selects nothing, so both must equal the anchor.
    expect(computeKpiSet(dataset, {}).deliveredRevenue).toBe(388_760_000);
  });
});

/* -- P1.2–P1.6: correctness of meaning --------------------------------------- */

describe('correctness of meaning', () => {
  const q4 = { from: new Date('2025-10-01T00:00:00.000Z'), to: new Date('2025-12-31T23:59:59.999Z') };
  const june = { from: new Date('2025-06-01T00:00:00.000Z'), to: new Date('2025-06-30T23:59:59.999Z') };

  it('P1.2 keeps the oldest stalled order visible under any period', () => {
    // Queues take entity axes only; a period filter must not hide L0022.
    for (const range of [{ activityRange: q4 }, { dateRange: q4 }, { dateRange: june }]) {
      const withPeriod = computeActionCenter(dataset, range).stalled;
      // The queue the page renders is built without the period axis at all.
      const asRendered = computeActionCenter(dataset, {}).stalled;
      expect(asRendered.oldestAgeDays).toBe(195);
      expect(asRendered.count).toBe(38);
      // And the period-filtered variant is genuinely different, which is why
      // the page must not use it.
      expect(withPeriod.count).toBeLessThanOrEqual(asRendered.count);
    }
  });

  it('P1.3 orders every value range low-to-high and names each end', () => {
    const cases: Filters[] = [
      {},
      { activityRange: q4 },
      { dateRange: q4 },
      { dateRange: june },
      { branchIds: ['B3'] },
      { models: ['Fortuner'] },
      { sources: ['walk_in'] },
    ];
    for (const filters of cases) {
      const { verdict } = computeVerdictOutcome(dataset, filters);
      if (!verdict) continue;
      expect(verdict.recoverable.low).toBeLessThanOrEqual(verdict.recoverable.high);
      expect(verdict.firstContact.low).toBeLessThanOrEqual(verdict.firstContact.high);
      expect(verdict.recoverable.lowBasis).not.toBe(verdict.recoverable.highBasis);
    }
  });

  it('P1.4 includes the latest month in the pace and refuses a median below three', () => {
    const full = computeMomentum(dataset, {}, { kind: 'company' }, 10, {
      from: new Date('2025-06-01T00:00:00.000Z'),
      to: new Date('2025-12-31T23:59:59.999Z'),
    });
    // Oct 20 · Nov 30 · Dec 52 — the latest month is in the window.
    expect(full.paceMonths).toBe(3);
    expect(full.paceDeliveries).toBe(30);

    const oneMonth = computeMomentum(dataset, {}, { kind: 'company' }, 10, {
      from: new Date('2025-11-01T00:00:00.000Z'),
      to: new Date('2025-11-30T23:59:59.999Z'),
    });
    expect(oneMonth.paceMonths).toBeLessThan(3);
    expect(oneMonth.paceDeliveries).toBeNull();
    expect(oneMonth.monthsOfPipeline).toBeNull();
  });

  it('P1.5 compares the window own months and counts intake by created_at', () => {
    const juneView = computeMomentum(dataset, {}, { kind: 'company' }, null, june);
    expect(juneView.currentMonth).toBe('2025-06');
    // June is the first month in the dataset, so there is nothing before it.
    expect(juneView.previousMonth).toBeNull();

    const intake = juneView.movements.find((m) => m.label === 'New leads taken');
    const createdInJune = leads.filter((lead) => lead.created_at.slice(0, 7) === '2025-06');
    expect(intake?.current).toBe(createdInJune.length);
    expect(intake?.current).toBe(55);

    const q4View = computeMomentum(dataset, {}, { kind: 'company' }, null, q4);
    expect(q4View.currentMonth).toBe('2025-12');
    expect(q4View.previousMonth).toBe('2025-11');
  });

  it('P1.6 narrows targets to the window on either basis, and keeps the two ratios apart', () => {
    for (const range of [{ dateRange: june }, { activityRange: june }]) {
      const targets = computeTargets(dataset, range);
      // Five branches x one month, not the full seven-month plan.
      expect(targets.group.targetUnits).toBe(189);
      expect(targets.group.targetUnits).toBeLessThan(1426);
    }

    const full = computeTargets(dataset, {});
    expect(full.group.targetUnits).toBe(1426);
    // The two attainments are genuinely different numbers and must stay apart.
    expect(full.group.unitAttainment).not.toBe(full.group.revenueAttainment);
    expect(full.group.unitAttainment).toBeCloseTo(160 / 1426, 12);
  });
});

/* -- P1.7: what the product is allowed to assert ----------------------------- */

describe('assertion discipline', () => {
  const june = { from: new Date('2025-06-01T00:00:00.000Z'), to: new Date('2025-06-30T23:59:59.999Z') };

  it('still names Lakeside on the full dataset', () => {
    const { verdict, abstention } = computeVerdictOutcome(dataset, {});
    expect(abstention).toBeNull();
    expect(verdict?.branchId).toBe('B3');
  });

  it('refuses to name a branch when any branch is below the verdict floor', () => {
    // The reported case: June names Downtown at 27.3% while Highway sold 0 of 8
    // and escaped the headline by being too small to rate.
    for (const filters of [{ dateRange: june }, { activityRange: june }]) {
      const { verdict, abstention } = computeVerdictOutcome(dataset, filters);
      expect(verdict).toBeNull();
      expect(abstention?.reason).toBe('insufficient-sample');
      expect(abstention?.belowFloor).toBeGreaterThan(0);
    }
  });

  it('keeps the verdict floor strictly above the rate floor', () => {
    expect(MIN_VERDICT_DENOMINATOR).toBeGreaterThan(MIN_RATE_DENOMINATOR);
  });

  it('never names a branch that is not actually the worst rated one', () => {
    const filters: Filters[] = [
      {},
      { activityRange: { from: new Date('2025-10-01T00:00:00.000Z'), to: new Date('2025-12-31T23:59:59.999Z') } },
      { models: ['Fortuner'] },
      { sources: ['walk_in'] },
    ];
    for (const f of filters) {
      const { verdict } = computeVerdictOutcome(dataset, f);
      if (!verdict) continue;
      const rows = computeBranches(dataset, f).branches;
      // Every branch must have been rateable for the verdict to have been made.
      expect(rows.every((row) => row.leads >= MIN_VERDICT_DENOMINATOR)).toBe(true);
      const lowest = Math.min(
        ...rows.map((row) => row.winRate.value ?? Number.POSITIVE_INFINITY),
      );
      expect(verdict.branchWinRate).toBeCloseTo(lowest, 12);
    }
  });
});

/* -- Angle 3: boundary behaviour, pinned so a change cannot pass silently ----- */

describe('window boundaries', () => {
  it('treats the overdue comparison as strictly-before, and both forms agree here', () => {
    const open = leads.filter((l) => l.status !== 'delivered' && l.status !== 'lost');
    const strict = open.filter((l) => Date.parse(l.expected_close_date) < NOW.getTime()).length;
    const inclusive = open.filter((l) => Date.parse(l.expected_close_date) <= NOW.getTime()).length;
    expect(strict).toBe(31);
    // No close date lands exactly on the pinned instant, so the choice is not
    // load-bearing today. If a future dataset changes that, this fails first.
    expect(inclusive).toBe(strict);
  });

  it('includes both ends of a period window', () => {
    const june = { from: new Date('2025-06-01T00:00:00.000Z'), to: new Date('2025-06-30T23:59:59.999Z') };
    const created = leads.filter((l) => l.created_at.slice(0, 7) === '2025-06').length;
    expect(computeKpiSet(dataset, { dateRange: june }).totalLeads).toBe(created);

    // The first and last instants of the window are inside it.
    const firstDay = leads.filter((l) => l.created_at.slice(0, 10) === '2025-06-01').length;
    const lastDay = leads.filter((l) => l.created_at.slice(0, 10) === '2025-06-30').length;
    expect(firstDay + lastDay).toBeGreaterThan(0);
    const narrow = {
      from: new Date('2025-06-01T00:00:00.000Z'),
      to: new Date('2025-06-01T23:59:59.999Z'),
    };
    expect(computeKpiSet(dataset, { dateRange: narrow }).totalLeads).toBe(firstDay);
  });

  it('narrows targets on the same month boundaries as leads', () => {
    const q4 = { from: new Date('2025-10-01T00:00:00.000Z'), to: new Date('2025-12-31T23:59:59.999Z') };
    // Five branches x three months.
    expect(computeTargets(dataset, { activityRange: q4 }).byMonth.length).toBe(3);
  });

  /*
   * The scenario tool puts a rupee figure for *today* on screen, so that figure
   * has to be the real sum of delivered deal values. Deriving it as deliveries
   * times the average enquiry is off by a third at Lakeside, whose few sales
   * are unusually cheap cars, and would have contradicted the branch page.
   */
  it('reports the branch\'s real delivered revenue, not count times average', () => {
    for (const branch of raw.branches) {
      const whatIf = computeWhatIf(dataset, branch.id, 0.5);
      if (!whatIf) continue;
      const expected = leads
        .filter((l) => l.branch_id === branch.id && l.status === 'delivered')
        .reduce((sum, l) => sum + l.deal_value, 0);
      expect(whatIf.deliveredRevenue).toBe(expected);
    }
    // And the two really do differ, so the assertion above is not vacuous.
    const lakeside = computeWhatIf(dataset, 'B3', 0.5);
    expect(lakeside).not.toBeNull();
    expect(lakeside!.deliveredRevenue).not.toBe(lakeside!.baseline.revenue);
  });

  it('reproduces today exactly when both levers sit at their current rates', () => {
    const whatIf = computeWhatIf(dataset, 'B3', 0);
    expect(whatIf).not.toBeNull();
    const w = whatIf!;
    // The two-lever model the component runs: leads x contact x close.
    const modelled = w.leads * w.baselineRate * w.branchDownstream;
    expect(modelled).toBeCloseTo(w.baseline.delivered, 6);

    const delivered = leads.filter((l) => l.branch_id === 'B3' && l.status === 'delivered').length;
    expect(Math.round(w.baseline.delivered)).toBe(delivered);
  });

  it('gives the whole-funnel figure when both levers move to peer rates', () => {
    const whatIf = computeWhatIf(dataset, 'B3', 0);
    expect(whatIf).not.toBeNull();
    const w = whatIf!;
    const atBoth = w.leads * w.peerRate * w.peerDownstream;
    // Which is the same result the single-lever peer path already reported, so
    // the new second slider cannot disagree with the existing headline.
    const viaExisting = computeWhatIf(dataset, 'B3', w.peerRate)!.atPeerRates.delivered;
    expect(atBoth).toBeCloseTo(viaExisting, 6);
    expect(atBoth - w.baseline.delivered).toBeGreaterThan(20);
  });

  /*
   * The sliders are whole per cents. At Lakeside 58% of 79 leads is 45.8, not
   * the real 46, and pricing that fifth of a car put a rupee figure on a panel
   * that says nothing has moved. The component snaps to the exact baseline; if
   * the drift ever grew past a car this would stop being cosmetic.
   */
  it('keeps whole-percent slider drift below one car', () => {
    for (const branch of raw.branches) {
      const w = computeWhatIf(dataset, branch.id, 0);
      if (!w) continue;
      const contactPct = Math.round(w.baselineRate * 100) / 100;
      const closePct = Math.round(w.branchDownstream * 100) / 100;
      const drift = Math.abs(w.leads * contactPct * closePct - w.baseline.delivered);
      expect(drift).toBeLessThan(1);
    }
  });
});
