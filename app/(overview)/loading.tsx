/**
 * Overview skeleton. Content-shaped, not a spinner: the verdict block, the
 * five vital cells and the module grid keep their real proportions so nothing
 * jumps when data lands.
 */

export default function OverviewLoading() {
  return (
    <div className="app" aria-busy="true" aria-label="Loading overview">
      <div className="topbar">
        <div className="sk" style={{ width: 96, height: 12 }} />
        <span className="sp" />
        <div className="sk" style={{ width: 160, height: 11 }} />
      </div>
      <div className="filterbar">
        <div className="sk" style={{ width: 130, height: 28 }} />
        <div className="sk" style={{ width: 96, height: 28 }} />
        <div className="sk" style={{ width: 80, height: 28 }} />
        <div className="sk" style={{ width: 88, height: 28 }} />
      </div>

      <div className="verdict">
        <div className="verdict-in">
          <div>
            <div className="sk" style={{ width: 88, height: 10, marginBottom: 14 }} />
            <div className="sk" style={{ width: '100%', height: 26, marginBottom: 8 }} />
            <div className="sk" style={{ width: '82%', height: 26, marginBottom: 8 }} />
            <div className="sk" style={{ width: '54%', height: 26, marginBottom: 18 }} />
            <div className="sk" style={{ width: 200, height: 34 }} />
          </div>
          <div className="evidence">
            <div className="sk" style={{ width: 120, height: 11, marginBottom: 12 }} />
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
                <div className="sk" style={{ width: 64, height: 11 }} />
                <div className="sk" style={{ flex: 1, height: 6 }} />
                <div className="sk" style={{ width: 38, height: 11 }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="vitals">
        {[0, 1, 2, 3, 4].map((cell) => (
          <div className="vital" key={cell}>
            <div className="sk" style={{ width: 84, height: 10, marginBottom: 12 }} />
            <div className="sk" style={{ width: 108, height: 24, marginBottom: 10 }} />
            <div className="sk" style={{ width: '100%', height: 20 }} />
          </div>
        ))}
      </div>

      <div className="grid">
        <div className="c8 panel">
          <div className="panel-hd">
            <div className="sk" style={{ width: 150, height: 16 }} />
          </div>
          <div className="panel-bd" style={{ display: 'grid', gap: 14 }}>
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div className="sk" style={{ width: 120, height: 12 }} />
                <div className="sk" style={{ flex: 1, height: 8 }} />
                <div className="sk" style={{ flex: 1, height: 8 }} />
              </div>
            ))}
          </div>
        </div>
        <div className="c4 panel">
          <div className="panel-hd">
            <div className="sk" style={{ width: 110, height: 16 }} />
          </div>
          <div className="panel-bd" style={{ display: 'grid', gap: 11 }}>
            {[0, 1, 2, 3, 4].map((row) => (
              <div className="sk" key={row} style={{ height: 13 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
