# METRICS.md — the metric contract

Every metric the UI may display, with its exact definition. This is the
contract components are built against: **components consume these outputs and
never recompute business logic.**

Each row states the formula, what goes in the numerator and denominator, and
the rule that applies at the edges (empty scope, tiny denominator, missing
record). Where a definition had more than one defensible reading, the choice
is stated explicitly rather than left implicit in code.

All figures reproduce `VERIFY.md` except one documented rounding disagreement,
recorded at the end of this file.

---

## Global conventions

These apply to every metric below.

| Convention | Rule |
|---|---|
| **Current time** | `NOW = 2025-12-31T19:10:00Z`, the maximum `last_activity_at` in the dataset. Pinned in `lib/data.ts`. Never `Date.now()`. The file's `metadata.generated_at` (a 2026 date) is ignored. |
| **Source of truth** | `status` is authoritative for *current state*. `status_history` is authoritative for *funnel progression*. |
| **Reconciliation** | When `status` never appears in `status_history`, one synthetic entry carrying `status` at `last_activity_at` is appended. Existing entries are never modified or removed. Fires on exactly **14** leads, all `lost`. Exposed as `reconciliation.reconciledCount` / `reconciledIds`. |
| **Durations** | Whole elapsed units, floored. A lead idle 7.6 days is **7** days old and does *not* clear a "> 7 days" threshold. Applies to days and to hours. |
| **Percentiles** | Order statistic at index `ceil((n − 1) × p)`, no interpolation (numpy `method='higher'`). Every percentile reported is a value some record actually took. For an even sample the median is the upper of the two middle values, which keeps whole-day durations whole. |
| **Low-n guard** | Any rate on a denominator **< 10** returns `{ value: null, reason: 'insufficient_data', n }`. A zero denominator is suppressed by the same rule, which is what makes zero-lead reps safe. Rendered as `—`, never `0%`. |
| **Rounding** | Half-up at the display layer only. Metrics are carried at full precision; only `lib/format.ts` rounds. |
| **Currency** | Indian lakh/crore, formatted solely by `lib/format.ts`. Never `$`, `M` or `B`. |
| **Date filtering** | `filters.dateRange` selects leads by `created_at`, inclusive on both bounds. |
| **Month bucketing** | `YYYY-MM` in UTC, so buckets do not shift with the host timezone. |

### Lead state vocabulary

| Term | Definition |
|---|---|
| **Delivered** | `status === 'delivered'` |
| **Lost** | `status === 'lost'` |
| **Open** | neither delivered nor lost — still live |
| **Reached stage X** | X appears anywhere in `status_history` (ever), not the current status |
| **Stalled order** | `status === 'order_placed'` **and** no delivery record exists for the lead |

Every lead is exactly one of delivered, lost or open: 160 + 288 + 62 = 510.

---

## Headline KPIs — `lib/analytics/kpis.ts`

| Metric | Formula | Numerator | Denominator | Edge-case rule |
|---|---|---|---|---|
| Delivered units | count | leads where `status = delivered` | — | 0 for an empty scope |
| Delivered revenue | sum | `deal_value` of delivered leads | — | 0 for an empty scope |
| Win rate | numerator / denominator | delivered leads | **all** leads in scope (incl. open and lost) | low-n guard; `n = 0` → `insufficient_data` |
| Open pipeline count | count | open leads | — | 0 for an empty scope |
| Open pipeline value | sum | `deal_value` of open leads | — | value still in play, never counted as won |
| Lost count / value | count / sum | lost leads and their `deal_value` | — | 0 for an empty scope |
| Average deal value | mean | `deal_value` of all leads in scope | count of all leads in scope | `null` when the scope is empty — never `NaN` |
| Average delivered deal value | mean | `deal_value` of delivered leads | count of delivered leads | `null` when nothing delivered |
| PoP delta (absolute) | current − previous | — | — | `null` when no `dateRange` is set |
| PoP delta (relative) | (current − previous) / previous | — | previous value | `null` when previous is 0 or absent |
| PoP win-rate movement | current − previous | — | — | expressed in **fractional points**; `null` if either side is suppressed |

**Comparison period.** The previous period matches the current window's
*length*, not its calendar month: it ends 1 ms before the current window starts
and spans the same duration. October (31 days) therefore compares against
31 Aug – 30 Sep, not September alone. This is deliberate — it gives a
like-for-like comparison for arbitrary ranges, not only whole months.

