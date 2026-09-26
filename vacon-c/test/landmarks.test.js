// Monuments, what a building actually is, and what it costs to keep.
//
// ---------------------------------------------------------------------
// What this closes, measured
// ---------------------------------------------------------------------
// `properties.type` enumerates ten kinds in the schema's own comment and
// `worldgen` had only ever generated two — `residential` and
// `commercial`. **No world this engine ever built contained a monument,
// a historic site, a government building, a farm or an industrial one.**
//
// Four columns were in the same state, and they are exactly the facts
// somebody asks about a building: `history_ref` was hard-coded `null` in
// `generateProperty` with no way for a caller to set it, so historical
// value had a column, a table, a `significance` score and no link
// between them; `units` was 1 on every residential property; and
// `density_tier` and `lifecycle_stage: historical_legacy` had never been
// anything but null and unreached.
//
// And `property.upkeepFor` was the whole of maintenance: two flat
// constants, so **a one-bedroom flat and a cathedral cost exactly the
// same to keep standing** and nothing anywhere asked for people.
//
// ---------------------------------------------------------------------
// The two keys, and why their relationship needs no constant
// ---------------------------------------------------------------------
// The takeover key asks who is THERE; the maintain key asks what the
// place NEEDS. Neither reads the other, and the relationship falls out:
// a properly held place has at least as many people as it needs, so
// taking it costs at least what keeping it costs — and a neglected one
// inverts, becoming cheap to seize and expensive to hold. That is the
// trap, and it is two honest readings compared rather than a rule.
//
// ---------------------------------------------------------------------
// Two mistakes this file holds, both found by measuring
// ---------------------------------------------------------------------
//   **A cave system with 23 floors.** `worldgen` drew `floors` from one
//   band for every landmark, which was harmless while every property was
//   a house and became nonsense with a bridge and a rock formation on
//   the list. Three FORMS fixed it — tower, building, site — rather than
//   thirty-three tuned numbers the documents do not give.
//
//   **`Number(null)` is 0 and 0 is finite**, so `describeLandmarks`
//   counted every monument as having a measured bedroom count of zero:
//   196 of 196 on the first generated world, where 175 homes carry one
//   and nothing else does. CLAUDE.md's own corollary, in the function
//   written to measure whether the column got filled.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const landmarks = require('../server/landmarks.js');
const control = require('../server/control.js');
const property = require('../server/property.js');
const occupations = require('../server/occupations.js');
const statistics = require('../server/statistics.js');
const engine = require('../server/engine.js');
const actions = require('../server/actions.js');

// ---------------------------------------------------------------------
// The vocabularies are the documents'
// ---------------------------------------------------------------------

test('THE KEY’s twenty-three categories are all here, plus the school and the park', () => {
  // **Twenty-five.** The twenty-fourth (school) comes from a
  // disagreement between two documents this repo HAS.
  // `THE_KEY_BUILDING_TYPES.md` lists twenty-three and no school;
  // `KEY_LOCATION_DISCOVERY_WORD_OF_MOUTH_SYSTEM.md` names schools as a
  // Key building type twice — "(skyscrapers, churches, schools,
  // hospitals, caves)" and "Schools/Libraries → knowledge books across
  // every category". Both are present and both are the owner's. See
  // `landmarks.js` for why the tie breaks toward including it.
  //
  // The twenty-fifth (park) through thirty-first (shopping-mall) are
  // not a document reconciliation — all six were added 26 Sep 2026
  // directly at the owner's request, the same way the Key's own final
  // entry ("any other genuinely distinctive feature") already allows
  // for.
  assert.equal(landmarks.KEY_BUILDING_CATEGORIES.length, 32);
  assert.ok(landmarks.KEY_BUILDING_CATEGORIES.includes('school'));
  assert.ok(landmarks.KEY_BUILDING_CATEGORIES.includes('park'));
  for (const category of ['warehouse', 'public-housing', 'river', 'lake', 'corporate-headquarters', 'shopping-mall', 'casino']) {
    assert.ok(landmarks.KEY_BUILDING_CATEGORIES.includes(category), category);
  }
  for (const category of landmarks.KEY_BUILDING_CATEGORIES) {
    // `alwaysHeroTier: true` for every one, per the document.
    assert.equal(landmarks.isHeroTier(category), true, category);
  }
});

