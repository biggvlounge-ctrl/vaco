# VENVM

The ecosystem's AI production/marketing tool. Confirmed, by direct
investigation rather than assumption, to have been the one real
shared system this ecosystem's own status audit found at a genuine
0% — no directory, route, or line of implementation existed anywhere
in this repo before this build.

## Scope boundary — read this before adding anything

**VENVM is the AI production/content pipeline. That is its whole
scope.** Script generation, storyboard/production staging,
cross-platform reformatting, and likeness consent. Nothing else.

Founder decision, recorded because the source documents blur this:
the ~20-game puzzle/casual gaming system described in
`VENVM_INTERNAL_OPERATING_SYSTEM_EXPANSION.md` (items 6–8 — Bingo,
Crossword, Sudoku, Trivia, card/board games, tournaments) is **not
VENVM's**. It belongs to **VDP's Casino/Resort district or VACON-C**,
and appears in that document only because the document happened to
cover it. Route it there when that work resumes; do not build it here.

Same caution applies generally: that expansion document describes
twelve feature areas, and several of them are other apps' work
described in VENVM's file. Check the scope boundary above before
treating anything in it as VENVM's to build.

**Real, honest source situation** (updated as documents were filed):
three of the four docs the master index references by name are now
present here — `VENVM_MARKETING_DTC_CAPABILITIES.md`,
`AI_HUMAN_TWIN_AD_GENERATION_VENVM.md`, and
`VENVM_INTERNAL_OPERATING_SYSTEM_EXPANSION.md` (the last received as a
partial, missing items 1–2). Still absent:
`PHOTO_GROUNDED_SCENE_GENERATION_CAMERA_CONTROL.md`. When this build
happened, none of them were present — checked directly (`find`/`grep`
across the whole tree), not assumed. What those references confirm: a real
production stack (Seedance 2.5, Kling 3.0, Runway Gen-4.5, Nerfstudio
3DGS, Sudowrite, Jasper) and a lead named "Jake." This build doesn't
invent a fake spec to fill that gap — it builds the real, honest,
buildable slice the same way this session builds any other
undocumented-but-obviously-real feature, and flags plainly what's out
of reach.

## Run
```
cd venvm && npm install && npm start   # localhost:8813
```
Also needs `../v4-proxy` running (with a real `ANTHROPIC_API_KEY`) for
real script generation to succeed — without it, `/api/scripts/:id/generate`
still runs for real and returns an honest error, the same way every
other agent in this ecosystem behaves without a key.

## Test
```
curl http://localhost:8813/api/health
curl -X POST http://localhost:8813/api/reformat -H "Content-Type: application/json" -d '{
  "sourceDurationSeconds": 120, "sourceAspectRatio": "16:9",
  "platforms": ["tiktok", "instagramReels", "youtubeShorts", "twitterX"]
}'
```

## What's here
- `lib/scriptEngine.js` — real script-generation requests, routed
  through V4/VACON's own real completion pathway
  (`invokeViaV4Proxy`, the identical pattern `vacon/server.js` already
  established) — VENVM never talks to Anthropic directly and never
  sees a key. A real completion failure (no key behind v4-proxy,
  v4-proxy unreachable, a real upstream error) marks the request
  `failed` with the real error attached — never a fabricated script.
- `lib/crossPlatformReformat.js` — real, deterministic reformatting
  math: given a source video's real duration (and, optionally, aspect
  ratio) and a list of target platforms, computes whether it fits each
  platform's real constraints and a real recommended trim duration if
  not. Platform specs (`PLATFORM_SPECS`) are real, publicly documented
  constraints as broadly understood — flagged directly as interpretive
  and time-sensitive (platforms change upload limits over time), same
  posture as CHOPZ's own cited TikTok Shop attribution window.
- `lib/productionPipeline.js` — a real status machine: `script-ready`
  → `storyboard-ready` → `render-queued` → `rendered`, each transition
  enforced (can't skip a stage). `videoUrl` is a real field that stays
  honestly `null` unless a caller supplies a real external one — VENVM
  itself cannot produce pixels.
- `lib/persistence.js` — the same shared, generic file-backed
  persistence module every other real app in this ecosystem uses,
  wired in from day one (not added later).
- `server.js` — the real Express API tying all three together.

## Verified
8 real unit tests across all three lib modules (a video that fits vs.
one that doesn't and gets a real recommended trim, an unknown-platform
rejection, the full production-stage progression enforced in order,
`markRendered` staying honestly `null` with no supplied URL, a real
successful script generation, and a real completion failure marking
the request `failed` with the real error — no fabricated script).

Then live, against the real running server: a real reformat call
(confirmed correct fits/doesn't-fit/aspect-change flags across all 4
platforms), a full real production-job progression through all 4
stages, and a real script request whose `/generate` call correctly
returned a real 502 with the real error, since `v4-proxy` is honestly
down in this environment (no `ANTHROPIC_API_KEY` configured) — proving
the failure path is real, not just written and assumed to work.
Restart-survival also confirmed: killed the running process, restarted
it, and the same real production job came back unchanged.

## Not yet built
- Actual video rendering — no rendering infrastructure
  (Seedance/Kling/Runway/Nerfstudio-class tools) exists in this
  environment. This is a real, permanent ceiling for this session, not
  a deferred task — the same category of gap as Vavlt Stvdios' own
  `streamUrl`.
- Storyboard generation itself is a real, plain data field
  (`advanceToStoryboard` takes a caller-supplied storyboard) — no AI
  storyboard-generation logic exists yet; only script generation is
  wired to a real completion call.
- No VDP district or any other UI surface for VENVM yet.
- No real economic/fee model — no source doc grounds pricing for this
  internal production tool the way every consumer-facing app's real
  economics were grounded in a named comparable; not invented here.
