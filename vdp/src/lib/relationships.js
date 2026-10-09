// VDP — pairwise relationships.
//
// Deliberately NOT VACON-C's `households.js`/family-cohesion sheet —
// that's a civilization-scale system (unity/conflict, lineage,
// inheritance) and this is the smaller, VDP-themed borrow the earlier
// NPC plan already committed to: one `affinity` number per pair
// (player-NPC, player-player, or NPC-NPC), hysteresis-gated into a
// label the same way `npcs.js` gates a goal open/closed rather than
// flickering on every tick.
//
// Feeds Dating Village's existing UI as a real, moving number instead
// of a placeholder, and is the one place conversation outcomes and
// shared activity (working the same shift, visiting a district
// together) actually land.

export const LABEL_THRESHOLDS = [
  { min: 80, label: 'close' },
  { min: 50, label: 'friend' },
  { min: 20, label: 'acquaintance' },
  { min: -Infinity, label: 'stranger' },
];

export const AFFINITY_MIN = -100;
export const AFFINITY_MAX = 100;
export const CONVERSATION_AFFINITY_DELTA = 3;
export const SHARED_ACTIVITY_AFFINITY_DELTA = 1;

// **Shared culture/religion/origin (9 Oct 2026), per direct
// instruction**: "culture, religion, and location of where they're
// coming from also will play a big part... this is how, as their type
// of people migrate, that is how these relationships will be formed."
// A real, flagged interpretive multiplier -- no document gives VDP a
// real number for how much more two people with the same real
// background click, so this reuses the same restraint every other
// unspecified figure in this directory already stands on.
// `shareBackground` reads the plain demographic fields
// (`demographics.js`'s own shape) directly -- not imported, since any
// two objects with these three field names already qualify, the same
// way `pairKey` works on any two ids without needing to know where
// they came from.
export const SHARED_BACKGROUND_MULTIPLIER = 1.5;

export function shareBackground(demoA, demoB) {
  if (!demoA || !demoB) return false;
  return Boolean(
    (demoA.culture && demoA.culture === demoB.culture)
    || (demoA.religion && demoA.religion === demoB.religion)
    || (demoA.originRegion && demoA.originRegion === demoB.originRegion),
  );
}

// **Cultural bias/racism (9 Oct 2026, a later direct instruction)**:
// "as people are put into the towers, you'll have all different type
// of people from all over the globe. They have their own culture, so
// some people will have bias, racism, cultural bias, cultural
// differences." The honest, named counterpart to
// `SHARED_BACKGROUND_MULTIPLIER` above -- that comment's own
// parenthetical ("not built yet, but not precluded") is exactly this.
// A DIFFERENT background amplifies a hostile exchange the same way a
// shared one amplifies a warm one -- real friction, not flavor text.
// Not scoped to The Towers specifically: the instruction names Towers
// as WHY this matters most (forced-proximity housing mixes the most
// different backgrounds, the same relocation mechanism that fills it
// doesn't filter by culture at all), but the mechanic itself is
// general, the same way `shareBackground` already is.
//
// "Some people" (not everyone, every time) is why this is a real,
// flagged-interpretive CHANCE rolled per hostile exchange between two
// people of different backgrounds, not a deterministic penalty on
// every one -- the same "a real tendency, not an absolute rule" shape
// `immigration.js`'s own `ELITE_ASYLUM_HOUSING_CHANCE` already uses
// for the same reason. `rollBiasIncident` is pure, decided once by
// the caller before `recordConversation` is called, the same way
// `shareBackground` itself already is -- not a game-design constant
// leaked into every call site.
export const DIFFERENT_BACKGROUND_BIAS_MULTIPLIER = 1.5;
export const BIAS_INCIDENT_CHANCE = 0.3; // interpretive -- no document gives a real rate

export function rollBiasIncident({ demoA, demoB, positive = true, rng = Math.random } = {}) {
  if (positive) return false; // bias shows up in HOSTILE exchanges, not warm ones
  if (!demoA || !demoB) return false;
  if (shareBackground(demoA, demoB)) return false;
  return rng() < BIAS_INCIDENT_CHANCE;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// Order-independent key, same convention as `npcs.js`'s own
// `frictionKey` — a pair is the same relationship regardless of which
// side is asking about it.
export function pairKey(aId, bId) {
  if (aId === bId) {
    throw new Error('relationships: a person has no relationship with themselves');
  }
  return String(aId) < String(bId) ? `${aId}:${bId}` : `${bId}:${aId}`;
}

export function createRelationships() {
  return {};
}

export function labelFor(affinity) {
  return LABEL_THRESHOLDS.find((t) => affinity >= t.min).label;
}

export function getRelationship(relationships, aId, bId) {
  const affinity = relationships[pairKey(aId, bId)] || 0;
  return { affinity, label: labelFor(affinity) };
}

function adjust(relationships, aId, bId, delta) {
  const key = pairKey(aId, bId);
  const next = clamp((relationships[key] || 0) + delta, AFFINITY_MIN, AFFINITY_MAX);
  relationships[key] = next;
  return { affinity: next, label: labelFor(next) };
}

// A conversation moves affinity more than passive shared activity
// does — talking to someone is a deliberate act, standing in the same
// district is not. `positive` lets a hostile exchange subtract
// instead of add. `sharedBackground` (optional, default `false` --
// every existing caller's behavior is unchanged) scales the real
// delta by `SHARED_BACKGROUND_MULTIPLIER`. `biasIncident` is its
// honest opposite -- the caller decides it via `rollBiasIncident`
// above, same as `sharedBackground` is decided via `shareBackground`
// -- and scales a hostile exchange by `DIFFERENT_BACKGROUND_BIAS_
// MULTIPLIER` instead. The two are mutually exclusive by construction
// (`rollBiasIncident` already returns `false` whenever `shareBackground`
// is true), so only one multiplier ever actually applies.
export function recordConversation(relationships, aId, bId, {
  positive = true, sharedBackground = false, biasIncident = false,
} = {}) {
  const base = positive ? CONVERSATION_AFFINITY_DELTA : -CONVERSATION_AFFINITY_DELTA;
  let multiplier = 1;
  if (sharedBackground) multiplier = SHARED_BACKGROUND_MULTIPLIER;
  else if (biasIncident) multiplier = DIFFERENT_BACKGROUND_BIAS_MULTIPLIER;
  return { ...adjust(relationships, aId, bId, base * multiplier), biasIncident };
}

export function recordSharedActivity(relationships, aId, bId, { sharedBackground = false } = {}) {
  const base = SHARED_ACTIVITY_AFFINITY_DELTA;
  return adjust(relationships, aId, bId, sharedBackground ? base * SHARED_BACKGROUND_MULTIPLIER : base);
}

export function listRelationshipsFor(relationships, personId) {
  const id = String(personId);
  return Object.entries(relationships)
    .filter(([key]) => key.split(':').includes(id))
    .map(([key, affinity]) => {
      const [a, b] = key.split(':');
      const otherId = a === id ? b : a;
      return { otherId, affinity, label: labelFor(affinity) };
    });
}
