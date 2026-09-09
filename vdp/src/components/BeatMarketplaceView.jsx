import { useState, useCallback, useEffect } from "react";
import { listBeats, listBeat, purchaseBeat, listMyPurchases } from "../lib/beatMarketplaceClient.js";

// VDP's real Beat Marketplace district -- a live client of Vvltvre
// Music's own real beat-listing/purchase engine. No listing or
// purchase logic here, every real license type and every real
// 100%-to-producer transfer comes back from Vvltvre Music's own
// server. Covers the full real loop asked for: listing, preview,
// purchase, license delivery.

export default function BeatMarketplaceView({ session }) {
  const [beats, setBeats] = useState(null);
  const [myPurchases, setMyPurchases] = useState([]);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState(20);
  const [licenseType, setLicenseType] = useState("non-exclusive");
  const [lastLicense, setLastLicense] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    listBeats().then(setBeats).catch((err) => setError(err.message));
    listMyPurchases(session.userId).then(setMyPurchases).catch(() => {});
  }, [session.userId]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleList = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await listBeat({
        producerId: session.userId, title, price: Number(price), licenseType,
      });
      setTitle("");
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handlePurchase = async (beatId) => {
    setBusy(true);
    setError(null);
    try {
      const license = await purchaseBeat({ beatId, buyerId: session.userId });
      setLastLicense(license);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px 0" }}>Beat Marketplace — real listing, preview, purchase</h2>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
        Producer keeps 100% of every real sale — a real transferFn moves the price directly, no platform cut.
      </p>

      <form onSubmit={handleList} style={{ borderTop: "1px dashed #ccc", paddingTop: 8, marginBottom: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 600, margin: "0 0 6px" }}>List a beat as a producer</p>
        <input
          placeholder="Beat title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          style={{ width: 140, marginRight: 6 }}
        />
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          style={{ width: 60, marginRight: 6 }}
        />
        <select value={licenseType} onChange={(e) => setLicenseType(e.target.value)} style={{ marginRight: 6 }}>
          <option value="non-exclusive">non-exclusive (lease)</option>
          <option value="exclusive">exclusive (one-time)</option>
        </select>
        <button type="submit" disabled={busy}>List</button>
      </form>

      <div style={{ borderTop: "1px dashed #ccc", paddingTop: 8, marginBottom: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 600, margin: "0 0 6px" }}>Browse real active listings</p>
        {beats && beats.length === 0 && <p style={{ fontSize: 12, color: "#888" }}>No beats listed yet.</p>}
        {beats && beats.map((beat) => (
          <div key={beat.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "4px 0" }}>
            <span style={{ flex: 1 }}>&ldquo;{beat.title}&rdquo; — {beat.price} VCoin ({beat.licenseType})</span>
            {beat.previewUrl ? (
              <audio controls src={beat.previewUrl} style={{ height: 24 }} />
            ) : (
              <span style={{ color: "#888" }}>no preview</span>
            )}
            {beat.producerId === session.userId ? (
              <span style={{ color: "#888" }}>your listing</span>
            ) : (
              <button onClick={() => handlePurchase(beat.id)} disabled={busy}>Buy</button>
            )}
          </div>
        ))}
      </div>

      {lastLicense && (
        <div style={{ borderTop: "1px dashed #ccc", paddingTop: 8, marginBottom: 8 }}>
          <p style={{ fontSize: 12, color: "#1a7d3c", margin: 0 }}>
            License delivered: &ldquo;{lastLicense.beatTitle}&rdquo;, {lastLicense.licenseType}, {lastLicense.pricePaid} VCoin paid, purchase #{lastLicense.id}.
          </p>
        </div>
      )}

      {myPurchases.length > 0 && (
        <div style={{ borderTop: "1px dashed #ccc", paddingTop: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 600, margin: "0 0 6px" }}>Your real licenses ({myPurchases.length})</p>
          {myPurchases.map((p) => (
            <p key={p.id} style={{ fontSize: 12, margin: "2px 0" }}>
              &ldquo;{p.beatTitle}&rdquo; — {p.licenseType}, {p.pricePaid} VCoin
            </p>
          ))}
        </div>
      )}

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </div>
  );
}