test('the retail list’s ten are here, plus the junkyard, and none are hero-tier', () => {
  assert.equal(landmarks.RETAIL_CATEGORIES.length, 11);
  assert.ok(landmarks.RETAIL_CATEGORIES.includes('hardware-store'));
  assert.ok(landmarks.RETAIL_CATEGORIES.includes('junkyard'));
  for (const category of landmarks.RETAIL_CATEGORIES) {
    assert.equal(landmarks.isHeroTier(category), false, category);
    assert.equal(landmarks.propertyTypeFor(category), 'commercial');
  }
});

test('every category maps onto a properties.type the schema defines', () => {
  // This is what makes them real rows rather than a parallel taxonomy.
  for (const category of landmarks.ALL_CATEGORIES) {
    assert.ok(
      property.PROPERTY_TYPES.includes(landmarks.propertyTypeFor(category)),
      `${category} maps to "${landmarks.propertyTypeFor(category)}"`,
    );
  }
});

test('every staff post a landmark names is a real occupation', () => {
  // Standing rule 6: a post no occupation answers is a requirement that
  // can never be met.
  for (const category of landmarks.ALL_CATEGORIES) {
    const post = landmarks.staffPostFor(category);
    if (post === null) continue;
    assert.ok(occupations.definitionOf(post), `${category} wants a "${post}"`);
  }
});

test('significance bands are ordered so importance means something', () => {
  const band = (c) => landmarks.definitionOf(c).significance;
  for (const category of landmarks.ALL_CATEGORIES) {
    const [low, high] = band(category);
    assert.ok(low < high, `${category} has a flat or inverted band`);
    assert.ok(low >= 0 && high <= 100, `${category} leaves the 0-100 scale`);
  }
  // A monument outranks a clothing store, which is the whole point of
  // having the axis at all.
  assert.ok(band('monument-memorial')[0] > band('clothing-store')[1]);
  assert.ok(band('hospital')[0] > band('hardware-store')[1]);
});

test('a cave system is not a tower', () => {
  // The guard for the 23-floor cave.
  assert.deepEqual(landmarks.floorsBandFor('cave-system'), landmarks.FORMS.site);
  assert.deepEqual(landmarks.floorsBandFor('monument-memorial'), landmarks.FORMS.site);
  assert.deepEqual(landmarks.floorsBandFor('skyscraper'), landmarks.FORMS.tower);
  // Anything that says nothing is a building, which is most of them.
  assert.deepEqual(landmarks.floorsBandFor('church'), landmarks.FORMS.building);
  assert.ok(landmarks.FORMS.tower[0] > landmarks.FORMS.building[1]);
});

// ---------------------------------------------------------------------
// designate — the link `history_ref` never had
// ---------------------------------------------------------------------

function world() {
  return {
    tick: 100,
    properties: [],
    historicalRecords: [],
    ownershipRecords: [],
    npcs: [],
    organizations: [],
    communities: [],
    cities: [],
    employmentRecords: [],
    entityOrganizationMemberships: [],
    nextEntityId: 1,
  };
}

function build(w, options = {}) {
  return property.generateProperty(w, {
    type: options.type ?? 'residential',
    value: options.value ?? 20000,
    landSize: options.landSize ?? 400,
    floors: options.floors ?? 2,
    units: 1,
    bedrooms: options.bedrooms ?? null,
    condition: 90,
    lifecycleStage: 'operation',
  });
}

test('designating a landmark writes its history and links both ways', () => {
  const w = world();
  const row = build(w, { type: 'historical_site', landSize: 5000, floors: 1 });
  assert.equal(row.history_ref, null, 'history_ref starts null, as it always has');

  const { record } = landmarks.designate(w, {
    propertyId: row.id, category: 'monument-memorial', significance: 88, tick: 100,
  });

  // The property points at the history...
  assert.equal(row.history_ref, record.id);
  // ...and the history points back at the property, which is the FK the
  // schema added `properties` for and nothing had ever used.
  assert.equal(record.where_location_id, row.id);
  assert.equal(record.significance, 88);
  assert.equal(landmarks.significanceOf(w, row.id), 88);
  assert.equal(landmarks.categoryOf(w, row.id), 'monument-memorial');
  assert.equal(landmarks.isHeroTier(row.landmark_category), true);
});

