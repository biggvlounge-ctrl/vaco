// VDP — real avatar visuals.
//
// Closes the oldest named gap in this project's own README: "the
// player is a rendered dot; equipped DEGVCHI wearables have nothing
// visual to render onto." Pure canvas drawing, no sprite assets (none
// exist in this repo) -- a small procedural humanoid whose actual
// colors come from the player's real equipped outfit
// (`degvchi.js#getEquippedOutfit`), not a placeholder shape.
//
// **Scoped to the local player only, deliberately.** DEGVCHI is a
// client-local store (no backend -- see its own header) and VDP's
// multiplayer layer only broadcasts {x, y} positions, never outfits.
// Drawing another real player in their real equipped outfit would
// mean inventing data nobody has; this module is honest about that
// and only ever receives an outfit for the one player whose closet
// this browser actually holds.

const DEFAULT_BODY_COLOR = '#6b6b7a';
const HEAD_RADIUS = 6;
const BODY_WIDTH = 10;
const BODY_HEIGHT = 14;

// A stable color from a catalog item that has no color field of its
// own -- most DEGVCHI wearables (registerWearable) are name/price/
// creator only. Hashing the item's own id means the same jacket always
// renders the same color, without inventing a palette system nothing
// asked for.
function colorFromId(id) {
  const hue = (Number(id) * 47) % 360;
  return `hsl(${hue}, 55%, 55%)`;
}

// Real, named CSS colors only -- a model's free-text `dominantColor`
// ("a deep forest green") is not a valid CSS color string, and an
// invalid `fillStyle` assignment is silently ignored by canvas,
// leaving the PREVIOUS fill color in place. That failure is invisible
// unless checked for explicitly.
const CSS_COLOR_RE = /^[a-z]+$/i;
function safeCssColor(name, fallback) {
  if (typeof name === 'string' && CSS_COLOR_RE.test(name.trim())) {
    return name.trim().toLowerCase();
  }
  return fallback;
}

export function colorForWearable(wearable) {
  if (!wearable) return null;
  if (wearable.custom && wearable.dominantColor) {
    return safeCssColor(wearable.dominantColor, colorFromId(wearable.id));
  }
  return colorFromId(wearable.id);
}

/**
 * Draws one humanoid avatar at the given screen coordinates.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} sx screen x (already camera-adjusted)
 * @param {number} sy screen y
 * @param {object} options
 * @param {object} [options.outfit] `getEquippedOutfit`'s real return shape
 *   ({clothing, cosmetics, accessories}, each a wearable or null)
 * @param {string} [options.outlineColor] a ring drawn around the head,
 *   e.g. gold for "this is you"
 */
export function drawAvatar(ctx, sx, sy, { outfit = {}, outlineColor = null } = {}) {
  const bodyColor = colorForWearable(outfit.clothing) || DEFAULT_BODY_COLOR;
  const headColor = colorForWearable(outfit.cosmetics) || '#e8c9a0';

  // Body: a rounded rectangle under the head.
  const bodyTop = sy + HEAD_RADIUS - 2;
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(sx - BODY_WIDTH / 2, bodyTop, BODY_WIDTH, BODY_HEIGHT, 3);
  } else {
    ctx.rect(sx - BODY_WIDTH / 2, bodyTop, BODY_WIDTH, BODY_HEIGHT);
  }
  ctx.fill();

  // Head.
  ctx.fillStyle = headColor;
  ctx.beginPath();
  ctx.arc(sx, sy, HEAD_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  // Accessory: a small accent dot at the shoulder -- real only when a
  // real accessory is equipped, no placeholder drawn when there isn't.
  if (outfit.accessories) {
    ctx.fillStyle = colorForWearable(outfit.accessories);
    ctx.beginPath();
    ctx.arc(sx + BODY_WIDTH / 2, bodyTop + 2, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (outlineColor) {
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sx, sy, HEAD_RADIUS + 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }
}
