// VDP — Immigration: legal and illegal entry to the settlement.
//
// Direct instruction (8 Oct 2026): the settlement stays open but
// controlled -- "we will also try to keep a controlled atmosphere of
// passports coming into this new world," spanning "all different type
// of religions, people from everywhere" -- and that control has a real
// seam: "people find other ways to get across the ice wall as well,"
// bringing "things from the old world, guns, things like that," and
// "people are bringing the chaos from the old world to the new world.
// You have all your different characteristics, statistics, and things
// like that." Two entry methods, one real arrival record, not two
// parallel shapes -- a robot patrol (see `jobs.js`'s
// `robot-patrol-officer`) reads one `arrivals` list either way.
//
// `originRegion`/`religion` are free text, not a fixed invented list
// -- "all different types of religions, people from everywhere" is the
// instruction's own open phrasing, and inventing a closed enum of real
// world religions/regions here would be exactly the kind of fact this
// project refuses to assert about anything real. `smuggledGoods` is
// the same: free text, "guns, things like that" is the instruction's
// own example, not a catalog this module invents the rest of.
//
// `oldWorldSkills`/`oldWorldBeliefs` are optional, recorded verbatim on
// the arrival rather than applied here -- carrying stats across is a
// player-seeding decision (`server.cjs`'s `ensurePlayer`), this module
// only keeps the real record of what a migrant said they brought.
//
// No hidden detection roll anywhere below -- this project's own
// standing rule against inventing a simulation threshold applies here
// the same as everywhere else. "A new spot found" and "someone caught"
// are real, named actions a robot patrol (a player clocked into that
// job) performs on purpose, never a probability this module rolls on
// its own.
//
// Illegal settlements and a single unauthorized structure are kept
// separate on purpose: a settlement is a standing claim to live
// somewhere outside the governors' own footprint (this module's own
// concern, legal standing), a structure is `property.js`'s own
// concern (a thing built). `property.js`'s `buildUnauthorized` and
// this module's `foundIllegalSettlement` are siblings, not one
// function wearing two names.

// **Citizenship vs. temporary passport (8 Oct 2026), per direct
// instruction**: "users will be able to apply for citizenship or they
// can apply for a temporary passport that only lasts so long." Both
// are the same real `admitWithPassport` gate -- `citizenshipType` is
// the one new field that tells them apart, not a second shape.
// `TEMPORARY_PASSPORT_DURATION_MS` is a flagged interpretive number,
// same footing `resources.js`'s `DIG_COOLDOWN_MS` already stands on --
// no document gives VDP a real visa length.
export const CITIZENSHIP_TYPES = ['citizenship', 'temporary'];
export const TEMPORARY_PASSPORT_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export function createImmigrationStore() {
  return {
    arrivals: [],
    nextArrivalId: 1,
    smugglingSpots: [],
    nextSpotId: 1,
    illegalSettlements: [],
    nextSettlementId: 1,
  };
}

function requireNoExistingArrival(store, personId, fnName) {
  if (store.arrivals.some((a) => a.personId === personId)) {
    throw new Error(`${fnName}: "${personId}" has already been recorded arriving`);
  }
}

// The controlled gate: a real passport record, carrying whatever real
// old-world background the migrant brings with them. `citizenshipType`
// defaults to permanent citizenship, same as every caller before this
// field existed got (`applyForCitizenship` below is the same default,
// spelled out); choosing `'temporary'` sets a real `expiresAt`.
export function admitWithPassport(store, {
  personId, originRegion, religion, oldWorldSkills, oldWorldBeliefs,
  citizenshipType = 'citizenship', now = Date.now(),
} = {}) {
  if (!personId) throw new Error('admitWithPassport requires a personId');
  requireNoExistingArrival(store, personId, 'admitWithPassport');
  if (!CITIZENSHIP_TYPES.includes(citizenshipType)) {
    throw new Error(`admitWithPassport: "${citizenshipType}" is not a known citizenship type (expected one of ${CITIZENSHIP_TYPES.join(', ')})`);
  }

  const arrival = {
    id: store.nextArrivalId++,
    personId,
    method: 'passport',
    legal: true,
    citizenshipType,
    expiresAt: citizenshipType === 'temporary' ? now + TEMPORARY_PASSPORT_DURATION_MS : null,
    originRegion: originRegion || null,
    religion: religion || null,
    smuggledGoods: [],
    oldWorldSkills: oldWorldSkills || null,
    oldWorldBeliefs: oldWorldBeliefs || null,
    caught: false,
    arrivedAt: now,
  };
  store.arrivals.push(arrival);
  return arrival;
}

