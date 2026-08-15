# DealerPulse design system — "Ledger"

Three self-contained HTML documents. Open them directly in a browser; no build
step or network access is required (IBM Plex is embedded as woff2 data URIs).

| File | Covers |
|---|---|
| `01-system-overview.html` | Token spec (colour, type, space, radius, elevation, chart palette), the delta-rail idiom, Executive Overview at 1440 and 1024, filter bar resting/filtered |
| `02-drilldown.html` | Branch detail (1440, 768), the benchmark funnel in all states, rep detail, the zero-lead manager case, lead drawer, interaction model |
| `03-action-center.html` | Action Center (1440, 1024, 768), queue row states, severity rule, what-if simulator, states appendix, responsive spec, accessibility, shipping copy |

## Handoff

`src/tokens.css` and `src/app.css` are the real deliverable for an engineer.
They are plain CSS custom properties and component classes with no framework
dependency, and they define light and dark themes through three token blocks
(bare `:root`, `prefers-color-scheme`, and `[data-theme]`) so all three viewer
states resolve correctly.

## Rebuilding

`src/build.js` assembles a document from a body file plus the shared
stylesheets and the embedded fonts:

```
node src/build.js src/01-overview.body.html 01-system-overview.html
```

It expects `plex.css` alongside it — a generated file containing six
`@font-face` rules (IBM Plex Sans and Mono, weights 400/500/600) with the woff2
binaries inlined as base64.

## Data

Every figure in these documents is computed from `data/dealership_data.json`
by the analytics layer in `lib/analytics/`. Nothing is placeholder. Where a
brief figure disagreed with the data, the computed value is used and the
difference is stated on the page.
