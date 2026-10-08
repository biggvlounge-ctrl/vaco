import { useState, useEffect, useCallback } from "react";

// VDP — Immigration: a real UI for `immigration.js`/`server.cjs`'s
// passport, smuggling-spot, illegal-settlement, and unauthorized-
// structure routes, built the same day those routes shipped with no
// button anywhere -- same gap `MaterialsView.jsx`'s own header
// describes for digging before this component existed.
//
// Every action below is open to any logged-in player, not gated to a
// "robot-patrol-officer" shift -- `server.cjs`'s routes only check
// that the caller really is the name they claim (`sealedBy`,
// `clearedBy`, `demolishedBy`), the same as every other actor route in
// this app. A player narrating themselves as the patrol is the same
// posture this app already takes everywhere else: the real check is
// identity, not a job assignment nobody enforces client-side either.

const VDP_API_URL = import.meta.env?.VITE_VDP_API_URL || "http://localhost:8827";

function describeArrival(arrival) {
  if (!arrival) return "Not on record -- no passport, and no crossing either.";
  if (!arrival.legal) {
    return `Crossed illegally${arrival.caught ? " -- caught" : ""}.`;
  }
  if (arrival.citizenshipType === "temporary") {
    const expires = new Date(arrival.expiresAt).toLocaleDateString();
    return `Temporary passport, expires ${expires}.`;
  }
  return "Full citizenship.";
}

