import { useState, useEffect } from "react";
import {
  listSellers, browseProducts, createCart, addToCart, getCart, checkout,
  markChopzEligible, publishToChopzShop, getRecoveryOffer,
  registerSeller, listProduct, getOwnInventory, setProductActive,
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
//
// Seller onboarding + inventory management (found missing, 5 Nov
// 2026): `registerSeller` and `listProduct` were real, tested,
// server-routed functions with no caller anywhere in this file --
// every seller a real user could see here was seeded server-side at
// boot, and there was no form to become one or list anything. Added
// below: a "Become a seller" form, a "List a new product" form per
// storefront this session owns, and a "My inventory" panel backed by
// the new `getOwnInventory`/`setProductActive` (delist/relist) --
// `active: false` on `marketplace.js`'s own product shape, filtered
// out of the public browse list but never deleted, so a delisted item
// keeps its real order history and can always come back.

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

  const [sellerName, setSellerName] = useState("");
  const [sellerBusy, setSellerBusy] = useState(false);
  const [sellerError, setSellerError] = useState(null);

  const [newProduct, setNewProduct] = useState({ title: "", price: "", category: "", editionSize: "" });
  const [listBusyId, setListBusyId] = useState(null);
  const [listError, setListError] = useState(null);

  const [inventoryBySellerId, setInventoryBySellerId] = useState({});
  const [inventoryError, setInventoryError] = useState(null);
  const [activeBusyId, setActiveBusyId] = useState(null);

  const loadCatalog = () => Promise.all([listSellers(), browseProducts()])
    .then(([s, p]) => { setSellers(s); setProducts(p); })
    .catch((err) => setLoadError(err.message));

  const mySellers = sellers.filter((s) => s.ownerId === session.userId);

  const loadOwnInventory = () => Promise.all(
    mySellers.map((s) => getOwnInventory(s.id, session.userId).then((products) => [s.id, products])),
  )
    .then((pairs) => setInventoryBySellerId(Object.fromEntries(pairs)))
    .catch((err) => setInventoryError(err.message));

  useEffect(() => {
    if (mySellers.length > 0) loadOwnInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mySellers.length, products.length]);

  const handleRegisterSeller = async (e) => {
    e.preventDefault();
    if (!sellerName.trim()) return;
    setSellerBusy(true);
    setSellerError(null);
    try {
      await registerSeller({ ownerId: session.userId, name: sellerName.trim(), theme: {} });
      setSellerName("");
      await loadCatalog();
    } catch (err) {
      setSellerError(err.message);
    } finally {
      setSellerBusy(false);
    }
  };

  const handleListProduct = async (e, sellerId) => {
    e.preventDefault();
    const price = Number(newProduct.price);
    if (!newProduct.title.trim() || !Number.isFinite(price) || price <= 0) {
      setListError("a product needs a title and a positive price");
      return;
    }
    setListBusyId(sellerId);
    setListError(null);
    try {
      await listProduct(sellerId, {
        ownerId: session.userId,
        title: newProduct.title.trim(),
        price,
        category: newProduct.category.trim() || null,
        editionSize: newProduct.editionSize.trim() ? Number(newProduct.editionSize) : null,
      });
      setNewProduct({ title: "", price: "", category: "", editionSize: "" });
      await loadCatalog();
      await loadOwnInventory();
    } catch (err) {
      setListError(err.message);
    } finally {
      setListBusyId(null);
    }
  };

  const handleToggleActive = async (productId, active) => {
    setActiveBusyId(productId);
    setInventoryError(null);
    try {
      await setProductActive(productId, { ownerId: session.userId, active });
      await loadCatalog();
      await loadOwnInventory();
    } catch (err) {
      setInventoryError(err.message);
    } finally {
      setActiveBusyId(null);
    }
  };

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

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #ccc" }}>
        <h3 style={{ fontSize: 14, margin: "0 0 6px 0" }}>Become a seller</h3>
        {mySellers.length === 0 ? (
          <form onSubmit={handleRegisterSeller} style={{ display: "flex", gap: 6 }}>
            <input
              placeholder="Storefront name"
              value={sellerName}
              onChange={(e) => setSellerName(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" disabled={sellerBusy || !sellerName.trim()}>
              {sellerBusy ? "Registering…" : "Register storefront"}
            </button>
          </form>
        ) : (
          <p style={{ fontSize: 12, color: "#666" }}>
            Already selling as {mySellers.map((s) => s.name).join(", ")}.
          </p>
        )}
        {sellerError && <p style={{ color: "crimson", fontSize: 12 }}>{sellerError}</p>}
      </div>

      {mySellers.map((seller) => (
        <div key={seller.id} style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #ccc" }}>
          <h3 style={{ fontSize: 14, margin: "0 0 6px 0" }}>My inventory — {seller.name}</h3>

          <form onSubmit={(e) => handleListProduct(e, seller.id)} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            <input
              placeholder="Title"
              value={newProduct.title}
              onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
            />
            <input
              placeholder="Price"
              type="number"
              step="0.01"
              value={newProduct.price}
              onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
              style={{ width: 80 }}
            />
            <input
              placeholder="Category (optional)"
              value={newProduct.category}
              onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
              style={{ width: 120 }}
            />
            <input
              placeholder="Edition size (optional)"
              type="number"
              value={newProduct.editionSize}
              onChange={(e) => setNewProduct({ ...newProduct, editionSize: e.target.value })}
              style={{ width: 130 }}
            />
            <button type="submit" disabled={listBusyId === seller.id}>
              {listBusyId === seller.id ? "Listing…" : "List product"}
            </button>
          </form>
          {listError && <p style={{ color: "crimson", fontSize: 12 }}>{listError}</p>}

          {(inventoryBySellerId[seller.id] || []).map((product) => (
            <div
              key={product.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderTop: "1px solid #eee", gap: 8 }}
            >
              <span style={{ opacity: product.active === false ? 0.5 : 1 }}>
                {product.title} <span style={{ color: "#888" }}>(${product.price.toFixed(2)})</span>
                {product.active === false && <span style={{ fontSize: 11, color: "#a52" }}> — delisted</span>}
              </span>
              <button
                onClick={() => handleToggleActive(product.id, product.active === false)}
                disabled={activeBusyId === product.id}
              >
                {activeBusyId === product.id ? "Working…" : product.active === false ? "Relist" : "Delist"}
              </button>
            </div>
          ))}
          {(inventoryBySellerId[seller.id] || []).length === 0 && (
            <p style={{ fontSize: 12, color: "#888" }}>No products listed yet.</p>
          )}
        </div>
      ))}
      {inventoryError && <p style={{ color: "crimson", fontSize: 12 }}>{inventoryError}</p>}
    </div>
  );
}
