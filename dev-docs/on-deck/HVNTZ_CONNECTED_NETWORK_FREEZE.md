# HVNTZ HUNTS — CONNECTED NETWORK + MULTI-PERSON STREAMING EXPANSION

STATUS: ADDITIVE MASTER FREEZE — **filed 23 Sep 2026, on deck.** Owner's
instruction: file it now, finish the VACON-C game work first.

Verbatim as frozen by the owner. Do not edit the text below; it is the
specification, and an edited copy is a different specification.

**Nothing here is built.** The freeze's own §40 (NO DUPLICATION RULE)
and §47 (IMPLEMENTATION PRIORITY) both require an audit of the existing
HVNTZ/VACO implementation before any code is written, and that audit has
not been started. Note that the on-deck audit already recorded HVNTZ as
having a real surface (40 routes) — see this folder's README — so the
"extend, do not rebuild" instruction has something concrete to extend.

---

## BUILD DIRECTIVE

This document is an ADDITIVE MASTER FREEZE for the existing HVNTZ Hunts application.

DO NOT REBUILD THE EXISTING HVNTZ SYSTEM.

Everything already implemented, tested, connected, or architecturally established remains intact.

Do not replace existing:

* authentication
* user identity
* VACA verification
* avatars
* VASH
* VCoin
* wallet infrastructure
* notifications
* messaging
* search
* QVAN security
* V4
* ARIES
* MIA
* VACON
* DREA
* maps
* routing
* analytics
* advertising
* business accounts
* business tiers
* DREAMS
* Vault Studios
* VOID
* VDP
* existing Hunts
* Hunt Builder
* Hunt Engine
* checkpoint system
* rewards
* sponsorships
* existing APIs
* existing database models
* existing design system
* existing testing infrastructure

ONLY IMPLEMENT THE NEW FUNCTIONALITY DESCRIBED BELOW AND INTEGRATE IT INTO THE EXISTING SYSTEMS.

If an existing system already performs a required function, EXTEND/REUSE IT instead of creating a duplicate.

---

## 1. NEW CORE CONCEPT

Add a new Connected Network Layer to HVNTZ Hunts.

Working terminology:

NETWORK HUB

The primary business, venue, event, organization, creator, or location establishing the network.

NETWORK NODE

Any authorized person, camera, room, creator, business, service provider, event, or stream connected to the Hub.

STREAM NODE

A Network Node that has an active Vault Studios streaming presence.

CAMERA NODE

A physical or virtual camera perspective assigned to a business, venue, event, person, or Hunt.

CREATOR NODE

A person with an authorized individual or professional Vault Studios presence.

NETWORK

A permissioned collection of connected Hubs, Nodes, cameras, creators, streams, events, and commercial relationships.

The terminology may evolve during implementation, but the architecture must support these relationships.

---

## 2. BUSINESS HUB EXAMPLE

Example:

A nightclub joins HVNTZ Hunts.

The club has:

* 3 bartenders
* 1 DJ
* 2 hosts/promoters
* 1 primary venue
* up to 8 camera positions

The business can create a connected network.

Example:

THE STANDARD ROOFTOP NETWORK

Hub:

* The Standard Rooftop

Connected people:

* Bartender A
* Bartender B
* Bartender C
* DJ
* Host A
* Host B

Connected camera positions:

1. Main Room
2. DJ Booth
3. Bar 1
4. Bar 2
5. Bar 3
6. Host/Promoter 1
7. Host/Promoter 2
8. VIP / Special Area

Each authorized camera can become a selectable Hunt/stream destination.

---

## 3. EIGHT-CAMERA HUNT ARCHITECTURE

The existing eight-camera concept is retained.

Expand it so that cameras are no longer simply static cameras.

Each camera can have:

* camera ID
* location
* room/zone
* assigned business
* assigned person
* assigned role
* current status
* live/offline state
* Hunt availability
* Vault Studios availability
* public/private visibility
* premium status
* access restrictions
* schedule
* permissions
* analytics
* revenue attribution
* network membership
* event association

