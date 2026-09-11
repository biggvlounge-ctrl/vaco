// VACANCY — seed a world worth looking at.
//
// A fresh VACON-C boots empty: no people, no families, no resources, no
// market. Every tab of the frontend then correctly says "nothing here
// yet", which is honest and useless — the thing that makes the engine
// worth showing anyone is a world with a drought running through it.
//
// Run:
//   node server.js                      # in one terminal
//   VACON_C_TOKEN=<a Shield session> node scripts/seed-world.mjs
//
// `scripts/seed-demo.mjs` at the repo root does this for you as part of
// seeding the whole ecosystem, signing in as a demo user first. Run
// that instead unless you want VACON-C on its own.
//
// **Over HTTP, deliberately.** The obvious shortcut is to require
// `server/engine.js` and call the generators directly, and it does not
// work: `WorldState` is a module singleton living inside the server
// process, so a separate script would populate its own copy and the
// running server would still be empty. Going through the API is also
// the only way this doubles as an end-to-end exercise of the routes.
//
// **The drought needs an operator.** Ticks and environmental conditions
// change the world for everybody and are guarded accordingly, so this
// script seeds content with no credentials and then tries the drought.
// If it is refused it says so and stops there with a world that is
// still perfectly worth looking at — it does not weaken anything to get
// through. For a local demo:
//
//   VACO_SERVICE_AUTH_MODE=off VACO_OPERATOR_MODE=off node server.js

import process from 'node:process';

const BASE = process.env.VACON_C_URL || 'http://localhost:8809';
const TICKS = Number(process.env.SEED_TICKS || 4);

let created = 0;

// **Credentials, so this works against a normally-guarded server.**
//
// This script used to send none, which meant it only ran against a
// server started with `VACO_SERVICE_AUTH_MODE=off` -- a configuration
// nobody boots by accident and nobody should boot for a demo. Against
// the real ecosystem every write refused on the first call:
//
//   serviceAuth: this route requires either a user session
//   (Authorization: Bearer) or a trusted-service credential.
//
// So the seeder could not seed the running ecosystem, which is the only
// place anyone would want it. It takes a credential from the
// environment now and sends it. Either kind the guard accepts works;
// `scripts/seed-demo.mjs` passes a real signed-in user's session, so
// the world is built by the same route a person uses, through the same
// guard, with nothing relaxed.
const TOKEN = process.env.VACON_C_TOKEN || '';
const SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'vaco-shell';
const SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';

function authHeaders() {
  if (TOKEN) return { Authorization: `Bearer ${TOKEN}` };
  if (SERVICE_TOKEN) return { 'X-Service-Name': SERVICE_NAME, 'X-Service-Token': SERVICE_TOKEN };
  return {};
}

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
  if (!res.ok) {
    const err = new Error((parsed && parsed.error) || `${method} ${path} -> ${res.status}`);
    err.status = res.status;
    throw err;
  }
  if (method === 'POST') created += 1;
  return parsed;
}

const post = (p, b) => call('POST', p, b ?? {});
const get = (p) => call('GET', p);

function say(line) { process.stdout.write(`  ${line}\n`); }

// ---------------------------------------------------------------------------

