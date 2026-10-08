import { useState, useEffect, useCallback } from "react";
import { DISTRICTS } from "../lib/world.js";
import { DISTRICT_UNLOCK_TIER, isDistrictUnlocked } from "../lib/settlement.js";

// VDP — The Government: V4, the AI running this world.
//
// Direct instruction (8 Oct 2026): "the tech is the government." This
// panel surfaces three real things that government actually does --
// real security scaling with real crime, real construction contracts
// it posts to real builders, and the real fact of organized
// opposition to it -- each backed by `security.js`/`contracts.js`/
// `dissent.js` and `server.cjs`'s matching routes, the same gap every
// other real-logic-no-button finding this session kept turning up.
//
// **Analytics and the territory map (8 Oct 2026), same instruction**:
// "a world screen, an analytics screen... how many people are in the
// world, how much money is generated... a map of the charter
// territory that's already been conquered... more places will be
// inserted on the map as the population grows." The population ticker
// was already real (`WorldView.jsx`'s own header); this panel adds
// the one genuinely missing number, real VCoin generated
// (`GET /api/analytics/status`), and a real territory map built from
// `world.js`'s own `DISTRICTS` and `settlement.js`'s own real
// population-gated unlock tiers -- not a second invented map, the
// same real districts and thresholds the walkable world already uses.

const VDP_API_URL = import.meta.env?.VITE_VDP_API_URL || "http://localhost:8827";

