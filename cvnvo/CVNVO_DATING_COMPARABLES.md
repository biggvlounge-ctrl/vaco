# CVNVO — Dating Mechanics Comparables (v1)

## Three real, structurally different matching algorithms
| App | Mechanic | Real outcome data |
|---|---|---|
| Tinder | ELO/desirability score — volume and speed, rewards being right-swiped by high-quality profiles | 75M MAU, largest scale, but only ~50% of users say they want something serious; first-ever revenue decline in 2025 |
| Hinge | **Gale-Shapley algorithm** (the actual Nobel Prize-winning stable-matching math) — predicts *mutual* compatibility, factoring who you'll like AND who's likely to like you back, not one-sided attraction | 35-36% of dating-app marriages in 2025 started here — the best per-user success rate of the three |
| Bumble | Women message first within a 24-hour window; matches expire after 24 hours if unused | Explicit design choice to reduce harassment and create urgency/daily engagement |

## Real anti-ghosting / engagement mechanics worth adopting
- **Hinge's "Your Turn Limits"**: blocks a user from sending new likes
  once they have too many unanswered conversations — turns response
  behavior into a real constraint on future matching, not just a
  courtesy ask.
- **Hinge's "We Met" feature**: asks users whether a match actually led
  to a real date, and feeds that back into the algorithm — learning
  from real-world outcomes, not just in-app swipe behavior. This is
  the single most valuable mechanic here, genuinely differentiated from
  pure engagement-optimization.
- **Bumble's 24-hour match expiration**: creates real urgency without
  being punitive — matches don't ghost silently, they simply expire.

## The actual blend for CVNVO
Given CVNVO already has a real First Date Safety system (itinerary
sharing, live location, safety check-in timer), **Hinge's "We Met"
feedback loop is a natural extension**, not a separate feature — the
same check-in mechanic that powers safety could also ask "did this
lead to a real date," feeding both safety data and match-quality data
from one user action. Hinge's mutual-compatibility algorithm (Gale-
Shapley) is the right mechanic to model CVNVO's actual matching on,
rather than Tinder's pure volume/ELO model — it fits a platform that's
already investing in safety and trust more than raw swipe volume.
Bumble's message-first/expiration mechanics are worth considering for
CVNVO's own safety-conscious positioning (structured urgency without
unlimited unsolicited contact).

## What this doesn't cover yet
Real matching algorithm implementation (Gale-Shapley in practice
requires real preference-ranking data at scale, not just swipe
direction) is a genuine engineering lift, not a UI decision — flag as
a real build item, not something achievable with placeholder logic.

## Real-world proximity blending — Happn

CVNVO's real-life/digital dating blend (walking into a grocery store and
seeing available people nearby, tapping into their profile, messaging
directly) has a direct, proven real comparable: **Happn**.

**Happn's real mechanic**: GPS detects when two users physically cross
paths within a 250-meter radius, and that person appears on a
chronological timeline — fundamentally different from Tinder/Bumble's
distance-radius swiping, since it's based on genuine real-world
proximity, not just "who's nearby right now." Privacy-preserving by
design — only the intersection point is saved, not continuous location
history. Real scale: 180 million users worldwide.

**Real features worth adopting directly**:
- **FlashNotes** — a personalized message sent *before* a match is even
  confirmed, a strong icebreaker mechanic.
