# VACO — Project Completion Checklist

**This is the one, living checklist.** It supersedes the older
`COMPLETION_AUDIT.md` (dated 22 Aug, stale) for the purpose of
answering one question: **what is left before this goes to the deploy
engineer, and what can an agent still do about it?**

Every item below is numbered so it can be checked off by number in
future sessions, without re-deriving the whole picture from scratch.
A ✅ means verified against the running code in this pass, not
recalled from an older doc — this project's own standing lesson,
learned the hard way three times over, is that a doc's claim and the
code's truth drift apart fast, so trust the code, re-check the doc.

**Last updated:** 15 Oct 2026, this session (after the ground-truth
audit landed and its findings were fixed).

---

## Part 1 — Things Claude can do, and their current status

### 1.1 Core ecosystem build-out (prior sessions)
- [x] **1.** 36-app ecosystem running: real servers, real tests, real
      frontends, real shared design system, synced across all apps.
- [x] **2.** V3 ledger + idempotent settlement is the one money path
      every paying surface uses.
- [x] **3.** Shield is the single session authority; every app adopts
      the shared handoff.
- [x] **4.** Deploy artifacts (`docker-compose.yml`,
      `deploy/ecosystem.config.js`, nginx configs) regenerated from the
      live app manifest, drift-tested (`deploy-readme.test.mjs`).
- [x] **5.** `dev-docs/LAUNCH_ENGINEER_HANDOFF.md` written: the exact
      pm2+nginx sequence, costed, scoped to the one-time engagement.

### 1.2 VDP (game world) feature completion — all done, prior sessions
- [x] **6.** Combat sports wired (leaderboards, VAGO predictions).
- [x] **7.** Team sports (basketball/football) + standings wired.
- [x] **8.** Generic league-leader rankings mechanism + civilization/
      organization/business leaderboards.
- [x] **9.** Warehouse property type + export mechanic.
- [x] **10.** Water/fishing zone expansion.
- [x] **11.** World atlas seeded: 4 mainland countries + hidden
      civilizations, 4 casino islands, 4 pirate islands, 10 generic
      island countries + their own hidden civilizations.
- [x] **12.** "Meridian" placeholder lore fully retired and renamed
      throughout code, world data, and founding docs.
- [x] **13.** Discovery-arc mechanic, scarcity-driven inter-civilization
      trade, and per-civilization sports culture built.
- [x] **14.** VDP's own real settlement architecture (container villas
      for hidden civilizations vs. new-build villas for the four
      founding countries) documented in `VDP_FOUNDING.md`, cross-
      referenced to the real-world brand map rather than duplicating it.

### 1.3 Real-world business documentation (this session)
- [x] **15.** `dev-docs/VILLAGES_REAL_ESTATE_STRATEGY.md` — the real
      North County St. Louis / Jamestown Mall "Villages of..."
      strategy, VOID-hub infrastructure, screen density model, and the
      full §11 brand map (which real VACO app powers which part of a
      physical Village).
- [x] **16.** Villa (VXLLA) naming decided and implemented as the
      real, user-facing rename of VXLLAGE's "room" concept
      (`vxllage/public/index.html`, `vxllage/README.md`) — underlying
      `Room` entity/API/field names deliberately left untouched, same
      precedent as the existing Post→Note rename.

### 1.4 Real-time/VOD media wiring — the "six blocked surfaces," re-diagnosed and closed (this session)
The older dossiers (`GO_LIVE_DOSSIER.md`, `WHAT_THE_WORLD_IS_MISSING.md`,
`COMPLETION_BY_APP.md`) all named the same six surfaces as blocked on a
media vendor decision. Re-investigated one at a time rather than
trusted: **four were real VOD gaps and got real wiring; two were
mis-diagnosed and got a different, more accurate fix.**

- [x] **17.** Shared client-side helpers added once, synced everywhere:
      `VACO.resolvePlayback`/`VACO.mediaPlayer` (VOD: calls vaco-media's
      `POST /api/play`) and `VACO.resolveJoin`/`VACO.joinPanel` (live
      sessions: calls `POST /api/join`) in `vaco-shell/public/vaco-ui.js`,
      propagated to all 33 apps via `sync-design-system.sh`. Both render
      a real player/connected state, or the honest "nothing is
      stored/connected yet" note — never a placeholder.
- [x] **18.** **Vvltvre Flix** — real "Watch" button, live-smoke-tested
      end to end against a running vaco-media instance (asset register
      → attach storage → mark ready → grant playback → `/api/play`).
- [x] **19.** **Vvltvre Pods** — real "Play" button on each episode;
      `POST /api/episodes/:id/listen` now also resolves playback behind
      the existing subscription gate.
- [x] **20.** **Vavlt Stvdios** — has two separate media surfaces, and
      they needed two separate fixes. The *live* eight-screen wall
      (`kind: 'wall'`) is a live-session consumer, not VOD, so it needed
      the join contract: added the missing
      `GET /api/owners/:ownerId/channels` route (no way to even list
      which channels to bundle into a session) and a new "Sessions" tab
      — create a real session from 1-8 owned channels, join it, see the
      honest control-plane state. Actually connecting a feed is still
      vendor-blocked (below). Separately, the *on-demand Video*
      primitive (long-form, `lib/videos.js`) had a real, caller-supplied
      `mediaUrl` from day one but zero frontend anywhere — found in the
      ground-truth audit (§1.6) and fixed with a real Videos tab.
