# VOID — Walk-Up Hub Package Origination (v1)

Closes a gap: everything else covers **receiving** deliveries or
**remote app-initiated** requests. This covers a customer physically
bringing a package to a Hub in person and originating an outbound
delivery there — self-service kiosk or staff-assisted, same model as
walking into a FedEx Office or UPS Store.

**Flow**: customer arrives with package → self-service kiosk OR
staffed assistance → Gibson determines fulfillment method (drone/
driver/rideshare-style) using existing decision rules → customer gets
real-time tracking like any other VOID delivery.

```
HubOriginatedShipment {
  id, originHubId, customerId
  originationMethod: "self-service-kiosk" | "staff-assisted"
  packageWeight, packageDimensions, destinationAddress
  fulfillmentMethod: "drone" | "driver" | "rideshare-style"
  staffMemberId: string | null
}
```

**Why this matters**: a real distinct acquisition channel — people
without the app, people preferring in-person service, walk-in business
customers, oddly-shaped items, same-day urgent needs. Real precedent:
FedEx/UPS/USPS maintain retail counters alongside digital tools for
exactly this reason.

---

## Implementation status (added when this file was placed into the repo)

- **`HubOriginatedShipment`** — `lib/hubOrigination.js`, with both
  `ORIGINATION_METHODS` real and mutually validated: `staff-assisted`
  requires a `staffMemberId`, and `self-service-kiosk` rejects one
  rather than silently accepting a contradictory record.
- **Real code reuse, not a fourth parallel system**: origination
  creates an actual `courier` marketplace job through the existing
  `requestJob()`, the same pattern VOID Direct and the Moving/Real
  Estate Media verticals already use. Phase 12's regression
  specifically proved four different job-creation entry points
  (direct request, moving, real estate media, hub origination) never
  collide in the same `jobs` collection.
- **Gibson's decision** — `decideFulfillmentForShipment` reuses the
  existing `decideAirVsGround` rather than introducing a second,
  competing decision system.

**Honest deviation from this doc, flagged rather than faked**: the
`fulfillmentMethod` above names three options, but the real decision
logic built so far distinguishes only air vs. ground — so
`fulfillmentMethod` genuinely only ever resolves to `'drone'` or
`'driver'`. The third, `'rideshare-style'`, is not distinguishable
from `'driver'` by any real rule that exists in this codebase, so it
is not emitted. This is recorded in `lib/hubOrigination.js`'s own
header too. Building it for real would need a genuine rule separating
a dedicated courier from an opportunistic rideshare-style hand-off —
`lib/dispatchIntelligence.js`'s `recommendDeadTimeOpportunity` is the
closest existing hook if that gets specified later.
