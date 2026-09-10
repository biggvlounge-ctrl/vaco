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


// Atomic settlement: every leg moves, or none does.
//
// A multi-party payment written as consecutive transfers can pay one
// party, fail on the next -- often because the first just drew down the
// account it pays from -- and leave the record that marks the work done
// unwritten, so the retry pays the first party again.
//
// `POST /api/vcoin/settle` validates every leg against running balances
// and writes nothing unless all of them pass. `transferVCoin` is
// removed rather than kept beside it.
async function settleVCoin(legs, meta = {}) {
  const res = await fetch(`${V3_API_URL}/api/vcoin/settle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...serviceHeaders(),
      // The settlement reason uniquely names what is being settled, so
      // it doubles as the idempotency key: a retried settlement replays
      // V3's first answer rather than paying twice.
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

module.exports = { settleVCoin };