test('an ordinary building has a significance of zero, and a missing one has none', () => {
  // Zero is a real reading; null means the thing does not exist.
  const w = world();
  const house = build(w);
  assert.equal(landmarks.significanceOf(w, house.id), 0);
  assert.equal(landmarks.significanceOf(w, 9999), null);
});

test('designating something that is not a category throws', () => {
  const w = world();
  const row = build(w);
  assert.throws(
    () => landmarks.designate(w, { propertyId: row.id, category: 'the-white-house', significance: 90 }),
    /is not a Key building or retail category/,
  );
  assert.throws(
    () => landmarks.designate(w, { propertyId: row.id, category: 'church' }),
    /requires a numeric significance/,
  );
});

test('density is derived from the building’s own dimensions', () => {
  // A real TEXT column that was null on every property in every world,
  // and the schema gives it no vocabulary — so the four names are this
  // file's and the VALUE is arithmetic, not a draw. A one-storey house
  // on a hectare cannot come out `dense`.
  const w = world();
  const sprawling = build(w, { landSize: 5000, floors: 1 });
  const stacked = build(w, { landSize: 100, floors: 20 });
  assert.equal(sprawling.density_tier, 'rural');
  assert.equal(stacked.density_tier, 'dense');
  assert.ok(landmarks.DENSITY_TIERS.includes(sprawling.density_tier));
  // Unknown land is not low density — it is not a density at all.
  assert.equal(landmarks.densityTierFor({ land_size: null, units: 1, floors: 1 }), null);
});

// ---------------------------------------------------------------------
// The maintain key
// ---------------------------------------------------------------------

function cityWithBoth() {
  const w = world();
  // A dozen ordinary houses, so the world has a median building to
  // measure against — `sizeOf` is relative to the world's own typical
  // property, which is standing rule 17's corollary.
  for (let i = 0; i < 12; i += 1) build(w, { landSize: 400, floors: 2, bedrooms: 2 });
  const flat = build(w, { landSize: 200, floors: 1, bedrooms: 1 });
  const monument = build(w, { type: 'historical_site', landSize: 9000, floors: 1 });
  landmarks.designate(w, {
    propertyId: monument.id, category: 'monument-memorial', significance: 90, tick: 100,
  });
  return { w, flat, monument };
}

test('a one-bedroom apartment takes one person to keep', () => {
  // The floor the request itself names, and a definition rather than a
  // tuning: every other number on the ladder is relative to it.
  const { w, flat } = cityWithBoth();
  const maintain = control.maintenanceFor(w, { scale: 'property', locationId: flat.id });
  assert.equal(maintain.total, control.MINIMUM_MAINTENANCE);
  assert.equal(maintain.total, 1);
});

test('a monument costs far more to keep than a flat, and says why', () => {
  const { w, flat, monument } = cityWithBoth();
  const small = control.maintenanceFor(w, { scale: 'property', locationId: flat.id });
  const large = control.maintenanceFor(w, { scale: 'property', locationId: monument.id });

  assert.ok(large.total > small.total * 10, `monument ${large.total} vs flat ${small.total}`);
  // The two terms the request named separately.
  assert.ok(large.size > small.size, 'size did not differ');
  assert.ok(large.significance > small.significance, 'importance did not differ');
  assert.ok(large.security > 0, 'a monument needs nobody watching it');
  assert.equal(small.security, 0, 'a one-bedroom flat needs a guard');
});

test('importance costs, holding size constant', () => {
  // The significance term on its own, with the size term pinned — so
  // this cannot pass by accident because one building is bigger.
  const { w } = cityWithBoth();
  const plain = build(w, { landSize: 4000, floors: 3 });
  const storied = build(w, { landSize: 4000, floors: 3 });
  landmarks.designate(w, {
    propertyId: storied.id, category: 'historic-site', significance: 100, tick: 100,
  });

  const a = control.maintenanceFor(w, { scale: 'property', locationId: plain.id });
  const b = control.maintenanceFor(w, { scale: 'property', locationId: storied.id });
  assert.equal(a.size, b.size, 'the two buildings are not the same size');
  // SIGNIFICANCE_WEIGHT is 1.0, so significance 100 doubles it.
  assert.equal(b.total, a.total * 2);
});

