# Plan — Phase 6: real persistence

## Goal
Close this app's own real, previously-flagged gap: in-memory-only
state that a restart (or a crash) wiped completely. Same shared,
generic module every other app in this ecosystem now uses --
`lib/persistence.js` -- wired in here with zero changes to any of
Vavlt Stvdios's own real business logic in `lib/*.js`.

## Design
`server.js`'s own `const store = create*Store();` line now reads
from (and, from then on, writes to) a real file,
`data/store.json`, via `createPersistentStore(path.join(__dirname,
'data', 'store.json'), create*Store)`. On boot: loads the file if
present, shallow-merged over a fresh default -- so a later addition of
a new top-level field (this store's own real fields today: channels, channelGroups, channelChats)
doesn't crash trying to load an older file missing it. After
boot: every real mutation anywhere in the store tree is caught via a
recursive Proxy and debounce-flushed to disk (200ms) -- no call site
in this app's own `lib/*.js` files had to change to opt in.
SIGTERM/SIGINT both flush synchronously before exit, so a normal
`kill`/`stop-ecosystem.sh` doesn't lose the last debounce window.

## Verification approach
Created a real streaming channel, confirmed the resulting real data landed in
`data/store.json` on disk, killed the real running process, restarted
it, and confirmed the exact same data came back from a real GET --
proving actual restart-survival, not just a file that gets written.
`data/` is gitignored (repo-root `.gitignore`'s own `**/data/`
entry) -- runtime state, not source.

## Done when
A restart of this app (port 8808) no longer loses any real state
that had been written before the restart.
