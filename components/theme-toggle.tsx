'use client';

/**
 * Light / dark / system toggle.
 *
 * The design system already defines all three token sets; nothing was driving
 * them. The chosen mode is stamped on `<html data-theme>` and persisted, and a
 * blocking script in the layout applies it before first paint so the page never
 * flashes the wrong theme.
 */

import { useEffect, useState } from 'react';

type Mode = 'light' | 'dark' | 'system';

const ORDER: Mode[] = ['system', 'light', 'dark'];
const LABEL: Record<Mode, string> = {
  system: 'Match system theme',
  light: 'Light theme',
  dark: 'Dark theme',
};

function apply(mode: Mode) {
  const root = document.documentElement;
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
  try {
    window.localStorage.setItem('dealerpulse.theme', mode);
  } catch {
    // Private browsing can block storage; the toggle still works for this session.
  }
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem('dealerpulse.theme');
    } catch {
      stored = null;
    }
    if (stored === 'light' || stored === 'dark' || stored === 'system') setMode(stored);
    setReady(true);
  }, []);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
    setMode(next);
    apply(next);
  }

  return (
    <button
      type="button"
      className="theme-btn"
      onClick={cycle}
      title={ready ? LABEL[mode] : 'Theme'}
      aria-label={ready ? `${LABEL[mode]}. Activate to change.` : 'Change theme'}
    >
      {mode === 'dark' ? (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <path d="M13.5 9.5A5.6 5.6 0 0 1 6.5 2.5a5.6 5.6 0 1 0 7 7Z" />
        </svg>
      ) : mode === 'light' ? (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1M12.9 12.9l-1.1-1.1M4.2 4.2 3.1 3.1" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <rect x="1.5" y="2.5" width="13" height="9" rx="1.2" />
          <path d="M5.5 13.5h5" />
        </svg>
      )}
    </button>
  );
}
