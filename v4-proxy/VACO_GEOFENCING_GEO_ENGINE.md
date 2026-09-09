# VACO Geofencing — the Geo Engine

Geofencing is not automatic just because location services exist —
it's a layer built on top of location infrastructure. VACO's
architecture is already designed so geofencing becomes a natural
capability, given V4, a shared Maps layer, HVNTZ, VENVS, VOID, and
DREAMS already exist. No separate geofencing app needed — build it as
a shared VACO location service.

Architecture: V4 AI Core → Location Intelligence Layer → Geo Engine →
feeds HVNTZ (hunts, games, events, rewards), VENVS (business ads,
offers, digital twins), VOID (routes, deliveries, safety).

What the Geo Engine does: a business/location/user creates a "zone"
(e.g., 500-foot radius). When a user enters, V4 sends a notification,
a CHOPZ promotion appears, a VENVS storefront opens, DREAMS updates
the screen's advertising value.

HVNTZ example: entering a downtown zone activates nearby hunts, hidden
rewards, business challenges, restaurant offers, events. VOID example:
entering a delivery hub zone triggers arrival confirmation, automatic
check-in, loading instructions, time tracking, security verification.
VACANCY example: entering a city district becomes a real game boundary
— direct connection to VACANCY's existing Location Control Key and
Territory Blocks system; the Geo Engine is the real-world counterpart
to that same zone-based logic.

What Claude Code needs to build: Location Permission System (GPS
access, background location, privacy controls), Geo Database
(businesses, events, zones, digital twins), Geofence Engine (enter/
exit zone, stay duration, nearby), V4 Trigger System (AI decides what
happens after the event), Developer API (every VACO app can call it).

Status: a genuinely well-structured infrastructure layer — the shared
Geo Engine sits alongside VCoin/VASH as the ecosystem's second major
piece of cross-app shared infrastructure. Direct ties already exist to
VACANCY's Territory Block system, HVNTZ's hunts, VOID's logistics, and
DREAMS' digital-twin advertising model.

---

## Implementation status (added when this file was placed into the repo)

**The central argument is not just sound — it is already corroborated
by code written independently of this document.**

`voidmagic/lib/geofencing.js` exists and is real: Haversine
great-circle distance in meters, `isWithinGeofence()`, and
`verifyArrival()`. Its own header cites VOID MAGIC's build brief
saying **"V4 provides the shared location/mapping services"** — the
same layering this document proposes, reached from the other
direction.

More telling: that file scopes itself honestly to **one of six**
geofencing examples its brief named, and explains why the other five
were out of reach — no real-time driver location, no security-alert
infrastructure, no shared location service to call. It solved the one
case it could reach alone.

**That is the argument for this document, written by the code.** One
app built the primitive it needed, correctly declined to build the
other five, and named the missing shared layer as the blocker. A
second app needing zones would repeat the Haversine math — as CVNVO
already did in `compatibility.js` (kilometres, city-scale) and
`proximity.js` (250m Happn radius). Three implementations of the same
distance formula exist today, at three scales, in three apps.

**What is real across the ecosystem:**

| Piece | Status |
|---|---|
| Haversine distance | **Real, three times over** — voidmagic (metres), cvnvo/compatibility (km), cvnvo/proximity (250m) |
| Point-in-radius check | **Real** — `isWithinGeofence()` |
| Zone entry → action | **Real, once** — `verifyArrival()`, arrival only |
| Real lat/lng on businesses | **Real** — HVNTZ locations |
| Venue check-in | **Real** — CVNVO BarBuddy, opt-in |
| Named, reusable zones | **Not built** |
| Enter/exit/dwell events | **Not built** — only point-in-radius, no transitions |
| Background location | **Not built** |
| Cross-app developer API | **Not built** |

**The gap is narrower than the document implies, and differently
shaped.** The hard geometry is done three times. What is missing is
*statefulness*: a zone that exists as a record, and the notion of
crossing its boundary. `isWithinGeofence()` answers "am I inside right
now"; a Geo Engine has to answer "did I just enter", "have I been here
twenty minutes", "did I leave". That is a subscription model over
time, not a distance function — and it is the part none of the three
implementations has.

**Two things worth deciding before building**, neither resolved here:

*Where it lives.* This document says V4, and it is filed here for
that reason. But V4 (`v4-proxy/`) is an agent interface holding an API
key — adding a location database to it makes it two things. The Geo
Engine looks more like V3 or VSAFE: its own service that apps call.
The architecture diagram's "V4 AI Core → Location Intelligence Layer"
describes who *decides what happens after* an event, which is genuinely
V4's job, and that is separable from who *stores zones and detects
crossings*.

*Background location is not a small feature.* "Location Permission
System (GPS access, background location, privacy controls)" is listed
alongside four other items as though comparably sized. Continuous
background location is the single most privacy-sensitive capability in
this entire ecosystem, it is what app stores scrutinise hardest, and
CVNVO's `proximity.js` deliberately stores **only intersection points,
never continuous location history** — a standard this document's zone
model would have to either match or consciously break.

**Genuinely unbuilt**, and correctly listed as such: the zone
database, transition events, the trigger system, and the developer
API. The VACANCY tie is real in concept but VACON-C is paused.
