# Plan — Phase 9: VAGO Casino + VACAY Experiences districts

## Goal
Close a real, checked-and-confirmed-false claim carried in `world.js`'s
own header since the Village District's own source doc: "VAGO's Resort
& Casino ... is a real walkable destination inside VDP." It never was.
Extend VDP's own real embed pattern (already used for VEX/VADO/Stage/
Village/Dating Village) to VAGO and VACAY, the two apps `world.js`
prioritized as the next real cross-app embeds.

## Design
Same shape as every prior `-embed` district: a thin client
(`vagoClient.js`/`vacayClient.js`, bare `fetch` wrappers over each
app's own real API, no game/booking logic in VDP), a `*View.jsx`
component (`useState`+`useCallback` refresh+`useEffect` mount+async
action handlers, modeled directly on `VadoView.jsx`), wired into
`WorldView.jsx`'s `contentType`/`id` switch, and a new `DISTRICTS`
entry in `world.js`.

**VAGO Casino** fills the one open grid slot the existing 3rd row had
left (`x:20,y:580`) -- no world growth needed. Real flow: start a
casino session + Mines round (`startCasinoSession`/`startMinesRound`),
reveal tiles (`revealMinesTile`), cash out (`cashOutMines`) -- all real
VAGO routes, all real VCoin movement through V3.

**VACAY Experiences** needed a new 4th row (`WORLD_HEIGHT` grown from
860 to 1140, same precedent as the earlier Village District row
growth). Deliberately scoped to VACAY's Experiences resource, not
Stays -- checked `vacay/lib/bookings/routes.js` directly first:
Experiences has a real browse-all route (`GET
/api/bookings/experiences` -> `discoverExperiences`), Stays does not
(only single-listing lookup by a known id). Real flow: host a demo
experience (`createExperience`), book it (`bookExperience`), cancel it
(`cancelExperienceBooking`) -- all real VACAY routes, real VCoin escrow
through V3, real capacity tracking.

## Real bug found and fixed during this build
`VacayView`'s `handleCancel` updated only local booking state, not the
experience list -- after a real cancel (which does restore
`remainingCapacity` server-side), the displayed capacity stayed stale
at the pre-cancel count. Fixed by calling `refresh()` after a
successful cancel too, not just after book. Caught by actually
watching the rendered capacity text before/after cancel in a real
browser pass, not by reading the code and assuming it worked.

## Verification approach
Ran all five real servers (VDP, VAGO, VACAY, V3, Shield) together,
drove a real Playwright browser: logged in, walked to each new
district, entered it, and exercised the real money-moving/state-moving
actions (Mines round start/reveal/cash-out; Experience host/book/
cancel) -- confirmed real numbers coming back (a real 11.25 VCoin Mines
payout, real capacity 6/6 -> 5/6 -> 6/6), and confirmed VACAY's own
double-booking guard surfaces as a real, honest UI error rather than
failing silently when a second demo-host action collided with existing
scheduled state.

## Done when
Both districts render real, live content backed by their own app's
real API, with a real verified round-trip (money/state actually moves
and is reflected back), matching the same bar every prior `-embed`
district in this project was held to.
