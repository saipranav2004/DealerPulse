'use client';

/**
 * Route-level failure. Named, actionable, and without an apology.
 * Module-level failures are handled inside the modules themselves so that one
 * broken panel never discards a working page.
 */

import { useEffect } from 'react';
import Link from 'next/link';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('DealerPulse route error:', error);
  }, [error]);

  return (
    <div className="app">
      <div className="state" style={{ minHeight: '60vh' }}>
        <div className="state-in">
          <svg
            className="state-mark"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M12 3 L22 21 H2 Z M12 10v5M12 18v.5" />
          </svg>
          <h1 className="t-h2">This screen could not be computed</h1>
          <p className="t-small">
            The analytics layer failed while building this view. The dataset itself is unchanged and current
            as of 31 Dec 2025.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" className="btn btn-primary" onClick={reset}>
              Try again
            </button>
            <Link href="/" className="btn">
              Back to overview
            </Link>
          </div>
          {error.digest ? (
            <p className="t-micro num" style={{ marginTop: 8 }}>
              Reference {error.digest}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
