// Shield -- real unit tests for password credential handling, using
// Node's own built-in test runner (node:test). First automated test
// suite in this app; closes part of the ecosystem audit's "27 of 30
// apps have zero automated tests" finding.
//
// Run: node --test test/*.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const { createShieldStore } = require('../lib/store');
const { MIN_PASSWORD_LENGTH, registerCredentials, verifyCredentials } = require('../lib/credentials');

test('registerCredentials rejects a password shorter than the real minimum', () => {
  const store = createShieldStore();
  assert.throws(
    () => registerCredentials(store, { userId: 'alice', password: 'short' }),
    new RegExp(`at least ${MIN_PASSWORD_LENGTH} characters`),
  );
});

test('registerCredentials rejects a duplicate real userId', () => {
  const store = createShieldStore();
  registerCredentials(store, { userId: 'alice', password: 'correcthorsebattery' });
  assert.throws(
    () => registerCredentials(store, { userId: 'alice', password: 'anotherpassword' }),
    /already registered/,
  );
});

test('verifyCredentials accepts the real, matching password', () => {
  const store = createShieldStore();
  registerCredentials(store, { userId: 'alice', password: 'correcthorsebattery' });
  assert.equal(verifyCredentials(store, { userId: 'alice', password: 'correcthorsebattery' }), true);
});

test('verifyCredentials rejects a wrong password for a real registered user', () => {
  const store = createShieldStore();
  registerCredentials(store, { userId: 'alice', password: 'correcthorsebattery' });
  assert.equal(verifyCredentials(store, { userId: 'alice', password: 'wrongpassword' }), false);
});

test('verifyCredentials rejects a userId that was never registered', () => {
  const store = createShieldStore();
  assert.equal(verifyCredentials(store, { userId: 'nobody', password: 'anything' }), false);
});

test('two real users get two independently-salted hashes for the same password', () => {
  const store = createShieldStore();
  registerCredentials(store, { userId: 'alice', password: 'samepassword123' });
  registerCredentials(store, { userId: 'bob', password: 'samepassword123' });
  assert.notEqual(store.credentials.alice.passwordHash, store.credentials.bob.passwordHash);
});