- Built-in video calling for matched users (5 free minutes per match on
  the free tier in Happn's own real product).

**How this fits with what's already defined**: Hinge's Gale-Shapley
algorithm (already the standing decision for CVNVO's core matching)
answers "who's compatible with me." Happn's crossing-paths mechanic
answers a different question — "who's physically near me right now." The
two aren't competing mechanics; CVNVO can run both simultaneously, using
Happn's model specifically for the real-world/VDP-blended discovery
layer described by the founder, while Hinge's algorithm continues to
power the core matching experience.

**Also newly confirmed**: CVNVO is usable inside VENVS/VDP as a distinct
use case — matching between avatars/players inside the virtual world,
separate from (though architecturally similar to) the real-world
version above.

## Social/visual layer — Snapchat feel, Snap Map, and event attendance visibility

CVNVO should have a more social, visual feel layered on top of its core
dating mechanics — specifically a Snapchat-style map and community/event
visibility features.

**Snap Map's real mechanics, worth copying precisely**: 250 million
monthly active users, opt-in with three real privacy tiers:
- **Ghost Mode** — fully invisible
- **My Friends** — all friends see your location
- **Select Friends** — only chosen people see you

Tapping a friend's avatar on the map opens their story or lets you
message them directly to plan a meetup. This three-tier graduated
privacy model — not just an on/off toggle — is the right structure for
CVNVO's own location-sharing feature.

**Event attendance visibility**: real precedent from Facebook Events and
apps like Partiful — a visible, live count of how many people are going
to a place or event, with an opt-in "I'm going" that surfaces a user's
attendance (and optionally location) to others also attending. Combined
with Snap Map's graduated privacy tiers, this gives CVNVO both pieces:
knowing how many people are headed somewhere, and opting in to be seen
by others attending the same thing.

## Dating format coverage check — Speed Dating and Long-Distance Mode

A completeness check surfaced two real dating formats missing from
CVNVO's design so far, both worth adding.

### Speed Dating
**Real precedent: Tinder is actively piloting this in 2026.** Scheduled
3-minute video chats with a potential match, framed as a "vibe check" to
gauge chemistry before committing to an in-person meeting, with the
option to extend a promising conversation past the initial 3 minutes.
Requires verified profile photos before access. **Real conversion data
worth citing**: speed dating events yield an 8-13% match rate per date,
with roughly 87% of participants securing at least one mutual match per
event — substantially higher engagement than typical swipe-based
matching. This is a real, currently-live feature at one of the largest
dating apps in the world, not a nostalgia play.

**Direct fit for CVNVO**: a scheduled, short video-chat format sits
naturally alongside the existing anonymous in-app video calling already
in CVNVO's safety system — same underlying communication tooling, just
scheduled and time-boxed rather than open-ended.

### Long-Distance Mode
Long-distance dating (LDD) is a real, distinct 2026 category with its
own specific tools, not just standard matching with a wider radius.

**Real precedent worth adopting**:
- **Bumble Travel** — drop a pin anywhere in the world to build
  connections ahead of travel or relocation, useful for anyone open to
  matching outside their immediate area.
- **Coffee Meets Bagel's "slow-dating" model** — one curated match
  delivered daily, specifically designed to prevent the burnout that
  comes from juggling distant, asynchronous communication.
- **Synchronized virtual dates and deep video communication** as the
  real current standard for maintaining a long-distance connection,
  plus an explicit **"closing the distance" roadmap** — real
  relationship-progression tooling for when and how two people plan to
  eventually be in the same place, rather than an indefinite,
  directionless long-distance chat.

**Direct fit for CVNVO**: a long-distance mode/filter (matching Bumble
Travel's pin-drop concept) paired with scheduled virtual date tools
(reusing the same video-calling infrastructure as Speed Dating above)
and an explicit distance-closing roadmap feature — giving long-distance
matches a real structure rather than just open-ended messaging.

## Blind Date Mode — AI-chosen, random pairing

A genuinely current 2026 trend, not a niche idea: multiple real, funded
apps have moved to a no-swipe, AI-assigned single-match model, and
**Hinge's own founder** — the source of CVNVO's core matching model —
personally left to build exactly this kind of app, a strong signal for
where the category is heading next.

**Real examples**:
- **The Blinded** (AI matchmaker "Lily") — one match at a time, no
  browsing. Profiles are blind by default: personality, values, and
  interests come first, with photos gradually revealed as a real
  connection develops.
- **Ditto** — an AI agent that simulates over a thousand hypothetical
  pairings before recommending a single match. Real published data:
  **69% match rate versus ~25% for swipe-based apps**, with 20% of
  pairings converting to actual in-person dates.
- **Blind Match** — "no profiles, no swiping, no talking stage — just
  show up." A compatibility quiz, an AI-assigned match, a scheduled
  date.
- **Amata** (real NYC service, ~2,000 first dates/month) — users agree
  to the AI's pairing and purchase a $20 "date token"; a real
  anti-ghosting mechanic blocks a user temporarily from matching again
  after cancelling two dates in a row.

**Direct fit for CVNVO's Blind Date mode**: an AI-driven interview
(voice or deep chat, not just static prompts) feeding a one-match-at-
a-time assignment, blurred/hidden photos until real conversation
happens, and a real commitment mechanic (small cost + a genuine
consequence for repeated cancellations, per Amata's model) to keep the
format meaningful rather than casual.

## Full dating-format coverage, as of this pass
Core algorithmic matching (Hinge-style), real-world proximity (Happn-
style), Speed Dating (Tinder's 2026 pilot), Long-Distance Mode (Bumble
Travel + Coffee Meets Bagel pacing), Blind Date/AI-random pairing (The
Blinded/Ditto/Blind Match/Amata), virtual/in-world dating (CVNVO inside
VDP), and the social/event visibility layer (Snap Map-style). More
formats may still surface as the founder continues the walkthrough.

## Gift Dating, Kevin integration, group dating formats, VDP village, and ecosystem ties

### Gift Dating
Users can set a minimum gift threshold that must be met before someone
can request a date with them. **Real precedent for the underlying
mechanic**: virtual gift economies are an established, current dating-
app monetization model — users purchase credits and spend them on
gifts/message unlocks, with the real, documented psychology being that
**sending a gift signals genuine commitment and interest**, which drives
higher-quality engagement than free messaging alone. Bumble's own
"Spotlight" boosts sit in the same monetization family. CVNVO's specific
twist — a recipient-set minimum threshold gating date requests — is a
more deliberate filtering use of that same proven mechanic, closer to a
creator setting a minimum-tip gate than a typical impulse-gift feature.
Should run on VCoin, consistent with the rest of the ecosystem.

### Kevin — AI dating advisor with FaceTime capability
Kevin is already established as V4's Dating/Convo-focused agent
personality, with FaceTime-style calling already built into V4's Agent
Command Center. CVNVO should incorporate Kevin throughout for dating
advice — this extends an agent that already exists rather than
introducing a new one.

### Group dating formats
- **2v1 / 3v1 in-person rotating dates**: an opt-in format where a user
  meets multiple potential dates in a single in-person session, rotating
  speed-dating-style. Extends the Speed Dating research already on file
  into a live, multi-person event format.
- **All-FaceTime speed dating**: the fully virtual version of the same
  Speed Dating format — matches the video-based structure of Tinder's
  own real 2026 speed-dating pilot already documented above.

### Dating Village inside VDP
CVNVO gets its own inhabitable Dating Village space inside VENVS/VDP,
following the same pattern already established for VXLLAGE's Village —
a real place to walk into with your avatar, not just a link-out card.

### Location-based dating with adjustable radius
Standard radius-based search (1 mile up to 100 miles), combined with a
**visible count** of how many people in that radius are open for
contact — consistent with the "visible count" pattern already
established via the Snap Map/event-attendance work above.

### Ecosystem ties
- **Hunts Dates**: a direct integration with HVNTZ — a date structured
  as a scavenger hunt, using HVNTZ's existing checkpoint mechanic.
- **VOID for date transportation**: already established elsewhere in
  this ecosystem — VOID ride data already feeds into CVNVO's First Date
  Safety system (pickup/dropoff, driver ID, live location shared with
  trusted contacts).

## Updated full dating-format coverage
Core algorithmic matching (Hinge-style), real-world proximity (Happn-
style), Speed Dating (in-person and all-FaceTime), Long-Distance Mode,
Blind Date/AI-random pairing, Group Dating (2v1/3v1), Gift Dating,
virtual/in-world dating (CVNVO inside its own VDP Dating Village),
location-radius dating with visible counts, Hunts Dates (HVNTZ tie), and
the social/event visibility layer (Snap Map-style) — all sitting on top
of CVNVO's existing comprehensive safety system, with Yap and Kevin as
the two named support layers (safety and advice, respectively).

## Compliance flag: "sugar dating" framing (real, concrete risk — not just a caveat)

**Recommendation: do not build this as an explicit "sugar dating"
feature.** Real research shows this is a higher-risk flag than most
others in this project, because there's already a concrete, current
real-world example of the category leader being forced to abandon this
exact framing.

**Seeking.com** — the largest, most established real platform in this
space — explicitly prohibits "sugar dating, financial arrangements, and
'mutually beneficial' relationship structures" under its own current
community standards, and its homepage states "Sugar dating and all
forms of transactional relationships are strictly prohibited." This
wasn't a branding choice — it happened because **Apple's App Store
explicitly does not support sugar dating apps**, and because U.S.
federal online sex-trafficking liability law created real platform-
level legal exposure for hosting transactional-relationship structures.

Given CVNVO needs real app store distribution and is wired into V3's
actual payment rails, this carries more concrete, demonstrated risk than
VAGO or Yap's flags. **The Gift Dating feature already documented above
covers the underlying spirit** (generosity shaping how a relationship
develops, via a recipient-set gift threshold) without inheriting the
transactional-relationship framing that got the real industry leader
into trouble. Recommend building that instead of a dedicated "sugar
dating" feature.

---

## Implementation status (added when this file was placed into the repo)

**The blend this document recommends is what got built**, and the
three-way choice at its centre was resolved the way it argued for:
Hinge's Gale-Shapley over Tinder's ELO, on the stated ground that
CVNVO invests in safety and trust rather than swipe volume.
`cvnvo/lib/matching.js` implements real stable matching.

**Format coverage, against the eleven formats:**

| Format | Module |
|---|---|
| Standard matching (Gale-Shapley) | `matching.js` |
| Proximity / crossing paths (Happn) | `proximity.js` — real 250m radius, intersection points only |
| FlashNotes (message before match) | `proximity.js` |
| Blind Date (AI-assigned, photos hidden) | `blindDate.js` |
| Speed Dating (in-person + all-facetime) | `speedDating.js` — real duration and extension |
| Long-Distance / travel pins | `longDistance.js` |
| Gift Dating | `giftDating.js` |
| Group / 2v1 / 3v1 | `speedDating.js` participant arrays |
| Hunts Dates, VOID transport | `dateEvents.js` (`huntId`, `voidRideId`) |
| BarBuddy venue check-in | `proximity.js` |
| Dating Village in VDP | Real VDP district |

**The compliance flag was honored, and honored in the strongest
way — by building the alternative rather than just avoiding the
risk.** `giftDating.js`'s own header opens by naming itself "the real,
deliberate replacement for a 'sugar dating' feature" and cites this
document's reasoning directly: Seeking.com's prohibition, Apple's App
Store position, and federal trafficking-liability exposure. There is
no sugar-dating framing anywhere in the codebase.

That is the right outcome for the reason this document gives: CVNVO
needs real app-store distribution and is wired into V3's payment
rails, so the exposure is more concrete than VAGO's or Yap's flags.
Gift Dating covers the underlying intent — a recipient-set VCoin
threshold signalling commitment before a date request — without the
transactional-relationship framing.

**Snap Map's three privacy tiers — partially adopted, and the
difference is worth knowing.** This document recommends the graduated
Ghost Mode / My Friends / Select Friends structure. What exists is
binary: `isVisibleToOthersAtVenue` (BarBuddy) and proximity events
recorded as intersection points only. The privacy *floor* is right —
arguably stricter than Snap's, since no continuous location history is
ever stored and visibility defaults to off. What is missing is the
middle tier: there is no "visible to my matches but not to everyone"
setting. Real, small, and genuinely useful, since that middle tier is
the one most people actually want.

**Adopted mechanics, confirmed real:** Your Turn Limits
(`unansweredCount`), Bumble-style match expiry, and the "We Met" loop
— which this document calls "the single most valuable mechanic here"
and which is fully closed. `matching.js` scales candidates by a real
reliability multiplier drawn from confirmed date outcomes, with a
no-history candidate deliberately unadjusted and the effect bounded so
it re-ranks rather than hides anyone. See `CVNVO_CORE_FEATURES.md` for
why the multiplier lives in `matching.js` rather than in the displayed
compatibility score.

**Kevin's FaceTime capability** — Kevin is a real VACON agent, and V4
now has a real call-session machine (`v4-proxy/lib/agentCall.js`:
ring → connected → ended, with text fallback). What neither has is
media transport. That is now scoped as shared infrastructure rather
than a CVNVO problem — see
`dev-docs/REALTIME_MEDIA_SHARED_INFRASTRUCTURE.md` and task #106,
where CVNVO's all-facetime format is one of four consumers queued
behind the same missing piece.

**Not built:** the Ditto/Amata-style anti-ghosting block after two
cancellations. `getUserDateReliability()` already computes the real
signal this would need from confirmed check-ins — so like the We Met
feedback loop, the data exists and the enforcement does not.
