/**
 * Domain types for DealerPulse.
 *
 * Every type here is derived from the actual shape of `data/dealership_data.json`
 * (510 leads, 5 branches, 30 reps, 160 deliveries, 35 targets), not assumed.
 * Value unions below are the exhaustive set of values observed in that file.
 *
 * Two layers of types live here:
 *  - `Raw*` types mirror the JSON exactly (timestamps as strings).
 *  - The normalized types are what the loader produces and analytics consume
 *    (timestamps as `Date`, parsed once at load).
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/** Every value observed in `lead.status` and in `status_history[].status`. */
export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'test_drive'
  | 'negotiation'
  | 'order_placed'
  | 'delivered'
  | 'lost';

/**
 * The funnel stages in progression order. `lost` is deliberately excluded:
 * it is a terminal outcome, not a stage leads advance through.
 */
export const FUNNEL_STAGES = [
  'new',
  'contacted',
  'test_drive',
  'negotiation',
  'order_placed',
  'delivered',
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number];

/** The five consecutive stage-to-stage transitions implied by FUNNEL_STAGES. */
export const FUNNEL_STEPS = [
  ['new', 'contacted'],
  ['contacted', 'test_drive'],
  ['test_drive', 'negotiation'],
  ['negotiation', 'order_placed'],
  ['order_placed', 'delivered'],
] as const satisfies ReadonlyArray<readonly [FunnelStage, FunnelStage]>;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export type LeadSource =
  | 'walk_in'
  | 'website'
  | 'referral'
  | 'social_media'
  | 'phone_enquiry'
  | 'auto_expo';

export type VehicleModel =
  | 'Camry'
  | 'Fortuner'
  | 'Glanza'
  | 'Hilux'
  | 'Innova Crysta'
  | 'Innova Hycross'
  | 'Urban Cruiser Hyryder';

export type RepRole = 'branch_manager' | 'sales_officer';

/** `lost_reason` is null for leads that are not lost, and for the 14 reconciled leads. */
export type LostReason =
  | 'Better offer elsewhere'
  | 'Budget constraints'
  | 'Chose competitor brand'
  | 'Dissatisfied with test drive'
  | 'Financing not approved'
  | 'Not ready to purchase'
  | 'Relocated to another city'
  | 'Unresponsive after follow-up';

/** `delay_reason` is null for the 88 deliveries that were not delayed. */
export type DelayReason =
  | 'Accessory fitment backlog'
  | 'Customer requested date change'
  | 'Finance disbursement pending'
  | 'Logistics delay in transit'
  | 'PDI rework required'
  | 'RTO registration delay'
  | 'Vehicle allocation delayed from factory';

/** Branded `YYYY-MM` key, e.g. `2025-06`. */
export type MonthKey = string & { readonly __brand: 'MonthKey' };

export type BranchId = string;
export type RepId = string;
export type LeadId = string;

// ---------------------------------------------------------------------------
// Raw JSON shapes (timestamps unparsed)
// ---------------------------------------------------------------------------

export interface RawStatusHistoryEntry {
  status: LeadStatus;
  timestamp: string;
  note: string;
}

export interface RawLead {
  id: LeadId;
  customer_name: string;
  phone: string;
  source: LeadSource;
  model_interested: VehicleModel;
  status: LeadStatus;
  assigned_to: RepId;
  branch_id: BranchId;
  created_at: string;
  last_activity_at: string;
  status_history: RawStatusHistoryEntry[];
  expected_close_date: string;
  deal_value: number;
  lost_reason: LostReason | null;
}

export interface RawBranch {
  id: BranchId;
  name: string;
  city: string;
}

export interface RawSalesRep {
  id: RepId;
  name: string;
  branch_id: BranchId;
  role: RepRole;
  joined: string;
}

export interface RawTarget {
  branch_id: BranchId;
  month: string;
  target_units: number;
  target_revenue: number;
}

