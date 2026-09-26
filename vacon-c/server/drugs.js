// server/drugs.js
//
// **Production, use, and dependency — added 26 Sep 2026 at the owner's
// direct request.** Not from either of this project's source
// documents; new design, the same standing as `park`/`junkyard` in
// `landmarks.js` and `Manipulation` in `traits.js`.
//
// ---------------------------------------------------------------------
// What this closes
// ---------------------------------------------------------------------
// `server/crime.js` has always carried a `drug` category, declared
// ungenerated in its own words: "no substance, contraband or illicit
// trade exists... a drug offence has no object." That is the same shape
// `gun` was in until `inventory.js` gave an offence something to be
// armed WITH — this file is the object `drug` was waiting for, and
// `crime.js`'s own `runDrugCrime` (added alongside this file) is where
// the offence gets recorded.
//
// `criminal.Black Market Ties` has existed on every NPC since the
// criminal trait family was written and had no reader anywhere in
// `server/` — the twelfth standing rule's shape, a whole trait sitting
// on the sheet, generated, stored, read by nothing. Production below is
// its first one.
//
// `psychological.Substance Dependency` is new (`traits.js`), and this
// file is its only writer and its only reader of consequence: use grows
// it, and its absence when dependency is high is what `behavior.js`'s
// stress system already knows how to do something with, once it is told
// to.
//
// ---------------------------------------------------------------------
// No new trade category, on purpose
// ---------------------------------------------------------------------
// `items.js`'s own header is explicit: `TRADE_CATEGORIES` is "§26,
// verbatim and in its order," and a world that wants more supplies it
// through `worldState.barterItems` — items, not categories. So this
// reuses `medicine` rather than inventing a twenty-first §26 category:
// a diverted, abused substance in a setting where real medicine is
// already scarce is exactly what that category is for, and it is the
// same move `merchandise.js` made adding `clean water` under the
// existing `water` category rather than a new one.
//
// ---------------------------------------------------------------------
// Not distributed at generation, same as salvage and merchandise
// ---------------------------------------------------------------------
// Registering the item makes the name mean something from tick zero —
// `inventory.give` refuses an item `items.findItem` does not know — but
// nobody starts holding any. It arrives through `runProduction`, same
// as scrap arrives through salvage: earned by the world running, not
// seeded into it.

'use strict';

const items = require('./items.js');
const inventory = require('./inventory.js');
const { getLiveEntity, applyKeyModifier } = require('./entityTraits.js');
const { seededDraw } = require('./seeded.js');

//: The one item. A world that wants more supplies them through
//: `worldState.barterItems`, the same as any other item — this file
//: does not become the only place a narcotic can be named.
const NARCOTICS_ITEM = 'street narcotics';
//: Reuses an existing §26 category — see header.
const NARCOTICS_CATEGORY = 'medicine';

function itemDefinitions() {
  return [{ name: NARCOTICS_ITEM, category: NARCOTICS_CATEGORY, contraband: true }];
}

// Idempotent by name (standing rule 15), the same contract
// `merchandise.registerItems`/`salvage.registerItems` keep.
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

// ---------------------------------------------------------------------
// Production — Black Market Ties' first reader
// ---------------------------------------------------------------------
//: Below this, `criminal['Black Market Ties']` is exactly what it was
//: before this file existed: a number on the sheet nothing reads. Above
//: it, the chance of dealing scales from 0 at the floor to
//: `PRODUCTION_CHANCE_AT_MAX_TIES` at 100 — an ordinary person with no
//: black-market connections never produces anything, which is the same
//: "does not recalibrate the world" discipline the twelfth standing
//: rule states for a modifier centred anywhere but the average person.
const PRODUCTION_TIES_FLOOR = 60;
const PRODUCTION_CHANCE_AT_MAX_TIES = 0.05;
const PRODUCTION_QUANTITY = 1;

function tiesOf(worldState, entityId) {
  const live = getLiveEntity(worldState, entityId);
  const value = Number(live?.traits?.criminal?.['Black Market Ties']);
  return Number.isFinite(value) ? value : 0;
}

function producesThisTick(worldState, entityId, tick) {
  const ties = tiesOf(worldState, entityId);
  if (ties < PRODUCTION_TIES_FLOOR) return false;
  const chance = ((ties - PRODUCTION_TIES_FLOOR) / (100 - PRODUCTION_TIES_FLOOR))
    * PRODUCTION_CHANCE_AT_MAX_TIES;
  return seededDraw([worldState.seed ?? 'world', 'drugs:produce', entityId, tick]) < chance;
}

// One tick's worth of dealing. Not a phase of its own — called from the
// same cross-cutting slot `behavior.runBehavior`/`motivation.runMotivation`
// already share, because the pipeline is locked at eleven.
function runProduction(worldState, tick) {
  let produced = 0;
  for (const npc of worldState.npcs || []) {
    if (npc.status !== 'active') continue;
    if (!producesThisTick(worldState, npc.id, tick)) continue;
    inventory.give(worldState, {
      entityId: npc.id, itemName: NARCOTICS_ITEM, quantity: PRODUCTION_QUANTITY, tick,
    });
    produced += 1;
  }
  return produced;
}

