# Vavlt Stvdios — Instagram-Style Layer, and Powering HVNTZ (v1)

**Architecture decision**: Vavlt Stvdios gets the full Instagram-style
content layer built out properly — and HVNTZ calls into it rather than
building a parallel, redundant photo/social system of its own. Same
"shared infrastructure" principle already applied to V3 (money), V4
(AI), DREAMS (ads), and VOID (delivery) — Vavlt Stvdios becomes the
canonical photo/video/social layer, not something each app reinvents.

## Real Instagram feature set (2026), grounding the build
- **Profile grid**: rectangular (not the old square format), user-
  reorderable via drag-and-drop
- **Stories**: up to 60 seconds uncapped, real-time story comments,
  Highlights moved to their own tab (heart icon), AI-generated
  interactive stickers
- **Reels**: extended dramatically — up to 20 minutes now, a real shift
  toward long-form video, not just short clips
- **Explore**: a *separate* AI ranking system from Feed/Reels/Stories —
  entirely non-followed content, personalized by engagement history,
  the actual discovery surface for new audiences
- **Notes**: 3-day ephemeral short text on posts/reels — lightweight
  personality/status layer
- **Carousels**: up to 20 slides, now available inside Stories too
- **Map Search**: location-based business discovery tool — **this is
  the direct bridge to HVNTZ**, a real, current Instagram feature for
  finding local businesses by location
- **Profile Cards**: digital-business-card-style profile view (photo,
  bio, links, QR code)

## What this looks like already-built in Vavlt Stvdios (confirm, don't duplicate)
Per Vavlt Stvdios' own existing brief, its **Discover** tab already has
a real stories rail + category chips + For You/Recent sort + locked/
unlocked post grid + post lightbox — this is already a working
Instagram-style skeleton, just needs to be built out to the fuller
feature set above (Explore's separate ranking, Map Search, Profile
Cards, Notes) rather than started from scratch.

## How HVNTZ plugs in (the actual integration)
1. **Hunt checkpoint photo-proof posts** route through Vavlt Stvdios'
   post/story system, tagged to the relevant business's or hunt's
   profile — not a separate HVNTZ-owned photo feature.
2. **Map Search** is the natural mechanism for HVNTZ's own Yelp-style
   business discovery — Vavlt Stvdios' location-based discovery layer
   and HVNTZ's business directory are functionally the same underlying
   need, served by one system.
3. **A hunt-checkpoint business's Vavlt Stvdios profile** becomes the
   single place their content lives — camera streams (already
   established), Instagram-style posts/stories from hunt completions,
   and Map Search discoverability, all in one profile rather than
   fragmented across HVNTZ and Vavlt Stvdios separately.

This means HVNTZ's own build should NOT include a bespoke photo-sharing
or stories feature — it should call Vavlt Stvdios' content API the same
way it's already expected to call V3 for wallet balances.

## Multi-Channel Architecture — the core streaming differentiator

Each individual camera or feed is its own independently monetizable
channel with its own chat — not one combined stream per business. This
is a genuinely different model from how every major streaming platform
works today, and it's the single biggest differentiator for Vault
Studios specifically.

**Two equivalent groupings of the same underlying system:**
1. **Multiple rooms/cameras within ONE physical location** — a
   barbershop's 4 chairs, each its own channel; a club's Bar A, Bar B,
   DJ booth, dance floor, front door, and individually numbered stages,
   each separately tappable and separately monetized.
2. **The same brand's multiple physical locations** — a franchise with
   8 locations across 8 states, each location being its own channel.

Either way, the viewer freely focuses on whichever channel (or several
at once) they want to watch, each with its own independent chat.

**Real validation, and a genuine market gap, not an incumbent to copy**:
Twitch's own native attempt at this (Squad Stream) was retired in 2023
due to low adoption and a clunky four-way layout. The real, proven
demand for exactly this experience is currently served only by
third-party tools — MultiTwitch, ViewGrid, TwitchTheater — which let
viewers add multiple independent streams into one layout with
individual poppable chat windows and drag-and-drop arrangement. **No
major platform has built this well natively.** That makes this a real
gap to fill, not a feature to reverse-engineer from an incumbent.

**Real UX patterns worth adopting from the third-party tools that
currently serve this need:**
- Drag-and-drop layout arrangement of active channels
- Individual volume/mute control per channel
- Poppable/dockable chat per channel, with the ability to keep one
  "main" chat pinned while others stay collapsed
