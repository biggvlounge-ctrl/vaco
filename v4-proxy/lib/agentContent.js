// V4 — validating a POST /api/agent message's content.
//
// Pulled out of server.js so it can be unit-tested directly, the same
// shape as `lib/maps.js`: server.js spawns rather than imports in its
// own test file (an in-process import cannot survive `app.listen`'s
// own process-scope side effects), so anything worth testing in
// isolation has to live outside it.
//
// A message's `content` is either a plain string (the original, still
// most common shape — ordinary chat) or a real Anthropic content-block
// array, which is what a vision call (e.g. VDP's photo-to-outfit
// feature, `v4AgentClient.js`'s `analyzeOutfitPhoto`) needs to send a
// real photo alongside real instructions. This only validates the
// array shape — server.js still accepts a plain string separately.

const VALID_IMAGE_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Real base64 image bytes aren't size-checked here on purpose.
// Anthropic's own API already enforces its real upload limits, and
// duplicating that number here would just be a second place for it to
// drift out of sync with whatever Anthropic actually allows.
function isValidContentBlocks(content) {
  if (!Array.isArray(content) || content.length === 0) return false;
  return content.every((block) => {
    if (!block || typeof block !== 'object') return false;
    if (block.type === 'text') {
      return typeof block.text === 'string' && block.text.length > 0;
    }
    if (block.type === 'image') {
      const src = block.source;
      return !!src
        && src.type === 'base64'
        && VALID_IMAGE_MEDIA_TYPES.includes(src.media_type)
        && typeof src.data === 'string' && src.data.length > 0;
    }
    return false;
  });
}

export { VALID_IMAGE_MEDIA_TYPES, isValidContentBlocks };
