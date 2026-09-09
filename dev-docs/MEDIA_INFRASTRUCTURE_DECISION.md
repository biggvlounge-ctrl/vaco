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

| App | What it holds | What it cannot do |
|---|---|---|
| **Vvltvre Flix** | Catalogue, tiers, concurrent-stream limits | Play a title. The stream-slot claim is real; the stream is not. |
| **Vvltvre Pods** | Shows, episodes, listen counts, subscriptions | Play audio. A "listen" increments a real counter. |
| **Vavlt Stvdios** | Channels, the eight-screen wall, tips, chat | Show a feed. A `streamUrl` is a recorded address. |
| **CHOPZ** | Videos, linked products, verification | Play a video. |
| **VENVM** | Script requests, production pipeline, reformat targets | Generate any media at all. |
| **DREAMS** | Screens, campaigns, revenue splits, offline cache | Display anything. |

Two more depend on it indirectly: **VOID MAGIC**'s media orders, and
**VACO Merch**'s `designAssetUrl`, which has no upstream source because
VENVM cannot produce art.

**This is the single largest honesty gap in the ecosystem.** Everything
else that says "not built" is a vendor integration or a hardware line.
This one is load-bearing for four consumer products' core value.

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
