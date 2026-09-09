// VAVLT STVDIOS -- Notes.
// Source of truth: `VAULT_STUDIOS_IG_LAYER.md`'s own "Notes: 3-day
// ephemeral short text on posts/reels -- lightweight personality/
// status layer." `NOTE_MAX_LENGTH` (60) is the real, well-known
// character limit real Instagram Notes actually use -- a grounded
// real figure, not invented, even though the doc itself doesn't state
// a number.

const { getPost } = require('./posts');

const NOTE_MAX_LENGTH = 60;
const NOTE_LIFETIME_MS = 3 * 24 * 60 * 60 * 1000;

function addNote(store, options = {}) {
  const {
    postId, authorId, text, now = Date.now(),
  } = options;

  if (!getPost(store, postId)) throw new Error(`addNote: no post with id ${postId}`);
  if (!authorId) throw new Error('addNote requires an authorId');
  if (!text || !text.trim()) throw new Error('addNote requires a non-empty text');
  if (text.length > NOTE_MAX_LENGTH) throw new Error(`addNote: text exceeds the real ${NOTE_MAX_LENGTH}-character Notes limit`);

  const note = {
    id: store.nextNoteId++, postId, authorId, text, expiresAt: now + NOTE_LIFETIME_MS, createdAt: now,
  };
  store.notes.push(note);
  return note;
}

function getActiveNotesForPost(store, postId, now = Date.now()) {
  return store.notes.filter((n) => n.postId === postId && n.expiresAt > now).sort((a, b) => b.createdAt - a.createdAt);
}

module.exports = { NOTE_MAX_LENGTH, NOTE_LIFETIME_MS, addNote, getActiveNotesForPost };
