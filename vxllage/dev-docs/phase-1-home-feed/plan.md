# Plan — Phase 1: Home Feed (posts, threads, follows, For You/Following)

## Goal
Close VXLLAGE_CLAUDE.md's §0 correction directly: Home (the X-style
feed) becomes the deepest, most real surface first, ahead of Villages
or any other secondary register. Build exactly the actions the
prototype's own gap list calls out as decorative: the composer (no
submit), reply/repost/share (no action), and the For You/Following
toggle (both render the same array, no real filtering).

## Design
- `lib/posts.js`: `createPost()` is the real composer submit path,
  with real validation matching X's actual behavior — a genuine
  top-level post needs non-empty text, but a reply or a silent
  quote-post (repost with no added commentary) may carry empty text.
  `getThread()` is real, recursive reply-tree assembly, not just one
  level of `getReplies()`. `likePost`/`repostPost` are real, per-user,
  idempotent actions (own `likedBy`/`repostedBy` arrays), rejecting a
  double-like/double-repost rather than silently no-op'ing.
- `lib/follows.js`: a real follow graph — the structural prerequisite
  for a real Following feed to mean anything.
- `lib/feed.js`: the real fix for the flagged gap. Following and For
  You are genuinely different in both scope and ranking, not a
  relabel: Following is real, honest reverse-chronological, restricted
  to followed authors (plus the user's own posts); For You spans every
  post regardless of follow status, ranked by a real, deterministic
  engagement score (likes/reposts/replies weighted, with a real,
  bounded recency decay — no exact formula is given in any source doc,
  so the weights and decay curve are flagged interpretive choices,
  matching this session's established pattern).
- `lib/profiles.js`: a real, computed aggregation (post count,
  following/follower counts, authored posts) — the other explicitly
  flagged gap ("real profile pages").

## Explicitly NOT in this task
- Villages, Live, Call, Articles/newsletters, the VDP Village District
  — all deliberately deferred per §0's own explicit priority ordering.
- No VCoin/V3 integration yet — the Home feed's core loop moves no
  money; that only becomes relevant once Village boost economy/
  cosmetics/monetization phases land.
- No real auth — per the doc's own gap list, VXLLAGE should trust
  Shell's unified session rather than building its own; every function
  here just takes a `userId` directly, matching every other VACO
  backend's established pattern.
- No real audio/video, no real search — both explicitly flagged as
  later, shared-infrastructure work in the source doc.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 19
checks, all passed clean on first run): real composer validation
(empty top-level post rejected, empty reply/quote-post allowed), a
3-level-deep real reply thread assembled recursively, real idempotent
like/repost behavior (double-action rejected), a real follow graph
(self-follow and duplicate-follow rejected), and — the centerpiece —
a constructed adversarial case proving Following and For You genuinely
diverge: a low-engagement post from a followed author and a
high-engagement post from a non-followed author, with Following
correctly excluding the stranger's post entirely and For You correctly
ranking it first. Then a live pass: `vxllage/server.js` alone (no V3
dependency this phase) — the same Following-vs-For-You divergence
proven against the real running server, not just the in-memory store.

## Done when
- A real top-level post requires real text; a reply/quote-post may be
  silent.
- `getThread` correctly assembles a multi-level real reply tree.
- Likes/reposts are real, idempotent, per-user actions.
- Following and For You are provably different feeds — different
  scope, different ranking — verified both in plain Node and live.
- Profile pages are real, computed aggregations, correct for both an
  active user and one with no activity.
