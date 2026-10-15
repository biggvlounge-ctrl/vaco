# Media Infrastructure — the decision that unblocks six apps

> **Update: the live half is built and owned in-house.** `vaco-media`
> (port 8821) is the control plane for real-time sessions — see
> `dev-docs/REALTIME_MEDIA_SHARED_INFRASTRUCTURE.md`. The decision
> below still stands for **recorded** media (Flix, Pods, CHOPZ), which
> is a different problem: storage and CDN rather than transport.
>
> **Update 2: the recorded half is built too, and owned the same way.**
> `vaco-media` now holds the catalogue -- assets, lifecycle, playback
> grants, takedown -- behind `lib/storage/`, defaulting to any
> S3-compatible object store (MinIO or SeaweedFS on your own hardware).
> All seven consumers are wired: VXLLAGE, CVNVO, Vavlt Stvdios and V4
> for live sessions; Vvltvre Flix, Vvltvre Pods and CHOPZ for recorded
> assets.
>
> **What is still a purchase, not a build:** bytes and bandwidth. A
> signed URL is not a CDN, and serving video from one origin to a real
> audience is ruinous -- `VACO_MEDIA_CDN_BASE` is where a cache goes,
> and it is a deployment line rather than a code one. The
> recommendations below still stand for *what to buy*; what changed is
> that everything above the bytes is now ours and swappable.
>
> **Vvltvre Flix's concurrent-stream limit is now enforceable rather
> than advisory** -- the limit stays Flix's product rule, but the count
> of live playback grants comes from where the grants actually are.
>
> **Update 3 (15 Oct 2026): the frontends are wired now too, and the
> table/Recommendation sections below are the pre-build picture —
> read them as history, not current state.** Update 2 above was written
> when only the SERVER half of Flix/Pods/CHOPZ was done (asset
> registration) — each page still had no player at all. That's closed:
> all three now have a real Watch/Play button wired through
> `VACO.resolvePlayback`/`VACO.mediaPlayer`, live-smoke-tested end to
> end against a running `vaco-media` instance. Vavlt Stvdios' on-demand
> Video primitive is wired the same way as of the same date (its live
> "eight-screen wall" is a separate, still-unwired transport problem,
> below). The per-app Recommendation section's framing (pick a managed
> platform vs. self-host vs. embed, separately for each app) no longer
> applies to Flix/Pods/CHOPZ/Vavlt-Video — that decision was for
> picking a DELIVERY ARCHITECTURE when none existed. One now does, and
> it's app-agnostic (`vaco-media`'s catalogue/grant layer), so what's
> actually left for those four is narrower and simpler: **pick an
> S3-compatible object store + CDN for the bytes** (`VACO_MEDIA_STORAGE=s3`
> + real credentials), not a per-app platform strategy. VENVM and
> DREAMS are unaffected by any of this — see their own rows below,
> unchanged.
>
> The build followed this document's own rule and did not fake
> playback. The default transport carries no media and says so in every
> response; `test/transport.test.js` asserts it returns nothing a
> player could be pointed at, so the shortcut is a test failure rather
> than a judgement call.

**Status: not built, and not buildable in-house.** This is the one
remaining item on the ecosystem's task list, and unlike everything else
in this repo it is blocked on a decision rather than on effort. This
document exists so that decision can be made from real numbers instead
of being deferred again.

## The scale of it, measured rather than asserted

Building every frontend made the gap visible, because each page had to
state plainly what it could not do. Six surfaces now say some version of
"there is no media here":

