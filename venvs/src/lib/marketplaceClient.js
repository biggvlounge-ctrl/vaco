// VENVS — Marketplace client. `server.cjs` (Phase 14) is this app's
// first real backend for `src/lib/marketplace.js`'s own real
// storefront/cart/checkout logic; this file is the one real browser
// implementation that calls it, the same split `v3Client.js` already
// draws against V3's own ledger and `voidClient.js` against VOID.
//
// Mirrors `v3Client.js`'s own exact conventions: `import.meta.env`
// for the base URL (only exists under Vite), `sessionHeaders()` for
// the real Shield bearer token on every route that needs one.

import { sessionHeaders } from './shieldAuth.js';

const VENVS_API_URL = import.meta.env?.VITE_VENVS_API_URL || 'http://localhost:8829';

async function handle(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `request failed (${res.status})`);
  }
  return body;
}

export async function registerSeller({ ownerId, name, theme }) {
  const res = await fetch(`${VENVS_API_URL}/api/marketplace/sellers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders() },
    body: JSON.stringify({ ownerId, name, theme }),
  });
  return handle(res);
}

export async function listSellers() {
  const res = await fetch(`${VENVS_API_URL}/api/marketplace/sellers`);
  const body = await handle(res);
  return body.sellers;
}

export async function getSellerStorefront(sellerId) {
  const res = await fetch(`${VENVS_API_URL}/api/marketplace/sellers/${encodeURIComponent(sellerId)}`);
  return handle(res);
}

export async function browseProducts({ category, sellerId } = {}) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (sellerId !== undefined && sellerId !== null) params.set('sellerId', sellerId);
  const qs = params.toString();
  const res = await fetch(`${VENVS_API_URL}/api/marketplace/products${qs ? `?${qs}` : ''}`);
  const body = await handle(res);
  return body.products;
}

export async function listProduct(sellerId, { ownerId, title, price, category, editionSize }) {
  const res = await fetch(`${VENVS_API_URL}/api/marketplace/sellers/${encodeURIComponent(sellerId)}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders() },
    body: JSON.stringify({ ownerId, title, price, category, editionSize }),
  });
  return handle(res);
}

export async function createCart({ buyerId }) {
  const res = await fetch(`${VENVS_API_URL}/api/marketplace/carts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders() },
    body: JSON.stringify({ buyerId }),
  });
  return handle(res);
}

export async function addToCart(cartId, { buyerId, productId, quantity = 1 }) {
  const res = await fetch(`${VENVS_API_URL}/api/marketplace/carts/${encodeURIComponent(cartId)}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders() },
    body: JSON.stringify({ buyerId, productId, quantity }),
  });
  return handle(res);
}

export async function getCart(cartId, buyerId) {
  const res = await fetch(
    `${VENVS_API_URL}/api/marketplace/carts/${encodeURIComponent(cartId)}?buyerId=${encodeURIComponent(buyerId)}`,
    { headers: { ...sessionHeaders() } },
  );
  return handle(res);
}

export async function checkout({ cartId, buyerId }) {
  const res = await fetch(`${VENVS_API_URL}/api/marketplace/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders() },
    body: JSON.stringify({ cartId, buyerId }),
  });
  return handle(res);
}

export async function markChopzEligible(productId, { ownerId, affiliateCommissionPercent }) {
  const res = await fetch(`${VENVS_API_URL}/api/marketplace/products/${encodeURIComponent(productId)}/chopz-eligible`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders() },
    body: JSON.stringify({ ownerId, affiliateCommissionPercent }),
  });
  return handle(res);
}

export async function publishToChopzShop(productId, { ownerId }) {
  const res = await fetch(`${VENVS_API_URL}/api/marketplace/products/${encodeURIComponent(productId)}/publish-to-chopz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders() },
    body: JSON.stringify({ ownerId }),
  });
  return handle(res);
}

export async function getRecoveryOffer(cartId, { discountPercent } = {}) {
  const qs = discountPercent !== undefined ? `?discountPercent=${encodeURIComponent(discountPercent)}` : '';
  const res = await fetch(`${VENVS_API_URL}/api/marketplace/carts/${encodeURIComponent(cartId)}/recovery-offer${qs}`);
  return handle(res);
}
