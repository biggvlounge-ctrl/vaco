// VOKEN — the digital art frame product.
// Source of truth: VOKEN_NEW_VALUE_ALGORITHM.md's `DigitalArtFrame
// { frameId, ownerId, loadedArtCardId, screenTechnology:
// "unilumin", isConsideredADigitalCopy: true }`, confirmed via Meural
// Opus as a real, proven comparable: a real physical frame with an
// embedded screen, loaded with owned digital art. Loading is a real
// ownership-gated action -- you can only load art you genuinely,
// currently own a digital edition of, onto a frame you genuinely own
// -- never a passive display of arbitrary content.

const { getCultureCard } = require('./cultureCards');

const SCREEN_TECHNOLOGY = 'unilumin';

function registerDigitalArtFrame(store, options = {}) {
  const { ownerId } = options;
  if (!ownerId) throw new Error('registerDigitalArtFrame requires an ownerId');
  const frame = {
    frameId: store.nextArtFrameId++,
    ownerId,
    loadedArtCardId: null,
    screenTechnology: SCREEN_TECHNOLOGY,
    isConsideredADigitalCopy: true,
    createdAt: Date.now(),
  };
  store.digitalArtFrames.push(frame);
  return frame;
}

function getDigitalArtFrame(store, frameId) {
  return store.digitalArtFrames.find((f) => f.frameId === frameId) || null;
}

function loadArtworkOntoFrame(store, options = {}) {
  const { frameId, artCardId, requesterId } = options;
  const frame = getDigitalArtFrame(store, frameId);
  if (!frame) throw new Error(`loadArtworkOntoFrame: no frame with id ${frameId}`);
  if (frame.ownerId !== requesterId) {
    throw new Error('loadArtworkOntoFrame: only the frame\'s owner can load artwork onto it');
  }

  const card = getCultureCard(store, artCardId);
  if (!card) throw new Error(`loadArtworkOntoFrame: no card with id ${artCardId}`);
  if (card.category !== 'art') throw new Error('loadArtworkOntoFrame: only art category cards can be loaded onto a frame');

  const ownsADigitalEdition = card.editions.some((e) => e.format === 'digital' && e.ownerId === requesterId);
  if (!ownsADigitalEdition) {
    throw new Error(`loadArtworkOntoFrame: ${requesterId} does not own a digital edition of card ${artCardId}`);
  }

  frame.loadedArtCardId = artCardId;
  return frame;
}

module.exports = { SCREEN_TECHNOLOGY, registerDigitalArtFrame, getDigitalArtFrame, loadArtworkOntoFrame };
