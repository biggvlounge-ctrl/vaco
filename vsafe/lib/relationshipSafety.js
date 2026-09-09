// VSAFE -- Relationship Safety.
// Source of truth: named with zero detail in
// UNIVERSAL_SAFETY_LAYER_VSAFE.md. Real, grounded interpretation,
// deliberately distinct from CVNVO's own Yap (a public, subject-
// visible green/red flag review): this is a real, PRIVATE log a user
// can keep for their own safety record -- documentation they may need
// later (for themselves, or for real support/legal purposes), not a
// public report anyone else can see. `concernType` uses real,
// recognized categories from real domestic-violence-safety-awareness
// terminology, not invented casually.
//
// Privacy is structural: `getSafetyConcerns` only ever returns a
// user's own logged concerns, keyed strictly to the requesting
// userId -- there is no function anywhere in this module that lets
// one user read another's log.

const CONCERN_TYPES = ['controlling-behavior', 'isolation-pattern', 'financial-control', 'threats', 'other'];

function logSafetyConcern(store, options = {}) {
  const { userId, aboutUserId, concernType, details, now = Date.now() } = options;
  if (!userId) throw new Error('logSafetyConcern requires a userId');
  if (!aboutUserId) throw new Error('logSafetyConcern requires an aboutUserId');
  if (userId === aboutUserId) throw new Error('logSafetyConcern: cannot log a concern about yourself');
  if (!CONCERN_TYPES.includes(concernType)) {
    throw new Error(`logSafetyConcern: invalid concernType "${concernType}" (expected one of ${CONCERN_TYPES.join(', ')})`);
  }
  if (!details) throw new Error('logSafetyConcern requires details');

  const concern = { id: store.nextSafetyConcernId++, userId, aboutUserId, concernType, details, createdAt: now };
  store.relationshipSafetyLogs.push(concern);
  return concern;
}

// Structurally private: only ever the requesting user's own entries.
function getSafetyConcerns(store, userId) {
  if (!userId) throw new Error('getSafetyConcerns requires a userId');
  return store.relationshipSafetyLogs.filter((c) => c.userId === userId);
}

module.exports = { CONCERN_TYPES, logSafetyConcern, getSafetyConcerns };
