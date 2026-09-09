# VXLLAGE — Data Models + API Map (v1)

X/Twitter-primary, Reddit/Discord/Clubhouse/Zoom secondary — per the
standing rebalancing correction (an earlier build over-weighted the
Discord-style layer; Home feed must be primary).

## Data models

```
Post { id, authorId, text, mediaUrl, upvotes, downvotes, isReply: boolean }
  // the primary, X-style Home feed — build depth here first

Community { id, name, members: [userId] }  // Reddit/Discord-style, secondary
LiveRoom { id, hostId, participants: [userId], isRecurring: boolean }
  // isRecurring supports Clubhouse Clubs-model persistent rooms

VillageRoom {  // VDP native presence
  id, roomType: "clubhouse-audio" | "discord-hangout"
  ownerId  // permanent, creator-owned per the Clubs model
  scheduledRecurrence: string | null
}
```

## API map
- `POST /vxllage/posts` — primary feed (build depth here first, per
  standing correction)
- `POST /vxllage/rooms` — live audio room, `isRecurring` for Club-model
- `POST /vdp/village-rooms` — VDP-native room creation
- `POST /vxllage/articles` — long-form article publishing
- `POST /vxllage/newsletters/send` — email-style delivery to subscribers

## Substack-style long-form articles and newsletter delivery

Real, confirmed gap closed: VXLLAGE had no long-form writing or
newsletter capability. Real, important context: **X itself tried this
exact feature** — Twitter acquired the real newsletter platform Revue
in January 2021, then shut it down in 2023. X's current approach is
just very long text posts (~25,000 characters), with no actual
newsletter delivery or subscription mechanism. This is a genuine
opportunity: VXLLAGE can build what X abandoned, not compete with
something X still does well.

**Real, current Substack model (2026) being adapted**: long-form
articles, built-in delivery to subscribers, and a cross-publication
recommendation system driving discovery between similar creators.

```
Article {
  id, authorId, title, bodyContent, publishedAt
  isPaywalled: boolean
  linkedToVxllagePost: string | null  // articles surface in the
                                         // primary feed too, not siloed
}

NewsletterSubscription {
  id, subscriberId, authorId
  deliveryMethod: "in-app-only" | "email-notification"
}

CrossPublicationRecommendation {
  authorId, recommendedAuthorId
  // real Substack mechanic: writers recommend other writers; new
  // subscribers see these recommendations automatically
}
```

## Confirmed: no duplication needed for Substack's other real features

Checked against what's already built elsewhere in the ecosystem —
these Substack capabilities are already covered, no need to rebuild:

- **Paid subscriptions** — already fully built via Vavlt Stvdios'
  locked-content tier system; long-form articles here should use the
  *same* VCoin-based subscription infrastructure, not a separate one.
- **Podcasts** — already covered by Vvltvre's Pods division.
- **Video** — already covered by Vavlt Stvdios (streaming, Reels up
  to 20 minutes).
- **Community chat for paid subscribers** — already covered by
  VXLLAGE's own Community threads and Village live-audio rooms.

**The only genuinely new pieces built here**: long-form article
publishing, newsletter-style delivery, and the cross-publication
recommendation system — everything else deliberately reuses existing
infrastructure rather than duplicating it.

## Information architecture — one primary surface, distinct secondary experiences, fluent connections

A real, explicit principle worth locking in for how all of VXLLAGE's
pieces fit together, now that it spans the primary feed, Village,
Community threads, and long-form articles:

**The X-style Home feed stays primary and forefront** — the default
landing experience, unchanged, per the standing correction already
established.

**Each secondary surface (Village, Community, Articles) should feel
like its own distinct, coherent space** when a user navigates into
it — not cluttered fragments bolted onto the main feed, but genuine,
well-separated experiences with their own identity, the same way
switching between Twitter and Substack feels like two different
things even when they're related.

**But every surface connects fluently, not in isolation**: an article
surfaces in the primary feed as a real post (already established), a
Community thread can link directly into a Village live-audio room
(already established), and a writer's article can drive a listener
into their Village room for real-time discussion. The goal is
distinct identity per surface with real, easy movement between them —
never a dead end requiring a user to back out and manually find their
way to a related space.

```
VxllageSurfaceLink {
  sourceType: "post" | "article" | "community-thread" | "village-room"
  sourceId: string
  linkedSurfaceType: "post" | "article" | "community-thread" |
    "village-room"
  linkedSurfaceId: string
}
```

**Why this matters**: this is what makes VXLLAGE feel like one
coherent app with real depth, rather than several unrelated features
sharing a name — the primary feed stays the anchor, but nothing built
on top of it (Village, Community, Articles) should feel like a
separate product accidentally living in the same app.

---

# CHOPZ — Data Models + API Map (v1)

TikTok Shop model: 5-8% referral fee, native checkout, affiliate marketplace.

## Data models

```
ChopzVideo { id, creatorId, mediaUrl, linkedProductId: string | null }
Product { id, sellerId, price, affiliateCommissionPercent }
AffiliateLink { id, creatorId, productId, clicksCount, conversionsCount }
Order { id, buyerId, productId, feePercent  // 5-8%, native checkout only,
  voidShipmentId: string | null  // routes to VOID fulfillment
}
```

## API map
- `POST /chopz/orders` — native in-app checkout, never redirects out
- `POST /chopz/affiliate/links` — creator generates a commission link
- Cross-app: `Order.voidShipmentId` calls VOID directly for fulfillment

---

# VACAY — Data Models + API Map (v1)

Airbnb 15.5% fee model, Experiences tab already validated.

## Data models

```
Listing { id, hostId, type: "stay" | "experience", pricePerNight }
Booking { id, listingId, guestId, feePercent: 15.5, checkIn, checkOut }
Experience { id, hostId, description, durationHours }  // Airbnb Experiences model
```

## API map
- `POST /vacay/bookings` — enforces the 15.5% flat fee
- `POST /vacay/experiences` — separate from stays, same host model
- Cross-app: booking triggers a VOID ground-transport option at checkout

## Status (all three)
Ready for Claude Code now — each translates directly from already-
established research with no open design questions remaining.

## Cross-reference added — VACAY, system built later in this project

**VPLAN**: full trip planning (people count, budget, preferences → a
generated multi-day itinerary) is powered by **VPLAN**, a shared AI
planning engine also powering CVNVO (dates) and HVNTZ (day-hunt plans).
VACAY's booking/experience data above is a real, direct input source
VPLAN draws from when generating trip plans.
