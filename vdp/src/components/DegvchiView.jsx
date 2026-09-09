import { useState } from "react";
import {
  browseWearables, purchaseWearable, equipWearable, getEquippedOutfit, ownsWearable,
} from "../lib/degvchi.js";
import { transferVCoin } from "../lib/v3Client.js";

// Phase 4 demo, fixed in Phase 8: takes the real wearables store as a
// prop rather than creating its own on mount. Phase 7's regression
// pass found (confirmed + screenshotted) that the standalone instance
// and the instance WorldView renders on entering the Fashion District
// building were previously two separate stores -- buying/equipping in
// one was invisible in the other. `store` is now created once in
// App.jsx and passed to both instances.
//
// `onPurchase` is called after BOTH a real purchase and a (non-money)
// equip/unequip action -- equipping doesn't touch VCoin, but the
// callback's real job here is triggering App.jsx's parent-level
// re-render, which is what makes both instances of this component
// recompute from the shared, mutated store. Cheap and correct: it
// just re-fetches the same wallet balance an extra time in the equip
// case, which is harmless.

export default function DegvchiView({ session, store, onPurchase }) {
  const items = browseWearables(store);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const transferFn = (from, to, amount, reason) =>
    transferVCoin({ fromUserId: from, toUserId: to, amount, reason });

  const handleBuy = async (wearableId) => {
    setBusy(wearableId);
    setError(null);
    try {
      await purchaseWearable(store, { wearableId, buyerId: session.userId, transferFn });
      await onPurchase();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const handleEquip = async (wearableId) => {
    equipWearable(store, session.userId, wearableId);
    await onPurchase();
  };

  const outfit = getEquippedOutfit(store, session.userId);

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>DEGVCHI — Fashion District</h2>

      {items.map((item) => {
        const owned = ownsWearable(store, session.userId, item.id);
        const isEquipped = outfit[item.category]?.id === item.id;
        return (
          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderTop: "1px solid #eee" }}>
            <span>
              {item.name}{" "}
              <span style={{ color: "#888" }}>
                (${item.price.toFixed(2)}, {item.category}{item.sponsor ? ` — sponsored by ${item.sponsor}` : " — DEGVCHI original"})
              </span>
            </span>
            {!owned && (
              <button onClick={() => handleBuy(item.id)} disabled={busy === item.id}>
                {busy === item.id ? "Buying…" : "Buy"}
              </button>
            )}
            {owned && !isEquipped && <button onClick={() => handleEquip(item.id)}>Equip</button>}
            {owned && isEquipped && <span style={{ fontSize: 12, color: "#2a7" }}>Equipped</span>}
          </div>
        );
      })}

      <p style={{ fontSize: 13, marginTop: 8 }}>
        My outfit: clothing={outfit.clothing?.name || "none"}, cosmetics={outfit.cosmetics?.name || "none"}, accessories={outfit.accessories?.name || "none"}
      </p>

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </div>
  );
}
