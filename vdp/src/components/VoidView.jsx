import { useState } from "react";
import {
  requestJob, matchProvider, acceptJob, completeJob, rateJob,
} from "../lib/voidClient.js";

// VDP's real VOID district -- a live client of VOID's own real
// service-marketplace loop: "request -> match -> accept -> complete ->
// pay -> rate," the same loop every one of VOID's 18+ verticals runs
// through. No marketplace logic here, every real job and every real
// dual payout (provider payout + platform fee) comes back from VOID's
// own server. Uses the Courier vertical -- a real, non-licensing-gated
// one -- for the demo.

const VOID_PROVIDER = "void-demo-provider";

export default function VoidView({ session }) {
  const [job, setJob] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleAction = async (action) => {
    setBusy(true);
    setError(null);
    try {
      let updated;
      if (action === "request") {
        updated = await requestJob({
          verticalId: "courier", customerId: session.userId, quantity: 1, unitPrice: 12,
        });
      } else if (action === "match") {
        updated = await matchProvider({ jobId: job.id, providerId: VOID_PROVIDER });
      } else if (action === "accept") {
        updated = await acceptJob(job.id);
      } else if (action === "complete") {
        updated = await completeJob(job.id);
      } else if (action === "rate") {
        updated = await rateJob({ jobId: job.id, rating: 5 });
      }
      setJob(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const nextAction = job && {
    requested: { key: "match", label: "Match a provider" },
    matched: { key: "accept", label: "Provider accepts" },
    accepted: { key: "complete", label: "Complete delivery" },
    completed: job.rating ? null : { key: "rate", label: "Rate 5 stars" },
  }[job.status];

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px 0" }}>VOID — real courier job</h2>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
        Same real request→match→accept→complete→pay→rate loop every VOID vertical runs through.
      </p>

      {!job && (
        <button onClick={() => handleAction("request")} disabled={busy}>Request a courier delivery (12 VCoin)</button>
      )}

      {job && (
        <div style={{ borderTop: "1px dashed #ccc", paddingTop: 8 }}>
          <p style={{ fontSize: 13, margin: "0 0 4px" }}>
            Job #{job.id} — {job.status} — total {job.totalPrice} VCoin
          </p>
          {job.providerPayout != null && (
            <p style={{ fontSize: 12, color: "#666", margin: "0 0 8px" }}>
              Real payout: {job.providerPayout} VCoin to provider, {job.platformFee} VCoin platform fee.
            </p>
          )}
          {job.rating && <p style={{ fontSize: 12, color: "#1a7d3c" }}>Rated {job.rating}/5.</p>}
          {nextAction && (
            <button onClick={() => handleAction(nextAction.key)} disabled={busy}>{nextAction.label}</button>
          )}
        </div>
      )}

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </div>
  );
}
