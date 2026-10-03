import { useState, useEffect, useCallback } from "react";

// The Vavlt, VDP's own nightclub district (`vavlt.js`'s own header
// has the full naming rationale -- a new venue, not Vavlt Stvdios).
// Real cover charge through V3 (server-side, in server.cjs's own
// /api/vavlt/checkin route), real "who's here right now" list, polled
// the same way NewsTicker/MyAssetsView already poll.

const VDP_API_URL = import.meta.env?.VITE_VDP_API_URL || "http://localhost:8827";
const POLL_INTERVAL_MS = 10000;

export default function VavltView({ session }) {
  const [venueName, setVenueName] = useState("The Vavlt");
  const [present, setPresent] = useState([]);
  const [checkedIn, setCheckedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${VDP_API_URL}/api/vavlt/present`);
      if (!res.ok) return;
      const body = await res.json();
      setPresent(body.present);
      setVenueName(body.venue || "The Vavlt");
      if (session?.userId) setCheckedIn(body.present.includes(session.userId));
    } catch {
      // Transient fetch failure -- the next poll tries again.
    }
  }, [session?.userId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const handleCheckIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${VDP_API_URL}/api/vavlt/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.sessionToken}` },
        body: JSON.stringify({ ownerId: session.userId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `check-in failed (${res.status})`);
      setPresent(body.present);
      setVenueName(body.venue);
      setCheckedIn(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCheckOut = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${VDP_API_URL}/api/vavlt/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.sessionToken}` },
        body: JSON.stringify({ ownerId: session.userId }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || `check-out failed (${res.status})`);
      }
      setCheckedIn(false);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!session) return null;

  return (
    <div style={{ border: "1px solid #333", borderRadius: 8, padding: 16, background: "#1a1020", color: "#eee" }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>{venueName}</h2>
      {error && <p style={{ fontSize: 12, color: "#f28b8b" }}>{error}</p>}

      {!checkedIn && (
        <button onClick={handleCheckIn} disabled={busy}>
          {busy ? "…" : "Pay cover and check in"}
        </button>
      )}
      {checkedIn && (
        <button onClick={handleCheckOut} disabled={busy}>
          {busy ? "…" : "Check out"}
        </button>
      )}

      <h3 style={{ fontSize: 12, margin: "12px 0 4px 0", color: "#bbb" }}>
        HERE RIGHT NOW ({present.length})
      </h3>
      {present.length === 0 && <p style={{ fontSize: 12, color: "#888" }}>Nobody's checked in yet.</p>}
      <ul style={{ fontSize: 12, margin: 0, paddingLeft: 18 }}>
        {present.map((id) => <li key={id}>{id}</li>)}
      </ul>
    </div>
  );
}