Example:

Camera 3

Bar 1

Assigned Node:

Bartender A

Network:

The Standard Rooftop

Status:

LIVE

Hunt:

AVAILABLE

Vault:

LIVE

Premium:

YES

This information should be managed through existing business/admin infrastructure.

---

## 4. PERSON-BASED STREAMING

A major addition is the ability for a business to connect individual people to its streaming environment.

For example:

The club does not merely stream "The Club."

It can expose authorized streams such as:

* DJ stream
* Bartender A stream
* Bartender B stream
* Bartender C stream
* Host A stream
* Host B stream

The person may be:

* physically represented by a camera
* operating a camera
* assigned to a fixed camera
* using a mobile device
* using another approved streaming device

Do not assume every person requires a separate physical camera.

The architecture should support multiple device/camera configurations.

---

## 5. CONNECTED NETWORK / "SERVER" CONCEPT

The user experience should feel similar to joining or navigating a connected community/server.

However, do not simply copy another platform's implementation.

Create a VACO-native concept:

CONNECTED NETWORK

A Network provides:

* members
* channels
* streams
* cameras
* rooms
* events
* Hunts
* chat/messaging where existing infrastructure permits
* announcements
* memberships
* premium areas
* sponsorships
* advertising
* network analytics
* revenue attribution

A user could enter:

The Standard Rooftop Network

and see:

* Main Venue
* Live DJ
* Bartender A
* Bartender B
* Bartender C
* Host A
* Host B
* Current Hunt
* Upcoming Hunt
* VIP stream
* Premium content
* Network events

---

## 6. NETWORK-TO-NETWORK CONNECTIONS

A person or creator should be able to participate in multiple networks where authorized.

Example:

DJ Marcus belongs to:

The Standard Rooftop Network

and also has:

DJ Marcus Creator Network

The DJ's network might connect to:

* The Standard Rooftop
* Club B
* VENVS
* private events
* festivals
* Vault Studios productions
* sponsored Hunts

This creates a connected ecosystem rather than isolated business accounts.

Permissions and agreements determine what information and streams can cross between networks.

---

## 7. NETWORK MEMBERSHIP PERMISSIONS

Create permission levels.

Potential roles:

* Network Owner
* Network Administrator
* Business Manager
* Creator
* Employee
* Contractor
* Host
* Promoter
* DJ
* Bartender/Service Provider
* Camera Operator
* Event Manager
* Sponsor
* Partner
* Viewer
* Premium Member

Permissions must determine:

* who can stream
* who can view
* who can create content
* who can access cameras
* who can create Hunts
* who can manage a Hunt
* who can monetize content
* who receives revenue attribution
* who can invite additional nodes
* who can connect another business
* who can disconnect a node

Reuse existing VACA/VASH/security/identity infrastructure.

---

## 8. VAULT STUDIOS INTEGRATION

Vault Studios remains the streaming infrastructure.

Do NOT create another streaming platform.

HVNTZ Hunts simply gains deeper integration with Vault Studios.

Every eligible Network can connect to Vault Studios.

A business may select:

VAULT STREAMING LEVEL 1

STANDARD STREAMING

Normal Vault Studios access.

The business can use the existing Vault Studios streaming screen options:

* Screen 1
* Screen 2
* through
* Screen 8

depending on its business tier/subscription.

---

## 9. VAULT PAYWALL LEVEL

Add the existing planned premium content architecture:

LEVEL 2 — PREMIUM / PAYWALL

Patreon-style functionality.

Businesses and creators can place selected content behind a membership/paywall.

Potential content:

* exclusive Hunts
* behind-the-scenes content
* extended streams
* VIP events
* special performances
* private venue streams
* premium creator content
* exclusive interviews
* special events
* premium camera perspectives

This is an access/monetization layer on top of Vault Studios.

Do not duplicate Vault Studios.

---

## 10. ADVANCED CREATOR SUBSCRIPTION LEVEL

LEVEL 3 — ADVANCED CREATOR / PREMIUM SUBSCRIPTION

