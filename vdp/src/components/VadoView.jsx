import { useState, useEffect, useCallback } from "react";
import { getVadoMarketState, getDutchPrice, bidOnAuction } from "../lib/vadoMarket.js";

// VDP's real VADO district -- a live client of VOKEN's own VADO
// auction gallery. Replaces the earlier VENVS iframe embed; see
// `world.js`'s own header for why. Unlike VEX, real auction bidding
// here carries no compliance gate -- every open auction is fully
// tradable today.

export default function VadoView({ session }) {
  const [market, setMarket] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [dutchPrices, setDutchPrices] = useState({});
  const [bidAmount, setBidAmount] = useState({});

  const refresh = useCallback(() => {
    getVadoMarketState().then((state) => {
      setMarket(state);
      state.auctions.filter((a) => a.auctionType === "dutch").forEach((a) => {
        getDutchPrice(a.id).then((p) => setDutchPrices((prev) => ({ ...prev, [a.id]: p }))).catch(() => {});
      });
    }).catch((err) => setLoadError(err.message));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleBid = async (auction) => {
    setBusy(true);
    setActionError(null);
    try {
      const amount = auction.auctionType === "dutch"
        ? (dutchPrices[auction.id] ?? auction.startingPrice)
        : Number(bidAmount[auction.id] || auction.startingPrice);
      await bidOnAuction({ auctionId: auction.id, bidderId: session.userId, bidAmount: amount });
      refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <p style={{ color: "crimson" }}>Error loading VADO: {loadError}</p>;
  if (!market) return <p style={{ fontSize: 12, color: "#888" }}>Loading the VADO gallery…</p>;

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px 0" }}>VADO — real Culture Card auctions</h2>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
        Part of <strong>{market.brand.name}</strong>, powered by {market.brand.poweredBy}
      </p>
      <p style={{ fontSize: 12, color: "#1a7d3c" }}>No compliance gate — every open auction here is fully tradable today.</p>

      {market.auctions.length === 0 && <p style={{ fontSize: 12, color: "#888" }}>No real auctions open right now.</p>}
      {market.auctions.map((auction) => (
        <div key={auction.id} style={{ borderTop: "1px dashed #ccc", padding: "8px 0" }}>
          <p style={{ fontSize: 13, margin: "0 0 4px" }}>
            Auction #{auction.id} — card {auction.cardId} edition #{auction.editionNumber} ({auction.auctionType})
          </p>
          <p style={{ fontSize: 12, color: "#666", margin: "0 0 4px" }}>
            {auction.auctionType === "dutch"
              ? `Current price: ${dutchPrices[auction.id] ?? "…"} VCoin (descending)`
              : `Starting price: ${auction.startingPrice} VCoin — current bid: ${auction.currentBid || "none yet"}`}
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {auction.auctionType !== "dutch" && auction.auctionType !== "instant" && (
              <input
                type="number" min="0.01" step="0.01" placeholder="bid amount" style={{ width: 90 }}
                value={bidAmount[auction.id] || ""} onChange={(e) => setBidAmount({ ...bidAmount, [auction.id]: e.target.value })}
              />
            )}
            <button onClick={() => handleBid(auction)} disabled={busy}>
              {auction.auctionType === "instant" ? "Buy now"
                : auction.auctionType === "dutch" ? "Accept current price"
                : auction.auctionType === "offer" ? "Submit offer"
                : "Place bid"}
            </button>
          </div>
        </div>
      ))}

      {actionError && <p style={{ color: "crimson" }}>Error: {actionError}</p>}
    </div>
  );
}
