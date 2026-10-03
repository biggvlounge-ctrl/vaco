import { useState } from "react";
import { getCatalog, purchaseBook } from "../lib/catalog.js";
import { transferVCoin } from "../lib/v3Client.js";
import { sessionHeaders } from "../lib/shieldAuth.js";

// VDP's own server (new as of this phase — see `vdp/server.cjs`),
// reached directly from this browser with the buyer's own real
// Shield session, the same cross-origin shape every other
// `*Client.js` in this ecosystem already uses. VDP's own
// `/api/library/record` route requires exactly that -- the buyer
// acting as themselves -- per its own header.
const VDP_API_URL = import.meta.env?.VITE_VDP_API_URL || "http://localhost:8827";

// Phase 2 demo, fixed in Phase 8: takes the real catalog store as a
// prop rather than creating its own on mount. Phase 7's regression
// pass found that the standalone instance (rendered directly below)
// and the instance WorldView renders on entering the Publisher
// building were previously two separate stores with independent
// state -- a real bug, confirmed and screenshotted, not assumed.
// `catalog` is now created once in App.jsx and passed to both
// instances, so a purchase made in either one is visible in both.

export default function PublishingView({ session, catalog, onPurchase }) {
  const books = getCatalog(catalog);

  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [lastPurchase, setLastPurchase] = useState(null);

  const transferFn = (from, to, amount, reason) =>
    transferVCoin({ fromUserId: from, toUserId: to, amount, reason });

  const libraryRecordFn = async (payload) => {
    const res = await fetch(`${VDP_API_URL}/api/library/record`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...sessionHeaders() },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `library/record failed (${res.status})`);
    }
    return res.json();
  };

  const handleBuy = async (bookId) => {
    setBusy(bookId);
    setError(null);
    try {
      const result = await purchaseBook(catalog, { bookId, buyerId: session.userId, transferFn, libraryRecordFn });
      setLastPurchase(result);
      await onPurchase();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>Publishing</h2>
      {books.map((book) => (
        <div
          key={book.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "6px 0",
            borderTop: "1px solid #eee",
          }}
        >
          <div>
            <div>{book.title}</div>
            <div style={{ fontSize: 12, color: "#666" }}>
              ${book.listPrice.toFixed(2)} ·{" "}
              {book.source === "ingram" ? "Ingram catalog" : `royalty ${(book.royalty.rate * 100).toFixed(0)}%`}
            </div>
          </div>
          <button onClick={() => handleBuy(book.id)} disabled={busy === book.id}>
            {busy === book.id ? "Buying…" : "Buy"}
          </button>
        </div>
      ))}
      {lastPurchase && (
        <p style={{ fontSize: 12, color: "#2a7" }}>
          Bought "{lastPurchase.book.title}" for {lastPurchase.pricePaid} VCoin
          {lastPurchase.royaltyPaid
            ? ` — ${lastPurchase.royaltyPaid} VCoin paid to author.`
            : " — no author royalty (Ingram catalog title)."}
        </p>
      )}
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </div>
  );
}
