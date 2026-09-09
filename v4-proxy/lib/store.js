// V4 -- in-memory store for agent call sessions.
//
// **Deliberately not persisted, unlike every other app in this
// ecosystem.** Every sibling app pairs its store with a
// `lib/persistence.js` that flushes to disk. This one does not, and
// that is a decision rather than an omission: a call session is
// meaningful only while it is happening. A `ringing` call restored
// from disk after a restart is ringing at nobody, and a `connected`
// call restored from disk is connected to nothing. Reloading them
// would produce a store full of sessions that look live and are not.
//
// What genuinely should outlive a restart is the *text fallback
// message* a missed call produces -- that is a real artifact a user
// expects to still be there. It is kept here today because there is
// no messaging store to hand it to yet; when one exists, fallback
// messages belong in it, not here. Flagged rather than silently
// treated as durable.

export function createV4Store() {
  return {
    calls: [],
    nextCallId: 1,
    fallbackMessages: [],
    nextFallbackMessageId: 1,
    // V4 Maps -- the shared map layer four VACON agents already
    // reference. Places are registered by any app; sightings power
    // crossings (Kevin/CVNVO) and foot traffic (DREA/DREAMS).
    places: [],
    sightings: [],
  };
}
