// AI A/B Testing -- the real, buildable half: deterministic variant
// assignment and real statistical result tracking need no model call.
// Only the variants' own creative generation does, and that is a
// labeled pending integration point, not built here.

const test = require('node:test');
const assert = require('node:assert');

const {
  createAbTest, getAbTest, assignVariant, recordConversion, abTestResults, generateVariantCopy,
} = require('../lib/abTesting');
const { PendingIntegrationError } = require('../lib/pendingIntegration');
const { createVenvmStore } = require('../lib/store');

test('createAbTest requires at least two real variants with unique keys', () => {
  const store = createVenvmStore();
  assert.throws(() => createAbTest(store, { name: 'T', variants: [{ key: 'a' }] }), /at least two real variants/);
  assert.throws(
    () => createAbTest(store, { name: 'T', variants: [{ key: 'a' }, { key: 'a' }] }),
    /unique/,
  );
});

test('assignVariant is deterministic and idempotent for the same real subject', () => {
  const store = createVenvmStore();
  const abTest = createAbTest(store, { name: 'T', variants: [{ key: 'a' }, { key: 'b' }] });
  const first = assignVariant(store, { testId: abTest.id, subjectId: 'sam' });
  const second = assignVariant(store, { testId: abTest.id, subjectId: 'sam' });
  assert.strictEqual(first, second);
  assert.ok(['a', 'b'].includes(first));
});

test('assignVariant refuses an unknown test', () => {
  const store = createVenvmStore();
  assert.throws(() => assignVariant(store, { testId: 999999, subjectId: 'sam' }), /no A\/B test with id/);
});

test('recordConversion refuses a subject who was never assigned a variant', () => {
  const store = createVenvmStore();
  const abTest = createAbTest(store, { name: 'T', variants: [{ key: 'a' }, { key: 'b' }] });
  assert.throws(() => recordConversion(store, { testId: abTest.id, subjectId: 'sam' }), /never assigned a variant/);
});

test('recordConversion attributes to whichever real variant the subject was already assigned', () => {
  const store = createVenvmStore();
  const abTest = createAbTest(store, { name: 'T', variants: [{ key: 'a' }, { key: 'b' }] });
  const variantKey = assignVariant(store, { testId: abTest.id, subjectId: 'sam' });
  const result = recordConversion(store, { testId: abTest.id, subjectId: 'sam' });
  assert.strictEqual(result.variantKey, variantKey);
});

test('abTestResults tallies real assignment/conversion counts and crowns a real leading variant once every variant is sampled enough', () => {
  const store = createVenvmStore();
  const abTest = createAbTest(store, { name: 'T', variants: [{ key: 'a' }, { key: 'b' }] });

  const groups = { a: [], b: [] };
  for (let i = 0; i < 50; i += 1) {
    const subjectId = `u${i}`;
    const variantKey = assignVariant(store, { testId: abTest.id, subjectId });
    groups[variantKey].push(subjectId);
  }
  assert.ok(groups.a.length > 0 && groups.b.length > 0, 'the deterministic hash must have split both real variants in this fixture');

  // Convert every real subject in variant "a", none in "b" -- "a"
  // must come out with both more conversions and a real higher rate.
  for (const subjectId of groups.a) recordConversion(store, { testId: abTest.id, subjectId });

  const results = abTestResults(store, abTest.id, { minSampleSize: 1 });
  const byKey = Object.fromEntries(results.variants.map((v) => [v.key, v]));
  assert.strictEqual(byKey.a.converted, groups.a.length);
  assert.strictEqual(byKey.a.conversionRate, 1);
  assert.strictEqual(byKey.b.converted, 0);
  assert.strictEqual(byKey.b.conversionRate, 0);
  assert.strictEqual(results.leadingVariant, 'a');
});

test('abTestResults honestly reports no real leading variant below the minimum sample size', () => {
  const store = createVenvmStore();
  const abTest = createAbTest(store, { name: 'T', variants: [{ key: 'a' }, { key: 'b' }] });
  assignVariant(store, { testId: abTest.id, subjectId: 'only-one' });
  const results = abTestResults(store, abTest.id, { minSampleSize: 30 });
  assert.strictEqual(results.leadingVariant, null, 'one real sample is not enough to honestly crown a winner');
});

test('getAbTest returns the real stored test', () => {
  const store = createVenvmStore();
  const abTest = createAbTest(store, { name: 'T', variants: [{ key: 'a' }, { key: 'b' }] });
  assert.strictEqual(getAbTest(store, abTest.id).name, 'T');
});

test('generateVariantCopy is an honest, labeled pending integration point', () => {
  assert.throws(() => generateVariantCopy(), PendingIntegrationError);
});
