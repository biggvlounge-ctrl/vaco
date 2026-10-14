// VDP — World Atlas: the first real instances inside the master lore
// handoff's own "rules, not atlas" foundation (`civilizations.js`).
//
// Per direct instruction (14 Oct 2026): asked to continue structuring
// "all the hidden civilizations... as many as you can." This module
// is that real, named content -- built strictly from the two master
// lore documents' own specifics, flagged interpretive wherever a
// document gives a range rather than an exact number, and deliberately
// NOT covering everything those documents describe. See the bottom of
// this file for exactly what is left out and why.
//
// **What is seeded here, and why this subset first:**
//   - The four mainland countries (§5) -- named, specialized,
//     distinct, with the most concrete detail of anything in either
//     document.
//   - One hidden civilization per mainland country (§11, §13-20) --
//     same reason: real population ranges, a real required
//     specialty list, real rules about what they trade and why.
//   - The four central casino islands (§8) -- each one individually
//     described in the source document, nothing generic about them.
//   - The four pirate islands (the addendum's own §9-30) -- same,
//     each with its own named specialty and real rivalry rules.
//
// **Deliberately NOT seeded here** -- the ten generic primary island
// countries and their own smaller hidden civilizations (§7, §12, and
// the addendum's §4). The source documents give this quartet of
// groups (mainland countries, mainland hidden civs, casino islands,
// pirate islands) real, individual, distinguishing detail; the ten
// islands get a population range and "not identical" and nothing
// else per-island. Seeding ten real named islands today would mean
// inventing nine-tenths of what distinguishes them, which is exactly
// what this project refuses to do. They stay real and unbuilt until
// there is real detail to build them from, the same "recorded, not
// invented" treatment this document gives every other open lore
// question.
//
// **All names below are real, flagged placeholders** -- "permanent
// names can be established later" is the master document's own
// words (§6, on the 40 starter cities; applied here the same way).
// The four mainland countries, the four mainland hidden civilizations,
// the four casino islands, and the four pirate islands are all now
// named (see below) -- a real, flagged proposal, not the source
// documents' own words.
//
// **"Meridian" retired (14 Oct 2026), per direct instruction**:
// "instead of the meridian, it will be the four countries that are
// ran by the Vaco system... the four starter lands that are ran by
// the families that came over and built what's going on." There is
// no separate hidden settlement a tech team secretly found -- the
// four mainland countries below ARE the starter lands, administered
// by the Vaco system through the founding families who crossed over
// (the master document's own §48: 20 founding families x 4 mainland
// countries = 80). `town.js`'s own settlement (`TOWN_NAME`,
// "Founders' Capital") is this file's `MAINLAND_COUNTRIES[0]`
// (Ironreach) own starter capital, not a separate place.

import {
  CIVILIZATION_KINDS, createCivilization, setStatistic, registerGateway,
  createRedZone, createTradeRoute, claimTerritory,
} from './civilizations.js';

// §5, verbatim specialization lists. Names are a real, flagged
// proposal (14 Oct 2026) made when "Country One".."Country Four" were
// retired as functional labels -- each chosen to fit its own real
// specialty below, not asserted as the source documents' own words.
// `Ironreach` (Country One) is `town.js`'s own already-built
// settlement's (`TOWN_NAME`, "Founders' Capital") starter country.
export const MAINLAND_COUNTRIES = [
  {
    name: 'Ironreach', gateKey: 'serpent', gateTier: 'heavy-equipment',
    majorIndustries: ['robotics', 'construction robots', 'heavy machinery', 'mining', 'excavation', 'industrial automation', 'fabrication', 'infrastructure', 'maintenance', 'heavy transportation'],
    economy: 'robotics and heavy industry', transportationCulture: 'heavy rail and robotic freight', robotUsage: 'pervasive, industrial-grade',
  },
  {
    name: 'Luminae', gateKey: 'leviathan', gateTier: 'commercial-cargo',
    majorIndustries: ['computing', 'sensors', 'communications', 'navigation', 'electronics', 'AI-support hardware', 'control systems', 'advanced digital infrastructure'],
    economy: 'electronics and advanced systems', transportationCulture: 'autonomous high-capacity speed buses', robotUsage: 'advanced, research-grade',
  },
  {
    name: 'Aegira', gateKey: 'sentinel', gateTier: 'strategic-military',
    majorIndustries: ['weapons', 'defense systems', 'security vehicles', 'protective infrastructure', 'tactical logistics', 'military manufacturing', 'security technology'],
    economy: 'defense and security', transportationCulture: 'armored convoy and tactical logistics', robotUsage: 'security and enforcement-grade',
    securityPhilosophy: 'heavy, centralized, government-controlled',
  },
  {
    name: 'Verdane', gateKey: 'tiger', gateTier: 'container',
    majorIndustries: ['farms', 'greenhouses', 'hydroponics', 'fishing', 'food processing', 'agricultural robotics', 'storage', 'food distribution'],
    economy: 'food and agriculture', transportationCulture: 'rail freight and refrigerated cargo', robotUsage: 'agricultural automation',
  },
];

