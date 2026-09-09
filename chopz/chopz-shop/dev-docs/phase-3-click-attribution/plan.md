# Plan — Phase 3: real click-through attribution window

## Goal
Close this project's own previously-flagged gap: "Real click-through
attribution window for affiliate links (currently a real order must
explicitly pass the `affiliateLinkId` it came through; no cookie/
session-based attribution)." Part of a broader ecosystem sweep,
confirmed with the user before starting.

## Real investigation before any code
Re-read `affiliateLinks.js` and `orders.js`: `recordClick` only ever
took a bare `linkId`, with no buyer identity attached to a click at
all -- there was nothing a later order COULD automatically match
against, which is the actual root cause of the gap, not just a missing
lookup function. `createOrder` requiring an explicit `affiliateLinkId`
was a real, correct behavior to preserve (an explicit id should always
win), not something to remove.

## Design
`recordClick` now takes a real `buyerId` and logs a real
`{ linkId, buyerId, productId, clickedAt }` event to a new
`store.affiliateClicks` array. `findAttributedLink` looks up the most
recent real click by a given buyer on a given product within
`CLICK_ATTRIBUTION_WINDOW_MS` -- a real, cited figure (TikTok Shop's
own real, publicly documented 7-day affiliate click window), not an
invented one, grounded in the same comparable doc this project's fee
structure already cites. `createOrder` calls this automatically only
when no explicit `affiliateLinkId` is given, so the existing explicit-
id path is completely unchanged and backward-compatible. The order's
own `affiliateLinkId` field is fixed to record the real, resolved link
(whichever one actually earns the commission), not just echo the
caller's raw input, which would have been dishonest for an
auto-attributed order.

## Explicitly NOT in this task
Multi-touch/first-click attribution models (real last-click-wins is
the standard most affiliate programs, including TikTok Shop's, use).
Real browser cookies or session tokens -- this is a backend, so
"cookie/session-based" is modeled as buyerId-keyed click history, the
closest real backend equivalent.

## Verification approach
6 plain-Node checks (in-window auto-attribution, out-of-window
non-attribution, last-click-wins, cross-buyer isolation, explicit-id
override, and a no-click regression). A live pass against the real
running server and the real standalone V3: a real click logged, then a
real order placed with NO explicit `affiliateLinkId` at all,
confirmed auto-attributing and paying the real commission against
V3's own balance.

## Done when
Affiliate commission is genuinely attributable from a real click
history, not just an explicit id, confirmed by both isolated and live
tests, and the README's own "Not yet built" list no longer names this
gap.
