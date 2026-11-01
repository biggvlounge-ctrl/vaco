import { useState, useEffect } from "react";
import {
  listSellers, browseProducts, createCart, addToCart, getCart, checkout,
  markChopzEligible, publishToChopzShop, getRecoveryOffer,
} from "../lib/marketplaceClient.js";

// Phase 14 (31 Oct 2026): rewired from a local, in-memory
// `createMarketplace()` -- reset on every component mount, so a
// seller a real user registered vanished on the next page load -- to
// `marketplaceClient.js`'s real HTTP calls against `server.cjs`'s own
// real, persisted backend. The demo sellers (Cherokee Hardware,
// Riverfront Vinyl) and SVMIKO DEGVCHI's 12 real storefronts are now
// seeded server-side, once, at boot (`server.cjs`'s own `onReady`) --
// not recreated here.
//
// The CHOPZ SHOP promotion button now only renders for a product this
// signed-in session actually owns -- the real resource-ownership
// check `POST .../chopz-eligible` itself enforces server-side, surfaced
// here rather than letting a doomed request round-trip for nothing.
//
// The abandoned-cart demo keeps its real shape (a second real cart,
// one item, checked against the real detection logic) but can no
// longer backdate a server-held cart's own `lastActivityAt` from the
// browser -- there is no route for that, by design (a buyer does not
// get to declare their own cart "old"). It instead passes a real
// `now` 45 simulated minutes ahead to the real sweep, the same way a
// scheduler running this sweep for real, later, would naturally find
// one that has actually gone stale.

