// VOKEN — real card engagement tracking.
// Source of truth: VOKEN_NEW_VALUE_ALGORITHM.md's digital-native
// factors: "real, live view counts on the card, click-through rate,
// comment volume, and likes/reactions -- tracked continuously, not a
// one-time snapshot." This is the real event log that
// `valueAlgorithm.js`'s `computeDigitalEngagementScore()` (Phase 1)
// actually consumes -- that function was built first and takes raw
// counts as input; this module is what produces real counts instead
// of a caller having to supply invented numbers.

const ENGAGEMENT_TYPES = ['view', 'click', 'comment', 'like'];
const DEFAULT_VELOCITY_WINDOW_MINUTES = 60;

function recordEngagementEvent(store, options = {}) {
  const { cardId, type, now = Date.now() } = options;
  if (!cardId) throw new Error('recordEngagementEvent requires a cardId');
  if (!ENGAGEMENT_TYPES.includes(type)) {
    throw new Error(`recordEngagementEvent: invalid type "${type}" (expected one of ${ENGAGEMENT_TYPES.join(', ')})`);
  }
  const event = { cardId, type, timestamp: now };
  store.cardEngagementEvents.push(event);
  return event;
}

// Real totals plus a real velocity signal: events of any type in the
// last `velocityWindowMinutes`, expressed as a per-minute rate --
// feeds directly into valueAlgorithm.js's real, capped velocity bonus
// rather than a caller inventing that number.
function computeEngagementStats(store, options = {}) {
  const { cardId, now = Date.now(), velocityWindowMinutes = DEFAULT_VELOCITY_WINDOW_MINUTES } = options;
  if (!cardId) throw new Error('computeEngagementStats requires a cardId');

  const events = store.cardEngagementEvents.filter((e) => e.cardId === cardId);
  const counts = { views: 0, clicks: 0, comments: 0, likes: 0 };
  const typeToField = { view: 'views', click: 'clicks', comment: 'comments', like: 'likes' };
  for (const event of events) {
    counts[typeToField[event.type]] += 1;
  }

  const windowMs = velocityWindowMinutes * 60 * 1000;
  const recentCount = events.filter((e) => now - e.timestamp <= windowMs).length;
  const engagementVelocity = Math.round((recentCount / velocityWindowMinutes) * 100) / 100;

  return { cardId, ...counts, engagementVelocity };
}

module.exports = { ENGAGEMENT_TYPES, DEFAULT_VELOCITY_WINDOW_MINUTES, recordEngagementEvent, computeEngagementStats };
