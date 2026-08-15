/**
 * Verification gate.
 *
 * Prints every figure stated in VERIFY.md, computed from the analytics layer,
 * beside the expected value with a PASS/FAIL marker. Exits non-zero if any
 * check fails.
 *
 * This script never adjusts an expected value to match the code. A FAIL here
 * is a real disagreement to diagnose.
 *
 *   npm run verify
 */

import { getDataset, NOW } from '@/lib/data';
import { computeAging, computeStalledOrders } from '@/lib/analytics/aging';
import { computeBranches } from '@/lib/analytics/branches';
import { computeCohorts } from '@/lib/analytics/cohorts';
import { computeCycleTime } from '@/lib/analytics/cycleTime';
import { computeDeliveries } from '@/lib/analytics/deliveries';
import { computeFunnel } from '@/lib/analytics/funnel';
import { computeKpiSet } from '@/lib/analytics/kpis';
import { computeLossAnalysis } from '@/lib/analytics/lossAnalysis';
import { computeReps, leadLoadRange, rankRepsByWinRate } from '@/lib/analytics/reps';
import { computeSources } from '@/lib/analytics/sources';
import { computeTargets } from '@/lib/analytics/targets';
import {
  formatCurrency,
  formatCurrencyExact,
  formatNumber,
  formatRate,
} from '@/lib/format';
import type { Rate } from '@/lib/types';

// ---------------------------------------------------------------------------
// Tiny check harness
// ---------------------------------------------------------------------------

interface CheckRow {
  label: string;
  expected: string;
  actual: string;
  pass: boolean;
  /** Diagnosis attached to a known, investigated disagreement with VERIFY.md. */
  note?: string;
}

const rows: CheckRow[] = [];
let currentSection = '';
const sections: { title: string; rows: CheckRow[] }[] = [];

function section(title: string): void {
  currentSection = title;
  sections.push({ title, rows: [] });
}

function check(label: string, actual: unknown, expected: unknown, note?: string): void {
  const actualText = String(actual);
  const expectedText = String(expected);
  const row: CheckRow = {
    label,
    expected: expectedText,
    actual: actualText,
    pass: actualText === expectedText,
    note,
  };
  rows.push(row);
  const target = sections.find((s) => s.title === currentSection);
  target?.rows.push(row);
}

function pct(rate: Rate, decimals = 1): string {
  return formatRate(rate, decimals);
}

// ---------------------------------------------------------------------------
// Compute everything once
// ---------------------------------------------------------------------------

const dataset = getDataset();
const kpis = computeKpiSet(dataset);
const branches = computeBranches(dataset);
const reps = computeReps(dataset);
const aging = computeAging(dataset);
const stalled = computeStalledOrders(dataset);
const cycle = computeCycleTime(dataset);
const deliveries = computeDeliveries(dataset);
const loss = computeLossAnalysis(dataset);
const sources = computeSources(dataset);
const targets = computeTargets(dataset);
const cohorts = computeCohorts(dataset);

const branchById = (id: string) => {
  const found = branches.branches.find((b) => b.branchId === id);
  if (!found) throw new Error(`Branch ${id} missing from rollup`);
  return found;
};

// ---------------------------------------------------------------------------
// Dataset shape
// ---------------------------------------------------------------------------

section('Dataset shape');
check('Leads', dataset.leads.length, 510);
check('Branches', dataset.branches.length, 5);
check('Sales reps', dataset.reps.length, 30);
check(
  'Sales officers',
  dataset.reps.filter((r) => r.role === 'sales_officer').length,
  25,
);
check(
  'Branch managers',
  dataset.reps.filter((r) => r.role === 'branch_manager').length,
  5,
);
check('Reps holding >=1 lead', reps.active.length, 25);
check(
  'Branch managers holding leads',
  reps.reps.filter((r) => r.role === 'branch_manager' && !r.hasNoLeads).length,
  0,
);
check('Deliveries', dataset.deliveries.length, 160);
check('Targets', dataset.targets.length, 35);
check('Status/history mismatches reconciled', dataset.reconciliation.reconciledCount, 14);
check('NOW', NOW.toISOString(), '2025-12-31T19:10:00.000Z');

// ---------------------------------------------------------------------------
// Current status counts
// ---------------------------------------------------------------------------

