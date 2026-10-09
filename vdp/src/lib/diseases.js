// VDP — diseases: a real, named illness status an individual can
// carry. Per direct instruction (9 Oct 2026): "make sure you add in
// diseases."
//
// VACON-C already has disease, but at population/city scale
// (`mortality.js`'s own `addDiseaseOutbreak`/`diseasePressure`, an
// environmental condition that raises a whole city's mortality risk).
// VDP had none at all, at any scale -- a real, confirmed gap, checked
// directly (no `mortality.js`, no "disease" string anywhere in
// `src/lib/`) rather than assumed missing. This module is the
// INDIVIDUAL-scale sibling, built at `hospital.js`'s own scale, the
// same "borrow the shape, not the scale" discipline `npcs.js`/
// `skills.js` already apply to other VACON-C-derived systems.
//
// `name` is free text, same discipline every other open list in this
// file's directory already uses (`immigration.js`'s `originRegion`/
// `smuggledGoods`) -- real, ordinary illnesses (the common cold,
// influenza, and so on) are the obvious real-world examples, not a
// closed enum this module would otherwise refuse to invent.
//
// A disease lowers every real `health` trait (`traits.js`'s own
// Immune Response, Nutrition Status, Chronic Conditions, Sleep
// Quality -- the same four `hospital.js` already names as
// `HEALTH_TRAITS`) by one flagged-interpretive amount, and curing it
// reverses exactly that effect -- a real, exact inverse, the same
// "a mechanism with no inverse has no equilibrium" discipline
// VACON-C's own CLAUDE.md names as a standing rule. `cureDisease` is
// a function of this module, not a new, second health-restoring path
// `hospital.js` would otherwise have to duplicate -- `server.cjs` is
// expected to call it alongside `treatPatient` when a patient being
// treated actually has something to cure.

import { HEALTH_TRAITS } from './hospital.js';
import { bumpTrait, readTrait } from './traits.js';

export const DISEASE_HEALTH_PENALTY = 15; // interpretive -- no source document gives a real severity

export function createDiseaseStore() {
  return { cases: [], nextCaseId: 1 };
}

export function activeDiseaseFor(store, personId) {
  return store.cases.find((c) => c.personId === personId && !c.curedAt) || null;
}

export function contractDisease(store, { personId, name, traits, now = Date.now() } = {}) {
  if (!personId) throw new Error('contractDisease requires a personId');
  if (!name) throw new Error('contractDisease requires a real disease name');
  if (!traits) throw new Error("contractDisease requires the person's traits");
  if (activeDiseaseFor(store, personId)) {
    throw new Error(`contractDisease: "${personId}" already has an active, uncured disease`);
  }

  const before = {};
  const after = {};
  for (const traitName of HEALTH_TRAITS) {
    before[traitName] = readTrait(traits, 'health', traitName);
    after[traitName] = bumpTrait(traits, 'health', traitName, -DISEASE_HEALTH_PENALTY);
  }

  const caseRecord = {
    id: store.nextCaseId++, personId, name, contractedAt: now, curedAt: null, healthEffect: { before, after },
  };
  store.cases.push(caseRecord);
  return caseRecord;
}

// The real, exact inverse of `contractDisease`'s own penalty --
// called by whoever actually cures someone (`hospital.js`'s own
// `treatPatient`, via `server.cjs`), never a second guess at how
// much a cure should restore.
export function cureDisease(store, personId, { traits, now = Date.now() } = {}) {
  const active = activeDiseaseFor(store, personId);
  if (!active) throw new Error(`cureDisease: "${personId}" has no active disease to cure`);
  if (!traits) throw new Error("cureDisease requires the person's traits");

  for (const traitName of HEALTH_TRAITS) {
    bumpTrait(traits, 'health', traitName, DISEASE_HEALTH_PENALTY);
  }
  active.curedAt = now;
  return active;
}

export function casesFor(store, personId) {
  return store.cases.filter((c) => c.personId === personId);
}
