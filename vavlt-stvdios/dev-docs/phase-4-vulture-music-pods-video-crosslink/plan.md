# Plan — Phase 4: Vvltvre Music/Pods video cross-link

## Goal
Per explicit instruction: give Vvltvre Music and Vvltvre Pods their
own video component (music videos, video podcast episodes) similar to
YouTube, while keeping them "defined away from" Vavlt Stvdios' own
YouTube/Instagram-positioned setup — connected through a real link,
not duplicated.

## Real investigation before any code
Read Vavlt Stvdios' own README and `lib/posts.js` directly before
designing anything, since the user's "YouTube style" framing needed
checking against what's actually built: Vavlt Stvdios is real,
explicitly positioned against **six** comparables (YouTube, Instagram,
Patreon, OnlyFans, Kick/Twitch), not YouTube alone. Its content layer
(`posts.js`) is Instagram-shaped — `photo`/`reel`/`carousel`, with a
real, deliberate 20-minute cap on Reels (`REEL_MAX_DURATION_SECONDS`).
Its Channels layer is the real YouTube-comparable piece (channel-based
creator identity), but it's built for live streaming, not stored
on-demand long-form video.

This matters directly: a real music video (typically 3-8 minutes)
fits the Reel primitive cleanly. A real video PODCAST episode
(commonly 30-90+ minutes) routinely does not. Rather than silently
expanding Vavlt Stvdios' own deliberately-chosen 20-minute constant to
accommodate podcasts, the real, honest choice is to reuse the Reel
primitive as-is and let its own real validation naturally gate what
fits -- flagging the resulting length mismatch directly in both
Vvltvre Pods' and this project's own README rather than hiding it.

## Design
`lib/posts.js`'s `POST_SOURCES` gains `'vulture-music'` and
`'vulture-pods'`, the same real "tag the real origin" precedent
`'hvntz-checkin'` already established for HVNTZ's own checkpoint
photo-proof posts. No other change on this side -- `createPost`'s
existing real validation (duration cap, required fields) already does
everything needed; `vulture-music`/`vulture-pods` are just two new,
real, legitimate callers of the exact same `POST /api/posts` route
everything else already uses.

## Explicitly NOT in this task
Any new post type, any change to `REEL_MAX_DURATION_SECONDS`, any
long-form video primitive. Those would need their own real, separate
justification -- this task is the minimal, real integration point.

## Verification approach
1 plain-Node check (`POST_SOURCES` includes both new values) plus a
live pass across four independently running servers -- see
`../../vulture-music/dev-docs/phase-5-video-crosslink/` and
`../../vulture-pods/dev-docs/phase-2-video-crosslink/` for the full,
shared live-pass record (a real music video attached and independently
confirmed on this server; a real short video episode attached; a real
long video episode attempt correctly rejected by this server's own
validation).

## Done when
Vvltvre Music and Vvltvre Pods can each attach a real video to their
own content via this server's real Reel infrastructure, with the real
20-minute mismatch for long podcast episodes surfaced honestly, not
silently patched.
