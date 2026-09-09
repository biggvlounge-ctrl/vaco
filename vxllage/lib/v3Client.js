// VXLLAGE -- V3 wallet client. Same real, separate-copy pattern
// established across this session (VDP/VENVS/HVNTZ/VOID MAGIC each
// have their own copy, not one shared file, since every app is a
// real, independent client of the same shared ledger).
//
// This is the first real VCoin-moving feature VXLLAGE has needed --
// Phase 1/2 (Home feed, Villages membership/events/rooms) moved no
// money. Its own README already named this: "VCoin/V3 reconciliation
// -- not needed yet... becomes relevant once Village boost
// economy/cosmetics land." This file, plus lib/villageShop.js, is
// that reconciliation.

const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';

// V3 requires every mutating caller to be either a user session or a
// known internal service. This app settles server-to-server, with no
// end-user session to present, so it presents a service credential.
// See v3/lib/serviceAuth.js. Absent in dev, which V3 answers with a
// clear 401 rather than a silent success.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'vxllage';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
function serviceHeaders() {
  return VACO_SERVICE_TOKEN
    ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
    : {};
}


// `idempotencyKey` is optional and forwarded to V3 as an
// Idempotency-Key header. When present, V3 replays the first
// result instead of charging again. It is deliberately a
// parameter rather than something derived here -- see the note
// at the call sites.
async function transferVCoin(fromUserId, toUserId, amount, reason, idempotencyKey) {
  const res = await fetch(`${V3_API_URL}/api/vcoin/transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...serviceHeaders(),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify({ fromUserId, toUserId, amount, reason }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `transferVCoin failed (${res.status})`);
  }
  return body;
}

module.exports = { transferVCoin };