- [x] **21.** **CHOPZ** — added the missing `POST /chopz/videos/:id/play`
      grant route and a real "Play" button on each reel.
- [x] **22.** **VENVM** — re-diagnosed. It is not a VOD consumer; its
      own docs are explicit that it never produces pixels, so there was
      no asset to register. The real bug: the Scripts/Pipeline tabs had
      action buttons wired to `requireCallingService()`-only routes that
      no browser session could ever satisfy — a control that always
      fails, same category of problem as a placeholder video. Replaced
      with honest notices + working lookups, and the Pipeline tab now
      renders a job's real external `videoUrl` when one is genuinely
      supplied. Also added the missing consent-revoke UI.
- [x] **23.** **DREAMS** — re-diagnosed the same way. `creativeUrl` is
      an honestly-nullable, advertiser-supplied external address, not a
      first-party asset — nothing for vaco-media to register. The real
      gap was that the entire step-by-step self-serve campaign flow
      (already fully built and order-enforced server-side) had no
      frontend at all. Added the "New Campaign" tab: create → select
      screens → creative (upload or AI-generate) → budget → required
      incentive → launch.

### 1.5 Cross-app bugs found and fixed while verifying the above (this session)
- [x] **24.** **Idempotency-Key ByteString crash, 17 apps.** Every
      `settleVCoin`-style helper built its V3 idempotency header as
      `` `settle:${meta.reason}` ``, and `fetch()` throws on any header
      value outside Latin1/ByteString range. Any reason string with an
      em dash, curly quote, accented letter, or non-English name crashed
      the *entire settlement* — reproduced live via Vvltvre Pods
      publishing an episode whose auto-generated title contains exactly
      such a character. Fixed in all 17 identical copies
      (`encodeURIComponent` the reason before it goes in the header);
      the JSON body's own `reason` field is untouched. 734 tests re-run
      clean across all 17 apps after the fix.
- [x] **25.** **Vvltvre Pods never forwarded the caller's session to
      two downstream apps.** `distributeEpisodeViaVultureMusic` and
      `postVideoToVaultStvdios` built bare headers with no Authorization,
      so both of vulture-music's and vavlt-stvdios' `requireActor(...)`
      routes (session-only, no service-credential path) always 401'd on
      publish/attach-video. Fixed by forwarding the exact Bearer token
      `requireEpisodeShowCreator()` already verified belongs to the
      show's creator.

### 1.6 Ground-truth audit results (this session) — the older dossiers were stale, mostly in the good direction
A dedicated background pass independently re-verified every concrete
claim in `GO_LIVE_DOSSIER.md` and `WHAT_THE_WORLD_IS_MISSING.md` against
the running code — not recalled, re-measured. Headline: **both docs
understated how much was done, not overstated it.**
- [x] **26.** YAP's moderation queue — called "the single highest-
      liability gap in the ecosystem... a build not a hire" — was
      already fully built and tested (`cvnvo/yap/lib/moderation.js`,
      36/36 tests) before this session even started.
- [x] **27.** VACON-C's statistics catalogue is at 111/122 (91%)
      answered on a real generated world, not the dossier's stale
      57/67. Overall ecosystem criteria: 100% of 276 (not 260); total
      tests 2512 (not 1609) prior to this session's own additions.
- [x] **28.** Pricing table, take-rate constants, Postgres-backend
      count, and frontend count in `GO_LIVE_DOSSIER.md` §1a/§1b/§7a all
      independently re-verified exact and current — not stale, no
      action needed.
- [x] **29.** **The real remaining gap the audit found**: Vavlt
      Stvdios' on-demand Video primitive had a real, caller-supplied
      `mediaUrl` from day one but zero frontend rendering anywhere.
      Fixed — see §1.4 note on Vavlt Stvdios above, now updated to
      cover both the live wall AND the Video primitive.
- [x] **30.** **A real security bug found while fixing the above**:
      `getPostForViewer`/`getVideoForViewer` correctly withheld a
      locked post/video's real media address for single-item GET
      routes, but every LISTING route (feed, stories, reels, explore,
      author-posts, author-videos, video-feed) returned the raw,
      unfiltered store contents — so a locked Reel or Video's real
      address was visible to anyone calling the free public feed, with
      no subscription. Fixed in both `lib/posts.js` and `lib/videos.js`
      (`vavlt-stvdios`), with 4 new regression tests proving the leak
      and the fix.
- [x] **31.** YAP's moderation actions (publish/reject/remove) now
      page ops via vaco-notify — closes "moderators are blind to
      actions after the fact." Does **not** close "the subject/reporter
      themselves are told" — vaco-notify is an operator-paging channel
      with no per-end-user inbox concept, and the header comment in
      `lib/moderation.js` now says so precisely rather than overclaiming.
