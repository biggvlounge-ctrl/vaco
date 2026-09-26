// server/births.js
//
// People are born — the other end of the life scale.
//
// **What was wrong before this.** `mortality.js` gave the world an
// ending and nothing gave it a beginning. `addFamilyMember` existed
// and nothing called it on its own, so no child was ever born unless
// code asked for one by name. That left three things broken at once:
//
//   * **Every population could only shrink.** A world with deaths and
//     no births is a countdown, and §2's promise is a world that
//     continues without the player.
//   * **`npcs.generation` stayed 1 forever.** The column is in the
//     schema on purpose and nothing could ever advance it, so §51's
//     player legacy had no generations to outlive anybody.
//   * **Two statistics were uncomputable, not missing.**
//     `statistics.js` declared `birth_rate` and
//     `teenage_pregnancy_rate` unavailable with the same reason: there
//     is no birth driver, so there is nothing to count.
//
// ---------------------------------------------------------------------
// Four decisions, and why each is the one this engine already implies
//
// **1. A birth needs no new table.** A birth IS a person appearing:
// `npcs.createdTick` is when, `entities.community_id` is where. Counting
// births in an area over a window is a filter over people who already
// exist, and the parents go in `historical_records` exactly as a death
// does — `who: [child, bearing parent, other parent]`, `what: 'birth'`.
// `birthRecordFor` is the read, the mirror of `deathRecordFor`.
//
// `crime.js` argued the other way and took a table, for a reason that
// does not apply here: a crime had no other way to be attributed to an
// area. A child is in an area by being a person in one.
//
// **The caveat, stated rather than discovered later:** the area a birth
// is counted in is the child's CURRENT community, which is exact today
// because nothing moves — `migration_events` is a schema-only table and
// `runMigrationPhase` computes a risk signal that relocates nobody. The
// day migration is built, a birth's community has to be recorded at the
// time rather than read off the child, and `birthsIn` is the function
// that changes.
//
// **2. A child inherits; it does not roll.** Trait values are the mean
// of the two parents' LIVE values with a seeded deviation — standing
// rule 9, through `getLiveEntity`, never `npc.traits`, which is a sheet
// built once at generation and frozen. A child who rolled fresh traits
// would make lineage decorative: the family tree would exist and mean
// nothing, and §56's families would be a label rather than a mechanism.
//
// **3. No sex or gender field is invented.** `npcs` has role, education,
// religion and generation, and nothing else about a person's
// demography. Adding one would be a design decision no document in the
// package makes, and §9's constraint — demographics must not determine
// an NPC's "morality, criminality, intelligence, or worth" — makes it a
// decision to take deliberately rather than as a side effect of wanting
// a birth rate.
//
// So the model is a **partnership**, and the parent recorded as bearing
// the child is the one inside the fertility window (the younger, when
// both are). That is what makes `teenage_pregnancy_rate` a real
// measurement rather than an invented one: the bearing parent's age at
// the child's `createdTick` is arithmetic over two existing fields.
//
// **4. Fertility is environmental, with one biological floor.** The
// owner's standing instruction on mortality was that there are no
// limits and everything is environment-based, and that is carried
// through here: scarcity, disease and deprivation all suppress births,
// and nothing else gates them. The one exception is
// `FERTILITY_MIN_AGE`, and it is not a rule about the environment — a
// child cannot bear a child, and a model without that floor would
// produce exactly the output nobody wants. It is named, constant, and
// the only hard gate in the file.
//
// Every draw is seeded (`seeded.js`), so §88's replay guarantee holds.

'use strict';

const areaStats = require('./areaStats.js');
const economy = require('./economy.js');
const mortality = require('./mortality.js');
const worldStore = require('./worldStore.js');
const { INDIVIDUAL_DEFINITIONS } = require('./traitDefinitions.js');
const { generateEntityTraits, traitsToSheet, getLiveEntity } = require('./entityTraits.js');
const { seededDraw, seededUnit, hashSeed } = require('./seeded.js');

//: The one hard gate in this file, and it is biology rather than a
//: rule about the environment: a child cannot bear a child.
const FERTILITY_MIN_AGE = 15;

