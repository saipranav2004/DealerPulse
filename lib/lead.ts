/**
 * Lead-level predicates and accessors shared across the analytics layer.
 * Pure functions over an already-normalized `Lead`.
 */

import type { Dataset } from '@/lib/data';
import type { FunnelStage, Lead, LeadStatus, StatusHistoryEntry } from '@/lib/types';

/** Current state, per the authoritative `status` field. */
export function isDelivered(lead: Lead): boolean {
  return lead.status === 'delivered';
}

export function isLost(lead: Lead): boolean {
  return lead.status === 'lost';
}

/** Open = still live: neither delivered nor lost. */
export function isOpen(lead: Lead): boolean {
  return lead.status !== 'delivered' && lead.status !== 'lost';
}

/**
 * Did this lead *ever* reach the given stage? Answered from `status_history`,
 * which is authoritative for progression.
 */
export function reachedStage(lead: Lead, stage: LeadStatus): boolean {
  return lead.stagesReached.has(stage);
}

/** The first time this lead entered the given status, or null if it never did. */
export function firstEntryAt(lead: Lead, status: LeadStatus): Date | null {
  for (const entry of lead.statusHistory) {
    if (entry.status === status) return entry.timestamp;
  }
  return null;
}

/** The most recent entry for the given status, or null. */
export function lastEntryFor(lead: Lead, status: LeadStatus): StatusHistoryEntry | null {
  for (let i = lead.statusHistory.length - 1; i >= 0; i -= 1) {
    const entry = lead.statusHistory[i];
    if (entry.status === status) return entry;
  }
  return null;
}

/**
 * A stalled order: the lead's current state is `order_placed` but no delivery
 * record exists for it. This is money already committed that has not moved.
 */
export function isStalledOrder(lead: Lead, dataset: Dataset): boolean {
  return lead.status === 'order_placed' && !dataset.indexes.deliveriesByLeadId.has(lead.id);
}

/**
 * The stage a lost lead occupied immediately before it was lost — i.e. the
 * last non-`lost` entry in its history. Leads whose only entry is the loss
 * itself are attributed to `new`.
 */
export function stageBeforeLoss(lead: Lead): FunnelStage {
  for (let i = lead.statusHistory.length - 1; i >= 0; i -= 1) {
    const entry = lead.statusHistory[i];
    if (entry.status !== 'lost') return entry.status as FunnelStage;
  }
  return 'new';
}