Add support for a more advanced creator subscription model comparable in concept to platforms where creators sell premium access to exclusive content.

This must use:

* age gating where applicable
* identity verification
* creator verification
* payment controls
* privacy controls
* content policies
* moderation
* reporting
* access controls
* subscription management
* existing VACA/VASH/security infrastructure

Do not hard-code the system to one content category.

The architecture should support legitimate creator businesses, premium entertainment, exclusive events, and other permitted content.

---

## 11. HUNT CAMERA INTEGRATION

A Hunt checkpoint can now connect to authorized Network Nodes.

Example:

CHECKPOINT

The Standard Rooftop

Instead of only:

"Go to The Standard Rooftop."

the Hunt can expose:

LIVE NETWORK

* Main Floor
* DJ Booth
* Bar 1
* Bar 2
* Bar 3
* Host 1
* Host 2
* VIP

A user can select an available stream.

This becomes a digital preview/interactivity layer surrounding the physical Hunt.

---

## 12. LIVE HUNT ENVIRONMENT

A Hunt may contain:

* physical checkpoints
* digital checkpoints
* live camera checkpoints
* QR checkpoints
* NFC checkpoints
* geofence checkpoints
* answer checkpoints
* business verification
* creator interaction
* event interaction
* streaming interaction
* premium checkpoints

Existing verification systems remain unchanged.

Add new verification capabilities only where required.

---

## 13. LIVE STREAM → HUNT CONNECTION

A live stream can be associated with a Hunt.

Example:

A DJ is streaming from a club.

The Hunt may say:

CHECKPOINT 4

"Find the song currently playing."

The user watches/listens to the authorized stream and then physically visits the location or completes the configured verification.

This allows the digital environment to help drive the physical Hunt.

---

## 14. HUNT → NETWORK CONNECTION

The reverse must also work.

A Hunt can introduce users to the Network.

Example:

User arrives at:

The Standard Rooftop

They complete the checkpoint.

The Hunt can show:

You're now at a Network location.

Available:

* Live venue stream
* DJ
* bartenders
* hosts
* current event
* upcoming Hunts
* premium content
* rewards
* business profile
* Vault Studios

This turns every Hunt location into an entry point into the broader digital network.

---

## 15. NETWORK REVENUE ENGINE

Add a Network Revenue Pool architecture.

Revenue may originate from:

* standard streaming
* subscriptions
* premium subscriptions
* paywalls
* creator memberships
* advertising
* sponsorships
* Hunt participation
* sponsored Hunts
* VCoin activity
* tickets
* events
* merchandise
* premium camera access
* business subscriptions
* creator subscriptions
* digital real-estate activity

The existing VACO/VASH/VCoin financial infrastructure remains the settlement foundation.

---

## 16. REVENUE ATTRIBUTION

The system must be able to track where economic activity originated.

Example:

A viewer enters:

The Standard Rooftop Network

→ watches DJ Marcus

→ subscribes to premium content

→ watches a sponsored Hunt

→ completes the Hunt

→ visits the club

→ purchases a reward/item

The system should retain attribution information for analytics and applicable revenue-sharing agreements.

Possible attribution dimensions:

* Network
* Business
* Creator
* Person
* Camera
* Stream
* Hunt
* Checkpoint
* Event
* Sponsor
* Advertisement
* Subscription
* Premium content

---

## 17. NETWORK REVENUE SHARING

Do not hard-code one universal percentage.

Create configurable revenue-sharing agreements.

Example:

A business can establish:

Network Agreement

Business:

50%

DJ:

15%

Bartender Network Pool:

15%

Hosts:

10%

Creator/production:

5%

Platform:

5%

These numbers are ONLY an example.

Actual percentages must be configurable by agreement and subject to applicable contracts, platform fees, taxes, payment rules, and VACO financial controls.

The system should support:

* fixed percentages
* fixed amounts
* tiered percentages
* performance bonuses
* event-specific splits
* Hunt-specific splits
* creator-specific splits
* sponsor-funded rewards
* time-limited agreements

