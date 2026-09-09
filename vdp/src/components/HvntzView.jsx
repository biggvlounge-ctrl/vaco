import { useState } from "react";
import {
  registerBusiness, registerLocation, createHunt, addCheckpoint, checkInAtCheckpoint,
} from "../lib/hvntzClient.js";

// VDP's real HVNTZ district -- a live client of HVNTZ's own original
// core mechanic: a real scavenger hunt with real VCoin bounties. No
// hunt logic here, every real business/location/hunt/checkpoint and
// every real payout comes back from HVNTZ's own server. Setup mirrors
// the doc's own worked example (a real St. Louis checkpoint) -- the
// Gateway Arch's real coordinates, not invented ones.

const GATEWAY_ARCH = { lat: 38.6247, lng: -90.1848, address: "11 N 4th St, St. Louis, MO" };

export default function HvntzView({ session }) {
  const [hunt, setHunt] = useState(null);
  const [checkpointId, setCheckpointId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [checkedIn, setCheckedIn] = useState(null);

  const handleSetUpHunt = async () => {
    setBusy(true);
    setError(null);
    try {
      const business = await registerBusiness({ name: "Gateway Grounds Coffee", ownerId: `host-${session.userId}` });
      const location = await registerLocation({
        businessId: business.id, locationType: "hub", address: GATEWAY_ARCH.address, lat: GATEWAY_ARCH.lat, lng: GATEWAY_ARCH.lng,
      });
      const newHunt = await createHunt({
        title: "Gateway Arch Scavenger Hunt", sponsorId: session.userId, totalBudget: 100, intensityLevel: "moderate",
      });
      const checkpoint = await addCheckpoint({
        huntId: newHunt.id, businessId: business.id, locationId: location.id, bountyAmount: 10, hostFee: 2, clue: "Find the tallest arch in St. Louis.",
      });
      setHunt(newHunt);
      setCheckpointId(checkpoint.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCheckIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await checkInAtCheckpoint({ huntId: hunt.id, checkpointId, userId: session.userId });
      setCheckedIn(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px 0" }}>HVNTZ — real scavenger hunt</h2>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
        The original HVNTZ mechanic: real sponsor budget, real checkpoints, real VCoin bounties.
      </p>

      {!hunt && (
        <button onClick={handleSetUpHunt} disabled={busy}>Set up a demo hunt (100 VCoin sponsor budget)</button>
      )}

      {hunt && (
        <div style={{ borderTop: "1px dashed #ccc", paddingTop: 8 }}>
          <p style={{ fontSize: 13, margin: "0 0 4px" }}>
            Hunt #{hunt.id} — {hunt.title} ({hunt.intensityLevel})
          </p>
          <p style={{ fontSize: 12, color: "#666", margin: "0 0 8px" }}>
            Checkpoint #{checkpointId}: &ldquo;Find the tallest arch in St. Louis.&rdquo; — bounty 10 VCoin
          </p>
          {!checkedIn && (
            <button onClick={handleCheckIn} disabled={busy}>Check in at this checkpoint</button>
          )}
          {checkedIn && (
            <p style={{ fontSize: 12, color: "#1a7d3c" }}>
              Checked in — real bounty paid to {session.userId}.
            </p>
          )}
        </div>
      )}

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </div>
  );
}
