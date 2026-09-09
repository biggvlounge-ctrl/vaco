# Tasks — Phase 1: V4 Agent Proxy (retroactive record)

- [x] `server.js` — real Express proxy, env-based key, input
      validation, per-IP rate limiting, error passthrough without
      leaking the key.
- [x] Real live verification against the actual Anthropic API (per
      `README.md`'s own documented steps — health check, a real
      end-to-end completion, three failure-mode checks).
- [x] `V4Prototype.jsx` wired (later re-pointed through VACON's own
      `/api/agents/:id/invoke`, which itself calls straight into this
      server's `/api/agent` — this server's own role unchanged).
- [x] `README.md` already documents setup, verification, and the
      VACON re-pointing.
- [x] Write this retroactive plan/tasks pair, closing the missing-
      dev-docs gap found during a later priority pass.

## Next
None identified specific to this server — auth, persistent logging,
and per-user quotas are explicitly out of scope per the README's own
"Note on scope," pending real user accounts existing at all.