---

## 18. NETWORK GROWTH ECONOMICS

The larger the legitimate network, the more opportunities exist for:

* viewers
* creators
* businesses
* advertisers
* sponsors
* Hunts
* subscriptions
* events
* commerce

But network size alone must NOT automatically guarantee revenue.

Revenue is generated from actual economic activity.

Analytics should show:

* network size
* active nodes
* active creators
* active streams
* viewers
* watch time
* Hunt participation
* conversions
* subscriptions
* advertising
* sponsorship
* revenue
* revenue attributed to each node

---

## 19. NODE INVITATION SYSTEM

Existing notification/invitation infrastructure should be extended.

A business can invite:

* bartender
* DJ
* host
* promoter
* creator
* event partner
* another business

The invited person receives the existing notification.

They can:

* accept
* decline
* review permissions
* review revenue agreement
* connect existing creator account
* create/claim a creator profile if permitted

Do not create duplicate accounts if the person already exists in VACA.

---

## 20. NODE SCHEDULES

Nodes can have schedules.

Example:

Bartender A:

Friday:

6 PM–2 AM

Bartender B:

Saturday:

6 PM–2 AM

DJ:

Friday:

9 PM–2 AM

Host:

Friday:

8 PM–1 AM

The system can automatically determine which node/camera should be available during a Hunt or stream.

---

## 21. TEMPORARY EVENT NETWORKS

Networks should also work for temporary events.

Example:

Summer Festival Network

Connected for three days:

* 20 businesses
* 15 creators
* 40 cameras
* 10 Hunts
* 5 sponsors

After the event, the event network can be archived while the underlying businesses and creators remain active.

This should use existing VACO event/business infrastructure where available.

---

## 22. MULTI-BUSINESS NETWORKS

A Network does not have to belong to one business.

Example:

DOWNTOWN NIGHTLIFE NETWORK

Connected:

* Club A
* Club B
* Restaurant C
* Lounge D
* DJ Network
* Promoter Network
* Hotel E

One Hunt can move users through several members of the network.

Each participating business remains independently identifiable.

---

## 23. HUNT NETWORK PACKAGES

Businesses should eventually be able to create packages such as:

BASIC HUNT NETWORK

* business profile
* Hunt checkpoints
* existing business tier
* basic stream integration

CONNECTED HUNT NETWORK

* multiple cameras
* multiple people
* live streams
* Network membership
* analytics
* Vault integration

PREMIUM NETWORK

* 8-camera environment
* premium streaming
* paywall
* creator channels
* sponsorship
* advanced analytics
* revenue-sharing agreements

These packages must map onto the existing business-tier architecture rather than creating a disconnected pricing system.

---

## 24. ADVERTISING

Network nodes become additional advertising inventory.

Potential placements:

* stream pre-roll
* stream overlays
* Hunt screens
* business screens
* digital real-estate displays
* Network pages
* event pages
* checkpoint experiences

Advertising remains connected to the existing VACO advertising infrastructure.

---

## 25. SPONSORSHIP

A sponsor can sponsor:

* entire Hunt
* checkpoint
* business
* camera
* stream
* Network
* event
* creator
* reward pool

Example:

Nike sponsors:

Downtown Night Crawl

Nike can appear across authorized Hunt/Network placements.

Sponsor budgets continue to use the existing escrow/reward architecture.

---

## 26. NETWORK ANALYTICS

Extend existing analytics.

Business dashboard should eventually show:

NETWORK

* total nodes
* active nodes
* live streams
* connected creators
* connected businesses
* active Hunts
* participants
* viewers
* watch time
* subscriptions
* premium members
* ad impressions
* sponsorship revenue
* Hunt revenue
* network revenue
* node-level contribution

Creator dashboard can show:

* views
* followers/members
* subscriptions
* watch time
* Hunt participation
* network revenue
* attributed revenue
* active agreements

---

## 27. USER EXPERIENCE

The user should be able to discover a Network through:

