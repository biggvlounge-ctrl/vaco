# VACO Shell doc/code reconciliation — tracking

Audit pass of VACO Shell's own markdown docs (`README.md`,
`VACO_MERCH_STORE.md`, `VACO_PALETTE_REGISTER.md`, `PRESENTATION_MODE.md`,
`VISUAL_DESIGN_COHESION_DIRECTIVE.md`) against the real, current code in
`vaco-shell/`, 13 Nov 2026. A prior round (see `git log --oneline --
vaco-shell/`) already fixed the stale VACON-C tile claim in `README.md`;
this round is a fresh pass, not a resumption of a known list — no
checklist for VACO Shell survived the compaction that preceded this round.

Convention followed: every correction below is appended with
`~~strikethrough~~` + a dated note, per this repo's own established
pattern already visible in `README.md`'s VACON-C correction — nothing
wrong was silently deleted.

## Found and fixed this pass

- [fixed] `README.md` — "the real app registry: 24 entries" / "the real
  24-app registry served and rendered as 24 tiles" (two spots). Checked
  directly: `lib/registry.js`'s `APPS.length` is 42, not 24. The registry
  grew (CVLLEX, `vash-tap`, `vaco-passport`, `vaco-operator`,
  `vaco-media`, `vaco-audit`, `vaco-notify`, `vaco-assistant`, and more
  folded in since) and the count was never bumped alongside it.
- [fixed] `README.md` — "The five `/api/assistant/*` routes here are now
  a thin proxy." Checked directly: `server.js` proxies 11
  `/api/assistant/*` routes, not 5. The original five (`tones`, `profile`
  GET/POST, `history`, `chat`) are still accurate; six more were added
  later for the FaceTime-style call flow (`/api/assistant/calls` and its
  `/:id`, `/:id/decline`, `/:id/events`, `/:id/end` siblings) and the
  README was never updated to mention or count them, even though
  `public/index.html` has a real, wired-up "personal assistant: FaceTime-
  style call" UI for them.
- [fixed] `README.md` — "Verified" section's "the real 24-app registry
  served and rendered as 24 tiles" — same stale count as above, in a
  second location; now marked as a snapshot of that pass rather than a
  current figure.
- [fixed] `VACO_MERCH_STORE.md` — "`registry.js` holds all 31 entries
  with their parent groupings." Checked directly: 42 entries, not 31,
  same underlying registry growth as the README items above.
- [fixed] `VISUAL_DESIGN_COHESION_DIRECTIVE.md` — "Still open: the other
  thirteen-plus apps have not been converted... Per-app palettes remain
  undecided except VACAY's." Checked directly: `public/vaco-design.css`
  and `public/vaco-ui.js` are now byte-identical copies in 34 other
  apps' own `public/` directories (confirmed with `diff`, not assumed),
  and every one of those 34 apps' `index.html` calls `VACO.app()` with
  its own real accent color and a one-line rationale comment — not just
  VACAY's. The one genuinely remaining gap (VDP takes the CSS only, not
  `vaco-ui.js`, and sets its accent inline rather than via `VACO.app()`,
  for a real documented reason) is now stated precisely in place of the
  old blanket "thirteen-plus apps" claim.
- [fixed] `VACO_PALETTE_REGISTER.md` — real, already-shipped accent
  colors with no row in the register: CVLLEX (`#b8732e`), YAP
  (`#d99a3f`), VACO Analytics (`#6f8fa8`), VACO Passport (`#3f6b8f`).
  All four were verified live in each app's own `public/index.html`
  before being added; no color was invented. Also noted (not fixed, it
  is a design observation rather than a doc/code mismatch): CVLLEX/YAP
  sit closer to Vex Trading/VAGO than the register's own "~10° apart"
  rule asks for, and VACO Analytics/VACO Passport sit almost on top of
  VEX — all three real in code as chosen, just worth a look if this
  corner of the wheel gets a fifth occupant.

## Checked and found accurate (no fix needed)

- `README.md`'s SSO/`?shieldToken=` handoff claims (`vaco-ui.js`'s
  `restoreSession()` reading the query param, validating it against
  Shield's real session-check endpoint) — confirmed against
  `public/vaco-ui.js`'s real `restoreSession()` function.
- `README.md`'s Earnings tab and Library Uninstall claims (31 Oct 2026
  pass) — confirmed both routes and both frontend surfaces exist and
  match the described behavior.
- `README.md`'s citation of `scripts/test/store-pricing.test.mjs` as the
  test that caught the `vaco-assistant`/`cvllex` pricing gap — initially
  flagged as a possible "cites a file that doesn't exist" issue (no
  `scripts/` directory inside `vaco-shell/` itself), but the file is real
  at the monorepo root (`/home/user/vaco/scripts/test/store-pricing.test.mjs`),
  imports `vaco-shell/lib/registry.js` and `vaco-shell/lib/seedStore.js`
  directly, and passes. The citation is accurate for this repo's
  established "repo-root `scripts/test/` holds cross-app consistency
  checks" convention; not a doc bug.
- `PRESENTATION_MODE.md` — already marked "Not built" with its own
  detailed, already-correct implementation-status analysis from an
  earlier pass; nothing further to reconcile.
- `VACO_MERCH_STORE.md`'s broader "built, in `lib/merchStore.js`" section
  — spot-checked against `lib/merchStore.js` and `server.js`'s
  `/api/merch/*` routes; descriptions match.
- `dev-docs/phase-1..6/{plan,tasks}.md` — left untouched. These are
  historical per-phase records (including phase-1's own "24 real app
  entries" snapshot, accurate for its own point in time), not living
  current-state docs, so they are not "corrected" the way `README.md`'s
  present-tense claims are.

## Not yet fixed (none — everything found this pass was fixed)

(empty — every mismatch found in this pass was corrected before commit)

## Test suite

`npm test` (`node --test test/*.test.js`) before and after all changes:
50 tests, 47 pass, 3 skipped (cross-app spawn tests skipped for missing
`vaco-assistant`/sibling `node_modules`, same before and after), 0
failures. No regressions — all changes in this pass were markdown-only.