//: Flagged interpretive. No document gives a fertility curve. These
//: shape a decline rather than a cliff — fertility falls away from the
//: peak in both directions and reaches zero at MAX.
const FERTILITY_PEAK_AGE = 27;
const FERTILITY_MAX_AGE = 45;

//: Per eligible BEARER per year, under good conditions — not per
//: partnership, and the difference was measured rather than reasoned.
//: The first version drew once for every fertile partnership, and
//: because a bond forms on contact a person can hold several: a
//: 2,000-tick run grew 21% in 2.2 simulated years, a crude birth rate
//: around 9.6% against a real pre-modern 4%. **A person bears; a
//: partnership does not.** So the draws are grouped by bearer and the
//: most fertile partnership is the one that counts.
const BASE_ANNUAL_BIRTH_RATE = 0.14;

//: A partnership is a relationship carrying this much love. The
//: `relationships` table has love, trust, loyalty and eight more
//: dimensions and no "is a couple" flag, so a threshold is the only
//: way to read one — flagged, and the single number to change.
const PARTNER_BOND_FLOOR = 60;

//: **These three exist because the first version of this file was
//: broken and its tests could not tell.** `relationships.love` is
//: initialised to 0 by `getOrCreateRelationship` and was written by
//: NOTHING — six of the twelve relationship dimensions are, and love
//: is not one of them. So `PARTNER_BOND_FLOOR` could never be reached
//: by any engine mechanism and **no birth could ever occur in a
//: running simulation**. Every test passed because every fixture set
//: `love` directly; it was caught by measuring a generated world, not
//: by the suite. Standing rule 6, and rule 8's fixture trap, in one.
//:
//: **And the first fix for it was wrong too, in the same way.** It
//: gated the bond on `trust` and `shared_history`, and
//: `shared_history` is written only on SELF-relationships — by the
//: three introspective keys, Resilience, Adaptability and
//: ScarcityResponse — so between two different people it is 0 forever.
//: Reading it fixed nothing and would have looked fixed.
//:
//: `interaction_count` is the field that genuinely records repeated
//: contact: `worldStore.adjustRelationship` increments it on every
//: write-back, and the Social phase resolves Trust for every
//: relationship every tick. So a bond is **contact over time, in the
//: absence of hostility**, with trust as an accelerator rather than a
//: gate — trust only moves when knowledge flows, and gating on it
//: would make bonds depend on whether a famine happened to be in the
//: news.
//: **The one constant in this file taken from the real world rather
//: than invented**, and it is only expressible because a tick is a day
//: (`TICK_INTERVALS` in behavior.js): human gestation is about 280
//: days. A bearer who has borne within this many ticks is skipped,
//: which caps one person's fertility no matter how many partnerships
//: they hold — the cap belongs to the body, not to the relationship.
const GESTATION_TICKS = 280;

const BOND_CONTACT_FLOOR = 30;        // ticks of contact before anything grows
const BOND_CONFLICT_CEILING = 20;     // hostility blocks a bond outright
const BOND_GROWTH = 0.25;             // love per tick at neutral trust

//: How much the environment suppresses births. Scarcity is the worst
//: shortage of food, water and medicine; deprivation is poverty depth.
//: Both reduce, neither can take the rate below zero.
const SCARCITY_SUPPRESSION = 0.8;
const DISEASE_SUPPRESSION = 0.5;
const DEPRIVATION_SUPPRESSION = 0.3;

//: Trait inheritance: the child sits at the parents' mean, plus or
//: minus up to this much. Wide enough that siblings differ, narrow
//: enough that a line of cautious people stays cautious.
const INHERITANCE_DEVIATION = 15;

// -- fertility ----------------------------------------------------------

// 0..1 by age. Zero below the floor and at or past the maximum, peaking
// at FERTILITY_PEAK_AGE and falling away on both sides.
function fertilityForAge(age) {
  if (age === null || !Number.isFinite(age)) return 0;
  if (age < FERTILITY_MIN_AGE || age >= FERTILITY_MAX_AGE) return 0;
  const span = age < FERTILITY_PEAK_AGE
    ? FERTILITY_PEAK_AGE - FERTILITY_MIN_AGE
    : FERTILITY_MAX_AGE - FERTILITY_PEAK_AGE;
  const distance = Math.abs(age - FERTILITY_PEAK_AGE) / span;
  return Math.max(0, 1 - distance ** 2);
}

