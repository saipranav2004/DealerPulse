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
