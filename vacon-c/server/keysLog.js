// server/keysLog.js
//
// The numeric half of the audit trail, and the one that makes a
// resolution CHECKABLE rather than merely explained.
//
// `keys_log` was one of the last tables in the schema with no
// WorldState array, no code and no rows — `dev-docs/GAME_COMPLETENESS.md`
// scored it "no store", full credit available. It is not a duplicate of
// `decision_log`, and the schema is precise about the difference:
//
//   decision_log   situation, available_options, selected_option,
//                  expected_result, confidence, traits_used, keys_used,
//                  memory_used, outcome. **Why somebody did something**,
//                  in words, readable by a person.
//
//   keys_log       entity_id, key_id, resolved_value, context_json —
//                  and that last column's own schema comment reads
//                  "snapshot of entity_knowledge/relationships read at
//                  resolution time". **What one Key computed, and from
//                  what.**
//
// ---------------------------------------------------------------------
// Why the second one is worth having
//
// This is `contest.verifyContest`'s lesson generalised to all seven
// Keys. That function's whole stated purpose was that anybody could
// check a settlement without trusting whoever reported it, and it did
// not work: it re-ran the bout against the LIVE world, so a result
// could only be verified in the instant it was produced. A day later
// the tick had moved, the entrants had drifted, and an honest
// settlement failed its own audit. The fix was to record the inputs
// alongside the output.
//
// Every Key resolution has had exactly that problem. `decision_log`
// records that somebody chose to escalate with confidence 0.6; it does
// not record the aggression, the tactical awareness and the grievance
// that produced the number, so nobody can re-derive it. The traits have
// since drifted and the relationship has since moved. A log that cannot
// be recomputed is a claim, not a record.
//
// ---------------------------------------------------------------------
// `key_definitions` is a module constant, and that was already true
//
// `server/completeness.js` declares the definition table as "a module
// constant (keys.js), not per-world state", which is the same call
// `traitDefinitions.js` makes for traits: a definition is a property of
// the engine, not of a world, so it does not need a per-world store.
// `keys.KEY_DEFINITIONS` is now that constant in fact rather than in
// principle — before this it did not exist, so `keys_log.key_id` had
// nothing to reference.

'use strict';

const { nextAfter } = require('./nextAfter.js');

let nextKeysLogId = 1;

// Called after a world is loaded from Postgres — see server/idSequences.js.
function reseedIds(worldState) {
  nextKeysLogId = nextAfter(worldState.keysLog);
  return { nextKeysLogId };
}

function writable(worldState) {
  if (!Array.isArray(worldState.keysLog)) {
    throw new Error(
      'keysLog: worldState.keysLog does not exist. engine.js declares it on WorldState.',
    );
  }
  return worldState.keysLog;
}

// Record one Key resolution.
//
// `resolvedValue` is the number the Key produced — the headline figure
// each resolver already returns and, until now, discarded from any
// durable record. Null is allowed and is not the same as zero: a Key
// that could not resolve against an unreadable entity produced no
// value, and writing 0 would say it produced none *of* something.
function record(worldState, options = {}) {
  const {
    entityId, keyId, resolvedValue = null, context = null,
    tick = worldState.tick ?? 0,
  } = options;

  if (entityId === undefined || entityId === null) {
    throw new Error('keysLog.record requires an entityId (keys_log.entity_id is NOT NULL)');
  }
  if (keyId === undefined || keyId === null) {
    throw new Error('keysLog.record requires a keyId (keys_log.key_id is NOT NULL)');
  }

  const numeric = Number(resolvedValue);
  const row = {
    id: nextKeysLogId++,
    entity_id: entityId,
    key_id: keyId,
    // **Null rather than 0 for an unresolvable value**, and the check
    // has to test for null BEFORE the conversion, because `Number(null)`
    // is 0 and 0 is finite. CLAUDE.md's corollary, and the defect that
    // shipped in `moodFor`.
    resolved_value: resolvedValue === null || !Number.isFinite(numeric) ? null : numeric,
    context_json: context,
    tick,
  };
  writable(worldState).push(row);
  return row;
}

// -- reading ------------------------------------------------------------

function resolutionsBy(worldState, entityId, keyId = undefined) {
  return (worldState.keysLog || []).filter(
    (r) => r.entity_id === entityId && (keyId === undefined || r.key_id === keyId),
  );
}

// Every resolution of one Key, newest first. What a Key has actually
// been doing across a world, which is the question `decision_log`
// cannot answer because it holds the Key's NAME in a JSONB array
// rather than as a queryable column.
function resolutionsOf(worldState, keyId) {
  return (worldState.keysLog || [])
    .filter((r) => r.key_id === keyId)
    .sort((a, b) => b.tick - a.tick);
}

// **Re-derive a recorded resolution from the inputs recorded with it.**
//
// This is the property the table exists for. `recompute` is supplied by
// the caller — the arithmetic lives in `keys.js`, not here — and this
// hands it the snapshot rather than the live world, which is exactly
// what `verifyContest` failed to do for two weeks.
//
// Returns `{ verified, recorded, recomputed }`, or null for a row whose
// context was not captured. Null is not `verified: false`: a resolution
// nobody snapshotted is unverifiable, which is a different statement
// from one that disagrees with its own inputs.
function verify(worldState, rowId, recompute) {
  const row = (worldState.keysLog || []).find((r) => r.id === rowId);
  if (!row) throw new Error(`keysLog.verify: no resolution ${rowId}`);
  if (row.context_json === null || row.context_json === undefined) return null;
  if (typeof recompute !== 'function') {
    throw new Error('keysLog.verify requires a recompute function — the arithmetic lives in keys.js');
  }

  const recomputed = recompute(row.context_json, row);
  const recorded = row.resolved_value;
  if (recomputed === null || recorded === null) {
    return { verified: recomputed === recorded, recorded, recomputed };
  }
  // Rounded to the precision the resolvers themselves produce; every
  // one of the seven rounds its headline figure, so an exact float
  // comparison would fail on arithmetic that is in fact identical.
  const same = Math.round(Number(recomputed) * 1e6) === Math.round(Number(recorded) * 1e6);
  return { verified: same, recorded, recomputed };
}

module.exports = {
  reseedIds,
  record,
  resolutionsBy,
  resolutionsOf,
  verify,
};
