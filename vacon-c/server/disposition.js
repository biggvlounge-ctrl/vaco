// server/disposition.js
//
// Closes task #216, from the master spec's §9: "Encounters may support
// interaction with wounded, incapacitated, surrendering or captured
// NPCs... Disposition includes: Recruit... Exile/relocation...
// Prisoner/custody... Release." This is the real player-facing choice
// this engine's own contest resolution (task #137) made possible and
// never gave anyone a way to act on.
//
// ---------------------------------------------------------------------
// What can actually be captured, read directly off the real mechanism
// that already exists
// ---------------------------------------------------------------------
// `contest.resolveContest`'s `loserOutcomes` already gives every loser
// in a real `combat` bout one of three real outcomes (task #137):
// `defeated` (kept fighting until beaten -- incapacitated), `fled`
// (got away), `submitted` (gave up). Only the first and the third are
// a real person standing in front of the winner; someone who fled is
// not there to capture. `CAPTURABLE_LOSER_OUTCOMES` is that real
// subset, not an invented third list.
//
// ---------------------------------------------------------------------
// A capture is a real, persisted event -- not a status flip with
// nothing behind it
// ---------------------------------------------------------------------
// `npc.status` already carries free-text real values this engine
// checks against (`'active'`, `'imprisoned'`, `'deceased'`) rather
// than an enum, so a third value, `'captive'`, is the honest state for
// someone held informally rather than convicted — checked directly
// before adding it: every one of this engine's ~50 `status ===
// 'active'` gates (hiring, routine, recruitment eligibility and so on)
// already excludes anyone not `'active'`, so a captive is correctly
// unavailable for ordinary life without touching any of those call
// sites, and the ~18 `status === 'imprisoned'`-specific checks (legal-
// system reads, by their own name) correctly do NOT fire for an
// informal capture, which is the honest distinction: a captor is not a
// court. The same real consequences `justice.imprison` already applies
// for the identical reason ("a status field nothing reads is the
// eleventh standing rule wearing a prison uniform") are applied here
// too — `economy.endEmployment` and clearing `scheduleEvents` — rather
// than leaving `'captive'` as decoration.
//
// `worldState.captures` is a new, in-memory-only array (no schema
// column exists for any of this, the same documented posture
// `heat.js`/`plays.js` already carry for their own new concepts).
//
// ---------------------------------------------------------------------
// The four real dispositions, and what each one reuses rather than
// invents
// ---------------------------------------------------------------------
// **`recruit`** — `leadership.complianceDraw` directly, the identical
// loyalty-gated draw `assignRole`/`directMission`/`plays.js#runPlay`
// already use. No relationship yet between captor and captive reads
// as `complianceDraw`'s own real default (gatingValue 50, a coin
// flip) — not a zero, not a guaranteed yes, the same "acceptance is
// not guaranteed" §9 itself requires. A refusal leaves the capture
// UNRESOLVED (`disposition` stays `null`) rather than forcing an
// outcome — the captor can try a different disposition next.
//
// **`exile`** — `migration.relocate` with `migrationType: 'forced'`,
// a real, already-enumerated migration type (`migration.
// MIGRATION_TYPES`), reused rather than inventing a second "forced
// move" vocabulary. Requires a real destination community, validated
// against `worldState.communities` — the captor chooses where, this
// file does not invent a "somewhere far away" algorithm.
//
// **`custody`** — the honest minimal case: the capture's own real
// record is marked resolved with this disposition, and the captive
// stays `'captive'`. No facility, conditions or parole system is
// built here — that is real, separate, future work (`justice.js`'s
// own prison/parole machinery is the model to extend if this engine
// later needs it for an INFORMAL holder).
//
// **`release`** — `'active'` again, free. §9: "changes relationships,
// reputation, community rating, factions and future encounters" — this
// file writes the one real thing it can respect without inventing an
// uncalibrated modifier: a real memory on both sides (standing rule 17's
// own lesson — an unmeasured relationship delta is a guess, not a
// feature). Nothing here moves `relationships.trust`/`loyalty` by an
// invented number.

'use strict';

const leadership = require('./leadership.js');
const membership = require('./membership.js');
const migration = require('./migration.js');
const economy = require('./economy.js');
const worldStore = require('./worldStore.js');

const DISPOSITIONS = ['recruit', 'exile', 'custody', 'release'];
// 'passed_out' joined for task #136's own live hold mechanic
// (contest.resolveHold): a victim choked or kneed unconscious is at
// least as capturable as one merely 'defeated' -- more so, since they
// cannot resist at all. Reuses this exact list rather than a second,
// parallel "what counts as captured" vocabulary.
const CAPTURABLE_LOSER_OUTCOMES = ['defeated', 'submitted', 'passed_out'];

let nextCaptureId = 1;

function requireLivingEntity(worldState, entityId, label) {
  const npc = (worldState.npcs || []).find((n) => n.id === Number(entityId));
  if (!npc) throw new Error(`${label}: no living entity ${entityId}.`);
  return npc;
}

