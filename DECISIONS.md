# DECISIONS.md

## What I built, and why

**A product that states a conclusion, then shows its working.**

The brief says the user is a dealership CEO. So I built for one specific
behaviour: he opens this for ninety seconds between meetings, and what he needs
to leave with is a sentence he can repeat to a branch manager on a phone call.

That ruled out the obvious shape — six KPI tiles and a chart grid — because it
makes the reader assemble the finding themselves. Instead the screen opens with
a **verdict**: one generated sentence, in large type, naming the problem, the
money, and one action.

> Lakeside converts 7.6% of its leads where the group converts 31.4% — and the
> break is at the first step: 42% of Lakeside leads are never called.

Everything below it exists so a sceptical reader can check that sentence in two
clicks. The verdict is **derived, not written**: the code finds the branch
furthest below the group, then finds the funnel step where it loses the most
leads *relative to what its peers would have converted*. Change the filters and
the sentence recomputes.

### The screens

| Screen | Job |
|---|---|
| **Overview** | The verdict, five vital signs, the revenue trend, the forecast, and the evidence for the claim |
| **Act now** (Action Center) | A prioritised work queue. If it is cleared, the business improves |
| **Leads** | Every one of the 510 rows behind every aggregate — searchable, sortable, exportable |
| **Vehicles** | Where attention goes versus where the money is |
| **Branch** | Diagnosis. A funnel drawn twice — actual, and the same leads at peer rates |
| **Rep** | A scorecard usable in a 1:1 without being a firing document |
| **Lead** | The full journey, with every gap measured against its median |

The four screens a CEO uses sit in a persistent top navigation, with a live
count on **Act now**. Before that existed, the Action Center — the screen this
product argues is the most valuable — was reachable only by scrolling to the
bottom of the Overview. That was the single worst usability defect in the build,
and it was invisible to me until I tried to use the thing rather than look at it.

## Key product decisions and tradeoffs

**The headline states two figures, because merging them was a 10× lie.** Closing
Lakeside's gap to peer rates *across the whole funnel* is worth ₹3.95–5.52 Cr.
Fixing first contact *alone*, holding the branch's own downstream conversion, is
worth ₹0.40–0.56 Cr. An earlier version of this product printed the first number
in the sentence about the second — an external audit caught it, and it was the
single worst error here: the one sentence a CEO actually reads was the one place
the discipline broke. Both numbers now come from `computeWhatIf`, the same
function the simulator calls, so the two screens cannot drift apart again.

**Recoverable value is a range, not a point.** Pricing recovered leads at the
branch's *delivered* mix (₹17.78 L) gives ₹3.95 Cr; pricing them at the mean
across all its leads (₹24.83 L) gives ₹5.52 Cr. Both bases are defensible —
recovered leads come from the general pool, but this branch has only ever
delivered the cheaper end of it. Quoting only the higher one was silently
picking the flattering base, which is exactly what every other number here is
guarded against.

**Rank funnel steps by leads lost, not by percentage-point gap.** Lakeside's
widest gap is `test_drive → negotiation` at −29 points. But that step operates on
27 leads, while the first step operates on 79. Ranking by points would have
pointed the CEO at the wrong problem. Ranking by *leads lost relative to peers*
puts first contact at the top, where it belongs — 17 leads more than peers would
have lost.

**Red is reserved for money at risk, and nothing else.** Group attainment is
12.4%. If red meant "below target", every branch would be red on every screen and
the colour would stop meaning anything within one session. It is spent only on
the ₹8.59 Cr of orders paid for and never delivered.

**Targets are shown, then disarmed.** The seven-month target is 1,426 units and
only 510 leads exist. Even if every single lead converted the group could deliver
510 — the target is 2.8× total lead volume and is arithmetically unreachable.
Hiding that would be dishonest; leading with the percentage would train the CEO
to ignore a vital sign. So the panel leads with the planning defect, marks the
ceiling with a black tick, and drives no health signal anywhere in the product.

**"Never called: 119" is labelled with its split.** Sitting beside "Money at
risk", a bare count reads as a work queue. It is not one: 114 of those leads are
already lost and only 5 are still callable. The card now says so. Likewise "win
rate" became "leads that became a sale", with the denominator printed under it —
a win rate hides what it is a rate *of*.

**There is no separate "overdue" queue, and the reason is in the data.** 31 open
leads are past the close date their own rep predicted, worth ₹6.89 Cr — an
obvious queue, until you check the overlap: 30 of the 31 are stalled orders
already sitting in a more urgent queue. A standalone tab would have been the
same rows a second time. So the breach became an *attribute*: the stalled queue
now reports "30 of 38 past the promised date · ₹6.80 Cr already promised to a
customer", each row states how many days late it is against that promise, and
the single non-stalled lead joins the at-risk queue.

