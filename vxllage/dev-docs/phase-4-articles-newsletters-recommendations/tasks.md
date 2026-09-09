# Tasks — Phase 4: Articles, Newsletters, Cross-Publication Recommendations

- [x] Investigate: read the combined architecture doc's own "Confirmed:
      no duplication needed" section directly; verified its "Video"
      claim true and its "Podcasts" claim false against the real
      codebase; read `posts.js`'s own header to confirm no `Community`
      entity exists before scoping surface link types.
- [x] `lib/vavltStvdiosClient.js` — real `checkTierAccess`, deriving
      access from Vavlt Stvdios' own real `GET /api/tiers/:id`
      response.
- [x] `lib/articles.js` — `publishArticle` (auto-creates a real linked
      feed post when none supplied, real paywall validation),
      `getArticle`, `listArticlesForAuthor`, `getArticleForViewer`
      (real gated read), `canViewArticle` (real cross-app check).
- [x] `lib/newsletters.js` — `subscribeToNewsletter`/
      `unsubscribeFromNewsletter` (duplicate/self-subscribe guards),
      `getSubscribersForAuthor`, `recommendAuthor`/
      `getRecommendationsForAuthor`, `sendNewsletter` (real per-
      subscriber delivery records).
- [x] `lib/surfaceLinks.js` — `SURFACE_TYPES` (real, narrowed to what
      actually exists), `createSurfaceLink` (ids normalized to strings
      at write time), `getLinksForSurface`.
- [x] `lib/store.js` — `articles`/`nextArticleId`,
      `newsletterSubscriptions`/`nextNewsletterSubscriptionId`,
      `newsletterDeliveries`/`nextNewsletterDeliveryId`,
      `crossPublicationRecommendations`, `surfaceLinks`/
      `nextSurfaceLinkId`.
- [x] `server.js` — 11 new routes across articles/newsletters/
      recommendations/surface-links.
- [x] Verify in plain Node (28 checks, all clean): auto-linked posts,
      paywall validation, gated-read correctness, automatic
      recommendation surfacing, duplicate rejections, the excluded
      surface type, and the id-normalization fix proven directly (a
      link found by both a numeric and an equivalent string id).
- [x] Verify live against `venvs-mock-backend` + `vavlt-stvdios` +
      `vxllage` all running together: a real tier created on Vavlt
      Stvdios, a paywalled article referencing it, access confirmed
      withheld, a real subscription made directly against Vavlt
      Stvdios (its own real 80/20 split confirmed: 25 → 20/5), the
      same article re-fetched and confirmed now revealed for that
      viewer while a third viewer still saw it withheld; real
      newsletter subscribe/recommend/send confirmed; a real surface
      link created and read back.
- [x] Shut down all test servers; confirmed via port checks.
- [x] Update `README.md` (Run, What's here, Verified, Not yet built).
- [x] Write this plan/tasks pair.

## Next
The VDP Village District (a separate, cross-app task — see
`../../vdp/dev-docs/` for that side's own record). Real email delivery
infrastructure, if ever prioritized.