---

## Funnel — `lib/analytics/funnel.ts`

Works at any scope: company, branch or rep.

| Metric | Formula | Numerator | Denominator | Edge-case rule |
|---|---|---|---|---|
| Stage reached | count | leads where the stage appears in `status_history` | — | every lead has reached `new`; `lost` is not a funnel stage |
| Share of leads | reached / total | leads reaching the stage | all leads in scope | low-n guard |
| Step conversion | to / from | leads reaching the *later* stage | leads reaching the *earlier* stage | low-n guard. B3's `order_placed → delivered` sits at exactly `n = 10` and is published |
| Step drop-off | from − to | — | — | absolute count, always defined |
| Largest drop-off | max by drop-off | — | — | `null` when no step loses a lead |

Funnel stages, in order: `new → contacted → test_drive → negotiation →
order_placed → delivered`. `lost` is excluded — it is a terminal outcome, not
a stage leads advance through.

Reconciliation cannot change any funnel count: the 14 synthetic entries are all
`lost`, which is not a funnel stage.

---

## Branch rollup — `lib/analytics/branches.ts`

| Metric | Formula | Numerator | Denominator | Edge-case rule |
|---|---|---|---|---|
| Branch win rate | delivered / leads | delivered leads in branch | all leads in branch | low-n guard |
| First-contact rate | reached / leads | leads ever reaching `contacted` | all leads in branch | low-n guard |
| Step conversions | as funnel | — | — | five steps per branch |
| Open / stalled count and value | count / sum | matching leads and `deal_value` | — | 0 for an empty branch |
| Win rate vs benchmark | branch − benchmark | — | — | fractional points; `null` if either side suppressed |
| First contact vs benchmark | branch − benchmark | — | — | fractional points; `null` if either side suppressed |
| Benchmark | pooled | delivered across all branches in scope | all leads in scope | pooled, **not** a mean of branch rates |
| Peer benchmark | pooled, excluding one branch | delivered in peer branches | leads in peer branches | for "this branch vs the rest" |

Comparison is against the group, not against target — see the Targets section
for why.

---

## Rep rollup — `lib/analytics/reps.ts`

| Metric | Formula | Numerator | Denominator | Edge-case rule |
|---|---|---|---|---|
| Leads handled | count | leads where `assigned_to = rep` | — | **0 for the five branch managers** |
| Win rate | delivered / handled | delivered leads | leads handled | low-n guard → zero-lead reps yield `insufficient_data`, never `0%` |
| Delivered revenue | sum | `deal_value` of delivered leads | — | 0, never `NaN` |
| Median hours to first contact | median | whole hours from `created_at` to first `contacted` entry | leads that were **ever contacted** | `null` when the rep contacted nobody; never-contacted leads are excluded from the denominator, not counted as zero |
| Open / stalled count and value | count / sum | matching leads and `deal_value` | — | 0 for a zero-lead rep |
| `hasNoLeads` | `leadsHandled === 0` | — | — | true for all five branch managers |

**Zero-lead reps.** All 30 reps are returned. `active` (25) holds those with at
least one lead; `inactive` (5) holds the branch managers. Ranking helpers
consider only reps whose rate survived the guard, so a manager can never appear
in a best/worst table — reporting a manager at "0%" would rank them below the
worst-performing sales officer, which is meaningless.

---

## Aging and stalled orders — `lib/analytics/aging.ts`

| Metric | Formula | Numerator | Denominator | Edge-case rule |
|---|---|---|---|---|
| Lead age | `floor((NOW − last_activity_at) / 1 day)` | — | — | whole days; only **open** leads age |
| Aging bucket | count where `age > threshold` | open leads past the threshold | — | strict `>`. Thresholds 7 / 14 / 30 days |
| Bucket value | sum | `deal_value` of leads in the bucket | — | 0 when the bucket is empty |
| Stalled order | `status = order_placed` **and** no delivery record | — | — | the join is on the delivery index, not on status alone |
| Stalled age | `floor((NOW − order_placed timestamp) / 1 day)` | — | — | measured from the **order**, not last activity — that is the commitment the customer is waiting on |
| Oldest stalled age | max | — | — | `null` when nothing is stalled |

Delivered and lost leads do not age: they have reached an outcome and are not
waiting on anybody.

---

## Cycle time — `lib/analytics/cycleTime.ts`

