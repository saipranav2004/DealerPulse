/**
 * Branch skeleton. The funnel bars descend in roughly the real proportions and
 * the right column keeps both panels, so the layout does not shift on arrival.
 */

export function BranchSkeleton() {
  const funnelWidths = ['100%', '80%', '62%', '50%', '42%', '34%'];

  return (
    <div className="app" aria-busy="true" aria-label="Loading branch">
      <div className="topbar">
        <div className="sk" style={{ width: 96, height: 12 }} />
        <span className="sp" />
        <div className="sk" style={{ width: 160, height: 11 }} />
      </div>
      <div className="filterbar">
        <div className="sk" style={{ width: 180, height: 14 }} />
        <div className="sk" style={{ width: 130, height: 28 }} />
        <div className="sk" style={{ width: 96, height: 28 }} />
      </div>

      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--rule)', padding: 'var(--s5)' }}>
        <div style={{ display: 'flex', gap: 'var(--s7)', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="sk" style={{ width: 220, height: 22, marginBottom: 8 }} />
            <div className="sk" style={{ width: 300, height: 13 }} />
          </div>
          <div>
            <div className="sk" style={{ width: 70, height: 11, marginBottom: 8 }} />
            <div className="sk" style={{ width: 110, height: 20 }} />
          </div>
          <div>
            <div className="sk" style={{ width: 100, height: 11, marginBottom: 8 }} />
            <div className="sk" style={{ width: 130, height: 20 }} />
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="c7 panel">
          <div className="panel-hd">
            <div className="sk" style={{ width: 150, height: 16 }} />
            <div className="sk" style={{ width: 52, height: 20 }} />
          </div>
          <div className="panel-bd">
            {funnelWidths.map((width, index) => (
              <div key={index}>
                <div className="fnl-stage">
                  <div className="sk" style={{ width: 64, height: 12 }} />
                  <div className="sk" style={{ height: 26, width }} />
                  <div className="sk" style={{ width: 28, height: 15, marginLeft: 'auto' }} />
                </div>
                {index < funnelWidths.length - 1 ? (
                  <div className="fnl-trans">
                    <span />
                    <div className="sk" style={{ width: 200, height: 13 }} />
                    <span />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div className="c5 stack">
          <div className="panel">
            <div className="panel-hd">
              <div className="sk" style={{ width: 96, height: 16 }} />
            </div>
            <div className="panel-bd" style={{ display: 'grid', gap: 9 }}>
              {[0, 1, 2, 3, 4].map((row) => (
                <div className="sk" key={row} style={{ height: 13 }} />
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel-hd">
              <div className="sk" style={{ width: 120, height: 16 }} />
            </div>
            <div className="panel-bd" style={{ display: 'grid', gap: 11 }}>
              <div className="sk" style={{ height: 9 }} />
              <div className="sk" style={{ height: 9, width: '72%' }} />
              <div className="sk" style={{ height: 9, width: '52%' }} />
              <div className="sk" style={{ height: 9, width: '30%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The chrome every screen shares. Extracted so a route skeleton only has to
 * describe the part below the filter bar — and so the bars do not shift a
 * pixel when the real chrome replaces them.
 */
function ChromeSkeleton() {
  return (
    <>
      <div className="topbar">
        <div className="sk" style={{ width: 96, height: 12 }} />
        <div className="sk" style={{ width: 260, height: 14 }} />
        <span className="sp" />
        <div className="sk" style={{ width: 160, height: 11 }} />
      </div>
      <div className="filterbar">
        <div className="sk" style={{ width: 130, height: 28 }} />
        <div className="sk" style={{ width: 96, height: 28 }} />
        <div className="sk" style={{ width: 80, height: 28 }} />
        <div className="sk" style={{ width: 88, height: 28 }} />
      </div>
    </>
  );
}

/** Rows of a work queue: severity rail, checkbox, detail, money, action. */
export function QueueSkeleton() {
  return (
    <div className="app" aria-busy="true" aria-label="Loading the action queue">
      <ChromeSkeleton />
      <div
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--rule)',
          padding: 'var(--s4) var(--s5) 0',
          display: 'flex',
          gap: 'var(--s5)',
        }}
      >
        {[110, 130, 96, 120].map((width, index) => (
          <div key={index} className="sk" style={{ width, height: 14, marginBottom: 16 }} />
        ))}
      </div>
      <div style={{ padding: 'var(--s4) var(--s5)' }}>
        <div className="sk" style={{ width: 240, height: 26, marginBottom: 20 }} />
        <div className="panel">
          {[0, 1, 2, 3, 4, 5, 6].map((row) => (
            <div key={row} className="q-row">
              <span className="q-sev" />
              <div className="sk" style={{ width: 18, height: 18 }} />
              <div className="q-what">
                <div className="sk" style={{ width: '52%', height: 13, marginBottom: 6 }} />
                <div className="sk" style={{ width: '36%', height: 11 }} />
              </div>
              <div className="sk" style={{ width: 90, height: 24 }} />
              <div className="sk" style={{ width: 48, height: 13 }} />
              <div className="sk" style={{ width: 66, height: 13 }} />
              <div className="sk" style={{ width: 96, height: 28 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A screen whose body is one wide table. */
export function TableSkeleton({ label, rows = 12 }: { label: string; rows?: number }) {
  return (
    <div className="app" aria-busy="true" aria-label={label}>
      <ChromeSkeleton />
      <div
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--rule)',
          padding: 'var(--s4) var(--s5)',
          display: 'flex',
          gap: 'var(--s3)',
        }}
      >
        <div className="sk" style={{ width: 340, height: 30 }} />
        <div className="sk" style={{ width: 80, height: 30 }} />
        <span className="sp" />
        <div className="sk" style={{ width: 110, height: 30 }} />
      </div>
      <div style={{ padding: 'var(--s4) var(--s5)' }}>
        <div className="panel">
          <div className="panel-hd">
            <div className="sk" style={{ width: 180, height: 14 }} />
            <div className="sk" style={{ width: 90, height: 14 }} />
          </div>
          <div className="panel-bd" style={{ display: 'grid', gap: 14 }}>
            {Array.from({ length: rows }, (_, row) => (
              <div key={row} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div className="sk" style={{ width: '22%', height: 13 }} />
                <div className="sk" style={{ width: '14%', height: 13 }} />
                <div className="sk" style={{ flex: 1, height: 13 }} />
                <div className="sk" style={{ width: 72, height: 13 }} />
                <div className="sk" style={{ width: 56, height: 13 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Two charts side by side above a table. */
export function ChartsSkeleton({ label }: { label: string }) {
  return (
    <div className="app" aria-busy="true" aria-label={label}>
      <ChromeSkeleton />
      <div className="verdict">
        <div className="sk" style={{ width: 88, height: 10, marginBottom: 14 }} />
        <div className="sk" style={{ width: '78%', height: 26, marginBottom: 8 }} />
        <div className="sk" style={{ width: '46%', height: 26 }} />
      </div>
      <div className="grid">
        {[0, 1].map((panel) => (
          <div className="c6 panel" key={panel}>
            <div className="panel-hd">
              <div className="sk" style={{ width: 150, height: 16 }} />
            </div>
            <div className="panel-bd">
              <div className="sk" style={{ height: 210 }} />
            </div>
          </div>
        ))}
        <div className="c12 panel">
          <div className="panel-hd">
            <div className="sk" style={{ width: 130, height: 16 }} />
          </div>
          <div className="panel-bd" style={{ display: 'grid', gap: 13 }}>
            {[0, 1, 2, 3, 4, 5, 6].map((row) => (
              <div className="sk" key={row} style={{ height: 13 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A rep scorecard: header stats, benchmark rail, then panels. */
export function RepSkeleton() {
  return (
    <div className="app" aria-busy="true" aria-label="Loading rep">
      <ChromeSkeleton />
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--rule)', padding: 'var(--s5)' }}>
        <div style={{ display: 'flex', gap: 'var(--s6)', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="sk" style={{ width: 190, height: 22, marginBottom: 8 }} />
            <div className="sk" style={{ width: 320, height: 13 }} />
          </div>
          {[0, 1, 2].map((stat) => (
            <div key={stat}>
              <div className="sk" style={{ width: 70, height: 11, marginBottom: 8 }} />
              <div className="sk" style={{ width: 96, height: 20 }} />
            </div>
          ))}
        </div>
        <div className="sk" style={{ height: 44, marginTop: 20 }} />
      </div>
      <div className="grid">
        <div className="c5 panel">
          <div className="panel-hd">
            <div className="sk" style={{ width: 140, height: 16 }} />
          </div>
          <div className="panel-bd" style={{ display: 'grid', gap: 12 }}>
            {[0, 1, 2, 3].map((row) => (
              <div className="sk" key={row} style={{ height: 14 }} />
            ))}
          </div>
        </div>
        <div className="c7 panel">
          <div className="panel-hd">
            <div className="sk" style={{ width: 120, height: 16 }} />
          </div>
          <div className="panel-bd" style={{ display: 'grid', gap: 12 }}>
            {['100%', '78%', '58%', '44%', '32%'].map((width, index) => (
              <div className="sk" key={index} style={{ height: 22, width }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
