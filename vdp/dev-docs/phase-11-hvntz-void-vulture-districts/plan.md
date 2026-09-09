# Plan — Phase 11: HVNTZ, VOID, Vvltvre Music/Pods/Flix districts

## Goal
Close the largest remaining piece of the "only 3 apps have any UI"
usability gap: HVNTZ, VOID, and all three Vvltvre apps had zero UI
anywhere, their Shell tiles opening bare JSON. Extend VDP's own
`-embed` pattern (VEX/VADO/Stage/Village/Dating-Village/VAGO/VACAY) to
all five, following the same "thin client, no business logic in VDP"
shape every prior district used.

## Design
Five new districts, five new thin clients
(`hvntzClient.js`/`voidClient.js`/`vultureMusicClient.js`/
`vulturePodsClient.js`/`vultureFlixClient.js`), five new View
components, each demoing one real, coherent, already-tested flow
scoped from each app's own real routes -- not everything each app can
do, one real end-to-end loop:
- **HVNTZ**: the original core mechanic -- register a business +
  location, create a sponsored hunt, add a checkpoint, check in for a
  real VCoin bounty. Uses the Gateway Arch's own real coordinates
  (38.6247, -90.1848), matching `hunts.js`'s own seeded-demo
  precedent.
- **VOID**: the real request -> match -> accept -> complete -> pay ->
  rate loop every one of VOID's 18+ verticals runs through, demoed via
  the Courier vertical (real, non-licensing-gated).
- **Vvltvre Music**: submit a release (real distribution fee) -> take
  it live (submitted -> distributing -> live) -> report streaming
  revenue -> real payout landing in the artist's own summary.
- **Vvltvre Pods**: create a show -> publish an episode (a real
  cross-app call from Pods into Music -- both services genuinely
  running) -> listen (free) -> subscribe to a paid tier.
- **Vvltvre Flix**: acquire an exclusive title (real acquisition
  payout) -> mark it streaming -> subscribe -> watch (real
  subscription-gate check) -> start/end a real stream session
  (respecting the real per-tier concurrent-stream limit).

World layout: filled the remaining two open slots in the existing 4th
row (`hvntz` at x:20, `void` at x:580, alongside the existing `vacay`
at x:300), then a new 5th row for the three Vvltvre divisions
(`WORLD_HEIGHT` grown 1140 -> 1420, same precedent as every earlier row
growth in this file).

## Verification approach
`vite build` first (clean compile, no import errors), then one real
Playwright browser pass against all 8 real running servers (VDP, V3,
Shield, HVNTZ, VOID, Vvltvre Music, Vvltvre Pods, Vvltvre Flix): walked
to and entered all 5 new districts in one continuous session, drove
each real flow to completion, and confirmed the real numbers coming
back -- a real 10 VCoin HVNTZ bounty, a real VOID payout that sums
exactly (9.6 + 2.4 = 12), a real 40.01 VCoin Vvltvre Music net payout,
a real Pods episode published via a live cross-app call into Music, and
a real Flix stream session started and ended under the standard tier's
real concurrency limit.

## Done when
All 5 apps are reachable and genuinely usable through VDP's own
walkable world, each exercising a real, complete, money-moving loop
against that app's own live server -- not a mock, not a stub.
