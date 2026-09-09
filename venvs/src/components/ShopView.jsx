import { useState } from "react";
import { browseProducts, buyNow } from "../lib/shop.js";
import { transferVCoin } from "../lib/v3Client.js";

// Phase 9 demo: VENVS's own Amazon-style retail Shop -- distinct from
// Marketplace's multi-seller peer resale (Phase 3). Single catalog,
// instant buy, full price to the platform (first-party retail, not a
// third-party marketplace). No cart -- CLAUDE.md's own distinction
// between "Shop" and "Marketplace" is exactly this simpler model.

export default function ShopView({ session, shop, onPurchase }) {
  const products = browseProducts(shop);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);

  const transferFn = (from, to, amount, reason) =>
    transferVCoin({ fromUserId: from, toUserId: to, amount, reason });

  const handleBuy = async (productId) => {
    setBusy(productId);
    setError(null);
    try {
      const result = await buyNow(shop, { productId, buyerId: session.userId, transferFn });
      setLastOrder(result);
      await onPurchase();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>Shop</h2>
      {products.map((product) => (
        <div key={product.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderTop: "1px solid #eee" }}>
          <span>
            {product.title} <span style={{ color: "#888" }}>(${product.price.toFixed(2)})</span>
          </span>
          <button onClick={() => handleBuy(product.id)} disabled={busy === product.id}>
            {busy === product.id ? "Buying…" : "Buy Now"}
          </button>
        </div>
      ))}
      {lastOrder && (
        <p style={{ fontSize: 12, color: "#2a7" }}>
          Bought "{lastOrder.product.title}" for {lastOrder.pricePaid} VCoin.
        </p>
      )}
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </div>
  );
}