// §3's own four named gateway regions, verbatim: "Serpent's Gate,
// Leviathan's Gate, Sentinel's Gate, Tiger's Gate." Paired one-to-one
// with the four mainland countries above -- a real, structural
// choice (Sentinel for the defense country, named for exactly what
// it does), not asserted by either source document, which names the
// four gates but does not assign them.
export const ICE_WALL_GATES = {
  serpent: "Serpent's Gate", leviathan: "Leviathan's Gate", sentinel: "Sentinel's Gate", tiger: "Tiger's Gate",
};

// §11/§13-17 -- one hidden civilization per mainland country,
// deliberately NOT mirroring its host's own specialty (the master
// document's own "no civilization should possess everything," §13).
// Three of these are the document's own REQUIRED specialties
// ("at least one hidden civilization develops a strong gambling
// culture," §15; "at least one... enormous nightlife and club
// culture," §16; "at least one... medicinal, herbal, pharmaceutical,
// fungal, psychoactive," §17/§18); the fourth, paired with the
// robotics/heavy-industry country, is the real container/shipping
// role §19-20 gives mainland hidden civilizations generally ("the
// strongest access to large gateway shipments"). Names are the same
// real, flagged proposal (14 Oct 2026) the mainland countries, casino
// islands, and pirate islands already got -- fit to each one's own
// specialty, not the source documents' own words.
export const MAINLAND_HIDDEN_CIVILIZATIONS = [
  {
    name: 'Rustholt', hostIndex: 0, population: 28000,
    specialty: 'containers and old-world vehicle trade',
    majorIndustries: ['containers', 'old vehicles', 'manufacturing'],
    redZoneActivities: ['smuggling'],
    gateTier: 'container', gateLegalStatus: 'secret',
  },
  {
    name: 'Wagerden', hostIndex: 1, population: 35000,
    specialty: 'gambling',
    majorIndustries: ['gambling', 'private gaming houses', 'bookmaking'],
    redZoneActivities: ['gambling'],
    gateTier: 'vehicle', gateLegalStatus: 'restricted',
  },
  {
    name: 'Nocturne Hollow', hostIndex: 2, population: 22000,
    specialty: 'clubs and nightlife',
    majorIndustries: ['clubs', 'music', 'entertainment', 'night markets'],
    redZoneActivities: ['nightlife', 'clubs'],
    gateTier: 'pedestrian-light-goods', gateLegalStatus: 'secret',
  },
  {
    name: 'Thornveil', hostIndex: 3, population: 31000,
    specialty: 'medicine, herbs, and pharmaceuticals',
    majorIndustries: ['traditional medicine', 'pharmaceutical industry', 'herbal remedies'],
    redZoneActivities: ['black-market-medicine'],
    gateTier: 'vehicle', gateLegalStatus: 'restricted',
  },
];

