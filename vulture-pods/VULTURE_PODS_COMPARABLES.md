# Vvltvre Pods — Podcast Comparables

Written to close a comparables-coverage gap.

**The number that matters:** `vulture-pods/lib/subscriptions.js` sets
`PLATFORM_TAKE_PERCENT = 0.10`. Ten percent of subscription revenue.

## Comparables

| Platform | Model | Take |
|---|---|---|
| **Spotify** | Distribution plus exclusive originals; monetization mostly through advertising and its own subscription rather than a creator cut. | Ad-supported / platform subscription |
| **Apple Podcasts** | Open directory plus paid subscriptions. | 30% year one, 15% after |
| **Patreon** | The dominant way independent podcasts actually earn. | 8–12% by plan tier |
| **Supercast** | Purpose-built private-feed podcast subscriptions. | ~10% plus processing |

//: Flagged interpretive: Apple's 30/15 mirrors its App Store
//: structure and Patreon's tiers have been revised more than once.
//: The band — roughly 10% for a subscription tool, 15–30% for a
//: platform with its own audience — is the durable finding.

## Where 10% sits

**At the Supercast/Patreon end, well under Apple's.** That is the
correct comparison set: Vvltvre Pods is a subscription tool inside an
ecosystem, not an audience-owning platform. Apple and Spotify charge
more because they bring listeners; a tool that does not bring listeners
cannot charge platform rates.

The real question this raises is discovery. Ten percent is competitive
and honest, but every comparable that charges more is charging for the
thing Vvltvre Pods does not yet have — an audience arriving on its own.
Cross-promotion through Vvltvre Music, VXLLAGE, and Vavlt Stvdios is
the ecosystem's answer, and it is a real one, but it is not yet
measured anywhere.

## What is genuinely built

10 show categories, subscriptions with the 10% take, video cross-links
to Vavlt Stvdios. Persisted.

> *Correction, added during this round's doc-vs-code reconciliation
> (13 Nov 2026).* This line previously also claimed "distribution from
> Vvltvre Studios" — checked directly rather than trusted from either
> doc, and it is false: nothing in `vulture-studios/server.js` or
> `vulture-studios/lib/*.js` ever references `vulture-pods` under any
> name. `vulture-studios/README.md`'s own "Real music/podcast
> distribution" section confirms why — a studio-financed `podcast`
> project distributes into **Vvltvre Music's** own `podcast-episode`
> format directly (`registerWithVultureMusic`), explicitly *bypassing*
> Vvltvre Pods' own Show/Episode wrapper rather than creating one. The
> only real distribution this app has is still the one already
> described above: `publishEpisode`'s own outbound call into
> `vulture-music`'s `POST /api/releases`. See the matching correction
> in `../vulture-studios/VULTURE_STUDIOS_COMPARABLES.md`.

## Implementation status (verified 13 Nov 2026)

Checked directly against real code. `PLATFORM_TAKE_PERCENT = 0.10` is
exactly as stated in `lib/subscriptions.js`. `lib/shows.js#SHOW_CATEGORIES`
has exactly 10 real entries (news, comedy, true-crime, business,
technology, sports, culture, education, fiction, other). One stale
claim found and corrected in this same round, later the same day — see
the correction immediately above: this app receives no real
distribution from Vvltvre Studios.
