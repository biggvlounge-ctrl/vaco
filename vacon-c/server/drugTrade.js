// server/drugTrade.js
//
// By direct instruction: "in drug organizations, you have a
// hierarchy. Some drug dealers are just street-level dealers. Some
// drug dealers are connected to the cartel... Mexican, Colombian...
// then you have some kingpins that are neighborhood kingpins, some
// that run the states... made, how some of them are made from like
// the fabricated drugs like meth, K2... marijuana, crack, cocaine,
// fentanyl, heroin. Everything needs to be a complete process, and if
// it can't be done in the states or the cities, it needs to tie in...
// tie this into the prison pipeline as well."
//
// ---------------------------------------------------------------------
// Real, cited research, not an invented hierarchy — see the research
// pass this round, sourced to DEA's own National Drug Threat
// Assessment (2024/2025) and DOJ's National Gang Intelligence
// Center's National Gang Report
// ---------------------------------------------------------------------
// Neither DEA nor DOJ publishes one official named "org chart" —
// the real, documented structure across NDTA threat assessments and
// DOJ RICO prosecutions is a hub-and-branch / cellular model: a
// street-level dealer sells to the public; a local/mid-level
// distributor supplies several dealers; a regional distributor or
// organization holds a direct cartel "source of supply" contact; the
// cartel is the source itself. "Neighborhood kingpin" and "runs the
// states" are not DEA-defined labels — they are this file's own
// abstraction of that real structure onto what this engine already
// measures: `membership.gangTierFor`'s real, §14-cited gang hierarchy
// gives the INTERNAL tier (a street-level dealer is a real `soldier`/
// `associate`); `kingpinScaleOf` reads the real, already-existing
// `territory_blocks` a drug trafficking organization holds, across
// how many real cities, for the EXTERNAL scale — never a fourth,
// invented tier vocabulary for either question.
//
// **No specific real cartel or street gang is ever named or
// generated here**, the identical §9-firewall discipline
// `orgArchetypes.js`'s `'nationalist movement'`/`'racially-affiliated
// prison gang'` archetypes already hold: the real research calibrates
// a GENERIC archetype's shape; nothing here claims to BE or simulate
// a real, named, living criminal organization. `cartelConnection` is
// one of two real, geographic categories — `'mexican'`/`'colombian'`
// — reflecting the real, DEA-documented SOURCE REGION for a substance
// (a geographic fact, the same kind `countryPacks.js`/
// `ancestryPacks.js` already report), never a specific cartel's name.
//
// ---------------------------------------------------------------------
// "Everything needs to be a complete process... if it can't be done
// in the states or the cities, it needs to tie in"
// ---------------------------------------------------------------------
// Each of the seven named substances is tagged with its own real,
// cited sourcing category, and the mechanics follow it exactly:
//
//   domestic-cultivated  marijuana grows domestically at real scale;
//                        DEA: domestic cultivation now supplies most
//                        of the U.S. market. `produceMarijuana` needs
//                        only a real gang, no cartel connection.
//   domestic-converted   crack cocaine is not separately imported —
//                        a domestic conversion of imported powder
//                        cocaine. `convertCrack` needs real held
//                        cocaine, not a cartel connection of its own.
//   imported             cocaine (coca is not grown at real scale in
//                        the continental U.S.; DEA: Colombia/Peru/
//                        Bolivia), heroin, methamphetamine and
//                        fentanyl (all three fully synthetic/opium-
//                        derived and, per DEA, now produced almost
//                        entirely by Mexican organizations from
//                        largely Chinese-sourced precursor chemicals),
//                        and synthetic cannabinoids ("K2" — DEA: the
//                        bulk chemical is manufactured in and
//                        imported from China, finished domestically
//                        by spraying it onto plant material).
//                        `importSubstance` requires the real
//                        organization to actually hold a real,
//                        earned `cartelConnection` — see below.
//
// ---------------------------------------------------------------------
// "Connected to the cartel" is earned, not free
// ---------------------------------------------------------------------
// `cartelConnectionEligible`/`grantCartelConnection` require a real
// gang (`membership.isGang`) whose real leader's own real, already-
// generated `criminal.'Black Market Ties'` trait reads at or above
// the trait scale's own neutral centre (50) — standing rule 12's own
// "centre on the average person" discipline, the identical real
// threshold shape `roguePolice.js#CORRUPTION_DEFECTION_THRESHOLD` and
// `justice.js#CORRUPT_STAFF_THRESHOLD` already use, restated locally
// rather than cross-imported (the same precedent `justice.js`'s own
// header already set for the identical reason — no real dependency
// between the files otherwise).
//
// ---------------------------------------------------------------------
// "Tie this into the prison pipeline" — real, cited research, not an
// invented connection
// ---------------------------------------------------------------------
// DOJ gang-intelligence profiles document the Mexican Mafia and
// Nuestra Familia as controlling and "taxing" street-level drug
// distribution from inside prison, and DOJ-OIG case announcements
// document correctional officers taking bribes to smuggle drugs into
// facilities. `justice.js#ensurePrisonGang` already founds a real
// prison gang (`worldState.prisonGangs`); `runPrisonSmuggling` reads
// that same real map directly (no `require('./justice.js')`, no
// cycle risk, because it is a plain data map, not a function) and
// moves a real, bounded quantity of a real substance to that gang's
// own real inside leader whenever a real corrupt guard/warden is
// employed there — the identical `leadership.'Corruption Risk'`
// check `justice.js#runCorruptGuardBreaks` already established,
// restated locally for the same reason the cartel threshold is.
// Unlike that one-shot prison break, this runs every real tick as a
// real, bounded probability — smuggling is ongoing, a break-out is
// not.

