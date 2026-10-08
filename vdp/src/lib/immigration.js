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
// old-world background the migrant brings with them.
export function admitWithPassport(store, {
  personId, originRegion, religion, oldWorldSkills, oldWorldBeliefs, now = Date.now(),
} = {}) {
  if (!personId) throw new Error('admitWithPassport requires a personId');
  requireNoExistingArrival(store, personId, 'admitWithPassport');

  const arrival = {
    id: store.nextArrivalId++,
    personId,
    method: 'passport',
    legal: true,
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
