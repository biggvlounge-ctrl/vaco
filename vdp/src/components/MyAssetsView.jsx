import { useState, useEffect, useCallback } from "react";
import { getOwnedWearables, getEquippedOutfit } from "../lib/degvchi.js";

// Closes VDP's own named "My Assets dashboard" gap. A real profile
// view, not a new store of its own -- every number here is read from
// an API this session already built (jobs, skills, beliefs,
// relationships, property, library) or from the real client-local
// DEGVCHI store VDP already has, same "aggregate, don't duplicate"
// discipline `worldExpansion.js`'s own header argues for computed
// rollups.

const VDP_API_URL = import.meta.env?.VITE_VDP_API_URL || "http://localhost:8827";

async function getJson(path) {
  const res = await fetch(`${VDP_API_URL}${path}`);
  if (!res.ok) throw new Error(`${path} failed (${res.status})`);
  return res.json();
}

export default function MyAssetsView({ session, degvchiStore, refreshSignal }) {
  const [state, setState] = useState(null);
  const [library, setLibrary] = useState([]);
  const [home, setHome] = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [jobs, setJobs] = useState({ assignment: null, shifts: [] });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!session?.userId) return;
    setLoading(true);
    setError(null);
    try {
      const userId = encodeURIComponent(session.userId);
      const [stateBody, libraryBody, homeBody, relBody, jobsBody] = await Promise.all([
        getJson(`/api/players/${userId}/state`),
        getJson(`/api/players/${userId}/library`),
        getJson(`/api/property/${userId}`),
        getJson(`/api/relationships/${userId}`),
        getJson(`/api/players/${userId}/jobs`),
      ]);
      setState(stateBody);
      setLibrary(libraryBody.books);
      setHome(homeBody.home);
      setRelationships(relBody.relationships);
      setJobs(jobsBody);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session?.userId]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, refreshSignal]);

  if (!session) return null;

  const wearables = degvchiStore ? getOwnedWearables(degvchiStore, session.userId) : [];
  const outfit = degvchiStore ? getEquippedOutfit(degvchiStore, session.userId) : {};
  const totalEarned = jobs.shifts.filter((s) => s.paid).reduce((sum, s) => sum + s.pay, 0);

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>My Assets</h2>
        <button onClick={refresh} disabled={loading} style={{ fontSize: 12 }}>
          {loading ? "…" : "Refresh"}
        </button>
      </div>
      {error && <p style={{ fontSize: 12, color: "#e04a4a" }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
        <section>
          <h3 style={{ fontSize: 13, margin: "0 0 4px 0" }}>Wearables ({wearables.length})</h3>
          {wearables.length === 0 && <p style={{ fontSize: 12, color: "#888" }}>Nothing owned yet.</p>}
          <ul style={{ fontSize: 12, margin: 0, paddingLeft: 18 }}>
            {wearables.map((w) => (
              <li key={w.id}>
                {w.name}
                {(outfit.clothing?.id === w.id || outfit.cosmetics?.id === w.id || outfit.accessories?.id === w.id)
                  && <strong> (equipped)</strong>}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 style={{ fontSize: 13, margin: "0 0 4px 0" }}>Skills</h3>
          {state && (
            <ul style={{ fontSize: 12, margin: 0, paddingLeft: 18 }}>
              {Object.entries(state.skills).map(([name, level]) => (
                <li key={name}>{name}: {level.toFixed(1)}</li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 style={{ fontSize: 13, margin: "0 0 4px 0" }}>Home</h3>
          {home
            ? <p style={{ fontSize: 12 }}>{home.levelName} ({home.type}) — {home.lifecycleStage}</p>
            : <p style={{ fontSize: 12, color: "#888" }}>No home owned yet.</p>}
        </section>

        <section>
          <h3 style={{ fontSize: 13, margin: "0 0 4px 0" }}>Job</h3>
          <p style={{ fontSize: 12 }}>
            {jobs.assignment ? `Currently working: ${jobs.assignment.jobId}` : "Not currently clocked in."}
          </p>
          <p style={{ fontSize: 12, color: "#888" }}>
            {jobs.shifts.length} real shift{jobs.shifts.length === 1 ? "" : "s"} worked, {totalEarned} VCoin earned.
          </p>
        </section>

        <section>
          <h3 style={{ fontSize: 13, margin: "0 0 4px 0" }}>Library ({library.length})</h3>
          {library.length === 0 && <p style={{ fontSize: 12, color: "#888" }}>No books read yet.</p>}
          <ul style={{ fontSize: 12, margin: 0, paddingLeft: 18 }}>
            {library.map((b) => (
              <li key={b.orderId}>
                {b.title} — {b.effect.kind === "skill" ? `${b.effect.skill} +` : `${b.effect.beliefType} belief moved`}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 style={{ fontSize: 13, margin: "0 0 4px 0" }}>Relationships ({relationships.length})</h3>
          {relationships.length === 0 && <p style={{ fontSize: 12, color: "#888" }}>Nobody met yet.</p>}
          <ul style={{ fontSize: 12, margin: 0, paddingLeft: 18 }}>
            {relationships.map((r) => (
              <li key={r.otherId}>{r.otherId}: {r.label}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