- [x] **32.** Fixed `dev-docs/MEDIA_INFRASTRUCTURE_DECISION.md`'s
      self-contradicting body (an "Update 2" note said three apps were
      wired while the table/Recommendation below still said they
      weren't) and `scripts/completion-report.mjs`'s hardcoded (not
      computed) stale narrative string — both now match current reality.

### 1.7 Noted, not attempted — a real gap, explicitly out of scope for this pass
- [ ] **33.** **No HTTP-level route tests in `cvnvo`, `hvntz`, `dreams`.**
      Every test in these three apps' suites calls lib functions
      directly rather than issuing a real HTTP request through the
      Express app (no `supertest` or equivalent anywhere in this
      codebase, in any app). The business logic itself is thoroughly
      tested; what's untested is the HTTP wiring layer — route
      registration, middleware order, body parsing. Real, agent-
      fixable, but a genuinely large, new undertaking (introducing a
      testing pattern + dependency that doesn't exist anywhere in this
      36-app ecosystem yet, across three apps' full route surfaces) —
      flagged here rather than attempted in the same pass as smaller,
      targeted fixes. Pick this up as its own dedicated session if it's
      worth doing before launch.

---

## Part 2 — What is left that only a human/engineer/business decision can close

These are not gaps in effort — they are gaps in something only money,
an account, a legal review, or a vendor choice can supply. No amount of
further coding closes them. This is the actual, final punch list for
the $1,600–5,200 engagement in `dev-docs/LAUNCH_ENGINEER_HANDOFF.md`,
plus the handful of decisions that sit above the engineer, with the
business owner.

### 2.1 The engineer's one job
- [ ] **34.** Run the pm2+nginx sequence in `LAUNCH_ENGINEER_HANDOFF.md`
      on a real VPS: generate secrets, start the process list, point
      nginx + a real domain + TLS at it, verify health checks. That is
      the entire scope of the paid engagement.

### 2.2 Decisions that sit with the business owner, before or alongside that
- [ ] **35.** **Real-time media vendor (LiveKit or equivalent).**
      Needed for: Vavlt Stvdios' live eight-screen wall, VXLLAGE
      Live/Call, CVNVO speed dating, V4 agent calls to actually carry
      audio/video. The control plane for all of these is real and
      tested today (sessions, grants, lifecycle); only the transport is
      unconfigured. Setting `VACO_MEDIA_TRANSPORT=livekit` + real
      LiveKit credentials is a config change, not a code change, once
      this is decided.
- [ ] **36.** **An object store (S3-compatible: AWS S3, MinIO,
      SeaweedFS, etc.) for VOD storage.** Needed for: Vvltvre Flix,
      Vvltvre Pods, CHOPZ to actually serve bytes instead of the honest
      "nothing stored yet" note. Setting `VACO_MEDIA_STORAGE=s3` + real
      bucket credentials is a config change, not a code change, once
      this is decided.
- [ ] **37.** **Compliance/moderation budget** ($95k–305k/yr per
      `GO_LIVE_DOSSIER.md` §2b/§4c) — not needed for a closed/beta
      rollout; needed before opening CVNVO/YAP-class features to the
      general public.
- [ ] **38.** **Actual video/image-generation infrastructure**
      (Seedance/Kling/Runway/Nerfstudio-class tools) for VENVM to
      produce real pixels instead of orchestrating a pipeline around a
      caller-supplied external render. Named by VENVM's own docs as a
      permanent ceiling for this environment, not a deferred task.
- [ ] **39.** **Villages real-estate acquisition itself** (the
      Jamestown Mall site, ~144 acres, and the ~20 total North County
      locations) — a real-world capital/legal transaction, not
      something any amount of code addresses. The software side (VOID
      hub wiring, VXLLAGE auto-enrollment, the brand map) is ready for
      it whenever it happens.

### 2.3 Lower-priority, genuinely optional at this tier
- [ ] **40.** Docker build-testing — the compose file is complete and
      validated but has never actually built an image anywhere (this
      sandbox's network policy blocks Docker Hub). Not needed if the
      engineer uses the recommended pm2+nginx path instead.
- [ ] **41.** TLS automation beyond a single certbot cert, and off-host
      backups at scale — real, tracked, genuinely optional for a
      closed/beta demo tier.
- [ ] **42.** VACON-C's 9 remaining declared statistic gaps (body
      composition, knowledge stock, informal economy share, resource
      stock, camera coverage, street lighting, private security
      presence, pollution, terrain/water) — none block a launch; the
      simulation already runs and answers 111 of 122 statistics on a
      real generated world. Each is declared with the measurement that
      closed the door on it, in `vacon-c/server/statistics.js` itself.

---

## How to use this file in a future session

1. Read this file first.
2. Anything still unchecked in **Part 1** is something an agent can
   attempt right now — pick it up.
3. Nothing in **Part 2** should be attempted by an agent — it is
   listed so the business owner can see the real, final list, not so
   it gets "solved" by a workaround that fakes the missing piece.
4. When an item moves from open to done, check it here in the same
   commit that does the work, not later — this file drifting from the
   code is the exact failure mode it exists to prevent.
