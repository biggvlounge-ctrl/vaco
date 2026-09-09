# Plan — Phase 12: real Yap safety signal on profile reads

## Goal
Close Yap's own directly self-flagged gap ("CVNVO's discovery stack
surfacing verification/Yap signals visibly," `yap/README.md`'s own
"Not yet built"): Yap already had a real, working `GET
/yap/summary/:subjectId`, and its own `GET /yap/lookup/:subjectId`
already combined that with a live CVNVO profile fetch -- but nothing
on CVNVO's own side surfaced that signal automatically. A caller had
to already know Yap existed as a separate service.

## Design
`GET /api/profiles/:userId` now makes a real, live fetch to Yap's own
`GET /yap/summary/:subjectId` (`fetchYapSignal`) and merges the result
in as `yapSignal` on the response -- the same live-merge shape this
route's own sibling, `POST /api/profiles`, already used for
`verifiedBadge` via `fetchIdentityStatus`. One real, deliberate
difference: `fetchIdentityStatus` is called once at profile creation
and allowed to throw (a bad create should fail loudly); `fetchYapSignal`
is called on every read and fails soft (`null`) instead -- a missing
safety signal is a real, honest degradation, not a reason to 500 an
entire profile view because Yap happens to be down.

## Verification approach
Live, against real running V3/VACA/CVNVO/Yap servers: confirmed a
profile with no reports returns a real `{totalReports:0,...}` (proving
genuine live connectivity, not a stub); created a second, genuinely
VACA-verified reporter and submitted a real Yap report through Yap's
own already-tested reporter-verification gate, then confirmed the
subject's CVNVO profile read reflected the real counts
(`{totalReports:1,redCount:1}`); killed Yap's real process mid-test and
confirmed the same profile read degraded gracefully to `yapSignal:
null` instead of erroring.

## Done when
A caller reading a CVNVO profile through CVNVO's own API sees the real
Yap safety signal without needing to separately know Yap exists.
