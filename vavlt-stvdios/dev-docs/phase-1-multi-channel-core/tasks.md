# Tasks — Phase 1: Multi-Channel Core

- [x] Investigate: confirm Vavlt Stvdios has no real code anywhere
      despite 20+ narrative references; confirm VAGO's own visual
      casino world and VDP's own casino district don't exist either.
      Report back before writing code.
- [x] `lib/channels.js` — reconciled `GROUPING_TYPES` (3 values),
      `createChannelGroup`/`getChannelGroup`, `createChannel` (the
      groupingType/groupingBasis guard, auto-created chat, two-way
      group linkage), `getChannel`, `listChannelsInGroup`,
      `listLiveChannels`, `goLive`/`endStream`.
- [x] `lib/channelChat.js` — `getChannelChat`, `postMessage`,
      `getMessages`.
- [x] `lib/channelTips.js` — `tipChannel` (real per-person payout),
      `getTipsForChannel`, `getTotalTipsForPerson`.
- [x] `lib/store.js`, `server.js`, `package.json`, `.gitignore`.
- [x] `npm install`.
- [x] Verify in plain Node (17 checks): grouping enum, location- and
      role-based groups, the mismatch guard, a groupless channel, the
      live lifecycle, per-channel chat independence, tips proven to
      pay the person via transfer-call arguments, the doorman
      per-person total, rejection cases.
- [x] Verify live against `venvs-mock-backend`'s real running V3
      ledger: a club group + 2 channels created, one taken live, a
      chat message posted, a real tip to the doorman confirmed via
      V3's own balance, the club's own account confirmed unchanged.
- [x] Shut down test server; confirmed via port check.
- [x] Save the three source docs into the project.
- [x] Write `README.md`, this plan/tasks pair.

## Next
Phase 2: the Instagram-style content layer (`Post`,
`LockedContentTier`, `MapSearchListing`, Stories/Reels/Explore/Notes/
Profile Cards) and HVNTZ integration. Phase 3: the VENVS/VAGO casino
broadcast layer, once both this app's own video infrastructure and
VAGO's own visual casino world exist.
