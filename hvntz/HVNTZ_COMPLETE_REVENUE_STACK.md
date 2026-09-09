# HVNTZ Business — Complete Revenue Stack (v1, definitive)

The full, consolidated list of every independent revenue stream a
single HVNTZ-onboarded business earns from, pulling together
everything established across this project. This is the real, core
pitch for business recruitment — one onboarding, many income streams
from the same physical location.

## The complete list

**1. Hunt participation revenue** — the original HVNTZ model: real
sponsor budgets and VCoin bounty participation from being a scavenger
hunt checkpoint.

**2. DREAMS screen ad revenue** — real retail-media/DTC ad income from
the screen at their location, per DREAMS' standing revenue-share model.

**3. DREAMS screen DTC commission** — direct-to-consumer sales made
right from their screen, whether it's their own product or another
seller's (VENVS/CHOPZ) being sold through that screen.

**4. VOID Station drone usage fee** — if hosting a drone station, a
real fee every time it's used for any transaction, regardless of
whose product is involved.

**5. VOID Station midpoint/relay fee** — a real fee when their
location serves purely as a delivery waypoint for orders unrelated to
their own business.

**6. Vavlt Stvdios streaming revenue** — using their own screen to
stream, participating in Vavlt Stvdios' multi-channel architecture and
locked-content subscription tiers, the same model already extended to
business owners specifically.

**7. VDP virtual storefront** — beyond just visibility, the digital
twin functions as a genuine **virtual store** inside VDP — real
commerce happening at that location, not just a presence, scaling with
Digital Twin Level (Level 3 specifically unlocking Vavlt Stvdios
streaming + AI Business Intelligence).

**8. Business Locker + drone fulfillment** — forward-deployed
inventory at a VOID Hub, fulfilling both VMall screen orders and
standard deliveries, per the real, staffed loading system already
established.

**9. HVNTZ discovery placement (Yelp-style visibility)** — worth
counting explicitly, even though it's real business value rather than
a direct payout: being discoverable through HVNTZ's own Yelp-style
business directory is a genuine, real driver of new customer
acquisition, on top of every direct revenue stream above.

**10. CVNVO date-location algorithm placement** — a business can opt in
to be surfaced as a suggested date location within CVNVO (extending the
already-established Hunts Dates and Dating Village concepts), the same
opt-in model as scavenger hunt participation. A higher package tier
costs more but pushes the business into the algorithm more prominently
— real, paid visibility to CVNVO users planning a date, a genuine
customer-acquisition channel especially valuable for restaurants, bars,
and venues.

**11. Community thread opt-in (Reddit/VXLLAGE-style)** — a business can
opt in to a dedicated community discussion thread tied to their
business page, building an ongoing space for customers/fans to engage,
share, and return to — real loyalty and word-of-mouth value layered on
top of their existing HVNTZ/Vavlt Stvdios presence. **Directly
connected to VXLLAGE's Village** — joining the thread surfaces a real
path into the business's own live audio/hangout Village room, not just
a static text thread, pushing genuine interactive engagement rather
than passive browsing.

**12. Package pickup destination — distinct from relay/transit** — real
comparable: **Amazon Hub Counter**, a genuine, proven retail
partnership model. A business becomes a real pickup point where
customers choose that location as their delivery address at checkout,
get notified on arrival, and pick up at their convenience by showing a
barcode/pickup code — different from the relay/midpoint function
already established (where a package merely passes through as part of
a route). Real, confirmed value for the host business: genuine
increased foot traffic, using existing staff already on-site (no
dedicated labor cost), same real win-win Amazon's own program
describes with its retail partners (Rite Aid, GNC, Health Mart, and
others). Real scale proof: thousands of real Hub Counter locations
already operating, with four out of five U.S. customers now within
five miles of one.

**13. VOID rideshare hotspot** — a business opts in to become a
designated VOID pickup point, the same real concept as a mall or
airport's designated rideshare zone, now built directly into their
existing screen infrastructure. A dedicated "Need a ride?" section on
their screen (or a separate sidewalk unit) lets a customer scan
directly into VOID's rideshare system, requesting a pickup right from
that location — no new hardware required beyond what's already
installed for DREAMS/VMall, just a new function on the same screen.

**13a. Safety Service Program — for alcohol-serving businesses
specifically** — a distinct, real extension of the rideshare hotspot,
with its own additional incentive for opting in. Bars and alcohol-
serving venues get a genuine bonus/add-on for participating, and their
screens automatically and prominently display real safety messaging —
"Been drinking? Need a ride?" — rather than generic advertising. This
is real, socially responsible business logic: prominently promoting
safe rides home is a genuine public good, and likely reduces the
venue's own real liability exposure around over-service, alongside the
direct financial incentive for opting in.

```
SafetyServiceProgram {
  businessId
  isAlcoholServingVenue: boolean
  additionalIncentiveRate: number  // bonus on top of standard
                                     // rideshare hotspot earnings
  promptText: string  // e.g. "Been drinking? Need a ride?" — real,
                        // prominent safety-specific messaging, not
                        // generic ad content
  autoDisplayPriority: "high"  // safety messaging takes priority
                                  // placement over standard ads at
                                  // these venues specifically
}
```

**Higher incentive tier — a dedicated VOID pickup spot**: businesses
that go further than a shared screen section — establishing a real,
dedicated physical spot with its own dedicated screen exclusively for
VOID riders — earn a meaningfully larger incentive than the standard
rideshare hotspot rate. The same real logic as airports and malls
having varying levels of rideshare infrastructure — a shared curb
zone versus a real, well-marked, dedicated rideshare area — with the
incentive scaling to match the level of real, physical commitment the
business makes.

```
DedicatedVoidPickupSpot {
  businessId, locationDetails: string
  hasDedicatedScreen: boolean  // true = a screen used exclusively for
                                  // VOID rider information, not shared
                                  // ad rotation space
  incentiveTier: "shared-screen-section" | "dedicated-spot"  // the
    // dedicated tier earns meaningfully more than the shared tier
}
```