test('a scale that is not a scale throws, and a missing target has no requirement', () => {
  const { w } = cityWithBoth();
  assert.throws(
    () => control.maintenanceFor(w, { scale: 'continent', locationId: 1 }),
    /is not a scale/,
  );
  assert.equal(control.maintenanceFor(w, { scale: 'property', locationId: 9999 }), null);
});

// ---------------------------------------------------------------------
// The relationship between the two keys
// ---------------------------------------------------------------------

test('a neglected place is cheap to seize and expensive to hold', () => {
  // The trap, and the reason neither key reads the other.
  const { w, monument } = cityWithBoth();
  const upkeep = control.upkeepOf(w, { scale: 'property', locationId: monument.id });
  assert.equal(upkeep.present, 0, 'nobody is at the monument');
  assert.equal(upkeep.neglected, true);
  assert.ok(
    upkeep.takeoverCost < upkeep.maintainCost,
    `taking it (${upkeep.takeoverCost}) should cost less than keeping it (${upkeep.maintainCost})`,
  );
});

test('a properly held place costs at least as much to take as to keep', () => {
  // The other side of the same comparison. Staff it to its requirement
  // and the takeover cost rises to meet the maintenance cost.
  const { w, monument } = cityWithBoth();
  const need = control.maintenanceFor(w, { scale: 'property', locationId: monument.id }).total;
  for (let i = 0; i < need; i += 1) {
    const npc = { id: 1000 + i, status: 'active', createdTick: w.tick - 30 * 365, home_property_id: monument.id };
    w.npcs.push(npc);
  }
  const upkeep = control.upkeepOf(w, { scale: 'property', locationId: monument.id });
  assert.equal(upkeep.neglected, false);
  assert.ok(
    upkeep.takeoverCost >= upkeep.maintainCost,
    `taking it (${upkeep.takeoverCost}) should cost at least keeping it (${upkeep.maintainCost})`,
  );
});

test('an ordinary house decays exactly as it always did', () => {
  // Standing rule 12's first clause. A house needs one person and has
  // one, so its upkeep ratio is 1 and both constants are untouched —
  // switching the maintain key on must not move the housing stock.
  const { w } = cityWithBoth();
  const npc = { id: 500, status: 'active', createdTick: w.tick - 30 * 365 };
  w.npcs.push(npc);
  const house = build(w, { landSize: 400, floors: 2, bedrooms: 2 });
  npc.home_property_id = house.id;
  house.occupants = [npc.id];
  property.recordOwnership(w, {
    entityId: house.id, ownerEntityId: npc.id, ownerType: 'individual', tick: 0,
  });

  const before = house.condition;
  property.advancePropertyLifecycle(w, house, w.tick + 1);
  const moved = house.condition - before;
  const expected = -property.CONDITION_DECAY_PER_TICK
    + property.OCCUPANT_UPKEEP_PER_TICK + property.OWNER_UPKEEP_PER_TICK;
  assert.ok(Math.abs(moved - expected) < 0.06, `moved ${moved}, expected about ${expected}`);
});

test('the two columns that say who is in a building cannot disagree quietly', () => {
  // `npcs.home_property_id` and `properties.occupants` are the same
  // fact written twice — `upkeepFor` reads the second and the takeover
  // key reads the first. The day they diverge, upkeep would silently
  // scale to zero and every building in the world would rot at the full
  // rate with nothing thrown. The holders read is their union.
  const { w } = cityWithBoth();
  const house = build(w);
  const listed = { id: 601, status: 'active', createdTick: w.tick - 30 * 365 };
  w.npcs.push(listed);
  house.occupants = [listed.id];
  // Named in `occupants` and NOT by `home_property_id`, which is the
  // disagreement.
  const holders = control.SCALES.property.holders(w, house);
  assert.equal(holders.length, 1, 'the occupant list was ignored');
  assert.equal(holders[0].id, listed.id);
});

// ---------------------------------------------------------------------
// Repurposing
// ---------------------------------------------------------------------