section('Current status counts');
const statusCounts = new Map<string, number>();
for (const lead of dataset.leads) {
  statusCounts.set(lead.status, (statusCounts.get(lead.status) ?? 0) + 1);
}
check('lost', statusCounts.get('lost') ?? 0, 288);
check('delivered', statusCounts.get('delivered') ?? 0, 160);
check('order_placed', statusCounts.get('order_placed') ?? 0, 38);
check('contacted', statusCounts.get('contacted') ?? 0, 10);
check('test_drive', statusCounts.get('test_drive') ?? 0, 6);
check('new', statusCounts.get('new') ?? 0, 5);
check('negotiation', statusCounts.get('negotiation') ?? 0, 3);

// ---------------------------------------------------------------------------
// Company totals
// ---------------------------------------------------------------------------

section('Company totals');
check('Delivered units', kpis.deliveredUnits, 160);
check('Delivered revenue', formatCurrency(kpis.deliveredRevenue), '₹38.88 Cr');
check('Delivered revenue (exact)', kpis.deliveredRevenue, 388760000);
check('Win rate', pct(kpis.winRate), '31.4%');
check('Open leads', kpis.openPipelineCount, 62);
check('Open pipeline value', formatCurrency(kpis.openPipelineValue), '₹15.15 Cr');
check('Open pipeline value (exact)', kpis.openPipelineValue, 151540000);
check('Lost value', formatCurrency(kpis.lostValue), '₹69.65 Cr');
check('Total target units', formatNumber(targets.group.targetUnits), '1,426');
check('Total target revenue', formatCurrency(targets.group.targetRevenue), '₹313.01 Cr');
check(
  'Attainment (revenue)',
  `${((targets.group.revenueAttainment ?? 0) * 100).toFixed(1)}%`,
  '12.4%',
);
const dealValues = dataset.leads.map((l) => l.dealValue);
check('Deal value min', formatCurrencyExact(Math.min(...dealValues)), '₹7,50,000');
check('Deal value max', formatCurrencyExact(Math.max(...dealValues)), '₹56,00,000');

// ---------------------------------------------------------------------------
// Per-branch funnel
// ---------------------------------------------------------------------------

section('Per-branch funnel (ever reached)');
const branchExpectations = [
  { id: 'B1', leads: 97, contacted: 80, test: 69, nego: 53, order: 46, delivered: 40, win: '41.2%' },
  { id: 'B2', leads: 109, contacted: 86, test: 64, nego: 54, order: 43, delivered: 36, win: '33.0%' },
  { id: 'B3', leads: 79, contacted: 46, test: 27, nego: 14, order: 10, delivered: 6, win: '7.6%' },
  { id: 'B4', leads: 98, contacted: 80, test: 64, nego: 48, order: 40, delivered: 31, win: '31.6%' },
  { id: 'B5', leads: 127, contacted: 99, test: 76, nego: 66, order: 59, delivered: 47, win: '37.0%' },
] as const;

for (const expected of branchExpectations) {
  const funnel = computeFunnel(dataset, {}, { kind: 'branch', branchId: expected.id });
  const stage = (name: string) =>
    funnel.stages.find((s) => s.stage === name)?.reached ?? -1;
  check(`${expected.id} leads`, funnel.totalLeads, expected.leads);
  check(`${expected.id} contacted`, stage('contacted'), expected.contacted);
  check(`${expected.id} test_drive`, stage('test_drive'), expected.test);
  check(`${expected.id} negotiation`, stage('negotiation'), expected.nego);
  check(`${expected.id} order_placed`, stage('order_placed'), expected.order);
  check(`${expected.id} delivered`, stage('delivered'), expected.delivered);
  check(`${expected.id} win rate`, pct(branchById(expected.id).winRate), expected.win);
}

// ---------------------------------------------------------------------------
// Step conversion: Lakeside vs the other four
// ---------------------------------------------------------------------------

section('Step conversion: B3 vs B1+B2+B4+B5');
const b3Funnel = computeFunnel(dataset, {}, { kind: 'branch', branchId: 'B3' });
const restFunnel = computeFunnel(dataset, { branchIds: ['B1', 'B2', 'B4', 'B5'] });
const stepExpectations = [
  { step: 'new -> contacted', b3: '58%', rest: '80%' },
  { step: 'contacted -> test_drive', b3: '59%', rest: '79%' },
  { step: 'test_drive -> negotiation', b3: '52%', rest: '81%' },
  { step: 'negotiation -> order_placed', b3: '71%', rest: '85%' },
  { step: 'order_placed -> delivered', b3: '60%', rest: '82%' },
] as const;

