# Tasks — Phase 5: real long-form video (VOD)

- [x] Investigate: confirm the real gap via Phase 4's own live-pass
      rejection; confirm this project's own unbuilt YouTube-comparable
      product shape.
- [x] `lib/videos.js` — NEW. `VIDEO_SOURCES`,
      `MAX_VIDEO_DURATION_SECONDS`, `createVideo`, `getVideo`,
      `getVideoForViewer`, `listVideosForAuthor`, `getVideoFeed`.
- [x] `lib/store.js` — added `videos`/`nextVideoId`.
- [x] `server.js` — wired `POST /api/videos`, `GET /api/videos/:id`,
      `GET /api/authors/:authorId/videos`, `GET /api/video-feed`;
      exposed `videoSources`/`maxVideoDurationSeconds` on
      `/api/health`.
- [x] 7 plain-Node checks — all passing.
- [x] `vulture-pods/server.js` — `postVideoToVaultStvdios` now routes
      by real `durationSeconds` against `REEL_DURATION_CAP_SECONDS`
      (1200); `lib/episodes.js`'s `attachEpisodeVideo` gained a
      required `contentType` param.
- [x] Live pass with all four servers running: the exact real
      45-minute episode Phase 4 confirmed rejected now succeeds via
      the new `/api/videos` route, independently confirmed; a real
      short episode still routes to a real Reel, independently
      confirmed; the real 12-hour cap and real gated-video access both
      confirmed over real HTTP.
- [x] Shut down all test servers; confirmed via process list.
- [x] Update `README.md` (What's here, Verified).
- [x] Write this plan/tasks pair.

## Next
None identified for this specific gap.
