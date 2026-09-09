# Plan — Phase 4: label-level deal shapes

## Goal
Close the README's own previously-flagged gap: "Label-level (not just
personal-manager) deal shapes — advances, recoupment, per-release (not
blanket) deals — a real, different economic structure from the
personal-manager commission built here."

## Real investigation before any code
No VACO source doc specifies exact label-deal terms or percentages.
Grounded instead in real, standard, well-known record-industry
mechanics: a real upfront advance, real recoupment against future
earnings, and a real ongoing post-recoupment split — the actual shape
every traditional and modern record deal uses, genuinely different
from `managers.js`'s commission-only relationship (money only ever
flows artist → manager there; a label deal reverses that at signing).

## Design
New file `lib/labelDeals.js`, deliberately NOT requiring `releases.js`
(to avoid a circular dependency, since `releases.js` needs to require
labelDeals.js to apply a deal during `reportStreamingRevenue`) —
`signLabelDeal` takes an already-fetched `release` object rather than
a bare `releaseId`; the caller (`server.js`) fetches it first via
`releases.js`'s own `getRelease`.

`DEFAULT_LABEL_SHARE_PERCENT = 0.5`, a real, flagged interpretive
default modeled on modern "artist-friendly" label/imprint deals (real
digital-label-services precedents: AWAL, Stem, UnitedMasters' own
label offerings), not legacy 80/20-or-worse major-label splits —
matching this project's own DistroKid/TuneCore/gamma. positioning.

Real exclusivity mirroring `managers.js`'s own one-manager rule: one
active blanket deal per artist; one active deal per specific release;
a blanket deal blocks new per-release deals (and vice versa) while
it's in force ("active" for this purpose includes `fully-recouped` —
the relationship stays in force after the advance clears).

`applyLabelDeal(deal, grossShare, now)` is the real recoupment math:
recoup up to what's left of `recoupmentBalance`, flip to
`fully-recouped` the moment it hits zero, split whatever remains by
`labelSharePercent`. `releases.js`'s `reportStreamingRevenue` applies
this to the primary artist's own share BEFORE computing a management
commission (if any) — the manager commissions what the artist actually
receives from the label relationship, not the pre-label gross.

## A real bug the live pass caught
A report can fully absorb the primary artist's own share into
recoupment, leaving their real `netShare` at exactly `0`. The original
code called `transferFn` unconditionally for every collaborator's
share — V3's own real ledger rejects a zero-amount transfer outright,
and the plain-Node test suite's own fake ledger didn't (until
tightened to match), so the very first live HTTP pass surfaced this
directly, mid-report, after the label's own real recoupment transfer
had already committed. Fixed by skipping the transfer when `netShare`
is `0`; a dedicated regression check (#10) was added to the plain-Node
suite afterward, and the live pass was re-run to confirm the fix
against the actual running server.

## Explicitly NOT in this task
Cross-collateralization (recouping one release's advance from a
different release's earnings) — recoupment stays scoped to one named
release or the whole artist, not selective cross-release clawback. A
co-writer holding their own separate label deal on their own share of
a release — `applyLabelDeal` only ever runs against the primary
artist's share.

## Verification approach
10 plain-Node checks (including the zero-netShare regression). A live
pass against the real running server and V3 mock: a real advance
confirmed paid, a report fully absorbed by recoupment confirmed
returning `HTTP 201` with no crash, a second report confirmed
splitting the remaining balance and flipping the deal to
`fully-recouped`, plus blanket-exclusivity and reason-required
termination confirmed rejected over real HTTP.

## Done when
Real label-deal mechanics exist, grounded in standard record-industry
practice rather than an invented shape, correctly layered with the
existing management-commission feature, tested, and live-verified
against the actual running server — including the real bug the live
pass itself found and fixed.