**14. Full-service VOID delivery handoff** — a business can opt to have
VOID handle their delivery entirely, rather than piecemeal use of
individual VOID features. This is the real, formalized realization of
**VOID Direct** (already established, modeled on the real DoorDash
Drive/Uber Direct business-to-business delivery model) — a business
hands off all delivery logistics to VOID as a comprehensive program,
trading direct control for faster, more consistent results and one
less operational responsibility to manage themselves.

```
CVNVOPlacementTier {
  businessId, packageTier: string
  algorithmVisibilityBoost: number  // scales with package cost
}

BusinessCommunityThread {
  businessId, threadId  // VXLLAGE-style thread tied to the business page
  memberCount: number
  connectedVillageRoomId: string  // direct link to the business's own
                                    // VXLLAGE Village room — joining
                                    // the thread surfaces a real path
                                    // into live audio/hangout
                                    // interaction, not just text
}

PackagePickupDestination {
  businessId, hubId
  isDestinationOnly: boolean  // true = customers select this as their
                                // delivery address, distinct from
                                // relay/transit participation
  pickupsCompletedCount: number
  footTrafficIncrease: number  // real, measurable value to the host,
                                 // matching Amazon Hub Counter's own
                                 // proven value proposition
}

VoidRideshareHotspot {
  businessId, screenId
  qrCode: string  // scans directly into VOID's ride-request flow
  ridesRequestedCount: number
}

FullServiceDeliveryHandoff {
  businessId
  isActive: boolean
  handoffScope: "all-orders" | "overflow-only"  // full opt-in, or only
                                                   // when the business's
                                                   // own capacity is exceeded
  enrolledAt: timestamp
}
```

## Why this matters — the real, compounding pitch

**One onboarding decision, fourteen real ways to benefit, all from the
same physical location.** This is precisely why the HVNTZ business-
onboarding flywheel was identified early in this project as the
single most important engine feeding the rest of the ecosystem —
businesses aren't being asked to adopt fourteen separate products, they're
making one decision that automatically activates all fourteen.

## Worked example — applying the full model to a non-food business: a gym

A real, concrete case study confirming the thirteen-stream model
genuinely generalizes beyond food businesses.

**The scenario**: a gym with substantial open wall space joins the
HVNTZ program. Multiple DREAMS screens are installed — both interior
and exterior, not just one — giving the business real, full access to
every revenue stream already established.

**Content relevance, not generic advertising**: the screens display
**contextually relevant** advertisers specifically matched to the
venue — creatine, gym products, gym apparel, and similar fitness-
industry brands, rather than random, unrelated ads. This is a real,
important principle worth generalizing: DREAMS' advertiser-matching
should be **contextually relevant to the venue type**, the same
discipline whether the venue is a gym, a restaurant, or any other
HVNTZ business.

**Direct revenue attribution confirmed**: when a customer makes a real
digital purchase from a screen at the gym, that transaction reflects
directly back to the gym's own account — the DTC commission stream
working exactly as designed, tied to the specific physical location
where the purchase happened.

```
VenueContentMatching {
  businessId, venueCategory: string  // "gym", "restaurant", etc.
  relevantAdvertiserCategories: [string]  // e.g. ["supplements",
    // "athletic apparel", "fitness equipment"] for a gym
}
```

**Why this matters**: this confirms the full thirteen-stream HVNTZ
model isn't food-specific — it applies to any real business type with
physical space, as long as screen content and advertiser matching stay
genuinely relevant to that venue's actual customer base.

## DREA is the responsible agent for placement matching

