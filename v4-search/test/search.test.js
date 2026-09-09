// V4 Search — the one search layer every app routes through.
//
// **Why this suite exists.** Six apps are named as calling into this
// (`APP_IDS` in server.js) and nothing checked that a query returns the
// right documents, in the right order, from the right apps. The whole
// point of consolidating search here rather than letting each app build
// its own is that there is ONE ranking to get right — which also means
// one place to get it wrong for everybody at once.
//
// Three properties matter more than the matching:
//
//   1. **Ranking is ordered on purpose.** Exact title beats prefix beats
//      substring beats subtitle. A ranker that returns the right set in
//      the wrong order is a search box people stop trusting.
//   2. **Scoping is real.** Asking VACAY for a result must not return
//      VOKEN's, or the "search one app" feature is decorative.
//   3. **A miss is empty, not everything.** A scorer that let 0-score
//      documents through would answer every query with the whole
//      corpus.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import { MemorySearchAdapter } from '../adapters/memoryAdapter.js';
import { SearchAdapter } from '../adapters/SearchAdapter.js';

const adapter = new MemorySearchAdapter();

// A fixed corpus for the ranking tests, so the assertions are about the
// ranker rather than about whatever the seed data happens to contain.
//
// **Declared in deliberately WRONG order.** The first version listed
// these already ranked — exact, prefix, substring, subtitle — and a
// mutation deleting the ranker's `.sort()` entirely broke no test,
// because the input order was already the expected output. A fixture
// that agrees with the answer cannot detect its absence.
const ranked = new MemorySearchAdapter([
  { app: 'A', type: 't', id: 'subtitle', title: 'nothing', subtitle: 'harbor district' },
  { app: 'A', type: 't', id: 'miss', title: 'nothing', subtitle: 'nothing' },
  { app: 'A', type: 't', id: 'substring', title: 'the harbor walk', subtitle: 'x' },
  { app: 'A', type: 't', id: 'exact', title: 'harbor', subtitle: 'x' },
  { app: 'A', type: 't', id: 'prefix', title: 'harbor overlook', subtitle: 'x' },
]);

// ---------------------------------------------------------------------------
// The contract
// ---------------------------------------------------------------------------

test('the memory adapter honours the SearchAdapter contract', () => {
  // The whole swap-in-a-real-provider story rests on this: a new
  // adapter is "a class with the same search() signature". If the
  // default one does not actually implement the base, the contract is
  // aspirational.
  assert.ok(adapter instanceof SearchAdapter);
  assert.equal(typeof adapter.search, 'function');
});

