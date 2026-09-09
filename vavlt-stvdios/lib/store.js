// VAVLT STVDIOS -- shared, growing store object.
// Same pattern established across this session: one factory whose
// shape grows by adding new top-level array/counter fields as each
// phase adds a module.

function createVavltStvdiosStore() {
  return {
    channels: [],
    nextChannelId: 1,
    channelGroups: [],
    nextChannelGroupId: 1,
    channelChats: [],
    nextChannelChatId: 1,
    channelTips: [],
    nextChannelTipId: 1,
    // Phase 2 -- IG content layer
    posts: [],
    nextPostId: 1,
    highlights: [],
    nextHighlightId: 1,
    follows: [],
    nextFollowId: 1,
    notes: [],
    nextNoteId: 1,
    lockedContentTiers: [],
    nextTierId: 1,
    mapSearchListings: [],
    nextMapListingId: 1,
    profileCards: [],
    nextProfileCardId: 1,
    // Phase 3 -- up to 8 interactive screens
    screenSessions: [],
    nextScreenSessionId: 1,
    // Phase 5 -- real long-form video (VOD)
    videos: [],
    nextVideoId: 1,
    // Phase 6 -- real referral/growth mechanic
    referrals: [],
    nextReferralId: 1,
    referralGrowth: [],
    spins: [],
    nextSpinId: 1,
    // Phase 7 -- real minimal casino streaming events slice
    casinoEvents: [],
    nextCasinoEventId: 1,
    casinoEventAttendees: [],
    nextCasinoEventAttendeeId: 1,
  };
}

module.exports = { createVavltStvdiosStore };
