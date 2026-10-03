// VDP -- The Vavlt, VDP's own nightclub district.
//
// A brand-new venue type, not the existing Vavlt Stvdios app (live
// streaming/screen-sessions) -- confirmed directly before building
// this, since the two share a root brand name on purpose ("stay on
// brand") but must never be confused with each other on screen or in
// code. Branded "The Vavlt at <town.js's TOWN_NAME>", the same
// per-town naming VXLLAGE's residential complex uses.
//
// **Real, deliberate content choice**: there is no separate standalone
// "Vavlt" app to integrate with the way Dating Village integrates with
// CVNVO's real BarBuddy mechanic, so this is VDP-native -- a real,
// fixed venue with a real cover charge (paid once, through V3, same
// claim-before-pay/rollback-on-failure ordering every other real money
// movement this session uses) and a real "who's here right now" list,
// the smallest honest shape a nightclub actually has: you pay to get
// in, and the point is seeing who else is inside.

import { TOWN_NAME } from './town.js';

export const VENUE_NAME = `The Vavlt at ${TOWN_NAME}`;
export const VENUE_ACCOUNT_ID = 'the-vavlt-meridian';
export const COVER_CHARGE = 20;

// Presence expires rather than lingering forever -- a club's "who's
// here" list means right now, not "everyone who ever paid cover."
export const PRESENCE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export function createVavltStore() {
  return { presence: {} }; // userId -> { checkedInAt }
}

export function listPresent(store, now = Date.now()) {
  return Object.entries(store.presence)
    .filter(([, p]) => now - p.checkedInAt < PRESENCE_DURATION_MS)
    .map(([userId]) => userId);
}

function isPresent(store, userId, now) {
  const p = store.presence[userId];
  return !!p && now - p.checkedInAt < PRESENCE_DURATION_MS;
}

// Claim before pay, same ordering `property.js`/`degvchi.js` already
// proved: presence is recorded before the cover charge is awaited,
// rolled back on a declined charge.
export async function checkIn(store, { ownerId, transferFn, now = Date.now() } = {}) {
  if (!ownerId) throw new Error('checkIn requires an ownerId');
  if (isPresent(store, ownerId, now)) {
    throw new Error(`checkIn: "${ownerId}" is already checked in`);
  }
  if (typeof transferFn !== 'function') throw new Error('checkIn requires a transferFn');

  const previous = store.presence[ownerId];
  store.presence[ownerId] = { checkedInAt: now };

  try {
    await transferFn({ fromUserId: ownerId, amount: COVER_CHARGE, reason: 'vdp-vavlt-cover' });
  } catch (err) {
    if (previous) store.presence[ownerId] = previous;
    else delete store.presence[ownerId];
    throw err;
  }

  return { venue: VENUE_NAME, present: listPresent(store, now) };
}

// No refund on leaving early -- the cover already paid for entry, the
// same way a real club works.
export function checkOut(store, { ownerId }) {
  if (!store.presence[ownerId]) {
    throw new Error(`checkOut: "${ownerId}" is not checked in`);
  }
  delete store.presence[ownerId];
}
