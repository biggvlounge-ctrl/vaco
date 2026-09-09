# VXLLAGE — The Village District inside VDP (v1)

## Confirmed naming
QVAN is confirmed as the security/fraud agent referenced in the earlier
"quantum security guy" discussion — same agent, no new agent to
introduce. QVAN's mandate (per the earlier session): no bots (Cloudflare
Bot Management-style scoring + session-based behavioral detection),
strong code security review practices, and a content-moderation
philosophy modeled on X's real "freedom of speech, not freedom of reach"
policy — more permissive than YouTube's current stance, while still
controlling algorithmic distribution of borderline content.

## The Village District — a real, inhabitable space, not a link-out

VXLLAGE gets its own dedicated Village district inside VENVS/VDP —
a real place with multiple distinct rooms a player's avatar can walk
between, not just a card linking out to the standalone VXLLAGE app.

**Room types coexisting in one Village area:**
- Clubhouse-style live audio rooms, with avatars visibly present
  alongside other participants — matching VXLLAGE's own real Live
  surface.
- Other VXLLAGE room types (Discord-style hangout/community rooms, etc.)
  fitting into the same cohesive space.

**How this differs from most of VDP's other app entry points**: HVNTZ,
CVNVO, VAGO, and Vavlt Stvdios largely sit inside VDP as lounge-style
entry points into their standalone apps. The Village is a fuller native
space — the same treatment already given to VAGO's Resort & Casino,
which is a real walkable destination inside VDP, not just a link-out
card. VXLLAGE's Village should follow that same pattern: a genuine place
to inhabit, not a doorway to somewhere else.

## Permanent, creator-owned rooms — real precedent: Clubhouse Clubs

Users and influencers can claim permanent rooms inside the Village,
rather than every room being ephemeral. Real validation: Clubhouse's
**Clubs** feature is exactly this — a followable, persistent community
space distinct from one-off rooms, with its own membership and creator.
Clubhouse's own data point worth adopting directly: **recurring rooms at
a regular time slot build the most loyal returning audience** — the
same reason people plan around a favorite show. Village rooms should
support this same recurring-schedule pattern, not just permanent
ownership alone.

---

## Implementation status — re-sent 2026-08-27, already filed and **built**

This document was re-sent verbatim. Per `VACO.md`'s filing rule -- "if
the file exists, append a status section. Never replace the body" --
the body above is untouched and this section was appended.

**The district is built.** `vdp/dev-docs/phase-5-village-district/`
records the work, 13 of 13 tasks complete: a real 7th district cell in
`vdp/src/lib/world.js` (`id: 'village'`, at grid 300/580) with a
walkable multi-room interior in `vdp/src/lib/villageDistrict.js` and
`VillageDistrictView.jsx`. The outer world grew one row rather than
being redesigned, so the original six districts kept their positions.

Two things that phase found are worth carrying forward, because both
are about this document's own claims:

1. **The precedent claim in the body above is false.** It says the
   Village should get "the same treatment already given to VAGO's
   Resort & Casino, which is a real walkable destination inside VDP."
   The phase grepped `DISTRICTS` and found no VAGO entry at all, and
   VAGO's own README described its casino world as "a VENVS/VDP-side
   build, not this backend," unbuilt. The Village was a first, not a
   copy. (A `vago` district exists now, but as `contentType:
   'vago-embed'` -- a doorway, not a place. Promoting it is the subject
   of `vdp/VDP_CASINO_FIRST_STARTER_WORLD.md`.)

2. **It contradicted `world.js`'s own native/lounge rule on purpose.**
   That header restricts physical space to native districts and VENVS'
   `CLAUDE.md` names VXLLAGE as a lounge. The conflict was resolved in
   VXLLAGE's favour per this document's direct instruction, and
   recorded as a flagged exception rather than silently reconciled.

**QVAN** is confirmed as the security/fraud agent named above, and is
real: `v4-proxy/QVAN_SECURITY_RESILIENCE_SCOPE.md` and
`v4-proxy/QVAN_LESLIE_DESKINS_TECH_AVATAR.md`. No new agent.

**What is not built from this document:** permanent creator-owned rooms
and the recurring-schedule pattern. The Clubhouse Clubs precedent and
the recurring-time-slot data point are both real and both still
unimplemented -- the built interior has rooms, not *claimable, owned,
scheduled* rooms. That remains open work.
