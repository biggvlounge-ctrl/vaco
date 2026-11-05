// VENVS — Publishing client. `server.cjs` (Phase 17) is this app's
// first real backend for `src/lib/catalog.js`'s own real publish/
// purchase/fulfillment logic; this file is the one real browser
// implementation that calls it, the exact same split
// `marketplaceClient.js` already draws for Marketplace against the
// same server.

import { sessionHeaders } from './shieldAuth.js';

const VENVS_API_URL = import.meta.env?.VITE_VENVS_API_URL || 'http://localhost:8829';

async function handle(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `request failed (${res.status})`);
  }
  return body;
}

export async function publishBook(options) {
  const res = await fetch(`${VENVS_API_URL}/api/publishing/books`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders() },
    body: JSON.stringify(options),
  });
  return handle(res);
}

export async function listBooks({ format, source, query } = {}) {
  const params = new URLSearchParams();
  if (format) params.set('format', format);
  if (source) params.set('source', source);
  if (query) params.set('query', query);
  const qs = params.toString();
  const res = await fetch(`${VENVS_API_URL}/api/publishing/books${qs ? `?${qs}` : ''}`);
  const body = await handle(res);
  return body.books;
}

export async function getBook(bookId) {
  const res = await fetch(`${VENVS_API_URL}/api/publishing/books/${encodeURIComponent(bookId)}`);
  return handle(res);
}

export async function purchaseBook(bookId, { buyerId }) {
  const res = await fetch(`${VENVS_API_URL}/api/publishing/books/${encodeURIComponent(bookId)}/purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders() },
    body: JSON.stringify({ buyerId }),
  });
  return handle(res);
}

export async function getBookOrder(orderId) {
  const res = await fetch(`${VENVS_API_URL}/api/publishing/orders/${encodeURIComponent(orderId)}`);
  return handle(res);
}