// ---------------------------------------------------------------------
// Use and dependency
// ---------------------------------------------------------------------
//: Somebody holding narcotics uses some of what they hold, more often
//: the more impulsive/compulsive they are — reusing
//: `psychological.Impulsivity`/`Compulsiveness` rather than inventing a
//: third trait for "how likely to use what is on hand", which already
//: exist and already mean this.
const USE_CHANCE_FLOOR = 0.02;
const USE_CHANCE_AT_MAX_PROPENSITY = 0.6;
//: How much one use raises Substance Dependency, on the trait's own
//: 0-100 scale. `applyKeyModifier` is the exported, tested way to move
//: a trait's live value with clamping and a recorded tick — used here
//: for a habit's effect rather than a Key resolver's, which is a reuse
//: of its mechanics, not a claim that using drugs is a Key.
const DEPENDENCY_PER_USE = 3;
//: Above this, no longer having any on hand is withdrawal, not
//: abstinence. `behavior.js`'s own `STRESS_BY_EVENT` table is where the
//: consequence lives — this file only decides whether the event fires.
const WITHDRAWAL_DEPENDENCY_FLOOR = 55;

function propensityOf(worldState, entityId) {
  const live = getLiveEntity(worldState, entityId);
  const impulsivity = Number(live?.traits?.psychological?.Impulsivity ?? 50);
  const compulsiveness = Number(live?.traits?.psychological?.Compulsiveness ?? 50);
  return (impulsivity + compulsiveness) / 2;
}

function dependencyOf(worldState, entityId) {
  const live = getLiveEntity(worldState, entityId);
  const value = Number(live?.traits?.psychological?.['Substance Dependency']);
  return Number.isFinite(value) ? value : 0;
}

// One tick's worth of use and withdrawal for the living population.
// Returns the events withdrawal produces — `runDrugs`'s caller pushes
// them onto the same `candidateEvents` list every other phase does, and
// `behavior.applyEventStress` (already wired into every tick) does the
// rest without this file needing to know how stress works.
function runUseAndWithdrawal(worldState, tick) {
  const events = [];
  for (const npc of worldState.npcs || []) {
    if (npc.status !== 'active') continue;
    const held = inventory.quantityOf(worldState, npc.id, NARCOTICS_ITEM);

    if (held > 0) {
      const propensity = propensityOf(worldState, npc.id);
      const chance = USE_CHANCE_FLOOR
        + (propensity / 100) * (USE_CHANCE_AT_MAX_PROPENSITY - USE_CHANCE_FLOOR);
      if (seededDraw([worldState.seed ?? 'world', 'drugs:use', npc.id, tick]) < chance) {
        inventory.take(worldState, { entityId: npc.id, itemName: NARCOTICS_ITEM, quantity: 1 });
        applyKeyModifier(worldState, npc.id, 'psychological', 'Substance Dependency', DEPENDENCY_PER_USE, tick);
      }
      continue;
    }

    // Nothing on hand. Only a consequence for somebody already
    // dependent — an ordinary person with none is just a person with
    // none, not in withdrawal.
    if (dependencyOf(worldState, npc.id) >= WITHDRAWAL_DEPENDENCY_FLOOR) {
      events.push({
        type: 'withdrawal',
        severity: 'medium',
        note: `entity ${npc.id} has nothing on hand and is dependent`,
        tick,
        affected_entity_ids: [npc.id],
        global_effects: {},
      });
    }
  }
  return events;
}

// One call, one tick's worth of everything this file does. Production
// then use-and-withdrawal, in that order, so somebody who deals and
// uses can do both in the same tick — the same "produced, then spent"
// order `economy.js` already keeps for wages.
//
// **Registers its own item every call, unlike `merchandise.js`/
// `salvage.js`.** Those two only hand out an item in response to a
// player or location action, so a test that builds a lighter-weight
// world and never calls `worldgen.generateWorld` never reaches their
// `inventory.give` either. This file is the first one wired to run
// automatically, unconditionally, every tick — so any fixture that
// calls `engine.advanceTick` at all reaches `runProduction`, and one
// that skipped `worldgen`'s registration step threw on the first NPC
// with enough Black Market Ties to deal. Registering here, idempotent
// by name, is the fix rather than requiring every caller of
// `advanceTick` to remember a step specific to this one file.
function runDrugs(worldState, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  registerItems(worldState);
  const produced = runProduction(worldState, tick);
  const events = runUseAndWithdrawal(worldState, tick);
  return { produced, events };
}

// The measurement. How much of this a world actually has, so "it is
// built" and "it happens anywhere" stay different, checkable facts —
// standing rule 11.
function describeDrugs(worldState) {
  const holders = (worldState.npcs || [])
    .filter((n) => inventory.quantityOf(worldState, n.id, NARCOTICS_ITEM) > 0).length;
  const dependent = (worldState.npcs || [])
    .filter((n) => dependencyOf(worldState, n.id) >= WITHDRAWAL_DEPENDENCY_FLOOR).length;
  return { holders, dependent };
}

module.exports = {
  NARCOTICS_ITEM,
  NARCOTICS_CATEGORY,
  PRODUCTION_TIES_FLOOR,
  DEPENDENCY_PER_USE,
  WITHDRAWAL_DEPENDENCY_FLOOR,
  registerItems,
  tiesOf,
  producesThisTick,
  runProduction,
  propensityOf,
  dependencyOf,
  runUseAndWithdrawal,
  runDrugs,
  describeDrugs,
};
