// server/decisions.js
//
// Why somebody did what they did.
//
// **`decision_log` is one of the most specific tables in the whole
// schema and had no WorldState array at all** — not `schemaOnly` in
// `urbanSystems.js`, not carried by `migrate.js`, simply absent.
// Nothing recorded a decision, so nothing could answer the one
// question a simulation of people exists to answer.
//
// Look at what the schema asks for:
//
//   situation          what was happening
//   available_options  what could have been done
//   selected_option    what was
//   expected_result    what they thought would follow
//   confidence         how sure they were
//   traits_used        which parts of them decided it
//   keys_used          through which resolver
//   memory_used        what they were drawing on
//   outcome            what actually happened
//
// That is not a log line. It is an explanation, and every Key resolver
// in `keys.js` already holds all of it — a resolver reads named traits,
// weighs them, produces a number and writes a memory. The information
// was being computed and discarded on every resolution.
//
// ---------------------------------------------------------------------
// A fourth write-back, and why that is the right shape
//
// Standing rule 1: every Key resolver writes back to Memory,
// Relationships and World state — "that's the definition of done for a
// Key, not optional". `writeBack` in `keys.js` is the one place all
// three happen, so the decision record is a fourth field on the same
// call rather than seven separate additions that could each be
// forgotten.
//
// **`test/decisions.test.js` holds that every resolver supplies one.**
// A Key that resolves without saying why is the failure this module
// exists to fix, and it would be invisible — the resolver would work
// perfectly and the log would simply be shorter than it should be.
//
// ---------------------------------------------------------------------
// Outcome is written later, on purpose
//
// `outcome` is the one field a resolver cannot fill: it is what
// actually happened, which is known after. So a decision is recorded
// with `outcome: null` and `recordOutcome` fills it when the world
// settles — which is also why this is a table rather than a line in
// `memories`. A memory is what somebody believes happened; a decision
// record is what they chose and what followed, and the gap between
// those two is the interesting part.

'use strict';

const { nextAfter } = require('./nextAfter.js');

let nextDecisionId = 1;

function reseedIds(worldState) {
  nextDecisionId = nextAfter(worldState.decisionLog, 'id');
  return { nextDecisionId };
}

// Record one decision, in the shape `decision_log` asks for.
//
// Every JSONB field defaults to an empty array rather than null: a
// decision that used no traits and one nobody recorded the traits for
// are different facts, and `[]` says the first while null says the
// second.
function record(worldState, options = {}) {
  const {
    entityId,
    situation = null,
    availableOptions = [],
    selectedOption = null,
    expectedResult = null,
    confidence = null,
    traitsUsed = [],
    keysUsed = [],
    memoryUsed = [],
    tick = worldState.tick ?? 0,
  } = options;

  if (entityId === undefined || entityId === null) {
    throw new Error('decisions.record requires an entityId (decision_log.entity_id is NOT NULL)');
  }

  const row = {
    id: nextDecisionId++,
    entity_id: entityId,
    situation,
    available_options: availableOptions,
    selected_option: selectedOption,
    expected_result: expectedResult,
    confidence,
    traits_used: traitsUsed,
    keys_used: keysUsed,
    memory_used: memoryUsed,
    // Filled by `recordOutcome` when the world settles — see the
    // header. A resolver cannot know it.
    outcome: null,
    tick,
  };
  (worldState.decisionLog || (worldState.decisionLog = [])).push(row);
  return row;
}

// What actually followed. Returns the row so a caller can see what was
// decided beside what happened.
function recordOutcome(worldState, decisionId, outcome) {
  const row = (worldState.decisionLog || []).find((d) => d.id === decisionId);
  if (!row) throw new Error(`decisions.recordOutcome: no decision ${decisionId}`);
  row.outcome = outcome;
  return row;
}

// -- reading ------------------------------------------------------------

function decisionsBy(worldState, entityId, options = {}) {
  const { sinceTick = null, key = null } = options;
  return (worldState.decisionLog || []).filter(
    (d) => d.entity_id === entityId
      && (sinceTick === null || d.tick >= sinceTick)
      && (key === null || (d.keys_used || []).includes(key)),
  );
}

// **The read this table exists for**: a plain-language account of why
// somebody did something, assembled from the fields rather than from a
// sentence somebody wrote at the call site. A stored sentence would go
// stale the moment a resolver's weighting changed; this cannot.
function explain(worldState, decisionId) {
  const row = (worldState.decisionLog || []).find((d) => d.id === decisionId);
  if (!row) return null;

  const traits = (row.traits_used || [])
    .map((t) => `${t.family}.${t.name} ${t.value}`)
    .join(', ');

  return {
    decisionId,
    entityId: row.entity_id,
    tick: row.tick,
    because: traits || 'no traits recorded',
    through: (row.keys_used || []).join(', ') || 'no key recorded',
    chose: row.selected_option,
    from: row.available_options,
    expecting: row.expected_result,
    confidence: row.confidence,
    // Null means the world has not settled it yet, which is different
    // from an outcome of nothing.
    outcome: row.outcome,
    settled: row.outcome !== null,
  };
}

// How often somebody's expectation matched what happened. Null rather
// than a rate when nothing has settled — the same unknown-is-not-zero
// rule every module here follows.
function reliabilityOf(worldState, entityId) {
  const settled = decisionsBy(worldState, entityId).filter((d) => d.outcome !== null);
  if (settled.length === 0) return null;
  const matched = settled.filter((d) => d.outcome === d.expected_result).length;
  return Math.round((matched / settled.length) * 10000) / 10000;
}

module.exports = {
  reseedIds,
  record,
  recordOutcome,
  decisionsBy,
  explain,
  reliabilityOf,
};
