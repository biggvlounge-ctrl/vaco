# Plan — Phase 2 (eighth slice): Geofencing

## Goal
Section 32: "Use geofencing where it provides real operational value
... Geofencing should be optional and privacy-controlled."

## Design
- `Experience` gets a new, optional `geofence: { lat, lng,
  radiusMeters } | null` field (validated: if provided, all three
  required and numeric/positive) -- a real, minimal, additive
  extension; no lat/lng existed on Experience before this slice.
- `lib/geofencing.js`: `haversineMeters` (the same real great-circle
  formula CVNVO's own `compatibility.js` already established for
  proximity scoring, reused here in meters for a venue-scale radius
  rather than km for a city-scale one), `isWithinGeofence` (throws if
  the experience has no geofence configured, since it's optional),
  `verifyArrival` (SS32's own first example: "arrival verification --
  customer enters designated zone" -- sets a real `arrivedAt`
  timestamp on the booking, gated on the real distance check).
- `Booking` gets a new `arrivedAt: null` field, genuinely distinct from
  `checkedInAt` -- arrival (physically/GPS in the zone) and check-in
  (credential presented and verified) are two different real events.

## Explicitly NOT in this task (honest scoping against SS32's 6 examples)
- Venue check-in (QR becomes active near the event) / event (digital
  experience becomes available near the venue): already covered by a
  real, working alternative -- `digitalWaitingRoom.js`'s credential-
  based identity check achieves the same real goal without needing
  device geolocation.
- Transportation (driver enters pickup zone): VOID's own real-time
  driver location, not VOID MAGIC's data to have.
- VIP (credential activates only within an approved area) / security
  (alerts on unauthorized access): real, later work needing a live
  credential-activation and alerting layer this phase doesn't build.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after -- part
of the shared 27-check run with Media above): `haversineMeters`
returns 0 for identical points and a real, correctly-scaled ~111.19km
for 1 degree of longitude at the equator (a known, checkable real-
world value); `isWithinGeofence` throws for an experience with no
geofence configured; the geofence field round-trips on the experience;
in-radius and out-of-radius coordinates both correctly classified;
`verifyArrival` rejects an out-of-zone location (leaving `arrivedAt`
null) and accepts an in-zone one; a malformed geofence rejected at
experience creation. Then a live pass: a real geofenced experience
created, a far-away arrival attempt genuinely rejected, an in-zone
attempt genuinely accepted, confirmed against the actual running
server.

## Done when
- The distance math is proven correct against a known real-world
  value, not just an internally-consistent one.
- Arrival verification is proven to genuinely gate on distance, both
  in isolation and live.