async function main() {
  process.stdout.write(`\nSeeding ${BASE}\n\n`);

  try {
    await get('/api/health');
  } catch (err) {
    process.stderr.write(
      `\nCannot reach VACON-C at ${BASE}.\n`
      + '  Start it first:  node server.js\n'
      + `  Or point this somewhere else:  VACON_C_URL=... node scripts/seed-world.mjs\n\n`,
    );
    process.exit(1);
  }

  // -- people ---------------------------------------------------------------
  const npcs = [];
  for (let i = 0; i < 12; i += 1) npcs.push((await post('/api/npc/generate')).npc);
  say(`${npcs.length} people`);

  // -- families, with real members so wealth has something to sum -----------
  // Three generations in one household is the shape the Family Engine
  // was built for, so the seed uses it rather than a flat list.
  const households = [
    { surname: 'Adeyemi', roles: ['head', 'spouse', 'child', 'child'] },
    { surname: 'Vance', roles: ['head', 'child'] },
    { surname: 'Okonkwo', roles: ['head', 'spouse', 'child'] },
  ];
  let cursor = 0;
  for (const house of households) {
    const family = await post('/api/families', { surname: house.surname });
    for (let i = 0; i < house.roles.length && cursor < npcs.length; i += 1, cursor += 1) {
      await post(`/api/families/${family.id}/members`, {
        entityId: npcs[cursor].id,
        role: house.roles[i],
        generationNumber: house.roles[i] === 'child' ? 2 : 1,
      });
      // Family wealth is summed from members' finances, so without
      // these every household reads 0 and the rollup looks broken when
      // it is merely empty. Heads earn, children hold almost nothing.
      const head = house.roles[i] === 'head' || house.roles[i] === 'spouse';
      await post(`/api/entities/${npcs[cursor].id}/finances`, {
        income: head ? 120 + i * 15 : 0,
        savings: head ? 400 + i * 90 : 25,
        debt: head ? 60 : 0,
        assets: head ? 250 : 0,
      });
    }
  }
  say(`${households.length} families, with finances`);

  // -- organizations, both kinds -------------------------------------------
  const kestrels = await post('/api/organizations', { name: 'The Kestrels', type: 'gang', isFaction: true });
  const ashfall = await post('/api/organizations', { name: 'Ashfall Company', type: 'gang', isFaction: true });
  await post('/api/organizations', { name: 'Riverside Mill', type: 'business' });
  await post('/api/organizations', { name: 'Ward Council', type: 'government' });
  say('2 factions, 2 other organizations');

  // -- geography, and the blocks the factions hold --------------------------
  // The tick's Organization phase resolves control for every territory
  // block, so without at least one block that entire phase runs over an
  // empty array and the simulation has no territorial dimension at all.
  const city = await post('/api/cities', {
    name: 'Saint Louis', population: 12000, economy: 46, infrastructure: 41, safety: 38,
  });
  const wards = [];
  for (const ward of [
    { population: 3200, housing: 44, crime: 31, safety: 40, employment: 52 },
    { population: 2800, housing: 58, crime: 12, safety: 66, employment: 61 },
    { population: 1900, housing: 33, crime: 47, safety: 27, employment: 38 },
  ]) {
    wards.push(await post('/api/communities', { cityId: city.id, tier: 'block', ...ward }));
  }

  // Split between the two factions, so a status change on one is
  // visibly not a status change on the other.
  const holdings = [
    { factionId: kestrels.id, communityId: wards[0].id, buildingCount: 24, crimeRate: 31 },
    { factionId: kestrels.id, communityId: wards[1].id, buildingCount: 31, crimeRate: 12 },
    { factionId: ashfall.id, communityId: wards[2].id, buildingCount: 17, crimeRate: 47 },
  ];
  for (const holding of holdings) {
    await post('/api/territory-blocks', { cityId: city.id, ...holding });
  }
  say(`1 city, ${wards.length} communities, ${holdings.length} territory blocks`);

  // -- an economy that is in balance, so a drought has somewhere to move ----
  // Every resource starts near scarcity 50. Seeding a crisis would show
  // a red screen that proves nothing; the interesting thing is watching
  // one arrive.
  await post('/api/resources', {
    resourceType: 'water', quantity: 400, supply: 120, demand: 120,
    productionRate: 12, consumptionRate: 14,
  });
  await post('/api/resources', {
    resourceType: 'grain', quantity: 900, supply: 200, demand: 190,
    productionRate: 30, consumptionRate: 28,
  });
  await post('/api/resources', {
    resourceType: 'energy', quantity: 300, supply: 150, demand: 140,
    productionRate: 20, consumptionRate: 22,
  });

  // One listing per raw input, plus one made from nothing — the control
  // that shows a drought moves the goods it should and leaves the rest.
  await post('/api/market/listings', {
    productName: 'water ration', resourceType: 'water', price: 10, supply: 100, demand: 100,
  });
  await post('/api/market/listings', {
    productName: 'bread', resourceType: 'grain', price: 4, supply: 200, demand: 190,
  });
  await post('/api/market/listings', {
    productName: 'hand-carved chair', price: 100, supply: 40, demand: 40,
  });
  say('3 resources, 3 market listings');

  // -- culture ---------------------------------------------------------------
  // Culture DNA is tier-level: the wards belong to a culture, they do
  // not each carry one. Two cultures rather than one, so the difference
  // between them is visible — and one of them values education far
  // below the Education Flow's threshold, which is what makes that flow
  // fire on a seeded world instead of only in a test.
  const riverside = await post('/api/cultures', {
    name: 'Riverside', era: 'post-collapse',
    traits: { trustLevel: 62, tradition: 74, innovation: 31, cooperation: 68, education: 44, art: 55, religion: 48, competition: 35 },
    communicationStyle: 'indirect', leadershipStyle: 'elder', conflictResolution: 'mediation',
    customs: ['river blessing at first thaw'], cuisine: ['river fish', 'flatbread'],
  });
  const ashfallCulture = await post('/api/cultures', {
    name: 'Ashfall', era: 'post-collapse',
    traits: { trustLevel: 28, tradition: 33, innovation: 66, cooperation: 30, education: 22, art: 40, religion: 19, competition: 81 },
    communicationStyle: 'direct', leadershipStyle: 'militant', conflictResolution: 'duel',
    customs: ['no debts carried past winter'], cuisine: ['salt pork', 'ash bread'],
  });

  await post(`/api/cultures/${riverside.id}/members`, { tier: 'city', entityId: city.id });
  await post(`/api/cultures/${riverside.id}/members`, { tier: 'community', entityId: wards[0].id });
  await post(`/api/cultures/${riverside.id}/members`, { tier: 'community', entityId: wards[1].id });
  await post(`/api/cultures/${ashfallCulture.id}/members`, { tier: 'community', entityId: wards[2].id });
  await post(`/api/cultures/${ashfallCulture.id}/members`, { tier: 'organization', entityId: ashfall.id });
  say('2 cultures, 5 attachments');

  // -- buildings, and who holds them ----------------------------------------
  // Property is the Phase 2 engine, and it has the same failure mode
  // everything else here does: the Environment phase ages every standing
  // building on every tick, so with no properties that half of phase 1
  // runs over an empty array. One site still in planning is deliberate —
  // it is the only way the demo shows a lifecycle change happening
  // rather than a static row.
  const heads = [];
  for (const npc of npcs.slice(0, 3)) heads.push(npc);

  const buildings = [
    { type: 'residential', value: 92000, lifecycleStage: 'operation', condition: 88, floors: 2, units: 1 },
    { type: 'residential', value: 74000, lifecycleStage: 'maintenance', condition: 61, floors: 2, units: 1 },
    { type: 'commercial', value: 210000, lifecycleStage: 'operation', condition: 94, floors: 1 },
    { type: 'industrial', value: 480000, lifecycleStage: 'operation', condition: 47 },
    { type: 'historical_site', value: 150000, lifecycleStage: 'historical_legacy', condition: 72 },
    { type: 'residential', value: 130000 }, // planning — breaks ground on tick 1
  ];

  const properties = [];
  for (let i = 0; i < buildings.length; i += 1) {
    properties.push(await post('/api/properties', {
      cityId: city.id,
      communityId: wards[i % wards.length].id,
      ...buildings[i],
    }));
  }

  // Ownership is append-only history, not a column, so a property with
  // no record is genuinely unowned — the industrial block below is left
  // that way on purpose, so the difference is visible.
  const deeds = [
    { property: properties[0], owner: heads[0].id, ownerType: 'individual', method: 'purchased' },
    { property: properties[1], owner: heads[1].id, ownerType: 'individual', method: 'inherited' },
    { property: properties[2], owner: ashfall.id, ownerType: 'organization', method: 'purchased' },
    { property: properties[4], owner: kestrels.id, ownerType: 'organization', method: 'discovered' },
    { property: properties[5], owner: heads[2].id, ownerType: 'individual', method: 'built' },
  ];
  for (const deed of deeds) {
    await post(`/api/properties/${deed.property.id}/ownership`, {
      ownerEntityId: deed.owner, ownerType: deed.ownerType, method: deed.method,
    });
  }
  say(`${properties.length} properties, ${deeds.length} owned`);

  // -- something to do ------------------------------------------------------
  // artifacts.name is NOT NULL with no default, so an artifact needs a
  // real name -- found by the seed failing rather than by reading, which
  // is the argument for a seed script that talks to the live API.
  const relics = [
    { name: 'Waterworks ledger', origin: 'Ward 4', era: 'pre-collapse', rarity: 'uncommon' },
    { name: 'Sealed grain manifest', origin: 'Riverside Mill', era: 'pre-collapse', rarity: 'rare' },
  ];
  const artifacts = [];
  for (const relic of relics) artifacts.push(await post('/api/artifacts', relic));
  for (const artifact of artifacts) await post('/api/mission', { artifactId: artifact.id });
  say(`${artifacts.length} artifacts, ${artifacts.length} missions`);

  // -- the drought ----------------------------------------------------------
  process.stdout.write('\n');
  try {
    await post('/api/conditions', {
      type: 'drought',
      resourceType: 'water',
      supplyDelta: -8,
      demandDelta: +4,
      ticksRemaining: TICKS,
    });
    say(`drought declared on water for ${TICKS} ticks`);

    for (let i = 0; i < TICKS; i += 1) await post('/api/tick');
    say(`advanced ${TICKS} ticks`);

    const snap = await get('/api/economy/snapshot');
    const water = snap.resources.find((r) => r.resource_type === 'water');
    const ration = snap.marketListings.find((l) => l.product_name === 'water ration');
    const chair = snap.marketListings.find((l) => l.product_name === 'hand-carved chair');
    process.stdout.write('\n');
    say(`water scarcity  ${water ? water.scarcity : '?'}   (started at 50)`);
    say(`water ration    ${ration ? Number(ration.price).toFixed(2) : '?'}   (started at 10.00)`);
    say(`chair           ${chair ? Number(chair.price).toFixed(2) : '?'}   (started at 100.00, no raw input)`);

    const site = await get(`/api/properties/${properties[5].id}`);
    const worn = await get(`/api/properties/${properties[3].id}`);
    say(`the new site    ${site.lifecycle_stage}   (started in planning)`);
    say(`the mill        condition ${Number(worn.condition).toFixed(1)}, worth ${worn.currentValue}   (assessed at ${worn.value})`);

    // What the world's own flows say about it, unprompted.
    const { flows } = await get('/api/flows');
    const firing = flows.filter((f) => f.firing);
    process.stdout.write('\n');
    say(`${firing.length} of ${flows.length} flows firing:`);
    for (const flow of firing) say(`  ${flow.name}  (${flow.signal} = ${flow.value})`);
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      process.stdout.write('\n');
      say('The drought was refused, and that is correct.');
      say('Conditions and ticks change the world for everybody, so they need');
      say('an operator credential. The world above is seeded and worth opening.');
      say('');
      say('For a local demo, restart the server with:');
      say('  VACO_SERVICE_AUTH_MODE=off VACO_OPERATOR_MODE=off node server.js');
    } else {
      throw err;
    }
  }

  process.stdout.write(`\n${created} objects created. Open ${BASE}/\n\n`);
}

main().catch((err) => {
  process.stderr.write(`\nseed-world: ${err.message}\n\n`);
  process.exit(1);
});