// What the environment does to a partnership's chance, 0..1.
//
// **The same inputs `mortality.js` reads, pointed the other way.** A
// famine kills and it also stops births; an epidemic does both. That
// is one environment driving two systems rather than two systems each
// inventing their own weather.
function environmentalFertility(worldState, bearer, { scarcity, pressure, line }) {
  let factor = 1;
  factor *= Math.max(0, 1 - scarcity * SCARCITY_SUPPRESSION);
  // `diseasePressure` is a multiplier at or above 1, so the excess
  // over 1 is the epidemic.
  factor *= Math.max(0, 1 - Math.max(0, pressure - 1) * DISEASE_SUPPRESSION);
  const depth = areaStats.povertyDepth(economy.getNetWorth(worldState, bearer.id), line);
  factor *= Math.max(0, 1 - depth * DEPRIVATION_SUPPRESSION);
  return factor;
}

// -- bonds ---------------------------------------------------------------

// ---------------------------------------------------------------------
// Libido and Fidelity — added 26 Sep 2026 at the owner's direct request
// ---------------------------------------------------------------------
// Neither trait is from a source document. Both modulate the bond
// mechanic directly above rather than a new one: `Libido` is how
// readily somebody grows close to anybody, `Fidelity` is how much
// already having a partner slows growing close to somebody ELSE — the
// same "partnership" concept this file already has, since nothing in
// this schema has ever modelled marriage or exclusivity as a hard
// state. That is a real limit, stated rather than worked around: there
// is no "married" flag to check, only `relationships.love` crossing
// `PARTNER_BOND_FLOOR`, possibly with more than one partner at once,
// exactly as `fertilePartnerships` below already has to handle.
//
// **Both multipliers are centred on the trait's own default (50), the
// twelfth standing rule's discipline.** An average person's bond grows
// at exactly the rate this file used before either trait existed —
// Libido 50 and Fidelity 50 both return 1. Only somebody who deviates
// from average changes anything, which is what stops this from quietly
// recalibrating every relationship in every existing test and every
// already-generated world.
// **`Number(null)` is 0, and 0 is finite** — CLAUDE.md's own corollary,
// hit here in a new place. `value === null` (an entity with no such
// trait row) has to be caught explicitly before the numeric check, or
// a missing trait reads as the single worst possible value instead of
// the neutral default.
function normalizedTrait(value) {
  if (value === null || value === undefined) return 50;
  const v = Number(value);
  return Number.isFinite(v) ? v : 50;
}

function libidoMultiplier(value) {
  return 0.5 + normalizedTrait(value) / 100; // 0 -> 0.5x, 50 -> 1x, 100 -> 1.5x
}

function fidelityMultiplier(value) {
  return 1.5 - normalizedTrait(value) / 100; // 0 -> 1.5x (strays faster), 100 -> 0.5x (strays slower)
}

// Every OTHER partner this entity already has above the floor —
// "other" meaning not the person on the far end of the relationship
// currently being grown. Plural on purpose: this schema has never
// enforced exclusivity, so a person can already hold more than one.
function otherPartnersOf(worldState, entityId, excludingId) {
  const out = [];
  for (const r of worldState.relationships || []) {
    if (r.entity_a_id !== entityId && r.entity_b_id !== entityId) continue;
    const otherId = r.entity_a_id === entityId ? r.entity_b_id : r.entity_a_id;
    if (otherId === excludingId) continue;
    if ((r.love ?? 0) >= PARTNER_BOND_FLOOR) out.push(otherId);
  }
  return out;
}

//: Below this Paranoia, an existing partner still notices sometimes —
//: nobody is completely unsuspecting — and above it, most of the time.
//: `psychological.Paranoia` already exists and already means "reads
//: more into what is happening around them"; reused rather than a
//: second trait for the same idea.
const DISCOVERY_CHANCE_FLOOR = 0.05;
const DISCOVERY_CHANCE_AT_MAX_PARANOIA = 0.6;
//: What discovering it costs the existing partnership. Sized against
//: `crime.SEVERITY.domestic` (65) rather than invented independently —
//: a discovered betrayal is a comparable blow to the relationship a
//: domestic offence already is.
const INFIDELITY_TRUST_HIT = 25;
const INFIDELITY_LOVE_HIT = 20;
const INFIDELITY_CONFLICT = 25;

