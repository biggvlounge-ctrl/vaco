// VDP — player beliefs.
//
// VACON-C's own `server/beliefs.js` names a belief as "a valenced
// position on a named topic," 0-100, across six real belief types —
// that shape is reused verbatim (same `BELIEF_TYPES`, same
// `MIN_STRENGTH`/`MAX_STRENGTH`) because it is exactly what a
// philosophy/influence book needs to move: reading *The Secret* or
// *The Bible* doesn't teach a skill the way a cooking textbook does,
// it nudges a named, measurable position.

export const BELIEF_TYPES = ['religious', 'philosophical', 'political', 'scientific', 'cultural', 'personal'];
export const MIN_STRENGTH = 0;
export const MAX_STRENGTH = 100;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function createBeliefs() {
  return {};
}

function beliefKey(topic, type) {
  return `${type}:${topic}`;
}

export function getBelief(beliefs, topic, type) {
  return beliefs[beliefKey(topic, type)] || 0;
}

export function shiftBelief(beliefs, topic, type, delta) {
  if (!BELIEF_TYPES.includes(type)) {
    throw new Error(`beliefs: "${type}" is not a known belief type (expected one of ${BELIEF_TYPES.join(', ')})`);
  }
  const key = beliefKey(topic, type);
  beliefs[key] = clamp((beliefs[key] || 0) + delta, MIN_STRENGTH, MAX_STRENGTH);
  return beliefs[key];
}

export function listBeliefs(beliefs) {
  return Object.entries(beliefs).map(([key, strength]) => {
    const [type, ...rest] = key.split(':');
    return { type, topic: rest.join(':'), strength };
  });
}
