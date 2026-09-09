// VDP's real, thin client for VACO's own Merch Store API -- same
// posture as every other district client: no pricing, no split, and no
// order-lifecycle logic here. Every number below comes back from
// VACO's own server, which settles the three-way split through V3.
//
// **Why the merch store is inside VDP at all**, since it already has a
// surface in the shell: VDP is the walkable layer where an avatar
// already wears SVMIKO DEGVCHI pieces in the Fashion District. Merch
// is the same act pointed at the physical world -- the thing you can
// buy for the person rather than the avatar. Putting it anywhere else
// in VDP would have made it a second, unrelated shop.

import { sessionHeaders } from "./shieldAuth.js";

const VACO_API_URL = import.meta.env?.VITE_VACO_API_URL || "http://localhost:8789";

async function requestJson(path, options) {
  const res = await fetch(`${VACO_API_URL}${path}`, options);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `${path} failed (${res.status})`);
  }
  return body;
}

export async function listBrands() {
  const body = await requestJson("/api/merch/brands");
  return body.brands;
}

export async function listProducts(appBrandId) {
  const query = appBrandId ? `?brand=${encodeURIComponent(appBrandId)}` : "";
  const body = await requestJson(`/api/merch/products${query}`);
  return body.products;
}

export async function listOrders(customerId) {
  const body = await requestJson(`/api/merch/customers/${encodeURIComponent(customerId)}/orders`);
  return body.orders;
}

// Real money: this charges the signed-in user's V3 wallet and pays the
// fulfilment provider, the app brand, and the platform separately.
export async function placeOrder({ customerId, productId, quantity }) {
  return requestJson("/api/merch/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ customerId, productId, quantity }),
  });
}
