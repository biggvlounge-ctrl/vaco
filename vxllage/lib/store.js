// VXLLAGE -- shared, growing store object.
// Same pattern established across this session (world-layer/venvs/
// hvntz/void/voken/vago): one factory whose shape grows by adding new
// top-level array/counter fields as each phase adds a module.

function createVxllageStore() {
  return {
    posts: [],
    nextPostId: 1,
    follows: [], // [{ followerId, followeeId }]
    villages: [],
    nextVillageId: 1,
    villageEvents: [],
    nextVillageEventId: 1,
    villageRooms: [],
    nextVillageRoomId: 1,
    // Phase 3 -- real text Channels, boost economy, village cosmetics, search
    villageChannels: [],
    nextChannelId: 1,
    channelReadState: new Map(), // `${channelId}:${userId}` -> lastReadMessageId
    villageBoostContributions: [],
    nextBoostContributionId: 1,
    villageCosmeticItems: [],
    nextCosmeticItemId: 1,
    villageCosmeticOwnership: [],
    nextCosmeticOwnershipId: 1,
    // Phase 7 -- the personal, cross-village avatar cosmetic shop
    avatarCosmeticOwnership: [],
    nextAvatarCosmeticOwnershipId: 1,
    avatarEquippedCosmetic: [],
    // Phase 4 -- Articles, newsletters, cross-publication recommendations, surface links
    articles: [],
    nextArticleId: 1,
    newsletterSubscriptions: [],
    nextNewsletterSubscriptionId: 1,
    newsletterDeliveries: [],
    nextNewsletterDeliveryId: 1,
    crossPublicationRecommendations: [],
    surfaceLinks: [],
    nextSurfaceLinkId: 1,
  };
}

module.exports = { createVxllageStore };
