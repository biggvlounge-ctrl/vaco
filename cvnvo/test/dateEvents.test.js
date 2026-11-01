// CVNVO — Snap Map / location privacy (lib/dateEvents.js). Written
// while wiring VDP's own Dating Village onto these exact functions
// (setLocationSharingPreference/shareLocation/getVisibleLocationsFor)
// — this module had no test coverage anywhere in this repo despite
// being a real privacy-enforcement surface (a wrong tier here leaks a
// real user's location to someone who shouldn't see it), so it is
// covered directly, the same "testing the gate another app trusts"
// posture `vaca`/`chopz`'s own suites already take.

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { createCvnvoStore } = require('../lib/store');
const {
  LOCATION_PRIVACY_TIERS, MIN_RADIUS_KM, MAX_RADIUS_KM,
  setLocationSharingPreference, getLocationSharingPreference,
  shareLocation, getVisibleLocationsFor, searchNearbyOpenUsers,
} = require('../lib/dateEvents');

function matchUsers(store, userAId, userBId, { expiresInMs = 60 * 60 * 1000 } = {}) {
  store.matches.push({ userAId, userBId, expiresAt: Date.now() + expiresInMs });
}

// -- Default: a user who never set a preference is Ghost Mode --------

test('a user with no stored preference defaults to ghost-mode, not visible to anyone', () => {
  const store = createCvnvoStore();
  shareLocation(store, { userId: 'ghost-by-default', lat: 38.6, lng: -90.2 });
  assert.deepStrictEqual(
    getVisibleLocationsFor(store, 'viewer-1'),
    [],
    'a user who never opted in must not leak their shared location',
  );
  assert.equal(getLocationSharingPreference(store, 'ghost-by-default').tier, 'ghost-mode');
});

// -- ghost-mode: visible to no one, ever -------------------------------

test('ghost-mode hides a shared location from everyone, even an active match', () => {
  const store = createCvnvoStore();
  setLocationSharingPreference(store, { userId: 'a', tier: 'ghost-mode' });
  shareLocation(store, { userId: 'a', lat: 38.6, lng: -90.2 });
  matchUsers(store, 'a', 'b');
  assert.deepStrictEqual(getVisibleLocationsFor(store, 'b'), []);
});

// -- my-friends: visible only to a real, currently-active match --------

test('my-friends is visible to an active match, and not to a stranger', () => {
  const store = createCvnvoStore();
  setLocationSharingPreference(store, { userId: 'a', tier: 'my-friends' });
  shareLocation(store, { userId: 'a', lat: 38.6, lng: -90.2 });
  matchUsers(store, 'a', 'b');

  const toMatch = getVisibleLocationsFor(store, 'b');
  assert.equal(toMatch.length, 1);
  assert.equal(toMatch[0].userId, 'a');

  assert.deepStrictEqual(getVisibleLocationsFor(store, 'stranger'), []);
});

test('my-friends does not leak to an EXPIRED match', () => {
  const store = createCvnvoStore();
  setLocationSharingPreference(store, { userId: 'a', tier: 'my-friends' });
  shareLocation(store, { userId: 'a', lat: 38.6, lng: -90.2 });
  matchUsers(store, 'a', 'b', { expiresInMs: -1 });
  assert.deepStrictEqual(getVisibleLocationsFor(store, 'b'), [],
    'an expired match must not still count as a real relationship');
});

// -- select-friends: visible only to the real, explicit list ----------

test('select-friends is visible only to a name on the real list, not to a match', () => {
  const store = createCvnvoStore();
  setLocationSharingPreference(store, { userId: 'a', tier: 'select-friends', selectedUserIds: ['c'] });
  shareLocation(store, { userId: 'a', lat: 38.6, lng: -90.2 });
  matchUsers(store, 'a', 'b'); // a real match, but NOT on the select list

  assert.deepStrictEqual(getVisibleLocationsFor(store, 'b'), [],
    'select-friends must not fall back to matches -- only the explicit list counts');

  const toListed = getVisibleLocationsFor(store, 'c');
  assert.equal(toListed.length, 1);
  assert.equal(toListed[0].userId, 'a');
});

// -- a shared location never includes the viewer's own ----------------

test('getVisibleLocationsFor never returns the viewer\'s own shared location', () => {
  const store = createCvnvoStore();
  setLocationSharingPreference(store, { userId: 'a', tier: 'select-friends', selectedUserIds: ['a'] });
  shareLocation(store, { userId: 'a', lat: 38.6, lng: -90.2 });
  assert.deepStrictEqual(getVisibleLocationsFor(store, 'a'), []);
});

// -- re-sharing updates in place, does not duplicate -------------------

test('sharing a location twice updates the real record rather than duplicating it', () => {
  const store = createCvnvoStore();
  setLocationSharingPreference(store, { userId: 'a', tier: 'my-friends' });
  shareLocation(store, { userId: 'a', lat: 38.6, lng: -90.2, now: 1000 });
  shareLocation(store, { userId: 'a', lat: 39.0, lng: -94.5, now: 2000 });
  matchUsers(store, 'a', 'b');

  const visible = getVisibleLocationsFor(store, 'b');
  assert.equal(visible.length, 1);
  assert.equal(visible[0].lat, 39.0);
  assert.equal(visible[0].updatedAt, 2000);
});

// -- validation --------------------------------------------------------

test('setLocationSharingPreference refuses a missing userId or an invalid tier', () => {
  const store = createCvnvoStore();
  assert.throws(() => setLocationSharingPreference(store, { tier: 'ghost-mode' }), /userId/);
  assert.throws(() => setLocationSharingPreference(store, { userId: 'a', tier: 'public' }), /tier/);
});

test('shareLocation refuses a missing userId or non-numeric lat/lng', () => {
  const store = createCvnvoStore();
  assert.throws(() => shareLocation(store, { lat: 1, lng: 1 }), /userId/);
  assert.throws(() => shareLocation(store, { userId: 'a', lat: 'x', lng: 1 }), /lat\/lng/);
});

// -- radius search ------------------------------------------------------

test('searchNearbyOpenUsers counts real shared locations within the radius, and excludes ones outside it', () => {
  const store = createCvnvoStore();
  shareLocation(store, { userId: 'near', lat: 38.6270, lng: -90.1994 }); // St. Louis
  shareLocation(store, { userId: 'far', lat: 39.0997, lng: -94.5786 }); // Kansas City, ~380km away

  const result = searchNearbyOpenUsers(store, { lat: 38.6270, lng: -90.1994, radiusKm: 10 });
  assert.deepStrictEqual(result.userIds, ['near']);
  assert.equal(result.openForContactCount, 1);
});

test('searchNearbyOpenUsers refuses a radius outside the real 1-100 mile band', () => {
  const store = createCvnvoStore();
  assert.throws(
    () => searchNearbyOpenUsers(store, { lat: 0, lng: 0, radiusKm: MIN_RADIUS_KM - 0.01 }),
    /radiusKm/,
  );
  assert.throws(
    () => searchNearbyOpenUsers(store, { lat: 0, lng: 0, radiusKm: MAX_RADIUS_KM + 0.01 }),
    /radiusKm/,
  );
});

test('LOCATION_PRIVACY_TIERS is the real, exact three-tier Snap Map set', () => {
  assert.deepStrictEqual(LOCATION_PRIVACY_TIERS, ['ghost-mode', 'my-friends', 'select-friends']);
});
