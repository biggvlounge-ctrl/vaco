import { FRONTIER_ZONES, UNDERGROUND_ZONES, pickZone } from './zones.js';

// VDP — Immigration: legal and illegal entry to the settlement.
//
// `zones.js` is imported directly above, not injected -- it is a
// plain, side-effect-free constants module (see its own header), the
// same footing `world.js`'s `DISTRICTS` already stands on for other
// modules in this directory that read it the same way.
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
// own example, not a catalog this module invents the rest of --
// widened the same way 8 Oct 2026, same day, with two more of the
// instruction's own real examples: "people trying to smuggle cars in,
// drugs in, things of that nature." Cars specifically matter here --
// `voidClient.js`'s autonomous vans are Meridian's only real ride, so
// a smuggled car is explicitly contraband, not a second legitimate
// vehicle this world is supposed to have.
//
// **"Books will be the most important thing that will be smuggled
// in"** (8 Oct 2026, same instruction) names the real, specific
// weight a `smuggledGoods` entry of `'books'` carries here, above
// guns/cars/drugs -- not a separate field, the same free-text list,
// read by whoever reads it (`GovernmentView.jsx`'s security panel,
// `MyStatusView.jsx`'s citations) with that real emphasis in mind.
// "We will gradually insert more books into rotation into the
// universe" is VENVS Publishing's own real catalog
// (`venvs/src/lib/catalog.js`) growing over time -- a real, ongoing
// process in a separate app, not a single action this module can
// finish; recorded as open in `VDP_FOUNDING.md` rather than guessed
// at with an invented book list here.
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
//
// **Where the other ways across actually are (9 Oct 2026), per direct
// instruction**: "the place where they're migrating in illegally --
// make those spots... uncharted territory, wooded area, places away
// from the technology." The passport line is the one real, controlled,
// tech-equipped checkpoint (`admitWithPassport`); every real spot a
// robot patrol finds is the opposite of that by definition, not a
// per-report choice -- the same way `jobs.js`'s frontier jobs already
// work "the undeveloped land around Meridian... that aren't developed
// yet." `ILLEGAL_CROSSING_TERRAIN` names that fixed world-fact on the
// record, alongside `locationLabel`'s own free text for the specific
// spot (a named place IS in that kind of terrain; it does not choose
// to be).

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

// Flagged, same footing as every other unspecified-but-fixed fact in
// this file: no document names the terrain in these exact words, this
// is the instruction's own description, carried verbatim rather than
// paraphrased into something narrower.
export const ILLEGAL_CROSSING_TERRAIN = "uncharted, wooded territory, away from the settlement's tech core";

// **A second real migrant source, same day**, per direct instruction:
// "I would like one of the spots on the ice wall to lead directly to
// the underground world where people will start to migrate from."
// `leadsToUndergroundWorld` is a real, fixed fact about ONE specific
// found spot -- the government's/narrator's own real choice of which
// one, set at report time, never a second kind of spot this module
// invents a parallel pipeline for. A migrant who actually comes
// through it is recorded exactly like any other illegal crossing
// (`crossIllegally`) -- the caller names `originRegion: 'the
// underground world'` directly, the same already-open free-text field
// `originRegion` has always been, so no new arrival shape is needed to
// carry this. What the underground world actually is, and what (if
// anything) is down there besides people, is not specified by the
// instruction and not invented here.
//
// **Who actually comes through the passport line, in order (9 Oct
// 2026), per direct instruction**: "the people who start to come
// early are the people who are most affluent around the country in
// the old world. They come first, and then they send for their
// family members, and only a portion of those will get in, and then
// also other people will get in, and those are the NPCs that start
// the businesses." Unlike `originRegion`/`religion` above, this IS a
// real, closed, ordered structure the instruction itself names --
// three real tiers, in this real order, not an open list this module
// would otherwise refuse to invent:
//   - `affluent`         -- the real first wave, admitted the
//                            ordinary way (`admitWithPassport`).
//   - `family-sponsored` -- sent for by an already-admitted affluent
//                            arrival; "only a portion... will get in"
//                            is real, not asserted -- `sponsorFamilyMembers`
//                            below is the one function that actually
//                            turns some candidates away rather than
//                            admitting every name on a list.
//   - `general`          -- "other people... those are the NPCs that
//                            start the businesses" -- the ordinary
//                            default every existing caller already
//                            gets, unchanged; which of them actually
//                            becomes an NPC business owner is
//                            `property.js`'s own real concern
//                            (`buildUnauthorized`/`purchaseCommercial`
//                            already accept any real owner id,
//                            `npc-<id>` included), not this module's.
// `familyImportCapacity` is a real, recorded fact about a specific
// family's own old-world connections -- per "the import-export
// depends on the family in the old world as well" -- never wired into
// `resources.js`'s own `oldWorldStock`, which that module's own header
// is explicit is "only ever goes down... everybody drew from the same
// one shipment." A richer family does not top up the whole
// settlement's shared stock; this is only the honest record of how
// capable that one family specifically is, in case a future real
// import path wants to read it. What that path would actually be is
// not specified and not invented here.
export const WEALTH_TIERS = ['affluent', 'family-sponsored', 'general'];

