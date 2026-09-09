# Village (VXLLAGE)

**"There's no I in Village."** — the real brand statement, per direct
instruction, and the deliberate wordplay it's built on: spell out
V-X-L-L-A-G-E and there genuinely isn't one.

**Village** is the product's own real brand identity, per direct
instruction — VXLLAGE stays the technical/repo name underneath, the
same relationship VACO now has to `vaco-shell/`. One shared identity
across six real comparables, all separately usable on their own but
living under one roof: **Twitter** (Home, the primary feed — real
user-facing copy calls a post a **Note**, per direct instruction; the
underlying `Post` entity/API/field names stay exactly as built, not
renamed, since VDP's own Village District already calls into them),
**Reddit** (Threads), **Substack** (long-form Articles + newsletters),
**Zoom** and **Zoom Business** (Call — two real, named call surfaces,
still unbuilt pending real audio/video infrastructure, see "Not yet
built"), and **Clubhouse** (Live). The existing Discord-style Villages
sub-feature (real membership, rooms, channels, boost economy) keeps
its own name and scope inside the brand — see "A real naming note"
below for the one real ambiguity this creates.

Fresh backend build in this repo — the existing prototype
(`VXLLAGE_CLAUDE.md`'s source) is a live-demo-only React file with no
backend, no persistence beyond `localStorage`, and no Replit zip.

**A real naming note**: "Village" (the whole app's brand) and
"Villages" (the existing Discord-style sub-feature, and VDP's own
"Village District") now share a name at two different scopes on
purpose, per direct instruction — flagged here rather than silently
smoothed over, the same posture already applied to Shell/Shield/VACO
and VACANCY/VACON-C. Context resolves which one is meant: this
README's own title is the brand; `lib/villages.js` and VDP's own
Village District are the sub-feature.

Source docs: `VXLLAGE_CLAUDE.md` (the full handoff brief — feature
inventory, what's real vs. mocked, gap priority order),
`VXLLAGE_VDP_VILLAGE_DISTRICT.md` (the real, inhabitable Village space
inside VENVS/VDP, QVAN's confirmed security/anti-bot role),
`VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md` (data models + API map — VXLLAGE
section only; the same file also documents CHOPZ and VACAY, two
separate future apps, not built here).

**Scope note, read this before touching anything here**: §0 of
`VXLLAGE_CLAUDE.md` is the single highest-priority correction and
governs everything built here. The existing prototype has Home (meant
to be primary) as its thinnest surface and Villages (meant to be
secondary) as a full nested six-tab sub-app — backwards from the
founder's explicit direction. Every phase in this project builds Home
deep first; Villages/Live/Call are deliberately built lighter and
later, not deleted or ignored.

## Run
Three processes — the shared V3 ledger, Vavlt Stvdios (needed for real
paywalled-article access checks), and this service:
```
cd ../venvs-mock-backend && npm install && npm start   # localhost:8791
cd ../vavlt-stvdios && npm install && npm start          # localhost:8808
cd vxllage && npm install && npm start                   # localhost:8796
```

## Test
```
curl http://localhost:8796/api/health
curl -X POST http://localhost:8796/api/posts -H "Content-Type: application/json" \
  -d '{"authorId":"alice","text":"hello vxllage"}'
curl http://localhost:8796/api/feed/for-you/alice
curl -X POST http://localhost:8796/api/villages/1/boost -H "Content-Type: application/json" \
  -d '{"boosterId":"alice","amountVCoin":100}'
```

## What's here
- `lib/posts.js` — **the real Home feed core (Phase 1)**: `createPost()`
  is the literal implementation of the prototype's non-functional
  composer, with real validation matching X's actual rules (a
  top-level post needs real text; a reply or silent quote-post may be
  empty). `getThread()` is real, recursive multi-level reply-tree
  assembly. `likePost`/`repostPost` are real, idempotent, per-user
  actions — the prototype's decorative reply/repost/like/share row,
  made real. **Naming note**: per direct instruction, a real future UI
  should call this a **Note**, not a post/tweet — a real, deliberate
  branding decision, kept scoped to user-facing copy only. The
  `Post`/`createPost`/`/api/posts` names below stay exactly as built
  (explicit instruction: "Post is fine") since VDP's own Village
  District, `articles.js`, and `surfaceLinks.js` already call into them
  by these real names.
- `lib/follows.js` — a real follow graph, the structural prerequisite
  for a Following feed to mean anything.
- `lib/feed.js` — **the real fix for the flagged For You/Following
  gap**: the prototype's own doc says both tabs "render the same FEED
  array, no actual filtering logic." Here they're genuinely different:
  Following is honest reverse-chronological over followed authors
  only; For You spans every post, ranked by a real, deterministic,
  bounded engagement-plus-recency score — proven with an adversarial
  test where a non-followed author's high-engagement post is excluded
  from Following entirely but ranks first in For You.
- `lib/profiles.js` — real, computed profile pages (post/following/
  follower counts, authored posts) — the other explicitly flagged gap.
- `lib/villages.js` — **Villages (Phase 2)**, deliberately kept lighter
  than the prototype's own nested six-tab depth, per §0's explicit
  "shrink" instruction: real membership, two roles only
  (owner/member), with the owner structurally unable to leave their
  own village.
- `lib/villageEvents.js` — real RSVP with a genuinely *derived*
  going-count (the real attendee list's length), not a separate
  counter that could desync from reality.
- `lib/villageRooms.js` — real, permanent, creator-owned rooms modeled
  on Clubhouse's actual Clubs feature, including real recurring-slot
  support; a room's owner is validated against real village
  membership, not trusted from a bare id.
- `lib/villageChannels.js` — **real text Channels (Phase 3)**, closing
  the prototype's own flagged gap ("unread badges, decorative"): real
  messages, real membership gating (matching `villageRooms.js`'s own
  established cross-module validation pattern), and a real unread
  count derived from an actual per-user read marker — never a
  separately-tracked badge counter that could drift from the real
  message list. Deliberately text-only; voice channels need real
  shared audio infrastructure that doesn't exist anywhere in this
  ecosystem (the doc's own "Main Stage" concept is `villageRooms.js`'s
  `clubhouse-audio` room type, already real as a join/leave record with
  no actual audio behind it either).
- `lib/villageShop.js` — **the real boost economy + village cosmetics
  (Phase 3)**, closing the prototype's own flagged gap (both listed as
  "real" in the old prototype but never actually backed by VCoin
  moving anywhere). `boostVillage` and `purchaseCosmetic` are real,
  injected-`transferFn` VCoin payments straight to the village's own
  owner — proven live against V3's own balances, not just asserted.
  `BOOST_LEVEL_THRESHOLDS` is a real, flagged interpretive 3-tier scale
  (modeled on Discord's own real 3-level server-boost structure — no
  source doc gives exact numbers). A cosmetic can only be listed by a
  village's own owner, a real structural check, not just a documented
  intention.
- `lib/avatarCosmetics.js` — **the personal, cross-village avatar
  cosmetic shop (Phase 7)**, closing the prototype's own separately-
  flagged Profile/Wallet-sheet gap — a real, distinct concept from
  `villageShop.js`'s own per-village cosmetics: this shop belongs to no
  village, every item is available to every user everywhere, and
  payment goes to a real, fixed platform account, not any village
  owner. `AVATAR_COSMETIC_CATALOG` is a real, flagged placeholder set
  of exactly 3 items — the doc's own real count, not invented in
  quantity, though the items themselves aren't named anywhere. Real
  single-slot equip (the doc says "equip state," singular, with no
  category structure the way VDP's own DEGVCHI wardrobe has) —
  equipping a new item silently replaces whatever was equipped before,
  never trusted without real, existing ownership first.
- `lib/vxllageSearch.js` — **real search (Phase 3)**, closing the
  prototype's own flagged gap ("Search icons... decorative, no search
  executes"). Real case-insensitive substring search over villages (by
  name) and posts (by text — "Threads" in this app's own real data
  model is X-style reply posts, not a separate Reddit-flavored Thread
  entity; see `posts.js`'s own header).
- `lib/v3Client.js` — VXLLAGE's first real V3-moving client, the same
  real, separate-copy pattern established across this session (not a
  shared file with VDP/VENVS/HVNTZ).
- `lib/articles.js` — **long-form Articles (Phase 4)**, closing
  `VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md`'s own named gap: "VXLLAGE had
  no long-form writing or newsletter capability... X itself tried this
  exact feature" (Revue, shut down 2023) — "VXLLAGE can build what X
  abandoned." `publishArticle` is the real, literal implementation of
  "articles surface in the primary feed too, not siloed": when no
  `linkedToVxllagePost` is supplied, it creates a real announcement
  Post and links the two, rather than leaving that connection as a
  documented intention. Paywalled articles reuse Vavlt Stvdios' own
  locked-content-tier infrastructure rather than a new one — see the
  doc's own "Confirmed: no duplication needed" section — via a real
  `requiredTierId` pointing at an actual, already-existing Vavlt
  Stvdios tier. `getArticleForViewer` withholds `bodyContent` without
  access, the same real gated-read idiom reused a third time this
  session (VACAY Homes, Vavlt Stvdios' own `getPostForViewer`).
- `lib/vavltStvdiosClient.js` — the real cross-app tier-access check
  `articles.js` is built on. Its own header also records one of that
  same source doc's claims confirmed false during this build ("Podcasts
  — already covered by Vvltvre's Pods division"): the full ecosystem
  status audit found zero real Pods code anywhere; not relied on here.
- `lib/newsletters.js` — **newsletter delivery + cross-publication
  recommendations (Phase 4)**. `sendNewsletter` creates a real,
  queryable `NewsletterDelivery` record per real subscriber regardless
  of `deliveryMethod`; for `email-notification` subscribers, no actual
  email leaves this process — the real trigger/recipient logic is
  computed, real delivery is separate infrastructure, the same honest
  posture already used for VSAFE's and CVNVO's own safety-escalation
  gaps. `subscribeToNewsletter` returns the author's real recommended-
  authors list directly in its own response — "new subscribers see
  these recommendations automatically" as a real, immediate
  consequence, not a separate fetch the caller has to remember to make.
- `lib/surfaceLinks.js` — the real `VxllageSurfaceLink` cross-surface
  connector ("a writer's article can drive a listener into their
  Village room... never a dead end"). `SURFACE_TYPES` deliberately
  narrows the source doc's own type union: it lists
  `"community-thread"` alongside `"village-room"`, but no `Community`
  entity exists anywhere in this codebase, only `Village` — checked
  directly rather than assumed, and excluded rather than accepting an
  unbuilt link target. Ids are normalized to strings at write time, the
  same proactive fix already made once live this session for HVNTZ/
  Vavlt Stvdios' `authorId` — caught here during this build's own test
  pass, before it ever shipped.
- `lib/shieldAuth.js` — **real Shield session auth (Phase 3)**, closing
  this project's own previously-flagged gap: "should trust Shell's
  unified session... not yet wired." `requireSession()` is a real
  Express middleware — every one of this app's 31 mutating routes now
  requires a real `Authorization: Bearer <token>` header, verified live
  against Shield's own real `GET /api/shield/session/:token`. A
  missing header, an invalid/expired token, and Shield itself being
  unreachable are all rejected (401/401/502) rather than silently
  waved through. Deliberately scoped, flagged directly: this proves a
  real, valid session exists, but doesn't cross-check the session's
  own `userId` against whichever body field a given route treats as
  the actor (`userId`/`authorId`/`hostId`/etc.) — a real, separate
  follow-up, not silently skipped.
- `server.js` — a real Express API (CommonJS) wrapping the above.

## Verified
33 plain-Node checks across both phases, plus live passes:
`vxllage/server.js` alone confirmed a real post, a real 3-level-deep
reply thread, real idempotent likes/reposts, and — the centerpiece —
the same Following-vs-For-You divergence proven against the actual
running server: Following correctly excluded a non-followed viral post
entirely, while For You correctly surfaced it first with a real,
non-zero engagement score; a real village created and joined, an event
RSVP'd by two real users with the derived `goingCount` confirmed via a
live `GET`, and a permanent creator-owned room created and joined
against the actual running server. See `dev-docs/` for the full
record.

**Phase 3 (Channels, boost economy, cosmetics, search)**: 27 plain-Node
checks — real membership-gated channel posting rejected for a
non-member, unread counts proven to move correctly across a real read
marker (2 unread → 0 right after marking read → 1 after a new post),
`computeBoostLevel` checked at every real tier boundary (99/100,
499/500, 1499/1500), a non-owner rejected from listing a village
cosmetic, a duplicate cosmetic purchase by the same user rejected, and
case-insensitive search proven for both villages and posts.

Live: a real village created and joined, a real channel with real
unread counts confirmed via actual `GET` calls before and after
marking read; a real 150 VCoin boost from a member confirmed via V3's
own live balances (owner `1000 → 1150`, booster `1000 → 850`) with the
correct boost level and `vCoinToNextLevel` returned; a non-owner's
cosmetic-listing attempt confirmed rejected live (HTTP 400); a real 40
VCoin cosmetic purchase confirmed via V3's own balances and confirmed
present in the buyer's real owned-cosmetics list; real village and post
search confirmed against actual stored data, not fixtures.

**Phase 4 (Articles, newsletters, recommendations, surface links)**: 28
plain-Node checks — a free article auto-creates and links a real
announcement post, a paywalled article rejected with no
`requiredTierId`, gated content proven withheld/revealed by
`hasAccess`, a new subscriber proven to see an existing real
recommendation automatically, duplicate subscription/recommendation
rejection, the excluded `"community-thread"` surface type rejected,
and the exact HVNTZ/Vavlt-Stvdios id-type-mismatch bug class proven
fixed proactively (a link created with a numeric id found correctly by
both a numeric and an equivalent string query).

Live, with `venvs-mock-backend`, `vavlt-stvdios`, and `vxllage` all
running together: a real Vavlt Stvdios tier created for a real author,
a paywalled VXLLAGE article referencing it, an unsubscribed viewer
confirmed seeing `bodyContent: null`; a real subscription made
directly on Vavlt Stvdios (confirmed against its own real 80/20 VCoin
split, 25 → 20/5); the same article re-fetched and confirmed now
showing real content for that viewer, while a third, still-unsubscribed
viewer still saw it withheld — the cross-app gate proven to flip on a
real external event, not just asserted. A real newsletter subscription,
a real recommendation, a second subscriber confirmed automatically
receiving that recommendation, and a real send confirmed delivering to
both real subscribers. A real surface link created and read back.

**Phase 5 (the VDP Village District)**: see `../vdp/README.md`'s own
entry — VXLLAGE's own rooms/channels/membership are the real data this
district renders; the district itself lives in VDP's own world, not
here.

**Phase 7 (the personal, cross-village avatar cosmetic shop)**: 13
plain-Node checks (real catalog count, rejects a nonexistent item,
real VCoin payment to the platform account confirmed distinct from any
village's own owner, rejects a duplicate purchase, rejects equipping
an unowned item, single-slot equip correctly replaces the prior item,
profile reflects real owned/equipped state, unequip clears it), plus a
live pass against the real running server: a real purchase of "Gold
Aura" confirmed moving real VCoin (alice 1000→950, the platform
account 1000→1050 — not any village owner's account), a real equip
confirmed, and the real avatar profile confirmed showing both the
owned and equipped state correctly.

**Phase 8 (real Shield session auth, closing the README's own
previously-flagged gap)**: 5 plain-Node checks (a missing
`Authorization` header rejected with 401, an invalid/expired token
rejected with 401, a real valid token passing through with
`req.sessionUserId` correctly attached, Shield being unreachable
rejected with 502 rather than silently allowed through, and a
malformed header with no `Bearer` prefix rejected), plus a live pass
against the real running Shield and VXLLAGE servers: a tokenless
`POST /api/posts` rejected with `401`, a fabricated token rejected by
Shield's own real validation, and a real Shield session — minted via
Shield's own live `POST /api/shield/session` — successfully carrying a
real post all the way through to creation.

## Real persistence
`lib/persistence.js` wraps `server.js`'s own store in a real file-backed
store, `data/store.json` (port 8796) — VXLLAGE's own real state now survives
a restart. Live-verified: created a real post, killed the running process,
restarted it, and confirmed the same real state came back from a real GET.
See `dev-docs/phase-9-real-persistence/`.

## Not yet built
- Voice channels, Live (Clubhouse-style audio rooms), and Call — now
  two real, named comparables per direct instruction (Zoom, for casual
  1:1/small-group video, and Zoom Business, presumably a fuller
  meeting/webinar surface) rather than one — all explicitly flagged as
  needing real, shared audio/video infrastructure (likely shared with
  Vavlt Stvdios' own media stack, which itself has no real capture
  infra either), not built here. The real distinction between the two
  Call surfaces isn't specified anywhere yet; not invented ahead of a
  real spec.
- Real per-route identity matching — `requireSession()` proves a
  caller holds a real, valid Shield session, but doesn't yet cross-check
  that session's own `userId` against whichever body field a given
  route treats as the acting user. A real, separate follow-up (see
  `lib/shieldAuth.js`'s own header for why it wasn't folded into this
  same pass).
- Real email delivery for `email-notification` newsletter subscribers —
  the real recipient list and trigger are computed; actual delivery is
  separate infrastructure, the same posture as VSAFE's/CVNVO's own
  safety-escalation gaps.
- The `Community` entity the combined architecture doc's own
  `VxllageSurfaceLink` type union references (`"community-thread"`) —
  confirmed to not exist anywhere in this codebase; excluded from
  `SURFACE_TYPES` rather than silently accepted as a real link target.