stepExpectations.forEach((expected, index) => {
  check(`B3 ${expected.step}`, pct(b3Funnel.steps[index].conversion, 0), expected.b3);
  check(`Rest ${expected.step}`, pct(restFunnel.steps[index].conversion, 0), expected.rest);
});

// ---------------------------------------------------------------------------
// Stalled orders
// ---------------------------------------------------------------------------

section('Stalled orders (order_placed, no delivery record)');
check('Count', stalled.count, 38);
check('Value', formatCurrency(stalled.value), '₹8.59 Cr');
check('Oldest age (days)', stalled.oldestAgeDays, 195);
check('B5', stalled.countByBranch.get('B5') ?? 0, 12);
check('B4', stalled.countByBranch.get('B4') ?? 0, 9);
check('B2', stalled.countByBranch.get('B2') ?? 0, 7);
check('B1', stalled.countByBranch.get('B1') ?? 0, 6);
check('B3', stalled.countByBranch.get('B3') ?? 0, 4);

// ---------------------------------------------------------------------------
// Lead aging
// ---------------------------------------------------------------------------

section('Lead aging (open leads, vs NOW)');
const bucket = (days: number) => aging.buckets.find((b) => b.thresholdDays === days)?.count ?? -1;
check('> 7 days', bucket(7), 35);
check('> 14 days', bucket(14), 27);
check('> 30 days', bucket(30), 24);

// ---------------------------------------------------------------------------
// Stage dwell medians
// ---------------------------------------------------------------------------

section('Stage dwell medians (days)');
const dwell = (from: string, to: string) =>
  cycle.dwell.find((d) => d.from === from && d.to === to)?.medianDays ?? -1;
check('new -> contacted', dwell('new', 'contacted'), 1);
check('contacted -> test_drive', dwell('contacted', 'test_drive'), 5);
check('test_drive -> negotiation', dwell('test_drive', 'negotiation'), 3);
check('negotiation -> order_placed', dwell('negotiation', 'order_placed'), 8);
check('order_placed -> delivered', dwell('order_placed', 'delivered'), 17);

// ---------------------------------------------------------------------------
// Cycle time
// ---------------------------------------------------------------------------

section('Cycle time (delivered leads)');
check('Median days', cycle.total.medianDays, 37);
check('p90 days', cycle.total.p90Days, 50);
check('Delivery leg median', deliveries.medianDaysToDeliver, 17);
check('Delivery leg max', deliveries.maxDaysToDeliver, 39);
check('Delivery leg exceeding 21 days', deliveries.exceedingSla, 47);
check('Deliveries total', deliveries.count, 160);

// ---------------------------------------------------------------------------
// Where deals die
// ---------------------------------------------------------------------------

section('Where deals die (stage before loss)');
check('Lost leads', loss.lostCount, 288);
const stageLoss = (stage: string) => loss.byStage.find((s) => s.stage === stage)?.count ?? -1;
check('new', stageLoss('new'), 114);
check('contacted', stageLoss('contacted'), 81);
check('test_drive', stageLoss('test_drive'), 59);
check('negotiation', stageLoss('negotiation'), 34);

section('Loss reasons');
const reasonCount = (reason: string) =>
  loss.byReason.find((r) => r.reason === reason)?.count ?? -1;
check('Better offer elsewhere', reasonCount('Better offer elsewhere'), 40);
check('Not ready to purchase', reasonCount('Not ready to purchase'), 40);
check('Financing not approved', reasonCount('Financing not approved'), 38);
check('Unresponsive after follow-up', reasonCount('Unresponsive after follow-up'), 38);
check('Budget constraints', reasonCount('Budget constraints'), 36);
check('Chose competitor brand', reasonCount('Chose competitor brand'), 30);
check('Dissatisfied with test drive', reasonCount('Dissatisfied with test drive'), 28);
check('Relocated to another city', reasonCount('Relocated to another city'), 24);

// ---------------------------------------------------------------------------
// Lead source
// ---------------------------------------------------------------------------

