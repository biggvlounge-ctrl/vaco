# BarBuddy — Real-Time Bar/Venue Social Discovery for CVNVO (v1)

A real, distinct feature bringing the "BarBuddy" concept — real-time,
venue-specific social discovery — directly into CVNVO, connecting to
already-established systems rather than building something separate.

## The real, direct connection already established

**This is a specific, venue-focused version of CVNVO's already-
existing Happyn-style proximity dating format** — real-time matching
with people who are physically nearby right now. BarBuddy narrows
this to a specific real venue type: bars and nightlife locations
specifically.

## The core mechanic

Users check into a specific real bar/venue, and see other real,
currently-checked-in users at that same location right now — genuine,
live social discovery tied to an actual physical place, not a general
radius-based search.

```
BarBuddyCheckIn {
  userId, venueId
  checkedInAt: timestamp
  isVisibleToOthersAtVenue: boolean  // real, user-controlled privacy
                                        // toggle
}

BarBuddyVenue {
  venueId  // ties directly to a real HVNTZ-partnered bar/venue
  currentCheckedInUsers: [string]
}
```

## Direct fit with already-established systems

**HVNTZ**: the actual bar is a real, physical HVNTZ business — this
feature drives real foot traffic and check-ins directly to
HVNTZ-partnered venues, the same real business-benefit logic already
established elsewhere.

**VSAFE**: nightlife/bar settings already connect to VSAFE's real
safety features — the "been drinking, need a ride" prompt and the
Safety Service Program already established for alcohol-serving
venues apply directly here too.

**VOID**: real rideshare integration for getting to and from the
venue, the same real rideshare hotspot mechanic already established.

## Status
Ready for Claude Code — a real, distinct CVNVO feature, built as a
venue-specific application of the already-established Happyn-style
proximity matching, directly connected to HVNTZ, VSAFE, and VOID
rather than as a standalone system.

---

## Implementation status (added when this file was placed into the repo)

**Built, and built where this document said it belonged** — inside
`cvnvo/lib/proximity.js` rather than as a separate module. That
placement follows this document's own central argument: BarBuddy is
"a specific, venue-focused version of CVNVO's already-existing
Happn-style proximity dating format." Since it is a narrowing of the
same mechanic, it shares the module rather than duplicating it.

Both data models are real:

- `BarBuddyCheckIn` → `store.barBuddyCheckIns`, with `userId`,
  `venueId`, `checkedInAt`, `isVisibleToOthersAtVenue`, plus a
  `checkedOutAt` this document did not specify but which a check-in
  needs to be meaningful.
- `BarBuddyVenue` → `getOrCreateVenue()`, with
  `currentCheckedInUsers` maintained on check-in and check-out.

Real routes: `POST /api/barbuddy/check-in`, `POST
/api/barbuddy/check-out`, plus visibility control and a
visible-users-at-venue query.

**One deliberate departure from the spec, in the safer direction.**
`isVisibleToOthersAtVenue` defaults to **`false`**. This document's
model lists the field without stating a default, and the obvious
reading of "users check into a venue and see other checked-in users"
is that visibility is the point. It was still made opt-in, on the
reasoning recorded in the module: becoming visible to strangers in a
bar should require an explicit action, not happen because someone
checked in. Worth surfacing here rather than leaving buried — it
changes the feature's default behavior from what this document
implies.

**The HVNTZ tie is now live, and this is a gap that closed itself.**
When BarBuddy was built, `proximity.js` recorded an honest boundary:
HVNTZ had no `GET /api/business/:id` route, so `venueId` was
caller-declared and unvalidated. That route now exists, and the
validation path was written ready for it —
`checkInAtVenue(verifyAgainstHvntz, hvntzFetchFn)` is wired live in
`server.js`, which passes a real `fetchBusiness` client. A verified
venue records the real HVNTZ business name.

The stale comment was corrected when this file was placed. Validation
remains **opt-in per check-in** on purpose: making it mandatory would
mean every BarBuddy check-in fails whenever HVNTZ is unreachable,
turning a social feature into a hard dependency on another service's
uptime. The venue link is a signal, not money — same posture used for
VACA verification signals elsewhere.

**The three ecosystem ties, honestly rated:**

| Tie | Status |
|---|---|
| **HVNTZ** — venue is a real business | **Real**, opt-in, live |
| **VSAFE** — nightlife safety, "been drinking, need a ride" | **Real** — CVNVO calls VSAFE's check-in API; `vsafeExtras.js` adds fake-call and screen-time features |
| **VOID** — rides to and from the venue | **Real** — `attachVoidRideData()` on the safety check-in |

**Not built:** nothing in this document. It is the rare one that
shipped complete, with the only divergences being a safer default and
a boundary that has since resolved.
