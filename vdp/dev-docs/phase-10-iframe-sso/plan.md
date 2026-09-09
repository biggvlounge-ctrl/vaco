# Plan — Phase 10: close the embedded-iframe SSO gap

## Goal
Phase 8 closed the direct-visit half of the cross-origin SSO gap
(VDP/VENVS reading the Shell's own `?shieldToken=`) but explicitly
left the embedded-iframe case open: entering the Publisher district
still showed VENVS's own login prompt inside the frame, since the
iframe's `src` carried no token.

## Design
No new mechanism needed. VENVS's own `adoptToken()` (built in Phase 8)
already reads `?shieldToken=` from `window.location.search` on mount —
and a browser gives an iframe its own `window.location` based on the
iframe's own `src`, regardless of whether that `src` is loaded as a
top-level navigation or inside a frame. So the fix is one line:
`WorldView.jsx`'s Publisher-district `<iframe src=...>` now appends
`&shieldToken=${session.sessionToken}` alongside the existing
`?view=${venvsView}` — VENVS-side code didn't change at all.

## Verification approach
Live, in a real browser, with a definitive before/after rather than
just "no login prompt visible" (which could just mean the view
silently degrades): hit VENVS's own `?view=publisher` route directly
with no token — confirmed **zero** Buy buttons render (the view gates
on a real session). Hit the same route with a real token appended —
confirmed the Buy button appears and a real purchase completes
end-to-end through V3 (`"Bought \"Cherokee St After Dark\" for 5.99
VCoin — 4.04 VCoin paid to author"`). Then confirmed the actual
in-app flow: log into VDP, walk to the Publisher district, enter it,
and confirm the real iframe `src` carries `shieldToken=...`.

## Done when
Entering VDP's Publisher district shows an already-authenticated
VENVS Publishing view, no second login, with a real purchase capable
of completing inside the frame.
