// World Layer — the shared location/NPC/commerce data layer.
//
// **This app had no tests at all.** It was the only one in the
// ecosystem without them: six real modules, 754 lines, a Postgres
// schema, and a UNESCO import pipeline, none of it ever executed by
// anything. It is also the layer the whole global-coverage cost
// argument rests on — `UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md`'s target
// is "90%+ automated world construction, 10% human refinement", and
// this is the 90%.
//
// The three-tier model is the load-bearing idea and is tested first,
// because it is what makes global coverage affordable: hero (~1,200
// UNESCO locations, paid human work), regional (AI-assisted), filler
// (fully automated). If tier assignment is not real, the cost model
// built on top of it is not real either.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const locations = require('../locations.js');
const npcGenesis = require('../npcGenesis.js');
const commerce = require('../commerce.js');
const transportation = require('../transportation.js');
const propagation = require('../propagation.js');
const assetLibrary = require('../assetLibrary.js');

const world = () => locations.createWorldLayer();

// ---------------------------------------------------------------------------
// Locations and the three tiers
// ---------------------------------------------------------------------------

test('the three tiers are exactly the ones the cost model is built on', () => {
  // hero / regional / filler. The human-cost hierarchy in the
  // architecture document maps one-to-one onto these, so an extra or
  // missing tier would silently invalidate the pricing.
  assert.deepEqual(locations.LOCATION_TIERS, ['hero', 'regional', 'filler']);
});

test('a location needs a name and real coordinates', () => {
  const w = world();
  assert.throws(() => locations.generateLocation(w, { lat: 1, lng: 2 }), /name/);
  assert.throws(() => locations.generateLocation(w, { name: 'X' }), /lat and lng/);
  assert.throws(() => locations.generateLocation(w, { name: 'X', lat: '1', lng: 2 }), /lat and lng/);
  assert.equal(w.locations.length, 0);
});

test('a location cannot be created in a tier that does not exist', () => {
  const w = world();
  assert.throws(
    () => locations.generateLocation(w, { name: 'X', lat: 1, lng: 2, tier: 'premium' }),
    /invalid tier/,
  );
});

test('a location defaults to filler — the automated tier, not the paid one', () => {
  // The default matters commercially: if a new location defaulted to
  // `hero`, an automated import of thousands of places would silently
  // book them all as paid human work.
  const w = world();
  const place = locations.generateLocation(w, { name: 'Somewhere', lat: 38.6, lng: -90.2 });
  assert.equal(place.tier, 'filler');
});

test('the eight data slices every consuming app reads are all present', () => {
  const w = world();
  const place = locations.generateLocation(w, { name: 'Saint Louis', lat: 38.63, lng: -90.2 });
  for (const field of locations.DATA_FIELDS) {
    assert.ok(field in place, `${field} is missing from a generated location`);
  }
});

test('location data can be set and read back', () => {
  const w = world();
  const place = locations.generateLocation(w, { name: 'Saint Louis', lat: 38.63, lng: -90.2 });

  locations.setLocationData(w, place.id, 'buildingData', { footprints: 12000, source: 'overture' });
  const read = locations.getLocation(w, place.id);
  assert.equal(read.buildingData.footprints, 12000);
  assert.equal(read.buildingData.source, 'overture');
});

test('a location that does not exist reads null rather than throwing', () => {
  assert.equal(locations.getLocation(world(), 999), null);
});

test('events accumulate on a location rather than replacing each other', () => {
  const w = world();
  const place = locations.generateLocation(w, { name: 'Saint Louis', lat: 38.63, lng: -90.2 });

  locations.addLocationEvent(w, place.id, { type: 'flood', severity: 'high' });
  locations.addLocationEvent(w, place.id, { type: 'market_day', severity: 'low' });

  assert.equal(locations.getLocation(w, place.id).eventHistoryData.length, 2);
});

// ---------------------------------------------------------------------------
// NPC Genesis — one creation system, roles assigned after
// ---------------------------------------------------------------------------

test('roles are assigned after generation, not baked in at creation', () => {
  // The README's central claim about this engine: one generated person
  // can hold several roles at once. If a role were fixed at creation,
  // a survivor could never also become an employee.
  const w = world();
  const place = locations.generateLocation(w, { name: 'Ward 4', lat: 38.6, lng: -90.2 });
  const person = npcGenesis.generateNPC(w, { locationId: place.id, demographics: { age: 30 } });

  npcGenesis.assignRole(w, person.id, 'survivor');
  npcGenesis.assignRole(w, person.id, 'employee');

  const read = npcGenesis.getNPC(w, person.id);
  assert.ok(read.roles.includes('survivor'));
  assert.ok(read.roles.includes('employee'));
  assert.equal(read.roles.length, 2, 'one person, two roles, not two people');
});

