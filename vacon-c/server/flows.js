// server/flows.js
//
// Named Flow Templates — the last open Phase 2 system, and the one the
// architecture document is most specific about *how* to build:
//
//   "**Named Flow Templates** (Economic Flow, Social Flow, Family Flow,
//    Education Flow, Business Flow, Political Flow, Security Flow,
//    Crime Flow, Transportation Flow, Resource Flow) — implemented as
//    data (`flow_templates` table), **not one hardcoded function per
//    flow**."
//
// That last clause is the whole requirement, and the tick pipeline as
// it stands is exactly what it rules out: one hardcoded function per
// phase. So the deliverable here is not ten more functions. It is one
// resolver plus ten rows.
//
// ---------------------------------------------------------------------
// **What makes this real rather than a lookup table with ambitions.**
//
// A data-driven mechanism is only data-driven if adding a row changes
// behaviour with no code change. That is a property a test can assert,
// and `test/flows.test.js` does assert it: it defines a flow that does
// not exist anywhere in this file, runs a tick, and sees its effect.
// If that test ever needs a code change to pass, this file has quietly
// become ten hardcoded functions again.
//
// ---------------------------------------------------------------------
// **What a flow is, and what it deliberately is not.**
//
// A flow is a named, declared propagation: *when this signal in the
// world crosses this threshold, these consequences follow.* It reads
// world state and emits events.
//
// A flow does NOT replace a tick phase. The Economy phase still prices
// listings; the Security phase still escalates conflict. Flows are the
// cross-cutting layer above them — the thing that says "a resource
// shortage is not only an economic fact, it is a social and a security
// fact too." That is why they run after the eight producing phases and
// before the Event phase, rather than becoming a twelfth phase: the
// pipeline is locked at eleven, and flows are inputs to Event like
// every other phase's output.
//
// **Flows do not mutate the world.** They observe and they report. Every
// one of the ten below emits events; none writes a balance, a price, or
// a trait. That is a deliberate boundary and it is tested: a world that
// runs a hundred ticks with flows enabled has exactly the same
// resource, market and trait values as one that runs them with flows
// removed. Cascades that *do* change the world are the phases' job, and
// a data-described rule quietly rewriting balances is how a simulation
// becomes impossible to reason about.
//
// ---------------------------------------------------------------------
// **The signal vocabulary is the contract.**
//
// A template names a `signal`, and the resolver knows how to read a
// fixed set of them from world state. That set is the extension point:
// a new flow composes existing signals with no code; a genuinely new
// *kind* of observation needs one new signal reader, which is a real
// code change and should be.

'use strict';

const economy = require('./economy.js');

let nextFlowEventId = 1;

const rows = (worldState, name) => worldState[name] || [];
const mean = (values) => (values.length
  ? values.reduce((sum, n) => sum + n, 0) / values.length : null);

// ---------------------------------------------------------------------------
// Signals — everything a flow template is allowed to observe
// ---------------------------------------------------------------------------
// Each returns a number, or null for "this world has nothing to say
// about that". Null is not zero: a world with no market has no average
// price, and a flow that fired on "average price is 0" would be
// reporting a fact nobody stated. Every reader below returns null on an
// empty input rather than a default.
//
// **Three of these read through a function rather than off the row, and
// that is not a style choice.** Scarcity and organization power are not
// columns. Scarcity is computed by economy.getScarcity() on every read
// (standing rule 3 — a computable rollup is never stored), and an
// organization's power lives in its entity_traits sheet, not as a field.
//
// The first version of this file read `resource.scarcity` and
// `organization.power` directly. Both are `undefined` on every real
// row, so `resource.maxScarcity`, `resource.meanScarcity` and
// `organization.meanPower` always returned null and **three of the ten
// named flows — Economic, Resource and Political — could never fire.**
//
// The unit tests did not catch it, because the fixtures set
// `scarcity` directly on hand-built rows and so encoded the same wrong
// assumption the code did. What caught it was seeding a real world and
// noticing that a drought at scarcity 77 fired no Economic Flow.
// `every signal reads something on a realistically populated world` in
// test/flows.test.js is the guard against a fourth one.
const SIGNALS = {
  'resource.maxScarcity': (w) => {
    const values = rows(w, 'resources').map((r) => economy.getScarcity(r)).filter(Number.isFinite);
    return values.length ? Math.max(...values) : null;
  },
  'resource.meanScarcity': (w) => mean(
    rows(w, 'resources').map((r) => economy.getScarcity(r)).filter(Number.isFinite),
  ),
  'market.meanPrice': (w) => mean(
    rows(w, 'marketListings').map((l) => Number(l.price)).filter(Number.isFinite),
  ),
  'population.meanVolatility': (w) => mean(
    rows(w, 'npcs').map((n) => Number(n.traits?.emotional?.Volatility)).filter(Number.isFinite),
  ),
  'population.migrationRiskCount': (w) => rows(w, 'migrationRisk').length,
  'social.meanTrust': (w) => mean(
    rows(w, 'relationships').map((r) => Number(r.trust)).filter(Number.isFinite),
  ),
  'family.count': (w) => rows(w, 'families').length,
  'family.meanUnity': (w) => mean(
    rows(w, 'families').map((f) => Number(f.unity)).filter(Number.isFinite),
  ),
  'culture.meanEducation': (w) => mean(
    rows(w, 'cultures').map((c) => Number(c.traits?.education)).filter(Number.isFinite),
  ),
  'business.count': (w) => rows(w, 'organizations').filter((o) => o.type === 'business').length,
  'organization.meanPower': (w) => mean(
    rows(w, 'organizations')
      .map((o) => Number(o.traits?.organization?.power))
      .filter(Number.isFinite),
  ),
  'territory.contestedCount': (w) => rows(w, 'territoryBlocks')
    .filter((b) => b.status === 'contested').length,
  'community.meanCrime': (w) => mean(
    rows(w, 'communities').map((c) => Number(c.crime)).filter(Number.isFinite),
  ),
  'community.meanSafety': (w) => mean(
    rows(w, 'communities').map((c) => Number(c.safety)).filter(Number.isFinite),
  ),
  'property.count': (w) => rows(w, 'properties').length,
  'property.meanCondition': (w) => mean(
    rows(w, 'properties').map((p) => Number(p.condition)).filter(Number.isFinite),
  ),
  'reemergence.index': (w) => (Number.isFinite(Number(w.reemergenceIndex))
    ? Number(w.reemergenceIndex) : null),
};

