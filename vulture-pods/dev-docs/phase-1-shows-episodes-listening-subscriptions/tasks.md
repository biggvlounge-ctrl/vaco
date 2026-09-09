# Tasks — Phase 1: Shows, Episodes, Listening, Subscriptions

- [x] Investigate: grep every `.md` for "Pods"/"podcast"; confirm no
      dedicated spec doc exists; find `vulture-music`'s own real
      `podcast-episode` format and gamma. comparable to reuse.
- [x] Ask the user how to proceed given the missing spec (no source
      doc, unlike every other Vvltvre division built this session).
- [x] New app scaffold: `package.json`, `lib/store.js`, `server.js`.
- [x] `lib/shows.js` — `SHOW_CATEGORIES`, `createShow` (optional
      `subscriptionPriceVCoin`), `getShow`, `listShowsForCreator`,
      `listShowsByCategory`.
- [x] `lib/episodes.js` — `createEpisode` (validates
      `requiresSubscription` against the show's real tier),
      `getEpisode`, `listEpisodesForShow`, `publishEpisode` (real
      cross-app `distributeFn` injection point).
- [x] `lib/subscriptions.js` — `subscribeToShow` (real dual payout,
      `PLATFORM_TAKE_PERCENT = 0.10`), `cancelShowSubscription`,
      `isSubscribedToShow`, `listSubscriptionsForUser`.
- [x] `lib/listening.js` — `recordListen` (free by default, gated
      check for `requiresSubscription` episodes), `getListenHistory`,
      `getListenCount`.
- [x] `server.js` — real Express API; `distributeEpisodeViaVultureMusic`
      is the real, live HTTP client into `vulture-music`'s own
      `POST /api/releases`.
- [x] 10 plain-Node checks — all passing.
- [x] Live pass against `venvs-mock-backend` + `vulture-music` +
      `vulture-pods` all running independently: a real episode
      published, the real `4.99` distribution fee confirmed against
      V3, the resulting release independently confirmed on
      `vulture-music`'s own server; a free listen moving zero money; a
      real paid show's gated episode blocked then unlocked after a
      real subscription, the dual payout confirmed exactly, and the
      creator's balance confirmed composing correctly across both a
      publish fee and a subscription payout; double-publish,
      invalid-category, and free-show-subscription all rejected over
      real HTTP.
- [x] Shut down all test servers; confirmed via process list.
- [x] Write `README.md`.
- [x] Register in `vaco-shell/lib/registry.js` (port 8810).
- [x] Write this plan/tasks pair.

## Next
Real audio hosting, real ad-serving, RSS syndication, multiple
subscription tiers per show, and transcripts/chapters remain real,
flagged gaps.
