# Plan — Phase 17: real caller authorization on card/pack routes

## Goal
Extend the same `optionalOwnAccount(bodyField)` pattern V3 established
(closing the ecosystem audit's highest-severity finding) to VOKEN's
own two routes that move real value/ownership on a named user's
behalf.

## Real constraint checked before writing anything
`../vex/lib/vokenClient.js` calls `/api/card/:id/transfer` and
`/api/card/:id/edition` as a trusted server-to-server caller, with no
end-user session at all (VEX's own real brokerage settlement). A hard
`requireSession()` would have 401'd that already-working integration
this same session verified end to end. Confirmed this by reading
`vex/lib/vokenClient.js` directly before choosing the optional-auth
shape over VXLLAGE's stricter one.

## Design
`lib/shieldAuth.js` (same shape as `v3/lib/shieldAuth.js`).
`POST /api/card/:id/transfer` now runs `optionalOwnAccount('fromOwnerId')`;
`POST /api/pack-tier/:id/open` now runs `optionalOwnAccount('buyerId')`.
No Authorization header -> unchanged passthrough; a header present
must match the route's real acting-user field or the request is
rejected 403.

## Verification approach
Live, in this order: re-ran the existing VEX<->VOKEN end-to-end check
(unauthenticated, real card mint -> broker account -> order -> edition
transfer) to confirm zero regression on the already-shipped
integration. Then, separately: minted a card owned by `alice`, and
confirmed `bob`'s real Shield session attempting
`fromOwnerId: "alice"` on `/api/card/:id/transfer` is rejected 403.

## Done when
Card ownership transfers and pack purchases reject impersonation from
a real, differently-owned Shield session, while VEX's own real
server-to-server settlement keeps working exactly as before.
