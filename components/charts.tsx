/**
 * Charts.
 *
 * Built from the design tokens rather than a charting library, so density,
 * palette and dark mode stay consistent with everything else. Each form is
 * single-series or focus-vs-context, so no categorical palette is involved and
 * identity is never carried by colour alone.
 *
 * Hover is provided by native `<title>` on each mark, which works without
 * client JavaScript and is announced by screen readers. Every chart is also
 * backed by visible labels or an adjacent table, so nothing is hover-only.
 */

import { formatCurrency, formatNumber, formatPercentValue } from '@/lib/format';
import { pct } from '@/components/ui';

export interface TrendPoint {
  label: string;
  shortLabel: string;
  value: number;
}

/**
 * Change over time: a single measure, area + line, with a value axis and
 * labelled endpoints. Bars would imply discrete comparison; a line reads as
 * continuity, which is what a monthly revenue series is.
 */
export function TrendChart({
  points,
  title,
  valueLabel,
  format = 'currency',
  height = 168,
}: {
  points: TrendPoint[];
  title: string;
  valueLabel: string;
  format?: 'currency' | 'number';
  height?: number;
}) {
  if (points.length < 2) return null;

  const width = 640;
  const padL = 8;
  const padR = 8;
  const padT = 14;
  const padB = 22;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const max = Math.max(...points.map((p) => p.value));
  const niceMax = max > 0 ? max * 1.12 : 1;
  const x = (i: number) => padL + (i * plotW) / (points.length - 1);
  const y = (v: number) => padT + plotH - (v / niceMax) * plotH;

  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${padL},${padT + plotH} ${line} ${padL + plotW},${padT + plotH}`;
  const fmt = (v: number) => (format === 'currency' ? formatCurrency(v) : formatNumber(v));

  const gridLines = [0.5, 1];
  const peakIndex = points.reduce((best, p, i) => (p.value > points[best].value ? i : best), 0);

  return (
    <figure style={{ margin: 0 }}>
      <figcaption className="sr-only">
        {title}. {valueLabel} by month, from {points[0].label} to {points[points.length - 1].label}.
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`${title}: ${points.map((p) => `${p.label} ${fmt(p.value)}`).join(', ')}`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {gridLines.map((g) => (
          <g key={g}>
            <line
              x1={padL}
              x2={padL + plotW}
              y1={y(niceMax * g)}
              y2={y(niceMax * g)}
              stroke="var(--c-grid)"
              strokeWidth="1"
            />
            <text
              x={padL}
              y={y(niceMax * g) - 4}
              fill="var(--ink-3)"
              fontSize="10"
              fontFamily="var(--mono)"
            >
              {fmt(niceMax * g)}
            </text>
          </g>
        ))}

        <polygon points={area} fill="var(--c-focus)" opacity="0.10" />
        <polyline points={line} fill="none" stroke="var(--c-focus)" strokeWidth="2" strokeLinejoin="round" />

        {points.map((p, i) => (
          <g key={p.label}>
            {/* Generous invisible hit area so the tooltip is easy to catch. */}
            <rect
              x={x(i) - plotW / (points.length * 2)}
              y={padT}
              width={plotW / points.length}
              height={plotH}
              fill="transparent"
            >
              <title>{`${p.label}: ${fmt(p.value)}`}</title>
            </rect>
            <circle
              cx={x(i)}
              cy={y(p.value)}
              r={i === points.length - 1 || i === peakIndex ? 4 : 2.6}
              fill="var(--c-focus)"
              stroke="var(--surface)"
              strokeWidth="2"
            >
              <title>{`${p.label}: ${fmt(p.value)}`}</title>
            </circle>
            <text
              x={x(i)}
              y={height - 6}
              textAnchor="middle"
              fill="var(--ink-3)"
              fontSize="10"
              fontFamily="var(--mono)"
            >
              {p.shortLabel}
            </text>
          </g>
        ))}

        {/* Direct-label the endpoint only — a number on every point is noise. */}
        <text
          x={x(points.length - 1)}
          y={y(points[points.length - 1].value) - 10}
          textAnchor="end"
          fill="var(--ink)"
          fontSize="11"
          fontWeight="600"
          fontFamily="var(--mono)"
        >
          {fmt(points[points.length - 1].value)}
        </text>
      </svg>
    </figure>
  );
}

export interface RankedBar {
  key: string;
  label: string;
  value: number;
  secondary?: string;
  focus?: boolean;
}

/**
 * Magnitude across a handful of named things: horizontal bars, sorted, direct
 * labelled. One hue — length carries the comparison, colour carries nothing.
 */
export function RankedBars({
  rows,
  format = 'currency',
  maxOverride,
}: {
  rows: RankedBar[];
  format?: 'currency' | 'number' | 'percent';
  maxOverride?: number;
}) {
  if (rows.length === 0) return null;
  const max = maxOverride ?? Math.max(...rows.map((r) => r.value), 1);
  const fmt = (v: number) =>
    format === 'currency' ? formatCurrency(v) : format === 'percent' ? formatPercentValue(v) : formatNumber(v);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((row) => (
        <div key={row.key}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
            <span className="t-small" style={row.focus ? { color: 'var(--ink)', fontWeight: 600 } : undefined}>
              {row.label}
            </span>
            <span className="num" style={{ fontSize: 12.5, fontWeight: row.focus ? 600 : 400 }}>
              {fmt(row.value)}
              {row.secondary ? <span className="dim"> · {row.secondary}</span> : null}
            </span>
          </div>
          <div className="bar-track" style={{ height: 10 }}>
            <div
              className="bar-fill"
              style={{
                width: pct(row.value / max),
                background: row.focus ? 'var(--c-focus)' : 'var(--c-seq-3)',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Two measures across the same entities, plotted against each other.
 * Used for volume against value, where the interesting cases are the corners.
 */
export function ScatterPlot({
  points,
  xLabel,
  yLabel,
  height = 220,
}: {
  points: { key: string; label: string; x: number; y: number; focus?: boolean }[];
  xLabel: string;
  yLabel: string;
  height?: number;
}) {
  if (points.length === 0) return null;
  const width = 520;
  const padL = 52;
  const padR = 16;
  // Room above the plot for the y-axis title, which sits horizontally there
  // rather than rotated beside the ticks — rotated, it collided with them.
  const padT = 28;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxX = Math.max(...points.map((p) => p.x)) * 1.15;
  const maxY = Math.max(...points.map((p) => p.y)) * 1.15;
  const sx = (v: number) => padL + (v / maxX) * plotW;
  const sy = (v: number) => padT + plotH - (v / maxY) * plotH;

  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`${yLabel} against ${xLabel}. ${points
          .map((p) => `${p.label}: ${formatNumber(p.x)} and ${formatCurrency(p.y)}`)
          .join('. ')}`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <line x1={padL} x2={padL} y1={padT} y2={padT + plotH} stroke="var(--c-grid)" strokeWidth="1" />
        <line
          x1={padL}
          x2={padL + plotW}
          y1={padT + plotH}
          y2={padT + plotH}
          stroke="var(--c-grid)"
          strokeWidth="1"
        />

        {/* Tick values, so the axes carry magnitude rather than only direction. */}
        {[0.5, 1].map((t) => (
          <text
            key={`y${t}`}
            x={padL - 6}
            y={sy(maxY * t) + 3}
            textAnchor="end"
            fill="var(--ink-3)"
            fontSize="9.5"
            fontFamily="var(--mono)"
          >
            {formatCurrency(maxY * t)}
          </text>
        ))}
        {[0.5, 1].map((t) => (
          <text
            key={`x${t}`}
            x={sx(maxX * t)}
            y={padT + plotH + 13}
            textAnchor="middle"
            fill="var(--ink-3)"
            fontSize="9.5"
            fontFamily="var(--mono)"
          >
            {formatNumber(Math.round(maxX * t))}
          </text>
        ))}

        {points.map((p) => (
          <g key={p.key}>
            <circle
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={p.focus ? 7 : 5.5}
              fill={p.focus ? 'var(--c-focus)' : 'var(--c-context)'}
              stroke="var(--surface)"
              strokeWidth="2"
            >
              <title>{`${p.label}: ${formatNumber(p.x)} leads, ${formatCurrency(p.y)} average`}</title>
            </circle>
            <text
              x={sx(p.x)}
              y={sy(p.y) - 11}
              textAnchor="middle"
              fill={p.focus ? 'var(--ink)' : 'var(--ink-2)'}
              fontSize="10"
              fontWeight={p.focus ? 600 : 400}
            >
              {p.label}
            </text>
          </g>
        ))}

        <text x={padL + plotW} y={height - 6} textAnchor="end" fill="var(--ink-3)" fontSize="10">
          {xLabel} →
        </text>
        <text x={0} y={10} textAnchor="start" fill="var(--ink-3)" fontSize="10">
          ↑ {yLabel}
        </text>
      </svg>
    </figure>
  );
}