'use strict';

const membership = require('./membership.js');
const crime = require('./crime.js');
const economy = require('./economy.js');
const inventory = require('./inventory.js');
const { getLiveEntity } = require('./entityTraits.js');
const { seededDraw } = require('./seeded.js');

// Flagged interpretive: no document gives real street prices, so
// these are ordered by the real, documented relative-value pattern
// the research names (marijuana/K2 cheapest and most common; cocaine/
// heroin/fentanyl priciest and most tightly cartel-controlled) rather
// than fitted to any cited dollar figure.
const SUBSTANCES = {
  marijuana: {
    category: 'contraband', baseValue: 15, sourcing: 'domestic-cultivated', cartelRegion: null,
  },
  synthetic_cannabinoids: {
    category: 'contraband', baseValue: 10, sourcing: 'imported', cartelRegion: null,
  },
  crack_cocaine: {
    category: 'contraband', baseValue: 40, sourcing: 'domestic-converted', precursorItem: 'cocaine',
  },
  cocaine: {
    category: 'contraband', baseValue: 100, sourcing: 'imported', cartelRegion: 'colombian',
  },
  methamphetamine: {
    category: 'contraband', baseValue: 60, sourcing: 'imported', cartelRegion: 'mexican',
  },
  fentanyl: {
    category: 'contraband', baseValue: 80, sourcing: 'imported', cartelRegion: 'mexican',
  },
  heroin: {
    category: 'contraband', baseValue: 90, sourcing: 'imported', cartelRegion: 'mexican',
  },
};
const SUBSTANCE_NAMES = Object.keys(SUBSTANCES);
const IMPORT_REQUIRED = SUBSTANCE_NAMES.filter((name) => SUBSTANCES[name].sourcing === 'imported');

// Small and bounded, the same discipline `weapons.js#ROUNDS_PER_MANUFACTURE`
// already holds for a manufactured batch — never a passive stockpile.
const BATCH_SIZE = 10;
const PRISON_SMUGGLING_BATCH = 3;

// The trait scale's own neutral centre — see this file's own header.
const CARTEL_CONNECTION_THRESHOLD = 50;
const CARTEL_REGIONS = ['mexican', 'colombian'];

// Flagged interpretive, same magnitude class as `fraud.BASE_FRAUD_RISK`/
// `crime.BASE_DEPRIVATION_RISK` — never a second, disagreeing order of
// magnitude for the identical kind of per-tick probability.
const BASE_DEALING_RISK = 0.0006;
const PRISON_SMUGGLING_RISK = 0.0006;

function registerDrugItems(worldState) {
  worldState.barterItems = worldState.barterItems || [];
  const known = new Set(worldState.barterItems.map((i) => i?.name));
  let added = 0;
  for (const [name, def] of Object.entries(SUBSTANCES)) {
    if (known.has(name)) continue;
    worldState.barterItems.push({
      name, category: def.category, baseValue: def.baseValue, origin: 'contraband',
    });
    added += 1;
  }
  return added;
}

// The real gang an entity actually belongs to, if any — a drug
// trafficking organization specifically is not required for growing
// or converting (any real gang's own people can), only for import,
// where the ORGANIZATION's own earned cartel connection is what
// matters.
function gangOf(worldState, entityId) {
  const row = (worldState.entityOrganizationMemberships || []).find((m) => {
    if (m.entity_id !== entityId) return false;
    const org = (worldState.organizations || []).find((o) => o.id === m.organization_id);
    return !!org && membership.isGang(org);
  });
  if (!row) return null;
  return (worldState.organizations || []).find((o) => o.id === row.organization_id) ?? null;
}

