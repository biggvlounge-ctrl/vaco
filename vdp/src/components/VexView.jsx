import { useState, useEffect, useCallback } from "react";
import { getVexMarketState, ensureBrokerAccount, buyCardEdition } from "../lib/vexMarket.js";

// VDP's real VEX district -- a live client of VOKEN's own VEX
// brokerage, trading real Culture Card editions (vehicles category).
// Replaces the earlier VENVS iframe embed; see `world.js`'s own
// header for why. Opening a broker account is never blocked; placing
// an actual trade order is gated behind VOKEN's own real
// `vex-brokerage` compliance flag, shown here honestly rather than
// let a trade attempt fail as a surprise.

export default function VexView({ session }) {
  const [market, setMarket] = useState(null);
  const [account, setAccount] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [qty, setQty] = useState({});
  const [price, setPrice] = useState({});

  const refresh = useCallback(() => {
    getVexMarketState().then(setMarket).catch((err) => setLoadError(err.message));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleOpenAccount = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const acct = await ensureBrokerAccount(session.userId);
      setAccount(acct);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleBuy = async (cardId) => {
    if (!account) return;
    setBusy(true);
    setActionError(null);
    try {
      await buyCardEdition({
        accountId: account.id, cardId, quantity: Number(qty[cardId] || 1), pricePerUnit: Number(price[cardId] || 1),
      });
      refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <p style={{ color: "crimson" }}>Error loading VEX: {loadError}</p>;
  if (!market) return <p style={{ fontSize: 12, color: "#888" }}>Loading the VEX trading floor…</p>;

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px 0" }}>VEX — real Culture Card brokerage</h2>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
        Part of <strong>{market.brand.name}</strong>, powered by {market.brand.poweredBy}
      </p>
      <p style={{ fontSize: 12, color: market.tradingCleared ? "#1a7d3c" : "#a5670f" }}>
        {market.tradingCleared
          ? "Trading is cleared and live."
          : "Trading is locked — held pending real broker-dealer compliance review. Accounts can still be opened."}
      </p>

      {!account ? (
        <button onClick={handleOpenAccount} disabled={busy}>Open a real brokerage account</button>
      ) : (
        <p style={{ fontSize: 12, color: "#666" }}>Account #{account.id} open for {account.userId}.</p>
      )}

      <div style={{ marginTop: 12 }}>
        <p style={{ fontSize: 13, fontWeight: "bold", margin: "0 0 4px" }}>Vehicles up for trade</p>
        {market.cards.length === 0 && <p style={{ fontSize: 12, color: "#888" }}>No real vehicle Culture Cards minted yet.</p>}
        {market.cards.map((card) => (
          <div key={card.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
            <span style={{ fontSize: 13, flex: 1 }}>
              Card #{card.id} — {card.subjectPersonId} ({card.rarityTier})
            </span>
            <input
              type="number" min="1" placeholder="qty" style={{ width: 50 }}
              value={qty[card.id] || ""} onChange={(e) => setQty({ ...qty, [card.id]: e.target.value })}
            />
            <input
              type="number" min="0.01" step="0.01" placeholder="price/unit" style={{ width: 80 }}
              value={price[card.id] || ""} onChange={(e) => setPrice({ ...price, [card.id]: e.target.value })}
            />
            <button onClick={() => handleBuy(card.id)} disabled={busy || !account || !market.tradingCleared}>Buy</button>
          </div>
        ))}
      </div>

      {actionError && <p style={{ color: "crimson" }}>Error: {actionError}</p>}
    </div>
  );
}
