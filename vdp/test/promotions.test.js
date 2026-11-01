'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OWNER_TYPES, PromotionError, createPromotionsStore, listPromotions, getPromotion,
  promotionFor, isIndependent, createPromotion, signFighter, releaseFighter,
  transferOwnership, promotionRecord, promotionsByOwner,
} from '../src/lib/promotions.js';
import { createLeaderboardsStore, recordFor, recordMatchResult } from '../src/lib/leaderboards.js';
import { createMatch, startMatch, recordResult } from '../src/lib/combatSports.js';

test('createPromotion validates required fields and real ownerType', () => {
  const store = createPromotionsStore();
  assert.throws(() => createPromotion(store, { name: 'X', ownerId: 'o1', sport: 'wrestling' }), /promotionId/);
  assert.throws(() => createPromotion(store, { promotionId: 'p1', ownerId: 'o1', sport: 'wrestling' }), /name/);
  assert.throws(() => createPromotion(store, { promotionId: 'p1', name: 'X', sport: 'wrestling' }), /ownerId/);
  assert.throws(
    () => createPromotion(store, { promotionId: 'p1', name: 'X', ownerId: 'o1', sport: 'wrestling', ownerType: 'alien' }),
    /ownerType must be one of/,
  );
  assert.deepEqual(OWNER_TYPES, ['player', 'organization', 'civilization', 'independent']);
});

test('createPromotion refuses a duplicate promotionId', () => {
  const store = createPromotionsStore();
  createPromotion(store, { promotionId: 'p1', name: 'Iron Fist Wrestling', ownerId: 'owner-1', sport: 'wrestling' });
  assert.throws(
    () => createPromotion(store, { promotionId: 'p1', name: 'Other', ownerId: 'owner-2', sport: 'wrestling' }),
    /already exists/,
  );
});

test('any real kind of owner can found a promotion -- a gang, a tribe, a civilization, or an individual', () => {
  const store = createPromotionsStore();
  const gangPromo = createPromotion(store, {
    promotionId: 'p-gang', name: 'Ashwood Fight Club', ownerId: 'gang-ashwood', ownerType: 'organization', sport: 'wrestling',
  });
  assert.equal(gangPromo.ownerType, 'organization');
  const civPromo = createPromotion(store, {
    promotionId: 'p-civ', name: 'Redrock Combat Federation', ownerId: 'civ-redrock', ownerType: 'civilization', sport: 'mma',
  });
  assert.equal(civPromo.ownerType, 'civilization');
});

test('createPromotion refuses a roster with the same fighter twice, or a fighter already signed elsewhere', () => {
  const store = createPromotionsStore();
  assert.throws(
    () => createPromotion(store, { promotionId: 'p1', name: 'X', ownerId: 'o1', sport: 'wrestling', rosterIds: ['a', 'a'] }),
    /twice/,
  );
  createPromotion(store, { promotionId: 'p1', name: 'X', ownerId: 'o1', sport: 'wrestling', rosterIds: ['a1'] });
  assert.throws(
    () => createPromotion(store, { promotionId: 'p2', name: 'Y', ownerId: 'o2', sport: 'wrestling', rosterIds: ['a1'] }),
    /already signed to "p1"/,
  );
});

test('signFighter/releaseFighter move a real fighter between signed and independent', () => {
  const store = createPromotionsStore();
  createPromotion(store, { promotionId: 'p1', name: 'X', ownerId: 'o1', sport: 'wrestling' });
  assert.equal(isIndependent(store, 'fighter-1'), true);

  signFighter(store, 'p1', 'fighter-1');
  assert.equal(isIndependent(store, 'fighter-1'), false);
  assert.equal(promotionFor(store, 'fighter-1').promotionId, 'p1');

  releaseFighter(store, 'p1', 'fighter-1');
  assert.equal(isIndependent(store, 'fighter-1'), true);
  assert.equal(promotionFor(store, 'fighter-1'), null);
});

test('signFighter refuses signing the same fighter onto the same roster twice', () => {
  const store = createPromotionsStore();
  createPromotion(store, { promotionId: 'p1', name: 'X', ownerId: 'o1', sport: 'wrestling' });
  signFighter(store, 'p1', 'fighter-1');
  assert.throws(() => signFighter(store, 'p1', 'fighter-1'), /already signed to "p1"/);
  assert.equal(getPromotion(store, 'p1').rosterIds.length, 1, 'no duplicate roster entry');
});

