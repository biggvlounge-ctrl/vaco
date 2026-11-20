// server/heistTools.js
//
// Real tools for defeating a real physical barrier — closing the
// remaining half of task #40 ("safe-cracking... variance" was never
// built; only the stakeout half was) and the follow-up request: "when
// they're stealing cars, all the aspects of things you need to steal
// cars with... they'll have to open up containers. They'll need
// certain type of electric tools and tools to open up certain
// containers, trailers, vaults, safes."
//
// ---------------------------------------------------------------------
// Real, named tools, not an invented "lockpick" item
// ---------------------------------------------------------------------
// `bolt_cutters` — ISO 17712 (freight container/cargo seals) defines
// three real seal classes (Indicative/Security/High-security); a
// high-security seal is specifically rated to resist bolt and cable
// cutters, which is the real tool named against exactly the
// trailer/container seals and padlocks the request asks about.
//
// `angle_grinder` / `cutting_torch` — UL 687, the safe-industry
// burglary-resistance standard, rates a safe TL (tool-resistant), TR
// (torch-resistant) or TRTL (both) by how long it survives a named
// attack method; grinding and torch-cutting are the two real attack
// methods that standard is written against. Two separate real items
// rather than one, because a torch (UL's "TR" rating) and a grinder
// are different real tools named by the same standard, not
// interchangeable flavour text for one mechanic.
//
// `key_programmer` / `relay_attack_device` — real, current vehicle-
// theft methods, not the two this engine already had flavour text
// for. NICB's own 2014 analysis states hot-wiring is obsolete against
// any vehicle built after transponder immobilisers became standard
// (1997) — `vehicles.js`'s `VEHICLE_THEFT_TECHNIQUES` named it anyway,
// alongside slim-jim lock manipulation, which the same shift to
// electronic locks makes equally obsolete. What NICB and current
// reporting (CBS News; Autoblog, 2023) document as the real, current
// methods are OBD-II port reprogramming (a `key_programmer`, writing a
// new working key via the diagnostic port) and a keyless-fob relay
// attack (a `relay_attack_device`, amplifying a nearby fob's own
// signal — NICB's 2016 test of a purchased unit opened 54% of tested
// vehicles). Neither technique is removed from `vehicles.js` — an
// older or neglected vehicle can still fall to them — but neither is
// free of a real cited cost any more either; see that file's own
// comment on `LEGACY_TECHNIQUE_PENALTY`.
//
// ---------------------------------------------------------------------
// What decides which tool a target needs — a real property field, not
// an invented "vault" landmark
// ---------------------------------------------------------------------
// `heists.js`'s own header already declined to invent a `bank`
// landmark category and robs a real business organization's `assets`
// column directly instead. The same restraint applies here: rather
// than inventing a vault/safe landmark, `containerRequirementFor`
// reads the real `properties.operating_organization_id` /
// `properties.landmark_category` link `property.js` already
// maintains. A target that operates a real `distribution-center`,
// `port-terminal` or `industrial-plant` (the real cargo-handling
// landmark categories `landmarks.js` already has) needs `bolt_cutters`
// for its trailers/containers; any other business is read as holding
// its valuables in a safe or vault and needs `angle_grinder` or
// `cutting_torch`.

'use strict';

const CARGO_LANDMARK_CATEGORIES = ['distribution-center', 'port-terminal', 'industrial-plant'];
const CARGO_TOOL = 'bolt_cutters';
const VAULT_TOOLS = ['angle_grinder', 'cutting_torch'];
const VEHICLE_BYPASS_TOOLS = ['key_programmer', 'relay_attack_device'];

//: All five, remnant-only — the same reasoning `weapons.js` gives a
//: precision auto sear: nobody alive in this setting machines a
//: cutting torch or an OBD key programmer out of Tier 1-2 scrap.
const TOOL_ITEMS = {
  bolt_cutters: { category: 'tools', origin: 'remnant' },
  angle_grinder: { category: 'tools', origin: 'remnant' },
  cutting_torch: { category: 'tools', origin: 'remnant' },
  key_programmer: { category: 'tools', origin: 'remnant' },
  relay_attack_device: { category: 'tools', origin: 'remnant' },
};

// Through `worldState.barterItems`, the same extension point
// `weapons.js#registerItems` already uses. Idempotent by name.
function itemDefinitions() {
  return Object.entries(TOOL_ITEMS).map(([name, definition]) => ({ name, ...definition }));
}

function registerItems(worldState) {
  if (!Array.isArray(worldState.barterItems)) worldState.barterItems = [];
  const known = new Set(worldState.barterItems.map((i) => i?.name));
  let added = 0;
  for (const definition of itemDefinitions()) {
    if (known.has(definition.name)) continue;
    worldState.barterItems.push(definition);
    added += 1;
  }
  return added;
}

// Does any of these entities really hold any of these real tools?
function holdsAny(worldState, entityIds, toolNames) {
  // eslint-disable-next-line global-require
  const inventory = require('./inventory.js');
  return entityIds.some((id) => toolNames.some(
    (name) => inventory.findHolding(worldState, Number(id), name),
  ));
}

function containerRequirementFor(worldState, organizationId) {
  const property = (worldState.properties || []).find(
    (p) => p.operating_organization_id === Number(organizationId)
      && CARGO_LANDMARK_CATEGORIES.includes(p.landmark_category),
  );
  return property
    ? { kind: 'cargo', tools: [CARGO_TOOL] }
    : { kind: 'vault', tools: VAULT_TOOLS };
}

module.exports = {
  CARGO_LANDMARK_CATEGORIES,
  CARGO_TOOL,
  VAULT_TOOLS,
  VEHICLE_BYPASS_TOOLS,
  TOOL_ITEMS,
  itemDefinitions,
  registerItems,
  holdsAny,
  containerRequirementFor,
};
