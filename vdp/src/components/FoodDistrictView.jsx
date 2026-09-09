import { useState } from "react";
import { FLAGSHIP_BRANDS, orderMenuItem, getOrderHistory } from "../lib/foodDistrict.js";
import { transferVCoin } from "../lib/v3Client.js";

// Real, instant purchase per menu item -- no "equip" step the way
// DEGVCHI's wearables have, since ordering food isn't wearing it.
// `onPurchase` fires the same real, established re-render fix
// (App.jsx's `tick` counter) every other purchase action in this app
// already relies on.

export default function FoodDistrictView({ session, store, onPurchase }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const transferFn = (from, to, amount, reason) =>
    transferVCoin({ fromUserId: from, toUserId: to, amount, reason });

  const handleOrder = async (brandSlug, itemName) => {
    setBusy(`${brandSlug}:${itemName}`);
    setError(null);
    try {
      await orderMenuItem(store, { brandSlug, itemName, buyerId: session.userId, transferFn });
      await onPurchase();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const history = getOrderHistory(store, session.userId);

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>Food District — Flagship Restaurants</h2>

      {FLAGSHIP_BRANDS.map((brand) => (
        <div key={brand.slug} style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 8 }}>
          <p style={{ margin: 0, fontWeight: "bold" }}>
            {brand.name}
            {!brand.nameConfirmed && (
              <span style={{ fontWeight: "normal", color: "#c60", fontSize: 12 }}> (name not yet finalized)</span>
            )}
          </p>
          <p style={{ margin: "2px 0 6px 0", fontSize: 12, color: "#888" }}>{brand.tagline}</p>
          {brand.menu.map((m) => {
            const key = `${brand.slug}:${m.item}`;
            return (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" }}>
                <span>
                  {m.item} <span style={{ color: "#888" }}>(${m.price.toFixed(2)})</span>
                </span>
                <button onClick={() => handleOrder(brand.slug, m.item)} disabled={busy === key}>
                  {busy === key ? "Ordering…" : "Order"}
                </button>
              </div>
            );
          })}
        </div>
      ))}

      <div style={{ marginTop: 12, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
        <p style={{ fontSize: 13, fontWeight: "bold" }}>My orders</p>
        {history.length === 0 && <p style={{ fontSize: 12, color: "#888" }}>No orders yet.</p>}
        {history.map((o) => (
          <p key={o.id} style={{ fontSize: 12, margin: "2px 0" }}>
            {o.brandName} — {o.itemName} (${o.price.toFixed(2)})
          </p>
        ))}
      </div>

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </div>
  );
}
