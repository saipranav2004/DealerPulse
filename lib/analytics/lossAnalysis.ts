/**
 * Where deals die.
 *
 * Two independent breakdowns of the same lost population:
 *  - the **stage** a lead occupied immediately before it was lost, which says
 *    where in the process the business is leaking; and
 *  - the recorded **reason**, which says why.
 *
 * The 14 reconciled leads carry no `lost_reason` and are reported under
 * `unspecified` rather than being dropped or silently reassigned.
 */

import { selectLeads } from '@/lib/filters';
import { isLost, stageBeforeLoss } from '@/lib/lead';
import { rate, sumBy } from '@/lib/stats';
import type { Dataset } from '@/lib/data';
import { FUNNEL_STAGES } from '@/lib/types';
import type { Filters, FunnelStage, LostReason, Rate, Scope } from '@/lib/types';

export interface LossStageBucket {
  stage: FunnelStage;
  count: number;
  value: number;
  /** Share of all lost leads that died at this stage. */
  share: Rate;
}

export interface LossReasonBucket {
  /** The recorded reason, or null for leads with no reason on file. */
  reason: LostReason | null;
  count: number;
  value: number;
  share: Rate;
}

export interface LossAnalysisResult {
  lostCount: number;
  lostValue: number;
  /** Stage before loss, in funnel order. Stages with no losses are omitted. */
  byStage: LossStageBucket[];
  /** Reasons sorted by frequency, descending. Unspecified sorts last. */
  byReason: LossReasonBucket[];
  /** Lost leads with no `lost_reason` recorded — the reconciled ones. */
  unspecifiedCount: number;
}

/** Stage-before-loss and reason breakdowns for lost leads in scope. */
export function computeLossAnalysis(
  dataset: Dataset,
  filters: Filters = {},
  scope: Scope = { kind: 'company' },
): LossAnalysisResult {
  const lost = selectLeads(dataset, filters, scope).filter(isLost);
  const lostValue = sumBy(lost, (lead) => lead.dealValue);

  const stageBuckets = new Map<FunnelStage, { count: number; value: number }>();
  for (const lead of lost) {
    const stage = stageBeforeLoss(lead);
    const bucket = stageBuckets.get(stage) ?? { count: 0, value: 0 };
    bucket.count += 1;
    bucket.value += lead.dealValue;
    stageBuckets.set(stage, bucket);
  }

  const byStage: LossStageBucket[] = FUNNEL_STAGES.filter((stage) => stageBuckets.has(stage)).map(
    (stage) => {
      const bucket = stageBuckets.get(stage) ?? { count: 0, value: 0 };
      return {
        stage,
        count: bucket.count,
        value: bucket.value,
        share: rate(bucket.count, lost.length),
      };
    },
  );

  const reasonBuckets = new Map<LostReason | null, { count: number; value: number }>();
  for (const lead of lost) {
    const bucket = reasonBuckets.get(lead.lostReason) ?? { count: 0, value: 0 };
    bucket.count += 1;
    bucket.value += lead.dealValue;
    reasonBuckets.set(lead.lostReason, bucket);
  }

  const byReason: LossReasonBucket[] = [...reasonBuckets.entries()]
    .map(([reason, bucket]) => ({
      reason,
      count: bucket.count,
      value: bucket.value,
      share: rate(bucket.count, lost.length),
    }))
    .sort((a, b) => {
      if (a.reason === null) return 1;
      if (b.reason === null) return -1;
      return b.count - a.count || a.reason.localeCompare(b.reason);
    });

  return {
    lostCount: lost.length,
    lostValue,
    byStage,
    byReason,
    unspecifiedCount: reasonBuckets.get(null)?.count ?? 0,
  };
}
