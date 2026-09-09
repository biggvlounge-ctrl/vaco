# Tasks — Phase 7: All Eight Dating-Format Extensions

- [x] Investigate: read all four source docs in full; confirm live via
      `hvntz/server.js` which cross-app venue/hunt lookups are real
      (hunt: yes, business: no) before designing BarBuddy/Hunts Dates.
- [x] `lib/proximity.js` — Happn crossings (real Haversine, 250m
      radius), FlashNotes, BarBuddy check-in/check-out/visibility with
      a real trust-first default.
- [x] `lib/speedDating.js` — `SpeedDateSlot` (Speed Dating + Group
      Dating, one entity), verified-badge gate, one-time extension,
      real round-robin rotation generator.
- [x] `lib/giftDating.js` — real threshold set/get, real VCoin-gated
      date requests.
- [x] `lib/longDistance.js` — Bumble Travel-style pins, a real daily-
      rate-limited curated match, a real 4-stage closing-distance
      roadmap.
- [x] `lib/blindDate.js` — real token purchase/gate, deterministic
      (non-AI) assignment creating a real `Match`, message-count-gated
      reveal, real 2-strike cancellation block.
- [x] `lib/dateEvents.js` — real 3-tier Snap Map privacy, real
      location-radius search, `DateEvent` with a real derived
      attendee count, live HVNTZ hunt-link validation.
- [x] `lib/store.js` — 20 new fields across all six modules.
- [x] `server.js` — `transferVCoin`/`fetchHunt` clients, ~35 new
      routes, health endpoint extended with the 3 new real enums.
- [x] Verify in plain Node (47 checks, all clean on first full run):
      every validation/rejection path across all six modules, the
      round-robin's real pairing uniqueness, the derived attendee
      count, the daily-match rate limit, the roadmap's real terminal-
      stage guard, the full blind-date token/reveal/cancellation
      sequence.
- [x] Verify live against `vaca` + `venvs-mock-backend` + `hvntz` +
      `cvnvo` all running together: real proximity crossing recorded/
      rejected; a `DateEvent` linked to a real HVNTZ hunt with the
      real returned title confirmed; a real 60 VCoin gift request
      confirmed via V3's own balances; a real blind-date token
      purchase confirmed via V3, reveal rejected at 0/3 messages then
      accepted at 3/3; all three location-privacy tiers confirmed
      live; an unverified speed-date participant rejected live.
- [x] Shut down all four test servers; confirmed via port checks.
- [x] Update `README.md` (Run, Test, What's here, Verified, Not yet
      built).
- [x] Write this plan/tasks pair.

## Next
BarBuddy's own live HVNTZ venue validation, once HVNTZ adds a real
business lookup route. Real video/audio behind Speed Dating's
all-facetime format and BarBuddy's video calling, once real media
infrastructure exists anywhere in this ecosystem. Kevin/VPLAN, the VDP
Dating Village, and VSAFE's own still-unbuilt Photo Check-ins/Fake
Call/Screen Time remain CVNVO's only other named gaps.