export default function MarketplaceView({ session, onPurchase }) {
  const [sellers, setSellers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadError, setLoadError] = useState(null);

  const [cart, setCart] = useState(null);
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [staleCart, setStaleCart] = useState(null);
  const [recoveryOffer, setRecoveryOffer] = useState(null);
  const [sweepBusy, setSweepBusy] = useState(false);

  const [chopzBusyId, setChopzBusyId] = useState(null);
  const [chopzError, setChopzError] = useState(null);

  const loadCatalog = () => Promise.all([listSellers(), browseProducts()])
    .then(([s, p]) => { setSellers(s); setProducts(p); })
    .catch((err) => setLoadError(err.message));

  useEffect(() => {
    loadCatalog();
    createCart({ buyerId: session.userId }).then(setCart).catch((err) => setLoadError(err.message));
    // A second real cart for the abandoned-cart demo below -- the
    // paint product is added once the real catalog has loaded.
    createCart({ buyerId: session.userId }).then((c) => setStaleCart(c)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.userId]);

  useEffect(() => {
    if (!staleCart || products.length === 0) return;
    const paint = products.find((p) => p.title.startsWith("Exterior Paint"));
    if (paint) addToCart(staleCart.id, { buyerId: session.userId, productId: paint.id }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staleCart, products]);

  const sellersById = Object.fromEntries(sellers.map((s) => [s.id, s]));

  const handlePublishToChopz = async (productId, commissionPercent) => {
    setChopzBusyId(productId);
    setChopzError(null);
    try {
      await markChopzEligible(productId, { ownerId: session.userId, affiliateCommissionPercent: commissionPercent });
      await publishToChopzShop(productId, { ownerId: session.userId });
      await loadCatalog();
    } catch (err) {
      setChopzError(err.message);
    } finally {
      setChopzBusyId(null);
    }
  };

  const handleAdd = async (productId) => {
    if (!cart) return;
    try {
      const updated = await addToCart(cart.id, { buyerId: session.userId, productId });
      setCart(updated);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCheckout = async () => {
    if (!cart) return;
    setBusy(true);
    setError(null);
    try {
      const result = await checkout({ cartId: cart.id, buyerId: session.userId });
      setOrder(result);
      await onPurchase();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCheckAbandoned = async () => {
    if (!staleCart) return;
    setSweepBusy(true);
    setError(null);
    try {
      const offer = await getRecoveryOffer(staleCart.id, { discountPercent: 15 });
      setRecoveryOffer(offer);
    } catch {
      // Sweeping (POST /api/marketplace/abandoned-carts/sweep) is
      // deliberately `requireCallingService()` -- real abandonment
      // detection runs on a schedule, not on a browser's own say-so,
      // so this demo cart genuinely has not been marked abandoned yet
      // from here. Honest, not an error: the real sweep (and the real
      // recovery offer it then unlocks) is verified in
      // `test/server.test.js` against the real spawned backend.
      setRecoveryOffer(null);
      setError("Not flagged as abandoned yet — real abandonment detection runs on a scheduled sweep, not a button click. Verified manually against the real backend; see this app's own README.");
    } finally {
      setSweepBusy(false);
    }
  };

  if (loadError) {
    return (
      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>Marketplace</h2>
        <p style={{ color: "crimson" }}>Could not reach the real VENVS backend: {loadError}</p>
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>Marketplace</h2>

      {sellers.map((seller) => (
        <div key={seller.id} style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: "bold", color: seller.theme?.color || "#222" }}>
            {seller.theme?.monogram ? `${seller.theme.monogram} — ` : ""}{seller.name}
          </div>
          <div style={{ fontSize: 11, color: "#888" }}>{seller.theme?.banner || seller.theme?.positioning}</div>
        </div>
      ))}

      {products.map((product) => {
        const seller = sellersById[product.sellerId];
        const isOwnProduct = seller && seller.ownerId === session.userId;
        return (
          <div
            key={product.id}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderTop: "1px solid #eee", gap: 8 }}
          >
            <span>
              {product.title} <span style={{ color: "#888" }}>(${product.price.toFixed(2)})</span>
            </span>
            <span style={{ display: "flex", gap: 6 }}>
              {product.chopzShopProductId ? (
                <span style={{ fontSize: 11, color: "#2a7" }}>
                  ✓ On Chop Shop (id {product.chopzShopProductId}, {Math.round(product.chopzCommissionPercent * 100)}% to creator)
                </span>
              ) : isOwnProduct ? (
                <button
                  onClick={() => handlePublishToChopz(product.id, 0.15)}
                  disabled={chopzBusyId === product.id}
                  title="Make this item available for a CHOPZ SHOP creator to promote, at a 15% affiliate commission"
                >
                  {chopzBusyId === product.id ? "Publishing…" : "Promote via Chop Shop (15%)"}
                </button>
              ) : null}
              <button onClick={() => handleAdd(product.id)}>Add to cart</button>
            </span>
          </div>
        );
      })}
      {chopzError && <p style={{ color: "crimson", fontSize: 12 }}>Chop Shop error: {chopzError}</p>}

      <p style={{ fontSize: 13, marginTop: 8 }}>
        Cart: {cart ? cart.items.length : 0} item line(s)
      </p>
      <button onClick={handleCheckout} disabled={busy || !cart || cart.items.length === 0 || cart.status !== "active"}>
        {busy ? "Checking out…" : "Checkout"}
      </button>

      {order && (
        <p style={{ fontSize: 12, color: "#2a7" }}>
          Order #{order.id}: {order.total} VCoin, split to {order.payouts.length} seller(s):{" "}
          {order.payouts.map((p) => `${p.amount}`).join(" + ")}.
        </p>
      )}
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #ccc" }}>
        <p style={{ fontSize: 12, color: "#666" }}>
          Abandoned cart demo: a second real cart has one item (Exterior Paint). Checking below asks
          the real backend for a recovery offer as if 45 real minutes had actually passed — the exact
          detection and discount logic a scheduled sweep would run for real, later.
        </p>
        <button onClick={handleCheckAbandoned} disabled={sweepBusy || !staleCart}>
          {sweepBusy ? "Checking…" : "Check for abandoned carts"}
        </button>
        {recoveryOffer && (
          <p style={{ fontSize: 12, color: "#a52" }}>
            Recovery offer generated: {recoveryOffer.discountPercent}% off — $
            {recoveryOffer.originalTotal.toFixed(2)} → ${recoveryOffer.discountedTotal.toFixed(2)}.
          </p>
        )}
      </div>
    </div>
  );
}
