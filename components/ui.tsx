/**
 * Shared presentational primitives.
 *
 * These render values the analytics layer already computed. None of them
 * contains business logic — no thresholds, no arithmetic beyond turning a
 * fraction into a bar width.
 */

import { formatPercentValue } from '@/lib/format';
import type { Rate } from '@/lib/types';

/** Clamp a fraction to a CSS percentage string. */
export function pct(fraction: number): string {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
  return `${(clamped * 100).toFixed(2)}%`;
}

/**
 * A guarded rate. Renders the low-n placeholder rather than a percentage
 * whenever the analytics layer suppressed the value.
 */
export function RateText({
  rate,
  decimals = 1,
  className,
}: {
  rate: Rate;
  decimals?: number;
  className?: string;
}) {
  if (rate.value === null) {
    return (
      <span
        className={className ?? 'dim'}
        title={`Too few leads to show a rate — ${rate.n} in this selection`}
      >
        —
      </span>
    );
  }
  return <span className={className}>{formatPercentValue(rate.value, decimals)}</span>;
}

/** Signed delta in percentage points, coloured only when it is meaningful. */
export function DeltaPoints({ points, invert = false }: { points: number | null; invert?: boolean }) {
  if (points === null) return <span className="dim">—</span>;
  const rounded = Math.abs(points) < 0.05 ? 0 : points;
  const good = invert ? rounded < 0 : rounded > 0;
  const tone = rounded === 0 ? 'dim' : good ? 'pos' : 'crit';
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
  return (
    <span className={tone}>
      {sign}
      {Math.abs(rounded).toFixed(1)}
    </span>
  );
}

/** Severity/status glyph. Shape carries meaning so colour is never alone. */
export function Glyph({ kind }: { kind: 'critical' | 'warning' | 'info' }) {
  if (kind === 'info') {
    return (
      <svg className="glyph" viewBox="0 0 8 8" aria-hidden="true" focusable="false">
        <circle cx="4" cy="4" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    );
  }
  return (
    <svg className="glyph" viewBox="0 0 8 8" aria-hidden="true" focusable="false">
      <path d="M4 0 L8 8 L0 8 Z" fill="currentColor" />
    </svg>
  );
}

/**
 * The delta rail: benchmark tick, value mark, optional focus emphasis.
 * `value` and `benchmark` are fractions of `scale`.
 */
export function Rail({
  value,
  benchmark,
  scale,
  focus = false,
  label,
}: {
  value: number;
  benchmark?: number;
  scale: number;
  focus?: boolean;
  label?: string;
}) {
  const safeScale = scale > 0 ? scale : 1;
  return (
    <div className="rail" role="img" aria-label={label}>
      <div className="rail-track" />
      {focus ? <div className="rail-fill is-focus" style={{ width: pct(value / safeScale) }} /> : null}
      {benchmark !== undefined ? (
        <div className="rail-bench" style={{ left: pct(benchmark / safeScale) }} />
      ) : null}
      <div
        className={focus ? 'rail-mark is-focus' : 'rail-mark'}
        style={{ left: pct(value / safeScale) }}
      />
    </div>
  );
}

/** Horizontal magnitude bar, single hue. */
export function Bar({
  value,
  max,
  color = 'var(--c-seq-4)',
  height = 10,
}: {
  value: number;
  max: number;
  color?: string;
  height?: number;
}) {
  return (
    <div className="bar-track" style={{ height }}>
      <div className="bar-fill" style={{ width: pct(max > 0 ? value / max : 0), background: color }} />
    </div>
  );
}

/** A polyline sparkline. Values are plotted in order; the last point is marked. */
export function Sparkline({
  values,
  width = 64,
  height = 20,
  color = 'var(--c-focus)',
  label,
}: {
  values: readonly number[];
  width?: number;
  height?: number;
  color?: string;
  label: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values
    .map((value, index) => {
      const x = index * stepX;
      const y = height - 1 - ((value - min) / span) * (height - 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  const lastX = width;
  const lastY = height - 1 - ((values[values.length - 1] - min) / span) * (height - 2);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.4" fill={color} />
    </svg>
  );
}

/** Micro bar chart used inside a vital sign cell. */
export function MicroBars({
  values,
  width = 64,
  height = 20,
  color = 'var(--critical)',
  label,
}: {
  values: readonly number[];
  width?: number;
  height?: number;
  color?: string;
  label: string;
}) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const slot = width / values.length;
  const barWidth = Math.max(2, slot - 3);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      {values.map((value, index) => {
        const barHeight = Math.max(1, (value / max) * height);
        return (
          <rect
            key={index}
            x={index * slot}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            fill={color}
            opacity={1 - index * (0.6 / Math.max(1, values.length - 1))}
          />
        );
      })}
    </svg>
  );
}

/** The low-n badge. */
export function LowN({ n, note }: { n: number; note?: string }) {
  return (
    <span className="lown">
      <Glyph kind="info" />
      {note ?? `Only ${n} ${n === 1 ? 'lead' : 'leads'} — too few to show a rate`}
    </span>
  );
}

/** A panel that could not be computed. Contained, never page-level. */
export function ModuleError({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="module-err">
      <span className="warn" style={{ marginTop: 4, flex: 'none' }}>
        <Glyph kind="warning" />
      </span>
      <div style={{ flex: 1 }}>
        <p className="t-small" style={{ color: 'var(--ink)', fontWeight: 600 }}>
          {title}
        </p>
        <p className="t-small" style={{ marginTop: 3 }}>
          {detail}
        </p>
      </div>
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  aside,
  footer,
  padded = true,
  className,
  children,
}: {
  title?: string;
  subtitle?: string;
  aside?: React.ReactNode;
  footer?: React.ReactNode;
  padded?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className ? `panel ${className}` : 'panel'}>
      {title ? (
        <header className="panel-hd">
          <div>
            <h2 className="t-h2">{title}</h2>
            {subtitle ? (
              <p className="t-micro" style={{ marginTop: 2 }}>
                {subtitle}
              </p>
            ) : null}
          </div>
          {aside}
        </header>
      ) : null}
      {padded ? <div className="panel-bd">{children}</div> : children}
      {footer ? <footer className="panel-ft">{footer}</footer> : null}
    </section>
  );
}