test('the same role twice does not duplicate', () => {
  const w = world();
  const place = locations.generateLocation(w, { name: 'Ward 4', lat: 38.6, lng: -90.2 });
  const person = npcGenesis.generateNPC(w, { locationId: place.id, demographics: { age: 30 } });

  npcGenesis.assignRole(w, person.id, 'survivor');
  npcGenesis.assignRole(w, person.id, 'survivor');

  assert.equal(npcGenesis.getNPC(w, person.id).roles.length, 1);
});

test('an unknown role is refused', () => {
  const w = world();
  const place = locations.generateLocation(w, { name: 'Ward 4', lat: 38.6, lng: -90.2 });
  const person = npcGenesis.generateNPC(w, { locationId: place.id, demographics: { age: 30 } });

  assert.throws(() => npcGenesis.assignRole(w, person.id, 'wizard'), /role/i);
});

test('people are found by the location they are at', () => {
  const w = world();
  const here = locations.generateLocation(w, { name: 'Here', lat: 1, lng: 1 });
  const there = locations.generateLocation(w, { name: 'There', lat: 2, lng: 2 });

  npcGenesis.generateNPC(w, { locationId: here.id, demographics: { age: 30 } });
  npcGenesis.generateNPC(w, { locationId: here.id, demographics: { age: 30 } });
  npcGenesis.generateNPC(w, { locationId: there.id, demographics: { age: 30 } });

  assert.equal(npcGenesis.getNPCsAtLocation(w, here.id).length, 2);
  assert.equal(npcGenesis.getNPCsAtLocation(w, there.id).length, 1);
});

test('relocating moves a person and does not clone them', () => {
  const w = world();
  const here = locations.generateLocation(w, { name: 'Here', lat: 1, lng: 1 });
  const there = locations.generateLocation(w, { name: 'There', lat: 2, lng: 2 });
  const person = npcGenesis.generateNPC(w, { locationId: here.id, demographics: { age: 30 } });

  npcGenesis.relocateNPC(w, person.id, there.id);

  assert.equal(npcGenesis.getNPCsAtLocation(w, here.id).length, 0);
  assert.equal(npcGenesis.getNPCsAtLocation(w, there.id).length, 1);
  assert.equal(w.npcs.length, 1, 'one person, moved — not two people');
});

// ---------------------------------------------------------------------------
// Commerce — the real call into Genesis, not a shared id convention
// ---------------------------------------------------------------------------

test('founding a business assigns its owner the business_founder role', () => {
  // The README claims this is "a real call into the NPC Genesis Engine,
  // not just a shared locationId convention". That is a checkable claim.
  const w = world();
  const place = locations.generateLocation(w, { name: 'Ward 4', lat: 1, lng: 1 });
  const owner = npcGenesis.generateNPC(w, { locationId: place.id, demographics: { age: 30 } });

  commerce.generateBusiness(w, {
    locationId: place.id, industry: 'milling', ownerId: owner.id,
  });

  assert.ok(npcGenesis.getNPC(w, owner.id).roles.includes('business_founder'));
});

test('hiring assigns the employee role', () => {
  const w = world();
  const place = locations.generateLocation(w, { name: 'Ward 4', lat: 1, lng: 1 });
  const owner = npcGenesis.generateNPC(w, { locationId: place.id, demographics: { age: 30 } });
  const hire = npcGenesis.generateNPC(w, { locationId: place.id, demographics: { age: 30 } });

  const business = commerce.generateBusiness(w, {
    locationId: place.id, industry: 'milling', ownerId: owner.id,
  });
  commerce.addEmployee(w, business.id, hire.id);

  assert.ok(npcGenesis.getNPC(w, hire.id).roles.includes('employee'));
});

test('businesses are found by location', () => {
  const w = world();
  const place = locations.generateLocation(w, { name: 'Ward 4', lat: 1, lng: 1 });
  const other = locations.generateLocation(w, { name: 'Ward 5', lat: 2, lng: 2 });

  commerce.generateBusiness(w, { locationId: place.id, industry: 'retail' });
  commerce.generateBusiness(w, { locationId: place.id, industry: 'retail' });
  commerce.generateBusiness(w, { locationId: other.id, industry: 'retail' });

  assert.equal(commerce.getBusinessesAtLocation(w, place.id).length, 2);
});