// §8, each one individually described -- not interchangeable. Names
// are a real, flagged proposal (14 Oct 2026, per direct instruction:
// "go ahead and name the islands as well"), each fit to its own
// already-given theme below, the same discipline the four mainland
// countries' own naming already used -- not the source document's
// own words, which leave this open the same way it leaves the 40
// starter cities' names open.
export const CASINO_ISLANDS = [
  {
    name: 'Tidecrown Island', theme: 'water',
    majorIndustries: ['floating casinos', 'casino ships', 'luxury resorts', 'water sports'],
    transportationCulture: 'speedboats, ferries, autonomous water taxis',
    redZoneActivities: ['gambling', 'nightlife'],
  },
  {
    name: 'Cragmoor Island', theme: 'mountain',
    majorIndustries: ['mountain and cave casinos', 'hot springs', 'adventure tourism'],
    transportationCulture: 'mountain rail and off-road vehicles',
    redZoneActivities: ['gambling', 'racing'],
  },
  {
    name: 'Duskvault Island', theme: 'underground',
    majorIndustries: ['underground casino district', 'hotels', 'shopping', 'arenas'],
    transportationCulture: 'underground transit terminals',
    redZoneActivities: ['gambling', 'underground-entertainment'],
  },
  {
    name: 'Spireline Island', theme: 'vertical-cliff',
    majorIndustries: ['cliffside casinos', 'casino towers', 'terraced markets'],
    transportationCulture: 'vertical trams and bridges',
    redZoneActivities: ['gambling', 'nightlife'],
  },
];

// The addendum's own §9-30, each one individually described, in
// explicit rivalry with the other three rather than one organization.
// Names are the same real, flagged proposal as the casino islands'
// own above -- fit to each island's already-given theme.
export const PIRATE_ISLANDS = [
  {
    name: 'Blackcrate Island', theme: 'container-piracy', population: 6000,
    majorIndustries: ['cargo interception', 'container theft', 'warehousing', 'black-market logistics'],
    government: 'rival pirate organizations; no single authority',
    redZoneActivities: ['smuggling', 'counterfeit-goods', 'illegal-markets'],
  },
  {
    name: 'Neonreef Island', theme: 'gambling-nightlife', population: 7500,
    majorIndustries: ['unrestricted gambling', 'casinos', 'clubs', 'entertainment'],
    government: 'rival pirate organizations; no single authority',
    redZoneActivities: ['gambling', 'nightlife', 'clubs', 'underground-entertainment'],
  },
  {
    name: 'Hazeport Island', theme: 'drug-exotic-goods', population: 5200,
    majorIndustries: ['black-market pharmaceuticals', 'exotic substances', 'distribution networks'],
    government: 'rival pirate organizations; no single authority',
    redZoneActivities: ['drugs', 'black-market-medicine', 'illegal-markets'],
  },
  {
    name: 'Stormfleet Island', theme: 'fleet-maritime', population: 4800,
    majorIndustries: ['pirate fleet', 'shipbuilding', 'ship repair', 'fishing', 'cargo interception'],
    government: 'rival pirate organizations; no single authority',
    redZoneActivities: ['smuggling', 'weapons'],
  },
];

function requireCountOnce(store, kind, expected) {
  return store.civilizations.filter((c) => c.kind === kind).length >= expected;
}

// Real idempotency -- the same "checked, not assumed" guard every
// other one-time seed in this app already uses (`npcs.js`'s own
// `seedGovernmentLiaisons`). Checked by real kind-counts rather than
// a separate flag, so a store that already has these four groups
// (by any path) is never doubled.
export function isWorldAtlasSeeded(store) {
  return requireCountOnce(store, 'mainland-country', MAINLAND_COUNTRIES.length)
    && requireCountOnce(store, 'hidden-civilization', MAINLAND_HIDDEN_CIVILIZATIONS.length)
    && requireCountOnce(store, 'casino-island', CASINO_ISLANDS.length)
    && requireCountOnce(store, 'pirate-island', PIRATE_ISLANDS.length);
}