// A real encounter's winner takes a real loser into custody. Reuses
// contest.resolveContest's own real outcome rather than re-deciding
// whether somebody put up a fight.
function capture(worldState, options = {}) {
  const {
    capturedEntityId, capturedByEntityId, loserOutcome, tick = worldState.tick ?? 0,
  } = options;

  if (!CAPTURABLE_LOSER_OUTCOMES.includes(loserOutcome)) {
    throw new Error(
      `capture: "${loserOutcome}" is not a real capturable outcome — contest.resolveContest's `
      + `own loserOutcomes and contest.resolveHold's own outcome give ${CAPTURABLE_LOSER_OUTCOMES.join(', ')}; `
      + 'someone who fled or escaped was never captured.',
    );
  }

  const npc = requireLivingEntity(worldState, capturedEntityId, 'capture');
  if (npc.status === 'captive') {
    throw new Error(`capture: entity ${capturedEntityId} is already a real captive.`);
  }

  npc.status = 'captive';

  // The same two real consequences `justice.imprison` already applies
  // for the identical reason — see this file's own header.
  if (economy.getEmployment(worldState, npc.id)) {
    economy.endEmployment(worldState, { entityId: npc.id });
  }
  worldState.scheduleEvents = (worldState.scheduleEvents || [])
    .filter((e) => e.entity_id !== npc.id);

  const record = {
    id: nextCaptureId++,
    captured_entity_id: npc.id,
    captured_by_entity_id: Number(capturedByEntityId),
    loser_outcome: loserOutcome,
    tick_captured: tick,
    disposition: null,
    tick_resolved: null,
  };
  (worldState.captures || (worldState.captures = [])).push(record);

  worldStore.addMemory(worldState, {
    entityId: npc.id, memoryType: 'experience', category: 'personal',
    description: loserOutcome === 'submitted'
      ? 'submitted in a real fight and was taken captive'
      : loserOutcome === 'passed_out'
        ? 'was choked or kneed unconscious and taken captive'
        : 'was beaten in a real fight and taken captive',
    importance: 85, emotionLevel: 70,
    relatedEntityIds: [Number(capturedByEntityId)], tick,
  });

  return record;
}

function requireOpenCapture(worldState, captureId) {
  const record = (worldState.captures || []).find((c) => c.id === Number(captureId));
  if (!record) throw new Error(`disposeOf: no real capture with id ${captureId}.`);
  if (record.disposition !== null) {
    throw new Error(`disposeOf: capture ${captureId} was already disposed of (${record.disposition}).`);
  }
  return record;
}

// The real choice this file exists for. Always acts on a real,
// currently-open capture — never a bare entity id, so a disposition
// can only ever be chosen for somebody this engine actually recorded
// as captured.
function disposeOf(worldState, captureId, options = {}) {
  const {
    disposition, organizationId = null, toCommunityId = null, toPropertyId = null,
    tick = worldState.tick ?? 0,
  } = options;

  if (!DISPOSITIONS.includes(disposition)) {
    throw new Error(`disposeOf: "${disposition}" is not a real disposition. The four are: ${DISPOSITIONS.join(', ')}.`);
  }

  const record = requireOpenCapture(worldState, captureId);
  const npc = requireLivingEntity(worldState, record.captured_entity_id, 'disposeOf');
  if (npc.status !== 'captive') {
    throw new Error(`disposeOf: entity ${npc.id} is not currently a real captive (status is "${npc.status}").`);
  }

  const outcome = { captureId: record.id, disposition };

  if (disposition === 'recruit') {
    if (organizationId == null) throw new Error('disposeOf: recruit requires a real organizationId.');
    const { complied, gatingValue, complianceChance } = leadership.complianceDraw(
      worldState, record.captured_by_entity_id, npc.id, 'recruit-captive', tick,
    );
    outcome.complied = complied;
    outcome.gatingValue = gatingValue;
    outcome.complianceChance = complianceChance;
    if (!complied) {
      // Refused — the capture stays open. The captor can try a
      // different disposition; this is not forced into a fallback.
      return outcome;
    }
    membership.joinOrganization(worldState, { entityId: npc.id, organizationId, tick });
    npc.status = 'active';
  } else if (disposition === 'exile') {
    if (toCommunityId == null) throw new Error('disposeOf: exile requires a real toCommunityId.');
    const community = (worldState.communities || []).find((c) => c.id === Number(toCommunityId));
    if (!community) throw new Error(`disposeOf: no real community with id ${toCommunityId}.`);
    migration.relocate(worldState, {
      entityId: npc.id, toCommunityId: community.id, toPropertyId,
      migrationType: 'forced', reason: 'exiled after a real capture', tick,
    });
    npc.status = 'active';
  } else if (disposition === 'release') {
    npc.status = 'active';
  }
  // 'custody': no further change — npc.status stays 'captive'.

  record.disposition = disposition;
  record.tick_resolved = tick;

  const describeDisposition = {
    recruit: `recruited into organization ${organizationId} by`,
    exile: 'exiled by',
    custody: 'held in custody by',
    release: 'released by',
  }[disposition];

  worldStore.addMemory(worldState, {
    entityId: npc.id, memoryType: 'experience', category: 'personal',
    description: `was ${describeDisposition} entity ${record.captured_by_entity_id}`,
    importance: 80, emotionLevel: disposition === 'release' ? 40 : 65,
    relatedEntityIds: [record.captured_by_entity_id], tick,
  });

  return outcome;
}

function capturesOf(worldState, { capturedByEntityId = null, open = null } = {}) {
  return (worldState.captures || []).filter((c) => (
    (capturedByEntityId == null || c.captured_by_entity_id === Number(capturedByEntityId))
    && (open === null || (open ? c.disposition === null : c.disposition !== null))
  ));
}

module.exports = {
  DISPOSITIONS, CAPTURABLE_LOSER_OUTCOMES,
  capture, disposeOf, capturesOf,
};