| Metric | Formula | Numerator | Denominator | Edge-case rule |
|---|---|---|---|---|
| Total cycle | `floor((first delivered entry − created_at) / 1 day)` | — | — | **delivered leads only**; an open lead has no cycle time and including it would understate the figure |
| Median / p90 cycle | percentile | — | delivered leads with a measurable cycle | `null` for an empty scope; order-statistic convention |
| Stage dwell | `floor((first entry in stage B − first entry in stage A) / 1 day)` | — | leads that made **both** transitions | negative gaps are discarded; `null` when no lead made both |

---

## Delivery leg — `lib/analytics/deliveries.ts`

| Metric | Formula | Numerator | Denominator | Edge-case rule |
|---|---|---|---|---|
| Deliveries | count | delivery records for leads in scope | — | joined via the delivery-by-lead index |
| Median / p90 / max days to deliver | percentile / max of `days_to_deliver` | — | deliveries in scope | `null` for an empty scope |
| Exceeding SLA | count where `days_to_deliver > 21` | slow deliveries | — | **strict** `>`: exactly 21 days is not a breach (47 exceed, 56 are ≥ 21) |
| SLA breach rate | exceeding / deliveries | deliveries over 21 days | **all** deliveries in scope | low-n guard |
| Delay reason breakdown | tally | deliveries with a recorded reason | all deliveries in scope (for `share`) | the 88 deliveries with no reason are **not** assumed on time; `withDelayReason` (72) is reported separately |

---

## Loss analysis — `lib/analytics/lossAnalysis.ts`

| Metric | Formula | Numerator | Denominator | Edge-case rule |
|---|---|---|---|---|
| Lost count / value | count / sum | lost leads and their `deal_value` | — | 0 for an empty scope |
| Stage before loss | last **non-`lost`** entry in `status_history` | leads dying at that stage | all lost leads (for `share`) | a lead whose only entry is the loss is attributed to `new`; ordered by funnel position |
| Loss reason | tally of `lost_reason` | leads with that reason | all lost leads (for `share`) | the **14** leads with no reason are reported under `unspecified` (`reason: null`), never dropped or reassigned; sorted by frequency with unspecified last |

The 14 unspecified leads are exactly the reconciled ones — the same records
whose history lacked a terminal `lost` entry also carry no `lost_reason`.

---

## Lead source — `lib/analytics/sources.ts`

| Metric | Formula | Numerator | Denominator | Edge-case rule |
|---|---|---|---|---|
| Leads per source | count | leads with that `source` | — | sorted by volume, descending |
| Source win rate | delivered / leads | delivered leads from the source | all leads from the source | low-n guard |
| Average deal value | mean | `deal_value` of **all** leads from the source | count of all leads from the source | `null` for an empty source. Deliberately not delivered-only: it describes the buyer the channel attracts, which is what a spend decision turns on |
| Average delivered deal value | mean | `deal_value` of delivered leads | delivered leads | reported separately, `null` when nothing delivered |

---

## Cohorts and activity — `lib/analytics/cohorts.ts`

Two series that must never be conflated.

| Metric | Formula | Numerator | Denominator | Edge-case rule |
|---|---|---|---|---|
| Leads created (cohort) | count by `created_at` month | leads created in month M | — | the cohort series |
| Cohort delivered | count | leads **created in M** that have since delivered | — | attributed to the creation month, regardless of when delivery happened |
| Conversion to date | delivered / created | cohort leads delivered so far | cohort size | low-n guard. Meaningless for an immature cohort — check `isMature` first |
| `isMature` | `daysSinceMonthEnd >= 37` | — | — | 37 = median lead-to-delivery cycle. **False for Nov and Dec 2025** |
| `daysSinceMonthEnd` | `floor((NOW − end of month M) / 1 day)` | — | — | negative for a month still running (December is −1 at NOW) |
| Deliveries (activity) | count by `delivery_date` month | deliveries occurring in month M | — | the **activity** series — a different question with a different shape |

**The cohort trap.** December shows 75 leads created and 1 delivered, while
52 deliveries *happened* in December. December is not a collapse: against a
37-day median cycle, a lead created in December cannot have delivered yet.
Any cohort chart must surface `isMature`, and immature points must not be read
as a performance signal.

---

## Targets — `lib/analytics/targets.ts`

