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
// district is not. `positive` lets a hostile exchange (not built yet,
// but not precluded) subtract instead of add.
export function recordConversation(relationships, aId, bId, { positive = true } = {}) {
  return adjust(relationships, aId, bId, positive ? CONVERSATION_AFFINITY_DELTA : -CONVERSATION_AFFINITY_DELTA);
}

export function recordSharedActivity(relationships, aId, bId) {
  return adjust(relationships, aId, bId, SHARED_ACTIVITY_AFFINITY_DELTA);
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
