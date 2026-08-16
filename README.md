# DealerPulse

Sales performance for a five-branch Toyota dealership group in India.
Built for one user: the group CEO, who opens it for ninety seconds between
meetings and needs to leave with a sentence he can act on.

**Live:** https://dealer-pulse-ecru.vercel.app/

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

## Checks

```bash
npm run verify     # types, lint, and the 33 baseline assertions
npm run audit      # browser checks: layout, contrast, targets, structure
```

`verify` recomputes every headline figure straight from the raw JSON and
compares it against what the analytics layer produces, so a change that moves a
number fails immediately.

`audit` builds the app, serves it, and drives a real browser over 32 views at
four widths in both themes. It checks horizontal overflow, hydration errors,
invalid nesting, table column alignment, WCAG target sizes, measured colour
contrast, SVG paint order, text integrity and page structure.

Playwright is deliberately **not** a dependency, because its install downloads
around 150MB of browsers that a production build never needs. Install it only
when you want to run the audit:

```bash
npm i -D playwright && npx playwright install chromium
npm run audit
```

Point the audit at a deployed URL instead of building locally:

```bash
AUDIT_URL=https://your-deployment.vercel.app npm run audit -- --no-build
```

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

Press <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>K</kbd> anywhere to jump to any
branch, person, vehicle or screen, and <kbd>?</kbd> for the shortcut list.
Active filters appear as chips that can be removed one at a time, views can be
saved per browser, and every screen has a print layout for a board pack.

Add `?as=<branchId>` (for example `/branch/B3?as=B3`) to view as that branch's
manager: navigation retargets to their branch and every queue is scoped to it.

The first four are in the top navigation on every screen. A lead opens as a
drawer over any screen via `?lead=L0022`. Filters live in the URL, so any view is
shareable and survives navigation.

Light and dark themes follow the system setting and can be overridden with the
toggle in the top bar.

## Structure

```
app/            routes (server components) + design tokens in globals.css
scripts/audit/  browser checks run by `npm run audit`
tests/          the frozen baseline suite run by `npm test`
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
