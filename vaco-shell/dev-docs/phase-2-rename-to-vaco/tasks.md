# Tasks — Phase 2: Rename to VACO

- [x] Confirm scope with the user: rebrand only, or rename the
      directory too (a real collision risk existed with the repo's own
      `vaco/` root) — user chose a real directory rename, to
      `vaco-shell/` (not bare `vaco/`).
- [x] `git mv shell vaco-shell` — preserves file history.
- [x] `package.json` — `name: "vaco-shell"`, description updated to
      say VACO.
- [x] `server.js` — header comment, `/api/health`'s `service` field
      (`'vaco'`), and the startup console log all updated to VACO;
      the Shield-proxy logic itself untouched.
- [x] `public/index.html` — `<title>`, `<h1>`, and the "Ask Shell" →
      "Ask VACO" insight-box heading updated.
- [x] `README.md` — title, intro, and every reference to this app's
      own identity updated to VACO; the "Shell vs. Shield" section
      expanded into a real three-way VACO/Shell/Shield note; every
      quote from another app's own source doc (which literally says
      "Shell") left verbatim, not rewritten.
- [x] Phase 1's own dev-docs left as-written — accurate history, not
      retroactively edited.
- [x] Write this plan/tasks pair.

## Next
None — this was a naming-only pass. Functional next steps are still
the ones Phase 1 already named: real cross-origin SSO, a persistent
registry, a real LLM completion once a key exists.
