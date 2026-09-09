# Plan — Phase 11: Hub Walk-Up Origination + Apartment/University Locker Network + Locker-to-Door

## Goal
The last two of the eight follow-up VOID docs. Closes the driver-
personnel dependency (resolved in Phase 8) into real, callable flows,
and resolves the `VoidLocker`-vs-`VoidStation` shape question flagged
during document review with a deliberate, documented decision.

## Design
- `lib/hubOrigination.js`: `originateShipmentAtHub()` — the third,
  distinct delivery flow (alongside receiving and remote/app-initiated)
  per the source doc's own framing, real comparable FedEx Office/UPS
  Store/USPS retail counters. Creates a real underlying `courier`
  marketplace job (code reuse, same pattern as VOID Direct and the
  Phase 10 verticals). `decideFulfillmentForShipment()` reuses Gibson's
  existing air-vs-ground rule rather than inventing a new three-way
  decision — honestly flagged that the source doc's third
  "rideshare-style" option isn't actually distinguishable with the
  real decision logic built so far, so `fulfillmentMethod` only ever
  resolves to `'drone'` or `'driver'`.
- `lib/voidLocker.js`: `VoidLocker` kept as its **own entity**,
  optionally linked to a `stationId` — the deliberate resolution of the
  shape ambiguity the source doc itself left open (describing
  `VoidLocker` as its own struct while also saying its tech choice
  "maps onto" `VoidStation`'s fields). A locker can exist at a pure
  apartment lobby with no drone Port capability at all, so merging it
  into `VoidStation` would have been the wrong call. `depositPackage()`
  implements real best-fit compartment selection (smallest available
  compartment that still fits), not just the first free one — proven
  by escalating to `medium` once `small` is taken.
- `lib/lockerToDoor.js`: implements the source doc's security
  requirement exactly — `requestLockerToDoor()` generates a real,
  separate, single-use `driverAccessCode` (never the customer's own
  identity/credential), with a real, enforced expiry
  (`ACCESS_CODE_VALID_HOURS = 2`, flagged interpretive). The full
  state machine (`requested → driver-assigned → retrieved → delivered`)
  is enforced at every step, and `retrieveWithDriverAccess()` genuinely
  rejects both a wrong code and an expired one before ever freeing the
  compartment.
- `server.js`: 16 new endpoints.

## Explicitly NOT in this task
- No real kiosk hardware/UI simulation — `originationMethod` is a
  validated field, not an interactive kiosk flow.
- No real PMS API integration (Yardi/Entrata/etc.) — `propertyManagementSoftware`
  records the integration target, matching the same stance already
  taken on other named-but-unreachable third-party integrations
  (Square/Toast in HVNTZ).
- No real notification delivery (SMS/push) when a driver access code
  is generated — the code exists and is enforced, but nothing "sends"
  it anywhere in this session.

## Verification approach
Plain-Node pass first (throwaway `.cjs`, deleted after — 19 checks,
all passed clean on first run). The Locker-to-Door security flow is
checked exhaustively, not just the happy path: retrieval is confirmed
to reject before a driver is assigned, reject a wrong code, and reject
an expired code, before finally confirmed to succeed with the real
code before expiry. Then a live pass: `void/server.js` running alone
— a full walk-up shipment, a real deposit/best-fit compartment
selection, and the complete Locker-to-Door lifecycle (request → early-
retrieve-rejected → assign → wrong-code-rejected → real-code-succeeds
→ compartment independently confirmed freed → complete) all through
the actual HTTP API.

## Done when
- `originateShipmentAtHub` enforces the origination-method/staff-member
  pairing correctly in both directions and creates a real courier job.
- `decideFulfillmentForShipment` correctly reuses the existing
  air-vs-ground rule.
- `registerLocker`/`depositPackage`/`retrievePackage` validate
  correctly, select real best-fit compartments, and enforce recipient
  matching on retrieval.
- The full Locker-to-Door state machine and security checks (wrong
  code, expired code, wrong status) are all independently verified to
  reject, with only the correct sequence succeeding.
- Live: every flow above confirmed through the real HTTP API, with the
  freed compartment independently re-fetched to confirm, not just
  trusted from the retrieval response.
