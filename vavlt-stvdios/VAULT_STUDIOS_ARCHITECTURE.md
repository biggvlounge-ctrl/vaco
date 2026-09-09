Channel {  // the core unit — one camera/feed = one channel, per the
           // established multi-channel architecture decision
  id, ownerId  // a business (via HVNTZ onboarding) or an individual creator
  groupingType: "same-location-multi-room" | "same-brand-multi-location"
  parentGroupId: string  // links sibling channels (e.g. 4 chairs in one
                          // barbershop, or 8 locations of one franchise)
  name, streamUrl, isLive: boolean
}

ChannelChat {
  id, channelId  // EVERY channel has its own independent chat, not
                 // one shared chat per business
  messages: [{ userId, text, timestamp }]
}

LockedContentTier {  // Patreon/OnlyFans-model, extended to business owners
  id, creatorId  // individual creator OR a business (HVNTZ-onboarded)
  tierName, priceVCoin, benefits: [string]
  subscribers: [userId]
}

Post {  // Instagram-style content layer
  id, authorId, mediaUrl, caption
  source: "vault-native" | "hvntz-checkin"  // HVNTZ photo-proof posts
    // route through here, tagged to the business/hunt profile
  isStory: boolean, storyExpiresAt: timestamp | null
  isLocked: boolean, requiredTierId: string | null
}

MapSearchListing {  // doubles as HVNTZ's Yelp-style business discovery
  id, businessId, lat, lng, category
}
