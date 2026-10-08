import { useState, useEffect } from "react";
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
//
// **Void Hubs**: VDP's own server registers Meridian's real VOID Hub
// Stations at boot (server.cjs, `registerMeridianVoidHubsOnce`) --
// real package + food distribution infrastructure on VOID's actual
// station network (void/lib/stations.js), not a second invented
// system. Per direct instruction ("the void hub should be similar to
// how the void hub is used in real life"), this mirrors VOID's real
// Hub/Port model: `hub-and-port` stations, one real temperature-
// controlled variant for food. This panel just reads back what VDP's
// server already registered.
//
// **Autonomous vans (8 Oct 2026), per direct instruction**: "we will
// have autonomous vans that will drive. We won't have any cars." VDP
// never had a car concept to remove (checked directly -- no `car`/
// `vehicle` reference anywhere in this app's own source before this
// comment, Venus Resort's water taxi is a boat, not a car). The real
// replacement is VOID's own `transportation` vertical (per-trip,
// non-licensing-gated) -- the same real request→match→accept→
// complete→pay→rate loop the Courier demo below already proves, not a
// second invented ride system. `TRANSPORTATION_FARE` is a flagged
// interpretive VCoin price, the same footing every other unspecified
// number in this app already stands on.

const VOID_PROVIDER = "void-demo-provider";
const COURIER_FARE = 12;
const TRANSPORTATION_FARE = 8;
const VDP_API_URL = import.meta.env?.VITE_VDP_API_URL || "http://localhost:8827";

export default function VoidView({ session }) {
  const [job, setJob] = useState(null);
  const [requestedVertical, setRequestedVertical] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [voidHubs, setVoidHubs] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${VDP_API_URL}/api/void-hubs`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled) setVoidHubs(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleRequest = async (verticalId, unitPrice) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await requestJob({ verticalId, customerId: session.userId, quantity: 1, unitPrice });
      setRequestedVertical(verticalId);
      setJob(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAction = async (action) => {
    setBusy(true);
    setError(null);
    try {
      let updated;
      if (action === "match") {
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
      <h2 style={{ fontSize: 16, margin: "0 0 4px 0" }}>VOID — real logistics jobs</h2>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
        Same real request→match→accept→complete→pay→rate loop every VOID vertical runs through.
        No cars in Meridian -- every ride is an autonomous van.
      </p>

      {!job && (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => handleRequest("courier", COURIER_FARE)} disabled={busy}>
            Request a courier delivery ({COURIER_FARE} VCoin)
          </button>
          <button onClick={() => handleRequest("transportation", TRANSPORTATION_FARE)} disabled={busy}>
            Call an autonomous van ({TRANSPORTATION_FARE} VCoin)
          </button>
        </div>
      )}

      {job && (
        <div style={{ borderTop: "1px dashed #ccc", paddingTop: 8 }}>
          <p style={{ fontSize: 13, margin: "0 0 4px" }}>
            {requestedVertical === "transportation" ? "Autonomous van" : "Courier"} job #{job.id} — {job.status} — total {job.totalPrice} VCoin
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

      <div style={{ borderTop: "1px dashed #ccc", marginTop: 12, paddingTop: 8 }}>
        <h3 style={{ fontSize: 13, margin: "0 0 4px 0" }}>Meridian's Void Hubs</h3>
        {voidHubs && voidHubs.registered ? (
          <ul style={{ fontSize: 12, color: "#666", margin: 0, paddingLeft: 16 }}>
            {voidHubs.stations.map((station) => (
              <li key={station.id}>
                Station #{station.id} — {station.temperatureControlled ? "food distribution (temperature-controlled)" : "package distribution"},
                {" "}{station.bayCount} bays, relay-enabled
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 12, color: "#888" }}>
            {voidHubs ? "Not yet registered on VOID's network." : "Checking VOID's real station network…"}
          </p>
        )}
      </div>
    </div>
  );
}
