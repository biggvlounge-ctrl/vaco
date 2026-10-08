import { useState, useEffect, useCallback } from "react";
import {
  PROPERTY_LEVELS, HOME_PRICE, RENT_PRICE, LAND_PRICE, levelByNumber, materialsDeltaFor,
  COMMERCIAL_LEVELS, commercialLevelByNumber,
} from "../lib/property.js";

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
  const [shop, setShop] = useState(null);
  const [household, setHousehold] = useState(null);
  const [inviteId, setInviteId] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [lastRevenue, setLastRevenue] = useState(null);

  const refresh = useCallback(async () => {
    if (!session?.userId) return;
    setLoading(true);
    try {
      const userId = encodeURIComponent(session.userId);
      const [res, shopRes] = await Promise.all([
        fetch(`${VDP_API_URL}/api/property/${userId}`),
        fetch(`${VDP_API_URL}/api/property/commercial/${userId}`),
      ]);
      const body = await res.json();
      setHome(body.home);
      setShop((await shopRes.json()).shop);
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

  const commercialAct = (path) => async () => {
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
      setShop(body);
      if (onChange) await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // "The economy should continue to thrive as far as the owners of
  // the businesses" (8 Oct 2026) -- the real, opposite flow of
  // `commercialAct`: the business earns, scaled by the real,
  // world-wide economy index `server.cjs`'s own `/api/property/
  // operate-business` reads.
  const handleOperate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${VDP_API_URL}/api/property/operate-business`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.sessionToken}` },
        body: JSON.stringify({ ownerId: session.userId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `operate-business failed (${res.status})`);
      setShop(body.property);
      setLastRevenue({ amount: body.revenue, economyIndex: body.economyIndex });
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
  const nextShopLevel = shop ? commercialLevelByNumber(shop.level + 1) : null;
  const currentShopLevel = shop ? commercialLevelByNumber(shop.level) : null;

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>My Home</h2>
      {error && <p style={{ fontSize: 12, color: "#e04a4a" }}>{error}</p>}
      {loading && !home && <p style={{ fontSize: 12, color: "#888" }}>Loading…</p>}

      {!loading && !home && !household && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={act("/api/property/purchase")} disabled={busy}>
            {busy ? "…" : `Buy a ${PROPERTY_LEVELS[0].name} (${HOME_PRICE} VCoin)`}
          </button>
          <button onClick={act("/api/property/rent")} disabled={busy}>
            {busy ? "…" : `Rent a ${PROPERTY_LEVELS[0].name} (${RENT_PRICE} VCoin)`}
          </button>
          <button onClick={act("/api/property/buy-land")} disabled={busy}>
            {busy ? "…" : `Buy a vacant plot of land (${LAND_PRICE} VCoin)`}
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

      {home && home.type === "land" && (
        <p style={{ fontSize: 12 }}>
          A vacant plot of land ({home.ownershipType}) — {home.lifecycleStage}. Nothing built on it yet.
        </p>
      )}

      {home && home.type !== "land" && (
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

      <div style={{ marginTop: 12, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
        <p style={{ fontSize: 13, fontWeight: "bold" }}>My Business</p>
        <p style={{ fontSize: 11, color: "#888", margin: "0 0 6px" }}>
          A real, independent slot -- owning a home never blocks this, and this never blocks owning a home.
        </p>
        {!shop && (
          <button onClick={commercialAct("/api/property/purchase-commercial")} disabled={busy}>
            {busy ? "…" : `Open a ${COMMERCIAL_LEVELS[0].name} (${COMMERCIAL_LEVELS[0].price} VCoin)`}
          </button>
        )}
        {shop && (
          <div>
            <p style={{ fontSize: 12 }}>{shop.levelName} — {shop.lifecycleStage}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              {nextShopLevel ? (
                <button onClick={commercialAct("/api/property/upgrade-commercial")} disabled={busy}>
                  {busy ? "…" : `Upgrade to ${nextShopLevel.name} (${nextShopLevel.price - currentShopLevel.price} VCoin)`}
                </button>
              ) : (
                <p style={{ fontSize: 12, color: "#888" }}>Already at the top tier.</p>
              )}
              <button onClick={handleOperate} disabled={busy}>
                {busy ? "…" : "Open for business"}
              </button>
            </div>
            {lastRevenue && (
              <p style={{ fontSize: 11, color: "#888" }}>
                Earned {lastRevenue.amount} VCoin (the world's economy is at {lastRevenue.economyIndex}).
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
