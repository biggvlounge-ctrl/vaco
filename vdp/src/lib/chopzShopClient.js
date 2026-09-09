// VDP's real, thin client for CHOPZ SHOP's own separate API -- used
// alongside `chopzClient.js` by `ChopzShortsView.jsx` since a real
// shoppable-video demo genuinely spans both real apps (CHOPZ's own
// server has no "create a product" proxy route to go through, unlike
// Vvltvre Pods' publish-via-Music call). No commerce logic here, every
// real product record comes back from CHOPZ SHOP's own server.

import { sessionHeaders } from "./shieldAuth.js";

const CHOPZ_SHOP_API_URL = import.meta.env?.VITE_CHOPZ_SHOP_API_URL || "http://localhost:8801";

async function requestJson(path, options) {
  const res = await fetch(`${CHOPZ_SHOP_API_URL}${path}`, options);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `${path} failed (${res.status})`);
  }
  return body;
}

export async function createProduct({ sellerId, price, affiliateCommissionPercent, category }) {
  return requestJson("/chopz-shop/products", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({
      sellerId, price, affiliateCommissionPercent, category,
    }),
  });
}