function paranoiaOf(worldState, entityId) {
  const live = getLiveEntity(worldState, entityId);
  return normalizedTrait(live?.traits?.psychological?.Paranoia);
}

// One existing partner's chance of noticing a NEW bond their partner
// just formed with somebody else, this tick, seeded so a replay finds
// the same thing at the same moment every time.
function discovers(worldState, existingPartnerId, unfaithfulId, rivalId, tick) {
  const paranoia = paranoiaOf(worldState, existingPartnerId);
  const chance = DISCOVERY_CHANCE_FLOOR
    + (paranoia / 100) * (DISCOVERY_CHANCE_AT_MAX_PARANOIA - DISCOVERY_CHANCE_FLOOR);
  return seededDraw([
    worldState.seed ?? 'world', 'infidelity:discover',
    existingPartnerId, unfaithfulId, rivalId, tick,
  ]) < chance;
}

// Grow `love` where there is trust and repeated contact.
//
// Called from `runSocialPhase`, which is where relationships already
// change — not a new phase, and not a new place for social mechanics
// to live. It runs after `resolveTrust` has written this tick's trust
// and shared history, so a bond reads the current state rather than
// last tick's.
function advanceBonds(worldState, tick = worldState.tick ?? 0) {
  const formed = [];
  for (const relationship of worldState.relationships || []) {
    if (relationship.entity_a_id === relationship.entity_b_id) continue;
    if ((relationship.interaction_count ?? 0) < BOND_CONTACT_FLOOR) continue;
    if ((relationship.conflict ?? 0) >= BOND_CONFLICT_CEILING) continue;

    const before = relationship.love ?? 0;
    if (before >= 100) continue;

    const aId = relationship.entity_a_id;
    const bId = relationship.entity_b_id;
    const liveA = getLiveEntity(worldState, aId);
    const liveB = getLiveEntity(worldState, bId);
    // Already-established partners of EITHER side, read before this
    // tick's growth — used both to dampen a wandering bond by Fidelity
    // and, on a crossing, to decide who might notice.
    const aOthers = otherPartnersOf(worldState, aId, bId);
    const bOthers = otherPartnersOf(worldState, bId, aId);

    // Trust accelerates, never gates: a pair at trust 100 bonds twice
    // as fast as a pair at the neutral 50, and a pair below neutral
    // still bonds, slowly, on contact alone.
    const trust = relationship.trust ?? 50;
    let rate = BOND_GROWTH * (1 + Math.max(-0.5, (trust - 50) / 50));
    rate *= (libidoMultiplier(liveA?.traits?.emotional?.Libido)
      + libidoMultiplier(liveB?.traits?.emotional?.Libido)) / 2;
    // Fidelity only ever applies to the side that already has someone
    // else — a person with no existing partner has nothing to be
    // unfaithful TO, and their own Fidelity has nothing to slow yet.
    if (aOthers.length > 0) rate *= fidelityMultiplier(liveA?.traits?.emotional?.Fidelity);
    if (bOthers.length > 0) rate *= fidelityMultiplier(liveB?.traits?.emotional?.Fidelity);

    relationship.love = Math.min(100, before + rate);
    // The crossing, not the condition — standing rule 7. A pair that
    // sits above the floor forever would otherwise report a new
    // partnership every tick for the rest of their lives.
    if (before < PARTNER_BOND_FLOOR && relationship.love >= PARTNER_BOND_FLOOR) {
      formed.push({
        type: 'partnership_formed',
        severity: 'low',
        note: `Entity ${aId} and entity ${bId} formed a partnership`,
        tick,
        affected_entity_ids: [aId, bId],
        global_effects: {},
      });

      // A NEW bond crossing the floor while either side already had one
      // is the moment there is something to discover. Each existing
      // partner gets their own, independent chance — a jealous ex does
      // not make a trusting one suspicious.
      for (const [unfaithfulId, rivalId, existingPartners] of [
        [aId, bId, aOthers], [bId, aId, bOthers],
      ]) {
        for (const existingPartnerId of existingPartners) {
          if (!discovers(worldState, existingPartnerId, unfaithfulId, rivalId, tick)) continue;

          const rel = worldStore.adjustRelationship(worldState, unfaithfulId, existingPartnerId, 'social', {
            trust: -INFIDELITY_TRUST_HIT,
            love: -INFIDELITY_LOVE_HIT,
            conflict: INFIDELITY_CONFLICT,
          });
          rel.trust = Math.max(0, rel.trust);
          rel.love = Math.max(0, rel.love);

          worldStore.addMemory(worldState, {
            entityId: existingPartnerId,
            tick,
            memoryType: 'negative',
            category: 'conflict',
            description: `Discovered entity ${unfaithfulId} had formed a bond with entity ${rivalId}.`,
            importance: 80,
            emotionLevel: -80,
            relatedEntityIds: [unfaithfulId],
          });

          formed.push({
            type: 'infidelity_discovered',
            severity: 'high',
            note: `Entity ${existingPartnerId} discovered entity ${unfaithfulId}'s bond with entity ${rivalId}`,
            tick,
            affected_entity_ids: [existingPartnerId, unfaithfulId],
            global_effects: { rivalId },
          });
        }
      }
    }
  }
  return formed;
}

