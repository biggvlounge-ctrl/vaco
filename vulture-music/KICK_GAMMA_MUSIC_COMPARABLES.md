# Kick & gamma. — Comparables (v1)

Two real, direct additions: Kick alongside Twitch in Vavlt Stvdios'
casino streaming layer, and gamma. as a real comparable for Vvltvre's
music distribution model.

Kick — confirmed alongside Twitch: Kick specifically built its real
reputation on casino/slots-style live streaming, making it the more
directly relevant platform for this specific feature.

```
CasinoStreamingComparable {
  platform: "twitch" | "kick"
  relevantFeature: "live-casino-slots-streaming-format"
  kickSpecificRelevance: "real-world-platform-built-specifically-
    around-this-content-category"
}
```

gamma. — confirmed as a real, current comparable for Vvltvre Music/
Distribution: founded 2023 by former Apple Music executive Larry
Jackson, backed by ~$1 billion from Eldridge, Apple, and A24. Real
model: artists retain greater ownership of masters than traditional
label deals, distribution spanning music, video, podcasts, and fashion
under one vertically integrated platform.

Why strong for Vvltvre: Vvltvre's five divisions (Music, Pods, Flicks,
Tix & Touring, Distribution) already mirror gamma.'s multi-format
approach — one artist, many mediums, artist-retained ownership. More
directly relevant than the existing DistroKid/TuneCore flat-fee model
alone, which covers distribution but not the broader multi-format
artist-platform relationship.

```
VultureComparable {
  company: "gamma."
  realFunding: "~$1B, Eldridge/Apple/A24"
  realModel: "artist-retained-ownership-multi-format-distribution"
  relevantDivisions: ["music", "pods", "flicks", "tix-touring",
    "distribution"]
}
```

---

## Implementation status (added when this file was placed into the repo)

**Both halves are already reflected in working code.** This is the
rare document in this batch that describes something done rather than
something pending — worth recording so nobody rebuilds it.

**gamma. — already the stated model, not just a cited comparable.**
`vulture-music/README.md` names gamma. directly alongside DistroKid and
TuneCore, and the design decisions it implies are real in the code, not
just in prose:

- `vulture-music/lib/releases.js` sets `ownershipRetainedPercent: 100`
  as a structural default, with its own header describing the
  "artist-retained-ownership posture across music, video, AND
  [podcasts]." That is gamma.'s core differentiator implemented, not
  referenced.
- The multi-format claim is real: release types are `album`, `video`,
  and `podcast-episode` in one system, which the README explicitly
  attributes to "gamma.'s real multi-format" approach.
- The flat-fee submission model follows TuneCore's real per-release
  pricing shape, chosen deliberately over DistroKid's alternative.

So this document's recommendation — that gamma. is "more directly
relevant than the existing DistroKid/TuneCore flat-fee model alone" —
was already acted on. The codebase takes pricing from TuneCore and
ownership/multi-format structure from gamma., which is the correct
reading of both.

**Kick — already present in Vavlt Stvdios.**
`vavlt-stvdios/lib/screenSessions.js` names Kick alongside Twitch,
Patreon, and OnlyFans in its own comparables header. The document is
placed here in `vulture-music/` rather than `vavlt-stvdios/` because
the gamma. half is substantially longer and more consequential; the
Kick half is a single confirmation that needed no change.

**One thing this document gets slightly ahead of the code on.** It
lists Vvltvre's five divisions as Music, Pods, Flicks, Tix & Touring,
and Distribution. Four exist as real apps — `vulture-music/`,
`vulture-pods/`, `vulture-flix/`, and `vulture-studios/` (the
fund-and-produce financing division, which is not on this list).
**Tix & Touring does not exist as code.** Live events are handled by
VOID MAGIC rather than by a Vvltvre division, so the five-division
framing describes an intended org chart, not the current one.
