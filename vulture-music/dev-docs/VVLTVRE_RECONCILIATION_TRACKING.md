# Vvltvre family — doc-vs-code reconciliation tracking

One tracking file for all four Vvltvre sub-apps (`vulture-music`,
`vulture-flix`, `vulture-pods`, `vulture-studios`), since they share
the Vvltvre umbrella identity. Each line is one real mismatch found by
checking a markdown claim directly against the current code (not
trusted from an older doc or comment).

A prior round (commit `838996b`) already reconciled Flix/Pods/Studios'
"Implementation status" sections (subscription tiers, VDP embeds, VACO
Analytics feeds, the 10-category show list, the 10% platform take, and
cross-app distribution into `vulture-music`) and found VENVM's test-
coverage gap (out of scope for this file — tracked in `venvm/README.md`
itself). This round re-derived the remaining work from scratch, since
no checklist from that prior pass survived context compaction.

## Found and fixed this round

- [fixed] `vulture-pods/package.json` had no `test` script (`npm test`
  → "Missing script") despite every sibling app (`vulture-music`,
  `vulture-flix`, `vulture-studios`) having the identical
  `"test": "node --test test/*.test.js"` entry, and despite
  `vulture-pods/README.md` repeatedly citing specific, runnable test
  counts (27/27, etc.) that were only ever actually run via a direct
  `node --test` invocation. Added the missing script so `npm test`
  works the same way here as in every sibling. No behavior change;
  27/27 tests still pass.
- [fixed] `vulture-flix/README.md`'s "Not yet built" section still
  said "Any UI — this phase is the real API and data model only,"
  predating that same file's own "Frontend coverage pass (31 Oct
  2026)" section, which describes a real, working `public/index.html`
  (Catalogue/Account/Creators tabs). The stale bullet was never removed
  once the frontend landed. Corrected in place using this file's own
  established strikethrough-plus-"Done" convention (already used
  elsewhere in `vulture-studios/README.md`'s own "Not yet built"
  section).
- [fixed] `vulture-pods/VULTURE_PODS_COMPARABLES.md`'s "What is
  genuinely built" line claimed "distribution from Vvltvre Studios."
  False: nothing in `vulture-studios/server.js` or
  `vulture-studios/lib/*.js` references `vulture-pods` under any name
  (confirmed by direct grep, not assumed). A studio-financed `podcast`
  project distributes into **Vvltvre Music's** own `podcast-episode`
  format directly, explicitly bypassing a Vvltvre Pods Show/Episode
  wrapper — `vulture-studios/README.md`'s own "Real music/podcast
  distribution (Phase 2)" section already said this in prose; this
  comparables doc's summary line just never matched it. Corrected with
  an appended dated note, old claim left visible rather than silently
  deleted.
- [fixed] `vulture-studios/VULTURE_STUDIOS_COMPARABLES.md` had the
  same false claim in two places — its opening "What it is" line
  ("distributes the output into Vvltvre Music and Vvltvre Pods") and
  its "What is genuinely built" line ("real distribution into Vvltvre
  Music and Pods"). Corrected to name the real two targets
  (`vulture-flix` for film/tv, `vulture-music` for music/podcast),
  with the same appended-correction treatment; the already-present
  "Implementation status (verified 13 Nov 2026)" section from the
  prior round had re-confirmed the `vulture-music` half of this claim
  but never checked the "Pods" half, which is why it slipped through
  that pass.

## Checked this round and confirmed accurate (no fix needed)

- `vulture-music/README.md` — every checkable claim verified directly:
  31 real Express routes (matches "31 routes" in the Frontend coverage
  section), 38/38 tests passing, `ownershipRetainedPercent: 100`,
  `DEFAULT_COMMISSION_PERCENT` (17.5%), `DEFAULT_LABEL_SHARE_PERCENT`
  (50%), the real CVLLEX physical-run cross-app call (CVLLEX's own
  real 100-unit pressed-media minimum confirmed in
  `cvllex/lib/physicalProduction.js`), the real VACO Analytics
  `streaming_revenue`/`beat_sales_revenue` metric pushes, and VOKEN's
  real live read of this app's artist stream-count endpoint
  (`voken/lib/establishedCreatorAssessment.js`). This app was not
  touched by the prior round and had no stale claims.
- `vulture-music/KICK_GAMMA_MUSIC_COMPARABLES.md` — `ownershipRetainedPercent:
  100` confirmed in `lib/releases.js`; Kick-alongside-Twitch confirmed
  in `vavlt-stvdios/lib/screenSessions.js`. The doc's own prior
  self-correction (Tix & Touring not existing as a Vvltvre division)
  still holds.
- `vulture-flix/README.md` — 19 real routes, 25/25 tests, the Phase 6
  studio-produced-title cross-reference into `vulture-studios`, and
  the real `GET /api/creators/:creatorId/view-count` VOKEN integration
  all confirmed against current code.
- `vulture-pods/README.md` — 21 real routes (18 cited for the 31 Oct
  pass, +3 for the show-notes/transcript/chapters routes added 1 Nov —
  consistent with the dated history, not drift), 27/27 tests, the real
  cross-app call into `vulture-music`'s `POST /api/releases`, and the
  real length-aware Vavlt Stvdios Reel/Video routing
  (`MAX_VIDEO_DURATION_SECONDS` confirmed in `vavlt-stvdios/lib/videos.js`)
  all confirmed.
- `vulture-studios/README.md` — 12 real routes (9 explicitly named in
  "What's here" + health + the two funding-safeguard routes added 5
  Nov and fully described in their own later section), 23/23 tests
  (matches the "16/16 → 23/23" claim), the real `vulture-flix`
  (`registerWithVultureFlix`) and `vulture-music`
  (`registerWithVultureMusic`) cross-app calls, and the real
  funding-deadline-refund / minimum-investment-floor safeguards all
  confirmed against current code.
- `vulture-flix/VULTURE_FLIX_COMPARABLES.md`,
  `vulture-pods/VULTURE_PODS_COMPARABLES.md`'s 10%/10-category claims,
  and `vulture-studios/VULTURE_STUDIOS_COMPARABLES.md`'s VOKEN-gating-
  asymmetry claim — all already reconciled by the prior round
  (`838996b`) and re-spot-checked here; still accurate except for the
  one "Pods" distribution error noted above, which that round's own
  "Implementation status" pass did not catch.

## Open gaps (not this family's doc-vs-code mismatches, noted for
   awareness only, not filed as a fix here)

- None found beyond the items above. No speculative features were
  added; this round is reconciliation only.