// -- who could have a child ---------------------------------------------

function livingById(worldState) {
  const map = new Map();
  for (const npc of worldState.npcs) map.set(npc.id, npc);
  return map;
}

// Every partnership of two living people where at least one is inside
// the fertility window. Returns the pair with the bearing parent named.
//
// **The bearing parent is the one inside the window** — the younger of
// the two when both are. See the header: no sex field exists on an NPC
// and this file does not invent one.
function fertilePartnerships(worldState, tick = worldState.tick ?? 0) {
  const living = livingById(worldState);
  const pairs = [];

  for (const relationship of worldState.relationships || []) {
    if (relationship.entity_a_id === relationship.entity_b_id) continue;
    if ((relationship.love ?? 0) < PARTNER_BOND_FLOOR) continue;

    const a = living.get(relationship.entity_a_id);
    const b = living.get(relationship.entity_b_id);
    if (!a || !b) continue;
    // **Somebody serving a sentence is not in the room.** `npcs.status`
    // gained `imprisoned` with server/justice.js, and a person the
    // engine has put away is still in `worldState.npcs` — they are
    // alive and still a resident — so every system that iterates the
    // living has to say whether being inside changes what it models.
    // For conception it plainly does.
    if (a.status === 'imprisoned' || b.status === 'imprisoned') continue;

    const ageA = mortality.ageInYears(worldState, a, tick);
    const ageB = mortality.ageInYears(worldState, b, tick);
    const fertileA = fertilityForAge(ageA);
    const fertileB = fertilityForAge(ageB);
    if (fertileA <= 0 && fertileB <= 0) continue;

    // The younger of the two when both are fertile; otherwise whoever
    // is. `>` rather than `>=` so a tie is resolved by id order below
    // and the choice stays deterministic.
    const bearerIsA = fertileA > fertileB
      || (fertileA === fertileB && a.id < b.id);
    pairs.push({
      bearer: bearerIsA ? a : b,
      other: bearerIsA ? b : a,
      bearerAge: bearerIsA ? ageA : ageB,
      fertility: Math.max(fertileA, fertileB),
    });
  }

  return pairs;
}

// -- the birth itself ---------------------------------------------------

// A child's trait value: the parents' live mean, plus a seeded
// deviation. Read through `getLiveEntity` — standing rule 9, because
// `npc.traits` is frozen at generation and a child inheriting birth
// values from a parent who has lived forty years inherits a stranger.
function inheritedValueFor(liveA, liveB, def, seedParts) {
  const a = liveA?.traits?.[def.family]?.[def.name];
  const b = liveB?.traits?.[def.family]?.[def.name];
  const values = [a, b].filter((v) => Number.isFinite(v));
  // A parent with no value for a trait contributes nothing rather than
  // a zero — the unknown-is-not-a-zero rule, which here would drag
  // every child toward the bottom of every scale.
  const base = values.length === 0 ? 50 : values.reduce((x, y) => x + y, 0) / values.length;
  const deviation = (seededUnit(hashSeed([...seedParts, def.family, def.name])) * 2 - 1)
    * INHERITANCE_DEVIATION;
  return Math.max(0, Math.min(100, Math.round(base + deviation)));
}