* Explore
* Discover
* Hunt
* Map
* Business profile
* Vault Studios
* VDP
* VENVS
* V4
* search
* recommendations

A Network should feel like a living digital environment.

---

## 28. MAP INTEGRATION

Use the existing V4 mapping infrastructure.

Network nodes may appear on the map where appropriate.

Examples:

* business
* Hunt checkpoint
* active stream
* event
* creator location
* Network location

Do not create another mapping system.

---

## 29. DREA INTEGRATION

DREA can eventually use Network information when generating Hunts.

For example:

DREA can identify:

* businesses
* active streams
* events
* participating creators
* cameras
* available checkpoints
* network density
* time of day
* expected traffic
* Hunt opportunities

DREA can propose:

"Create a nightlife Hunt connecting three businesses and seven active Network Nodes."

The existing DREA architecture remains the intelligence layer.

---

## 30. VOID INTEGRATION

The existing VOID connection remains.

A Hunt participant may use VOID for:

* transportation
* delivery
* package movement
* food
* goods
* runner services
* accessibility support
* event logistics

Network businesses can also become VOID affiliates.

Do not duplicate VOID functionality.

---

## 31. VDP / DIGITAL PLANET INTEGRATION

This feature is specifically part of the Digital Planet upgrade.

The physical business becomes a digital location.

The digital representation can contain:

* business
* people
* rooms
* cameras
* streams
* Hunts
* events
* creators
* advertisements
* subscriptions
* premium content
* commerce
* social connections

The goal is:

PHYSICAL LOCATION → DIGITAL LOCATION → CONNECTED NETWORK → LIVE EXPERIENCE

---

## 32. VENVS INTEGRATION

VENVS environments can use the same architecture.

Examples:

* resort
* casino
* lounge
* hotel
* restaurant
* entertainment venue
* event
* performer
* creator

A VENVS property can have its own Network.

Its Network can connect to:

* Hunts
* Vault Studios
* VDP districts
* creators
* events
* businesses
* premium experiences

Again: reuse existing VENVS infrastructure.

---

## 33. SOCIAL LAYER

Use existing social infrastructure.

Network users can eventually:

* follow Networks
* follow creators
* follow businesses
* follow Hunts
* receive notifications
* invite friends
* share Hunts
* share streams
* join premium memberships

Do not create a separate social platform.

---

## 34. SECURITY

All Network connections must inherit existing VACA/QVAN/security controls.

Required:

* verified identity where applicable
* role permissions
* camera permissions
* stream permissions
* content permissions
* account ownership
* revenue authorization
* audit logs
* revocation
* reporting
* moderation
* fraud detection

A person cannot access another person's camera merely because they belong to the same Network.

---

## 35. PRIVACY

Businesses and creators must control:

* camera visibility
* stream visibility
* public/private status
* premium access
* location exposure
* personal information
* recording permissions
* Network membership
* cross-network visibility

---

## 36. HUNT BUILDER ADDITIONS

Do not replace the existing Hunt Builder.

Add optional fields:

NETWORK

Select Network.

LIVE STREAM

Attach a stream.

CAMERA

Attach one or more cameras.

CREATOR NODE

Attach authorized creator.

NETWORK CHECKPOINT

Mark checkpoint as a Network experience.

PREMIUM ACCESS

Optional.

EVENT

Optional.

SPONSOR

Optional.

All existing Hunt Builder fields remain.

---

## 37. ACTIVE HUNT ADDITIONS

The existing Active Hunt screen remains.

Add optional cards:

LIVE NOW

View authorized stream.

NETWORK

Open connected Network.

CAMERAS

View available Hunt cameras.

CREATORS

View participating creators.

EVENT

View current event.

PREMIUM

Unlock if the user has appropriate access.

These should only appear when configured.

---

## 38. BUSINESS DASHBOARD ADDITIONS

Add a new:

NETWORK MANAGEMENT

Area.

It should eventually include:

* Network name
* Network status
* members
* nodes
* cameras
* streams
* creators
* Hunts
* events
* agreements
* revenue
* analytics
* permissions
* invitations

