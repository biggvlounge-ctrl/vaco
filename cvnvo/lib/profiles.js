// CVNVO -- UserProfile (Hinge-model, feeds matching).
// Source of truth: CVNVO_ARCHITECTURE.md's `UserProfile { id, prompts:
// [{ question, answer }], verifiedBadge, compatibilityInputs }`.
// CVNVO_CORE_FEATURES.md: "Prompt-based profile... since prompt-based
// profiles are what actually feeds a compatibility algorithm
// meaningful signal, not just photos" and "Preference settings feed
// directly into the matching algorithm below (not just filters
// applied after the fact)."
//
// `compatibilityInputs`'s exact shape isn't specified in any source
// doc beyond "{ ... }" -- the shape below (age, interests, a mutual
// seeking-age range, and lat/lng for real distance) is a real,
// flagged interpretive choice, built to directly support
// lib/compatibility.js's real scoring function, matching this
// session's established pattern of flagging invented specifics.

function createUserProfile(store, options = {}) {
  const { userId, prompts, verifiedBadge = false, compatibilityInputs } = options;
  if (!userId) throw new Error('createUserProfile requires a userId');
  if (store.profiles.some((p) => p.userId === userId)) {
    throw new Error(`createUserProfile: a profile already exists for ${userId}`);
  }
  if (!Array.isArray(prompts) || prompts.length === 0) {
    throw new Error('createUserProfile requires at least one prompt (Hinge-model, not photo-only)');
  }
  for (const p of prompts) {
    if (!p.question || typeof p.answer !== 'string' || p.answer.trim().length === 0) {
      throw new Error('every prompt requires a question and a non-empty answer');
    }
  }
  if (typeof verifiedBadge !== 'boolean') throw new Error('createUserProfile requires a boolean verifiedBadge');

  const inputs = compatibilityInputs || {};
  const { age, interests, seekingAgeMin, seekingAgeMax, lat, lng } = inputs;
  if (!Number.isInteger(age) || age < 18) throw new Error('compatibilityInputs requires an integer age of 18 or older');
  if (!Array.isArray(interests)) throw new Error('compatibilityInputs requires an interests array');
  if (!Number.isInteger(seekingAgeMin) || !Number.isInteger(seekingAgeMax) || seekingAgeMin > seekingAgeMax) {
    throw new Error('compatibilityInputs requires a valid seekingAgeMin/seekingAgeMax range');
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('compatibilityInputs requires real lat/lng coordinates');
  }

  const profile = {
    userId, prompts, verifiedBadge,
    compatibilityInputs: { age, interests, seekingAgeMin, seekingAgeMax, lat, lng },
    createdAt: Date.now(),
  };
  store.profiles.push(profile);
  return profile;
}

function getUserProfile(store, userId) {
  return store.profiles.find((p) => p.userId === userId) || null;
}

module.exports = { createUserProfile, getUserProfile };