export default function GovernmentView({ session, onChange }) {
  const [security, setSecurity] = useState(null);
  const [crimeByLocation, setCrimeByLocation] = useState({});
  const [analytics, setAnalytics] = useState(null);
  const [openContracts, setOpenContracts] = useState([]);
  const [myContracts, setMyContracts] = useState([]);
  const [activeRevolts, setActiveRevolts] = useState([]);
  const [revoltReason, setRevoltReason] = useState("");
  const [revoltParticipants, setRevoltParticipants] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!session?.userId) return;
    try {
      const userId = encodeURIComponent(session.userId);
      const [securityRes, byLocationRes, analyticsRes, openRes, mineRes, revoltsRes] = await Promise.all([
        fetch(`${VDP_API_URL}/api/security/status`),
        fetch(`${VDP_API_URL}/api/security/by-location`),
        fetch(`${VDP_API_URL}/api/analytics/status`),
        fetch(`${VDP_API_URL}/api/contracts/open`),
        fetch(`${VDP_API_URL}/api/contracts/mine/${userId}`),
        fetch(`${VDP_API_URL}/api/dissent/active`),
      ]);
      setSecurity(await securityRes.json());
      setCrimeByLocation((await byLocationRes.json()).crimeByLocation);
      setAnalytics(await analyticsRes.json());
      setOpenContracts((await openRes.json()).open);
      setMyContracts((await mineRes.json()).contracts);
      setActiveRevolts((await revoltsRes.json()).active);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [session?.userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const post = async (path, body) => {
    const res = await fetch(`${VDP_API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.sessionToken}` },
      body: JSON.stringify(body),
    });
    const parsed = await res.json();
    if (!res.ok) throw new Error(parsed.error || `${path} failed (${res.status})`);
    return parsed;
  };

  const run = (key, fn) => async () => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await refresh();
      if (onChange) await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  if (!session) return null;

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px 0" }}>The Government</h2>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
        V4 runs Meridian -- real security, real contracts, and the real people who oppose it.
      </p>
      {error && <p style={{ fontSize: 12, color: "crimson" }}>{error}</p>}

      <div style={{ borderTop: "1px solid #eee", paddingTop: 8 }}>
        <p style={{ fontSize: 13, fontWeight: "bold", margin: "0 0 4px 0" }}>Security</p>
        {security && (
          <p style={{ fontSize: 12, margin: "0 0 4px" }}>
            {security.name} — {security.cameraCount} cameras, {security.robotCount} robot patrols
            {" "}({security.crimeCount} real crimes on record)
          </p>
        )}
        {Object.keys(crimeByLocation).length > 0 && (
          <ul style={{ fontSize: 11, color: "#666", margin: 0, paddingLeft: 16 }}>
            {Object.entries(crimeByLocation).map(([label, count]) => (
              <li key={label}>{label}: {count}</li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ borderTop: "1px solid #eee", paddingTop: 8, marginTop: 12 }}>
        <p style={{ fontSize: 13, fontWeight: "bold", margin: "0 0 4px 0" }}>Analytics</p>
        {analytics && (
          <p style={{ fontSize: 12 }}>
            {analytics.population.tier} — {analytics.population.population} people
            {" "}({analytics.population.players} real, {analytics.population.npcs} NPC)
            {" "}· {analytics.totalVCoinGenerated} VCoin generated by the government
          </p>
        )}
      </div>

      <div style={{ borderTop: "1px solid #eee", paddingTop: 8, marginTop: 12 }}>
        <p style={{ fontSize: 13, fontWeight: "bold", margin: "0 0 4px 0" }}>Charter Territory</p>
        <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>
          More of the map unlocks as the real population grows.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 4 }}>
          {DISTRICTS.map((d) => {
            const unlocked = analytics ? isDistrictUnlocked(d.id, analytics.population.population) : false;
            return (
              <div
                key={d.id}
                style={{
                  fontSize: 10, padding: "4px 6px", borderRadius: 4, textAlign: "center",
                  background: unlocked ? "#1a7d3c22" : "#88888822",
                  color: unlocked ? "#1a7d3c" : "#888",
                  border: `1px solid ${unlocked ? "#1a7d3c" : "#ccc"}`,
                }}
                title={`requires ${DISTRICT_UNLOCK_TIER[d.id] || "?"}`}
              >
                {d.name}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ borderTop: "1px solid #eee", paddingTop: 8, marginTop: 12 }}>
        <p style={{ fontSize: 13, fontWeight: "bold", margin: "0 0 4px 0" }}>
          Open government contracts ({openContracts.length})
        </p>
        <ul style={{ fontSize: 12, margin: "0 0 8px 0", paddingLeft: 18 }}>
          {openContracts.map((c) => (
            <li key={c.id} style={{ marginBottom: 4 }}>
              {c.description} — {c.vcoinReward} VCoin{" "}
              <button
                onClick={run(`accept-${c.id}`, () => post(`/api/contracts/${c.id}/accept`, { builderId: session.userId }))}
                disabled={busy === `accept-${c.id}`}
                style={{ fontSize: 11 }}
              >
                {busy === `accept-${c.id}` ? "…" : "Accept"}
              </button>
            </li>
          ))}
          {openContracts.length === 0 && <li style={{ color: "#888" }}>None open right now.</li>}
        </ul>

        <p style={{ fontSize: 13, fontWeight: "bold", margin: "0 0 4px 0" }}>My contracts</p>
        <ul style={{ fontSize: 12, margin: 0, paddingLeft: 18 }}>
          {myContracts.map((c) => (
            <li key={c.id} style={{ marginBottom: 4 }}>
              {c.description} — {c.status}
              {c.status === "accepted" && (
                <button
                  onClick={run(`complete-${c.id}`, () => post(`/api/contracts/${c.id}/complete`, { builderId: session.userId }))}
                  disabled={busy === `complete-${c.id}`}
                  style={{ fontSize: 11, marginLeft: 6 }}
                >
                  {busy === `complete-${c.id}` ? "…" : "Complete"}
                </button>
              )}
            </li>
          ))}
          {myContracts.length === 0 && <li style={{ color: "#888" }}>None accepted yet.</li>}
        </ul>
      </div>

      <div style={{ borderTop: "1px solid #eee", paddingTop: 8, marginTop: 12 }}>
        <p style={{ fontSize: 13, fontWeight: "bold", margin: "0 0 4px 0" }}>
          Revolts against the government ({activeRevolts.length} active)
        </p>
        <ul style={{ fontSize: 12, margin: "0 0 8px 0", paddingLeft: 18 }}>
          {activeRevolts.map((r) => (
            <li key={r.id} style={{ marginBottom: 4 }}>
              {r.leaderId} — {r.reason} ({r.participantIds.length} involved){" "}
              <button
                onClick={run(`suppress-${r.id}`, () => post(`/api/dissent/${r.id}/suppress`, { suppressedBy: session.userId }))}
                disabled={busy === `suppress-${r.id}`}
                style={{ fontSize: 11 }}
              >
                {busy === `suppress-${r.id}` ? "…" : "Suppress"}
              </button>
            </li>
          ))}
          {activeRevolts.length === 0 && <li style={{ color: "#888" }}>None active.</li>}
        </ul>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text" placeholder="who else is with you? (comma-separated)" value={revoltParticipants}
            onChange={(e) => setRevoltParticipants(e.target.value)} style={{ fontSize: 12, width: 180 }}
          />
          <input
            type="text" placeholder="why?" value={revoltReason}
            onChange={(e) => setRevoltReason(e.target.value)} style={{ fontSize: 12, flex: 1 }}
          />
          <button
            onClick={run("organize", () => post("/api/dissent/organize", {
              leaderId: session.userId,
              reason: revoltReason,
              participantIds: revoltParticipants.split(",").map((s) => s.trim()).filter(Boolean),
            }).then(() => { setRevoltReason(""); setRevoltParticipants(""); }))}
            disabled={busy === "organize" || !revoltReason.trim()}
          >
            {busy === "organize" ? "…" : "Organize a revolt"}
          </button>
        </div>
      </div>
    </div>
  );
}
