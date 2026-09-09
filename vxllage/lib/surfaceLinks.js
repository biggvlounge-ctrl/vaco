// VXLLAGE -- Surface Links, the real "every surface connects fluently,
// not in isolation" mechanic from VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md's
// own information-architecture section: "a writer's article can drive
// a listener into their Village room for real-time discussion... never
// a dead end requiring a user to back out and manually find their way
// to a related space."
//
// Source of truth: that doc's own `VxllageSurfaceLink { sourceType,
// sourceId, linkedSurfaceType, linkedSurfaceId }`, with one real,
// necessary narrowing: the doc's own type union includes
// "community-thread," but no `Community` entity exists anywhere in
// this codebase -- only `Village` (see `villages.js`'s own header on
// the real "shrink" correction this app already went through).
// Checked directly rather than assumed: `SURFACE_TYPES` below is the
// doc's own list minus that one undocumented, unbuilt entity, flagged
// here rather than silently accepting a link type nothing can ever
// actually point at.

const SURFACE_TYPES = ['post', 'article', 'village-room'];

// Real, deliberate normalization -- `sourceId`/`linkedSurfaceId` are
// stored as canonical strings. Every id they can reference (a post id,
// an article id, a village-room id) is a real JS number internally,
// but this endpoint is reached over HTTP, where a caller may pass
// either a number (a direct library call) or a string (an Express
// query param, always a string). Caught early this time, not live in
// production -- the exact same class of bug already found once this
// session (HVNTZ's numeric businessId vs. Express's string route
// params, in Vavlt Stvdios' own posts.js) -- fixed here before it ever
// shipped, by always comparing on the same real, normalized type.
function createSurfaceLink(store, options = {}) {
  const { sourceType, sourceId, linkedSurfaceType, linkedSurfaceId } = options;
  if (!SURFACE_TYPES.includes(sourceType)) {
    throw new Error(`createSurfaceLink requires a sourceType of ${SURFACE_TYPES.join(', ')}`);
  }
  if (!SURFACE_TYPES.includes(linkedSurfaceType)) {
    throw new Error(`createSurfaceLink requires a linkedSurfaceType of ${SURFACE_TYPES.join(', ')}`);
  }
  if (sourceId === undefined || sourceId === null) throw new Error('createSurfaceLink requires a sourceId');
  if (linkedSurfaceId === undefined || linkedSurfaceId === null) throw new Error('createSurfaceLink requires a linkedSurfaceId');

  const link = {
    id: store.nextSurfaceLinkId++,
    sourceType,
    sourceId: String(sourceId),
    linkedSurfaceType,
    linkedSurfaceId: String(linkedSurfaceId),
    createdAt: Date.now(),
  };
  store.surfaceLinks.push(link);
  return link;
}

function getLinksForSurface(store, options = {}) {
  const { sourceType, sourceId } = options;
  return store.surfaceLinks.filter((l) => l.sourceType === sourceType && l.sourceId === String(sourceId));
}

module.exports = { SURFACE_TYPES, createSurfaceLink, getLinksForSurface };
