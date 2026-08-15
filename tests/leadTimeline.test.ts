import { describe, expect, it } from 'vitest';

import { computeLeadTimeline, OVERDUE_MULTIPLE } from '@/lib/analytics/leadTimeline';
import { getDataset } from '@/lib/data';

const dataset = getDataset();

describe('computeLeadTimeline — the 195-day stalled order', () => {
  const timeline = computeLeadTimeline(dataset, 'L0022');

  it('resolves the lead and its people', () => {
    expect(timeline).not.toBeNull();
    if (!timeline) return;
    expect(timeline.customerName).toBe('Omkar Varma');
    expect(timeline.model).toBe('Camry');
    expect(timeline.dealValue).toBe(5_050_000);
    expect(timeline.repName).toBe('Revathi Pandey');
    expect(timeline.branchName).toBe('Lakeside Toyota');
    expect(timeline.status).toBe('order_placed');
    expect(timeline.isStalledOrder).toBe(true);
  });

  it('reconstructs all five recorded stages in order', () => {
    if (!timeline) return;
    expect(timeline.nodes.map((n) => n.status)).toEqual([
      'new',
      'contacted',
      'test_drive',
      'negotiation',
      'order_placed',
    ]);
    expect(timeline.nodes.every((n) => n.synthetic === false)).toBe(true);
  });

  it('measures each gap against the median for the stage being left', () => {
    if (!timeline) return;
    const gaps = timeline.nodes.map((n) => n.gapDays);
    expect(gaps).toEqual([null, 0, 9, 4, 1]);
    const medians = timeline.nodes.map((n) => n.medianDays);
    expect(medians).toEqual([null, 1, 5, 3, 8]);
  });

  it('flags only the genuinely slow transition as overdue', () => {
    if (!timeline) return;
    // 9 days against a 5-day median is 1.8x — under the 2x bar.
    expect(timeline.nodes[2].overdue).toBe(false);
    expect(timeline.nodes.some((n) => n.overdue)).toBe(false);
  });

  it('reports the open dwell as wildly over the median', () => {
    if (!timeline) return;
    expect(timeline.openDwell).not.toBeNull();
    expect(timeline.openDwell?.days).toBe(195);
    expect(timeline.openDwell?.medianDays).toBe(17);
    expect(timeline.openDwell?.ratio).toBeCloseTo(195 / 17, 6);
    expect(timeline.openDwell?.overdue).toBe(true);
    expect(OVERDUE_MULTIPLE).toBe(2);
  });

  it('reports how far past the expected close date it is', () => {
    if (!timeline) return;
    expect(timeline.expectedCloseDate.toISOString()).toBe('2025-06-28T00:00:00.000Z');
    expect(timeline.daysPastExpectedClose).toBe(186);
  });

  it('keeps the salesperson note verbatim', () => {
    if (!timeline) return;
    expect(timeline.nodes[4].note).toBe('Full payment received');
  });
});

describe('computeLeadTimeline — other cases', () => {
  it('marks a reconciled lead and its synthetic terminal node', () => {
    const id = dataset.reconciliation.reconciledIds[0];
    const timeline = computeLeadTimeline(dataset, id);
    expect(timeline).not.toBeNull();
    if (!timeline) return;
    expect(timeline.reconciled).toBe(true);
    expect(timeline.status).toBe('lost');
    const synthetic = timeline.nodes.filter((n) => n.synthetic);
    expect(synthetic).toHaveLength(1);
    expect(synthetic[0].status).toBe('lost');
    expect(timeline.lostReason).toBeNull();
  });

  it('has no open dwell for a delivered lead', () => {
    const delivered = dataset.leads.find((l) => l.status === 'delivered');
    expect(delivered).toBeDefined();
    if (!delivered) return;
    const timeline = computeLeadTimeline(dataset, delivered.id);
    expect(timeline?.openDwell).toBeNull();
    expect(timeline?.isStalledOrder).toBe(false);
  });

  it('surfaces the lost reason for a lost lead that has one', () => {
    const lost = dataset.leads.find((l) => l.status === 'lost' && l.lostReason !== null);
    expect(lost).toBeDefined();
    if (!lost) return;
    const timeline = computeLeadTimeline(dataset, lost.id);
    expect(timeline?.lostReason).toBe(lost.lostReason);
    expect(timeline?.openDwell).toBeNull();
  });

  it('returns null for an unknown id', () => {
    expect(computeLeadTimeline(dataset, 'L9999')).toBeNull();
  });
});