// **Asylum seekers default to public housing, elite sponsorship is
// the one exception, and even that is not absolute (9 Oct 2026, a
// later direct instruction)**: "anybody who is coming over from the
// old world seeking asylum to the new world will be sent to the
// public housing and only the elite families that come over with
// some type of beneficial aspect, no matter if it's political,
// resources, or anything of that nature, [will not be sent to the
// projects]. And even some people that are elite will be sent over
// there too." (The bracketed clause is this module's own best-faith
// repair of a dropped word in dictation -- read literally, "the
// projects" and "public housing" are the same place, per the
// instruction that coined both terms together the same day, so the
// sentence otherwise contradicts itself. This reading is the one
// that makes every clause do real work: a real default, a real
// exception, and a real reminder that the exception is not a
// guarantee.)
//
// `seekingAsylum` is a real, named flag on the arrival record, not
// folded into `wealthTier` above -- wealth tier is about ADMISSION
// ORDER ("who gets in first"), this is about HOUSING, a separate
// real fact an arrival can carry regardless of which wealth tier
// admitted them. `eliteSponsorship` is free text, same discipline
// `originRegion`/`religion`/`smuggledGoods` already use: "political,
// resources, or anything of that nature" is the instruction's own
// open phrasing, not a closed enum this module would otherwise
// refuse to invent.
export const ELITE_ASYLUM_HOUSING_CHANCE = 0.15; // interpretive -- no document gives a real rate

// A pure predicate, not a side effect -- `property.js`'s own
// `assignPublicHousing` is what actually moves someone, called by
// whichever caller already holds a real property store
// (`server.cjs`'s admission routes), the same decoupled-by-injection
// shape `sponsorFamilyMembers` above already uses for its own
// independent `rng`. Kept pure so the real default/exception/
// exception-to-the-exception logic is testable without a property
// store at all.
export function shouldAssignAsylumHousing(arrival, { rng = Math.random } = {}) {
  if (!arrival?.seekingAsylum) return false;
  if (!arrival.eliteSponsorship) return true;
  return rng() < ELITE_ASYLUM_HOUSING_CHANCE;
}