section('Lead source');
const sourceExpectations = [
  { source: 'walk_in', leads: 140, win: '45.7%', avg: '₹24.99 L' },
  { source: 'website', leads: 100, win: '28.0%', avg: '₹22.08 L' },
  { source: 'referral', leads: 83, win: '30.1%', avg: '₹22.40 L' },
  { source: 'social_media', leads: 72, win: '13.9%', avg: '₹27.17 L' },
  { source: 'phone_enquiry', leads: 72, win: '27.8%', avg: '₹24.44 L' },
  { source: 'auto_expo', leads: 43, win: '30.2%', avg: '₹25.24 L' },
] as const;

/**
 * Known disagreement, investigated and left unreconciled on purpose.
 *
 * walk_in's exact mean deal value is ₹24,99,714.29 = 24.997143 L. Rounding
 * that to two decimals gives 24.99 only under truncation; half-up rounding
 * gives 25.00. VERIFY.md's other five rows (22.077 -> 22.08, 22.3988 -> 22.40,
 * 25.2372 -> 25.24) are all half-up, so truncation cannot be the intended
 * convention. This codebase rounds half-up everywhere, matching five of the
 * six rows; VERIFY.md's walk_in figure is internally inconsistent with its
 * own table. The underlying metric agrees to the rupee — the disagreement is
 * ₹714 of display rounding, not a computation difference.
 */
const WALK_IN_NOTE =
  'VERIFY.md inconsistency, not a code defect. Exact mean = ₹24,99,714.29 (24.997143 L). ' +
  'Half-up rounding -> 25.00 L and matches the other five source rows; only truncation ' +
  'yields 24.99 L, and truncation breaks website (22.07 vs 22.08), referral (22.39 vs ' +
  '22.40) and auto_expo (25.23 vs 25.24). Code left unchanged deliberately.';

for (const expected of sourceExpectations) {
  const row = sources.sources.find((s) => s.source === expected.source);
  check(`${expected.source} leads`, row?.leads ?? -1, expected.leads);
  check(`${expected.source} win rate`, row ? pct(row.winRate) : 'missing', expected.win);
  check(
    `${expected.source} avg deal`,
    row?.averageDealValue != null ? formatCurrency(row.averageDealValue) : 'missing',
    expected.avg,
    expected.source === 'walk_in' ? WALK_IN_NOTE : undefined,
  );
  // The metric itself is asserted exactly, independent of display rounding.
  if (expected.source === 'walk_in') {
    check(
      'walk_in avg deal (exact rupees)',
      row?.averageDealValue != null ? Math.round(row.averageDealValue * 100) / 100 : 'missing',
      2499714.29,
    );
  }
}

// ---------------------------------------------------------------------------
// Rep extremes
// ---------------------------------------------------------------------------

section('Rep extremes (win rate)');
const worst = rankRepsByWinRate(reps, 'worst', 5);
const best = rankRepsByWinRate(reps, 'best', 5);
const worstExpectations = [
  { name: 'Venkat Mishra', win: '4.5%', n: 22 },
  { name: 'Revathi Pandey', win: '7.1%', n: 14 },
  { name: 'Kavitha Joshi', win: '7.7%', n: 13 },
  { name: 'Vikram Patel', win: '8.3%', n: 12 },
  { name: 'Sanjay Rao', win: '11.1%', n: 18 },
] as const;
const bestExpectations = [
  { name: 'Priya Choudhury', win: '57.1%', n: 14 },
  { name: 'Suresh Nair', win: '50.0%', n: 22 },
  { name: 'Sanjay Kulkarni', win: '48.0%', n: 25 },
  { name: 'Prakash Gupta', win: '42.9%', n: 28 },
  { name: 'Ananya Pandey', win: '42.1%', n: 19 },
] as const;

worstExpectations.forEach((expected, index) => {
  const rep = worst[index];
  check(`Worst #${index + 1}`, rep ? `${rep.name} ${pct(rep.winRate)} (n=${rep.leadsHandled})` : 'missing',
    `${expected.name} ${expected.win} (n=${expected.n})`);
});
check('Worst 5 all Lakeside', worst.every((r) => r.branchId === 'B3'), true);
bestExpectations.forEach((expected, index) => {
  const rep = best[index];
  check(`Best #${index + 1}`, rep ? `${rep.name} ${pct(rep.winRate)} (n=${rep.leadsHandled})` : 'missing',
    `${expected.name} ${expected.win} (n=${expected.n})`);
});
const load = leadLoadRange(reps);
check('Lead load range', load ? `${load.min}-${load.max}` : 'missing', '11-33');