// ---------------------------------------------------------------------------
// Transportation — where ownership deliberately does NOT assign a role
// ---------------------------------------------------------------------------

test('owning a transport node assigns no role, unlike a business', () => {
  // Deliberate asymmetry, documented in the README: no role in the
  // Genesis Engine's list fits transport ownership, so none is invented.
  const w = world();
  const place = locations.generateLocation(w, { name: 'Ward 4', lat: 1, lng: 1 });
  const owner = npcGenesis.generateNPC(w, { locationId: place.id, demographics: { age: 30 } });

  transportation.generateTransportNode(w, {
    locationId: place.id, ownerId: owner.id,
  });

  assert.deepEqual(npcGenesis.getNPC(w, owner.id).roles, [],
    'a business founder gets a role; a depot owner does not, and that is on purpose');
});

test('operational and control status must be values the module defines', () => {
  const w = world();
  const place = locations.generateLocation(w, { name: 'Ward 4', lat: 1, lng: 1 });
  const node = transportation.generateTransportNode(w, { locationId: place.id });

  assert.throws(() => transportation.setOperationalStatus(w, node.id, 'vibing'), /status/i);
  assert.throws(() => transportation.setControlStatus(w, node.id, 'vibing'), /status/i);

  transportation.setOperationalStatus(w, node.id, transportation.OPERATIONAL_STATUSES[0]);
  assert.equal(
    transportation.getTransportNode(w, node.id).operationalStatus,
    transportation.OPERATIONAL_STATUSES[0],
  );
});

// ---------------------------------------------------------------------------
// Information propagation — one mechanism, no branching on event type
// ---------------------------------------------------------------------------

test('news travels less far the further it has to go', () => {
  const near = propagation.calculatePropagation({ distance: 10, connectivity: 80, trustNetwork: 80 });
  const far = propagation.calculatePropagation({ distance: 5000, connectivity: 80, trustNetwork: 80 });

  assert.ok(near.spreadProbability > far.spreadProbability,
    `near ${near.spreadProbability} should beat far ${far.spreadProbability}`);
  assert.ok(far.timeDelay > near.timeDelay, 'and takes longer to arrive');
});

test('a language barrier halves the spread', () => {
  const open = propagation.calculatePropagation({ distance: 100, connectivity: 80, trustNetwork: 80 });
  const barred = propagation.calculatePropagation({
    distance: 100, connectivity: 80, trustNetwork: 80, languageBarrier: true,
  });
  assert.ok(barred.spreadProbability < open.spreadProbability);
});

test('trust and connectivity both move the spread', () => {
  const base = { distance: 100, connectivity: 50, trustNetwork: 50 };
  const trusting = propagation.calculatePropagation({ ...base, trustNetwork: 95 });
  const connected = propagation.calculatePropagation({ ...base, connectivity: 95 });
  const baseline = propagation.calculatePropagation(base);

  assert.ok(trusting.spreadProbability > baseline.spreadProbability);
  assert.ok(connected.spreadProbability > baseline.spreadProbability);
});

test('spread probability stays inside 0-100 at the extremes', () => {
  const maxed = propagation.calculatePropagation({ distance: 0, connectivity: 100, trustNetwork: 100 });
  const nothing = propagation.calculatePropagation({ distance: 99999, connectivity: 0, trustNetwork: 0 });

  assert.ok(maxed.spreadProbability <= 100);
  assert.ok(nothing.spreadProbability >= 0);
});

test('propagation refuses inputs it cannot compute from', () => {
  assert.throws(() => propagation.calculatePropagation({ distance: -1, connectivity: 50, trustNetwork: 50 }), /distance/);
  assert.throws(() => propagation.calculatePropagation({ distance: 1, connectivity: 500, trustNetwork: 50 }), /connectivity/);
  assert.throws(() => propagation.calculatePropagation({ distance: 1, connectivity: 50, trustNetwork: -5 }), /trustNetwork/);
  assert.throws(() => propagation.calculatePropagation({
    distance: 1, connectivity: 50, trustNetwork: 50, languageBarrier: 'yes',
  }), /languageBarrier/);
});

