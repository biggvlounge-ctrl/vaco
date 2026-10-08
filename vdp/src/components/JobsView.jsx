import { useState, useEffect, useCallback } from "react";

// The jobs/careers system (jobs.js: 5 real jobs, real per-shift pay
// through V3, real skill gains) has been real and tested since
// Foundation, but had no way for a player to actually clock in or out
// -- every verification of it this session went through curl with a
// bearer token, never a button. This is that button.

const VDP_API_URL = import.meta.env?.VITE_VDP_API_URL || "http://localhost:8827";

export default function JobsView({ session, onChange }) {
  const [jobs, setJobs] = useState([]);
  const [assignment, setAssignment] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [lastPay, setLastPay] = useState(null);

  const refresh = useCallback(async () => {
    if (!session?.userId) return;
    try {
      const userId = encodeURIComponent(session.userId);
      const [jobsRes, mineRes] = await Promise.all([
        fetch(`${VDP_API_URL}/api/jobs`),
        fetch(`${VDP_API_URL}/api/players/${userId}/jobs`),
      ]);
      const jobsBody = await jobsRes.json();
      const mineBody = await mineRes.json();
      setJobs(jobsBody.jobs);
      setAssignment(mineBody.assignment);
      setShifts(mineBody.shifts);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [session?.userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleClockIn = (jobId) => async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${VDP_API_URL}/api/jobs/${jobId}/clock-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.sessionToken}` },
        body: JSON.stringify({ workerId: session.userId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `clock-in failed (${res.status})`);
      await refresh();
      if (onChange) await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleClockOut = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${VDP_API_URL}/api/jobs/clock-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.sessionToken}` },
        body: JSON.stringify({ workerId: session.userId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `clock-out failed (${res.status})`);
      const yieldText = body.yielded ? `, gathered ${body.yielded.amount} ${body.yielded.type}` : "";
      const consumedText = body.consumed ? ` (used ${body.consumed.amount} ${body.consumed.type})` : "";
      setLastPay(`Shift complete: earned ${body.pay} VCoin as ${body.jobId}${yieldText}${consumedText}.`);
      await refresh();
      if (onChange) await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!session) return null;

  const totalEarned = shifts.filter((s) => s.paid).reduce((sum, s) => sum + s.pay, 0);

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>Jobs</h2>
      {error && <p style={{ fontSize: 12, color: "#e04a4a" }}>{error}</p>}
      {lastPay && <p style={{ fontSize: 12, color: "#3a9d6f" }}>{lastPay}</p>}

      {assignment ? (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 13 }}>
            Currently working: <strong>{jobs.find((j) => j.id === assignment.jobId)?.title || assignment.jobId}</strong>
          </p>
          <button onClick={handleClockOut} disabled={busy}>
            {busy ? "…" : "Clock out"}
          </button>
        </div>
      ) : (
        <ul style={{ fontSize: 13, margin: "0 0 12px 0", paddingLeft: 0, listStyle: "none" }}>
          {jobs.map((job) => (
            <li key={job.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
              <span>
                {job.title} — {job.skill}, {job.payPerShift} VCoin/shift
                {job.consumes ? ` (needs ${job.consumes.amount} ${job.consumes.type})` : ""}
                {job.yields ? ` + ${job.yields.amount} ${job.yields.type}` : ""}
              </span>
              <button onClick={handleClockIn(job.id)} disabled={busy}>
                {busy ? "…" : "Clock in"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p style={{ fontSize: 12, color: "#888" }}>
        {shifts.length} real shift{shifts.length === 1 ? "" : "s"} worked, {totalEarned} VCoin earned total.
      </p>
    </div>
  );
}