test('a monument’s past does not fix its future', () => {
  const { w, monument } = cityWithBoth();
  const before = landmarks.significanceOf(w, monument.id);
  const result = landmarks.repurpose(w, {
    propertyId: monument.id, toType: 'government', tick: 200,
  });

  assert.equal(result.from, 'historical_site');
  assert.equal(monument.type, 'government');
  assert.equal(monument.former_type, 'historical_site');
  assert.equal(monument.repurposed_tick, 200);
  assert.equal(monument.lifecycle_stage, 'renovation');

  // What it WAS survives what it BECAME — the whole reason significance
  // lives on the history row rather than on the property.
  assert.equal(landmarks.significanceOf(w, monument.id), before);
  assert.equal(landmarks.categoryOf(w, monument.id), 'monument-memorial');
  // And it still costs what a monument costs to hold. You do not get
  // the Arch's presence and a shed's upkeep.
  const maintain = control.maintenanceFor(w, { scale: 'property', locationId: monument.id });
  assert.equal(maintain.significance, before);
});

test('repurposing to what it already is changes nothing', () => {
  const { w, monument } = cityWithBoth();
  assert.equal(landmarks.repurpose(w, { propertyId: monument.id, toType: 'historical_site' }), null);
  assert.equal(monument.former_type, null);
});

test('repurposing to a type the schema does not have throws', () => {
  const { w, monument } = cityWithBoth();
  assert.throws(
    () => landmarks.repurpose(w, { propertyId: monument.id, toType: 'fortress' }),
    /is not a properties\.type/,
  );
});

test('only whoever holds a building may change what it is', () => {
  // The check that gives the takeover key a consequence beyond a line
  // in the history: take the Arch, and THEN you can make it a fortress.
  const npc = engine.generateNPC();
  const other = engine.generateNPC();
  const player = engine.generatePlayer({ linkedEntityId: other.id });
  const row = engine.generateProperty({
    type: 'historical_site', value: 100000, landSize: 5000, floors: 1, lifecycleStage: 'operation',
  });

  assert.throws(
    () => engine.dispatchAction(player.id, {
      action: 'repurpose-property', propertyId: row.id, toType: 'government',
    }),
    /no recorded owner/,
  );

  engine.recordOwnership({
    entityId: row.id, ownerEntityId: npc.id, ownerType: 'individual', tick: engine.WorldState.tick,
  });
  assert.throws(
    () => engine.dispatchAction(player.id, {
      action: 'repurpose-property', propertyId: row.id, toType: 'government',
    }),
    /belongs to individual/,
  );

  const owner = engine.generatePlayer({ linkedEntityId: npc.id });
  const { result } = engine.dispatchAction(owner.id, {
    action: 'repurpose-property', propertyId: row.id, toType: 'government',
  });
  assert.equal(result.to, 'government');
});

test('the action list offers it', () => {
  assert.ok(actions.listActions('citizen').map((a) => a.action).includes('repurpose-property'));
});

// ---------------------------------------------------------------------
// The measurements
// ---------------------------------------------------------------------

test('describeLandmarks does not count a null bedroom as zero bedrooms', () => {
  // `Number(null)` is 0 and 0 is finite — the corollary that made this
  // function report 196 of 196 properties as having a measured bedroom
  // count when 175 did.
  const w = world();
  build(w, { bedrooms: 2 });
  build(w, { type: 'historical_site' });
  assert.equal(landmarks.describeLandmarks(w).withBedrooms, 1);
});

test('describeLandmarks names the categories a world is missing', () => {
  const w = world();
  const row = build(w, { type: 'commercial' });
  landmarks.designate(w, { propertyId: row.id, category: 'hardware-store', significance: 30 });
  const described = landmarks.describeLandmarks(w);
  assert.deepEqual(described.present, ['hardware-store']);
  assert.equal(described.absent.length, landmarks.ALL_CATEGORIES.length - 1);
  assert.equal(described.categories, landmarks.ALL_CATEGORIES.length);
});

test('the catalogue carries what a building is and whether it is kept', () => {
  for (const key of [
    'landmark_count', 'mean_historical_significance', 'mean_bedrooms',
    'maintenance_shortfall', 'control_key_force',
  ]) {
    assert.ok(statistics.KEYS.includes(key), `${key} is not in the catalogue`);
  }
});
