# Tasks — Phase 3: real click-through attribution window

- [x] Re-read `affiliateLinks.js`/`orders.js` to find the real root
      cause (no buyer identity attached to a click at all).
- [x] `store.js` — add `affiliateClicks: []`.
- [x] `affiliateLinks.js` — `recordClick` takes a real `buyerId`, logs
      a real click event; new `CLICK_ATTRIBUTION_WINDOW_MS` (TikTok
      Shop's real, cited 7-day figure); new `findAttributedLink`
      (last-click-wins within the window).
- [x] `orders.js` — `createOrder` falls back to `findAttributedLink`
      only when no explicit `affiliateLinkId` given; the order's own
      `affiliateLinkId` field now records the real resolved link, not
      the raw caller input.
- [x] `server.js` — the click route now passes `buyerId`/`now` from
      the request body through to `recordClick`.
- [x] 6 plain-Node checks — all passing.
- [x] Live pass: real V3 + CHOPZ SHOP started (post-cutover defaults),
      a real click logged, a real order with no explicit id correctly
      auto-attributing and paying the real commission, confirmed
      against V3's own balance.
- [x] Shut down all test servers.
- [x] Update `chopz-shop/README.md` — new Phase 3 bullets in "What's
      here", a new "Verified" paragraph, and the resolved item removed
      from "Not yet built".
- [x] Write this plan/tasks pair.

## Next
No further real gaps flagged in this module beyond the already-noted,
genuinely infrastructure-blocked items (live shopping, true
all-or-nothing cart transactions).