**The trend chip is month-on-month, not first-to-last.** "+276.4% since July" was
trough-to-peak on a six-point series — chosen by whichever month happened to be
lowest, and the loudest element on the card. It now reads "+54.6% vs last month",
with the honest context underneath: December is 2.6× the median of the earlier
months.

**The cold-leads queue ships with one row, not thirty-five.** Thresholds are
derived from each stage's actual dwell median rather than round numbers. A flat
seven-day rule surfaces 35 open leads — but 32 are stalled orders already in
their own queue, and two more are still inside the normal window for their stage.
It would have been easy to ship "35" and look busier. A queue that inflates
itself is one people stop opening.

**The what-if leads with its least flattering number.** Raising Lakeside's
first-contact rate to the group's 80%, holding its own downstream conversion,
yields **+2 deliveries and ₹0.56 Cr**. Applying peer conversion downstream too
yields **+22 and ₹5.5 Cr**. The second needs the whole funnel fixed, not just the
phone calls, so it sits in the assumption block clearly labelled. A simulator
that shows its best case first is a sales tool, not an instrument.

**The forecast reports a range, and says why it is a range.** Weighting the 62
open leads by how each stage has actually converted in this period gives ₹9.88 Cr
expected. But 38 of those leads are orders already paid for and never delivered,
worth ₹8.59 Cr — 74% of the total. Treating them as likely to complete produces
the upper figure; excluding them entirely produces ₹2.94 Cr. Both are shown, with
the reason stated above the number. A single point estimate here would have been
a lie dressed as precision. As a coherence check: P(deliver | new) works out to
0.3137, which is exactly the company's 160/510 win rate.

**Movement, not only level.** Every other module answers "how much"; a reader
could not tell a business that is recovering from one that is sliding. A
"What changed last month" strip compares the last complete month to the one
before it across four measures, and states how many months of delivery work the
open pipeline represents at the trailing median pace. A *median*, not a mean —
December is nearly three times the median month, and a mean would let that one
month set the expectation for every future one.

**A branch manager gets a different first screen.** The brief names two
audiences. A manager landing on a group-wide indictment of somebody else's branch
has been shown something they cannot act on. `?as=<branchId>` retargets
navigation to their own branch, scopes every queue to it, and is authoritative
rather than decorative — the scope applies even if the branch parameter is
missing from the URL.

**A branch filter on a branch route was a trap.** `/branch/B3?branch=B1` asked
for B1's leads inside B3, rendered "0 of 510 leads", and the recovery link
carried the conflict forward — the escape hatch didn't escape. The branch axis is
now discarded on arrival at any route already scoped to a branch, and the control
in its place *navigates* to the branch instead of filtering within it.

**Targets read as a planning defect, not a low score.** 12.4% attainment invites
the conclusion that the group is failing. The real finding is that the target is
2.8× total lead volume and unbuildable at any performance level. The defect now
leads the panel and the percentage follows it.

**Filters live in the URL.** They survive navigation into a drill-down, they are
shareable as a link, and they let the server compute the page — so the 620 KB
dataset never reaches the browser. Page JavaScript is **1.15 kB** on the Overview
and 4.78 kB on the Action Center, the only screen with real client state.

**Server components by default.** Only three client components exist, each for
behaviour static markup cannot provide: the lead drawer (Escape/backdrop), queue
selection, and the what-if slider. Filter menus are native `<details>` elements
containing links, so filtering works with no client JavaScript at all.

**Rates below n=10 are withheld.** Two of four leads converting is not 50%. Every
rate in the product returns `{ value: null, reason: 'insufficient_data' }` below
the threshold and renders as an em dash. This is enforced in the analytics layer,
not in components — a rule I had to re-apply after review caught a component
dividing two counts itself and rendering "100%" off a single lost lead.

**Queue actions are honest about persistence.** They apply optimistically and
save to `localStorage`, and an amber strip says exactly that: there is no
write-back to a dealer management system. Pretending otherwise is how a tool
gets switched off after the first Monday.

## Interesting patterns in the data

**Lakeside's failure is systemic, not individual.** Its five sales officers hold
the five lowest win rates in the company — and the sixth-placed rep sits 9.7
points clear of the best of them. Five people do not independently arrive at the
bottom of a 25-person distribution. The product proves this with a distribution
strip rather than asserting it.

**The branch manager holds zero leads.** Rahul Patel is assigned no pipeline —
and so is every other branch manager. It is a structural choice, but it means
nobody in the branch carries a book against which a manager's own follow-up
discipline could be measured. Surfaced as a finding on the branch header.

**One order was paid for 195 days ago and never delivered.** Lead L0022, Omkar
Varma, ₹50.5 L Camry. The salesperson's own note reads *"Full payment received."*
Normal order-to-delivery is 17 days. That single record is the strongest argument
in the dataset for the Action Center existing, and the timeline deforms around it
rather than flagging it with a badge.

