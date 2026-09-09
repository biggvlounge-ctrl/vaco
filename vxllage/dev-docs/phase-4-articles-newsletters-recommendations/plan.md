# Plan — Phase 4: Articles, Newsletters, Cross-Publication Recommendations

## Goal
Close VXLLAGE's remaining named content gap: long-form Articles,
newsletter delivery, and the cross-publication recommendation system —
the Substack-style layer `VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md` names
directly, real X history included ("Twitter acquired the real
newsletter platform Revue in January 2021, then shut it down in
2023... VXLLAGE can build what X abandoned").

## Real investigation before any code
Read the doc's own "Confirmed: no duplication needed for Substack's
other real features" section directly before designing anything, since
it names real infrastructure this phase should reuse rather than
rebuild: paid subscriptions via Vavlt Stvdios' own locked-content-tier
system specifically. Checked that claim, and its neighbors, against
the actual codebase rather than trusting them wholesale: "Video —
already covered by Vavlt Stvdios" is real (Reels exist). "Podcasts —
already covered by Vvltvre's Pods division" is false — the full
ecosystem status audit already confirmed zero real Pods code anywhere.
Flagged directly in `vavltStvdiosClient.js`'s own header rather than
silently trusted.

Also read `posts.js`'s own header directly before scoping
`VxllageSurfaceLink`: the doc's own type union includes
`"community-thread"`, but this codebase has no `Community` entity,
only `Village` (the doc's own earlier "shrink" correction already
established this). Excluded from `SURFACE_TYPES` rather than accepted.

## Design
- `publishArticle` creates a real linked Post when none is supplied —
  the literal implementation of "articles surface in the primary feed
  too, not siloed," not left as a caller's responsibility.
- A paywalled article requires a real `requiredTierId`, the same idiom
  Vavlt Stvdios' own `Post` model already uses for gating — no new
  subscription shape invented, per the doc's own explicit instruction
  to reuse that infrastructure.
- `vavltStvdiosClient.js`'s `checkTierAccess` derives real access from
  `GET /api/tiers/:id`'s own real `subscribers` array — Vavlt Stvdios
  has no dedicated "check access" endpoint, but that field is the same
  real data its own server-side `canAccessLockedContent` checks.
- `sendNewsletter` records a real delivery per subscriber regardless of
  method; `email-notification` doesn't actually send email — flagged
  identically to VSAFE's/CVNVO's own "trigger computed, delivery
  separate" gaps, not glossed over.
- `surfaceLinks.js` normalizes ids to strings at write time —
  proactively applied before this ever shipped, having already found
  the identical bug class live once this session (HVNTZ's numeric
  `businessId` vs. Vavlt Stvdios' string-keyed `authorId` lookups).

## Explicitly NOT in this task
Real email/SMTP delivery infrastructure. The `Community` entity (not
built anywhere, excluded rather than half-implemented). Rebuilding any
subscription/billing logic Vavlt Stvdios already owns.

## Verification approach
Plain-Node pass (28 checks): auto-linked feed posts, paywall
validation, gated-content reveal via a directly-supplied `hasAccess`,
automatic recommendation surfacing on subscribe, duplicate rejections,
the excluded surface type, and the id-normalization fix proven via a
numeric-vs-string lookup pair. Live pass with `venvs-mock-backend`,
`vavlt-stvdios`, and `vxllage` all running together: a real Vavlt
Stvdios tier, a paywalled VXLLAGE article referencing it, access
proven to flip from withheld to revealed after a real subscription
made directly on Vavlt Stvdios (confirmed against its own real 80/20
split) — the actual cross-app gate exercised end to end, not mocked on
either side.

## Done when
- Articles, newsletters, and recommendations are real, tested, and the
  paywall gate is live-verified against a real, separate Vavlt Stvdios
  server, not simulated.
- The one false claim found in the source doc (Pods) is flagged, not
  silently relied on.
