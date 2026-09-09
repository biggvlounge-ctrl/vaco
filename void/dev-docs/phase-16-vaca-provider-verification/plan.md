# Plan — Phase 16: real VACA provider-verification signal

## Goal
Give VACA (the ecosystem's identity/authenticity layer) a third real
caller. Its own README noted only 2 existed anywhere in the ecosystem
(VOKEN's card value score, CVNVO's profile `verifiedBadge`) out of
25+ apps that could plausibly use it. VOID -- a marketplace connecting
customers with real-world service providers -- is a natural,
well-motivated fit: knowing whether a matched provider's identity has
actually been verified is exactly the kind of trust signal a real
marketplace surfaces.

## Design
`POST /api/job/:id/match` (`server.js`) makes a real, live call to
VACA's own `GET /api/identity-status/void-provider/:providerId` right
after the existing, unchanged `matchProvider` succeeds, and caches the
real result as `job.providerVerified` -- fetched once at match time,
not re-fetched on every later `GET /api/job/:id` read (same posture as
CHOPZ's own `linkedProductVerified`, a stable-once-set fact rather
than a live-changing signal like CVNVO's Yap report counts).

**Deliberately additive, not a gate**: VOID never required driver
identity verification before this, and this doesn't retroactively
require it -- an unverified provider can still be matched and complete
real jobs. Blocking unverified providers would have broken the
already-built, already-verified VDP VOID district demo (`VoidView.jsx`
uses a static `void-demo-provider` id that's never been VACA-verified)
along with any other real, already-tested flow using an unverified
provider. Fails soft (`null`) if VACA is unreachable, same reasoning
as CVNVO's own `fetchYapSignal`.

## Verification approach
Live, against real running V3/VACA/VOID servers, all three real cases:
an unverified provider matched -- confirmed `providerVerified: false`;
a provider given a real, VACA-approved identity verification first --
confirmed `providerVerified: true`; VACA's own process killed mid-test
-- confirmed the match still succeeds with `providerVerified: null`,
not blocked or errored. Then, specifically, re-ran the exact match
VDP's own `VoidView.jsx` demo performs (`void-demo-provider`,
never verified) and confirmed it still matches successfully --
proving this change is genuinely non-breaking, not just claimed to be.

## Done when
A VOID job shows a real, live-sourced signal for whether its matched
provider's identity has been verified, without that check ever being
able to block a match from happening.
