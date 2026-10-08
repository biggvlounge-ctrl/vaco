'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import { measureCrime, securityTierFor, crimeByLocation, DEFAULT_SECURITY_TIERS } from '../src/lib/security.js';

test('measureCrime sums every real named count, defaulting unnamed ones to zero', () => {
  assert.equal(measureCrime({ ticketCount: 3, detentionCount: 1 }), 4);
  assert.equal(measureCrime(), 0);
  assert.equal(
    measureCrime({
      ticketCount: 2, detentionCount: 1, illegalArrivalCount: 4, illegalSettlementCount: 1, unauthorizedStructureCount: 2,
    }),
    10,
  );
});

test('measureCrime refuses a negative or non-integer count', () => {
  assert.throws(() => measureCrime({ ticketCount: -1 }), /non-negative integer/);
  assert.throws(() => measureCrime({ ticketCount: 1.5 }), /non-negative integer/);
});

test('securityTierFor starts at Basic with zero real crime', () => {
  const tier = securityTierFor(0);
  assert.equal(tier.name, 'Basic');
  assert.equal(tier.cameraCount, DEFAULT_SECURITY_TIERS[0].cameraCount);
  assert.equal(tier.robotCount, DEFAULT_SECURITY_TIERS[0].robotCount);
});

test('securityTierFor increases cameras and robots as real crime rises', () => {
  assert.equal(securityTierFor(4).name, 'Basic');
  assert.equal(securityTierFor(5).name, 'Elevated');
  assert.equal(securityTierFor(14).name, 'Elevated');
  assert.equal(securityTierFor(15).name, 'High Alert');
  assert.equal(securityTierFor(29).name, 'High Alert');
  assert.equal(securityTierFor(30).name, 'Maximum Security');
  assert.equal(securityTierFor(1000).name, 'Maximum Security');
});

test('a crime count sitting exactly on a boundary takes the higher, more specific tier', () => {
  const tier = securityTierFor(5);
  assert.equal(tier.name, 'Elevated');
});

test('securityTierFor refuses a negative or non-integer crime count', () => {
  assert.throws(() => securityTierFor(-1), /non-negative integer/);
  assert.throws(() => securityTierFor(1.5), /non-negative integer/);
});

test('thresholds are overridable per call without editing the module', () => {
  const customTiers = [{ name: 'Locked Down', min: 0, cameraCount: 1, robotCount: 1 }];
  const tier = securityTierFor(50, customTiers);
  assert.equal(tier.name, 'Locked Down');
});

test('crimeByLocation groups real records by their own real locationLabel', () => {
  const records = [
    { locationLabel: 'the frontier ridge' },
    { locationLabel: 'the frontier ridge' },
    { locationLabel: 'Meridian Commons' },
  ];
  assert.deepEqual(crimeByLocation(records), { 'the frontier ridge': 2, 'Meridian Commons': 1 });
});

test('crimeByLocation counts a record with no real location as "unknown" rather than dropping it', () => {
  const records = [{ locationLabel: null }, {}];
  assert.deepEqual(crimeByLocation(records), { unknown: 2 });
});

test('crimeByLocation returns an empty breakdown for no records', () => {
  assert.deepEqual(crimeByLocation([]), {});
});