// The module's own design claim: eventType is a free-form string
// because the mechanism must not branch on it.
test('the same mechanism carries a rumor and a disaster identically', () => {
  const w = world();
  const from = locations.generateLocation(w, { name: 'From', lat: 0, lng: 0 });

  const rumor = propagation.originateEvent(w, { originLocationId: from.id, eventType: 'rumor', content: 'a rumor' });
  const flood = propagation.originateEvent(w, { originLocationId: from.id, eventType: 'disaster', content: 'a flood' });

  assert.equal(typeof rumor.id, 'number');
  assert.equal(typeof flood.id, 'number');
  assert.equal(propagation.getInformationEvent(w, rumor.id).eventType, 'rumor');
  assert.equal(propagation.getInformationEvent(w, flood.id).eventType, 'disaster');
});

// ---------------------------------------------------------------------------
// Asset library — the reuse that the cost model depends on
// ---------------------------------------------------------------------------

test('asset quality reuses the location tiers rather than a parallel enum', () => {
  // "One generated gas station appears in thousands of towns." The
  // reuse count is the thing the cost argument rests on, so it has to
  // be real and tracked.
  const w = world();
  const asset = assetLibrary.registerAsset(w, {
    assetType: 'building', generatedModel: 'gas-station-a.glb', qualityLevel: 'filler',
  });
  assert.equal(asset.qualityLevel, 'filler');

  assert.throws(() => assetLibrary.registerAsset(w, {
    assetType: 'building', generatedModel: 'bad.glb', qualityLevel: 'ultra',
  }), /quality|tier/i);
});

test('using an asset is counted, which is what makes reuse measurable', () => {
  const w = world();
  const place = locations.generateLocation(w, { name: 'Ward 4', lat: 1, lng: 1 });
  const asset = assetLibrary.registerAsset(w, {
    assetType: 'building', generatedModel: 'gas-station-a.glb', qualityLevel: 'filler',
  });

  assetLibrary.useAsset(w, asset.id, place.id);
  assetLibrary.useAsset(w, asset.id, place.id);

  const read = assetLibrary.getAsset(w, asset.id);
  assert.ok(read.usageCount >= 2 || w.assetUsages.length >= 2,
    'reuse has to be counted somewhere, or the savings claim is unmeasurable');
});

test('assets are findable by type', () => {
  const w = world();
  assetLibrary.registerAsset(w, { assetType: 'building', generatedModel: 'a.glb' });
  assetLibrary.registerAsset(w, { assetType: 'building', generatedModel: 'b.glb' });
  assetLibrary.registerAsset(w, { assetType: 'vehicle', generatedModel: 'c.glb' });

  assert.equal(assetLibrary.getAssetsByType(w, 'building').length, 2);
  assert.equal(assetLibrary.getAssetsByType(w, 'vehicle').length, 1);
});

// ---------------------------------------------------------------------------
// The layers meeting
// ---------------------------------------------------------------------------

test('a location, its people, its businesses and its assets all hang together', () => {
  // The point of a shared layer: one city record that several systems
  // read, rather than each app generating its own copy.
  const w = world();
  const city = locations.generateLocation(w, {
    name: 'Saint Louis', lat: 38.63, lng: -90.2, tier: 'regional',
  });

  const founder = npcGenesis.generateNPC(w, { locationId: city.id, demographics: { age: 30 } });
  const worker = npcGenesis.generateNPC(w, { locationId: city.id, demographics: { age: 30 } });
  const mill = commerce.generateBusiness(w, {
    locationId: city.id, industry: 'milling', ownerId: founder.id,
  });
  commerce.addEmployee(w, mill.id, worker.id);
  transportation.generateTransportNode(w, { locationId: city.id });
  const asset = assetLibrary.registerAsset(w, {
    assetType: 'building', generatedModel: 'mill-shell.glb', qualityLevel: 'regional',
  });
  assetLibrary.useAsset(w, asset.id, city.id);

  assert.equal(npcGenesis.getNPCsAtLocation(w, city.id).length, 2);
  assert.equal(commerce.getBusinessesAtLocation(w, city.id).length, 1);
  assert.equal(transportation.getTransportNodesAtLocation(w, city.id).length, 1);
  assert.ok(npcGenesis.getNPC(w, founder.id).roles.includes('business_founder'));
  assert.ok(npcGenesis.getNPC(w, worker.id).roles.includes('employee'));
});
