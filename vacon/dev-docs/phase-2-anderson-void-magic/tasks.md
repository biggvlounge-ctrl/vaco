# Tasks — Phase 2: Anderson (VOID MAGIC)

- [x] Add Anderson to `lib/agents.js`'s `AGENTS` array (`app: 'VOID
      MAGIC'`, `tier: 'user'`, role "Live Events Executive", a real
      systemPrompt grounded in VOID MAGIC's own already-built feature
      set).
- [x] Add Anderson's real domain keywords to
      `lib/orchestrator.js`'s `DOMAIN_KEYWORDS`.
- [x] Verify in plain Node (11 checks): registry count/uniqueness,
      `getAgent`/`listAgents` correctness, `app` filtering keeping VOID
      and VOID MAGIC distinct, three real routing queries.
- [x] Verify live: the real server's `/api/agents/anderson`,
      `?app=VOID%20MAGIC` filter, and a real routed query.
- [x] Shut down test server; confirmed via port check.
- [x] Update `README.md` — roster list, "What's here," a new Verified
      entry including the flagged keyword-ambiguity note.
