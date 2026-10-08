import { useState, useEffect, useCallback } from "react";
import { PROPERTY_LEVELS, HOME_PRICE, RENT_PRICE, levelByNumber, materialsDeltaFor } from "../lib/property.js";

// Real actions against vdp/server.cjs's property routes -- buy, rent,
// upgrade, buy-the-home-you're-renting. `property.js`'s functions
// themselves run server-side only (they need the server's real V3
// transfer); this component only imports it for the constants
// (PROPERTY_LEVELS/HOME_PRICE/RENT_PRICE), the same read-only reuse
// MyAssetsView.jsx already does with other lib modules.

const VDP_API_URL = import.meta.env?.VITE_VDP_API_URL || "http://localhost:8827";

function materialsCostLabel(fromLevel, toLevel) {
  const delta = materialsDeltaFor(fromLevel, toLevel);
  const parts = Object.entries(delta).filter(([, amount]) => amount > 0).map(([type, amount]) => `${amount} ${type}`);
  return parts.length > 0 ? parts.join(", ") : "no materials";
}

export default function MyHomeView({ session, onChange }) {
  const [home, setHome] = useState(null);
  const [household, setHousehold] = useState(null);
  const [inviteId, setInviteId] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!session?.userId) return;
    setLoading(true);
    try {
      const res = await fetch(`${VDP_API_URL}/api/property/${encodeURIComponent(session.userId)}`);
      const body = await res.json();
      setHome(body.home);
      if (body.home) {
        const hRes = await fetch(`${VDP_API_URL}/api/households/${body.home.id}`);
        const hBody = await hRes.json();
        setHousehold(hBody.household);
      } else {
        // Not an owner or renter of record -- but an invited roommate
        // has no property of their own to look a household up through.
        // `householdOf` (households.js) already existed for exactly
        // this; it just had no route, so an invited member could never
        // see the household they joined from their own session.
        const mRes = await fetch(`${VDP_API_URL}/api/households/member/${encodeURIComponent(session.userId)}`);
        const mBody = await mRes.json();
        setHousehold(mBody.household);
      }
    } catch {
      // Transient fetch failure -- the next refresh tries again.
    } finally {
      setLoading(false);
    }
  }, [session?.userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const act = (path) => async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${VDP_API_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.sessionToken}` },
        body: JSON.stringify({ ownerId: session.userId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `${path} failed (${res.status})`);
      setHome(body);
      if (onChange) await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!household) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${VDP_API_URL}/api/households/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.sessionToken}` },
        body: JSON.stringify({ propertyId: household.propertyId, memberId: session.userId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `leave failed (${res.status})`);
      setHousehold(null);
      if (onChange) await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteId.trim() || !home) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${VDP_API_URL}/api/households/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.sessionToken}` },
        body: JSON.stringify({ propertyId: home.id, inviterId: session.userId, memberId: inviteId.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `invite failed (${res.status})`);
      setHousehold(body);
      setInviteId("");
      if (onChange) await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!session) return null;

  const nextLevel = home ? levelByNumber(home.level + 1) : null;
  const currentLevel = home ? levelByNumber(home.level) : null;

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>My Home</h2>
      {error && <p style={{ fontSize: 12, color: "#e04a4a" }}>{error}</p>}
      {loading && !home && <p style={{ fontSize: 12, color: "#888" }}>Loading…</p>}

      {!loading && !home && !household && (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={act("/api/property/purchase")} disabled={busy}>
            {busy ? "…" : `Buy a ${PROPERTY_LEVELS[0].name} (${HOME_PRICE} VCoin)`}
          </button>
          <button onClick={act("/api/property/rent")} disabled={busy}>
            {busy ? "…" : `Rent a ${PROPERTY_LEVELS[0].name} (${RENT_PRICE} VCoin)`}
          </button>
        </div>
      )}

      {!loading && !home && household && (
        <div>
          <p style={{ fontSize: 12, color: "#888" }}>
            You don't own or rent this home -- you're living here as a roommate.
          </p>
          <h3 style={{ fontSize: 13, margin: "8px 0 4px 0" }}>
            Household ({household.memberIds.length})
          </h3>
          <ul style={{ fontSize: 12, margin: "0 0 8px 0", paddingLeft: 18 }}>
            {household.memberIds.map((id) => <li key={id}>{id}</li>)}
          </ul>
          <button onClick={handleLeave} disabled={busy}>
            {busy ? "…" : "Leave household"}
          </button>
        </div>
      )}

      {home && (
        <div>
          <p style={{ fontSize: 12 }}>
            {home.levelName} ({home.ownershipType}) — {home.lifecycleStage}
          </p>

          {home.ownershipType === "rented" && (
            <button onClick={act("/api/property/buy-rented")} disabled={busy}>
              {busy ? "…" : `Buy this home (${HOME_PRICE - RENT_PRICE} VCoin)`}
            </button>
          )}

          {home.ownershipType === "owned" && nextLevel && (
            <button onClick={act("/api/property/upgrade")} disabled={busy}>
              {busy ? "…" : `Upgrade to ${nextLevel.name} (${nextLevel.price - currentLevel.price} VCoin + ${materialsCostLabel(home.level, nextLevel.level)})`}
            </button>
          )}

          {home.ownershipType === "owned" && !nextLevel && (
            <p style={{ fontSize: 12, color: "#888" }}>Already at the top tier.</p>
          )}

          {household && (
            <div style={{ marginTop: 12 }}>
              <h3 style={{ fontSize: 13, margin: "0 0 4px 0" }}>
                Household ({household.memberIds.length})
              </h3>
              <ul style={{ fontSize: 12, margin: "0 0 8px 0", paddingLeft: 18 }}>
                {household.memberIds.map((id) => <li key={id}>{id}</li>)}
              </ul>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder="userId to invite"
                  value={inviteId}
                  onChange={(e) => setInviteId(e.target.value)}
                  style={{ fontSize: 12 }}
                />
                <button onClick={handleInvite} disabled={busy || !inviteId.trim()}>
                  {busy ? "…" : "Invite roommate"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