const COMPARATORS = {
  above: (value, threshold) => value > threshold,
  below: (value, threshold) => value < threshold,
  atLeast: (value, threshold) => value >= threshold,
  atMost: (value, threshold) => value <= threshold,
};

// ---------------------------------------------------------------------------
// The ten named flows, as data
// ---------------------------------------------------------------------------
// The names are verbatim from the architecture document. The thresholds
// are interpretive and flagged: no document gives a number for any of
// them. Where one already existed elsewhere in this engine it is reused
// rather than invented afresh — 60 is the scarcity threshold tick.js
// already broadcasts on, and 65 is its migration-risk threshold.
const FLOW_TEMPLATES = [
  {
    id: 'economic-flow',
    name: 'Economic Flow',
    signal: 'resource.maxScarcity',
    comparator: 'above',
    threshold: 60,
    severity: 'high',
    note: 'A resource shortage is reaching the market — prices follow scarcity.',
  },
  {
    id: 'resource-flow',
    name: 'Resource Flow',
    signal: 'resource.meanScarcity',
    comparator: 'above',
    threshold: 55,
    severity: 'moderate',
    note: 'Scarcity is broad rather than isolated to one resource.',
  },
  {
    id: 'social-flow',
    name: 'Social Flow',
    signal: 'social.meanTrust',
    comparator: 'below',
    threshold: 40,
    severity: 'moderate',
    note: 'Trust across the population is low enough to affect cooperation.',
  },
  {
    id: 'family-flow',
    name: 'Family Flow',
    signal: 'family.meanUnity',
    comparator: 'below',
    threshold: 40,
    severity: 'moderate',
    note: 'Households are fracturing — family unity is below the point where they hold together.',
  },
  {
    id: 'education-flow',
    name: 'Education Flow',
    signal: 'culture.meanEducation',
    comparator: 'below',
    threshold: 35,
    severity: 'low',
    note: 'Cultures in this world place little value on education — a slow driver, not an event.',
  },
  {
    id: 'business-flow',
    name: 'Business Flow',
    signal: 'business.count',
    comparator: 'atMost',
    threshold: 0,
    severity: 'low',
    note: 'No businesses are operating — the economy has no producers of its own.',
  },
  {
    id: 'political-flow',
    name: 'Political Flow',
    signal: 'organization.meanPower',
    comparator: 'above',
    threshold: 75,
    severity: 'moderate',
    note: 'Organizational power is concentrated — the anti-snowball condition the World Balance Engine watches for.',
  },
  {
    id: 'security-flow',
    name: 'Security Flow',
    signal: 'territory.contestedCount',
    comparator: 'atLeast',
    threshold: 1,
    severity: 'high',
    note: 'Territory is contested — control is being fought over rather than held.',
  },
  {
    id: 'crime-flow',
    name: 'Crime Flow',
    signal: 'community.meanCrime',
    comparator: 'above',
    threshold: 40,
    severity: 'high',
    note: 'Crime across communities is high enough to suppress safety and employment.',
  },
  {
    id: 'transportation-flow',
    name: 'Transportation Flow',
    signal: 'population.migrationRiskCount',
    comparator: 'atLeast',
    threshold: 1,
    severity: 'moderate',
    // Honest about its own limit rather than implying more than exists.
    note: 'People are at risk of moving. There are no trade routes or transport network in this '
      + 'engine yet, so this flow reports pressure to move and nothing carries anyone.',
  },
];

