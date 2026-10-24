// VENVS -> CHOPZ SHOP: the real HTTP client for registering a seller's
// own product as available for a CHOPZ creator to promote.
//
// Kept separate from marketplace.js for the same reason v3Client.js
// and voidClient.js are separate from shop.js/marketplace.js: this
// file uses `import.meta.env`, which only exists under Vite, so
// marketplace.js's own `publishToChopzShop` takes the call as an
// injected `chopzRegisterFn` and stays plain-Node testable with no
// live network. This file is the one real implementation of that
// function the browser build actually uses.

import { sessionHeaders } from './shieldAuth.js';

const CHOPZ_SHOP_API_URL = import.meta.env.VITE_CHOPZ_SHOP_API_URL || 'http://localhost:8801';

export async function registerWithChopzShop(sellerOwnerId, name, price, category, affiliateCommissionPercent) {
  // POST /chopz-shop/products is requireActor('sellerId') — it demands
  // a real Shield session whose userId matches the body's sellerId, the
  // same actor-binding guard this ecosystem uses everywhere. Without
  // this header the call 401s every time, same silent-failure shape
  // DREAMS' and YAP's frontends shipped with before this session.
  const res = await fetch(`${CHOPZ_SHOP_API_URL}/chopz-shop/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders() },
    body: JSON.stringify({
      sellerId: sellerOwnerId, name, price, category, affiliateCommissionPercent,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `registerWithChopzShop failed (${res.status})`);
  }
  return body;
}