// Two named, player-facing applications, per the instruction's own
// words -- both are exactly `admitWithPassport` with the matching
// `citizenshipType` already chosen, not a second real gate.
export function applyForCitizenship(store, options = {}) {
  return admitWithPassport(store, { ...options, citizenshipType: 'citizenship' });
}

export function applyForTemporaryPassport(store, options = {}) {
  return admitWithPassport(store, { ...options, citizenshipType: 'temporary' });
}

// A temporary passport "only lasts so long" -- a real, checkable fact
// about an existing arrival, not a status this module enforces on its
// own (no document says what happens on expiry; that consequence is
// not specified and not invented here, same discipline the founding
// document already applies to what happens to someone a robot patrol
// catches).
export function isPassportExpired(store, personId, now = Date.now()) {
  const arrival = arrivalFor(store, personId);
  if (!arrival) throw new Error(`isPassportExpired: no arrival recorded for "${personId}"`);
  return arrival.expiresAt !== null && arrival.expiresAt !== undefined && now >= arrival.expiresAt;
}

// "People find other ways to get across the ice wall as well" -- the
// same real arrival record, flagged `legal: false`.
export function crossIllegally(store, {
  personId, originRegion, religion, smuggledGoods = [], oldWorldSkills, oldWorldBeliefs, now = Date.now(),
} = {}) {
  if (!personId) throw new Error('crossIllegally requires a personId');
  requireNoExistingArrival(store, personId, 'crossIllegally');

  const arrival = {
    id: store.nextArrivalId++,
    personId,
    method: 'illegal_crossing',
    legal: false,
    // An illegal crossing applies for nothing -- no citizenship type,
    // no expiry, the same uniform shape `admitWithPassport` returns so
    // a caller never has to branch on `method` just to read a field.
    citizenshipType: null,
    expiresAt: null,
    originRegion: originRegion || null,
    religion: religion || null,
    smuggledGoods: [...smuggledGoods],
    oldWorldSkills: oldWorldSkills || null,
    oldWorldBeliefs: oldWorldBeliefs || null,
    caught: false,
    arrivedAt: now,
  };
  store.arrivals.push(arrival);
  return arrival;
}

export function arrivalFor(store, personId) {
  return store.arrivals.find((a) => a.personId === personId) || null;
}

export function listArrivals(store) {
  return store.arrivals;
}

export function listIllegalArrivals(store) {
  return store.arrivals.filter((a) => !a.legal);
}

// A robot patrol catching someone already recorded as having crossed
// illegally -- a real outcome on an existing record, not a second
// "crime" system (VACON-C's own `server/justice.js` already owns
// arrest/court/prison at civilization scale; this is VDP's own small,
// real record of its own small world).
export function catchIllegalArrival(store, personId, { caughtBy, now = Date.now() } = {}) {
  const arrival = arrivalFor(store, personId);
  if (!arrival) throw new Error(`catchIllegalArrival: no arrival recorded for "${personId}"`);
  if (arrival.legal) throw new Error(`catchIllegalArrival: "${personId}"'s arrival is legal`);
  if (arrival.caught) throw new Error(`catchIllegalArrival: "${personId}" is already recorded caught`);
  arrival.caught = true;
  arrival.caughtBy = caughtBy || null;
  arrival.caughtAt = now;
  return arrival;
}

// "A new spot found where people are sneaking in" -- a real, named
// discovery. Starts open; sealing it is a separate real act, so
// "found" and "closed" are two events, not one guessed-at moment.
export function reportSmugglingSpot(store, { locationLabel, reportedBy, now = Date.now() } = {}) {
  if (!locationLabel) throw new Error('reportSmugglingSpot requires a locationLabel');
  const spot = {
    id: store.nextSpotId++,
    locationLabel,
    reportedBy: reportedBy || null,
    sealed: false,
    reportedAt: now,
  };
  store.smugglingSpots.push(spot);
  return spot;
}

export function sealSmugglingSpot(store, spotId, { sealedBy, now = Date.now() } = {}) {
  const spot = store.smugglingSpots.find((s) => s.id === spotId);
  if (!spot) throw new Error(`sealSmugglingSpot: no smuggling spot #${spotId}`);
  if (spot.sealed) throw new Error(`sealSmugglingSpot: spot #${spotId} is already sealed`);
  spot.sealed = true;
  spot.sealedBy = sealedBy || null;
  spot.sealedAt = now;
  return spot;
}

export function listOpenSmugglingSpots(store) {
  return store.smugglingSpots.filter((s) => !s.sealed);
}

