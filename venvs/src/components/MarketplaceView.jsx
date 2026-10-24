import { useState, useMemo } from "react";
import {
  createMarketplace, registerSeller, listProduct, browseProducts,
  createCart, addToCart, getCart, checkout,
  checkAbandonedCarts, generateRecoveryOffer,
  markChopzEligible, publishToChopzShop,
} from "../lib/marketplace.js";
import { seedSvmikoDegvchiStorefronts } from "../lib/svmikoDegvchi.js";
import { transferVCoin } from "../lib/v3Client.js";
import { registerWithChopzShop } from "../lib/chopzClient.js";

// Phase 3 demo: real branded storefronts (2 sellers, each with a
// theme color), a unified browse list, a real cart -> checkout flow
// moving real VCoin split across sellers, and a real abandoned-cart
// recovery demo (a second, deliberately backdated cart + a button
// that runs the actual detection logic). Not the full Marketplace/
// Shop tab UI -- proves the commerce + recovery mechanics against the
// real wallet, same posture as Phase 2's PublishingView.
//
// Phase 11: SVMIKO DEGVCHI, the ecosystem's first real clothing lines,
// seeded here as 13 real, additional storefronts -- appended after
// the original two demo sellers (not replacing them; `staleCart`
// below still relies on `products[1]`'s index, which stays stable
// since the new products are appended, not inserted).

export default function MarketplaceView({ session, onPurchase }) {
  const marketplace = useMemo(() => {
    const mp = createMarketplace();
    const hardware = registerSeller(mp, {
      name: "Cherokee Hardware Co.",
      ownerId: "seller-hardware",
      theme: { color: "#2a7d4f", banner: "Est. 1962 — Cherokee St" },
    });
    const vinyl = registerSeller(mp, {
      name: "Riverfront Vinyl",
      ownerId: "seller-vinyl",
      theme: { color: "#a8452e", banner: "New & used pressings" },
    });
    listProduct(mp, { sellerId: hardware.id, title: "Claw Hammer", price: 18.5, category: "tools" });
    listProduct(mp, { sellerId: hardware.id, title: "Exterior Paint (1gal)", price: 34.0, category: "paint" });
    listProduct(mp, { sellerId: vinyl.id, title: "Local Pressing LP", price: 22.0, category: "music" });
    seedSvmikoDegvchiStorefronts(mp);
    return mp;
  }, []);

  const [cart, setCart] = useState(() => createCart(marketplace, { buyerId: session.userId }));
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [staleCart] = useState(() => {
    const c = createCart(marketplace, { buyerId: session.userId });
    addToCart(marketplace, c.id, marketplace.products[1].id); // the paint
    c.lastActivityAt = Date.now() - 45 * 60 * 1000; // simulate 45 min of inactivity
    return c;
  });
  const [recoveryOffer, setRecoveryOffer] = useState(null);

  // Chop Shop promotion: a seller opts specific items in (not the whole
  // catalogue), sets what a creator earns per sale, and this registers
  // the real product over in CHOPZ SHOP under the seller's own payout
  // identity (`ownerId`) so attribution and payout agree across apps.
  const [chopzBusyId, setChopzBusyId] = useState(null);
  const [chopzError, setChopzError] = useState(null);
  const [, forceRerender] = useState(0);

  const handlePublishToChopz = async (productId, commissionPercent) => {
    setChopzBusyId(productId);
    setChopzError(null);
    try {
      markChopzEligible(marketplace, productId, commissionPercent);
      await publishToChopzShop(marketplace, productId, { chopzRegisterFn: registerWithChopzShop });
      forceRerender((n) => n + 1);
    } catch (err) {
      setChopzError(err.message);
    } finally {
      setChopzBusyId(null);
    }
  };

  const transferFn = (from, to, amount, reason) =>
    transferVCoin({ fromUserId: from, toUserId: to, amount, reason });

  const handleAdd = (productId) => {
    addToCart(marketplace, cart.id, productId);
    setCart({ ...getCart(marketplace, cart.id) });
  };

  const handleCheckout = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await checkout(marketplace, { cartId: cart.id, transferFn });
      setOrder(result);
      await onPurchase();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCheckAbandoned = () => {
    const abandoned = checkAbandonedCarts(marketplace);
    if (abandoned.some((c) => c.id === staleCart.id)) {
      setRecoveryOffer(generateRecoveryOffer(marketplace, staleCart.id, { discountPercent: 15 }));
    }
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>Marketplace</h2>

      {marketplace.sellers.map((seller) => (
        <div key={seller.id} style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: "bold", color: seller.theme.color || "#222" }}>
            {seller.theme.monogram ? `${seller.theme.monogram} — ` : ""}{seller.name}
          </div>
          <div style={{ fontSize: 11, color: "#888" }}>{seller.theme.banner || seller.theme.positioning}</div>
        </div>
      ))}

      {browseProducts(marketplace).map((product) => (
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
            ) : (
              <button
                onClick={() => handlePublishToChopz(product.id, 0.15)}
                disabled={chopzBusyId === product.id}
                title="Make this item available for a CHOPZ SHOP creator to promote, at a 15% affiliate commission"
              >
                {chopzBusyId === product.id ? "Publishing…" : "Promote via Chop Shop (15%)"}
              </button>
            )}
            <button onClick={() => handleAdd(product.id)}>Add to cart</button>
          </span>
        </div>
      ))}
      {chopzError && <p style={{ color: "crimson", fontSize: 12 }}>Chop Shop error: {chopzError}</p>}

      <p style={{ fontSize: 13, marginTop: 8 }}>
        Cart: {cart.items.length} item line(s)
      </p>
      <button onClick={handleCheckout} disabled={busy || cart.items.length === 0 || cart.status !== "active"}>
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
          Abandoned cart demo: a second cart has one item (Exterior Paint) and its last-activity
          timestamp was backdated 45 minutes to simulate a real stale cart.
        </p>
        <button onClick={handleCheckAbandoned}>Check for abandoned carts</button>
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
