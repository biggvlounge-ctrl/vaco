import { useState } from "react";
import {
  browseWearables, purchaseWearable, equipWearable, getEquippedOutfit, ownsWearable,
  createCustomWearableFromPhoto, CUSTOM_PHOTO_FEE,
} from "../lib/degvchi.js";
import { transferVCoin } from "../lib/v3Client.js";
import { analyzeOutfitPhoto } from "../lib/v4AgentClient.js";

// Reads a File as base64 (no `data:...;base64,` prefix), the shape
// v4AgentClient.js's analyzeOutfitPhoto and Anthropic's own Messages
// API both expect.
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const commaIndex = result.indexOf(",");
      resolve(commaIndex === -1 ? result : result.slice(commaIndex + 1));
    };
    reader.onerror = () => reject(new Error("Could not read the selected photo."));
    reader.readAsDataURL(file);
  });
}

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
  // Photo-to-outfit: a photographed real outfit becomes a brand-new,
  // player-owned closet item for a flat VCoin fee -- distinct from
  // buying a catalog item above, which grants a real duplicate of one
  // shared row every buyer can also own.
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);
  const [photoAnalyzing, setPhotoAnalyzing] = useState(false);
  const [photoAnalysis, setPhotoAnalysis] = useState(null); // { name, category, dominantColor, description }
  const [photoError, setPhotoError] = useState(null);
  const [photoSaving, setPhotoSaving] = useState(false);

  const transferFn = (from, to, amount, reason) =>
    transferVCoin({ fromUserId: from, toUserId: to, amount, reason });

  const handlePhotoSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    setPhotoError(null);
    setPhotoAnalysis(null);
    setPhotoPreviewUrl(URL.createObjectURL(file));
    setPhotoAnalyzing(true);
    try {
      const base64 = await readFileAsBase64(file);
      const result = await analyzeOutfitPhoto(base64, file.type || "image/jpeg");
      setPhotoAnalysis(result);
    } catch (err) {
      setPhotoError(err.message);
    } finally {
      setPhotoAnalyzing(false);
    }
  };

  const handleConfirmCustomItem = async () => {
    if (!photoAnalysis) return;
    setPhotoSaving(true);
    setPhotoError(null);
    try {
      await createCustomWearableFromPhoto(store, {
        buyerId: session.userId,
        name: photoAnalysis.name,
        category: photoAnalysis.category,
        dominantColor: photoAnalysis.dominantColor,
        description: photoAnalysis.description,
        photoObjectUrl: photoPreviewUrl,
        transferFn,
      });
      await onPurchase();
      setPhotoAnalysis(null);
      setPhotoPreviewUrl(null);
    } catch (err) {
      setPhotoError(err.message);
    } finally {
      setPhotoSaving(false);
    }
  };

  const handleCancelCustomItem = () => {
    setPhotoAnalysis(null);
    setPhotoPreviewUrl(null);
    setPhotoError(null);
  };

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

      <div style={{ marginTop: 16, borderTop: "1px dashed #ccc", paddingTop: 12 }}>
        <h3 style={{ fontSize: 14, margin: "0 0 6px 0" }}>Photograph your own outfit</h3>
        <p style={{ fontSize: 12, color: "#666", margin: "0 0 8px 0" }}>
          Take or upload a real photo of what you're wearing — a real Claude vision call
          catalogues it, and for {CUSTOM_PHOTO_FEE} VCoin it becomes a brand-new closet item
          that's yours alone, not a shared catalog duplicate.
        </p>

        {!photoAnalysis && (
          <input type="file" accept="image/*" capture="environment" onChange={handlePhotoSelected} disabled={photoAnalyzing} />
        )}
        {photoAnalyzing && <p style={{ fontSize: 12, color: "#888" }}>Analyzing your photo…</p>}

        {photoAnalysis && (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginTop: 8 }}>
            {photoPreviewUrl && (
              <img src={photoPreviewUrl} alt="Your photographed outfit" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 4, border: "1px solid #ccc" }} />
            )}
            <div>
              <p style={{ margin: "0 0 2px 0", fontWeight: "bold" }}>{photoAnalysis.name}</p>
              <p style={{ margin: "0 0 2px 0", fontSize: 12, color: "#666" }}>
                {photoAnalysis.category}{photoAnalysis.dominantColor ? ` — ${photoAnalysis.dominantColor}` : ""}
              </p>
              {photoAnalysis.description && (
                <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "#888" }}>{photoAnalysis.description}</p>
              )}
              <button onClick={handleConfirmCustomItem} disabled={photoSaving}>
                {photoSaving ? "Adding…" : `Add to closet for ${CUSTOM_PHOTO_FEE} VCoin`}
              </button>{" "}
              <button onClick={handleCancelCustomItem} disabled={photoSaving}>Cancel</button>
            </div>
          </div>
        )}

        {photoError && <p style={{ color: "crimson", fontSize: 12 }}>{photoError}</p>}
      </div>
    </div>
  );
}
