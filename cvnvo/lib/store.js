// CVNVO -- shared, growing store object.
// Same pattern established across this session: one factory whose
// shape grows by adding new top-level array/counter fields as each
// phase adds a module.
// Yap's report state used to live here (`yapReports`/`nextYapReportId`)
// -- per explicit instruction it's been split out into its own
// standalone app (`yap/`, own store, own server/port), the same real
// split just applied to CHOPZ/CHOPZ SHOP.

function createCvnvoStore() {
  return {
    profiles: [],
    matches: [],
    nextMatchId: 1,
    safetyCheckIns: [],
    nextCheckInId: 1,
    callSessions: [],
    nextCallSessionId: 1,
    messages: [],
    nextMessageId: 1,
    // Phase 7 -- dating format extensions
    proximityEvents: [],
    nextProximityEventId: 1,
    flashNotes: [],
    nextFlashNoteId: 1,
    barBuddyCheckIns: [],
    nextBarBuddyCheckInId: 1,
    barBuddyVenues: [],
    speedDateSlots: [],
    nextSpeedDateSlotId: 1,
    giftDatingThresholds: [],
    giftDateRequests: [],
    nextGiftDateRequestId: 1,
    longDistancePins: [],
    dailyCuratedMatches: [],
    nextDailyCuratedMatchId: 1,
    closingDistanceRoadmaps: [],
    blindDateTokens: [],
    nextBlindDateTokenId: 1,
    blindDateSessions: [],
    nextBlindDateSessionId: 1,
    blindDateCancellationStreaks: [],
    locationSharingPreferences: [],
    sharedLocations: [],
    dateEvents: [],
    nextDateEventId: 1,
    dateEventRsvps: [],
    nextDateEventRsvpId: 1,
  };
}

module.exports = { createCvnvoStore };