**68% of lost deals die before anyone sits in a car.** 114 of 288 were never
contacted at all. This is a response problem, not a closing problem — which is
what makes "42% never called" the right headline rather than a conversion-skills
narrative.

**Social media brings the most valuable buyer and converts them worst.** Highest
average deal value at ₹27.17 L, lowest win rate at 13.9%. Either the leads are
unqualified or nobody is calling them back — and given the finding above, the
second is worth checking first.

**The car people ask about is not the car that pays.** Glanza draws 130 leads and
earns ₹3.97 Cr. Fortuner draws 94 and earns ₹12.61 Cr — 3.2× the revenue on 36
fewer enquiries. The top three vehicles produce 65% of delivered revenue. This is
the largest dimension in the dataset that no summary metric touches, which is why
it got its own screen.

**Rep tenure explains nothing.** I checked whether hire date predicted win rate
before writing the Lakeside conclusion, because "the branch hired badly" would
have been a competing explanation. It does not correlate. Reporting a non-finding
matters here: it is what rules out the alternative story.

**Speed is not Lakeside's problem.** It is 1–2 days slower than the group at
every stage — never dramatically. That is what licenses the conclusion that the
problem is *starting*, not *moving*.

**Two data defects, admitted rather than hidden.** 14 lead records have a status
that never appears in their own history; the loader reconstructs the terminal
event and every screen carries an inspectable "14 records reconciled" marker. And
one status note contains an unrendered `{}` template placeholder, which the lead
drawer highlights rather than printing as if intentional.

**December is not a collapse.** 75 leads created, 1 delivered. Against a 37-day
median cycle, a December lead cannot have delivered yet. Cohort series carry an
`isMature` flag so that shape is never read as performance.

## What I would build next

1. **Write-back.** The queue's actions are the product's whole point and they
   currently stop at the browser. Assignment, snooze and contact need to reach the
   DMS before this is worth opening twice.
2. **Rep coaching view.** The rep screen diagnoses. It does not yet say what to do
   on Monday, which is what a branch manager actually needs from it.
3. **A real time-range picker.** Presets cover the dataset, but a custom range and
   period-over-period comparison across arbitrary windows is the obvious next step.
4. **Anomaly detection on intake.** Never-contacted counts rise every month from
   11 in June to 23 in November. Nobody was watching that line; something should
   be.
5. **Scheduled digests.** The verdict is a sentence. A sentence can be emailed on
   Monday morning, which is a better delivery mechanism than hoping the CEO opens
   a tab.

## Trade-offs I accepted

- **No charting library.** Every visual is hand-built SVG or CSS against the
  design tokens. It cost time but kept the palette, density and dark mode
  consistent — and kept the bundle small enough to state in bytes.
- **The delivery-delays queue is the weakest of the three** and I would cut it
  before shipping. All 47 rows are already-delivered cars, so no row has a live
  next step. It is analysis wearing a queue's clothing. It stays for now because
  the delay causes are genuinely useful to the supply side.
- **Phone is supported, not designed.** The brief is desktop-first with tablet
  secondary, and that is where the layouts are composed. Below 960px wide tables
  fold their least load-bearing columns away rather than hiding them behind a
  horizontal scroll nobody discovers; below 768px the navigation takes its own
  row and every panel stacks. No screen from 360px up scrolls sideways. But a
  phone-native information design — one card at a time, thumb-reachable actions —
  is a different product and is not what this is.

## Verification

Numbers are asserted against a fixed expectations file rather than trusted:
326 unit tests across 20 files pin every published figure, the low-sample guard,
the percentile convention, and the whole-day duration rule. A separate end-to-end
pass renders every route under `next start` and asserts 50 rendered figures and
states — including the 404s, the empty-by-filter state, the n=1 case where every
rate must be withheld, and the filter-conflict case that used to render an empty
screen. Layout is measured, not eyeballed: all nine routes are checked for
horizontal overflow at fifteen viewport widths from 360px to 1920px. `NOW` is
pinned to 2025-12-31T19:10:00Z, so nothing in the product depends on when it is
run.

Two defects that survived my own review and were caught by an external audit are
worth naming, because both were failures of the same kind — the code was right
and the sentence around it was not:

1. The verdict quoted the whole-funnel recovery figure inside a sentence about
   first contact, overstating that lever roughly tenfold. The what-if simulator
   two clicks away stated it correctly the whole time.
2. `/branch/B3?branch=B1` rendered "0 of 510 leads" with a recovery link that
   preserved the contradiction.

Numbers being right is not the same as a product being right, and unit tests
cannot see the difference. That is why the end-to-end pass now asserts rendered
*sentences*, not only rendered figures.

One expected value does not reproduce and is documented rather than tuned away:
the walk-in source's delivered revenue computes to ₹25.00 L where the
expectations file says ₹24.99 L. Only truncation produces 24.99, and truncation
breaks three other rows in the same file. The expectations file is internally
inconsistent on that cell; the code is not adjusted to match it.
