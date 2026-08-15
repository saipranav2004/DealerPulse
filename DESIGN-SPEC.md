# DESIGN-SPEC.md — "Ledger"

The visual system the application implements. Tokens live in `app/globals.css`;
the annotated screen specs are in `docs/design/` (three self-contained HTML
documents). Nothing in the app hard-codes a colour, a font size or a spacing
value outside that stylesheet.

## Colour — 7 named values

| Token | Light | Dark | Rule |
|---|---|---|---|
| `--ink` | `#12161C` | `#E7EBEF` | Text and every data value. Never pure black. |
| `--ink-2` | `#59626E` | `#9AA5B1` | Labels, secondary prose, non-focus rows. |
| `--rule` | `#DDE2E7` | `#25303B` | Hairlines. The primary structural device — this system separates with rules, not cards or shadows. |
| `--accent` | `#0B5A8A` | `#4E9ACB` | Brand, focus series, links, primary button, active filter. One accent only. |
| `--positive` | `#106B44` | `#3FA97A` | A favourable delta against benchmark. Never "on target". |
| `--warning` | `#B36600` | `#C8841C` | Ageing past a dwell-median threshold. Second categorical chart slot. |
| `--critical` | `#A32A1E` | `#E0655A` | **Money at risk, and nothing else.** Never "below target". |

Neutrals are biased cool, toward the accent, rather than pure grey.

**Why red is rationed.** Group attainment is 12.4% against a target that exceeds
total lead volume. If red meant "below target", every branch would be red on
every screen and the colour would stop meaning anything. Red is reserved for
rupees already earned and not collected.

## Chart palette

Three jobs, no general-purpose categorical ramp:

- **Focus vs context** — `--c-focus` for the series under investigation,
  `--c-context` (neutral) for every other, `--c-bench` as a tick for the group
  benchmark. Identity is carried by lightness *and* hue, plus position and
  direct labels, so it survives colour blindness and greyscale.
- **Sequential** — `--c-seq-1` … `--c-seq-4`, one hue, light to dark, for
  magnitude.
- **Categorical** — exactly two slots, `#0B5A8A` and `#B36600`. This pair passes
  all six checks of the CVD validator in light and dark (ΔE 20.3 protan, 27.5
  normal vision). Dark mode re-steps to `#4E9ACB` / `#C8841C` and was
  re-validated against the dark surface, not flipped automatically.

Earlier candidates failed and were discarded: a desaturated set that read as
grey, and a green/amber pair at ΔE 5.6 under protanopia.

## Type

**IBM Plex Sans** for language, **IBM Plex Mono** for every numeral, loaded via
`next/font/local` from `app/fonts/`. Plex was drawn as an institutional
engineering face rather than a startup geometric, carries true tabular lining
figures, and has a Devanagari sibling for the Indian market.

Numerals use Mono rather than the sans's tabular figures: in a table of rupee
values across five branches, monospace guarantees alignment by construction.

| Class | Size / line | Weight | Use |
|---|---|---|---|
| `.t-verdict` | 30 / 38 | 600 | The verdict sentence |
| `.t-h1` | 21 / 26 | 600 | Screen title |
| `.t-h2` | 16 / 21 | 600 | Panel title |
| `.t-metric` | Mono 25 | 500 | Vital sign value |
| `.t-metric-s` | Mono 18 | 500 | Secondary metric |
| `.t-data` | Mono 12.5 | 400 | Table figures |
| `.t-body` | 13 / 20 | 400 | Prose |
| `.t-small` | 12 / 17 | 400 | Supporting text |
| `.t-label` | 11 caps, .045em | 500 | Field label |
| `.t-eyebrow` | 10 caps, .11em | 600 | Section marker |
| `.t-micro` | 11 | 400 | Footnote |

## Space, radius, elevation

4px base: `--s1` 4 through `--s9` 56. Row padding is s3 vertical / s4 horizontal;
panel gutters s4; page gutters s5. Rows are 30–34px, not 56px — this user
compares numbers.

Radius is near-square: `--r-sm` 2px (chips, buttons, inputs), `--r-md` 3px
(panels), `--r-lg` 4px maximum.

Elevation is not decoration. Panels get a 1px rule and no shadow. Shadow is
permitted on exactly two surfaces because they genuinely float: the lead drawer
(`--e-drawer`) and popovers (`--e-pop`).

## Signature element — the delta rail

A hairline track carrying the group benchmark as a tick, the entity's value as a
filled mark, and the gap printed as a signed tabular figure. It repeats in the
branch comparison, every funnel step, the rep benchmark and each queue row, so a
manager learns one shape and then reads the whole product. `<Rail>` in
`components/ui.tsx`.

## Breakpoints

| | 1440 (primary) | 1024 | 768 |
|---|---|---|---|
| Vital signs | 5 across | 4 across — "Never contacted" drops, the verdict already states it | 2 × 2 |
| Verdict | sentence + evidence rails side by side | evidence stacks below | sentence only |
| Queue row | 7 columns, one line | owner folds into meta, action becomes an icon | two-line block, actions on their own row |
| Rep table | 8 columns | 8 columns, tighter | horizontal scroll, name column pinned |
| Funnel | full | unchanged — it is the reason the screen exists | benchmark caption wraps under the percentage |
| Distribution strip | shown | shown | removed; needs width to show its gap |
| Touch targets | — | — | 44px minimum |

Tables scroll rather than becoming cards: the rep table exists to compare eight
numbers *across* five people, and cards destroy that comparison. Queue rows do
become blocks, because a queue row is read one at a time.

## Accessibility

Meaning is never carried by colour alone — money at risk also has a triangle
glyph and the word "risk"; ageing prints "11.5× normal"; the focus series takes a
larger mark and a bolder label; insufficient data gets a dashed border and the
words. Focus is a 2px accent outline at 2px offset on every interactive element.
`prefers-reduced-motion` cuts the skeleton shimmer, which is decorative.
