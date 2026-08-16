/**
 * The command palette's index, built on the server.
 *
 * Roughly fifty label/href pairs — every screen, branch, rep and vehicle, plus
 * the two actions that only make sense on the client. Deliberately small: the
 * point of building it here is that the browser never needs the dataset to
 * offer navigation across it.
 */

import type { Dataset } from '@/lib/data';
import type { CommandItem } from '@/components/command-palette';
import { formatCurrency } from '@/lib/format';
import { hrefWithFilters, type FilterState } from '@/lib/url-filters';

export function buildCommandIndex(dataset: Dataset, filters: FilterState): CommandItem[] {
  const items: CommandItem[] = [];

  for (const [label, path, hint] of [
    ['Overview', '/', 'the group verdict'],
    ['Act now', '/actions', 'stalled orders and cold leads'],
    ['Leads', '/leads', 'every lead, searchable'],
    ['Vehicles', '/models', 'revenue by model'],
    ['How this was calculated', '/method', 'the rules behind every figure'],
  ] as const) {
    items.push({ id: `nav:${path}`, label, hint, group: 'Go to', href: hrefWithFilters(path, filters) });
  }

  for (const branch of dataset.branches) {
    items.push({
      id: `branch:${branch.id}`,
      label: branch.name.replace(' Toyota', ''),
      hint: branch.city,
      group: 'Branches',
      href: hrefWithFilters(`/branch/${branch.id}`, filters),
    });
  }

  /*
   * Reps carry their branch as the hint, which is also matched on — typing a
   * branch name lists its people. Managers are included: they hold no leads,
   * and finding that out is a legitimate reason to look one up.
   */
  for (const rep of dataset.reps) {
    const branch = dataset.branches.find((b) => b.id === rep.branchId);
    items.push({
      id: `rep:${rep.id}`,
      label: rep.name,
      hint: branch ? branch.name.replace(' Toyota', '') : rep.branchId,
      group: 'People',
      href: hrefWithFilters(`/rep/${rep.id}`, filters),
    });
  }

  const revenue = new Map<string, number>();
  for (const lead of dataset.leads) {
    if (lead.status !== 'delivered') continue;
    revenue.set(lead.model, (revenue.get(lead.model) ?? 0) + lead.dealValue);
  }
  const models = [...new Set(dataset.leads.map((l) => l.model))].sort(
    (a, b) => (revenue.get(b) ?? 0) - (revenue.get(a) ?? 0),
  );
  for (const model of models) {
    items.push({
      id: `model:${model}`,
      label: model,
      hint: `${formatCurrency(revenue.get(model) ?? 0)} delivered`,
      group: 'Vehicles',
      // Selecting a vehicle filters the whole product to it, which is what the
      // vehicles table's own links do.
      href: hrefWithFilters('/models', { ...filters, models: [model] }),
    });
  }

  items.push({
    id: 'act:copy',
    label: 'Copy a link to this exact view',
    hint: 'filters included',
    group: 'This view',
    action: 'copy-link',
  });
  items.push({
    id: 'act:print',
    label: 'Print or save as PDF',
    hint: 'laid out for paper',
    group: 'This view',
    action: 'print',
  });

  return items;
}
