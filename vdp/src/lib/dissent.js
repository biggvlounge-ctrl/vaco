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
//
// **Robot type and "what type of people" (9 Oct 2026), per direct
// instruction**: "it takes a lot of people to overpower certain
// robots, and depending on what type of robot and how many people and
// what type of people -- it does stand for athletics and the strategy
// to go against the robot." Two real, optional refinements over the
// plain headcount-vs-robotCount check above, both strictly additive --
// omitting either one leaves the original 8 Oct behavior exactly
// unchanged, which is what every existing caller/test still does:
//   - `robotType` (`robots.js`'s own real type, e.g. via
//     `robotTypeForSecurityTier`) scales how much strength is needed
//     to overpower EACH robot in the count, via its own real
//     `overpowerStrength` -- a Maximum Security tier's military
//     robots take real, meaningfully more to overpower than a Basic
//     tier's patrol drones, not the same flat `robotCount` regardless
//     of type.
//   - `athleticsScores` (the real `skills.js` Athletics value for as
//     many of the organization's real members as the caller can
//     supply) turns "what type of people" into real combined strength
//     rather than a head being a head: a member with a real, high
//     Athletics score counts for more than one. "Strategy" is named
//     by the instruction but not specified as any further real stat or
//     roll anywhere in this app -- not invented here; Athletics is the
//     one real number this world already tracks that the instruction
//     names by name.
// `OVERPOWER_ATHLETICS_BONUS_CAP` is a flagged interpretive number,
// same footing `overpowerStrength` in `robots.js` already stands on.

const OVERPOWER_ATHLETICS_BONUS_CAP = 1; // up to one extra "effective person" at Athletics 100

function clampAthletics(score) {
  return Math.max(0, Math.min(100, score));
}

// Real combined strength: every member with a real Athletics score on
// record contributes 1 (just being there) plus up to
// `OVERPOWER_ATHLETICS_BONUS_CAP` more, scaled by how high that real
// score is; a member with no score supplied still counts as exactly
// one person, never zero or guessed at. With no `athleticsScores` at
// all, this is exactly `organization.memberIds.length` -- the original
// 8 Oct behavior, unchanged.
export function combinedStrength(organization, { athleticsScores } = {}) {
  if (!organization) return 0;
  if (!athleticsScores || athleticsScores.length === 0) return organization.memberIds.length;
  const scored = athleticsScores.reduce(
    (sum, score) => sum + 1 + (clampAthletics(score) / 100) * OVERPOWER_ATHLETICS_BONUS_CAP,
    0,
  );
  const unscored = Math.max(0, organization.memberIds.length - athleticsScores.length);
  return scored + unscored;
}

// Real strength required: `security.robotCount` real robots, each
// needing `robotType.overpowerStrength` combined strength to overpower
// -- with no `robotType` given, that multiplier is 1, so this is
// exactly `security.robotCount` -- the original 8 Oct behavior,
// unchanged.
export function requiredStrength(security, { robotType } = {}) {
  if (!security) return 0;
  const multiplier = robotType ? robotType.overpowerStrength : 1;
  return security.robotCount * multiplier;
}

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
export function canOverpowerSecurity(organization, security, options = {}) {
  if (!organization || !security) return false;
  return combinedStrength(organization, options) >= requiredStrength(security, options);
}

export function attemptUprising(store, revoltId, {
  organization, security, robotType, athleticsScores, now = Date.now(),
} = {}) {
  const revolt = store.revolts.find((r) => r.id === revoltId);
  if (!revolt) throw new Error(`attemptUprising: no revolt #${revoltId}`);
  if (revolt.suppressedAt) throw new Error(`attemptUprising: revolt #${revoltId} is already suppressed`);
  if (revolt.overpoweredAt) throw new Error(`attemptUprising: revolt #${revoltId} already overpowered security`);
  if (!organization) throw new Error('attemptUprising requires the leader\'s real organization');
  if (!security) throw new Error('attemptUprising requires the real current security tier');
  const options = { robotType, athleticsScores };
  if (!canOverpowerSecurity(organization, security, options)) {
    throw new Error(
      `attemptUprising: "${organization.name}" (strength ${combinedStrength(organization, options)}) is not yet big `
      + `enough to overpower ${security.robotCount} ${robotType ? robotType.name : 'robot'}(s) `
      + `(needs ${requiredStrength(security, options)})`,
    );
  }
  revolt.overpoweredAt = now;
  revolt.overpoweredByOrganizationId = organization.id;
  revolt.overpoweredRobotTypeId = robotType ? robotType.id || null : null;
  return revolt;
}

export function listOverpoweredRevolts(store) {
  return store.revolts.filter((r) => r.overpoweredAt);
}
