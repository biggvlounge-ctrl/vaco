# Phase 1 — VENVM real buildable slice

## Goal
VENVM (the ecosystem's AI production/marketing tool — script generation,
cross-platform reformatting, production pipeline) was confirmed at a
genuine 0%: no directory, route, or line of implementation existed
anywhere in this repo before this phase. Build the real, honest,
buildable slice of it — the parts that are standard, well-understood,
and fully computable without inventing a fake spec or fake rendering
capability to paper over the real gap (actual video rendering).

## Design
Three independent lib modules, one shared store, one Express server —
the same shape as every other app in this ecosystem:

- **`lib/scriptEngine.js`** — script-generation requests routed through
  V4/VACON's own real completion pathway via an injected `invokeFn`
  (identical posture to `vacon/server.js`'s `invokeViaV4Proxy`). VENVM
  never talks to Anthropic directly and never holds a key. A real
  completion failure marks the request `failed` with the real error —
  never a fabricated script.
- **`lib/crossPlatformReformat.js`** — real, deterministic reformat math
  against `PLATFORM_SPECS` (tiktok, instagramReels, youtubeShorts,
  twitterX), explicitly flagged as interpretive/time-sensitive since no
  VENVM source doc exists in this repo to cite instead.
- **`lib/productionPipeline.js`** — a real, enforced status machine
  (`script-ready` → `storyboard-ready` → `render-queued` → `rendered`).
  `videoUrl` stays honestly `null` unless a caller supplies a real
  external one — VENVM cannot produce pixels itself.
- **`lib/persistence.js`** — the same shared, generic file-backed
  persistence module every other app uses, wired in from the start.
- **`server.js`** — ties all three together behind a real Express API
  on port 8813.

No VENVM spec doc actually exists in this repo (confirmed by direct
`find`/`grep` across the whole tree) — only referenced by name in two
other docs. This phase builds the real, standard, buildable slice that
those references imply is real and possible, and plainly flags what's
out of reach (actual rendering, AI storyboard generation, no VDP
district yet, no economic model).

## Verification approach
- Real unit tests across all three lib modules: fit/doesn't-fit/trim
  math, unknown-platform rejection, full stage-progression enforcement
  (including rejecting skipped stages), `markRendered` staying null with
  no supplied URL, a real successful script generation, and a real
  completion failure marking the request `failed` with the real error.
- Live verification against a real running server on port 8813: real
  reformat call across all 4 platforms, a full real production-job
  progression through all 4 stages via curl, and a real script-generation
  request correctly returning a real 502 since v4-proxy is honestly down
  in this environment (no `ANTHROPIC_API_KEY`).
- Restart-survival: killed the running process, restarted it, confirmed
  the same real production job came back unchanged from disk.

## Done when
- All 4 lib modules + server.js pass `node --check`.
- Unit tests pass.
- Live server checks pass against a real running instance.
- Restart-survival confirmed.
- README documents the real source-material situation, run/test
  instructions, what's here, what's verified, and what's not yet built.
