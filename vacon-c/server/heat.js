// server/heat.js
//
// Multi-faction heat — real, and independent per faction, by direct
// instruction: "it could be a heat bar, but not just for the police...
// you could be on a gang's radar." Not a single "wanted" scalar.
//
// ---------------------------------------------------------------------
// The real substrate this reuses, and the one thing it deliberately
// does not cover
// ---------------------------------------------------------------------
//
// `organizations.leader_id REFERENCES entities(id)` — organizations and
// people already share the same `entities(id)` space, so a
// `relationships` row between a person and an organization-as-entity is
// already structurally valid; nothing in `worldStore.js`'s
// `getOrCreateRelationship`/`adjustRelationship` checks what kind of
// entity either side is. This file is the first thing in the engine to
// actually use that — checked directly (`grep -rn "adjustRelationship"
// server/*.js` against "organization") before writing it, rather than
// assumed real.
//
// **The real trigger is `justice.answerByGroup`, not a second detection
// mechanism invented here.** That function already exists for exactly
// the case a multi-faction heat bar is for: a faction, holding real
// ground (`authority.holderOf`, now also `policing.factionCapacityOf`'s
// own real source), dealing with an offender the state did not. Heat
// rises there, and only there — when the faction actually DID something
// about the offence (restitution, expulsion, or a feud; `acts.length >
// 0`), never merely because an offence happened somewhere a faction
// holds ground. That is a real, stated scope boundary: this file does
// not give a faction omniscient awareness of every crime in its own
// territory, only of the ones it actually answered — the same
// "reported is not committed" honesty `policing.js`'s own header
// already draws for a different pair of facts.
//
// `relationships.conflict` is the real column reused as the heat value,
// 0..100, the same scale and the same column `crime.js`/`tick.js`
// already read as "tension that can escalate" between two people —
// never a second, disagreeing field invented for the identical idea one
// relationship type over. `relationship_type: 'enemy'` is the real,
// already-enumerated value (`VACANCY_POSTGRESQL_SCHEMA.sql`'s own
// comment on `relationships.relationship_type`) that fits a person a
// faction now considers a target, rather than inventing a tenth value.
//
// **Government/police heat is deliberately out of scope, and the
// reason is that the state's own mechanism is already stronger, not
// missing.** `justice.js`'s real chain — `judge` → `imprison` — already
// resolves a governed area's answer immediately and completely: a
// cleared, prosecuted offence ends in a real conviction and a real
// sentence, not a growing suspicion level. A parallel "heat with the
// government" would either duplicate that chain or disagree with it,
// which is the third standing rule's shape. What this file gives a
// faction that the state does not have is exactly what the state
// already has by a different, complete mechanism.
//
// **Missiles, drones, and anything beyond this file's own real,
// per-faction conflict reading are not part of it** — same declared
// boundary `weapons.js`'s own header draws for itself.

'use strict';

const worldStore = require('./worldStore.js');
const justice = require('./justice.js');

const HEAT_RELATIONSHIP_TYPE = 'enemy';

//: Reuses `justice.GROUP_FEUD_GAIN` — the identical real magnitude that
//: file already assigns to "a faction dealt with you and it mattered" on
//: the victim's side of the same event. Giving the faction's own side
//: of that event a second, different number would be the forty-eighth
//: standing rule's own warning about two real events of the same size
//: getting different numbers for no stated reason.
const HEAT_GAIN = justice.GROUP_FEUD_GAIN;

// How much heat a person has with one specific faction, 0 when no
// relationship has ever been created — not null, because "never
// noticed" and "noticed, and nothing happened" read identically on a
// 0..100 scale and this file has no third state to report (unlike
// `policing.js`'s own `null` for unmeasured capacity, which DOES have
// something to distinguish zero from).
function heatWith(worldState, entityId, factionOrganizationId) {
  const rel = worldStore.findRelationship(worldState, entityId, factionOrganizationId);
  if (!rel || rel.relationship_type !== HEAT_RELATIONSHIP_TYPE) return 0;
  return Number(rel.conflict) || 0;
}

// Every faction a person has any real heat with, independently — the
// whole point of "not just one wanted scalar". Only organizations (an
// `entities(id)` row that is NOT in `npcs`) are read back, and only
// `enemy`-typed rows this file itself writes, so a person's ordinary
// `enemy` relationship with another PERSON (ordinary interpersonal
// conflict, unrelated to this mechanic) never leaks in here.
function heatProfile(worldState, entityId) {
  const organizationIds = new Set((worldState.organizations || []).map((o) => o.id));
  return (worldState.relationships || [])
    .filter((r) => r.relationship_type === HEAT_RELATIONSHIP_TYPE
      && (r.entity_a_id === entityId || r.entity_b_id === entityId))
    .map((r) => {
      const otherId = r.entity_a_id === entityId ? r.entity_b_id : r.entity_a_id;
      return { factionOrganizationId: otherId, heat: Number(r.conflict) || 0 };
    })
    .filter((row) => organizationIds.has(row.factionOrganizationId) && row.heat > 0);
}

// **Chaos ripple effects, part two: a person's OWN worst standing
// heat, 0..1 — not a community average, and not summed across
// factions.** `motivation.js#safety` already reads
// `crime.dangerByCommunity` for the area somebody lives in; this is a
// genuinely separate real fact, because heat is scoped to the PERSON
// `raiseHeat` was actually called on, not their neighbourhood. Someone
// a specific gang has personally targeted has a real reason to want
// out even if the block they live on reads as quiet on paper, and the
// reverse is just as real: a quiet, uninvolved resident of a
// dangerous-reading block carries none of this term.
//
// The WORST single faction's heat, not the sum — the same "let worst
// = ... if pressure > worst.pressure" reduction `migration.pushFor`
// already uses picking one need to act on, rather than a sum that
// would make being on three factions' radars at once three times as
// motivating as one, a multiplier this file has no measurement to
// justify. Scaled to 0..1 against the same 0..100 ceiling
// `relationships.conflict` already uses everywhere else in this file.
function worstHeat(worldState, entityId) {
  const rows = heatProfile(worldState, entityId);
  if (rows.length === 0) return 0;
  return Math.max(0, Math.min(1, Math.max(...rows.map((r) => r.heat)) / 100));
}

// Raise real heat between a person and a real faction organization,
// clamped to the same 0..100 scale `relationships.conflict` already
// uses everywhere else, the identical clamp shape
// `justice.answerByGroup`'s own feud write already uses: the delta is
// capped at what is left to 100, never pushed past it.
function raiseHeat(worldState, { entityId, factionOrganizationId, amount = HEAT_GAIN }) {
  if (entityId === null || entityId === undefined) return null;
  if (factionOrganizationId === null || factionOrganizationId === undefined) return null;
  const rel = worldStore.getOrCreateRelationship(
    worldState, entityId, factionOrganizationId, HEAT_RELATIONSHIP_TYPE,
  );
  const now = Number(rel.conflict) || 0;
  rel.conflict = now + Math.max(0, Math.min(amount, 100 - now));
  return rel;
}

module.exports = {
  HEAT_RELATIONSHIP_TYPE,
  HEAT_GAIN,
  heatWith,
  heatProfile,
  worstHeat,
  raiseHeat,
};