// ---------------------------------------------------------------------------
// resolveFlows() — ONE loop, for every flow, forever
// ---------------------------------------------------------------------------
// The templates a world runs are `worldState.flowTemplates` when that
// array exists, and the ten above otherwise. That is what makes a flow
// addable as data: put a row in the array, and it runs.
// **Additive, with per-id override — not wholesale replacement.**
//
// The first version replaced the ten as soon as `flowTemplates` had a
// single row in it, which meant `POST /api/flows` with one flow
// silently switched off the other ten. Nothing warned; the flow list
// just got shorter. Caught by a route test where "add a flow" and "the
// ten named flows are present" could not both be true.
//
// The ten are not defaults waiting to be overridden — they are named in
// the architecture document and are part of what this system IS. So a
// world's own templates are added to them, and a template sharing an id
// with a built-in replaces that ONE, which is the override anybody
// actually wants.
function listFlowTemplates(worldState) {
  const custom = Array.isArray(worldState.flowTemplates) ? worldState.flowTemplates : [];
  if (!custom.length) return FLOW_TEMPLATES;

  const overridden = new Set(custom.map((t) => t && t.id));
  return [...FLOW_TEMPLATES.filter((t) => !overridden.has(t.id)), ...custom];
}

function validateTemplate(template) {
  if (!template || !template.id) throw new Error('a flow template needs an id.');
  if (!SIGNALS[template.signal]) {
    throw new Error(
      `flow "${template.id}": "${template.signal}" is not a signal this engine reads `
      + `(one of: ${Object.keys(SIGNALS).join(', ')}).`,
    );
  }
  if (!COMPARATORS[template.comparator]) {
    throw new Error(
      `flow "${template.id}": "${template.comparator}" is not a comparator `
      + `(one of: ${Object.keys(COMPARATORS).join(', ')}).`,
    );
  }
  if (!Number.isFinite(Number(template.threshold))) {
    throw new Error(`flow "${template.id}": threshold must be a finite number.`);
  }
  return template;
}

// Read every template, fire the ones whose signal crosses. Returns
// events for the Event phase to record — it writes nothing itself.
function resolveFlows(worldState) {
  const events = [];

  for (const template of listFlowTemplates(worldState)) {
    validateTemplate(template);

    const value = SIGNALS[template.signal](worldState);
    // A signal with nothing to read does not fire. A world with no
    // families has not got low family unity; it has no families.
    if (value === null || value === undefined) continue;

    if (!COMPARATORS[template.comparator](value, Number(template.threshold))) continue;

    events.push({
      type: 'flow',
      severity: template.severity ?? 'low',
      note: `${template.name}: ${template.note ?? 'threshold crossed'}`,
      tick: worldState.tick,
      affected_entity_ids: [],
      global_effects: {
        flowId: template.id,
        flowName: template.name,
        signal: template.signal,
        value: Math.round(value * 100) / 100,
        comparator: template.comparator,
        threshold: Number(template.threshold),
        // A monotonic id so two firings of the same flow on different
        // ticks are distinguishable in a log.
        firing: nextFlowEventId++,
      },
    });
  }

  return events;
}

// What every flow would say about the world right now, fired or not —
// the read behind an inspection endpoint. Separate from resolveFlows so
// that looking at the flows cannot accidentally advance a counter.
function describeFlows(worldState) {
  return listFlowTemplates(worldState).map((template) => {
    validateTemplate(template);
    const value = SIGNALS[template.signal](worldState);
    return {
      id: template.id,
      name: template.name,
      signal: template.signal,
      comparator: template.comparator,
      threshold: Number(template.threshold),
      severity: template.severity ?? 'low',
      note: template.note ?? null,
      value: value === null ? null : Math.round(value * 100) / 100,
      firing: value === null
        ? false
        : COMPARATORS[template.comparator](value, Number(template.threshold)),
      // Distinguishes "not firing" from "cannot say" — the same
      // unknown-is-not-a-zero rule the frontend bars follow.
      readable: value !== null,
    };
  });
}

module.exports = {
  FLOW_TEMPLATES,
  SIGNALS,
  COMPARATORS,
  listFlowTemplates,
  validateTemplate,
  resolveFlows,
  describeFlows,
};
