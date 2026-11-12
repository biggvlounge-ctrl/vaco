# VDEX

**Vertical Vision Development Exchange.** The ecosystem's nationwide
property acquisition, foreclosure intelligence, real estate
development, and investment underwriting platform. Home #19 in
`VACO.md`'s filing table — a deliberate exception to that document's
own "no nineteenth" rule, opened 11 Nov 2026 because VDEX is a
standalone-platform-scale build (the same scale as VACON-C, VAGO,
VDP, VOID, VOKEN), not a satellite feature that would file under an
existing parent the way DREAMS/VENVM/YAP do. See `VACO.md` Part 1 for
the exact reasoning and the moment the exception was made.

**Independent application, real constellation-mates.** VDEX is not
VACAY and not VOID, and is not merged into either — it has its own
identity, its own data, and its own canonical property record. Its
closest functional sibling in this repo is the **Vex** family
(`vex/`, `vex-business/`, `vex-trading/`): VDEX's underwriting engine
(cap rates, ROI, cash-on-cash returns, development margins, assembled-
parcel "projects") is the same deal-evaluation shape Vex already
applies to Cvltvre Cards and futures research, here applied to real
property instead. The real downstream connection is VACAY's own
`Home` section (`vacay/`), which already runs a Zillow-style
listings model (agents pay for leads) — a disposed/developed VDEX
property is meant to surface there, not be re-built there.

**VULCAN is disregarded — per direct correction, it was a mistaken
reference and VOKEN is the real entity.** Every integration this app
needs for tokenization/credentials/trust goes through `voken/`, which
is real and already exists in this repo (`VACO.md` home #12). No
VULCAN adapter is built, planned, or referenced anywhere in this app
going forward.

**Source doc**: `VDEX_MASTER_SPEC.md` — the full instruction this app
was opened from, filed with a real implementation-status section per
`VACO.md`'s own "a file is complete when it has a home, a status
section, and its unbuilt items named specifically" rule.

## What this is not, yet

No existing VDEX codebase was found anywhere accessible to this
session before this round — checked directly (`VACO.md`, a full repo
search, and a search across every repo on the account) rather than
assumed from the brief that arrived describing one. This is a
genuine greenfield build, not a continuation, and is filed here under
that honest premise rather than a fabricated "audit" of code that
does not exist.

## Real connections, not just registry entries

Checking VOID's actual code (not just its name on a dependency list)
surfaced two real capabilities VDEX would otherwise have duplicated:
`void/lib/staffing.js` is a real, payment-settled labor marketplace
already running through VOID's own shared request→match→accept→
complete→pay→rate loop, and `void/lib/realEstateMedia.js` is a real
HomeJab-style photo/video/drone/3D-tour/floor-plan service with
proximity auto-assignment. `backend/void-staffing-adapter.js` and
`backend/void-real-estate-media-adapter.js` request these real VOID
capabilities directly rather than VDEX building a second payment
system or a second media-capture pipeline — live-verified end to end
against real spawned Shield + VOID servers (see `CHANGELOG.md`'s
"real VOID connections" entry for the exact result, including the one
leg that reached VOID and authenticated correctly but was then
honestly refused by VOID's own real "no available provider" rule, not
a wiring failure).

## Scope discipline this app inherits from the rest of the ecosystem

- **Real data, cited, access method and licensing stated per source —
  never a claimed-but-unmeasured "nationwide" coverage.** Same
  discipline `vacon-c/world-layer/sources.js` already established for
  Census/HIFLD/FBI/FAO-class sources: every source gets a name,
  geography, access method, licence, and `wired` status, and
  "wireable" is not the same claim as "fetchable from this
  environment" (most government/county data hosts are blocked by this
  build environment's outbound proxy — build the real transform, note
  the block, exactly as every world-layer importer already does).
- **An integration is `IMPLEMENTED` / `CONFIGURED` / `UNVERIFIED` /
  `LIVE`, and those words mean exactly what the spec says they mean.**
  A connection is never called `LIVE` on a configured URL or
  credential reference alone — it has to have proven, successful
  communication with the real service.
- **Reuse the ecosystem's real shared infrastructure instead of a
  second, disagreeing copy of it**: `shared/serviceAuth.js` (the real,
  ecosystem-wide trusted-service token — this is what every other
  app already uses to call VACA/VASH/VOKEN/etc., and what VDEX's own
  integration adapters should present rather than inventing a second
  auth scheme) and `shared/settleOnce.js` (the real concurrency-safe
  settlement guard — directly relevant to deal-closing and commission/
  fee tracking, and the exact race this file's own header documents
  having been found and fixed in four other apps already).
- **Never execute a real financial transaction or tokenize a real
  asset without the real, connected, authorized service on the other
  end.** This is the spec's own explicit boundary and it is held
  exactly as written.
