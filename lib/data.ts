/**
 * The single entry point to the dataset.
 *
 * Responsibilities, all performed exactly once and memoized:
 *  1. Parse every timestamp to `Date` at load — never at a call site.
 *  2. Reconcile the documented `status` / `status_history` disagreement and
 *     expose the count so the UI can show a data-quality note.
 *  3. Build the lookup indexes that analytics read instead of repeatedly
 *     filtering 510 leads.
 *
 * No analytics live here. This module only normalizes and indexes.
 */

import rawData from '@/data/dealership_data.json';
import type {
  Branch,
  BranchId,
  Delivery,
  Lead,
  LeadId,
  LeadStatus,
  MonthKey,
  RawDataset,
  RawLead,
  RepId,
  SalesRep,
  StatusHistoryEntry,
  Target,
} from '@/lib/types';

/**
 * Pinned "current time": the maximum `last_activity_at` in the dataset.
 * Every aging, staleness and SLA calculation uses this.
 *
 * Never `Date.now()` or `new Date()`. The file's own `metadata.generated_at`
 * claims a 2026 date; it is ignored deliberately.
 */
export const NOW = new Date('2025-12-31T19:10:00Z');

/**
 * Minimum denominator for any published rate. Below this the low-n guard
 * suppresses the percentage rather than emitting a rate off a handful of leads.
 */
export const MIN_RATE_DENOMINATOR = 10;

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Parse an ISO timestamp. Date-only strings are read as UTC midnight. */
function parseTimestamp(value: string): Date {
  const iso = value.length === 10 ? `${value}T00:00:00Z` : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Unparseable timestamp in dataset: ${value}`);
  }
  return date;
}

/**
 * `YYYY-MM` key in UTC. UTC is required so month bucketing does not shift with
 * the host timezone.
 */
export function toMonthKey(date: Date): MonthKey {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}` as MonthKey;
}

/** Key for the targets index. */
export function targetKey(branchId: BranchId, month: MonthKey): string {
  return `${branchId}|${month}`;
}

// ---------------------------------------------------------------------------
// Normalized dataset
// ---------------------------------------------------------------------------

export interface DatasetIndexes {
  leadsById: ReadonlyMap<LeadId, Lead>;
  leadsByBranch: ReadonlyMap<BranchId, readonly Lead[]>;
  leadsByRep: ReadonlyMap<RepId, readonly Lead[]>;
  deliveriesByLeadId: ReadonlyMap<LeadId, Delivery>;
  targetsByBranchMonth: ReadonlyMap<string, Target>;
  branchesById: ReadonlyMap<BranchId, Branch>;
  repsById: ReadonlyMap<RepId, SalesRep>;
  repsByBranch: ReadonlyMap<BranchId, readonly SalesRep[]>;
}

export interface Reconciliation {
  /** Number of leads whose `status` was missing from their `status_history`. */
  reconciledCount: number;
  /** Ids of those leads, in dataset order. */
  reconciledIds: readonly LeadId[];
}

