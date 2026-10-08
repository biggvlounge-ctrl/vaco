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
//
// **Uprisings (8 Oct 2026, same session)**: "certain people will
// fight against [the robots] if they have a big enough tribe group
// organization" -- `attemptUprising` below is the real mechanic, a
// revolt's leader's own real `organizations.js` group measured
// against `security.js`'s own real `robotCount`, not an invented
// combat system.

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
// specified and not invented here. A revolt that already overpowered
// security (below) cannot be walked back by this -- the robots that
// would suppress it are the real ones it just pushed back.
export function suppressRevolt(store, revoltId, { suppressedBy, now = Date.now() } = {}) {
  const revolt = store.revolts.find((r) => r.id === revoltId);
  if (!revolt) throw new Error(`suppressRevolt: no revolt #${revoltId}`);
  if (revolt.suppressedAt) throw new Error(`suppressRevolt: revolt #${revoltId} is already suppressed`);
  if (revolt.overpoweredAt) {
    throw new Error(`suppressRevolt: revolt #${revoltId} already overpowered security and cannot be suppressed`);
  }
  revolt.suppressedAt = now;
  revolt.suppressedBy = suppressedBy || null;
  return revolt;
}

// "Certain people will fight against [the robots] if they have a big
// enough tribe group organization" (8 Oct 2026, direct instruction).
// `organization` is `organizations.js`'s own real record (injected,
// never imported, the same decoupling every module in this file
// already keeps) for the revolt leader's real group -- its
// `memberIds.length` IS the "big enough" this instruction asks for,
// never a second, invented revolt-strength number. `security` is
// `security.js`'s own real current tier -- its real `robotCount` is
// the one threshold already in this world, never an invented "robot
// strength" stat.
export function canOverpowerSecurity(organization, security) {
  if (!organization || !security) return false;
  return organization.memberIds.length >= security.robotCount;
}

export function attemptUprising(store, revoltId, { organization, security, now = Date.now() } = {}) {
  const revolt = store.revolts.find((r) => r.id === revoltId);
  if (!revolt) throw new Error(`attemptUprising: no revolt #${revoltId}`);
  if (revolt.suppressedAt) throw new Error(`attemptUprising: revolt #${revoltId} is already suppressed`);
  if (revolt.overpoweredAt) throw new Error(`attemptUprising: revolt #${revoltId} already overpowered security`);
  if (!organization) throw new Error('attemptUprising requires the leader\'s real organization');
  if (!security) throw new Error('attemptUprising requires the real current security tier');
  if (!canOverpowerSecurity(organization, security)) {
    throw new Error(
      `attemptUprising: "${organization.name}" (${organization.memberIds.length}) is not yet big enough `
      + `to overpower ${security.robotCount} robots`,
    );
  }
  revolt.overpoweredAt = now;
  revolt.overpoweredByOrganizationId = organization.id;
  return revolt;
}

export function listOverpoweredRevolts(store) {
  return store.revolts.filter((r) => r.overpoweredAt);
}