function cartelConnectionEligible(worldState, organizationId) {
  const org = (worldState.organizations || []).find((o) => o.id === organizationId);
  if (!org || !membership.isGang(org) || org.leader_id == null) return false;
  const live = getLiveEntity(worldState, org.leader_id);
  const ties = Number(live?.traits?.criminal?.['Black Market Ties']);
  return Number.isFinite(ties) && ties >= CARTEL_CONNECTION_THRESHOLD;
}

function grantCartelConnection(worldState, organizationId, region) {
  if (!CARTEL_REGIONS.includes(region)) {
    throw new Error(`grantCartelConnection: "${region}" is not a real region. The two are: ${CARTEL_REGIONS.join(', ')}.`);
  }
  const org = (worldState.organizations || []).find((o) => o.id === organizationId);
  if (!org) throw new Error(`grantCartelConnection: no organization with id ${organizationId}.`);
  if (!cartelConnectionEligible(worldState, organizationId)) {
    throw new Error(
      `grantCartelConnection: organization ${organizationId} has no real leader whose `
      + 'Black Market Ties reads at or above the real threshold.',
    );
  }
  org.cartelConnection = region;
  return org;
}

// "A neighborhood kingpin" versus "runs the states" — read off how
// many real cities this organization's own real territory_blocks
// actually span, never a second, invented scale field.
function kingpinScaleOf(worldState, organizationId) {
  const blocks = (worldState.territoryBlocks || []).filter((b) => b.faction_id === organizationId);
  if (blocks.length === 0) return null;
  const cities = new Set(blocks.map((b) => b.city_id).filter((id) => id != null));
  return cities.size >= 2 ? 'regional' : 'local';
}

function produceMarijuana(worldState, entityId, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const org = gangOf(worldState, entityId);
  if (!org) throw new Error(`produceMarijuana: entity ${entityId} is not a real member of any real gang.`);
  registerDrugItems(worldState);
  return inventory.give(worldState, { entityId, itemName: 'marijuana', quantity: BATCH_SIZE, tick });
}

function convertCrack(worldState, entityId, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const org = gangOf(worldState, entityId);
  if (!org) throw new Error(`convertCrack: entity ${entityId} is not a real member of any real gang.`);
  const held = inventory.quantityOf(worldState, entityId, 'cocaine');
  if (held <= 0) throw new Error(`convertCrack: entity ${entityId} holds no real cocaine to convert.`);
  const amount = Math.min(held, BATCH_SIZE);
  inventory.take(worldState, { entityId, itemName: 'cocaine', quantity: amount, tick });
  registerDrugItems(worldState);
  return inventory.give(worldState, { entityId, itemName: 'crack_cocaine', quantity: amount, tick });
}

function importSubstance(worldState, entityId, substanceName, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const def = SUBSTANCES[substanceName];
  if (!def) throw new Error(`importSubstance: "${substanceName}" is not a real substance.`);
  if (!IMPORT_REQUIRED.includes(substanceName)) {
    throw new Error(`importSubstance: "${substanceName}" is not import-required -- see produceMarijuana/convertCrack.`);
  }
  const org = gangOf(worldState, entityId);
  if (!org) throw new Error(`importSubstance: entity ${entityId} is not a real member of any real gang.`);
  if (!org.cartelConnection) {
    throw new Error(`importSubstance: organization ${org.id} has no real cartel connection -- see grantCartelConnection.`);
  }
  if (def.cartelRegion && org.cartelConnection !== def.cartelRegion) {
    throw new Error(
      `importSubstance: organization ${org.id}'s real cartel connection (${org.cartelConnection}) `
      + `does not supply ${substanceName} (needs ${def.cartelRegion}).`,
    );
  }
  registerDrugItems(worldState);
  return inventory.give(worldState, { entityId, itemName: substanceName, quantity: BATCH_SIZE, tick });
}