| App | What it holds | Status as of 15 Oct 2026 |
|---|---|---|
| **Vvltvre Flix** | Catalogue, tiers, concurrent-stream limits | **Wired.** Watch claims a real stream slot + plays through `vaco-media`; shows the honest "nothing stored" note until a real object store is configured. |
| **Vvltvre Pods** | Shows, episodes, listen counts, subscriptions | **Wired.** Same shape, audio. |
| **Vavlt Stvdios — Video** (on-demand) | Long-form video records, locked tiers | **Wired**, and not through `vaco-media` — `mediaUrl` is a real, caller-supplied external address (same shape as VENVM's `videoUrl`), rendered directly. |
| **Vavlt Stvdios — the eight-screen wall** (live) | Channels, live sessions, tips, chat | **Still cannot show a feed.** This is the live-transport problem (LiveKit/SFU), separate from the on-demand Video primitive above — genuinely blocked on the vendor decision, not wiring. |
| **CHOPZ** | Videos, linked products, verification | **Wired.** Same shape as Flix/Pods. |
| **VENVM** | Script requests, production pipeline, reformat targets | **Still cannot generate any media at all.** Unrelated to `vaco-media` — this is a real AI-video-vendor decision (Seedance/Kling/Runway/Nerfstudio-class), not a delivery problem. |
| **DREAMS** | Screens, campaigns, revenue splits, offline cache | **Still cannot display anything.** No screen hardware exists anywhere in this ecosystem — unrelated to `vaco-media`, a hardware budget line. |

Two more depend on it indirectly: **VOID MAGIC**'s media orders, and
**VACO Merch**'s `designAssetUrl`, which has no upstream source because
VENVM cannot produce art.

**This was the single largest honesty gap in the ecosystem; most of it
is closed now.** Three of four consumer products that needed delivery
(Flix, Pods, CHOPZ) are wired end to end, with the one remaining piece
(real object storage + CDN) a vendor/budget decision like every other
"not built" line in this repo, not a wiring gap. The eight-screen wall's
live transport is the one piece still in the original shape — the whole
reason it got its own row above rather than being folded into the Video
primitive's "wired" status.

## Why it was never built in-house, stated plainly

Not oversight. Live video is the one thing in this entire system that
genuinely cannot be written from scratch at a reasonable cost:

- **Ingest and transcode** — RTMP/SRT in, multiple renditions out.
- **A CDN**, because origin-serving video to any real audience is
  ruinous.
- **A player** with adaptive bitrate, DRM for licensed content, and
  device coverage.
- **Storage** measured in terabytes, priced monthly forever.

Every other piece of this ecosystem is logic, and logic is cheap to
write. This is bandwidth, hardware, and licensing, and none of those get
cheaper by being written carefully.

## The three real options

Costs are **order-of-magnitude planning figures for comparison, not
quotes** — verify at decision time per
`dev-docs/STANDING_INSTRUCTION_ONGOING_EVALUATION.md`.

### 1. Managed video platform (Mux, Cloudflare Stream, api.video)

Ingest, transcode, storage, delivery, and a player, as one API.

- **Fits**: everything in the table above except VENVM's generation.
- **Shape of cost**: per minute stored plus per minute delivered.
  Delivery dominates; a title nobody watches is nearly free, and a hit
  is where the bill appears.
- **Effort**: days, not months. This is the option that turns six
  "cannot" rows into "can".
- **Risk**: the bill scales with success, which is the good failure
  mode, but it must be modelled before launch rather than after.

**This is the recommendation for everything except DRM-heavy licensed
content.**

### 2. Self-hosted origin plus a CDN (nginx-rtmp / OvenMediaEngine + a CDN)

- **Fits**: Vavlt Stvdios' many-channel model, where per-minute managed
  pricing across many simultaneous low-viewership channels is the worst
  case for option 1.
- **Shape of cost**: fixed servers plus cheaper bulk bandwidth. Wins at
  sustained high volume, loses badly below it.
- **Effort**: weeks, plus ongoing operations. Someone owns this rota.
- **Risk**: it is a real operational commitment, not a library.

### 3. Embed someone else's player (YouTube, Twitch, Vimeo)

- **Fits**: CHOPZ and Vvltvre Pods, where the content is promotional and
  the platform relationship is not the product.
- **Shape of cost**: near zero.
- **Risk**: the ecosystem's whole thesis is owning the stack. Embedding
  hands the audience relationship, the data, and the monetisation to the
  host. Defensible as a bridge; corrosive as a destination.

## Recommendation

**Superseded for Flix/Pods/CHOPZ/Vavlt-Video by Update 3 above** — this
section is the picture from before `vaco-media`'s own catalogue/grant
layer existed, kept as the historical record of why self-hosting won.
Still current for Vavlt Stvdios' live wall, VENVM, and DREAMS.

**Split by product, do not pick one for everything.** The apps have
genuinely different shapes and forcing one answer onto all six is how
this gets over-bought or under-served:

1. **Vvltvre Flix → managed platform, with DRM.** Licensed content is
   the one place DRM is contractually non-negotiable, and the one place
   self-hosting is hardest.
2. **Vvltvre Pods → managed audio hosting, or plain object storage +
   CDN.** Audio is small and cheap; this is the least risky first move
   and the fastest way to make one app genuinely complete.
3. **CHOPZ → managed platform.** Short-form is small files, high volume.
4. **Vavlt Stvdios → defer, then self-host if it grows.** Its
   many-channel model is exactly where per-minute pricing hurts, and it
   is also the least proven of the four. Do not buy for it first.
5. **DREAMS → nothing yet.** No screen hardware exists, so a delivery
   layer would have nowhere to deliver to. This is genuinely blocked on
   the hardware line, not on this decision.
6. **VENVM → a separate decision entirely.** Generation is not delivery.
   It belongs with an image/video model vendor, and the cost curve,
   licensing, and likeness-consent questions are unrelated to everything
   above. VENVM's likeness-consent gate is already built and already
   throws rather than warns — that part is ready for a generator that
   does not exist yet.

**The smallest real first step**: Vvltvre Pods with audio. One app, the
cheapest media type, a real end-to-end path from upload to playback. It
proves the integration shape before anything expensive is committed.

## What is already in place for whichever option wins

The apps are not going to need restructuring:

- Every app already stores a **URL or reference** rather than bytes, so
  a real CDN address drops into the same field.
- Every frontend already **states its limitation** in the UI, so the
  copy to remove is findable and scoped.
- Vvltvre Flix's **concurrent-stream enforcement** is real and already
  the hard part of subscription video.
- Vavlt Stvdios' **channel grouping** and tip settlement are real.
- **Settlement through V3 already works** everywhere it needs to, so
  paid media is a delivery problem, not a payments one.

## What must not happen

Do not add a `<video>` tag pointing at a placeholder file to make a demo
look complete. Every one of these apps currently tells the truth about
what it is, and that honesty is worth more than a screenshot. A player
that plays a stock clip is a worse artifact than a page that says the
stream is not connected, because the first one has to be un-learned by
whoever inherits it.
