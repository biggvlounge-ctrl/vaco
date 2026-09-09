import { useState, useCallback, useEffect } from "react";
import { listBrands, listProducts, listOrders, placeOrder } from "../lib/vacoMerchClient.js";

// VDP's real VACO Merch district -- a live client of VACO's own merch
// store: real products across every app brand, and a real order that
// moves real VCoin through V3 in a three-way split (fulfilment cost,
// brand payout, platform fee).
//
// **What this district honestly is not.** No live Printify/Printful/
// Fourthwall API is connected on VACO's side, so an order here is
// recorded and charged but nothing is manufactured or shipped. That is
// stated on the surface rather than left for a user to discover after
// paying -- the same posture the rest of this repo takes about seams
// that are real money but not yet real fulfilment.

export default function VacoMerchView({ session, onPurchase }) {
  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [brandFilter, setBrandFilter] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);

  const userId = session?.userId;

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      listBrands(),
      listProducts(brandFilter),
      userId ? listOrders(userId) : Promise.resolve([]),
    ])
      .then(([nextBrands, nextProducts, nextOrders]) => {
        setBrands(nextBrands);
        setProducts(nextProducts);
        setOrders(nextOrders);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [brandFilter, userId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleOrder(product) {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const order = await placeOrder({
        customerId: userId,
        productId: product.productId,
        quantity: Number(quantities[product.productId] || 1),
      });
      setLastOrder(order);
      refresh();
      // The wallet in VDP's own header is now stale -- same signal
      // every other purchasing district sends.
      if (onPurchase) onPurchase();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px 0" }}>VACO Merch — every app brand, one storefront</h2>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
        Zero inventory: nothing is manufactured until an order exists. Ordering
        charges your real V3 wallet and pays the fulfilment provider, the brand,
        and the platform separately — but no fulfilment API is connected, so
        nothing actually ships.
      </p>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <button onClick={() => setBrandFilter(null)} disabled={loading}
                style={{ fontWeight: brandFilter ? "normal" : "bold" }}>
          All brands
        </button>
        {brands.map((brand) => (
          <button key={brand.appBrandId} onClick={() => setBrandFilter(brand.appBrandId)} disabled={loading}
                  style={{ fontWeight: brandFilter === brand.appBrandId ? "bold" : "normal" }}>
            {brand.appBrandId} ({brand.products})
          </button>
        ))}
      </div>

      {!session && (
        <p style={{ fontSize: 12, color: "#888" }}>Log in above to order.</p>
      )}

      <table style={{ fontSize: 12, borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th style={{ padding: "4px 8px 4px 0" }}>Product</th>
            <th style={{ padding: "4px 8px" }}>Brand</th>
            <th style={{ padding: "4px 8px" }}>Type</th>
            <th style={{ padding: "4px 8px" }}>Price</th>
            <th style={{ padding: "4px 8px" }}>Qty</th>
            <th style={{ padding: "4px 8px" }} />
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.productId} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "4px 8px 4px 0" }}>{product.name}</td>
              <td style={{ padding: "4px 8px" }}>{product.appBrandId}</td>
              <td style={{ padding: "4px 8px" }}>{product.productType}</td>
              <td style={{ padding: "4px 8px" }}>{product.retailPriceVcoin} VC</td>
              <td style={{ padding: "4px 8px" }}>
                <input
                  type="number"
                  min="1"
                  value={quantities[product.productId] || 1}
                  onChange={(e) => setQuantities((q) => ({ ...q, [product.productId]: e.target.value }))}
                  style={{ width: 46 }}
                  aria-label={`Quantity of ${product.name}`}
                />
              </td>
              <td style={{ padding: "4px 8px" }}>
                <button onClick={() => handleOrder(product)} disabled={!session || loading}>
                  Order
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {lastOrder && (
        <p style={{ fontSize: 12, marginTop: 8 }}>
          Order #{lastOrder.id} placed — <strong>{lastOrder.total} VC</strong> charged:{" "}
          {lastOrder.fulfilmentCost} fulfilment, {lastOrder.brandPayout} to{" "}
          {lastOrder.appBrandId}, {lastOrder.platformFee} platform.
        </p>
      )}

      {orders.length > 0 && (
        <p style={{ fontSize: 11, color: "#888", marginTop: 8 }}>
          Your orders: {orders.map((o) => `#${o.id} ${o.status}`).join(", ")}
        </p>
      )}

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </div>
  );
}
