import { useState } from "react";
import {
  FLAGSHIP_BRANDS, FRONTIER_STALLS, DRONE_DELIVERY_RADIUS_MILES, orderMenuItem, getOrderHistory, getInventory, cookBatch,
} from "../lib/foodDistrict.js";
import { transferVCoin } from "../lib/v3Client.js";
import { requestJob } from "../lib/voidClient.js";
import { sessionHeaders } from "../lib/shieldAuth.js";

// Real, instant purchase per menu item -- no "equip" step the way
// DEGVCHI's wearables have, since ordering food isn't wearing it.
// `onPurchase` fires the same real, established re-render fix
// (App.jsx's `tick` counter) every other purchase action in this app
// already relies on.
//
// Ghost-kitchen fulfillment, per direct instruction: each order also
// requests a real drone delivery through VOID's own `foodDelivery`
// vertical (not licensing-gated) -- the same real request->match->
// accept->complete->pay->rate loop VoidView.jsx's courier demo already
// uses, not a second invented delivery system. `requestDeliveryFn` is
// the player's own session requesting it (`requireActor('customerId')`
// on VOID's side), same real-actor posture as every other cross-app
// write in this app.
//
// Creation before distribution, per direct instruction: a brand's
// stock is real and finite (`foodDistrict.js`'s own inventory), so
// "Cook a batch" is a real production action, not flavor text. Its
// payout is a platform-funded leg (the brand's payroll pays the cook)
// -- per this project's standing rule, that must run through VDP's
// own server (`POST /api/food-district/cook-payout`), never straight
// from this browser to V3 as if it were the payroll account itself.
// The real inventory bump only happens client-side after the server
// confirms the real payout.

const VDP_API_URL = import.meta.env?.VITE_VDP_API_URL || "http://localhost:8827";

export default function FoodDistrictView({ session, store, onPurchase }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const transferFn = (from, to, amount, reason) =>
    transferVCoin({ fromUserId: from, toUserId: to, amount, reason });

  const requestDeliveryFn = (order) => requestJob({
    verticalId: "foodDelivery", customerId: session.userId, quantity: 1, unitPrice: order.price,
  });

  const handleOrder = async (brandSlug, itemName) => {
    setBusy(`${brandSlug}:${itemName}`);
    setError(null);
    try {
      await orderMenuItem(store, {
        brandSlug, itemName, buyerId: session.userId, transferFn, requestDeliveryFn,
      });
      await onPurchase();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const handleCook = async (brandSlug) => {
    const key = `cook:${brandSlug}`;
    setBusy(key);
    setError(null);
    try {
      const payoutFn = async (from, to, amount, reason) => {
        const res = await fetch(`${VDP_API_URL}/api/food-district/cook-payout`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...sessionHeaders() },
          body: JSON.stringify({ cookId: to, brandSlug }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `cook-payout failed (${res.status})`);
        }
        return { from, to, amount, reason };
      };
      await cookBatch(store, { brandSlug, cookId: session.userId, payoutFn });
      await onPurchase();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const history = getOrderHistory(store, session.userId);

  const renderBrandCard = (brand) => (
    <div key={brand.slug} style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 8 }}>
      <p style={{ margin: 0, fontWeight: "bold" }}>
        {brand.name}
        {!brand.nameConfirmed && (
          <span style={{ fontWeight: "normal", color: "#c60", fontSize: 12 }}> (name not yet finalized)</span>
        )}
      </p>
      <p style={{ margin: "2px 0 6px 0", fontSize: 12, color: "#888" }}>
        {brand.tagline}
        {" — "}
        <span style={{ color: getInventory(store, brand.slug) > 0 ? "#1a7d3c" : "#c60" }}>
          {getInventory(store, brand.slug)} prepared
        </span>
        {" "}
        <button onClick={() => handleCook(brand.slug)} disabled={busy === `cook:${brand.slug}`} style={{ fontSize: 11 }}>
          {busy === `cook:${brand.slug}` ? "Cooking…" : "Cook a batch"}
        </button>
      </p>
      {brand.menu.map((m) => {
        const key = `${brand.slug}:${m.item}`;
        return (
          <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" }}>
            <span>
              {m.item} <span style={{ color: "#888" }}>(${m.price.toFixed(2)})</span>
            </span>
            <button onClick={() => handleOrder(brand.slug, m.item)} disabled={busy === key || getInventory(store, brand.slug) <= 0}>
              {busy === key ? "Ordering…" : "Order"}
            </button>
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px 0" }}>Food District — Flagship Restaurants</h2>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
        Ghost kitchens, drone-delivered via VOID's real network — serving a {DRONE_DELIVERY_RADIUS_MILES.min}-{DRONE_DELIVERY_RADIUS_MILES.max} mile radius around Meridian.
      </p>

      {FLAGSHIP_BRANDS.map(renderBrandCard)}

      <div style={{ marginTop: 16, borderTop: "2px dashed #c60", paddingTop: 8 }}>
        <h3 style={{ fontSize: 13, margin: "0 0 4px 0", color: "#c60" }}>Frontier Grill — governors-run, not a flagship brand</h3>
        <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>
          Built for the frontier's own real hunted game — not one of the 11 sourced flagship restaurants above.
        </p>
        {FRONTIER_STALLS.map(renderBrandCard)}
      </div>

      <div style={{ marginTop: 12, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
        <p style={{ fontSize: 13, fontWeight: "bold" }}>My orders</p>
        {history.length === 0 && <p style={{ fontSize: 12, color: "#888" }}>No orders yet.</p>}
        {history.map((o) => (
          <p key={o.id} style={{ fontSize: 12, margin: "2px 0" }}>
            {o.brandName} — {o.itemName} (${o.price.toFixed(2)})
            {o.delivery && o.delivery.status === "requested" && (
              <span style={{ color: "#1a7d3c" }}> — drone delivery requested (VOID job #{o.delivery.voidJobId})</span>
            )}
            {o.delivery && o.delivery.status === "failed" && (
              <span style={{ color: "#c60" }}> — delivery request failed ({o.delivery.error})</span>
            )}
          </p>
        ))}
      </div>

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </div>
  );
}
