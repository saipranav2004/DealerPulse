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

### The five screens

| Screen | Job |
|---|---|
| **Overview** | The verdict, five vital signs, and the evidence for the claim |
| **Branch** | Diagnosis. A funnel drawn twice — actual, and the same leads at peer rates |
| **Rep** | A scorecard usable in a 1:1 without being a firing document |
| **Lead** | The full journey, with every gap measured against its median |
| **Action Center** | A prioritised work queue. If it is cleared, the business improves |

## Key product decisions and tradeoffs

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
only 510 leads exist. Even at a 100% win rate the group could deliver 510 — the
target is 2.8× total lead volume and is arithmetically unreachable. Hiding that
would be dishonest; leading with it would train the CEO to ignore a vital sign.
So it is rendered with a black tick marking the ceiling, and it drives no health
signal anywhere in the product.

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

**Filters live in the URL.** They survive navigation into a drill-down, they are
shareable as a link, and they let the server compute the page — so the 620 KB
dataset never reaches the browser. Page JavaScript is **527 B**.

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
2. **Forecasting on the open pipeline.** With 62 open leads and known stage
   conversion, a defensible month-end projection is reachable — and far more
   useful than the broken target it would replace.
3. **Rep coaching view.** The rep screen diagnoses. It does not yet say what to do
   on Monday, which is what a branch manager actually needs from it.
4. **A real time-range picker.** Presets cover the dataset, but a custom range and
   period-over-period comparison across arbitrary windows is the obvious next step.
5. **Anomaly detection on intake.** Never-contacted counts rise every month from
   11 in June to 23 in November. Nobody was watching that line; something should
   be.

## Trade-offs I accepted

- **No charting library.** Every visual is hand-built SVG or CSS against the
  design tokens. It cost time but kept the palette, density and dark mode
  consistent — and kept the bundle at 527 B per page.
- **The delivery-delays queue is the weakest of the three** and I would cut it
  before shipping. All 47 rows are already-delivered cars, so no row has a live
  next step. It is analysis wearing a queue's clothing. It stays for now because
  the delay causes are genuinely useful to the supply side.
- **Mobile below 768px is out of scope**, per the brief's desktop-and-tablet
  requirement. Layouts degrade gracefully but are not designed for it.