export default function ImmigrationView({ session, onChange }) {
  const [arrival, setArrival] = useState(null);
  const [openSpots, setOpenSpots] = useState([]);
  const [activeSettlements, setActiveSettlements] = useState([]);
  const [unauthorized, setUnauthorized] = useState([]);
  const [activeDetentions, setActiveDetentions] = useState([]);
  const [spotLabel, setSpotLabel] = useState("");
  const [settlementLabel, setSettlementLabel] = useState("");
  const [structureLabel, setStructureLabel] = useState("");
  const [ticketTargetId, setTicketTargetId] = useState("");
  const [ticketReason, setTicketReason] = useState("");
  const [detainTargetId, setDetainTargetId] = useState("");
  const [detainReason, setDetainReason] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!session?.userId) return;
    try {
      const userId = encodeURIComponent(session.userId);
      const [arrivalRes, spotsRes, settlementsRes, unauthorizedRes, detentionsRes] = await Promise.all([
        fetch(`${VDP_API_URL}/api/immigration/arrivals/${userId}`),
        fetch(`${VDP_API_URL}/api/immigration/smuggling-spots`),
        fetch(`${VDP_API_URL}/api/immigration/illegal-settlements`),
        fetch(`${VDP_API_URL}/api/property/unauthorized`),
        fetch(`${VDP_API_URL}/api/justice/detentions`),
      ]);
      setArrival((await arrivalRes.json()).arrival);
      setOpenSpots((await spotsRes.json()).open);
      setActiveSettlements((await settlementsRes.json()).active);
      setUnauthorized((await unauthorizedRes.json()).unauthorized);
      setActiveDetentions((await detentionsRes.json()).active);
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
      <h2 style={{ fontSize: 16, margin: "0 0 4px 0" }}>Immigration</h2>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
        The controlled gate into the settlement beyond the ice wall -- and the real seam in it.
      </p>
      {error && <p style={{ fontSize: 12, color: "crimson" }}>{error}</p>}

      <div style={{ borderTop: "1px solid #eee", paddingTop: 8 }}>
        <p style={{ fontSize: 13, fontWeight: "bold", margin: "0 0 4px 0" }}>My status</p>
        <p style={{ fontSize: 12, margin: "0 0 8px 0" }}>{describeArrival(arrival)}</p>
        {!arrival && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={run("citizenship", () => post("/api/immigration/apply-citizenship", { personId: session.userId }))}
              disabled={busy === "citizenship"}
            >
              {busy === "citizenship" ? "…" : "Apply for citizenship"}
            </button>
            <button
              onClick={run("temporary", () => post("/api/immigration/apply-temporary-passport", { personId: session.userId }))}
              disabled={busy === "temporary"}
            >
              {busy === "temporary" ? "…" : "Apply for a temporary passport"}
            </button>
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid #eee", paddingTop: 8, marginTop: 12 }}>
        <p style={{ fontSize: 13, fontWeight: "bold", margin: "0 0 4px 0" }}>
          Smuggling spots across the ice wall ({openSpots.length} open)
        </p>
        <ul style={{ fontSize: 12, margin: "0 0 8px 0", paddingLeft: 18 }}>
          {openSpots.map((spot) => (
            <li key={spot.id} style={{ marginBottom: 4 }}>
              {spot.locationLabel}{" "}
              <button
                onClick={run(`seal-${spot.id}`, () => post(`/api/immigration/smuggling-spots/${spot.id}/seal`, { sealedBy: session.userId }))}
                disabled={busy === `seal-${spot.id}`}
                style={{ fontSize: 11 }}
              >
                {busy === `seal-${spot.id}` ? "…" : "Seal it"}
              </button>
            </li>
          ))}
          {openSpots.length === 0 && <li style={{ color: "#888" }}>None found yet.</li>}
        </ul>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text" placeholder="where was it found?" value={spotLabel}
            onChange={(e) => setSpotLabel(e.target.value)} style={{ fontSize: 12, flex: 1 }}
          />
          <button
            onClick={run("report-spot", () => post("/api/immigration/smuggling-spots/report", {
              reportedBy: session.userId, locationLabel: spotLabel,
            }).then(() => setSpotLabel("")))}
            disabled={busy === "report-spot" || !spotLabel.trim()}
          >
            {busy === "report-spot" ? "…" : "Report a new spot"}
          </button>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #eee", paddingTop: 8, marginTop: 12 }}>
        <p style={{ fontSize: 13, fontWeight: "bold", margin: "0 0 4px 0" }}>
          Illegal settlements ({activeSettlements.length} active)
        </p>
        <ul style={{ fontSize: 12, margin: "0 0 8px 0", paddingLeft: 18 }}>
          {activeSettlements.map((s) => (
            <li key={s.id} style={{ marginBottom: 4 }}>
              {s.locationLabel} (founded by {s.founderId}){" "}
              <button
                onClick={run(`clear-${s.id}`, () => post(`/api/immigration/illegal-settlements/${s.id}/clear`, { clearedBy: session.userId }))}
                disabled={busy === `clear-${s.id}`}
                style={{ fontSize: 11 }}
              >
                {busy === `clear-${s.id}` ? "…" : "Clear it"}
              </button>
            </li>
          ))}
          {activeSettlements.length === 0 && <li style={{ color: "#888" }}>None active.</li>}
        </ul>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text" placeholder="where?" value={settlementLabel}
            onChange={(e) => setSettlementLabel(e.target.value)} style={{ fontSize: 12, flex: 1 }}
          />
          <button
            onClick={run("found-settlement", () => post("/api/immigration/illegal-settlements/found", {
              founderId: session.userId, locationLabel: settlementLabel,
            }).then(() => setSettlementLabel("")))}
            disabled={busy === "found-settlement" || !settlementLabel.trim()}
          >
            {busy === "found-settlement" ? "…" : "Found a settlement"}
          </button>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #eee", paddingTop: 8, marginTop: 12 }}>
        <p style={{ fontSize: 13, fontWeight: "bold", margin: "0 0 4px 0" }}>
          Unauthorized structures ({unauthorized.length})
        </p>
        <ul style={{ fontSize: 12, margin: "0 0 8px 0", paddingLeft: 18 }}>
          {unauthorized.map((u) => (
            <li key={u.id} style={{ marginBottom: 4 }}>
              {u.locationLabel} (owner: {u.ownerId}){" "}
              <button
                onClick={run(`demolish-${u.id}`, () => post("/api/property/demolish-unauthorized", {
                  demolishedBy: session.userId, propertyId: u.id,
                }))}
                disabled={busy === `demolish-${u.id}`}
                style={{ fontSize: 11 }}
              >
                {busy === `demolish-${u.id}` ? "…" : "Demolish it"}
              </button>
            </li>
          ))}
          {unauthorized.length === 0 && <li style={{ color: "#888" }}>None standing.</li>}
        </ul>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text" placeholder="where?" value={structureLabel}
            onChange={(e) => setStructureLabel(e.target.value)} style={{ fontSize: 12, flex: 1 }}
          />
          <button
            onClick={run("build-unauthorized", () => post("/api/property/build-unauthorized", {
              ownerId: session.userId, locationLabel: structureLabel,
            }).then(() => setStructureLabel("")))}
            disabled={busy === "build-unauthorized" || !structureLabel.trim()}
          >
            {busy === "build-unauthorized" ? "…" : "Build without authorization"}
          </button>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #eee", paddingTop: 8, marginTop: 12 }}>
        <p style={{ fontSize: 13, fontWeight: "bold" }}>
          Citations &amp; detention ({activeDetentions.length} currently detained)
        </p>
        <ul style={{ fontSize: 12, margin: "0 0 8px 0", paddingLeft: 18 }}>
          {activeDetentions.map((d) => (
            <li key={d.id} style={{ marginBottom: 4 }}>
              {d.personId} — {d.reason}{" "}
              <button
                onClick={run(`release-${d.id}`, () => post(`/api/justice/detentions/${d.id}/release`, { releasedBy: session.userId }))}
                disabled={busy === `release-${d.id}`}
                style={{ fontSize: 11 }}
              >
                {busy === `release-${d.id}` ? "…" : "Release"}
              </button>
            </li>
          ))}
          {activeDetentions.length === 0 && <li style={{ color: "#888" }}>Nobody detained right now.</li>}
        </ul>
        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <input
            type="text" placeholder="who? (userId or npc-N)" value={ticketTargetId}
            onChange={(e) => setTicketTargetId(e.target.value)} style={{ fontSize: 12, width: 140 }}
          />
          <input
            type="text" placeholder="reason" value={ticketReason}
            onChange={(e) => setTicketReason(e.target.value)} style={{ fontSize: 12, flex: 1 }}
          />
          <button
            onClick={run("issue-ticket", () => post("/api/justice/tickets/issue", {
              issuedBy: session.userId, personId: ticketTargetId, reason: ticketReason,
            }).then(() => { setTicketTargetId(""); setTicketReason(""); }))}
            disabled={busy === "issue-ticket" || !ticketTargetId.trim() || !ticketReason.trim()}
          >
            {busy === "issue-ticket" ? "…" : "Issue ticket"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text" placeholder="who? (userId or npc-N)" value={detainTargetId}
            onChange={(e) => setDetainTargetId(e.target.value)} style={{ fontSize: 12, width: 140 }}
          />
          <input
            type="text" placeholder="reason" value={detainReason}
            onChange={(e) => setDetainReason(e.target.value)} style={{ fontSize: 12, flex: 1 }}
          />
          <button
            onClick={run("detain", () => post("/api/justice/detain", {
              detainedBy: session.userId, personId: detainTargetId, reason: detainReason,
            }).then(() => { setDetainTargetId(""); setDetainReason(""); }))}
            disabled={busy === "detain" || !detainTargetId.trim() || !detainReason.trim()}
          >
            {busy === "detain" ? "…" : "Detain"}
          </button>
        </div>
      </div>
    </div>
  );
}
