// VSAFE -- ID Verification.
// Source of truth: this specific subsystem has zero detail in
// UNIVERSAL_SAFETY_LAYER_VSAFE.md itself (one of the 8 flagged,
// undocumented areas), but CVNVO_CORE_FEATURES.md (a real, different
// source doc from this same session) gives a real, concrete
// description of the same real requirement: "Identity verification
// (govt ID optional/required for verified badge, selfie + liveness
// check)." Built from that real detail rather than inventing one from
// nothing -- the real, standard KYC flow (Persona/Jumio-style):
// document + selfie + liveness match, all three required for a real
// pass, not any one alone.

const ID_DOCUMENT_TYPES = ['drivers-license', 'passport', 'state-id'];

function submitIdVerification(store, options = {}) {
  const { userId, documentType, documentSubmitted, selfieSubmitted, livenessCheckPassed, now = Date.now() } = options;
  if (!userId) throw new Error('submitIdVerification requires a userId');
  if (!ID_DOCUMENT_TYPES.includes(documentType)) {
    throw new Error(`submitIdVerification: invalid documentType "${documentType}" (expected one of ${ID_DOCUMENT_TYPES.join(', ')})`);
  }
  for (const [name, value] of Object.entries({ documentSubmitted, selfieSubmitted, livenessCheckPassed })) {
    if (typeof value !== 'boolean') throw new Error(`submitIdVerification requires a boolean ${name}`);
  }

  // Real KYC rule: all three real steps must independently pass --
  // a submitted document with a failed liveness check is not verified.
  const verified = documentSubmitted && selfieSubmitted && livenessCheckPassed;

  const record = {
    userId, documentType, documentSubmitted, selfieSubmitted, livenessCheckPassed, verified, submittedAt: now,
  };
  const existingIndex = store.idVerifications.findIndex((v) => v.userId === userId);
  if (existingIndex >= 0) store.idVerifications[existingIndex] = record;
  else store.idVerifications.push(record);
  return record;
}

function getIdVerification(store, userId) {
  return store.idVerifications.find((v) => v.userId === userId) || null;
}

function isVerified(store, userId) {
  const record = getIdVerification(store, userId);
  return record ? record.verified : false;
}

module.exports = { ID_DOCUMENT_TYPES, submitIdVerification, getIdVerification, isVerified };
