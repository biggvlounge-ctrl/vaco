# Plan — close the identity-cross-check gap this app's own README flagged

`lib/shieldAuth.js`'s own header already documented a real, deliberate
gap: `requireSession()` proves a valid session exists but never
cross-checks *which* user it belongs to against a route's own
acting-user field. VXLLAGE already applies `requireSession()` to its
two real VCoin-moving routes (`boostVillage`, `purchaseCosmetic`), so
this wasn't an open-API problem like the other 8 apps in this
pass — it was specifically the impersonation gap.

## Design
Added `requireOwnAccount(bodyField)` to the existing `shieldAuth.js`
(reads `req.sessionUserId`, already set by `requireSession()`) rather
than writing a whole second auth module. Chained after
`requireSession()` on `/api/villages/:id/boost` (`boosterId`) and
`/api/cosmetics/:id/purchase` (`buyerId`).
`/api/avatar-cosmetics/purchase` wasn't touched — it charges the
session's own user directly, no separate acting-user body field to
cross-check.

## Verification
Live: a real second Shield session (`dave`) holding a genuinely valid
session, claiming `boosterId: "carol"`, was rejected 403 — the exact
gap this file's own header described, now closed. Confirmed
`requireSession()`'s own pre-existing behavior (401 with no token at
all) is unchanged.