test('signFighter refuses a fighter already signed to another promotion -- real exclusivity', () => {
  const store = createPromotionsStore();
  createPromotion(store, { promotionId: 'p1', name: 'X', ownerId: 'o1', sport: 'wrestling' });
  createPromotion(store, { promotionId: 'p2', name: 'Y', ownerId: 'o2', sport: 'wrestling' });
  signFighter(store, 'p1', 'fighter-1');
  assert.throws(() => signFighter(store, 'p2', 'fighter-1'), /already signed to "p1"/);
});

test('releaseFighter refuses a fighter who is not actually on that roster', () => {
  const store = createPromotionsStore();
  createPromotion(store, { promotionId: 'p1', name: 'X', ownerId: 'o1', sport: 'wrestling' });
  assert.throws(() => releaseFighter(store, 'p1', 'nobody'), /not signed to/);
});

test('transferOwnership changes who owns a promotion -- the real baseball-style sale', () => {
  const store = createPromotionsStore();
  createPromotion(store, { promotionId: 'p1', name: 'X', ownerId: 'owner-1', sport: 'wrestling' });
  const sold = transferOwnership(store, 'p1', 'gang-ashwood', 'organization');
  assert.equal(sold.ownerId, 'gang-ashwood');
  assert.equal(sold.ownerType, 'organization');
  // The roster and identity survive the sale -- only ownership moved.
  assert.equal(sold.promotionId, 'p1');
  assert.equal(sold.name, 'X');
});

test('promotionRecord sums the real win/loss record of every signed fighter, fresh, never cached', () => {
  const lbStore = createLeaderboardsStore();
  const promoStore = createPromotionsStore();
  createPromotion(promoStore, { promotionId: 'p1', name: 'X', ownerId: 'o1', sport: 'wrestling', rosterIds: ['a1', 'a2'] });

  function finishedMatch({ matchId, participantIds, winnerIds }) {
    const match = createMatch({
      matchId, matchFormat: 'one-on-one', combatSportType: 'wrestling', skillLevel: 'amateur', participantIds,
    });
    startMatch(match);
    recordResult(match, winnerIds);
    return match;
  }
  recordMatchResult(lbStore, finishedMatch({ matchId: 'm1', participantIds: ['a1', 'outsider-1'], winnerIds: ['a1'] }));
  recordMatchResult(lbStore, finishedMatch({ matchId: 'm2', participantIds: ['a2', 'outsider-2'], winnerIds: ['outsider-2'] }));

  const record = promotionRecord(promoStore, 'p1', lbStore, recordFor);
  assert.equal(record.wins, 1);
  assert.equal(record.losses, 1);
  assert.equal(record.rosterSize, 2);
});

test('promotionRecord never counts an unrelated fighter\'s own wins', () => {
  const lbStore = createLeaderboardsStore();
  const promoStore = createPromotionsStore();
  createPromotion(promoStore, { promotionId: 'p1', name: 'X', ownerId: 'o1', sport: 'wrestling', rosterIds: ['a1'] });

  function finishedMatch({ matchId, participantIds, winnerIds }) {
    const match = createMatch({
      matchId, matchFormat: 'one-on-one', combatSportType: 'wrestling', skillLevel: 'amateur', participantIds,
    });
    startMatch(match);
    recordResult(match, winnerIds);
    return match;
  }
  recordMatchResult(lbStore, finishedMatch({ matchId: 'm1', participantIds: ['outsider-1', 'outsider-2'], winnerIds: ['outsider-1'] }));

  const record = promotionRecord(promoStore, 'p1', lbStore, recordFor);
  assert.equal(record.wins, 0);
  assert.equal(record.losses, 0);
});

test('promotionsByOwner lists only a real owner\'s own promotions', () => {
  const store = createPromotionsStore();
  createPromotion(store, { promotionId: 'p1', name: 'X', ownerId: 'owner-1', sport: 'wrestling' });
  createPromotion(store, { promotionId: 'p2', name: 'Y', ownerId: 'owner-2', sport: 'mma' });
  createPromotion(store, { promotionId: 'p3', name: 'Z', ownerId: 'owner-1', sport: 'boxing' });
  assert.equal(promotionsByOwner(store, 'owner-1').length, 2);
  assert.equal(promotionsByOwner(store, 'owner-2').length, 1);
});
