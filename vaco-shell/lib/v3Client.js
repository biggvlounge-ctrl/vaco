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


// Atomic settlement: every leg moves, or none does.
//
// **Both stores here split money more than two ways**, and both used to
// pay each party with a separate `await transferVCoin(...)`. A merch
// order is three legs -- fulfilment, brand, platform -- so there were
// two windows in which the second or third could fail after the first
// had already moved money. The order or entitlement record is only
// written after all of them, so a failure left money moved, no record,
// and a customer free to buy again. An app refund is worse still: two
// different payers refund one user, and the retry guard is the
// unwritten `revokedAt`.
//
// `POST /api/vcoin/settle` validates every leg against running balances
// and writes nothing unless all of them pass.
export async function settleVCoin(legs, meta = {}) {
  const res = await fetch(`${V3_API_URL}/api/vcoin/settle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...serviceHeaders(),
      // The settlement reason uniquely names the order or install, so
      // it doubles as the idempotency key: a retried settlement replays
      // V3's first answer rather than charging again. Atomicity stops a
      // *partial* settlement; this stops a *duplicate* one.
      ...(meta.reason ? { 'Idempotency-Key': `settle:${meta.reason}` } : {}),
    },
    body: JSON.stringify({ legs, reason: meta.reason ?? null }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `settleVCoin failed (${res.status})`);
  }
  return body;
}

// **`transferVCoin` is deliberately gone**, not kept alongside. A
// working single-transfer helper is what the next money path in this
// app gets written with, and consecutive calls to it are the shape
// that pays one party and not the next. `settleVCoin([oneLeg], meta)`
// covers the single-leg case with the same guarantee.

export { V3_API_URL };
