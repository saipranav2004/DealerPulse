# DealerPulse

Sales performance for a five-branch Toyota dealership group in India.
Built for one user: the group CEO, who opens it for ninety seconds between
meetings and needs to leave with a sentence he can act on.

**Live:** _add your Vercel URL here after deploying_

See [`DECISIONS.md`](./DECISIONS.md) for what was built and why.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm run build && npm start   # production build
```

Requires Node 18.18+ (Node 22 recommended).

## Deploy to Vercel

Zero configuration. Import the repository at
[vercel.com/new](https://vercel.com/new); the framework, build command and
output are detected automatically. No environment variables and no external
services — the dataset is a static JSON file imported at build time.

## Screens

| Route | Screen |
|---|---|
| `/` | Executive Overview — the verdict, vital signs, revenue trend, forecast |
| `/actions` | Action Center — three prioritised queues and the what-if simulator |
| `/leads` | Leads Explorer — all 510 rows, searchable, sortable, exportable |
| `/models` | Vehicles — where attention goes versus where the money is |
| `/branch/[id]` | Branch diagnosis — benchmark funnel, reps, cycle time, losses |
| `/rep/[id]` | Rep scorecard, with a stated finding for zero-lead managers |
| `/method` | How the verdict and every threshold is calculated |

The first four are in the top navigation on every screen. A lead opens as a
drawer over any screen via `?lead=L0022`. Filters live in the URL, so any view is
shareable and survives navigation.

Light and dark themes follow the system setting and can be overridden with the
toggle in the top bar.

## Structure

```
app/            routes (server components) + design tokens in globals.css
components/     presentational only — no business logic
lib/analytics/  every metric, as pure typed functions
lib/data.ts     loader: parses dates once, reconciles, builds indexes
data/           the dataset (510 leads, Jun–Dec 2025)
```

Every figure on screen is computed from `data/dealership_data.json` by
`lib/analytics/`. Nothing is hard-coded or mocked.

## Notes on the data

`NOW` is pinned to **31 Dec 2025**, the latest activity in the dataset — never
the wall clock, so figures do not drift. Fourteen records have a status missing
from their own history; the loader reconstructs the terminal event and every
screen carries an inspectable "14 records reconciled" marker. Rates computed on
fewer than ten leads are withheld rather than published.
