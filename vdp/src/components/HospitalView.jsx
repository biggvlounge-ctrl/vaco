import { useState, useEffect, useCallback } from "react";
import { TREATMENT_COST, HEALTH_TRAITS } from "../lib/hospital.js";

// Meridian Starter Hospital. "We also will need a hospital, a
// starter hospital, where we'll start off small" (9 Oct 2026, direct
// instruction) -- one real treatment: a flat-fee checkup that bumps
// the real `health` trait family (`traits.js`, previously unread
// anywhere in VDP).

const VDP_API_URL = import.meta.env?.VITE_VDP_API_URL || "http://localhost:8827";

export default function HospitalView({ session, onChange }) {
  const [treatments, setTreatments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!session?.userId) return;
    try {
      const userId = encodeURIComponent(session.userId);
      const res = await fetch(`${VDP_API_URL}/api/hospital/treatments/${userId}`);
      setTreatments((await res.json()).treatments);
    } catch {
      // Transient fetch failure -- the next refresh tries again.
    }
  }, [session?.userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleTreat = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${VDP_API_URL}/api/hospital/treat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.sessionToken}` },
        body: JSON.stringify({ patientId: session.userId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `treat failed (${res.status})`);
      await refresh();
      if (onChange) await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!session) return null;

  const last = treatments[treatments.length - 1];

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>Meridian Starter Hospital</h2>
      {error && <p style={{ fontSize: 12, color: "#e04a4a" }}>{error}</p>}

      <button onClick={handleTreat} disabled={busy}>
        {busy ? "…" : `Get a checkup (${TREATMENT_COST} VCoin)`}
      </button>

      {last && (
        <p style={{ fontSize: 12, color: "#3a9d6f", marginTop: 8 }}>
          Last checkup bumped {HEALTH_TRAITS.join(", ")} by {last.effect.after[HEALTH_TRAITS[0]] - last.effect.before[HEALTH_TRAITS[0]]} each.
        </p>
      )}

      <p style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
        {treatments.length} real treatment{treatments.length === 1 ? "" : "s"} on record.
      </p>
    </div>
  );
}