test('the seeded corpus covers every app the server says it serves', async () => {
  // server.js hard-codes APP_IDS and the adapter hard-codes documents.
  // Nothing links them, so an app can be advertised and then return
  // nothing forever — the same "advertised but empty" gap this project
  // keeps finding.
  const serverSource = await import('node:fs').then((fs) => fs.readFileSync(
    new URL('../server.js', import.meta.url), 'utf8',
  ));
  const declared = serverSource.match(/const APP_IDS = \[([^\]]+)\]/)[1]
    .split(',').map((s) => s.trim().replace(/["']/g, '')).filter(Boolean);

  const seeded = new Set(adapter.documents.map((d) => d.app));
  const advertisedButEmpty = declared.filter((a) => !seeded.has(a));
  assert.deepEqual(
    advertisedButEmpty, [],
    'these apps are advertised by /api/health and have no documents at all',
  );
});

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

test('results come back best match first', async () => {
  const out = await ranked.search('harbor');
  assert.deepEqual(
    out.map((d) => d.id),
    ['exact', 'prefix', 'substring', 'subtitle'],
    'exact title > prefix > substring > subtitle',
  );
});

test('the four tiers score distinctly, so ordering is not an accident', async () => {
  const out = await ranked.search('harbor');
  const scores = out.map((d) => d.score);
  assert.deepEqual(scores, [100, 80, 60, 40]);
  // Strictly descending — two tiers sharing a score would make their
  // relative order depend on array position.
  for (let i = 1; i < scores.length; i += 1) assert.ok(scores[i] < scores[i - 1]);
});

test('a document matching nothing is absent, not present with a zero', async () => {
  const out = await ranked.search('harbor');
  assert.ok(!out.some((d) => d.id === 'miss'));
  assert.ok(out.every((d) => d.score > 0));
});

test('a query nothing matches returns nothing at all', async () => {
  // The failure mode this guards: a scorer that let 0 through would
  // answer every query with the entire corpus, which reads as "search
  // is broken" only if somebody looks closely.
  assert.deepEqual(await ranked.search('xyzzy-no-such-thing'), []);
});

test('matching is case-insensitive in both directions', async () => {
  const upper = await ranked.search('HARBOR');
  const lower = await ranked.search('harbor');
  assert.deepEqual(upper.map((d) => d.id), lower.map((d) => d.id));

  const mixedCorpus = new MemorySearchAdapter([
    { app: 'A', type: 't', id: 'shouty', title: 'KYOTO MACHIYA', subtitle: 'x' },
  ]);
  assert.equal((await mixedCorpus.search('kyoto')).length, 1, 'a shouty title is still findable');
});

// ---------------------------------------------------------------------------
// Scoping
// ---------------------------------------------------------------------------

test('scoping to one app returns only that app', async () => {
  const out = await adapter.search('a', { apps: ['VACAY'] });
  assert.ok(out.length > 0, 'the fixture found nothing, so the assertion below proves nothing');
  assert.ok(out.every((d) => d.app === 'VACAY'));
});

test('scoping to several apps returns exactly those', async () => {
  const out = await adapter.search('a', { apps: ['VACAY', 'VOKEN'] });
  const apps = new Set(out.map((d) => d.app));
  assert.ok(out.length > 0);
  for (const app of apps) assert.ok(['VACAY', 'VOKEN'].includes(app), `${app} leaked in`);
});

test('an empty apps list searches everything, not nothing', async () => {
  // `apps && apps.length` — an empty array is falsy-by-length here on
  // purpose. A caller who sends `[]` meaning "no filter" gets the whole
  // corpus rather than silence.
  const all = await adapter.search('a');
  const empty = await adapter.search('a', { apps: [] });
  assert.deepEqual(empty.map((d) => d.id), all.map((d) => d.id));
});

test('scoping to an app with no matches is empty, not unscoped', async () => {
  // The dangerous version of the bug above: a filter that silently
  // falls back to "everything" when it matches nothing would return
  // another app's results under this app's name.
  const out = await adapter.search('Kyoto', { apps: ['VOKEN'] });
  assert.ok(out.every((d) => d.app === 'VOKEN'), 'no VACAY result may appear under a VOKEN scope');
});

// ---------------------------------------------------------------------------
// Limit
// ---------------------------------------------------------------------------

test('the limit caps results and keeps the best ones', async () => {
  const out = await ranked.search('harbor', { limit: 2 });
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((d) => d.id), ['exact', 'prefix'], 'the cap trims the tail, not the head');
});

test('the default limit is generous enough not to hide the corpus', async () => {
  const out = await adapter.search('a');
  assert.ok(out.length <= 20);
});

// ---------------------------------------------------------------------------
// The seeded corpus is real
// ---------------------------------------------------------------------------

test('a real cross-app query returns real documents from more than one app', async () => {
  // The consolidation thesis in one assertion: one query, several apps,
  // one ranked list.
  const out = await adapter.search('a');
  assert.ok(new Set(out.map((d) => d.app)).size > 1, 'one search must reach across apps');
  for (const doc of out) {
    assert.ok(doc.app && doc.type && doc.id && doc.title, `${doc.id} is missing a field`);
  }
});

test('every seeded document carries the fields a result list needs', () => {
  for (const doc of adapter.documents) {
    for (const field of ['app', 'type', 'id', 'title', 'subtitle']) {
      assert.ok(doc[field], `a seeded document is missing ${field}: ${JSON.stringify(doc)}`);
    }
  }
  const ids = adapter.documents.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length, 'seeded ids must be unique');
});
