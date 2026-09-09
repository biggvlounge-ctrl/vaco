# Tasks — Phase 1: start-ecosystem.sh / stop-ecosystem.sh

- [x] Grep every app's own `server.js` for its real `PORT` default --
      no port guessed.
- [x] Write `start-ecosystem.sh`: data-driven app list, background
      each real start command, real per-app health-check polling,
      honest UP/DOWN report.
- [x] Write `stop-ecosystem.sh`: PID-based stop plus a real safety-net
      sweep for leftover node/vite children.
- [x] Add root `.gitignore` for the runtime `logs/` directory (didn't
      exist before).
- [x] Run it for real -- found two real bugs (nested-path logging,
      empty PID files) via actual output, not code review.
- [x] Fix both; re-run for real: 23/24 up, the 24th honestly DOWN for
      a real, pre-existing reason (missing `ANTHROPIC_API_KEY`).
- [x] Run `stop-ecosystem.sh`; confirmed via `ps aux` that every
      process was actually gone afterward.
- [x] Clean up test logs; write this plan/tasks pair.

## Next
Nothing further planned for this specific piece -- it's intentionally
minimal (no process supervision/auto-restart, no dependency ordering
between apps, since none of the real apps currently require one
another to be up before they themselves start).
