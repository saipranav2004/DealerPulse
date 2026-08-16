/**
 * Vehicles — which cars the group actually earns from.
 *
 * The dataset's largest untapped dimension. The headline is the gap between
 * where effort goes and where money comes from: the most-asked-about car is
 * not the one that pays.
 */

import Link from 'next/link';
import { computeActionCenter } from '@/lib/analytics/actionCenter';
import { computeLeadTimeline } from '@/lib/analytics/leadTimeline';
import { computeModels, groupMedianCycleDays } from '@/lib/analytics/models';
import { getDataset } from '@/lib/data';
import { buildCommandIndex } from '@/lib/command-index';
import { formatCurrency, formatNumber, formatPercentValue } from '@/lib/format';
import {
  hrefWithFilters,
  parseFilterState,
  parseViewAs,
  toFilters,
  toQueryString,
  type SearchParams,
} from '@/lib/url-filters';
import { Breadcrumb, FilterBar, SubsetBar, TopBar } from '@/components/chrome';
import { LeadDrawer } from '@/components/lead-drawer';
import { RankedBars, ScatterPlot } from '@/components/charts';
import { Panel, RateText } from '@/components/ui';
import { EmptyByFilter } from '@/components/states';

export const dynamic = 'force-dynamic';

export default async function ModelsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const dataset = getDataset();
  const baseState = parseFilterState(params, dataset.branches.map((b) => b.id));
  const viewAs = parseViewAs(params, dataset.branches.map((b) => b.id));
  // A role is authoritative, not decorative: a branch manager's view is
  // scoped to their branch even if the branch parameter is missing.
  const state = viewAs ? { ...baseState, branchIds: [viewAs] } : baseState;
  const filters = toFilters(state);
  const basePath = '/models';

  const models = computeModels(dataset, filters);
  const actions = computeActionCenter(dataset, filters);
  const groupCycle = groupMedianCycleDays(dataset, filters);

  const leadParam = typeof params.lead === 'string' ? params.lead : undefined;
  const timeline = leadParam ? computeLeadTimeline(dataset, leadParam) : null;

  const top = models.topByRevenue;
  const volume = models.topByVolume;

  return (
    <div className="app">
      <TopBar
        reconciledCount={dataset.reconciliation.reconciledCount}
        commands={buildCommandIndex(dataset, state)}
        totalLeads={dataset.leads.length}
        viewAs={viewAs}
        branches={dataset.branches}
        current="models"
        actionCount={actions.stalled.count + actions.cold.count}
        filters={state}
      />
      <FilterBar
        state={state}
        branches={dataset.branches}
        basePath={basePath}
        leadCount={models.totalLeads}
        leadingSlot={
          <>
            <Breadcrumb
              items={[{ label: 'Overview', href: hrefWithFilters('/', state) }, { label: 'Vehicles' }]}
            />
            <span style={{ width: 1, height: 18, background: 'var(--rule)', margin: '0 8px' }} aria-hidden="true" />
          </>
        }
      />
      <SubsetBar
        state={state}
        branches={dataset.branches}
        basePath={basePath}
        shown={models.totalLeads}
        total={dataset.leads.length}
      />

      <main id="main">
        {models.models.length === 0 ? (
          <EmptyByFilter state={state} branches={dataset.branches} basePath={basePath} />
        ) : (
          <>
            {models.mixIsMisaligned && top && volume ? (
              <section className="verdict">
                <p className="t-eyebrow" style={{ marginBottom: 12 }}>
                  Finding · vehicle mix
                </p>
                <h1 className="t-verdict verdict-sentence">
                  The car customers ask about most is not the car that pays.{' '}
                  <b>
                    {volume.model} draws {formatNumber(volume.leads)} leads and earns{' '}
                    {formatCurrency(volume.deliveredRevenue)}
                  </b>
                  ; {top.model} draws {formatNumber(top.leads)} and earns{' '}
                  <span className="fig">{formatCurrency(top.deliveredRevenue)}</span>.
                </h1>
                <p className="verdict-sub">
                  {top.model} is{' '}
                  <span className="fig">
                    {((top.deliveredRevenue / Math.max(1, volume.deliveredRevenue)) || 0).toFixed(1)}×
                  </span>{' '}
                  the revenue on {formatNumber(volume.leads - top.leads)} fewer enquiries. Where the floor
                  spends its time is a choice, and right now it favours the cheaper car.
                </p>
              </section>
            ) : null}

            <div className="grid">
              <Panel
                title="Revenue by vehicle"
                subtitle="Delivered revenue over the selected period"
                className="c6"
                footer={
                  <p className="t-micro">
                    The top three vehicles produce{' '}
                    <strong style={{ color: 'var(--ink)' }}>
                      {formatPercentValue(
                        models.models.slice(0, 3).reduce((sum, m) => sum + m.revenueShare, 0),
                        0,
                      )}
                    </strong>{' '}
                    of all delivered revenue.
                  </p>
                }
              >
                <RankedBars
                  rows={models.models.map((model) => ({
                    key: model.model,
                    label: model.model,
                    value: model.deliveredRevenue,
                    secondary: `${model.deliveredUnits} sold`,
                    focus: model.model === top?.model,
                  }))}
                />
              </Panel>

              <Panel
                title="Enquiries against price"
                subtitle="Where attention goes versus what each car is worth"
                className="c6"
                footer={
                  <p className="t-micro">
                    Bottom right is the opportunity: expensive cars that few people ask about. Top left is
                    the trap: cheap cars absorbing the most enquiries.
                  </p>
                }
              >
                <div className="scrollx">
                <div className="chart-wide">
                <ScatterPlot
                  points={models.models.map((model) => ({
                    key: model.model,
                    label: model.model.replace('Urban Cruiser ', '').replace('Innova ', ''),
                    x: model.leads,
                    y: model.averageDealValue ?? 0,
                    focus: model.model === top?.model,
                  }))}
                  xLabel="Leads"
                  yLabel="Average price"
                />
                </div>
                </div>
              </Panel>

              <Panel
                title="Every vehicle"
                subtitle={
                  groupCycle !== null
                    ? `Group median time from enquiry to handover is ${groupCycle} days`
                    : undefined
                }
                className="c12"
                padded={false}
              >
                <div className="scrollx">
                  {/* Below 900px the four `fold` columns drop out, leaving the
                      comparison the panel is actually about: leads in, cars out,
                      money earned. */}
                  <table className="tbl tbl-hover tbl-fold tbl-rc">
                    <thead>
                      <tr>
                        <th style={{ paddingLeft: 16 }}>Vehicle</th>
                        <th className="r">Leads</th>
                        <th className="r">Sold</th>
                        <th className="r fold">Leads → sale</th>
                        <th className="r fold">Average price</th>
                        <th className="r">Revenue</th>
                        <th className="r fold">Share of revenue</th>
                        <th className="r fold">Median days to sell</th>
                        <th className="r fold-sm" style={{ paddingRight: 16 }}>
                          Still open
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {models.models.map((model) => (
                        <tr key={model.model} className={model.model === top?.model ? 'row-focus' : undefined}>
                          <td className="pin" data-rc="id" style={{ paddingLeft: 16 }}>
                            <Link
                              href={`${basePath}${toQueryString({ ...state, models: [model.model] })}`}
                              className="dp-name"
                              style={{ fontWeight: 500 }}
                            >
                              {model.model}
                            </Link>
                          </td>
                          <td className="r num" data-l="Leads">
                            {formatNumber(model.leads)}
                          </td>
                          <td className="r num" data-l="Sold">
                            {model.deliveredUnits}
                          </td>
                          <td className="r num fold" data-rc="show" data-l="Leads → sale">
                            <RateText rate={model.winRate} />
                          </td>
                          <td className="r num fold" data-l="Average price">
                            {model.averageDealValue === null ? '—' : formatCurrency(model.averageDealValue)}
                          </td>
                          <td className="r num" data-rc="key" data-l="Revenue" style={{ fontWeight: 500 }}>
                            {formatCurrency(model.deliveredRevenue)}
                          </td>
                          <td className="r num fold" data-l="Share of revenue">
                            {formatPercentValue(model.revenueShare, 1)}
                          </td>
                          <td
                            className={
                              model.medianCycleDays !== null &&
                              groupCycle !== null &&
                              model.medianCycleDays > groupCycle
                                ? 'r num warn fold'
                                : 'r num fold'
                            }
                            data-l="Median days to sell"
                          >
                            {model.medianCycleDays === null ? '—' : `${model.medianCycleDays} d`}
                          </td>
                          <td className="r num fold-sm" data-l="Still open" style={{ paddingRight: 16 }}>
                            {model.openCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <footer className="panel-ft">
                  <p className="t-micro">
                    Select a vehicle to filter the whole product to it, or{' '}
                    <Link href={hrefWithFilters('/leads', state)} className="dp-name">
                      open the lead list
                    </Link>{' '}
                    to see the individual buyers behind these numbers.
                  </p>
                </footer>
              </Panel>
            </div>
          </>
        )}
      </main>

      {timeline ? (
        <LeadDrawer timeline={timeline} closeHref={`${basePath}${toQueryString(state)}`} />
      ) : null}
    </div>
  );
}
