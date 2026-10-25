// Vvltvre Music -- real raw stream counts, genuinely distinct from
// `reportStreamingRevenue`'s own dollar amount. The failure this file
// exists to catch: a stream recorded against a release that was never
// live, or one artist's real stream count bleeding into another's.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { submitRelease, markDistributing, markLive } = require('../lib/releases');
const { recordStream, getStreamCount, getTotalStreamCountForArtist } = require('../lib/streaming');
const { createVultureMusicStore } = require('../lib/store');

const NOW = Date.UTC(2026, 9, 25);

function fakeSettle() {
  return async () => ({ ok: true });
}

async function liveRelease(store, artistId, title) {
  const release = await submitRelease(store, {
    artistId, title, format: 'single', targetPlatforms: ['Spotify'], settleFn: fakeSettle(), now: NOW,
  });
  markDistributing(store, release.id);
  markLive(store, release.id);
  return release;
}

test('recordStream refuses a release that is not live yet', async () => {
  const store = createVultureMusicStore();
  const release = await submitRelease(store, {
    artistId: 'nova', title: 'Not Out Yet', format: 'single', targetPlatforms: ['Spotify'], settleFn: fakeSettle(), now: NOW,
  });
  assert.throws(
    () => recordStream(store, { releaseId: release.id, userId: 'u1' }),
    /is "submitted", must be "live"/,
  );
});

test('recordStream requires a userId', async () => {
  const store = createVultureMusicStore();
  const release = await liveRelease(store, 'nova', 'Cherokee Street');
  assert.throws(
    () => recordStream(store, { releaseId: release.id }),
    /requires a userId/,
  );
});

test('getStreamCount counts only real streams for that one release', async () => {
  const store = createVultureMusicStore();
  const releaseA = await liveRelease(store, 'nova', 'Track A');
  const releaseB = await liveRelease(store, 'nova', 'Track B');

  recordStream(store, { releaseId: releaseA.id, userId: 'u1' });
  recordStream(store, { releaseId: releaseA.id, userId: 'u2' });
  recordStream(store, { releaseId: releaseB.id, userId: 'u3' });

  assert.equal(getStreamCount(store, releaseA.id), 2);
  assert.equal(getStreamCount(store, releaseB.id), 1);
});

test('getTotalStreamCountForArtist sums real streams across every one of this artist\'s releases', async () => {
  const store = createVultureMusicStore();
  const releaseA = await liveRelease(store, 'nova', 'Track A');
  const releaseB = await liveRelease(store, 'nova', 'Track B');

  recordStream(store, { releaseId: releaseA.id, userId: 'u1' });
  recordStream(store, { releaseId: releaseA.id, userId: 'u2' });
  recordStream(store, { releaseId: releaseB.id, userId: 'u3' });

  assert.equal(getTotalStreamCountForArtist(store, 'nova'), 3);
});

test('getTotalStreamCountForArtist never credits one artist with another artist\'s real streams', async () => {
  const store = createVultureMusicStore();
  const novaRelease = await liveRelease(store, 'nova', 'Nova Track');
  const benRelease = await liveRelease(store, 'ben', 'Ben Track');

  recordStream(store, { releaseId: novaRelease.id, userId: 'u1' });
  for (let i = 0; i < 4; i += 1) recordStream(store, { releaseId: benRelease.id, userId: `u${i}` });

  assert.equal(getTotalStreamCountForArtist(store, 'nova'), 1);
  assert.equal(getTotalStreamCountForArtist(store, 'ben'), 4);
});

test('getTotalStreamCountForArtist is honestly 0 for an artist with no releases, or releases with no streams yet', () => {
  const store = createVultureMusicStore();
  assert.equal(getTotalStreamCountForArtist(store, 'nobody-home'), 0);
});
