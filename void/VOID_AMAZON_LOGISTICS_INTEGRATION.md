# VOID — Amazon Logistics Integration (v1)

Amazon's two-tier driver model: **Amazon Flex** (matches VOID's
existing gig model — 1099 contractors, reserve blocks, own vehicle,
$18-25/hr equivalent, handles overflow/peak demand) vs. **Amazon DSP**
(the tier VOID doesn't have — independent small businesses running
branded fleets with W-2 drivers, fixed routes, hourly wage +
benefits).

**Correction**: real bar to APPLY for DSP is **$30,000** liquid cash/
savings (not $10,000 — that's the potential minimum operating cost
once approved).

**Important limitation**: Amazon's DSP program does not accept
company/group applications — only individuals. VOID cannot directly
tap Amazon's DSP network. The "VOID DSP" tier should be VOID's own
independent structure modeled on Amazon's approach, not an actual
integration.

Realistic path already built into VOID: **VOID Direct** (white-label
delivery API) modeled on DoorDash Drive/Uber Direct — direct
business-level contracts, not gated behind individual-only
application. Soliciting HVNTZ-onboarded businesses directly is the
faster bootstrapping move.

**Recommendation**: add a "VOID DSP" tier alongside existing gig
drivers.

```
VoidDSP {
  id, operatorBusinessId, driverIds: [driverId], vehicleFleetIds:
  [vehicleId], assignedRoutes: [routeId], startupCapitalRequired: 30000
}
```

Three additional adoptable pieces:
1. Delivery-station intermediate layer worth confirming against VOID's
   existing Hub Network.
2. Real failed-delivery protocol — driver calls customer, automatic
   retry next day.
3. Even Amazon, at ~70% self-sufficiency, still shares overflow with
   FedEx/UPS/USPS — VOID doesn't need full self-sufficiency either.

---

## Implementation status (added when this file was placed into the repo)

This document shaped real code well before the file itself was saved
here — it was cited by name in `lib/driverFleet.js` and
`lib/marketplace.js` for some time while the file was missing from the
repo entirely. Placed now so the citations resolve. What's real:

- **VOID DSP tier** — `lib/driverFleet.js`: `registerVoidDSP`,
  `addDriverToDSP`, `addVehicleToDSP`, `assignRouteToDSP`, with
  `DSP_STARTUP_CAPITAL_REQUIRED = 30000` (the corrected figure above,
  not $10,000) and the individual-applicant-only limitation recorded
  in that module's own header as the reason this is VOID's own
  structure rather than a real Amazon integration.
- **Failed-delivery protocol** — `lib/marketplace.js`:
  `reportFailedDelivery` / `retryDelivery` with
  `RETRY_DELAY_HOURS = 24` ("the next day"), plus
  `sweepFailedDeliveries` and a real in-process interval in
  `server.js` that actually fires eligible retries.
- **Delivery-station intermediate layer** — confirmed against the
  existing Hub Network rather than duplicated: `lib/stations.js`
  (`STATION_TYPES = ['port', 'hub-and-port']`).
- **Gig tier** — `registerGigDriver`, unchanged, matching Flex.

Not built: real driver onboarding/background checks/W-2 payroll, and
overflow hand-off to third-party carriers (point 3 above) — no real
carrier integration exists to hand off to.
