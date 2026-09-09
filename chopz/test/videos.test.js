// CHOPZ: the linked-product verification gate.
//
// CHOPZ moves no VCoin of its own — its two mutating routes publish a
// video and verify a linked product. But that verification is a gate
// another app's money depends on: a CHOPZ video claiming to link a
// CHOPZ SHOP product is a shoppable video, and CHOPZ SHOP settles the
// purchase. A video that could claim any product id without the claim
// being checked would let a seller attach their video to somebody
// else's listing.
//
// So this is the same class as `vaca` and `vex`'s suites: **testing the
// gate another app trusts**, not a balance of its own.

const test = require('node:test');
const assert = require('node:assert');

const { createChopzStore } = require('../lib/store');
const {
  createChopzVideo: publishVideo, getChopzVideo: getVideo, verifyLinkedProduct,
} = require('../lib/videos');

const listVideos = (store) => store.videos;

// -- Publishing ----------------------------------------------------------

test('a published video is recorded and retrievable', () => {
  const store = createChopzStore();
  const video = publishVideo(store, {
    creatorId: 'ada', mediaUrl: 'https://example.test/v.mp4',
  });
  assert.ok(video.id);
  assert.equal(getVideo(store, video.id).creatorId, 'ada');
  assert.equal(listVideos(store).length, 1);
});

test('a video without a creator or a url is refused', () => {
  const store = createChopzStore();
  assert.throws(() => publishVideo(store, { mediaUrl: 'https://x.test/v.mp4' }));
  assert.throws(() => publishVideo(store, { creatorId: 'ada' }));
  assert.equal(listVideos(store).length, 0, 'a refused video was still stored');
});

// -- The gate CHOPZ SHOP trusts ------------------------------------------

test('a video starts unverified — a claim is not a verification', () => {
  // The distinction this whole module exists for. An unverified link is
  // a claim by the uploader; the verified flag is the thing another app
  // may rely on.
  const store = createChopzStore();
  const video = publishVideo(store, {
    creatorId: 'ada', mediaUrl: 'https://example.test/v.mp4',
    linkedProductId: 'prod-1',
  });
  assert.notEqual(
    video.linkedProductVerified, true,
    'a self-declared product link was trusted on publish',
  );
});

test('verification requires the product to actually exist in CHOPZ SHOP', async () => {
  // The lookup is injected, the same pattern as every other cross-app
  // call in this repo, so the check is real and testable without a
  // network.
  const store = createChopzStore();
  const video = publishVideo(store, {
    creatorId: 'ada', mediaUrl: 'https://example.test/v.mp4',
    linkedProductId: 'prod-1',
  });

  const missing = async () => null;
  await assert.rejects(
    () => verifyLinkedProduct(store, { videoId: video.id, chopzShopFetchFn: missing }),
    'a link to a nonexistent product was verified',
  );
  assert.notEqual(getVideo(store, video.id).linkedProductVerified, true);
});

test('a real product verifies, and the flag is what changes', async () => {
  const store = createChopzStore();
  const video = publishVideo(store, {
    creatorId: 'ada', mediaUrl: 'https://example.test/v.mp4',
    linkedProductId: 'prod-1',
  });
  const found = async (id) => ({ id, name: 'Clippers', sellerId: 'ada' });
  await verifyLinkedProduct(store, { videoId: video.id, chopzShopFetchFn: found });
  assert.equal(getVideo(store, video.id).linkedProductVerified, true);
});

test('a video with no linked product cannot be verified into having one', async () => {
  const store = createChopzStore();
  const video = publishVideo(store, {
    creatorId: 'ada', mediaUrl: 'https://example.test/v.mp4',
  });
  const found = async (id) => ({ id, name: 'Anything' });
  await assert.rejects(
    () => verifyLinkedProduct(store, { videoId: video.id, chopzShopFetchFn: found }),
    'a video with no claimed product was given a verified link',
  );
});

test('verifying a video that does not exist is refused', async () => {
  const store = createChopzStore();
  const found = async (id) => ({ id });
  await assert.rejects(
    () => verifyLinkedProduct(store, { videoId: 9999, chopzShopFetchFn: found }),
    /no video/i,
  );
});

test('a lookup that throws leaves the video unverified rather than verified', async () => {
  // Fail closed. An unreachable CHOPZ SHOP must not produce a verified
  // link — that is the direction that costs somebody money.
  const store = createChopzStore();
  const video = publishVideo(store, {
    creatorId: 'ada', mediaUrl: 'https://example.test/v.mp4',
    linkedProductId: 'prod-1',
  });
  const broken = async () => { throw new Error('chopz-shop unreachable'); };
  await assert.rejects(() => verifyLinkedProduct(store, { videoId: video.id, chopzShopFetchFn: broken }));
  assert.notEqual(
    getVideo(store, video.id).linkedProductVerified, true,
    'an unreachable lookup produced a verified link',
  );
});
