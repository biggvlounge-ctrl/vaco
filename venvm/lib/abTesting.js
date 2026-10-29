// VENVM -- AI A/B Testing, and the "AI" in that name overstates by
// exactly the same margin `AI_HUMAN_TWIN_AD_GENERATION_VENVM.md` and
// `growthPrograms.js` already flag elsewhere: variant *assignment*
// and *result tracking* are both real, deterministic math -- no
// predictive or generative model call is needed to run a split test
// or to read its results. Only *generating the variants' creative*
// (ad copy/images/video per arm) genuinely needs a model this
// environment has no provider configured for -- that sliver is
// `generateVariantCopy`, stubbed via `pendingIntegration.js`.
//
// Assignment is a real, stable hash of (testId, subjectId) over the
// test's own variant list -- the same real subject always lands on
// the same real variant, with no state to store per-assignment beyond
// the one conversion fact this module actually needs.

const { pendingGenerationCall } = require('./pendingIntegration');

function requireString(value, field, action) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${action} requires a non-empty ${field}`);
  }
  return value.trim();
}

// A small, deterministic string hash (FNV-1a) -- real and stable
// across runs and processes, not `Math.random()`, so the same subject
// reliably lands on the same variant every time they're asked.
function stableHash(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function createAbTest(store, options = {}) {
  const { campaignId = null, name, variants, now = Date.now() } = options;
  requireString(name, 'name', 'createAbTest');
  if (!Array.isArray(variants) || variants.length < 2) {
    throw new Error('createAbTest requires at least two real variants');
  }
  const keys = variants.map((v) => requireString(v.key, 'variant key', 'createAbTest'));
  if (new Set(keys).size !== keys.length) {
    throw new Error('createAbTest requires every variant key to be unique');
  }

  const test = {
    id: store.nextAbTestId++,
    campaignId,
    name: name.trim(),
    variants: variants.map((v) => ({ key: v.key.trim(), label: v.label || v.key.trim() })),
    assignments: {},
    conversions: {},
    createdAt: now,
  };
  store.abTests.push(test);
  return test;
}

function getAbTest(store, testId) {
  return store.abTests.find((t) => t.id === testId) || null;
}

// Idempotent -- a subject asking for their variant twice gets the
// same real answer both times, read from the real stored assignment
// rather than re-hashed (re-hashing would still agree today, but a
// test's variant list could change later; the first real assignment a
// subject got is the one real fact that must never drift under them).
function assignVariant(store, options = {}) {
  const { testId, subjectId } = options;
  const test = getAbTest(store, testId);
  if (!test) throw new Error(`assignVariant: no A/B test with id ${testId}`);
  requireString(subjectId, 'subjectId', 'assignVariant');

  if (test.assignments[subjectId]) return test.assignments[subjectId];
  const index = stableHash(`${testId}:${subjectId}`) % test.variants.length;
  const variantKey = test.variants[index].key;
  test.assignments[subjectId] = variantKey;
  return variantKey;
}

// A real conversion, attributed to whichever real variant this
// subject was already assigned to -- never a fresh, possibly
// different assignment computed at conversion time.
function recordConversion(store, options = {}) {
  const { testId, subjectId, now = Date.now() } = options;
  const test = getAbTest(store, testId);
  if (!test) throw new Error(`recordConversion: no A/B test with id ${testId}`);
  const variantKey = test.assignments[subjectId];
  if (!variantKey) throw new Error(`recordConversion: subject ${subjectId} was never assigned a variant in test ${testId}`);

  if (!test.conversions[variantKey]) test.conversions[variantKey] = [];
  test.conversions[variantKey].push({ subjectId, convertedAt: now });
  return { testId, subjectId, variantKey };
}

// The real per-variant tally, plus a real leading variant -- but only
// once every variant has at least `minSampleSize` real assignments;
// below that, `leadingVariant` is honestly `null` rather than crowning
// a winner off a handful of real but statistically meaningless
// samples. The threshold is a flagged, interpretive default (no
// source doc names one), the same posture `AMBASSADOR_TIERS` already
// takes.
function abTestResults(store, testId, options = {}) {
  const { minSampleSize = 30 } = options;
  const test = getAbTest(store, testId);
  if (!test) throw new Error(`abTestResults: no A/B test with id ${testId}`);

  const assignmentCounts = {};
  for (const variantKey of Object.values(test.assignments)) {
    assignmentCounts[variantKey] = (assignmentCounts[variantKey] || 0) + 1;
  }

  const byVariant = test.variants.map((v) => {
    const assigned = assignmentCounts[v.key] || 0;
    const converted = (test.conversions[v.key] || []).length;
    return {
      key: v.key,
      label: v.label,
      assigned,
      converted,
      conversionRate: assigned > 0 ? Math.round((converted / assigned) * 10000) / 10000 : null,
    };
  });

  const everyVariantSampled = byVariant.every((v) => v.assigned >= minSampleSize);
  const leadingVariant = everyVariantSampled
    ? byVariant.reduce((best, v) => (best === null || v.conversionRate > best.conversionRate ? v : best), null).key
    : null;

  return { testId, minSampleSize, variants: byVariant, leadingVariant };
}

function generateVariantCopy() {
  return pendingGenerationCall('AI A/B variant copy/creative generation');
}

module.exports = {
  createAbTest, getAbTest, assignVariant, recordConversion, abTestResults, generateVariantCopy,
};
