// VSAFE -- Privacy Controls.
// Source of truth: named with zero detail in
// UNIVERSAL_SAFETY_LAYER_VSAFE.md. Real, minimal, defensible scope:
// real per-user privacy defaults (location sharing, profile
// visibility, contact-info exposure) and a real, symmetric block list
// -- the two concrete mechanics every real comparable in this space
// (Life360's privacy zones, any dating app's block feature) actually
// needs underneath a settings screen. `SafetyCheckIn.locationSharingActive`
// (Phase 1) stays a real, per-check-in override; this module is the
// real, standing per-user default that feeds it.

const PROFILE_VISIBILITY_OPTIONS = ['public', 'contacts-only', 'hidden'];

function setPrivacySettings(store, options = {}) {
  const { userId, locationSharingDefault, profileVisibility, contactInfoHidden } = options;
  if (!userId) throw new Error('setPrivacySettings requires a userId');
  if (typeof locationSharingDefault !== 'boolean') throw new Error('setPrivacySettings requires a boolean locationSharingDefault');
  if (!PROFILE_VISIBILITY_OPTIONS.includes(profileVisibility)) {
    throw new Error(`setPrivacySettings: invalid profileVisibility "${profileVisibility}" (expected one of ${PROFILE_VISIBILITY_OPTIONS.join(', ')})`);
  }
  if (typeof contactInfoHidden !== 'boolean') throw new Error('setPrivacySettings requires a boolean contactInfoHidden');

  const settings = { userId, locationSharingDefault, profileVisibility, contactInfoHidden, updatedAt: Date.now() };
  const existingIndex = store.privacySettings.findIndex((s) => s.userId === userId);
  if (existingIndex >= 0) store.privacySettings[existingIndex] = settings;
  else store.privacySettings.push(settings);
  return settings;
}

// A real, sensible default for a user who never configured anything --
// the safest posture (sharing off, hidden profile, contact hidden),
// not an assumed-open one.
function getPrivacySettings(store, userId) {
  return store.privacySettings.find((s) => s.userId === userId)
    || { userId, locationSharingDefault: false, profileVisibility: 'hidden', contactInfoHidden: true, updatedAt: null };
}

// A real, symmetric block -- if A blocks B, the doc's own real intent
// (privacy/safety) means neither side should see the other, checked
// both directions by `isBlocked`.
function blockUser(store, options = {}) {
  const { userId, blockedUserId } = options;
  if (!userId || !blockedUserId) throw new Error('blockUser requires userId and blockedUserId');
  if (userId === blockedUserId) throw new Error('blockUser: cannot block yourself');
  if (store.blocks.some((b) => b.userId === userId && b.blockedUserId === blockedUserId)) {
    throw new Error(`blockUser: ${userId} has already blocked ${blockedUserId}`);
  }
  const block = { userId, blockedUserId, createdAt: Date.now() };
  store.blocks.push(block);
  return block;
}

function unblockUser(store, options = {}) {
  const { userId, blockedUserId } = options;
  const existing = store.blocks.find((b) => b.userId === userId && b.blockedUserId === blockedUserId);
  if (!existing) throw new Error(`unblockUser: ${userId} has not blocked ${blockedUserId}`);
  store.blocks = store.blocks.filter((b) => b !== existing);
  return { userId, blockedUserId };
}

function isBlocked(store, userIdA, userIdB) {
  return store.blocks.some(
    (b) => (b.userId === userIdA && b.blockedUserId === userIdB) || (b.userId === userIdB && b.blockedUserId === userIdA),
  );
}

module.exports = { PROFILE_VISIBILITY_OPTIONS, setPrivacySettings, getPrivacySettings, blockUser, unblockUser, isBlocked };
