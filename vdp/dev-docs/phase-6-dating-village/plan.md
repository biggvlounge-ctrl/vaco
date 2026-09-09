# Plan — Phase 6: The Dating Village

## Goal
Wire CVNVO's own real presence into VDP's walkable world as "a real
place to walk into with your avatar, not just a link-out card," per
`CVNVO_DATING_COMPARABLES.md`'s own "Dating Village inside VDP"
section, following the same real pattern already established for
VXLLAGE's own Village District (Phase 5).

## Real investigation before any code
Read the Dating Village's own source section directly: it explicitly
cites "the same pattern already established for VXLLAGE's Village" as
its precedent. Unlike the Village District's own doc (which cited VAGO's
Resort & Casino as a precedent and was found false — VAGO has no
district anywhere in `world.js`, confirmed by grep, and its own README
confirms its casino world isn't built), this citation was checked
directly and confirmed **true**: VXLLAGE's own Village District is
real, built, and live-verified in this same file (Phase 5). This
district is a genuine second instance of a real, proven pattern, not
an unverified copy.

Also checked whether CVNVO has anything shaped like VXLLAGE's own
"rooms" concept (channels/audio rooms) that a second interior map
would need to represent. It does not — CVNVO's own data model has no
sub-space concept. What it does have, already built and real, is
BarBuddy (`cvnvo/lib/proximity.js`): a venue-check-in mechanic already
exactly shaped like "walk into a real place, see who else is really
there right now." Building a second nested interior map to match
Village District's own shape would not be proportionate to what CVNVO
actually has to offer; using BarBuddy directly is.

## Design
- A real 8th district cell (not a redesign of the existing 7) — same
  260x260 grid cell shape as Village District, placed at row 3, column
  3 (x:580, y:580); `WORLD_WIDTH`/`WORLD_HEIGHT` already had room for
  this from Phase 5's own 3rd-row growth.
- `cvnvoClient.js` — a real, thin HTTP client into CVNVO's own running
  server, same posture as `vxllageClient.js`/`vavltStvdiosClient.js`.
- `datingVillage.js`'s `enterDatingVillage` is idempotent (the "already
  checked in" response on a repeat visit is expected and swallowed),
  and — the one genuinely new piece of logic beyond a bare check-in —
  records a real proximity crossing with every other real,
  currently-visible checked-in player at the same venue, using one
  real, fixed, shared coordinate for the whole district (the St.
  Louis-area anchor this session already established for Cahokia
  Mounds/HVNTZ), since "closeness" inside VDP's own pixel grid has no
  real GPS meaning of its own.
- `isVisibleToOthersAtVenue` defaults to `true` here specifically — a
  deliberate divergence from BarBuddy's own general trust-first `false`
  default, reasoned directly in `datingVillage.js`'s own header:
  walking a VDP avatar into a dedicated district is itself already a
  deliberate, visible act, unlike a background real-world phone
  check-in.
- `DatingVillageView.jsx` renders who's really checked in right now, a
  real FlashNote form (no match required), and the player's own real
  crossing feed; unmounting (leaving the district) triggers a real,
  best-effort checkout.

## Explicitly NOT in this task
The other seven CVNVO dating-format extensions (Speed Dating,
Long-Distance Mode, Blind Date, Group Dating, Gift Dating, Snap Map
location sharing, Hunts Dates) — Phase 7 in CVNVO's own dev-docs built
these as real APIs, but none get a VDP-district surface here; that's
future scope, not part of closing this specific gap. Real multiplayer/
multi-user testing inside a single live browser pass — VDP's own login
is hardcoded to a single `"demo-user"`, a real, pre-existing constraint
carried over from every earlier phase, not introduced here.

## Verification approach
`npm run build` confirmed clean after each edit. A live Playwright pass
against `venvs-mock-backend` + `vaca` + `cvnvo` + `vdp` all running
together, with a real second user ("carol") pre-seeded via a direct
call to CVNVO's own `/api/barbuddy/check-in` endpoint (exactly what a
second real player's own `enterDatingVillage` call would have done,
substituting for the untestable second live browser session): walk to
the real 8th district, enter it (proving `enterDatingVillage`'s live
check-in actually ran), confirm the pre-seeded second user appears in
"Here right now," confirm a real proximity crossing with her was
recorded and rendered, send a real FlashNote and independently confirm
it landed via a direct server-side read of CVNVO's own API.

## Done when
- Walking into the Dating Village shows a real, live BarBuddy check-in
  sourced from CVNVO's own real data, with real proximity crossings and
  a real FlashNote flow, verified end to end against real running
  servers.
- The real, checked-true precedent citation and the real,
  content-shape deviation from Village District (one venue, not a
  second interior map) are both documented, not silently decided.