export interface Dataset {
  branches: readonly Branch[];
  reps: readonly SalesRep[];
  leads: readonly Lead[];
  targets: readonly Target[];
  deliveries: readonly Delivery[];
  indexes: DatasetIndexes;
  reconciliation: Reconciliation;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Reconciliation rule.
 *
 * `status_history` is authoritative for funnel progression; `status` is
 * authoritative for current state. When `lead.status` never appears in
 * `status_history`, the history is *incomplete*, not wrong — the lead really
 * did reach that state, the transition simply was not recorded.
 *
 * The fix is additive: append one synthetic entry carrying `lead.status` at
 * `last_activity_at` (the best available evidence of when that state was
 * reached). Existing entries are never rewritten or removed, so every
 * "did this lead ever reach stage X?" answer is unchanged by reconciliation.
 *
 * In this dataset the rule fires on exactly 14 leads, all of them `lost` with
 * no terminal `lost` entry recorded.
 */
function normalizeLead(raw: RawLead): { lead: Lead; reconciled: boolean } {
  const history: StatusHistoryEntry[] = raw.status_history
    .map((entry) => ({
      status: entry.status,
      timestamp: parseTimestamp(entry.timestamp),
      note: entry.note,
      synthetic: false,
    }))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const lastActivityAt = parseTimestamp(raw.last_activity_at);
  const needsReconciliation = !history.some((entry) => entry.status === raw.status);

  if (needsReconciliation) {
    history.push({
      status: raw.status,
      timestamp: lastActivityAt,
      note: `Reconciled: lead.status was "${raw.status}" but no matching status_history entry existed.`,
      synthetic: true,
    });
  }

  const stagesReached = new Set<LeadStatus>(history.map((entry) => entry.status));
  const createdAt = parseTimestamp(raw.created_at);

  return {
    reconciled: needsReconciliation,
    lead: {
      id: raw.id,
      customerName: raw.customer_name,
      phone: raw.phone,
      source: raw.source,
      model: raw.model_interested,
      status: raw.status,
      assignedTo: raw.assigned_to,
      branchId: raw.branch_id,
      createdAt,
      lastActivityAt,
      statusHistory: history,
      expectedCloseDate: parseTimestamp(raw.expected_close_date),
      dealValue: raw.deal_value,
      lostReason: raw.lost_reason,
      reconciled: needsReconciliation,
      createdMonth: toMonthKey(createdAt),
      stagesReached,
    },
  };
}

function buildDataset(): Dataset {
  const raw = rawData as unknown as RawDataset;

  const branches: Branch[] = raw.branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
    city: branch.city,
  }));

  const reps: SalesRep[] = raw.sales_reps.map((rep) => ({
    id: rep.id,
    name: rep.name,
    branchId: rep.branch_id,
    role: rep.role,
    joined: parseTimestamp(rep.joined),
  }));

  const leads: Lead[] = [];
  const reconciledIds: LeadId[] = [];
  for (const rawLead of raw.leads) {
    const { lead, reconciled } = normalizeLead(rawLead);
    leads.push(lead);
    if (reconciled) reconciledIds.push(lead.id);
  }

  const targets: Target[] = raw.targets.map((target) => ({
    branchId: target.branch_id,
    month: target.month as MonthKey,
    targetUnits: target.target_units,
    targetRevenue: target.target_revenue,
  }));

  const deliveries: Delivery[] = raw.deliveries.map((delivery) => {
    const deliveryDate = parseTimestamp(delivery.delivery_date);
    return {
      leadId: delivery.lead_id,
      orderDate: parseTimestamp(delivery.order_date),
      deliveryDate,
      daysToDeliver: delivery.days_to_deliver,
      delayReason: delivery.delay_reason,
      deliveryMonth: toMonthKey(deliveryDate),
    };
  });

  // --- indexes -------------------------------------------------------------

  const leadsById = new Map<LeadId, Lead>();
  const leadsByBranch = new Map<BranchId, Lead[]>();
  const leadsByRep = new Map<RepId, Lead[]>();

  // Seed the grouped indexes from the entity lists so that a branch or rep
  // holding zero leads still resolves to an empty array rather than undefined.
  // The five branch managers depend on this.
  for (const branch of branches) leadsByBranch.set(branch.id, []);
  for (const rep of reps) leadsByRep.set(rep.id, []);

  for (const lead of leads) {
    leadsById.set(lead.id, lead);

    const branchBucket = leadsByBranch.get(lead.branchId);
    if (branchBucket) branchBucket.push(lead);
    else leadsByBranch.set(lead.branchId, [lead]);

    const repBucket = leadsByRep.get(lead.assignedTo);
    if (repBucket) repBucket.push(lead);
    else leadsByRep.set(lead.assignedTo, [lead]);
  }

  const deliveriesByLeadId = new Map<LeadId, Delivery>();
  for (const delivery of deliveries) deliveriesByLeadId.set(delivery.leadId, delivery);

  const targetsByBranchMonth = new Map<string, Target>();
  for (const target of targets) {
    targetsByBranchMonth.set(targetKey(target.branchId, target.month), target);
  }

  const branchesById = new Map<BranchId, Branch>();
  for (const branch of branches) branchesById.set(branch.id, branch);

  const repsById = new Map<RepId, SalesRep>();
  const repsByBranch = new Map<BranchId, SalesRep[]>();
  for (const branch of branches) repsByBranch.set(branch.id, []);
  for (const rep of reps) {
    repsById.set(rep.id, rep);
    const bucket = repsByBranch.get(rep.branchId);
    if (bucket) bucket.push(rep);
    else repsByBranch.set(rep.branchId, [rep]);
  }

  return {
    branches,
    reps,
    leads,
    targets,
    deliveries,
    indexes: {
      leadsById,
      leadsByBranch,
      leadsByRep,
      deliveriesByLeadId,
      targetsByBranchMonth,
      branchesById,
      repsById,
      repsByBranch,
    },
    reconciliation: {
      reconciledCount: reconciledIds.length,
      reconciledIds,
    },
  };
}

let cached: Dataset | null = null;

/**
 * Load and normalize the dataset. Memoized: the JSON is walked once per
 * process, and every later call returns the same object identity.
 */
export function getDataset(): Dataset {
  cached ??= buildDataset();
  return cached;
}