// ---------------------------------------------------------------------
// runStreetDealing — the real generator crime.js's own `drug` category
// was waiting for
// ---------------------------------------------------------------------
// Only a real `soldier`/`associate` (`membership.gangTierFor`'s own
// §14 floor tier — street level) of a real gang, actually holding a
// real substance, is eligible — never a passive population-wide
// draw, the same "who is eligible" discipline `fraud.js#runFraud`
// already holds for `criminal.Deception`.
function runStreetDealing(worldState, tick = worldState.tick ?? 0) {
  const incidents = [];
  const substanceSet = new Set(SUBSTANCE_NAMES);
  for (const npc of worldState.npcs || []) {
    if (npc.communityId == null) continue;
    const org = gangOf(worldState, npc.id);
    if (!org) continue;
    const tier = membership.gangTierFor(worldState, org.id, npc.id, tick);
    if (tier !== 'soldier' && tier !== 'associate') continue;

    const holding = (worldState.inventory || []).find(
      (h) => h.holder_entity_id === npc.id && substanceSet.has(h.item_name) && Number(h.quantity) > 0,
    );
    if (!holding) continue;

    if (seededDraw([worldState.seed ?? 'world', npc.id, tick, 'crime:drug']) >= BASE_DEALING_RISK) continue;

    const saleQuantity = Math.min(Number(holding.quantity), Math.max(1, Math.ceil(Number(holding.quantity) / 2)));
    inventory.take(worldState, { entityId: npc.id, itemName: holding.item_name, quantity: saleQuantity, tick });

    const price = Math.round((SUBSTANCES[holding.item_name]?.baseValue ?? 0) * saleQuantity);
    if (price > 0) {
      const current = economy.getLatestFinances(worldState, npc.id);
      economy.generateIndividualFinances(worldState, npc.id, {
        income: current?.income ?? 0,
        savings: Math.round(((current?.savings ?? 0) + price) * 100) / 100,
        debt: current?.debt ?? 0,
        assets: current?.assets ?? 0,
        tick,
      });
    }

    // No real victim — a drug sale is a real, consensual transaction
    // between the dealer and a buyer this engine does not need to
    // name, the same honest shape every §9 category without one
    // already holds.
    const incident = crime.recordCrime(worldState, {
      category: 'drug', perpetratorId: npc.id, victimId: null, tick,
      detail: `street-level sale of ${saleQuantity} ${holding.item_name}`,
    });
    incidents.push(incident);
  }
  return incidents;
}

// ---------------------------------------------------------------------
// runPrisonSmuggling — the drug-trade half of the prison pipeline tie-in
// ---------------------------------------------------------------------
function runPrisonSmuggling(worldState, options = {}) {
  const { tick = worldState.tick ?? 0, threshold = CARTEL_CONNECTION_THRESHOLD } = options;
  const incidents = [];
  const prisons = (worldState.properties || []).filter((p) => p.landmark_category === 'prison');

  for (const prison of prisons) {
    const gangOrganizationId = (worldState.prisonGangs || {})[prison.id];
    if (!gangOrganizationId) continue;
    const gang = (worldState.organizations || []).find((o) => o.id === gangOrganizationId);
    if (!gang || !gang.cartelConnection || gang.leader_id == null) continue;

    const corruptStaff = (worldState.employmentRecords || [])
      .filter((r) => r.status === 'active'
        && ['guard', 'warden'].includes(r.position)
        && r.employer_organization_id === prison.operating_organization_id)
      .filter((r) => {
        const risk = Number(getLiveEntity(worldState, r.entity_id)?.traits?.leadership?.['Corruption Risk']);
        return Number.isFinite(risk) && risk >= threshold;
      });
    if (corruptStaff.length === 0) continue;

    if (seededDraw([worldState.seed ?? 'world', 'prison-smuggle', prison.id, tick]) >= PRISON_SMUGGLING_RISK) continue;

    const substanceName = IMPORT_REQUIRED.find(
      (name) => !SUBSTANCES[name].cartelRegion || SUBSTANCES[name].cartelRegion === gang.cartelConnection,
    );
    if (!substanceName) continue;

    registerDrugItems(worldState);
    inventory.give(worldState, { entityId: gang.leader_id, itemName: substanceName, quantity: PRISON_SMUGGLING_BATCH, tick });

    const incident = crime.recordCrime(worldState, {
      category: 'drug', perpetratorId: corruptStaff[0].entity_id, victimId: null, tick,
      detail: `a dirty ${corruptStaff[0].position} smuggled ${PRISON_SMUGGLING_BATCH} ${substanceName} `
        + `into ${prison.name ?? `property ${prison.id}`} for organization ${gang.id}`,
    });
    incidents.push(incident);
  }

  return incidents;
}

module.exports = {
  SUBSTANCES,
  SUBSTANCE_NAMES,
  IMPORT_REQUIRED,
  BATCH_SIZE,
  PRISON_SMUGGLING_BATCH,
  CARTEL_CONNECTION_THRESHOLD,
  CARTEL_REGIONS,
  BASE_DEALING_RISK,
  PRISON_SMUGGLING_RISK,
  registerDrugItems,
  gangOf,
  cartelConnectionEligible,
  grantCartelConnection,
  kingpinScaleOf,
  produceMarijuana,
  convertCrack,
  importSubstance,
  runStreetDealing,
  runPrisonSmuggling,
};