| Metric | Formula | Numerator | Denominator | Edge-case rule |
|---|---|---|---|---|
| Unit attainment | delivered / target units | delivered units | target units in scope | `null` when the target is 0 — never divide by zero |
| Revenue attainment | delivered revenue / target revenue | `deal_value` of delivered leads | target revenue in scope | `null` when the target is 0 |
| Relative index | (branch attainment / group attainment) × 100 | branch revenue attainment | group revenue attainment | **100 = typical for this group**; `null` if either side is undefined |
| Monthly attainment | per month | deliveries in that **delivery** month | that month's target | uses the activity series, not the creation cohort |
| `targetsAreMisBaselined` | constant `true` | — | — | surfaced so the UI carries the caveat rather than hard-coding it |

**Why attainment is not a primary KPI.** The group targeted 1,426 units and
delivered 160 — attainment of 11.2% on units, 12.4% on revenue. A number that
low across *every* branch says the targets were set on a different basis, not
that every branch failed. Attainment is computed and displayed, but it must
never drive red/critical styling, and `relativeIndex` is the honest comparison.

---

## Formatting — `lib/format.ts`

The only module that turns numbers into strings.

| Function | Behaviour |
|---|---|
| `formatCurrency` | `₹38.88 Cr` ≥ 1 crore · `₹24.44 L` ≥ 1 lakh · `₹42,000` below |
| `formatCurrencyExact` | exact rupees, Indian 2,2,3 grouping: `₹7,50,000` |
| `formatNumber` | Indian grouping: `1,426` |
| `formatCompactNumber` | counts, no ₹: `1.4K`, `2.5 L`, `1.2 Cr` |
| `formatRate` | percentage, or `—` when the low-n guard suppressed the rate |
| `formatPercentValue` | `45.7%` from a fraction |
| `formatSignedPercent` | `+12.5%` / `-3.0%`, or `—` |
| `formatDurationDays` | `195 days`, `1 day` |
| `formatDurationHours` | `18 hours`, promoted to days past 48h |
| `formatMonthKey` | `2025-06` → `Jun 2025` |

Colour is semantic: red is reserved for money at risk (stalled orders, aging
pipeline), never for "below target".

---

## Known disagreement with VERIFY.md

The verification gate (`npm run verify`) reproduces **163 of 164** figures.
One check fails, and it is left failing on purpose.

| Check | VERIFY.md | This codebase |
|---|---|---|
| `walk_in` average deal value | ₹24.99 L | ₹25.00 L |

**Diagnosis — a display-rounding inconsistency in VERIFY.md, not a computation
difference.** The exact mean is `₹349,960,000 / 140 = ₹24,99,714.29`, i.e.
24.997143 lakh. The two figures differ by ₹714 of rounding, not by any
difference in what was computed; the underlying metric is asserted exactly in
`tests/sources.test.ts`.

Reaching 24.99 L requires **truncating** at two decimals. VERIFY.md's other
five source rows are all **half-up rounded**, and truncation contradicts every
one of them:

| Source | Exact (L) | Half-up | Truncated | VERIFY.md |
|---|---|---|---|---|
| website | 22.0770 | 22.08 ✓ | 22.07 ✗ | 22.08 |
| referral | 22.3988 | 22.40 ✓ | 22.39 ✗ | 22.40 |
| auto_expo | 25.2372 | 25.24 ✓ | 25.23 ✗ | 25.24 |
| social_media | 27.1736 | 27.17 ✓ | 27.17 ✓ | 27.17 |
| phone_enquiry | 24.4444 | 24.44 ✓ | 24.44 ✓ | 24.44 |
| **walk_in** | **24.9971** | **25.00** | **24.99** | **24.99** |

No single convention reproduces all six rows. Half-up matches five; truncation
matches three. This codebase rounds half-up everywhere, and the walk_in figure
in VERIFY.md is inconsistent with its own table.

Per the project rules, `VERIFY.md` has not been edited and the code has not
been tuned to force a match.

### A convention VERIFY.md pinned

Cycle-time **p90 = 50 days** disambiguated the percentile convention. Every
median in VERIFY.md (1 / 5 / 3 / 8 / 17 dwell, 37 cycle, 17 delivery leg) is
reproduced by *all* common percentile methods, so medians alone do not
constrain the choice. Only p90 distinguishes them: linear interpolation
(numpy's default) yields 48.2 and nearest-rank yields 48, while the
order-statistic convention yields exactly 50. That fixed the choice documented
above, and it applies uniformly to every percentile in the codebase.
