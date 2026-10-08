// VDP — Dissent: real opposition to the AI government.
//
// Direct instruction (8 Oct 2026): "multiple people who, as they come
// into the world, will try to revolt against the technology being
// the government." A real, named collective action -- not a
// civil-war simulation. VACON-C's own `server/politics.js` already
// owns revolutions at civilization scale; this is VDP's own small,
// real record of its own small world, the same "borrow the shape, not
// the scale" discipline `npcs.js`/`skills.js` already apply.
//
// Who actually arrives already opposed to AI rule is
// `immigration.js`'s own concern (`dissident`, set per-arrival or
// across a migration wave) -- this module only tracks the real,
// organized act of revolting once someone decides to, not who is
// predisposed to.

export function createDissentStore() {
  return { revolts: [], nextRevoltId: 1 };
}

export function organizeRevolt(store, { leaderId, participantIds = [], reason, now = Date.now() } = {}) {
  if (!leaderId) throw new Error('organizeRevolt requires a leaderId');
  if (!reason) throw new Error('organizeRevolt requires a reason');

  const revolt = {
    id: store.nextRevoltId++,
    leaderId,
    // The leader is always a real participant, listed once even if
    // also named in `participantIds`.
    participantIds: [...new Set([leaderId, ...participantIds])],
    reason,
    organizedAt: now,
    suppressedAt: null,
  };
  store.revolts.push(revolt);
  return revolt;
}

export function listActiveRevolts(store) {
  return store.revolts.filter((r) => !r.suppressedAt);
}

export function revoltsInvolving(store, personId) {
  return store.revolts.filter((r) => r.participantIds.includes(personId));
}

// The governors' own real response -- named and recorded the same
// way every other enforcement outcome in this app already is
// (`immigration.js`'s `clearIllegalSettlement`, `justice.js`'s
// `releasePerson`). What suppression actually costs anyone is not
// specified and not invented here.
export function suppressRevolt(store, revoltId, { suppressedBy, now = Date.now() } = {}) {
  const revolt = store.revolts.find((r) => r.id === revoltId);
  if (!revolt) throw new Error(`suppressRevolt: no revolt #${revoltId}`);
  if (revolt.suppressedAt) throw new Error(`suppressRevolt: revolt #${revoltId} is already suppressed`);
  revolt.suppressedAt = now;
  revolt.suppressedBy = suppressedBy || null;
  return revolt;
}