// Flagged interpretive fraction, same footing every other unspecified
// number in this file already stands on -- no document gives VDP a
// real family-reunification admission rate.
export const DEFAULT_FAMILY_ADMISSION_FRACTION = 0.6;

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
  citizenshipType = 'citizenship', dissident = false,
  wealthTier = 'general', sponsorId = null, familyImportCapacity = null,
  seekingAsylum = false, eliteSponsorship = null, now = Date.now(),
} = {}) {
  if (!personId) throw new Error('admitWithPassport requires a personId');
  requireNoExistingArrival(store, personId, 'admitWithPassport');
  if (!CITIZENSHIP_TYPES.includes(citizenshipType)) {
    throw new Error(`admitWithPassport: "${citizenshipType}" is not a known citizenship type (expected one of ${CITIZENSHIP_TYPES.join(', ')})`);
  }
  if (!WEALTH_TIERS.includes(wealthTier)) {
    throw new Error(`admitWithPassport: "${wealthTier}" is not a known wealth tier (expected one of ${WEALTH_TIERS.join(', ')})`);
  }
  if (wealthTier === 'family-sponsored' && !sponsorId) {
    throw new Error('admitWithPassport: a "family-sponsored" arrival requires a real sponsorId');
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
    wealthTier,
    sponsorId,
    familyImportCapacity: familyImportCapacity ?? null,
    seekingAsylum,
    eliteSponsorship: eliteSponsorship || null,
    // "Multiple people... will try to revolt against the technology
    // being the government" (8 Oct 2026) -- a real, named stance an
    // arrival can carry, distinct from `legal`/`caught`: opposing the
    // government is not the same fact as entering it unlawfully.
    // `dissent.js`'s `organizeRevolt` is the real, organized ACT this
    // only marks someone as predisposed toward.
    dissident,
    caught: false,
    deported: false,
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

// "They send for their family members, and only a portion of those
// will get in" -- the one real function that actually turns some
// candidates away, rather than admitting every name handed to it. The
// sponsor must be a real, already-admitted arrival (the "affluent"
// wave that came first); each candidate is drawn independently against
// `admissionFraction`, so "a portion" is a real, inspectable outcome
// (`admitted`/`turnedAway`), never silently all-or-nothing. Reuses
// `admitWithPassport` as the one real gate -- a sponsored arrival is
// not a second kind of admission, just one with `wealthTier:
// 'family-sponsored'` and a real `sponsorId` recorded on it.
export function sponsorFamilyMembers(store, {
  sponsorId, candidateIds = [], admissionFraction = DEFAULT_FAMILY_ADMISSION_FRACTION,
  rng = Math.random, now = Date.now(),
} = {}) {
  const sponsor = arrivalFor(store, sponsorId);
  if (!sponsor) throw new Error(`sponsorFamilyMembers: no real arrival recorded for sponsor "${sponsorId}"`);

  const admitted = [];
  const turnedAway = [];
  for (const personId of candidateIds) {
    if (rng() < admissionFraction) {
      admitted.push(admitWithPassport(store, {
        personId,
        originRegion: sponsor.originRegion,
        religion: sponsor.religion,
        wealthTier: 'family-sponsored',
        sponsorId,
        now,
      }));
    } else {
      turnedAway.push(personId);
    }
  }
  return { sponsorId, admitted, turnedAway };
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
  personId, originRegion, religion, smuggledGoods = [], oldWorldSkills, oldWorldBeliefs,
  dissident = false, now = Date.now(),
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
    dissident,
    caught: false,
    deported: false,
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

// "People can also be set for jail, ticketing, fine. They could
// avoid the fines and ticketing... or even face deportation back to
// the old world" (8 Oct 2026, direct instruction) -- closes this
// document's own earlier "deportation remains unspecified" open
// item. The arrival record is marked, never deleted -- the real
// history that someone arrived, and was then removed, is worth
// keeping. "Avoiding" a ticket needs no code of its own: nothing in
// `justice.js` ever forced payment, so an unpaid ticket already IS
// the real "avoided" case, recorded as unpaid rather than specially
// flagged.
//
// What actually happens to an NPC specifically (removed from the
// real, server-ticked population) is the caller's own real side
// effect (`server.cjs`, via `npcs.removeNpcFromWorld`) -- this
// module does not import `npcs.js`, the same decoupled-by-injection
// shape `generateMigrationWave`'s `onNewMigrant` already uses.
export function deportPerson(store, personId, { deportedBy, reason, now = Date.now() } = {}) {
  const arrival = arrivalFor(store, personId);
  if (!arrival) throw new Error(`deportPerson: no arrival recorded for "${personId}"`);
  if (arrival.deported) throw new Error(`deportPerson: "${personId}" has already been deported`);
  arrival.deported = true;
  arrival.deportedBy = deportedBy || null;
  arrival.deportedReason = reason || null;
  arrival.deportedAt = now;
  return arrival;
}

export function isDeported(store, personId) {
  const arrival = arrivalFor(store, personId);
  return Boolean(arrival && arrival.deported);
}

// "A new spot found where people are sneaking in" -- a real, named
// discovery. Starts open; sealing it is a separate real act, so
// "found" and "closed" are two events, not one guessed-at moment.
// **"Make the woods and the underground worlds... full of life, make
// them different, different areas, different places"** (9 Oct 2026):
// `zone` names which real, distinct area (`zones.js`) a found spot is
// actually in -- a frontier zone unless the spot itself leads to the
// underground world, in which case it draws from that real, separate
// list instead. `rng` is injectable the same way every other
// real-but-flagged pick in this file (`generateMigrationWave`'s own
// `pickFrom`) already is, so a test can make this deterministic.
export function reportSmugglingSpot(store, {
  locationLabel, reportedBy, leadsToUndergroundWorld = false, rng = Math.random, now = Date.now(),
} = {}) {
  if (!locationLabel) throw new Error('reportSmugglingSpot requires a locationLabel');
  const zone = pickZone(leadsToUndergroundWorld ? UNDERGROUND_ZONES : FRONTIER_ZONES, rng);
  const spot = {
    id: store.nextSpotId++,
    locationLabel,
    terrain: ILLEGAL_CROSSING_TERRAIN,
    leadsToUndergroundWorld,
    zone: zone.name,
    reportedBy: reportedBy || null,
    sealed: false,
    reportedAt: now,
  };
  store.smugglingSpots.push(spot);
  return spot;
}

// The real, single passage the instruction names ("one of the
// spots") -- `null` if it has not been found/reported yet, never
// invented in its absence.
export function findUndergroundWorldSpot(store) {
  return store.smugglingSpots.find((s) => s.leadsToUndergroundWorld) || null;
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
//
// **"Some areas will be off the grid until the government finds
// out... the government not know that are off the grid"** (8 Oct
// 2026, direct instruction): a settlement starts `discovered: false`
// -- real and active the instant it's founded, but not yet known to
// the government. `discoverSettlement` is the separate, real act
// that changes that (the same "found vs. closed are two real events"
// shape `reportSmugglingSpot`/`sealSmugglingSpot` already use) --
// `clearIllegalSettlement` requires discovery first, because the
// government cannot clear a settlement it does not know exists.
// **Red zones (9 Oct 2026), per direct instruction**: "this will lead
// to illegal areas, red zones, illegal gambling, drugs, clubs, and
// things of that nature." `activities` is free text, same discipline
// as `smuggledGoods` -- "and things of that nature" is the
// instruction's own open phrasing, not a closed catalog this module
// invents the rest of. Naming VAGO's own real, regulated,
// VCoin-settled casino here would be wrong on its face: an illegal
// settlement's "gambling" is explicitly the unregulated, off-the-books
// kind the government has not sanctioned, a real different fact from
// VAGO's own Venus Resort, not a second instance of it.
export function foundIllegalSettlement(store, {
  founderId, locationLabel, activities = [], now = Date.now(),
} = {}) {
  if (!founderId) throw new Error('foundIllegalSettlement requires a founderId');
  if (!locationLabel) throw new Error('foundIllegalSettlement requires a locationLabel');
  const settlement = {
    id: store.nextSettlementId++,
    founderId,
    locationLabel,
    activities: [...activities],
    discovered: false,
    discoveredBy: null,
    discoveredAt: null,
    // "Off the grid... will become a big part of the game" (9 Oct
    // 2026) -- see `spreadWordOfMouth` below for what this real list
    // is and, just as importantly, is not.
    knownByWordOfMouth: [],
    clearedAt: null,
    foundedAt: now,
  };
  store.illegalSettlements.push(settlement);
  return settlement;
}

export function discoverSettlement(store, settlementId, { discoveredBy, now = Date.now() } = {}) {
  const settlement = store.illegalSettlements.find((s) => s.id === settlementId);
  if (!settlement) throw new Error(`discoverSettlement: no illegal settlement #${settlementId}`);
  if (settlement.discovered) throw new Error(`discoverSettlement: settlement #${settlementId} is already discovered`);
  settlement.discovered = true;
  settlement.discoveredBy = discoveredBy || null;
  settlement.discoveredAt = now;
  return settlement;
}

// **Off the grid, by word of mouth (9 Oct 2026), per direct
// instruction**: "move into outskirts and find migration to some of
// these spots through word of mouth that... are off the grid. This
// will become a big part of the game." A real, separate channel from
// `discoverSettlement` above -- the government learning a settlement
// exists is one real event (`discovered`); a real person learning
// about it from someone who already lives there is a different real
// event, and must NOT set `discovered`, or "off the grid" would mean
// nothing: the whole point is that the government does not yet know.
// `security.js`'s own crime count already only reads
// `listKnownIllegalSettlements` (discovered AND active) for exactly
// this reason -- a word-of-mouth settlement stays genuinely invisible
// to that count until a robot patrol separately finds it.
export function spreadWordOfMouth(store, settlementId, { toPersonId, now = Date.now() } = {}) {
  const settlement = store.illegalSettlements.find((s) => s.id === settlementId);
  if (!settlement) throw new Error(`spreadWordOfMouth: no illegal settlement #${settlementId}`);
  if (!toPersonId) throw new Error('spreadWordOfMouth requires a toPersonId');
  if (settlement.clearedAt) throw new Error(`spreadWordOfMouth: settlement #${settlementId} has already been cleared`);
  if (settlement.knownByWordOfMouth.some((k) => k.toPersonId === toPersonId)) {
    throw new Error(`spreadWordOfMouth: "${toPersonId}" already knows about settlement #${settlementId}`);
  }
  settlement.knownByWordOfMouth.push({ toPersonId, heardAt: now });
  return settlement;
}

// Real and informal -- who actually knows about this settlement
// through word of mouth, government awareness aside.
export function knownByWordOfMouth(store, settlementId) {
  const settlement = store.illegalSettlements.find((s) => s.id === settlementId);
  if (!settlement) throw new Error(`knownByWordOfMouth: no illegal settlement #${settlementId}`);
  return settlement.knownByWordOfMouth;
}

export function clearIllegalSettlement(store, settlementId, { clearedBy, now = Date.now() } = {}) {
  const settlement = store.illegalSettlements.find((s) => s.id === settlementId);
  if (!settlement) throw new Error(`clearIllegalSettlement: no illegal settlement #${settlementId}`);
  if (!settlement.discovered) throw new Error(`clearIllegalSettlement: settlement #${settlementId} has not been discovered yet`);
  if (settlement.clearedAt) throw new Error(`clearIllegalSettlement: settlement #${settlementId} is already cleared`);
  settlement.clearedAt = now;
  settlement.clearedBy = clearedBy || null;
  return settlement;
}

// Every real active settlement, discovered or not -- the honest, full
// list (used by this module's own callers who are allowed to know
// everything, e.g. tests and any future narrator view).
export function listActiveIllegalSettlements(store) {
  return store.illegalSettlements.filter((s) => !s.clearedAt);
}

// What the government itself actually knows about -- discovered and
// still active. `security.js`'s crime measurement reads this one, not
// the full list above, so an undiscovered settlement genuinely does
// not raise the alarm it hasn't triggered yet.
export function listKnownIllegalSettlements(store) {
  return store.illegalSettlements.filter((s) => !s.clearedAt && s.discovered);
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
// "Multiple people... will try to revolt against the technology being
// the government" (8 Oct 2026) -- a flagged interpretive fraction,
// same footing every other unspecified rate in this function already
// stands on.
export const DEFAULT_DISSIDENT_FRACTION = 0.1;

function pickFrom(pool, rng) {
  return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
}

export function generateMigrationWave(store, {
  survivorPopulation, waveFraction = DEFAULT_WAVE_FRACTION, legalFraction = DEFAULT_LEGAL_FRACTION,
  dissidentFraction = DEFAULT_DISSIDENT_FRACTION,
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
    const dissident = rng() < dissidentFraction;
    if (rng() < legalFraction) {
      arrivals.push(admitWithPassport(store, { personId, originRegion, religion, dissident, now }));
    } else {
      const smuggledGoods = smuggledGoodsPool.length && rng() < DEFAULT_SMUGGLING_FRACTION
        ? [pickFrom(smuggledGoodsPool, rng)]
        : [];
      arrivals.push(crossIllegally(store, { personId, originRegion, religion, smuggledGoods, dissident, now }));
    }
  }

  return {
    waveSize,
    arrivals,
    legalCount: arrivals.filter((a) => a.legal).length,
    illegalCount: arrivals.filter((a) => !a.legal).length,
    dissidentCount: arrivals.filter((a) => a.dissident).length,
  };
}
