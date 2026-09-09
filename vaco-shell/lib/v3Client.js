// VACO — V3 wallet client. Same real, separate-copy pattern every
// other app in the ecosystem uses (VDP, VENVS, HVNTZ, VOID MAGIC,
// VXLLAGE each have their own copy rather than one shared file, since
// every app is an independent client of the same shared ledger). This
// one is ESM because the shell is.
//
// Both stores in this app move real money through it: an app purchase
// pays a publisher and the store, and a merch order pays fulfilment,
// the brand, and the platform.

const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';

// V3 requires every mutating caller to be either a user session or a
// known internal service. This app settles server-to-server, with no
// end-user session to present, so it presents a service credential.
// See v3/lib/serviceAuth.js. Absent in dev, which V3 answers with a
// clear 401 rather than a silent success.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'vaco-shell';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
function serviceHeaders() {
  return VACO_SERVICE_TOKEN
    ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
    : {};
}


// `idempotencyKey` is optional and forwarded to V3 as an
// Idempotency-Key header. When present, V3 replays the first result
// instead of charging again.
export async function transferVCoin(fromUserId, toUserId, amount, reason, idempotencyKey) {
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

export { V3_API_URL };
