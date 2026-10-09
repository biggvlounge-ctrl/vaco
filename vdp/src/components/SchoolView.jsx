import { useState, useEffect, useCallback } from "react";
import { EDUCATIONAL_TRAITS, ATTEND_COOLDOWN_MS } from "../lib/school.js";

// Meridian School. "Then we will need also school. We will do
// mostly online school, but we need to set up some type of schooling
// program" (9 Oct 2026, direct instruction) -- free, bumps the real
// `educational` trait family, one real school day's cooldown.

const VDP_API_URL = import.meta.env?.VITE_VDP_API_URL || "http://localhost:8827";

export default function SchoolView({ session, onChange }) {
  const [attendances, setAttendances] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!session?.userId) return;
    try {
      const userId = encodeURIComponent(session.userId);
      const res = await fetch(`${VDP_API_URL}/api/school/attendances/${userId}`);
      setAttendances((await res.json()).attendances);
    } catch {
      // Transient fetch failure -- the next refresh tries again.
    }
  }, [session?.userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAttend = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${VDP_API_URL}/api/school/attend`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.sessionToken}` },
        body: JSON.stringify({ studentId: session.userId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `attend failed (${res.status})`);
      await refresh();
      if (onChange) await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!session) return null;

  const last = attendances[attendances.length - 1];
  const canAttendAgain = !last || Date.now() - last.attendedAt >= ATTEND_COOLDOWN_MS;

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px 0" }}>Meridian School</h2>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
        Mostly online -- free, government-funded, once per real school day.
      </p>
      {error && <p style={{ fontSize: 12, color: "#e04a4a" }}>{error}</p>}

      <button onClick={handleAttend} disabled={busy || !canAttendAgain}>
        {busy ? "…" : canAttendAgain ? "Attend a lesson (free)" : "Already attended today"}
      </button>

      {last && (
        <p style={{ fontSize: 12, color: "#3a9d6f", marginTop: 8 }}>
          Last lesson bumped {EDUCATIONAL_TRAITS.join(", ")} by {last.effect.after[EDUCATIONAL_TRAITS[0]] - last.effect.before[EDUCATIONAL_TRAITS[0]]} each.
        </p>
      )}

      <p style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
        {attendances.length} real lesson{attendances.length === 1 ? "" : "s"} attended.
      </p>
    </div>
  );
}