export interface RawDelivery {
  lead_id: LeadId;
  order_date: string;
  delivery_date: string;
  days_to_deliver: number;
  delay_reason: DelayReason | null;
}

export interface RawDataset {
  metadata: {
    generated_at: string;
    description: string;
    date_range: string;
    notes: string;
  };
  branches: RawBranch[];
  sales_reps: RawSalesRep[];
  leads: RawLead[];
  targets: RawTarget[];
  deliveries: RawDelivery[];
}

// ---------------------------------------------------------------------------
// Normalized shapes (timestamps parsed to Date at load)
// ---------------------------------------------------------------------------

export interface StatusHistoryEntry {
  status: LeadStatus;
  /** Parsed once at load. Never re-parsed at a call site. */
  timestamp: Date;
  note: string;
  /**
   * True when the loader appended this entry during reconciliation because
   * `lead.status` had no corresponding entry in the source `status_history`.
   * Synthetic entries carry the lead's `last_activity_at` as their timestamp.
   */
  synthetic: boolean;
}

export interface Branch {
  id: BranchId;
  name: string;
  city: string;
}

export interface SalesRep {
  id: RepId;
  name: string;
  branchId: BranchId;
  role: RepRole;
  joined: Date;
}

export interface Lead {
  id: LeadId;
  customerName: string;
  phone: string;
  source: LeadSource;
  model: VehicleModel;
  /** Authoritative for *current* state. */
  status: LeadStatus;
  assignedTo: RepId;
  branchId: BranchId;
  createdAt: Date;
  lastActivityAt: Date;
  /**
   * Authoritative for *funnel progression*. Sorted ascending by timestamp and
   * reconciled so that `status` always appears as the final entry.
   */
  statusHistory: StatusHistoryEntry[];
  expectedCloseDate: Date;
  dealValue: number;
  lostReason: LostReason | null;
  /** True if this lead's history required a synthetic terminal entry. */
  reconciled: boolean;
  /** Month key of `createdAt`, precomputed for cohort grouping. */
  createdMonth: MonthKey;
  /** Set of every status this lead has *ever* held. Precomputed for funnel reach tests. */
  stagesReached: ReadonlySet<LeadStatus>;
}

export interface Target {
  branchId: BranchId;
  month: MonthKey;
  targetUnits: number;
  targetRevenue: number;
}

export interface Delivery {
  leadId: LeadId;
  orderDate: Date;
  deliveryDate: Date;
  /** Delivery-leg duration in whole days, as recorded in the source data. */
  daysToDeliver: number;
  delayReason: DelayReason | null;
  /** Month key of `deliveryDate`, precomputed for the activity series. */
  deliveryMonth: MonthKey;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface DateRange {
  /** Inclusive lower bound. */
  from: Date;
  /** Inclusive upper bound. */
  to: Date;
}

/**
 * The single filter object passed into every analytics function.
 * Every field is optional; an omitted field means "no constraint on this axis".
 */
export interface Filters {
  dateRange?: DateRange;
  branchIds?: readonly BranchId[];
  models?: readonly VehicleModel[];
  sources?: readonly LeadSource[];
}

/** The scope a funnel or rollup is computed over. */
export type Scope =
  | { kind: 'company' }
  | { kind: 'branch'; branchId: BranchId }
  | { kind: 'rep'; repId: RepId };

// ---------------------------------------------------------------------------
// Rate results (low-n guard)
// ---------------------------------------------------------------------------

/**
 * A rate that met the minimum-denominator requirement.
 * `value` is a fraction in [0, 1], not a percentage.
 */
export interface RateOk {
  value: number;
  reason: null;
  n: number;
}

/**
 * A rate suppressed by the low-n guard: the denominator was below the
 * minimum, so no percentage is emitted.
 */
export interface RateInsufficient {
  value: null;
  reason: 'insufficient_data';
  n: number;
}

export type Rate = RateOk | RateInsufficient;