export function seedWorldAtlas(store, { now = Date.now() } = {}) {
  if (isWorldAtlasSeeded(store)) return { seeded: false };

  const countries = MAINLAND_COUNTRIES.map((def) => {
    const civ = createCivilization(store, {
      name: def.name, kind: 'mainland-country', majorIndustries: def.majorIndustries,
      economy: def.economy, transportationCulture: def.transportationCulture, robotUsage: def.robotUsage,
      securityPhilosophy: def.securityPhilosophy || null,
      technologyEras: ['advanced autonomous systems', 'repaired legacy machinery'],
      now,
    });
    registerGateway(store, {
      name: ICE_WALL_GATES[def.gateKey], tier: def.gateTier, civilizationId: civ.id,
      legalStatus: 'government-controlled', now,
    });
    return civ;
  });

  const hiddenCivilizations = MAINLAND_HIDDEN_CIVILIZATIONS.map((def) => {
    const host = countries[def.hostIndex];
    const civ = createCivilization(store, {
      name: def.name, kind: 'hidden-civilization', majorIndustries: def.majorIndustries,
      economy: def.specialty,
      oldWorldRelationship: 'secretly existed and moved between Old World and New World routes for approximately fifty years',
      technologyEras: ['mixed old-world vehicles', 'repurposed containers', 'locally repaired technology'],
      now,
    });
    setStatistic(civ, 'population', def.population);
    registerGateway(store, {
      name: `${def.name}'s own gateway`, tier: def.gateTier, civilizationId: civ.id,
      legalStatus: def.gateLegalStatus, now,
    });
    createRedZone(store, { locationLabel: `${def.name}'s own district`, civilizationId: civ.id, activities: def.redZoneActivities, now });
    claimTerritory(store, { name: `${def.name}'s own territory`, civilizationId: civ.id, controlStatus: 'independent', now });
    createTradeRoute(store, {
      name: `${def.name} ↔ ${host.name} route`, createdBy: def.name,
      cargo: def.majorIndustries.slice(0, 2), status: 'secret', now,
    });
    return civ;
  });

  const casinoIslands = CASINO_ISLANDS.map((def) => {
    const civ = createCivilization(store, {
      name: def.name, kind: 'casino-island', majorIndustries: def.majorIndustries,
      transportationCulture: def.transportationCulture,
      // No `registerGateway` call for any casino island -- the
      // source document is explicit (§8): "They are NOT directly
      // accessible through the Ice Wall... must be reached through
      // established maritime and transportation networks." A real
      // absence, not an oversight.
      oldWorldRelationship: 'reached only by maritime and transportation networks, never the Ice Wall',
      now,
    });
    createRedZone(store, { locationLabel: `${def.name}'s own district`, civilizationId: civ.id, activities: def.redZoneActivities, now });
    createTradeRoute(store, {
      name: `${def.name} maritime route`, createdBy: def.name, cargo: ['tourism', 'luxury goods'], status: 'legal', now,
    });
    return civ;
  });

  const pirateIslands = PIRATE_ISLANDS.map((def) => {
    const civ = createCivilization(store, {
      name: def.name, kind: 'pirate-island', majorIndustries: def.majorIndustries,
      government: def.government, now,
    });
    setStatistic(civ, 'population', def.population);
    createRedZone(store, { locationLabel: `${def.name}'s own district`, civilizationId: civ.id, activities: def.redZoneActivities, now });
    claimTerritory(store, { name: `${def.name}'s own waters`, civilizationId: civ.id, controlStatus: 'independent', now });
    return civ;
  });

  // "Some hidden civilizations may secretly trade with pirate
  // islands" -- the one real, named cross-link the source document
  // asks for by name, between the container-trade hidden civilization
  // and the container-piracy pirate island.
  createTradeRoute(store, {
    name: `${hiddenCivilizations[0].name} ↔ ${pirateIslands[0].name} route`,
    createdBy: hiddenCivilizations[0].name, cargo: ['containers', 'stolen merchandise'], status: 'secret', now,
  });

  return { seeded: true, countries, hiddenCivilizations, casinoIslands, pirateIslands };
}
