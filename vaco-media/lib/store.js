// VACO MEDIA — the store factory.
//
// Two collections, because this service answers two questions that
// happen to share a security model and nothing else:
//
//   sessions  live transport between named participants. VXLLAGE
//             rooms, CVNVO speed dates, Vavlt Stvdios screen walls,
//             V4 agent calls.
//   assets    recorded media somebody uploaded or produced. Vvltvre
//             Flix titles, Pods episodes, CHOPZ clips.
//
// They are in one service rather than two because the expensive,
// shared, hard-to-get-right part is identical for both: **who is
// allowed to receive a playable address, and for how long.** Splitting
// them would mean two token systems, and this ecosystem's most
// repeated lesson is that a second one of anything authorization-shaped
// is how the gap appears.

function createMediaStore() {
  return {
    sessions: [],
    nextSessionId: 1,

    // Per-participant grants into a session. Separate from the session
    // so a grant can be revoked without tearing down the room, and so
    // "who was in this call" survives the call ending.
    grants: [],
    nextGrantId: 1,

    // Lifecycle facts reported by the transport, not guessed by us:
    // joined, left, connection quality, recording started.
    events: [],
    nextEventId: 1,

    assets: [],
    nextAssetId: 1,
  };
}

module.exports = { createMediaStore };