- Resizing individual feeds to prioritize whichever channel the viewer
  cares about most in the moment

This is the same mechanism whether it's a barbershop, a club, or a
national franchise — one multi-channel system, applied at whatever
grouping makes sense for that business.

## Locked-content tiers for HVNTZ business users

HVNTZ business owners' Vavlt Stvdios presence should include Patreon-
style membership tiers and OnlyFans-style subscription/pay-per-view
locked content as a real revenue option, alongside the streaming/ad/DTC
income already established through HVNTZ's standing onboarding model.
Vavlt Stvdios' existing Discover tab (locked/unlocked post grid) is
already the right skeleton for this — this extends it explicitly to
business owners specifically, not just individual creators. Revenue
split follows the same 80/20 creator-favor anchor already established
ecosystem-wide.

## Kevin as a date-planning concierge

Kevin (already established as V4's Dating/Convo agent) extends into
CVNVO as a proactive concierge: when asked, Kevin suggests a VOID ride,
a VACAY tour or rental, or nearby restaurants for date planning. This is
a direct extension of Kevin's existing role, not a new agent or system —
same underlying agent, applied to a concrete, common use case.

## Per-channel tipping — every role becomes its own earner

Extending the multi-channel model directly: each individual channel
within a location can accept **real, direct tips**, not just
subscription/locked-content revenue. Using the club example already
established (Bar A, Bar B, DJ booth, dance floor, stages) — the
bartender's channel, the DJ's channel, and even a channel showing the
doorman all become independent tipping destinations. A viewer watching
a specific channel tips that specific person directly, not the
business as a whole.

```
ChannelTip {
  id, channelId, tipperId
  amountVCoin: number
  recipientPersonId: string  // the specific bartender, DJ, doorman,
                               // etc. tied to that channel — not just
                               // the business entity
}
```

**Why this matters**: if a business fully utilizes all its available
channels (per the earlier 8-channel example), every individual role —
not just the headline performer — becomes a real, independent income
source. The doorman, a role that would never earn tips through any
other digital platform, becomes a genuine channel with real tipping
potential the moment they're given their own camera feed. This is a
real, direct multiplier on the business's total earning potential
specifically when they choose to use all their available channels
rather than just one or two.

## Global, role-based channel grouping — the same role across many real locations

Extending the already-established "same brand, multiple physical
locations" grouping (the franchise/multi-city example): the grouping
doesn't have to be organized around one business's branches — it can
be organized around a **role or talent category itself**, spanning
genuinely different businesses, cities, and countries. Eight different
DJs, each performing at a different real venue in a different city or
country, can all sit within one viewable channel group — a viewer
freely switches between "the DJ in Tokyo," "the DJ in Miami," "the DJ
in Berlin," the same way they'd switch between rooms in one physical
club.

```
ChannelGroup {
  id, groupingBasis: "same-location-multi-room" |
    "same-brand-multi-location" | "same-role-multi-location"
  memberChannelIds: [channelId]  // can span entirely unrelated
                                   // businesses/venues, unified purely
                                   // by shared role/talent category
}
```

**Why this is genuinely valuable**: this creates a real, global
discovery layer for a specific kind of talent or experience — a viewer
interested in DJs generally, not one specific venue, has one place to
browse and tip across every real location offering that experience
worldwide, rather than needing to know about and separately visit each
individual venue's own channel.

## Strategic priority — businesses first, the real differentiator

Confirmed, explicit priority: Vavlt Stvdios genuinely wants gamers,
individual streamers, and general creators too — that audience isn't
excluded. But the **real, structural differentiator from Twitch and
YouTube specifically is getting businesses themselves to become
streaming entities**, not individual creators. Twitch and YouTube are
built around individual people; no major platform is built around
**businesses** as the streaming unit.

**Why this matters for go-to-market sequencing**: if businesses
adopting the multi-channel model (the restaurant-with-eight-cooks
example, the club with bartenders/DJ/doorman) becomes the platform's
real identity, that's a genuine, structural market gap being filled —
not just another Twitch competitor fighting for the same individual-
creator audience Twitch and YouTube already dominate. This directly
reinforces why HVNTZ's business-onboarding flywheel feeding into Vault
Studios (per the Complete Revenue Stack) is the priority acquisition
channel, with general creator/gamer growth as a real, wanted, but
secondary audience.

## Status
Ready for Claude Code now — the multi-channel architecture, IG layer,
HVNTZ integration points, per-channel tipping, global role-based
channel grouping, and strategic priority are all fully specified.