// Bring one child into the world. Exported so a scenario, a test or a
// player action can cause a birth directly, the same way `killEntity`
// sits beside `runMortality`.
function bearChild(worldState, options = {}) {
  const { bearerId, otherParentId = null, tick = worldState.tick ?? 0 } = options;

  const bearer = worldState.npcs.find((n) => n.id === bearerId);
  if (!bearer) throw new Error(`bearChild: ${bearerId} is not among the living`);
  const other = otherParentId === null
    ? null
    : worldState.npcs.find((n) => n.id === otherParentId) || null;
  if (otherParentId !== null && !other) {
    throw new Error(`bearChild: ${otherParentId} is not among the living`);
  }

  if (typeof worldState.nextEntityId !== 'number') {
    throw new Error(
      'births.js: worldState.nextEntityId is not a number. A child draws its id from the '
      + 'shared entity counter, same as every other entity, so that relationships, '
      + 'memories and ownership records can point at it.',
    );
  }
  const id = worldState.nextEntityId++;

  const liveBearer = getLiveEntity(worldState, bearer.id);
  const liveOther = other ? getLiveEntity(worldState, other.id) : null;
  const traitRows = generateEntityTraits(
    id, tick, INDIVIDUAL_DEFINITIONS,
    (def) => inheritedValueFor(liveBearer, liveOther, def, [id, 'inherit']),
  );
  worldState.entityTraits.push(...traitRows);

  const child = {
    id,
    type: 'npc',
    status: 'active',
    // No name generator is reachable from here without importing
    // engine.js, which imports tick.js, which imports this file.
    // Null is honest and `npcs.name` is nullable; whoever names
    // children can do it at the call site.
    name: options.name ?? null,
    role: null,
    // **`'none'`, the bottom rung — and it was `null` until schooling
    // existed, which turned an honest unknown into a permanent
    // sentence.** `demographics.EDUCATION_LEVELS[0]` is `'none'`, and
    // `statecraft.runSchooling` walks a person UP that ladder from
    // wherever they stand. It refuses `null` on purpose: `indexOf`
    // returns -1 for it, and -1 is not rung zero — starting a generated
    // adult whose attainment nobody recorded at `none` would invent a
    // fact about them.
    //
    // A baby is the one case where the engine genuinely knows. It made
    // this person; they have no education yet, which is not an unknown,
    // it is `none`. Left as `null`, every child ever born in a running
    // world was skipped by the only mechanism that can teach anybody —
    // standing rule 14's shape, a ladder whose bottom rung nobody is
    // ever placed on. Measured on a 400-tick playtest: 52 of 146
    // living people had no education recorded and not one of them could
    // ever acquire any.
    //
    // The literal rather than an import: this file cannot reach
    // `demographics.js` without the cycle its header already describes.
    // `test/statecraft.test.js` holds the two in agreement.
    education: 'none',
    // Inherited, because `npcs.religion` is a real column and a
    // household's religion is the one demographic fact the schema
    // already carries. Null when neither parent has one.
    religion: bearer.religion ?? other?.religion ?? null,
    // Inherited the same way and for the same reason. A child born to
    // this household belongs to it demographically; rolling a fresh
    // one would make `ethnic_diversity` drift toward the generator's
    // distribution rather than the population's, and a settlement's
    // composition would stop being a fact about its families.
    ethnicity: bearer.ethnicity ?? other?.ethnicity ?? null,
    // **This is what makes `npcs.generation` mean something.** It has
    // been 1 for every NPC in every world because nothing could ever
    // advance it.
    generation: Math.max(bearer.generation ?? 1, other?.generation ?? 1) + 1,
    communityId: bearer.communityId ?? null,
    home_property_id: bearer.home_property_id ?? null,
    traits: traitsToSheet(traitRows),
    createdTick: tick,
    updatedTick: tick,
  };
  worldState.npcs.push(child);

  // The family, if the bearing parent has one. No family is created
  // here: `generateFamily` lives in engine.js and creating one would
  // mean deciding a surname, a founder and a generation — decisions
  // that belong to whoever is building the world, not to a birth.
  const bearerFamily = (worldState.familyMemberships || [])
    .find((m) => m.entity_id === bearer.id);
  if (bearerFamily) {
    worldState.familyMemberships.push({
      entity_id: child.id,
      family_id: bearerFamily.family_id,
      role: 'child',
      generation_number: child.generation,
    });
    const family = (worldState.families || []).find((f) => f.id === bearerFamily.family_id);
    if (family) {
      family.total_members = (family.total_members ?? 0) + 1;
      family.updatedTick = tick;
    }
  }

  // **The record, and the only place a parent's identity is stored.**
  // `teenage_pregnancy_rate` is computed by finding this record for a
  // child and taking the bearing parent's age at `when_tick` — two
  // subtractions over fields that already exist, rather than a column
  // holding a number somebody has to keep correct.
  const bearerAge = mortality.ageInYears(worldState, bearer, tick);
  worldStore.addHistoricalRecord(worldState, {
    who: [child.id, bearer.id, ...(other ? [other.id] : [])],
    what: 'birth',
    when_tick: tick,
    where_location_id: bearer.home_property_id ?? null,
    why: 'birth',
    result: null,
    consequences: null,
    future_effects: null,
    //: Interpretive, and deliberately low: a birth matters enormously
    //: to a family and barely at all to a civilization's history,
    //: which is what `historical_records.significance` ranks.
    significance: 25,
  });

  // Standing rule 1's write-back. Both parents, unlike a killing,
  // where only the killer has further decisions to make.
  for (const parent of [bearer, other].filter(Boolean)) {
    worldStore.addMemory(worldState, {
      entityId: parent.id,
      tick,
      memoryType: 'positive',
      category: 'family',
      description: `Became a parent to entity ${child.id}.`,
      importance: 85,
      emotionLevel: 70,
      relatedEntityIds: [child.id, ...(parent === bearer ? [] : [bearer.id])],
    });
  }

  return {
    child,
    bearer,
    other,
    bearerAge,
    event: {
      type: 'birth',
      entityId: child.id,
      bearerId: bearer.id,
      ...(other ? { otherParentId: other.id } : {}),
      generation: child.generation,
      tick,
    },
  };
}

