# VOID — Apartment / University Smart Locker Network (v1)

Extends VOID's Hub/Affiliate Network into residential/educational real
estate — distinct from HVNTZ business locations. Real, mature
industry: Parcel Pending by Quadient (18,000+ locations, 70-72M
packages/year), Luxer One, Smiota, Southwest Solutions Group. Market
projected to reach $6.7B by 2030. Average apartment resident receives
60+ packages/year; smart lockers improve resident satisfaction 15-25%.

**Required technical integration**: must integrate with real property
management software — Yardi, Entrata, AppFolio, RealPage, Buildium.
This is the actual bar for landing real apartment deals.

**Real system architecture**: physical locker + cloud OS + app/kiosk
interface. **Courier-agnostic** — any carrier can drop off, not locked
to VOID exclusively — this is what makes it a genuine amenity a
property manager wants, not a vendor lock-in sell.

**University-specific**: textbook pickup, library holds, anonymous
food security/meal distribution programs.

```
VoidLocker {
  id, locationType: "apartment" | "university" | "hvntz-business"
  propertyManagementSoftware: "yardi" | "entrata" | "appfolio" |
    "realpage" | "buildium" | null
  courierAgnostic: boolean
  compartments: [{ size, isOccupied, assignedRecipientId }]
  supportsFoodSecurityProgram: boolean
}
```

**Locker-to-door**: a new order type — a VOID driver retrieves the
parcel and completes final delivery to the customer's door. Security
design: driver uses a separate, temporary, single-use access grant,
**NOT** the customer's own reusable QR code.

```
LockerToDoorRequest {
  id, lockerId, compartmentId, customerId, assignedDriverId,
  driverAccessCode: string, driverAccessExpiresAt: timestamp,
  finalDeliveryAddress, status: "requested" | "driver-assigned" |
  "retrieved" | "delivered"
}
```

## Real hardware vendors

**DRONEDEK** — real patented top-loading drone delivery tech. Real
company: Dronedek Corporation, Indianapolis, founded 2019, CEO Dan
O'Toole. Manufacturing partnership with Bharat Electronics Limited.
$3M+ raised via crowdfunding. Package drops through top opening with
fold-out "funnel/parcel director" extensions. Confirmed pricing
(2021-2022, **verify current**): $3,000/unit, goal ~$1,000/unit at
scale. Subscription: free early adopters, then $15/month after
6-month trial. ~4ft tall, 2ft square, heated motorized door, real
safety sensors detect explosives/biohazards and auto-alert
authorities. First-ever USPS-approved smart mailbox delivery, first
drone-delivered fast food order, real pilot in Lawrence, Indiana.
**Note: may have rebranded to "Arrive" — confirm before outreach.**
Reportedly in talks with Uber Eats and DoorDash.

**Valqari** — RCVR-PAD, patented in 42 countries, founded by a US Army
veteran. Larger commercial unit (Drone Delivery Station, 7.5ft, 6
storage units, up to 25lb, built-in temperature control for food/
pharma). DRONEDEK and Valqari settled a real federal lawsuit in
October 2021, confirming genuine competition.

**Strixdrones** — a third option, no confirmed specs found yet.

**Location-fit**: Valqari for industrial/higher-volume/food locations;
DRONEDEK/Arrive for residential/apartment/small business locations.

**Remaining research gaps**: Strixdrones needs direct follow-up (no
pricing/specs found); Valqari's current pricing isn't confirmed;
Valqari's 2020 product announcement needs current-availability
confirmation; DRONEDEK's current legal name needs confirming.

---

## Implementation status (added when this file was placed into the repo)

This document shaped real code before the file itself was saved here.
What's real:

- **`VoidLocker`** — `lib/voidLocker.js`: all five `PMS_OPTIONS`
  (yardi/entrata/appfolio/realpage/buildium), all three
  `LOCKER_LOCATION_TYPES`, `courierAgnostic` (defaults `true`),
  `supportsFoodSecurityProgram`, and real compartments. Compartment
  assignment is real **best-fit** logic (smallest available
  compartment that still fits), matching how real locker systems
  avoid wasting a large compartment on a small package.
- **`LockerToDoorRequest`** — `lib/lockerToDoor.js`: the security
  design above is implemented as specified. The driver's grant is a
  real `crypto.randomBytes(12)` token, generated separately and never
  the customer's own credential; expiry is enforced; and single-use is
  enforced structurally by the status machine (`retrieveWithDriverAccess`
  requires `driver-assigned` and moves to `retrieved`, so a replay of
  a still-valid code fails the status check).

**Not built**: real PMS API integration (Yardi/Entrata/AppFolio/
RealPage/Buildium) — `propertyManagementSoftware` is recorded as a
real integration *target field*, not a live connection. No real API
credentials or partner agreements exist for any of the five. Same
honest stance HVNTZ takes on its own Square/Toast/Fivestars flags.
Physical hardware procurement (DRONEDEK/Valqari/Strixdrones) is a real
purchasing decision, not software — see
`VOID_HVNTZ_SESSION_ADDITIONS_PRICING.md`, which treats hardware as an
entirely separate budget line.
