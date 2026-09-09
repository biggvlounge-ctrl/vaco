import { useState, useCallback, useEffect } from "react";
import { getDashboard } from "../lib/vacoAnalyticsClient.js";

// VDP's real VACO Analytics district -- a live client of the real
// unified management dashboard: whatever real revenue metrics the
// ecosystem's own apps have actually pushed in (vago, chopz-shop,
// vulture-music, void, vulture-flix, voken, as of this district's own
// build), not a mocked or hardcoded summary.

export default function VacoAnalyticsView() {
  const [apps, setApps] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    getDashboard()
      .then(setApps)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px 0" }}>VACO Analytics — real ecosystem dashboard</h2>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
        Whatever real revenue metrics the ecosystem's own apps have actually pushed in so far — no mocked numbers.
      </p>

      <button onClick={refresh} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>

      {apps && apps.length === 0 && (
        <p style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
          No real metrics ingested yet — nothing has pushed a real event since VACO Analytics last restarted.
        </p>
      )}

      {apps && apps.length > 0 && (
        <table style={{ fontSize: 12, marginTop: 8, borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th style={{ padding: "4px 8px 4px 0" }}>App</th>
              <th style={{ padding: "4px 8px" }}>Metric</th>
              <th style={{ padding: "4px 8px" }}>Count</th>
              <th style={{ padding: "4px 8px" }}>Sum</th>
              <th style={{ padding: "4px 8px" }}>Latest</th>
            </tr>
          </thead>
          <tbody>
            {apps.flatMap((app) => app.metrics.map((m) => (
              <tr key={`${app.app}-${m.metric}`} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "4px 8px 4px 0" }}>{app.app}</td>
                <td style={{ padding: "4px 8px" }}>{m.metric}</td>
                <td style={{ padding: "4px 8px" }}>{m.count}</td>
                <td style={{ padding: "4px 8px" }}>{m.sum}</td>
                <td style={{ padding: "4px 8px" }}>{m.latest}</td>
              </tr>
            )))}
          </tbody>
        </table>
      )}

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </div>
  );
}
