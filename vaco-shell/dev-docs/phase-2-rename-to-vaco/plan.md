# Plan — Phase 2: Rename to VACO

## Goal
Rename this project from "Shell" to "VACO" per direct instruction —
the ecosystem's own name, given to the one real front door to all of
it. A naming decision, not a functional change.

## Real investigation before any code
The repo's own root directory is already `vaco/` (this whole
monorepo). Renaming this project's own directory to bare `vaco/` would
collide with that. Confirmed via direct instruction that a real
directory rename (not just a display-name change) was wanted, so
`shell/` → `vaco-shell/` was chosen: keeps the real collision away from
the repo root while keeping the directory name traceable to what the
app actually is and was.

## Design
- Directory renamed via `git mv shell vaco-shell` — preserves file
  history rather than a delete+recreate.
- `package.json`'s `name` → `vaco-shell` (matches the directory);
  its `description` and every user-facing string (README title, page
  `<title>`, `<h1>`, the "Ask Shell" insight box heading, `server.js`'s
  own startup log line, the `/api/health` response's `service` field)
  → "VACO".
- The underlying `/api/session` proxy target and the "Shield" session
  contract's own name are unchanged — this is a rename of the launcher
  app itself, not the session service it sits on top of.
- Historical Phase 1 dev-docs are left as-written (they were accurate
  when "Shell" was this project's real name) rather than retroactively
  rewritten — the same posture already used elsewhere this session for
  naming drift (VACANCY→VACON-C's own docs, kept under their original
  filenames with a naming note up top).
- README's own "Shell vs. Shield" section becomes a real three-way
  note: VACO (this app's own name), Shell (what other apps' own docs
  call the concept it implements), Shield (the session contract
  underneath) — three names, one real, connected picture, not silently
  collapsed into one.

## Explicitly NOT in this task
Any functional change to the registry, session proxy, or insight card
— this is a naming-only pass. Renaming the "Shield" session contract
itself, or touching `venvs-mock-backend`.

## Verification approach
`npm install`/`npm start` from the new `vaco-shell/` directory
confirmed working with the renamed `package.json`; the renamed
`/api/health` response's `service: 'vaco'` field confirmed present.

## Done when
- The directory, package name, and every user-facing string
  consistently say VACO.
- Nothing else about the app's real, already-verified behavior changed.
