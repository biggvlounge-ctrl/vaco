# Tasks — Phase 1: Vex Trading shell

- [x] Checked existing "one app, sub-apps" precedents (vacay/vago vs.
      vaco-shell) before picking a shape; vaco-shell's thin-launcher
      pattern fit best given VEX and Vex Business are different stacks.
- [x] `package.json`, `.gitignore`.
- [x] `lib/registry.js`: real, static two-entry sub-app registry, each
      entry honest about where its real UI actually lives.
- [x] `server.js`: `/api/health`, `/api/apps`, `/api/apps/:id`, each
      with a real, live `reachable` check (2s timeout) against the
      sub-app's own `/api/health`.
- [x] `public/index.html`: real minimal launcher page, two cards
      rendering live status + a link to each sub-app's real UI.
- [x] Live-verified: `vex` up + `vex-trading` up + `vex-business` API
      deliberately down -> `GET /api/apps` correctly reported the real
      mixed reachability (`true`/`false`), not a static assumption.
      `GET /` confirmed serving (200).