// "People will start illegal settlements" -- a standing claim to live
// somewhere outside the governors' own controlled footprint.
export function foundIllegalSettlement(store, { founderId, locationLabel, now = Date.now() } = {}) {
  if (!founderId) throw new Error('foundIllegalSettlement requires a founderId');
  if (!locationLabel) throw new Error('foundIllegalSettlement requires a locationLabel');
  const settlement = {
    id: store.nextSettlementId++,
    founderId,
    locationLabel,
    clearedAt: null,
    foundedAt: now,
  };
  store.illegalSettlements.push(settlement);
  return settlement;
}

export function clearIllegalSettlement(store, settlementId, { clearedBy, now = Date.now() } = {}) {
  const settlement = store.illegalSettlements.find((s) => s.id === settlementId);
  if (!settlement) throw new Error(`clearIllegalSettlement: no illegal settlement #${settlementId}`);
  if (settlement.clearedAt) throw new Error(`clearIllegalSettlement: settlement #${settlementId} is already cleared`);
  settlement.clearedAt = now;
  settlement.clearedBy = clearedBy || null;
  return settlement;
}

export function listActiveIllegalSettlements(store) {
  return store.illegalSettlements.filter((s) => !s.clearedAt);
}

// **Migration waves (8 Oct 2026), per direct instruction**: "NPCs will
// be picking a certain amount of NPCs to be coming over legally and
// illegally... we will just grow the planet off of that, just a
// mixture of different parts of the world coming into this new
// planet... however you choose to mix it, that makes it a good blend
// based on population, type of person, and how many people survived
// in that reset." Three real inputs, not one invented number:
// `survivorPopulation` is the caller's own real figure for how many
// people survived VACANCY's reset (`VDP_FOUNDING.md`'s "The old-world
// event, named") -- not specified anywhere yet, so this module never
// invents it, only scales off whatever real number it is given.
// `waveFraction`/`legalFraction` are flagged interpretive numbers, the
// same footing every other unspecified constant in this directory
// already stands on. `originRegions`/`religions`/`smuggledGoodsPool`
// are the caller's own real pools -- "a good blend" is chosen by
// whoever calls this with real data, never a closed list this module
// invents on its own.
//
// This module creates no NPC of its own and does not import
// `npcs.js` -- the same decoupled-by-injection shape every other
// cross-module call in this directory already uses (`transferFn`,
// `grantMaterialsFn`, ...). `onNewMigrant(index)` is the caller's own
// real side effect (through `server.cjs`: `npcs.addNpcToWorld`) that
// actually grows the server-ticked population and returns the new
// arrival's real personId.
export const DEFAULT_WAVE_FRACTION = 0.05;
export const DEFAULT_LEGAL_FRACTION = 0.7;
export const DEFAULT_SMUGGLING_FRACTION = 0.3;

function pickFrom(pool, rng) {
  return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
}

export function generateMigrationWave(store, {
  survivorPopulation, waveFraction = DEFAULT_WAVE_FRACTION, legalFraction = DEFAULT_LEGAL_FRACTION,
  originRegions = [], religions = [], smuggledGoodsPool = [],
  onNewMigrant, rng = Math.random, now = Date.now(),
} = {}) {
  if (!Number.isInteger(survivorPopulation) || survivorPopulation < 0) {
    throw new Error('generateMigrationWave requires a non-negative integer survivorPopulation');
  }
  if (typeof onNewMigrant !== 'function') {
    throw new Error('generateMigrationWave requires an onNewMigrant(index) => personId callback -- this module creates no NPC of its own');
  }

  const waveSize = Math.round(survivorPopulation * waveFraction);
  const arrivals = [];
  for (let i = 0; i < waveSize; i += 1) {
    const personId = onNewMigrant(i);
    const originRegion = pickFrom(originRegions, rng);
    const religion = pickFrom(religions, rng);
    if (rng() < legalFraction) {
      arrivals.push(admitWithPassport(store, { personId, originRegion, religion, now }));
    } else {
      const smuggledGoods = smuggledGoodsPool.length && rng() < DEFAULT_SMUGGLING_FRACTION
        ? [pickFrom(smuggledGoodsPool, rng)]
        : [];
      arrivals.push(crossIllegally(store, { personId, originRegion, religion, smuggledGoods, now }));
    }
  }

  return {
    waveSize,
    arrivals,
    legalCount: arrivals.filter((a) => a.legal).length,
    illegalCount: arrivals.filter((a) => !a.legal).length,
  };
}
