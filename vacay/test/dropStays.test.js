// VACAY -- Drop Stays. The one real decision this module makes:
// VOID has no single "Drop Hotel" category, it has two real ones
// (dropRoom, dropHome) -- searching with neither named must search
// both and merge by real distance, not silently return only whichever
// one happened to be passed.

const test = require('node:test');
const assert = require('node:assert');

const { searchDropStays } = require('../lib/bookings/dropStays');

function fakeSearch(byCategory) {
  const calls = [];
  const fn = async (options) => {
    calls.push(options);
    return byCategory[options.category] || [];
  };
  fn.calls = calls;
  return fn;
}

test('searching with no category searches both dropRoom and dropHome', async () => {
  const searchDropStaysFn = fakeSearch({
    dropRoom: [{ asset: { id: 'A' }, distanceKm: 5 }],
    dropHome: [{ asset: { id: 'B' }, distanceKm: 2 }],
  });

  const results = await searchDropStays({ lat: 1, lng: 2, startDate: 100, endDate: 200, searchDropStaysFn });

  assert.equal(searchDropStaysFn.calls.length, 2);
  assert.deepEqual(searchDropStaysFn.calls.map((c) => c.category).sort(), ['dropHome', 'dropRoom']);
  assert.equal(results.length, 2);
  assert.equal(results[0].asset.id, 'B', 'nearest result overall must come first regardless of which category it came from');
  assert.equal(results[1].asset.id, 'A');
});

test('naming one category searches only that one', async () => {
  const searchDropStaysFn = fakeSearch({ dropRoom: [{ asset: { id: 'A' }, distanceKm: 5 }] });
  const results = await searchDropStays({
    category: 'dropRoom', lat: 1, lng: 2, startDate: 100, endDate: 200, searchDropStaysFn,
  });
  assert.equal(searchDropStaysFn.calls.length, 1);
  assert.equal(searchDropStaysFn.calls[0].category, 'dropRoom');
  assert.equal(results.length, 1);
});

test('an invalid category is refused before any real call is made', async () => {
  const searchDropStaysFn = async () => { throw new Error('must not be called'); };
  await assert.rejects(
    searchDropStays({ category: 'dropFood', lat: 1, lng: 2, startDate: 100, endDate: 200, searchDropStaysFn }),
    /invalid category/,
  );
});

test('searchDropStays requires a searchDropStaysFn', async () => {
  await assert.rejects(searchDropStays({ lat: 1, lng: 2, startDate: 100, endDate: 200 }), /requires a searchDropStaysFn/);
});
