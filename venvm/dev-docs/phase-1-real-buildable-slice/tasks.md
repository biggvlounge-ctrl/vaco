# Phase 1 — VENVM real buildable slice — tasks

- [x] Confirm, by direct `find`/`grep` (not assumption), that no VENVM
      implementation or spec doc exists anywhere in this repo.
- [x] `package.json` — standard shape (express, cors, dotenv).
- [x] `lib/persistence.js` — copied verbatim from the ecosystem's shared
      pattern (`void/lib/persistence.js`).
- [x] `lib/store.js` — `createVenvmStore()`.
- [x] `lib/scriptEngine.js` — `submitScriptRequest`, `getScriptRequest`,
      `generateScript` (real success + real honest failure, routed
      through an injected `invokeFn`).
- [x] `lib/crossPlatformReformat.js` — `PLATFORM_SPECS`,
      `reformatForPlatforms`.
- [x] `lib/productionPipeline.js` — `PRODUCTION_STAGES`,
      `createProductionJob`, `getProductionJob`, `requireStage`,
      `advanceToStoryboard`, `queueRender`, `markRendered`.
- [x] `server.js` — full Express app on port 8813, `invokeViaV4Proxy`,
      all routes wired, persistent store.
- [x] `npm install` in `venvm/`.
- [x] 8 real unit tests across all 3 lib modules, run and passed, scratch
      test file removed afterward.
- [x] Live verification: `/api/health`, `/api/reformat` across all 4
      platforms, full production-job stage progression via curl, real
      script-generation 502 (v4-proxy down, no key) confirmed as a real
      failure path.
- [x] Restart-survival confirmed (kill, restart, same job state persists).
- [x] Test/runtime artifacts cleaned up (`data/`, scratch test file).
- [x] README.md — source-material honesty, run/test, what's here,
      verified, not yet built.
- [x] plan.md / tasks.md (this file).

## Next
- Real VDP district + view component for VENVM, once a script/production
  job UI is worth surfacing.
- AI storyboard-generation logic (currently a plain caller-supplied
  field).
- Revisit actual rendering if/when real rendering infrastructure
  (Seedance/Kling/Runway/Nerfstudio-class tools) is ever available in
  this environment — currently a real, permanent ceiling, not a deferred
  task.