// -- the cross-cutting pass ---------------------------------------------

// Births for the whole world, once.
//
// Runs in the cross-cutting slot beside `runMortality`, for the same
// reason and in the same place: the pipeline is locked at eleven, and
// a birth and a death are the same kind of event about the same
// population. Births run AFTER mortality on the tick so that nobody is
// born to a parent who died earlier in the same tick.
function runBirths(worldState, tick = worldState.tick ?? 0) {
  const scarcity = mortality.survivalScarcity(worldState);
  const pressure = mortality.diseasePressure(worldState);
  const line = areaStats.povertyLine(worldState);
  const births = [];
  const events = [];

  // **One draw per BEARER, not per partnership.** A person holding
  // three bonds drew three times before this, and a bond forms on
  // contact alone — so a well-connected person bore at three times the
  // intended rate and a measured world grew 21% in two years. The most
  // fertile partnership is the one that counts.
  //
  // The pair list is built before any birth, so a newborn cannot
  // itself appear in it.
  const bestByBearer = new Map();
  for (const pair of fertilePartnerships(worldState, tick)) {
    const existing = bestByBearer.get(pair.bearer.id);
    if (!existing || pair.fertility > existing.fertility) bestByBearer.set(pair.bearer.id, pair);
  }

  for (const pair of bestByBearer.values()) {
    // Gestation. A body cannot bear twice in a season however many
    // partnerships it holds, and this is what makes the cap belong to
    // the person rather than to the relationship.
    const last = lastBorneTick(worldState, pair.bearer.id);
    if (last !== null && tick - last < GESTATION_TICKS) continue;

    const annual = BASE_ANNUAL_BIRTH_RATE
      * pair.fertility
      * environmentalFertility(worldState, pair.bearer, { scarcity, pressure, line });
    if (annual <= 0) continue;

    // A tick is a day, same conversion `runMortality` uses.
    const daily = annual / mortality.TICKS_PER_YEAR;
    if (seededDraw([pair.bearer.id, pair.other.id, tick, 'birth']) >= daily) continue;

    const birth = bearChild(worldState, {
      bearerId: pair.bearer.id, otherParentId: pair.other.id, tick,
    });
    births.push(birth);
    events.push(birth.event);
  }

  return { births, events };
}

