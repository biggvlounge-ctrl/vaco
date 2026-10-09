import { useState, useEffect, useCallback } from "react";
import { ENROLLMENT_FEE, REST_BOOST_AMOUNT } from "../lib/daycare.js";

// Meridian Technological Daycare. "We need some type of new
// technological daycare" (9 Oct 2026, direct instruction). VDP has no
// children/dependent-modeling system at all -- this honestly models
// the real, bounded benefit a guardian gets (freed-up time, read as
// a real boost to their own `rest` need), not literal child care
// (see `daycare.js`'s own header for the full reasoning).

const VDP_API_URL = import.meta.env?.VITE_VDP_API_URL || "http://localhost:8827";

export default function DaycareView({ session, onChange }) {
  const [enrollments, setEnrollments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!session?.userId) return;
    try {
      const userId = encodeURIComponent(session.userId);
      const res = await fetch(`${VDP_API_URL}/api/daycare/enrollments/${userId}`);
      setEnrollments((await res.json()).enrollments);
    } catch {
      // Transient fetch failure -- the next refresh tries again.
    }
  }, [session?.userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleEnroll = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${VDP_API_URL}/api/daycare/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.sessionToken}` },
        body: JSON.stringify({ guardianId: session.userId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `enroll failed (${res.status})`);
      await refresh();
      if (onChange) await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!session) return null;

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px 0" }}>Meridian Technological Daycare</h2>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
        Models freed-up caregiver time (a real boost to your own rest need), not child development --
        VDP has no child-modeling system.
      </p>
      {error && <p style={{ fontSize: 12, color: "#e04a4a" }}>{error}</p>}

      <button onClick={handleEnroll} disabled={busy}>
        {busy ? "…" : `Enroll (${ENROLLMENT_FEE} VCoin, +${REST_BOOST_AMOUNT} rest)`}
      </button>

      <p style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
        {enrollments.length} real enrollment{enrollments.length === 1 ? "" : "s"} on record.
      </p>
    </div>
  );
}
