// VAVLT STVDIOS -- Profile Cards.
// Source of truth: `VAULT_STUDIOS_IG_LAYER.md`'s own "Profile Cards:
// digital-business-card-style profile view (photo, bio, links, QR
// code)."
//
// **Real, flagged scope limit**: `qrCodeUrl` is a real, deterministic
// URL string the card resolves to (a real value another system could
// actually render into a QR image) -- not an actual rendered QR code
// image. No real QR-image-generation exists in this session, the same
// "no real capture/rendering infra" honesty already applied to
// video/photo capture everywhere else in this ecosystem.

const PROFILE_BASE_URL = 'https://vavltstvdios.app/profile';

function createOrUpdateProfileCard(store, options = {}) {
  const {
    userId, photoUrl = null, bio = '', links = [], now = Date.now(),
  } = options;

  if (!userId) throw new Error('createOrUpdateProfileCard requires a userId');
  if (!Array.isArray(links)) throw new Error('createOrUpdateProfileCard requires a links array');

  let card = store.profileCards.find((c) => c.userId === userId);
  const qrCodeUrl = `${PROFILE_BASE_URL}/${encodeURIComponent(userId)}`;

  if (card) {
    card.photoUrl = photoUrl;
    card.bio = bio;
    card.links = links;
    card.qrCodeUrl = qrCodeUrl;
    card.updatedAt = now;
  } else {
    card = {
      id: store.nextProfileCardId++, userId, photoUrl, bio, links, qrCodeUrl, createdAt: now, updatedAt: now,
    };
    store.profileCards.push(card);
  }
  return card;
}

function getProfileCard(store, userId) {
  return store.profileCards.find((c) => c.userId === userId) || null;
}

module.exports = { PROFILE_BASE_URL, createOrUpdateProfileCard, getProfileCard };