// When this person last bore a child, or null if never. Read from
// world history — the historical record is the durable answer, the
// same way `mortality.deathRecordFor` is for a death.
function lastBorneTick(worldState, entityId) {
  let latest = null;
  for (const record of worldState.historicalRecords || []) {
    if (record.what !== 'birth') continue;
    if (!Array.isArray(record.who) || record.who[1] !== entityId) continue;
    if (latest === null || record.when_tick > latest) latest = record.when_tick;
  }
  return latest;
}

// -- reading ------------------------------------------------------------

// The record of somebody's birth, read back from world history — the
// mirror of `mortality.deathRecordFor`, and the only place a parent is
// named.
function birthRecordFor(worldState, entityId) {
  return (worldState.historicalRecords || []).find(
    (r) => r.what === 'birth' && Array.isArray(r.who) && r.who[0] === entityId,
  ) || null;
}

// Everybody born in an area, living or dead.
//
// **The dead are included on purpose.** A birth happened whether or
// not the child is still alive, and a birth rate that silently drops
// infant deaths would make a lethal world look like a barren one —
// which are opposite findings.
//
// See the header on which area this is: the child's CURRENT community,
// exact today because nothing moves.
function birthsIn(worldState, communityId, options = {}) {
  const { sinceTick = null } = options;
  const everybody = [...worldState.npcs, ...(worldState.deceased || [])];
  return everybody.filter((n) => {
    if (n.communityId !== communityId) return false;
    if (sinceTick !== null && (n.createdTick ?? 0) < sinceTick) return false;
    // Only people this world actually bore. A world seeded with 400
    // founders did not give birth to them, and counting them would
    // report an enormous birth rate on tick 0.
    return birthRecordFor(worldState, n.id) !== null;
  });
}

// The bearing parent's age at the moment of a birth, or null when this
// person's birth was not recorded (a founder, an import, a fixture).
function bearerAgeAt(worldState, childId) {
  const record = birthRecordFor(worldState, childId);
  if (!record) return null;
  const bearerId = record.who?.[1];
  if (bearerId === undefined) return null;
  const bearer = worldState.npcs.find((n) => n.id === bearerId)
    || (worldState.deceased || []).find((n) => n.id === bearerId);
  if (!bearer) return null;
  return mortality.ageInYears(worldState, bearer, record.when_tick);
}

module.exports = {
  FERTILITY_MIN_AGE,
  FERTILITY_PEAK_AGE,
  FERTILITY_MAX_AGE,
  BASE_ANNUAL_BIRTH_RATE,
  PARTNER_BOND_FLOOR,
  GESTATION_TICKS,
  lastBorneTick,
  BOND_CONTACT_FLOOR,
  BOND_CONFLICT_CEILING,
  BOND_GROWTH,
  libidoMultiplier,
  fidelityMultiplier,
  otherPartnersOf,
  DISCOVERY_CHANCE_FLOOR,
  DISCOVERY_CHANCE_AT_MAX_PARANOIA,
  INFIDELITY_TRUST_HIT,
  INFIDELITY_LOVE_HIT,
  INFIDELITY_CONFLICT,
  advanceBonds,
  SCARCITY_SUPPRESSION,
  DISEASE_SUPPRESSION,
  DEPRIVATION_SUPPRESSION,
  INHERITANCE_DEVIATION,
  fertilityForAge,
  environmentalFertility,
  fertilePartnerships,
  bearChild,
  runBirths,
  birthRecordFor,
  birthsIn,
  bearerAgeAt,
};