// ---------------------------------------------------------------------------
// Cohorts
// ---------------------------------------------------------------------------

section('Cohorts (leads created / eventually delivered)');
const cohortExpectations = [
  { month: '2025-06', created: 55, delivered: 19, mature: true },
  { month: '2025-07', created: 60, delivered: 16, mature: true },
  { month: '2025-08', created: 65, delivered: 26, mature: true },
  { month: '2025-09', created: 70, delivered: 30, mature: true },
  { month: '2025-10', created: 90, delivered: 37, mature: true },
  { month: '2025-11', created: 95, delivered: 31, mature: false },
  { month: '2025-12', created: 75, delivered: 1, mature: false },
] as const;

for (const expected of cohortExpectations) {
  const point = cohorts.cohorts.find((c) => c.month === expected.month);
  check(
    `${expected.month} created/delivered`,
    point ? `${point.leadsCreated}/${point.delivered}` : 'missing',
    `${expected.created}/${expected.delivered}`,
  );
  check(`${expected.month} isMature`, point?.isMature ?? 'missing', expected.mature);
}
check('Immature months', cohorts.immatureMonths.join(','), '2025-11,2025-12');

// ---------------------------------------------------------------------------
// Delivery delay causes
// ---------------------------------------------------------------------------

section('Delivery delay causes');
check('Deliveries with a reason', deliveries.withDelayReason, 72);
const delayCount = (reason: string) =>
  deliveries.byDelayReason.find((r) => r.reason === reason)?.count ?? -1;
check('Customer requested date change', delayCount('Customer requested date change'), 18);
check('Logistics delay in transit', delayCount('Logistics delay in transit'), 11);
check('Vehicle allocation delayed from factory', delayCount('Vehicle allocation delayed from factory'), 11);
check('Accessory fitment backlog', delayCount('Accessory fitment backlog'), 10);
check('Finance disbursement pending', delayCount('Finance disbursement pending'), 9);
check('RTO registration delay', delayCount('RTO registration delay'), 7);
check('PDI rework required', delayCount('PDI rework required'), 6);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const GREEN = '[32m';
const RED = '[31m';
const DIM = '[2m';
const BOLD = '[1m';
const RESET = '[0m';

/** Wrap text to a column width for the diagnosis block. */
function wrap(text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (line.length + word.length + 1 > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const labelWidth = Math.max(...rows.map((r) => r.label.length)) + 2;
const expectedWidth = Math.max(...rows.map((r) => r.expected.length), 8) + 2;
const actualWidth = Math.max(...rows.map((r) => r.actual.length), 6) + 2;

console.log('');
console.log(`${BOLD}DealerPulse — VERIFY.md reproduction${RESET}`);
console.log(`${DIM}Every figure below is computed by the analytics layer and compared to VERIFY.md.${RESET}`);
console.log('');

for (const { title, rows: sectionRows } of sections) {
  if (sectionRows.length === 0) continue;
  console.log(`${BOLD}${title}${RESET}`);
  console.log(
    `${DIM}${'CHECK'.padEnd(labelWidth)}${'EXPECTED'.padEnd(expectedWidth)}${'ACTUAL'.padEnd(actualWidth)}RESULT${RESET}`,
  );
  for (const row of sectionRows) {
    const marker = row.pass ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
    console.log(
      `${row.label.padEnd(labelWidth)}${row.expected.padEnd(expectedWidth)}${row.actual.padEnd(actualWidth)}${marker}`,
    );
  }
  console.log('');
}

const failed = rows.filter((r) => !r.pass);
const passed = rows.length - failed.length;

console.log(`${BOLD}Summary${RESET}`);
console.log(`  Checks: ${rows.length}`);
console.log(`  ${GREEN}PASS: ${passed}${RESET}`);
console.log(`  ${failed.length > 0 ? RED : DIM}FAIL: ${failed.length}${RESET}`);

if (failed.length > 0) {
  console.log('');
  console.log(`${RED}${BOLD}Failing checks${RESET}`);
  for (const row of failed) {
    console.log(`  ${row.label}: expected ${row.expected}, got ${row.actual}`);
    if (row.note) {
      for (const line of wrap(row.note, 92)) console.log(`${DIM}      ${line}${RESET}`);
    }
  }
  process.exitCode = 1;
} else {
  console.log('');
  console.log(`${GREEN}${BOLD}All VERIFY.md figures reproduced.${RESET}`);
}
