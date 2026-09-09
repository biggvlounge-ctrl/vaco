# Tasks — Phase 3: Channels, Boost Economy, Cosmetics, Search

- [x] Investigate: read `villageRooms.js`/`villageEvents.js` directly
      for the real membership-validation and derived-count patterns
      this phase should match; read `VXLLAGE_CLAUDE.md`'s own
      prototype inventory for boost/cosmetics' real intended shape.
- [x] `lib/villageChannels.js` — `createChannel`, `getChannel`,
      `listChannelsForVillage`, `postChannelMessage` (membership-gated),
      `getChannelMessages`, `markChannelRead`/`getUnreadCount` (real
      derived unread count via a stored read marker).
- [x] `lib/villageShop.js` — `BOOST_LEVEL_THRESHOLDS`,
      `computeBoostLevel`, `boostVillage` (real VCoin transfer to the
      village owner), `getBoostStatus`, `createCosmeticItem`
      (owner-only), `listCosmeticsForVillage`, `purchaseCosmetic` (real
      VCoin transfer, duplicate-purchase guard),
      `getOwnedCosmeticsForUser`.
- [x] `lib/vxllageSearch.js` — `searchVillages`, `searchPosts`.
- [x] `lib/v3Client.js` — real `transferVCoin`, same separate-copy
      pattern as VDP/VENVS/HVNTZ.
- [x] `lib/store.js` — `villageChannels`/`nextChannelId`/
      `channelReadState`, `villageBoostContributions`/
      `nextBoostContributionId`, `villageCosmeticItems`/
      `nextCosmeticItemId`, `villageCosmeticOwnership`/
      `nextCosmeticOwnershipId`.
- [x] `server.js` — 14 new routes across channels/shop/search.
- [x] Verify in plain Node (27 checks, all clean): membership gating,
      unread-count correctness across a read marker and a new post,
      boost-level tier boundaries, non-owner cosmetic rejection,
      duplicate-purchase rejection, case-insensitive search over
      villages and posts.
- [x] Verify live against a running `vxllage` server + the real
      `venvs-mock-backend` V3 mock: a real channel with unread counts
      confirmed via actual `GET` calls before/after marking read; a
      real 150 VCoin boost confirmed via V3's own balances (owner
      1000→1150, booster 1000→850) with the correct boost level and
      `vCoinToNextLevel`; a non-owner cosmetic listing rejected live; a
      real 40 VCoin cosmetic purchase confirmed via V3's own balances
      and the buyer's real owned-cosmetics list; real village and post
      search confirmed against actual stored data.
- [x] Shut down all test servers; confirmed via port checks.
- [x] Update `README.md` (Run, Test, What's here, Verified, Not yet
      built).
- [x] Write this plan/tasks pair.

## Next
Long-form Articles/newsletter + the cross-publication recommendation
system (a separate, larger real slice). The VDP Village District
(cross-app wiring, same shape as Vavlt Stvdios' Stage integration).
Real auth wired to the now-real Shell.
