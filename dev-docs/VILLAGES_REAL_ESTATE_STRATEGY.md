# The Villages: real-estate acquisition strategy (VACAY / VOID / DREAMS)

**What this document is.** A real-world VACO company business and
real-estate strategy — actual property acquisition, actual physical
construction, actual deployment of VACAY/VOID/DREAMS infrastructure
onto real land. **This is not fictional content and does not belong
to any single app's own lore or architecture docs.** Filed here per
`VACO.md`'s own stated exception: "a document that genuinely governs
the whole ecosystem and belongs to no single app goes in `dev-docs/`."

**Classification (per `VACO.md`'s own Part 1 rule): STRUCTURE-ONLY.**
Positioning and site strategy, not a build spec. Nothing in this
document specifies software behavior a service implements; it is
filed immediately per that rule, but — also per that rule — generates
no code and is handled last.

**Implementation status: NOT BUILT.** No code anywhere in this
repository implements any part of this document. No acquisition
pipeline, no per-location tier system, no screen-registration rule
tied to a physical site, no VOID Port Station wiring for a Villages
location exists today. Every real system named below (VACAY's own
hotel/stay listings, VOID's own Hub/Port Stations, DREAMS' own screen
registration, VXLLAGE's own rideshare hooks) already exists in code
as a *generic* mechanism; nothing here has yet been pointed at it.

**A real naming collision, flagged so it is never mistaken for the
same thing**: `vxllage/dev-docs/phase-2-villages/` builds a
completely unrelated software feature also called "Villages" — a
social-app community/group feature (membership, events, creator-owned
rooms), modeled on Clubhouse Clubs. That is VXLLAGE's own in-app
concept. **This document's "Villages" is physical real estate** — an
actual development built on actual acquired land. Same word, two
unrelated real things; do not conflate them.

**A second, related but distinct thing this also is NOT**: VDP
(`vdp/VDP_FOUNDING.md`) is a fictional in-game world — "a real, hidden
place on Earth... beyond Antarctica's ice wall." Two of this
document's own sections were briefly, mistakenly recorded inside
`vdp/VDP_FOUNDING.md` before being corrected and moved here. Per
direct instruction: "The things I'm speaking on are actual real life
things that have to do with the Vaco app, not the VDP. So don't mix
the two up." VDP may eventually depict a fictionalized version of
real VACO business operations the way it already depicts VOID Hub
Stations and VACAY hotels generically — but that is a separate,
future decision, not something this document assumes.

---

## 1. The real-world precedent and model

Per direct instruction: "we will be doing a similar operation to the
operation in the streets of St. Charles, Beale Street, which is about
27 acres of shopping area, walkable shopping area mixed with
residential, hotels, commercial. We will be doing that same similar
operation, but more technical, more technology based with our
business inside those."

**Confirmed by research (15 Oct 2026)**, per direct instruction to
look into it: "Streets of St. Charles" and "Beale Street" are
confirmed the same real place, not two — Beale Street is a named
section/brand inside the Streets of St. Charles development (the
Beale Street Concert Series, a monthly Beale Street Market), by
Hollywood Casino, in St. Charles, Missouri.

- **Streets of St. Charles**: a real, 27-acre mixed-use development in
  St. Charles, MO, replacing the former Noah's Ark Hotel (demolished
  2007). Dining, shopping, nightlife, hotels, and apartments, just
  off I-70 at South Fifth Street.
  ([discoverstcharles.com](https://www.discoverstcharles.com/things-to-do/attractions/streets-of-st-charles))
- **Nearby casinos**: Hollywood Casino + Hotel (~2M annual visitors,
  2024) and Ameristar Casino (~5.5M annual visitors, 2024), plus the
  Hollywood Casino Amphitheatre.
  ([LoopNet listing/site map](https://www.loopnet.com/Listing/beale-st-saint-charles-mo/30288469/))

This is the one real-world reference point for "how much a modest-
acreage, walkable, mixed-use site can actually hold" that this whole
Villages strategy is built from. (Note: `vdp/VDP_FOUNDING.md`'s own
`src/lib/cityTiers.js` separately cites this same real St. Charles
precedent — there, to justify a *fictional* in-game design decision,
`casinoEligible: true` on every tier of VDP's own `CITY_TIERS`. Same
real place, two unrelated uses — one real business strategy, one
fictional game-balance justification. Do not conflate them either.)

The real operation: the same walkable mixed shopping/residential/
hotel/commercial model, but "more technology based with our business
inside those" — VACAY, VOID, and DREAMS infrastructure built into the
development itself, not bolted on after.

## 2. The product name: "The Villages of [Area]"

"They will be called the villages of whatever area that is" — each
development is named **The Villages of `<Area>`**, `<Area>` being
wherever it is actually built. Not a single product; a repeatable
real-estate format, duplicated location to location.

"We would just duplicate the process and put what needs to be put in
that location" — the build-out itself scales to the site (see §5
below on screen density), but the underlying playbook (walkable mixed
use + VACAY/VOID/DREAMS infrastructure) repeats as-is.

## 3. Starting market: St. Louis, North County

Per direct instruction: "we will be setting up, we will be buying
property starting in St. Louis first... but starting in the
Jamestown, old Jamestown Mall area in St. Louis, Missouri, North
County, which is 144 acres."

**Confirmed by research (15 Oct 2026)**: the former Jamestown Mall
site matches this closely.

- **Acreage**: sources vary 140–145 acres (St. Louis County cites 142;
  CBRE's own marketing materials say 144+; a 2024 Port Authority RFP
  said ~140) — the user's own 144-acre figure sits inside that real
  range.
- **Location**: North Highway 67 and Old Jamestown Road, unincorporated
  north St. Louis County, near Florissant, MO 63034.
- **Status**: the ~1.2M-sq-ft mall structure is fully demolished; the
  site was reported cleared and ready for redevelopment as of October
  2025. The St. Louis County Port Authority owns the land.
- **For sale, actively marketed**: the Port Authority hired CBRE as
  exclusive sales agent in early 2026; CBRE says it has marketed the
  site to 35,000+ developers and investors. Zoned for commercial and
  residential use. No developer has been selected yet, and public
  meetings are planned before one is.
- **Prior deal fell through**: a $75.8M NorthPoint logistics-park
  proposal collapsed after a St. Louis County councilwoman objected,
  citing resident preference for mixed-use development instead — a
  real, recent precedent for exactly the kind of walkable mixed-use
  format this document describes being favored over logistics/
  warehouse use at this specific site.
- **Nearby**: the 425-acre St. Louis Zoo Wildcare Park is set to open
  adjacent to this site in 2027.

Sources: [Demolition complete, site cleared](https://www.yahoo.com/news/articles/demolition-complete-jamestown-mall-cleared-230353125.html),
[CBRE named exclusive sales agent](https://www.connectcre.com/stories/cbre-appointed-exclusive-sales-agent-for-former-mall-site-in-st-louis/),
[CBRE listing page](https://www.cbre.com/properties/properties-for-lease/land/details/US-SMPL-196841/jamestown-mall-redevelopment-101-jamestown-mall-florissant-mo-63034),
[KSDK on the NorthPoint collapse](https://www.ksdk.com/article/news/local/business-journal/jamestown-mall-redevelopment-roadblock-councilwoman-objects/63-64556b32-e3b0-4a02-9c56-66a804fb783d).

**Beyond the Jamestown Mall site itself**: "there's also other
locations off around that area that we will start with in the North
County area... I have probably maybe about 20 different locations I
want to start with and kind of build something like a uptown in North
County, St. Louis, Missouri." Read as: Jamestown Mall is the lead/
anchor site, with roughly 20 total North County locations as the real
starting footprint — not one site alone. The other ~19 sites are not
yet named.

**Beyond St. Louis**: "we will try to repeat these processes in
different places in all over the country" — North County, St. Louis
is the named starting point, nationwide expansion is the stated
intent, with no other specific markets named yet.

## 4. All locations connected through VOID

"All these locations will be connected in some way, even if it's just
through a small ride share, and we will have a ride share that
attaches these locations together through the Void Network." A real,
named requirement: every Villages location, however small, is reachable
from every other one via a real VOID-network rideshare connection —
not an isolated development. VOID's own real `reserveBooking.js`/
`commuteScheduling.js` ground-transport booking (already the generic
mechanism VDP's own `cityTiers.js` cites for rideshare beyond a
walkable radius) is the nearest existing real hook; nothing here wires
it to an actual inter-Villages route yet.

## 5. Screen density, scaled by acreage

"We will be loading those areas up with screens, and that will be a
1-10 scale or 1-5 scale operation depending on how big the acreage is
on the land... anything from probably 1 to 2 acres all the way up to
as many acres as we can." The scale itself is left ambiguous by the
user's own words (1-5 or 1-10) — not resolved here. The real range of
site sizes is also stated directly: from as small as 1-2 acres up to
"as many acres as we can" (Jamestown Mall at 144 acres being the
largest named instance so far).

"The dream screen will speed up the process a lot, also with adding
in the sales and the businesses... will also make the apps grow
faster." Real business rationale, not flavor: DREAMS screens deployed
at a Villages location are meant to accelerate both local business/
sales activity at that site AND adoption of the VACO apps generally.
This is the real justification for loading up even small sites with
screens rather than reserving them for the largest developments only.

## 6. VOID Hub infrastructure within the Villages

Per direct instruction, the following VOID Hub features are meant to
be deployed at Villages locations (some hub features depending on hub
size):

- **Vhaul** — rentable automated delivery trucks at some VOID hubs,
  rented through the app or in person, depending on hub size.
- **Storage space for rental** at every VOID hub location, even a
  small amount at the smaller ones.
- **VOID Hub Truck Stops** — a hub variant closer to downtown areas,
  combining every standard VOID hub operation with a real truck
  parking area (for VACAY and VOID trucks), DREAMS screens, VOID hub
  food operations, and automated car washes (a regular automated wash
  if the hub is large enough, scaling up to a full truck wash at the
  largest truck-stop-sized hubs).
- **Container hotel rooms** — roughly 20 variations of small hotel
  rooms built from 20-foot shipping containers, at some VOID hubs
  without the trucking component. Two real deployment contexts named
  directly: some as VACAY rental container parks, some at VOID truck
  hubs. Either way, connected to VACAY, VOID, and the DREAMS Network.
- **VOID pickup stations at every Villages location.** Checked against
  VOID's own real source (`void/lib/stations.js`, `void/CLAUDE.md`):
  VOID's own naming convention has no literal "pickup station," but
  has exactly this real concept under a different name — **VOID Port
  Stations** ("the drone-specific stations: landing, charging,
  package pickup/drop-off"), distinct from **VOID Hub Stations**
  (`stationType: 'hub-and-port'`, the general logistics backbone). A
  flagged reading of the user's own words against VOID's own real
  vocabulary, not confirmed by direct instruction as exactly that
  mapping.

The existing `registerVoidHub`-style station registration (VDP's own
`server.cjs` already calls this generically for its own fictional
town) is the nearest real code hook for the Hub/Port Station side;
Vhaul, storage rental, truck stops, and container hotel rooms have no
real mechanic anywhere yet.

## 7. Container-home "villas" on scattered smaller urban plots

Per direct instruction, a separate, smaller-scale real-estate format
under the same Villages umbrella, aimed at urban infill rather than
one large anchor site: "a smaller version or a more container home
version of the villages, but put on smaller city blocks, like in St.
Louis's LRA properties, which are small plots of land all over St.
Louis."

St. Louis's real Land Reutilization Authority (LRA) — the city's real
inventory of scattered, individually small vacant/tax-delinquent
lots across the city — is the named real-world model for how this
format sits in an urban footprint: many small, dispersed sites, not
one large complex the way the Jamestown Mall anchor site is.

- **Acquisition plan, stated plainly**: "we will try to acquire all
  the schools that are for sale and all the land that is for sale."
  Real intent; no acquisition pipeline exists anywhere in this
  codebase.
- **The villas themselves**: container homes, "up to a certain size
  and different architecture, but with similar accents" — a villa is
  internally consistent in its own accent/style even if individual
  unit architecture varies. Real size cap and the accent details
  themselves are not yet given.
- **Unit mix varies by villa**: "they will have a connected, they
  will be different bedrooms. Some will be condos, some will be
  apartments, depending on what the villa is" — read as: a given
  villa is internally consistent in unit TYPE (a condo villa, an
  apartment villa, a multi-bedroom villa), not that every villa mixes
  all three.
- **Shared amenities, per villa**: "some type of shared entertainment
  space, sitting area, barbecue area, vending area, things of that
  nature" — real, named categories; "things of that nature" is the
  user's own open door for more, not a closed list.
- **Connects to VACAY and VOID** — the user's own stated integration
  point, not a fourth, separate system.

## 8. Per-hotel-room screens

"With each one of those hotel rooms, each room will have a screen
outside and on the inside. One outside, like on the patio or on the
side of it, and then there also will be a screen on the inside." A
real, specific placement rule: **two DREAMS screens per hotel room**,
not one — more granular than any existing screen-count rule anywhere
in this ecosystem. VACAY's own real stay-listing mechanism is the
nearest hook (a Villages hotel room would presumably be a VACAY
listing); nothing currently ties a screen count to a listing.

## 9. Vulture Music / Vulture Flix incorporated, even free

"Also incorporating like the Vulture music and the Vulture flicks in
all of these locations, even if it's for free, if you're in those
locations, still it's pushing all the apps through these actual real
estate deals." A real, stated rationale: giving these two apps away
free at Villages locations is itself a growth/adoption mechanic for
those apps, paid for by the real-estate deal's own foot traffic, not
expected to generate direct revenue at these sites on its own.

## 10. The real business rationale, kept verbatim

"These villages will be the basis for all of our business operations
and our pushing for our apps and our things of that nature." "Mixing
the real estate with the tech will extend our operations faster and
help us improve with the tech and push it faster." "Real estate mixed
with the technology will help these real estate locations produce
income faster, which builds value faster." The stated thesis: VACO
apps deployed onto owned real estate accelerate the real estate's own
income/value, and the owned real estate accelerates the apps' own
adoption — each side compounding the other, not two separate bets.

---

## What is still open

- Which ~19 other North County locations, beyond the Jamestown Mall
  anchor site, are being targeted — not yet named.
- Whether the screen-density scale is 1-5 or 1-10 (the user's own
  words leave this ambiguous).
- Whether that scale is tied purely to acreage, or correlates with any
  existing walkable-radius tiering concept elsewhere in this
  ecosystem — not established either way.
- The real container-villa size cap, its accent/architecture details,
  and the real acquisition mechanic for schools/land for sale.
- The real per-room screen registration mechanic (which system
  actually creates the two real DREAMS screen records per hotel room).
- Whether "VOID pickup stations" maps exactly to VOID's real Port
  Stations (the flagged reading in §6) or means something else.
- Which hub sizes qualify for Vhaul, storage rental, truck-stop
  conversion, and container hotel rooms, and at what real pricing.
- Markets beyond St. Louis/North County — "all over the country" is
  the stated intent, with no other specific markets named.
