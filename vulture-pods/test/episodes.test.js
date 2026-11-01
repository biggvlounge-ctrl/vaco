// Vvltvre Pods -- show notes, transcript, and chapters. Closes this
// project's own previously-flagged "beyond the real, minimal metadata
// fields built here" gap.

const test = require('node:test');
const assert = require('node:assert');

const { createVulturePodsStore } = require('../lib/store');
const { createShow } = require('../lib/shows');
const {
  createEpisode, setEpisodeShowNotes, setEpisodeTranscript, addEpisodeChapter,
} = require('../lib/episodes');

function episodeFixture(store, { durationSeconds = 600 } = {}) {
  const show = createShow(store, {
    creatorId: 'ada', title: 'Show A', description: 'd', category: 'culture',
  });
  const episode = createEpisode(store, {
    showId: show.id, title: 'Ep 1', episodeNumber: 1, durationSeconds,
  });
  return episode;
}

test('a fresh episode has no show notes, transcript, or chapters', () => {
  const store = createVulturePodsStore();
  const episode = episodeFixture(store);
  assert.equal(episode.showNotes, null);
  assert.equal(episode.transcript, null);
  assert.deepEqual(episode.chapters, []);
});

test('setEpisodeShowNotes sets real show notes text', () => {
  const store = createVulturePodsStore();
  const episode = episodeFixture(store);
  const updated = setEpisodeShowNotes(store, { episodeId: episode.id, showNotes: 'Links and credits here.' });
  assert.equal(updated.showNotes, 'Links and credits here.');
});

test('setEpisodeShowNotes refuses an empty or whitespace-only string', () => {
  const store = createVulturePodsStore();
  const episode = episodeFixture(store);
  assert.throws(() => setEpisodeShowNotes(store, { episodeId: episode.id, showNotes: '' }), /non-empty/);
  assert.throws(() => setEpisodeShowNotes(store, { episodeId: episode.id, showNotes: '   ' }), /non-empty/);
});

test('setEpisodeShowNotes refuses an unknown episode', () => {
  const store = createVulturePodsStore();
  assert.throws(() => setEpisodeShowNotes(store, { episodeId: 999, showNotes: 'x' }), /no episode with id/);
});

test('setEpisodeTranscript sets real transcript text', () => {
  const store = createVulturePodsStore();
  const episode = episodeFixture(store);
  const updated = setEpisodeTranscript(store, { episodeId: episode.id, transcript: 'HOST: Welcome back...' });
  assert.equal(updated.transcript, 'HOST: Welcome back...');
});

test('setEpisodeTranscript refuses an empty string', () => {
  const store = createVulturePodsStore();
  const episode = episodeFixture(store);
  assert.throws(() => setEpisodeTranscript(store, { episodeId: episode.id, transcript: '' }), /non-empty/);
});

test('addEpisodeChapter adds a real chapter and keeps the list sorted by startSeconds', () => {
  const store = createVulturePodsStore();
  const episode = episodeFixture(store, { durationSeconds: 1000 });
  addEpisodeChapter(store, { episodeId: episode.id, title: 'Outro', startSeconds: 800 });
  addEpisodeChapter(store, { episodeId: episode.id, title: 'Intro', startSeconds: 0 });
  const updated = addEpisodeChapter(store, { episodeId: episode.id, title: 'Interview', startSeconds: 300 });
  assert.deepEqual(updated.chapters, [
    { title: 'Intro', startSeconds: 0 },
    { title: 'Interview', startSeconds: 300 },
    { title: 'Outro', startSeconds: 800 },
  ]);
});

test('addEpisodeChapter refuses a startSeconds at or past the episode\'s own real duration', () => {
  const store = createVulturePodsStore();
  const episode = episodeFixture(store, { durationSeconds: 600 });
  assert.throws(() => addEpisodeChapter(store, { episodeId: episode.id, title: 'Too late', startSeconds: 600 }), /durationSeconds/);
  assert.throws(() => addEpisodeChapter(store, { episodeId: episode.id, title: 'Way too late', startSeconds: 9999 }), /durationSeconds/);
});

test('addEpisodeChapter refuses a negative or non-integer startSeconds', () => {
  const store = createVulturePodsStore();
  const episode = episodeFixture(store);
  assert.throws(() => addEpisodeChapter(store, { episodeId: episode.id, title: 'x', startSeconds: -1 }), /non-negative integer/);
  assert.throws(() => addEpisodeChapter(store, { episodeId: episode.id, title: 'x', startSeconds: 1.5 }), /non-negative integer/);
});

test('addEpisodeChapter refuses two chapters sharing the same startSeconds', () => {
  const store = createVulturePodsStore();
  const episode = episodeFixture(store);
  addEpisodeChapter(store, { episodeId: episode.id, title: 'Intro', startSeconds: 0 });
  assert.throws(() => addEpisodeChapter(store, { episodeId: episode.id, title: 'Also Intro', startSeconds: 0 }), /already has a chapter/);
});

test('addEpisodeChapter refuses an empty title or one past the real length cap', () => {
  const store = createVulturePodsStore();
  const episode = episodeFixture(store);
  assert.throws(() => addEpisodeChapter(store, { episodeId: episode.id, title: '', startSeconds: 0 }), /non-empty title/);
  assert.throws(() => addEpisodeChapter(store, { episodeId: episode.id, title: 'x'.repeat(201), startSeconds: 0 }), /exceeds 200 characters/);
});
