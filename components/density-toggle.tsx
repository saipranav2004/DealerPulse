'use client';

/**
 * Row density, comfortable or compact.
 *
 * Two people use a screen like this very differently: a CEO reads eight rows
 * and wants them legible, an analyst scans eighty and wants them on one page.
 * Every serious data product lets that be a choice rather than picking a side.
 *
 * It sets `data-density` on the document element, so the whole product responds
 * from one attribute and no component needs to know the setting exists. Choice
 * is remembered per browser, the same as the theme.
 */

import { useCallback, useEffect, useState } from 'react';

type Density = 'comfortable' | 'compact';
const KEY = 'dp-density';

export function DensityToggle() {
  const [density, setDensity] = useState<Density>('comfortable');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch {
      /* Private mode. The default is fine. */
    }
    if (stored === 'compact' || stored === 'comfortable') {
      setDensity(stored);
      document.documentElement.setAttribute('data-density', stored);
    }
    setReady(true);
  }, []);

  const toggle = useCallback(() => {
    const next: Density = density === 'comfortable' ? 'compact' : 'comfortable';
    setDensity(next);
    document.documentElement.setAttribute('data-density', next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* Not remembering it is better than failing to apply it. */
    }
  }, [density]);

  const compact = density === 'compact';

  return (
    <button
      type="button"
      className="theme-btn"
      onClick={toggle}
      title={ready ? (compact ? 'Compact rows. Switch to comfortable.' : 'Comfortable rows. Switch to compact.') : 'Row density'}
      aria-label={ready ? (compact ? 'Compact rows. Activate for comfortable rows.' : 'Comfortable rows. Activate for compact rows.') : 'Change row density'}
      aria-pressed={compact}
    >
      {/* Three bars for comfortable, five for compact — the icon is the state. */}
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        {compact ? (
          <path d="M2 3h12M2 6h12M2 9h12M2 12h12" strokeLinecap="round" />
        ) : (
          <path d="M2 3.5h12M2 8h12M2 12.5h12" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}