The existing Business Dashboard remains.

---

## 39. VAULT STUDIOS BUSINESS DASHBOARD

Add:

CONNECTED STREAMS

A business can see:

* all eight camera positions
* active stream
* assigned person
* assigned creator
* access level
* viewers
* revenue
* Hunt connections

Example:

Camera 1 — Main Room — 482 viewers

Camera 2 — DJ — 321 viewers

Camera 3 — Bar 1 — 108 viewers

Camera 4 — Bar 2 — 74 viewers

Camera 5 — Bar 3 — 91 viewers

Camera 6 — Host 1 — 52 viewers

Camera 7 — Host 2 — 64 viewers

Camera 8 — VIP — Premium

---

## 40. NO DUPLICATION RULE

This is critical.

Claude Code must inspect the existing HVNTZ/VACO implementation before writing new infrastructure.

If functionality already exists:

REUSE IT.

If an existing module can be extended:

EXTEND IT.

If an API already exists:

ADD TO IT.

If an existing database model can support the feature:

EXTEND THE MODEL.

If an existing Vault Studios stream system handles the stream:

CONNECT TO IT.

If VACA already identifies the person:

USE THAT IDENTITY.

If VASH/VCoin already handles economic settlement:

USE IT.

If V4 already handles maps:

USE IT.

If DREA already provides AI generation:

EXTEND IT.

Do not create parallel versions.

---

## 41. DATABASE ARCHITECTURE

Add only the minimum required new entities/relationships.

Potential concepts:

* Network
* NetworkMembership
* NetworkNode
* CameraNode
* StreamNode
* CreatorNode
* NetworkAgreement
* RevenueShare
* NetworkEvent
* HuntNetworkConnection
* HuntStreamConnection

These names are implementation suggestions, not mandatory names.

First inspect the current Prisma/database architecture.

Reuse existing:

* User
* Business
* Hunt
* Checkpoint
* Stream
* Camera
* Event
* Reward
* Subscription
* Wallet
* VCoin
* Revenue
* Analytics
* Identity

where applicable.

---

## 42. API REQUIREMENTS

Add API routes only where existing APIs do not already support the functionality.

Potential capabilities:

* create Network
* update Network
* invite Node
* accept Network invitation
* remove Node
* assign camera
* assign stream
* connect creator
* connect Hunt
* connect event
* configure permissions
* configure revenue agreement
* retrieve Network analytics
* retrieve Network revenue
* retrieve active streams

Follow the existing API conventions.

---

## 43. FRONTEND REQUIREMENTS

Add the Network experience to the existing design system.

Do not redesign the entire application.

New UI should feel native to HVNTZ.

Potential navigation:

Business:

Dashboard → Network

Consumer:

Explore → Hunt → Network

Vault:

Vault Studios → Network

VDP:

Digital Location → Network

VENVS:

Venue → Network

---

## 44. REVENUE EXAMPLE

Example only:

A club creates a Network.

The network generates:

$10,000 in monthly economic activity.

Sources:

* $2,500 subscriptions
* $2,000 advertising
* $1,500 sponsorship
* $1,500 premium content
* $1,000 Hunts
* $1,000 events
* $500 other activity

The system records the source and applicable attribution.

If the business agreement gives:

* business participation
* creator participation
* network participation
* sponsor allocation
* platform allocation

the system calculates the configured shares.

Never hard-code the example percentages.

---

## 45. NETWORK EFFECT

The purpose of this addition is to create a compounding ecosystem.

A single business starts a Network.

The Network adds people.

People add streams.

Streams attract viewers.

Viewers discover Hunts.

Hunts create physical visits.

Physical visits create business activity.

Businesses create additional streams.

Creators join additional businesses.

Businesses connect to additional Networks.

Networks connect to events.

Events connect to Hunts.

Hunts connect to VDP.

VDP connects the digital and physical environment.

Vault Studios supplies the streaming layer.

VACO infrastructure supplies identity, financial, security, mapping, AI, and network services.