Confirmed: **DREA** (already established as DREAMS' AI agent) is the
specific agent responsible for organizing which businesses and sellers
get matched to which physical placements — not a generic ad-serving
algorithm. This is a real, deliberate distinction from typical
advertising platforms, which largely just serve whatever ad wins an
auction regardless of contextual fit.

## Real, important constraint: avoid direct competitor conflicts

Beyond contextual relevance (the gym/fitness-product matching already
established), DREA's placement logic must actively **avoid placing
direct competitors or competing sellers at the same venue or in
conflict with the host business's own offerings**. Real, sensible
example: a competing sandwich brand shouldn't be advertised on VODEGA's
own screen; a competing gym membership shouldn't be advertised inside
a partner gym. This is closer to real category-exclusivity
sponsorship deals than open ad-auction placement — a genuine point of
difference from how most ad platforms operate.

```
DreaPlacementRule {
  businessId, venueId
  excludedCompetitorCategories: [string]  // categories DREA must never
                                            // place at this venue
  excludedSpecificSellers: [sellerId]  // direct competitors of the
                                          // host business specifically
  matchingBasis: "contextual-relevance" | "exclusivity-agreement"
}
```

**Why this matters**: this is a real, meaningful trust-building
difference for HVNTZ businesses — a business joining knows DREA won't
undermine them by advertising their direct competition on their own
screens, a genuine point of difference from generic, indiscriminate ad
networks that would happily place a competitor's ad anywhere it bids
highest.

## Flagging system — human-in-the-loop for borderline cases, and business-initiated review

Two real, complementary safeguards beyond DREA's automated exclusion
rules:

**1. Proactive notice for borderline/ambiguous cases**: when DREA
detects something that seems close to a conflict of interest but isn't
a clear-cut direct competitor match, it sends a real notice to the
business/screen owner to confirm there's no conflict, rather than
silently deciding on its own. This catches genuine edge cases the
automated exclusion rules might not cleanly cover.

**2. Business-initiated flagging**: a business owner can flag an ad
themselves at any time if they have a problem with it, even if DREA
didn't initially flag it — direct owner control and override, not just
relying on DREA's automated judgment.

```
PlacementFlag {
  id, venueId, adId
  flagSource: "drea-borderline-detection" | "business-owner-initiated"
  flagReason: string
  status: "pending-review" | "confirmed-no-conflict" | "ad-removed"
  notifiedBusinessId: string
  resolvedAt: timestamp | null
}
```

**Why this matters**: this keeps DREA's placement logic honest and
correctable — automated rules alone will miss genuine edge cases, and
giving business owners real, direct override power reinforces the same
trust-building principle already established: businesses know they
have real say over what appears on their own screens, not just an
automated system's best guess.

## Ad submission and content review workflow

A real, necessary addition distinct from placement-matching: companies
submit their own ad creative (the actual content they want displayed)
for consideration, and it must pass a **real content review process**
before going live — separate from DREA's placement-matching and
competitor-exclusion logic, which handles *where* an approved ad goes,
not whether the ad content itself is acceptable in the first place.

**The real, two-stage flow**: (1) advertiser submits creative content,
(2) content review confirms it meets platform standards before DREA's
placement logic ever considers where to show it. This connects to the
same content-standards philosophy already established elsewhere in
this ecosystem (QVAN's content moderation role, the "freedom of speech,
not freedom of reach" standard) — ad content should be held to the
same real review discipline as any other platform content.

```
AdSubmission {
  id, advertiserId, creativeAssetUrl
  reviewStatus: "pending" | "approved" | "rejected"
  rejectionReason: string | null
  reviewedBy: "automated-check" | "human-reviewer"
  submittedAt: timestamp, reviewedAt: timestamp | null
}
```

**Direct fit with existing systems**: an `AdSubmission` must reach
`"approved"` status before it becomes eligible for DREA's placement-
matching and the `DreaPlacementRule`/`PlacementFlag` systems already
established — content review and placement logic are two distinct,
sequential steps, not one combined process.

## Screen-level analytics for system administrators

Whoever operates the ad review and placement system needs real,
granular, **per-screen** analytics visibility through DREA and the
broader DREAMS network — not just aggregated, ecosystem-wide numbers.
This extends the shared analytics dashboard component (already
identified in the Ecosystem-Wide Shared Systems Review) with the
specific administrative view this role requires.

```
ScreenAnalyticsView {
  screenId, viewerRole: "system-administrator" | "business-owner"
  impressions, scans, conversions: number
  adPerformanceByAdvertiser: [{ advertiserId, ctr: number, revenue: number }]
  flaggedContentCount: number  // cross-references PlacementFlag data
  timeRange: string
}
```

**Why per-screen granularity matters**: a system administrator
reviewing content decisions, resolving flags, or evaluating DREA's
placement quality needs to see exactly how an individual screen is
performing — which ads convert, which get flagged, which venues show
strong engagement — not just a blended, ecosystem-wide average that
hides where real problems or real successes are actually happening.

## Ad tier system — format complexity and dynamic, traffic-based pricing

A real, tiered ad format structure, with pricing that scales
dynamically based on both ad complexity and real location performance
data — extending DREAMS' already-established dynamic traffic-based
pricing principle (originally tied to HVNTZ check-in + VOID scan data)
with a genuine ad-format tier system on top.

**The four real ad tiers**:
1. **Quick-Link** — minimal, essentially just a QR code driving
   straight to a purchase/link. The fastest, cheapest tier.
2. **Standard** — more visual content and information alongside the
   QR code.
3. **Premium/Extravagant** — richer, more elaborate creative, longer
   display time.
4. **Full Commercial** — the most elaborate format, full video/audio
   commercial treatment.

**Universal requirement across every tier**: every ad, regardless of
tier, should at minimum attempt to include a QR code for direct
response — even a Full Commercial should still drive to a real,
immediate action, not just brand awareness alone.

**Dynamic pricing formula — two real factors**:
- **Ad tier/duration** — higher tiers cost more, the same real
  principle as TV/radio pricing longer or more elaborate spots higher.
- **Real-time location performance** — price rises based on actual
  measured traffic and real dollar volume/revenue already flowing
  through that specific location, per the existing dynamic
  traffic-based pricing system.

```
AdTierPricing {
  adTier: "quick-link" | "standard" | "premium" | "full-commercial"
  baseDurationSeconds: number
  basePriceRange: string
  requiresQrCode: boolean  // true for all tiers, universally
}

LocationDynamicPriceModifier {
  locationId
  currentTrafficScore: number  // real, measured foot traffic/scan data
  currentRevenueVolume: number  // real dollar volume flowing through
                                   // this location
  priceMultiplier: number  // scales upward as both factors increase
}
```

**Direct fit with existing systems**: this extends the `AdSubmission`
workflow already established — an advertiser selects a tier when
submitting creative, and the final price is calculated dynamically
using the location's real, current traffic and revenue data at the
time of placement, not a fixed rate card.

## Real incentive requirement — every scan should offer genuine value

A real, important guideline for advertisers submitting content: the
QR code destination should always offer **some genuine incentive**,
not just a plain link — a coupon, a percentage-off discount, a direct
product purchase, or an app download offer. Real, established direct-
response marketing principle: a genuine value exchange drives
meaningfully higher scan and conversion rates than a purely
informational destination.

```
AdSubmission {
  id, advertiserId, creativeAssetUrl
  reviewStatus: "pending" | "approved" | "rejected"
  rejectionReason: string | null
  reviewedBy: "automated-check" | "human-reviewer"
  submittedAt: timestamp, reviewedAt: timestamp | null
  scanIncentiveType: "coupon" | "percentage-discount" | "direct-purchase" |
    "app-download-offer" | "other"  // required field — advertisers must
                                       // specify what value the scan offers
}
```

**Recommend making this a genuine requirement in the content review
step**, not just guidance — an ad submission without a real, specified
incentive should be flagged during review as a real quality issue,
since an empty link destination undermines the value of the whole ad
placement, regardless of how well DREA matches it contextually.

**The real reason this matters — habit formation, not just conversion
rate**: this is the same proven mechanism behind physical retail's
oldest tactics — Costco's sample stations, mall coupon booths, grocery
store tastings. People develop a genuine habit of engaging with
something once they learn it consistently rewards them, the same way
shoppers reflexively check the Costco sample table without wondering
if it's stocked today. If VACO screens consistently give something
back, checking a screen becomes reflexive behavior over time — a
compounding value that grows every time someone passes a screen, not
just a one-time conversion boost from a single ad.

## Smart Benches — QR-scan-to-unlock charging

New, real physical infrastructure extending DREAMS beyond business-
hosted screens: standalone public benches with real device charging,
placed on streets, sidewalks, or other single-location public spots.
Real precedent confirmed: **Soofa** (MIT Media Lab spinoff, 2014) has
deployed solar-powered charging benches across 16 states and 5
countries — real, proven public infrastructure. Soofa's own real
business model is described as **"advertising-funded infrastructure."**

**The mechanic, confirmed and simpler than a forced ad-watch
requirement**: a sign reads "Need a charge? Scan here." Scanning the
QR code is the actual unlock action — it releases the charging port.
This is a genuine, elegant utility incentive (free charging) driving
the scan, which naturally routes through the same ad-tier and
incentive-requirement system already established for every other
screen in the network.

```
SmartBenchStation {
  id, locationAddress
  chargingPortsAvailable: number
  qrUnlockCode: string  // scanning this both unlocks the port AND
                          // routes through DREA's ad/incentive system
  isStandaloneLocation: boolean  // true — not tied to a business,
                                   // a genuinely single, independent
                                   // public placement
}
```

**Direct fit with existing systems**: the scan itself satisfies the
"every scan needs a real incentive" requirement already established —
free charging IS the incentive — while still routing through DREA's
placement/ad-matching logic for monetization. This is a real,
distinctive mechanic beyond what Soofa's own real deployments have
done, worth building as a genuine differentiator.

**Open item**: worth checking directly whether Soofa or a similar
competitor already operates in St. Louis before treating smart-bench
placement as genuinely open ground — the same verification already
flagged for the broader street-furniture screen question.

## The real, simple principle — good, legal, visible real estate, not complexity

Confirmed: the actual goal is simple — find good, legal, visible
locations for basic ad placements, not elaborate mechanics for their
own sake. Real, simple street furniture categories worth pursuing:

- **Sidewalk signs** — simple, standalone standing signage
- **Park benches with a mounted screen** — the smart bench concept
  already established, but the core requirement is just a bench in a
  good location with a screen
- **Bus stops** — real, standard street-furniture advertising real
  estate, already operated by real national players (Intersection,
  JCDecaux, Clear Channel) in many US cities

**The real, honest priority**: find good locations first — genuine
foot traffic, real visibility — rather than over-engineering the
mechanic. Smart-bench charging and Bigbelly-style compaction sensors
are real, valuable upgrades where they fit, but a simple, well-placed
sidewalk sign or bus stop ad is a completely legitimate, real starting
point on its own.

**Legal compliance, non-negotiable**: every placement needs real
municipal signage/street-furniture permits before installation — the
same permitting requirement already established for DREAMS' screen
network generally. "Without breaking any laws" means confirming local
ordinances on street furniture, sidewalk obstruction rules, and
advertising signage specifically, city by city, before installing
anything — not an assumption to skip.

```
SimpleStreetFurniturePlacement {
  id, placementType: "sidewalk-sign" | "bench-screen" | "bus-stop" |
    "trash-can-display"
  locationAddress
  permitStatus: "pending" | "approved" | "not-yet-applied"
  visibilityScore: number  // real, measured foot-traffic estimate for
                             // this specific location
}
```

## Smart Tables — dual-mode menu and ad display

New, real physical infrastructure for restaurant locations
specifically. Real, confirmed precedent: large-format touchscreen
dining tables ($350–$1,500+ per unit, real manufacturers with
accessible minimum orders), with **Dotyk Smart Tables** already
running the exact real business model of combining interactive
ordering with tailored advertising revenue.

**Confirmed dual-mode behavior**:
- **Active mode**: functions as a genuine touchscreen menu — customer
  browses, orders, and can pay directly from the table.
- **Idle mode**: when not actively being used for ordering, the table
  automatically switches to display DREA-matched, contextually
  relevant ads — the same placement-matching and competitor-exclusion
  logic already established elsewhere in the network.

```
SmartTable {
  id, restaurantId, tableNumber
  currentMode: "menu-active" | "idle-ad-display"
  idleTimeoutSeconds: number  // real, tunable threshold before
                                switching from menu to ad mode
  lastInteractionAt: timestamp
}
```

**Direct fit with existing systems**: idle-mode ad content routes
through the same `AdSubmission`, `DreaPlacementRule`, and ad-tier
pricing systems already established — a smart table is simply another
real screen in the network, just with a genuine dual purpose specific
to the dining context. Direct fit for the flagship restaurant brands
(VIVE, VIXENS, VORDABELLO'S, VODEGA, and the rest) and any HVNTZ
restaurant partner.

## Additional real market categories worth adding

**Smart mirrors** — a real, established category combining a two-way
mirror with an LCD display: looks like a normal mirror when off,
becomes an interactive ad/display when active. Real, confirmed
deployment contexts: gyms, retail fitting rooms, spas, hotel
bathrooms, and elevator cabins. **A direct, perfect fit for the gym
worked example already established** — gyms already have mirrors
everywhere, turning existing, unavoidable infrastructure into real ad
space without adding anything new to the room.

**Elevator screens** — a real, additional captive-audience placement
type, genuinely distinct from wall-mounted or tabletop screens.

**"Lift-and-learn" smart shelving** — real, sensor-triggered
technology: a customer lifts a product, a nearby screen automatically
plays relevant content about that specific item. An even more
automated, precise version of DREA's contextual matching — directly
relevant to VFRESH's grocery goods and VAZAN's supplements/skincare
products specifically.

**Environmental/contextual triggers** — a real, current 2026 signage
trend worth adopting directly into DREA's matching logic: a screen
automatically changes content based on real-time conditions (real
example found: a bus-stop screen switches to rideshare ads the moment
it starts raining). This is a genuine, valuable upgrade to DREA's
existing contextual-matching rules — not just matching venue type, but
reacting to real-time environmental conditions too.

```
LiftAndLearnTrigger {
  productId, shelfSensorId, nearbyScreenId
  triggeredContent: string
}

EnvironmentalTrigger {
  screenId, triggerCondition: "rain" | "time-of-day" | "temperature" |
    "local-event"
  triggeredAdCategory: string  // e.g. "rideshare" for rain
}
```

**Real, useful validating stats found**: interactive signage and smart
retail display technology can increase sales by up to 30%; nearly
one-third of shoppers make an impulse purchase right after seeing an
item displayed in-store — real, direct validation of this entire
category's value.

## Viral Pack — screen-as-photo-backdrop incentive

A distinct, real incentive businesses can opt into: a larger screen
displays a themed, branded background specifically for customers to
take photos in front of — a real "Instagrammable moment" generator.
**This directly connects to Unilumin's real IN·BOX product** (already
researched — AI-generated visual content turning physical spaces into
dynamic content interfaces, explicitly described as driving "commercial
traffic generation" and "brand revenue" through real, social-media-
shareable spots).

**Mechanic**: a customer scans a QR code, the screen switches to a
themed background for a set, limited time window — enough for a real
photo opportunity — then reverts. This drives genuine organic social
sharing (free marketing for both VACO and the host business) while
also functioning as a real, paid business incentive.

```
ViralPackDisplay {
  id, businessId, screenId
  backgroundThemeId: string  // the branded/themed background shown
  activeDurationSeconds: number  // limited photo-opportunity window
  triggeredByQrScan: boolean
  socialShareCount: number  // real, trackable organic reach generated
}
```

## Full-body mirror — scan-to-photo-mode

Extends the already-established Smart Mirror Display with a third,
distinct mode: a genuine full-body mirror that normally displays ads
(per the existing mirror/ad-display dual mode), but **switches to an
actual photo-taking mirror mode when scanned**, for a real, limited
time window — giving customers a functional mirror for taking their
own photo, not just a passive display.

```
SmartMirrorDisplay {
  id, locationId, venueType: "gym" | "spa" | "fitting-room" | "elevator" |
    "restaurant"  // confirmed: "selfie mirror" concept for restaurants —
                   // full-length mirror doubles as ad display, fits the
                   // flagship restaurant brands directly
  currentMode: "mirror" | "ad-display" | "photo-mode"  // photo-mode
    // added — triggered by scan, active for a limited window, then
    // reverts to standard ad-display
  photoModeTriggeredAt: timestamp | null
  photoModeDurationSeconds: number
}
```

**Direct fit**: both features extend real, already-established
infrastructure (the Smart Mirror system, DREAMS' screen network) with
a genuine social/viral incentive layer — businesses get a real,
distinct reason to opt in beyond straightforward advertising revenue,
and VACO gets real, organic social reach as a byproduct.

## Automatic social media surfacing at the moment of the photo

A direct, real extension of the Viral Pack and photo-mode mirror
features: the business's own social media handles automatically
appear right at the moment someone takes a photo — making it
effortless to tag the business directly, rather than relying on the
customer to remember or look up the handle themselves. This
maximizes the chance a share is actually attributed back to the
business, turning organic reach into direct, trackable social growth
for that specific location.

```
BusinessSocialAutoSurface {
  businessId
  socialHandles: [{ platform: "instagram" | "tiktok" | "x" | "other",
    handle: string }]
  vaultStudiosPageId: string  // the business's own internal Vault
                                // Studios IG-style page (already
                                // established), surfaced alongside
                                // external handles
  triggeredAt: "viral-pack-photo" | "mirror-photo-mode"
  autoTagSuggestionShown: boolean
  postedToVaultStudios: boolean  // real, trackable engagement driven
                                    // directly into VACO's own ecosystem
}
```

**Why the internal page matters just as much as external handles**:
this drives real engagement directly into HVNTZ's own Instagram-style
page, powered by Vavlt Stvdios — not just free advertising for
external platforms VACO doesn't control. The same "self-promotion"
principle already established for DREAMS' own ad inventory applies
here: every photo shared should have a real path back into VACO's
ecosystem, not only outward to Instagram or TikTok.

## Self-promotion should follow the same incentive standard

Reinforcing the standing incentive requirement explicitly for self-
promotion: when a business advertises itself (not just outside
advertisers or neighbor trades), it should still offer something real
— a free item, a discount for coming in — the same genuine value
exchange already required everywhere else in the ad system. This
keeps the habit-formation principle consistent across every kind of ad
on the network, not just paid third-party placements.

## Rewards program connection — respecting existing business relationships

A real, honest design challenge, addressed directly: many businesses
already run their own loyalty/rewards programs, often through real,
established third-party platforms (Square Loyalty, Fivestars, Toast
Loyalty, Punchh, and similar). Forcing a business to abandon an
existing program and relationship would genuinely create friction, not
value — the right answer is **choice, not replacement**.

**Two real, non-disruptive paths, business's choice**:
1. **Native HVNTZ rewards program** — for businesses without an
   existing system, or who want to consolidate, VACO offers a real,
   built-in rewards program directly.
2. **Third-party connection** — for businesses with an existing
   loyalty platform, VACO integrates via that platform's real,
   published API (Square, Toast, Fivestars, and similar all offer
   real developer APIs for exactly this kind of integration), rather
   than requiring the business to switch or run two competing systems.

```
BusinessRewardsConnection {
  businessId
  connectionType: "native-hvntz-rewards" | "third-party-integration" | "none"
  thirdPartyPlatform: "square-loyalty" | "fivestars" | "toast-loyalty" |
    "punchh" | "other" | null
  apiConnectionStatus: "connected" | "pending" | "not-applicable"
}
```

**Why this respects the business relationship properly**: a business
keeps full ownership of whichever rewards system they already trust
and their customers already use — VACO integrates with it rather than
competing against it, the same respectful approach already applied to
courier-agnostic locker access and drone-agnostic station hardware
elsewhere in this ecosystem.

## Self-promotion ad rotation — real incentive, not a mandate

A genuine, worthwhile design question worth answering honestly rather
than defaulting to "no choice": should businesses be required to
display VACO's own self-promotional ads (per the DREAMS self-
promotion mechanism already established) without any consideration?

**The honest answer: no — that would contradict the trust-building
principles already established throughout this whole system**
(business override power over their own screens, DREA's respect for
placement control, businesses keeping their own rewards programs
rather than being forced onto VACO's). Mandating VACO's own ads
without real consideration would be a real, meaningful exception to
that pattern, and a genuine trust risk — businesses who feel their
screens are being used without real benefit are more likely to churn
or disengage from the broader ecosystem, undermining the whole
flywheel this document has been building toward.

**The sustainable structure, addressing both the real CAC benefit and
business fairness**:
1. **A capped rotation percentage** — VACO's self-promotion fills only
   a limited share of total ad rotation slots (a real, tunable
   percentage), protecting the majority of a business's screen time
   for their own revenue opportunities (paying advertisers, neighbor
   trades, their own self-ads).
2. **Real, if modest, compensation for the slots used** — even below
   full third-party market rate, businesses get something real for
   hosting VACO's own promotional content, not zero.

```
SelfPromotionRotationPolicy {
  maxRotationPercentage: number  // caps VACO's own ad share of total
                                    // rotation time, protecting
                                    // business revenue opportunity
  compensationPerSlot: number  // real, if reduced, payment — not zero
}
```

**Why this is the right call**: this still captures the real, valuable
20-40% CAC reduction already established for DREAMS' self-promotion,
while keeping businesses genuinely willing participants rather than
mandated hosts — the same respectful, choice-based approach already
proven correct for rewards programs and screen placement control
throughout this document.

## Closing strategic framing — HVNTZ is "an Instagram for business"

Everything documented in this file — the fifteen-plus revenue streams,
DREA's contextual matching, the ad-tier and dynamic pricing system,
the Safety Service Program, smart mirrors, Viral Pack, and the rest —
adds up to a genuine, real strategic identity worth stating plainly:
**a business that adopts all of this becomes meaningfully more
capable, tech-forward, entertaining, and resourceful than a standard
brick-and-mortar operation** — not incrementally better, genuinely a
different category of business.

**The precise, correct positioning**: HVNTZ has real Instagram-style
social/content mechanics (via Vavlt Stvdios' IG layer), but it remains
fundamentally **a platform for businesses, not general consumer social
media** — the same "businesses first" strategic priority already
locked in for Vavlt Stvdios specifically. HVNTZ is genuinely "an
Instagram for business" — social, visual, and engaging, but built
around commercial value and real revenue for the business, not
personal social networking. This is the correct, complete way to
describe HVNTZ's identity going forward, and it should inform how
Claude Code frames the product in any user-facing copy or onboarding
materials.

## HVNTER — HVNTZ's named AI agent, confirmed

Following the same naming convention as DREA (DREAMS), Kevin (CVNVO/
dating), and Gibson (VOID dispatch), HVNTZ's own AI agent is
**HVNTER**. Real, direct responsibilities established below.

## Real, concrete hunt example — community engagement through real landmarks and local businesses

A worked example of a genuine HVNTZ hunt combining real St. Louis-area
landmarks with local business stops: **Cahokia Mounds, the Gateway
Arch, and the Confluence of the Missouri and Mississippi Rivers**,
woven together with real, participating restaurants along the route.
This is the real, concrete illustration of how HVNTZ gets the
community engaged with both the region's genuine history/geography
and its local businesses in one connected experience — exactly the
kind of hunt design the platform is built to support.

## HVNTER recommends breaks on action-based hunts

A real, valuable new feature: for hunts that are physically demanding
("action-based"), HVNTER proactively recommends taking a break —
rather than waiting to be asked — and surfaces a real list of nearby
hunt-affiliated businesses in that specific area where the person can
rest, matching the same proactive-assistant principle already
established elsewhere (the business-suggestion engine surfacing
recommendations rather than waiting to be asked).

```
HvnterBreakRecommendation {
  huntId, userId
  huntIntensityLevel: "leisurely" | "moderate" | "action-based"
  recommendedAt: timestamp
  nearbyAffiliatedBusinesses: [{ businessId, distanceFromCurrentStop: number }]
}
```

**Why this matters**: this keeps hunts genuinely enjoyable and safe
for physically demanding routes, while directly feeding foot traffic
to real, participating local businesses at exactly the moment someone
needs a rest — turning a practical necessity (taking a break) into
another real touchpoint for local business discovery and revenue.

## Hunts Local Neighbor Program

A real, distinct program: businesses within a defined vicinity — the
business owner chooses the radius — can opt in to **trade advertising
directly with each other**, rather than only running paid ads through
DREAMS' broader network. A real, mutually beneficial local commerce
model: nearby businesses cross-promote, each offering a real incentive
(coupon, percentage off) per the established scan-incentive
requirement, with DREA recommending and facilitating the matches.

**High priority, not an afterthought**: confirmed as a genuine
priority recommendation for DREA — ranking alongside or just behind
the highest-priority suggestions already established (nearby
opportunity alerts, twin-level plateau suggestions), not a low-priority
optional feature.

```
HuntsLocalNeighborProgram {
  businessId, definedVicinityRadius: number  // business owner sets this
  optedIn: boolean
  neighborTradeMatches: [{
    partnerBusinessId
    incentiveOffered: string  // coupon/discount, per the standing
                                // incentive requirement
    incentiveReceived: string
    dreaRecommendationPriority: "high"
  }]
}
```

**Why this matters**: this builds genuine local business community —
neighboring businesses become allies driving foot traffic to each
other rather than operating in isolation, and DREA actively surfaces
these opportunities rather than leaving businesses to find each other
on their own. This is a distinct, real complement to the competitor-
exclusion rules already established — those keep direct competitors
apart; this actively connects genuinely complementary, non-competing
neighbors together.

## HVNTZ Explore Page — a real, confirmed gap, now closed

Vavlt Stvdios already has a general "Explore" feature as part of its
IG-style layer, but a **HVNTZ-specific discovery page**, tailored to
surfacing hunts, neighbor program matches, and business features
specifically, hasn't been built until now.

**The real algorithm — two combined factors**:
- **Location-based**: how close and relevant a hunt, business, or
  feature is to the user's actual position.
- **Attention-based**: real engagement signals — popularity, recent
  activity, trending status — the same real ranking logic established
  social media Explore/For You feeds use (Instagram Explore, TikTok's
  For You page).

**What surfaces here**: nearby active hunts (including the real
landmark-style routes like the Mounds/Arch/Confluence example),
businesses running Viral Pack or smart mirror features, Hunts Local
Neighbor Program matches, and any other HVNTZ-specific activity —
genuinely aggregating everything built in this document into one real
discovery surface.

```
HvntzExplorePage {
  userId
  locationScore: number  // proximity-weighted relevance
  attentionScore: number  // real engagement/trending signal
  combinedRankingScore: number  // the two factors combined
  surfacedContent: [{ contentType: "hunt" | "business-feature" |
    "neighbor-match", contentId: string }]
}
```

**Direct fit with existing systems**: this is HVNTER's natural home
surface — the explore page is where HVNTER's proactive recommendations
(break suggestions, neighbor matches, nearby opportunities) actually
get displayed, tying the agent's behind-the-scenes logic to a real,
visible, browsable page.

**Important build clarification — reuse, not duplicate**: since
HVNTZ's content and social features are already powered by Vault
Studios' infrastructure (the IG-style layer), this Explore page should
be built as a **HVNTZ-specific configuration of Vavlt Stvdios'
existing Explore system** — with HVNTZ's own location+attention
ranking parameters and content types (hunts, neighbor matches,
business features) — not a separate, duplicate explore system built
from scratch. Same shared-infrastructure principle already applied
everywhere else in this ecosystem (V3, V4, DREAMS): specify the
distinct behavior clearly, but build it on the shared system already
in place.

**Why this matters**: the moment right after a photo is taken is the
real, highest-intent point for a share — surfacing the tag-ready handle
right then, rather than expecting the customer to seek it out
afterward, meaningfully increases how often shares actually credit the
business.

## AI-assisted real estate discovery — a forward-looking companion to the Franchise List

The Franchise List (already established) shows a business where they
**currently** have presence — screens, Hubs, locker locations. This
adds the forward-looking complement: through their business profile,
owners get **AI assistant access (V4) to see available real estate
and expansion opportunities** — open screen placements, available
Port Station partnerships, unclaimed Hub locations — not just track
what they already have.

```
AvailableRealEstateQuery {
  businessId
  aiAssistantAccess: boolean  // powered by V4, per its existing role
  availableOpportunities: [{
    locationType: "screen" | "hub" | "port-station" | "business-locker"
    locationAddress: string
    estimatedValue: string  // AI-generated estimate based on real
                              // foot-traffic/demand data at that location
  }]
}
```

**Direct fit with existing infrastructure**: this is V4's AI agent
layer (already established) applied to a specific, concrete business
use case — the same conversational AI already planned for the
ecosystem, now answering "where could I expand next" using real data
already tracked in DREAMS' real estate/screen network.

## Continuous, proactive — not a static lookup tool

The real value here is the assistant surfacing suggestions
proactively, not waiting for the business owner to think to check.
Most owners won't regularly browse an available-real-estate page — but
they will notice if their own assistant proactively flags something
like *"a screen opened up two blocks away with strong customer overlap
with your business"* or *"your VDP Digital Twin has plateaued —
adding a second screen would likely unlock the next tier."* This is
the real, meaningful difference between a passive directory and an
active growth advisor.

```
ProactiveBusinessSuggestion {
  businessId, suggestionType: "nearby-opportunity" |
    "twin-level-plateau" | "underused-revenue-stream" | "seasonal-timing"
  generatedAt: timestamp, viewed: boolean, actedOn: boolean
  suggestionText: string  // AI-generated, specific and actionable
}
```

**Build implication for Claude Code**: this should be architected as
an ongoing recommendation engine running in the background — checking
a business's real data (Franchise List, revenue-stream utilization,
Digital Twin level, nearby available opportunities) on a regular
cadence and surfacing genuinely relevant suggestions proactively —
not a search page the owner has to remember to open.

## Confirmed: FaceTime-style calling extends to these business features

Since both the proactive suggestion engine and the real estate
discovery feature are built directly on V4 (already established), they
automatically inherit V4's existing **FaceTime-style agent call flow
(ring → live call → text fallback)** — a business owner isn't limited
to reading a text notification about a suggestion; they can have a
real, live conversation with the AI about it, the same call experience
already built for V4 generally, just applied to business-suggestion
conversations specifically. No new capability needs to be built — this
is confirming an existing V4 feature applies here too, not adding
something new.

## Tier-gated — the "true" dedicated AI assistant is a real unlock, not universal

Confirmed: full, dedicated AI assistant access (proactive suggestions,
live FaceTime-style calls specifically about the business) is gated
behind a real tier, not available at every level. This maps directly
onto the **already-established Digital Twin Level system** — Level 3
already explicitly unlocks "AI Business Intelligence." Rather than
inventing a separate tier system, this feature set is the concrete
realization of that existing Level 3 unlock, keeping the tiering
consistent across the ecosystem instead of creating a second, competing
tier structure.

## Honest capacity check — a real, necessary cost consideration

Worth addressing directly rather than assuming infrastructure scales
for free: V4 runs on real Claude API usage (already established), and
running a genuinely proactive assistant — continuous background checks
across every eligible business, plus live call capability on demand —
is real, usage-based cost that scales with how many businesses actually
reach Level 3 and use the feature. This needs to be planned as a real,
ongoing operational expense, the same honest treatment already applied
to Google Maps Platform's usage-based API costs and the Photorealistic
3D Tiles pricing — not assumed to be free just because the underlying
capability already exists elsewhere in V4. Recommend confirming real,
current Claude API pricing directly and modeling cost per active
Level-3 business before this feature goes live at scale, the same
diligence already applied to every other usage-based cost in this
project.

## Applicability to VENVS and CHOPZ sellers without a physical location

Confirmed: VENVS Marketplace and CHOPZ sellers get access to this same
stack even without owning a physical location — but honestly, not all
twelve streams transfer cleanly, since some genuinely require a real,
visitable space.

**Applies directly, no physical location needed:**
- Vavlt Stvdios streaming (product demos, unboxing, live selling)
- VDP virtual storefront (already the standard model for online sellers)
- Business Locker + drone fulfillment (the entire point of this system
  — a seller rents storage at a VOID Hub without needing their own
  retail space)
- Community thread opt-in
- DREAMS screen ad/DTC revenue (a seller's products can appear on
  other businesses' or VOID's own screens without owning a screen)

**Genuinely requires a real, physical, visitable location — doesn't
transfer to online-only sellers directly:**
- Hunt participation (needs a real checkpoint)
- CVNVO date-location placement (can't date a website)
- HVNTZ Yelp-style discovery (specifically about discovering physical
  places)
- Package pickup destination (Amazon Hub Counter model — needs real
  staff at a real counter)

**For the physical-only streams**: an online-only seller can still
participate by partnering with an actual HVNTZ physical location,
using the same Business Locker/Hub relationship already available to
them, rather than being excluded outright.

## The Franchise List — a real dashboard for businesses with multiple locations

Since a single business can now be tied to multiple screens, multiple
Business Lockers, and multiple Hubs simultaneously (per the revenue
stack above), their existing business analytics dashboard should
include a real **Franchise List** — one clear view of every location
they're connected to, with real per-location performance data.

```
FranchiseListEntry {
  id, businessId
  locationType: "screen" | "hub" | "business-locker"
  locationId: string, locationAddress: string
  revenueGenerated: number  // per-location, per revenue stream
  activityProduced: string  // what this specific location handles —
                              // e.g., "ad display + DTC sales" for a
                              // screen, "inventory storage +
                              // fulfillment" for a Business Locker
}
```

**Direct example, matching the scenario just described**: a business
with two screens and involvement at two Hubs would see four distinct
entries in their Franchise List — each showing its real location and
what it specifically produces (ad/DTC revenue for the screens, storage/
fulfillment activity for the Hubs) — rather than one flattened total
that hides where the value is actually coming from.

**Direct fit with existing infrastructure**: this extends the shared
analytics dashboard component already identified in the Ecosystem-Wide
Shared Systems Review, applied specifically to HVNTZ business owners
managing a distributed footprint.

## Tiered location participation — businesses aren't limited to their own hunt location

A business isn't restricted to only earning at their own physical
HVNTZ location — they can pay for expanded presence at other VOID
Hub/VMall locations, at a tier matched to what they pay, and receive
the **same real revenue-sharing treatment (scans, DTC commission) as
if it were their own hunt location.**

**Three real participation levels:**

1. **Base — their own hunt location**: the standard revenue stack
   already established, no additional fee.
2. **Paid expanded presence — a screen or Hub that isn't their own
   location**: the business pays a real fee (a larger percentage
   yields more screen time/priority placement), and in return receives
   a genuine share of that location's scans and DTC sales — the same
   real treatment their own location gets, just purchased rather than
   inherent to a hunt checkpoint they own.
3. **Hub-as-store — treating a VMall/Hub as a dedicated presence
   point**: for a high enough participation tier, a business can
   effectively establish a VMall/Hub location as equivalent to having
   "a store" there — full scan/DTC revenue share, not just partial ad
   time, functioning the same as their own hunt location would.

**Businesses can mix freely**: maintain their own hunt location while
also buying expanded presence at several other screens (marketing
into new areas), or participate in a Hub without owning a separate
physical hunt location at all — a real, flexible marketplace rather
than a fixed, one-location-only model.

```
LocationParticipation {
  id, businessId, locationId
  participationType: "own-hunt-location" | "paid-screen-presence" |
    "paid-hub-presence" | "hub-as-store"
  feesPaid: number  // higher tier = higher fee, more screen time/
                      // priority, larger revenue share
  scanRevenueShare: number  // percentage, scales with participation tier
  dtcRevenueShare: number  // percentage, scales with participation tier
}
```

**Direct fit with the Franchise List**: a business's Franchise List
now shows every location they participate in, regardless of type —
their own hunt location alongside any paid screen or Hub presences,
each with its own real revenue and participation-tier data, giving a
complete picture of a business's full distributed footprint.

## Status
Reference document — this is the definitive summary of an already-
fully-specified revenue structure spanning HVNTZ, DREAMS, VOID,
Vavlt Stvdios, and VDP, now including the Franchise List dashboard
view and the tiered location participation model. No new systems;
this consolidates what's already real and buildable into one clear
picture for both Claude Code and business-facing pitch materials.

## Digital twin auto-scaling — real-world growth automatically upgrades VDP

A core principle worth locking in: **a business's digital twin tier in
VDP should be a computed value derived directly from their real-world
Franchise List, not a separate purchase decision made inside VDP.**
More real-world screens, more Hub participation, or a higher
participation tier automatically improves their digital twin's
package/tier — genuine "as above, so below" symmetry between real
growth and the digital duplicate.

**Direct mechanic**: the Digital Twin Level system already established
(Level 1-3, with Level 3 unlocking Vavlt Stvdios streaming + AI
Business Intelligence) should read from `FranchiseListEntry` and
`LocationParticipation` counts/tiers to determine or boost the twin's
actual level automatically, rather than requiring the business to
separately upgrade inside VDP.

```
DigitalTwinAutoScale {
  businessId
  realWorldScreenCount: number  // pulled from FranchiseListEntry
  realWorldHubParticipationTier: string  // pulled from LocationParticipation
  computedTwinLevel: number  // derived, not manually set — grows
                               // automatically as real-world footprint grows
}
```

**Why this matters**: it removes friction and creates a genuine,
automatic incentive — a business investing in real-world expansion
sees an immediate, visible reward in VDP without a separate decision
or purchase, reinforcing that growing in the real world and growing in
VDP are the same growth, not two parallel efforts.
