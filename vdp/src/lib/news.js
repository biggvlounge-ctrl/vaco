// VDP — Live World News feed.
//
// A server-side event log of things that already happened elsewhere:
// a job payout, a property purchase, a book's applied effect, a
// notable NPC decision, a chat message. Nothing here decides whether
// something happened or computes a new effect -- it only records a
// line about one that was already real, the same "aggregate, don't
// duplicate" discipline `population.js` and `MyAssetsView.jsx` follow.

export const MAX_NEWS_EVENTS = 100;

export function createNewsLog() {
  return { events: [], nextId: 1 };
}

export function recordEvent(log, { kind, text, at = Date.now() } = {}) {
  if (!kind) throw new Error('recordEvent requires a kind');
  if (!text) throw new Error('recordEvent requires text');
  const event = { id: log.nextId++, kind, text, at };
  log.events.push(event);
  if (log.events.length > MAX_NEWS_EVENTS) log.events.shift();
  return event;
}

// Newest first, capped to `limit`.
export function listNews(log, limit = 30) {
  const n = Math.max(0, Math.min(limit, MAX_NEWS_EVENTS));
  return log.events.slice(-n).reverse();
}