This is the intended ecosystem effect.

---

## 46. FINAL ARCHITECTURE

The new architecture should conceptually become:

HVNTZ HUNTS

↓

BUSINESS / VENUE

↓

NETWORK HUB

↓

NETWORK NODES

* People
* Creators
* Businesses
* Cameras
* Rooms
* Events
* Streams

↓

VAULT STUDIOS

* Standard streaming
* Premium/paywall streaming
* Advanced creator subscriptions

↓

HUNTS

* Physical checkpoints
* Digital checkpoints
* Live checkpoints
* Network checkpoints

↓

VDP / DIGITAL PLANET

↓

V4 / MAPS / DISCOVERY

↓

DREA / AI

↓

VOID

↓

VASH / VCOIN

↓

VACO ECOSYSTEM

---

## 47. IMPLEMENTATION PRIORITY

PHASE 1 — FOUNDATION

Add:

* Network entity/relationship architecture
* Network membership
* Network nodes
* permissions
* business-to-network connection
* person-to-network connection

PHASE 2 — STREAMING

Connect:

* existing Vault Studios streams
* existing eight-camera architecture
* camera-to-person assignment
* stream-to-network assignment

PHASE 3 — HUNTS

Connect:

* Hunt → Network
* Hunt → Stream
* Hunt → Camera
* Hunt → Creator
* Network → Checkpoint

PHASE 4 — MONETIZATION

Connect:

* standard streaming
* premium/paywall
* advanced creator subscription
* advertising
* sponsorship
* revenue attribution
* configurable revenue sharing

PHASE 5 — DIGITAL PLANET

Connect:

* VDP
* VENVS
* V4
* DREA
* VOID
* existing VACO ecosystem

---

## 48. ACCEPTANCE CRITERIA

The upgrade is complete when:

1. Existing Hunts still work exactly as before.
2. Existing businesses still work exactly as before.
3. Existing Vault Studios streams still work.
4. Existing eight-camera functionality remains intact.
5. A business can create a Network.
6. A business can invite people into the Network.
7. People can become authorized Network Nodes.
8. Cameras can be assigned to Nodes.
9. Streams can be associated with Nodes.
10. Networks can connect to Hunts.
11. Hunts can expose authorized live Network streams.
12. Businesses can connect Vault Studios content.
13. Standard streaming remains available.
14. Premium/paywall streaming can be configured.
15. Advanced creator subscriptions can be configured.
16. Revenue sources can be attributed.
17. Revenue-sharing agreements can be configured.
18. Existing VASH/VCoin infrastructure is reused.
19. Existing VACA identity/security is reused.
20. Existing V4 mapping is reused.
21. Existing DREA infrastructure is reused.
22. Existing VOID infrastructure is reused.
23. Existing analytics are extended.
24. Existing notifications are extended.
25. Existing design system is preserved.
26. No duplicate core infrastructure is introduced.
27. All new APIs are tested.
28. All new permissions are tested.
29. Revenue calculations are tested.
30. Existing regression tests continue to pass.

---

## 49. MASTER RULE

THIS IS AN UPGRADE, NOT A REBUILD.

The current HVNTZ Hunts environment is the foundation.

Do not remove existing functionality.

Do not rename existing functionality unless explicitly instructed.

Do not replace working infrastructure.

Do not create duplicate systems.

Add the Connected Network Layer around the existing Hunts ecosystem.

The objective is to turn each physical business participating in Hunts into a potentially living digital environment containing:

BUSINESS + PEOPLE + CAMERAS + STREAMS + CREATORS + HUNTS + EVENTS + PREMIUM CONTENT + ADVERTISING + COMMERCE + REVENUE

while maintaining a single integrated VACO architecture.

BUILD ONLY WHAT IS MISSING.

REUSE EVERYTHING THAT ALREADY EXISTS.

PRESERVE EVERYTHING THAT ALREADY WORKS.

EXTEND THE DIGITAL PLANET WITHOUT BREAKING THE CURRENT PLANET.
