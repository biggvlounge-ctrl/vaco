// VOKEN -- real Culture Car Clubs, by direct instruction: "also add
// in groups where people could have car clubs... see who has the
// most value in the car club through cards and cars." The failure
// this file exists to catch: the leaderboard ignoring a member's real
// vehicle cards (missing the "and cars" half), or a join/leave not
// actually behaving like a real, idempotent membership.

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const {
  createCarClub, getCarClub, joinCarClub, leaveCarClub, getCarClubLeaderboard,
} = require('../lib/carClubs');
const {
  mintCultureCard, verifySubjectIdentity, updateCardStatistics, recordPeakValueScore,
} = require('../lib/cultureCards');

function mintMusicCard(store, ownerId) {
  return mintCultureCard(store, {
    subjectPersonId: ownerId, category: 'music', rarityTier: 'rare',
    tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 10,
  });
}

function mintVehicleCard(store, ownerId) {
  return mintCultureCard(store, {
    subjectPersonId: ownerId, category: 'vehicles', rarityTier: 'rare',
    tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 1,
  });
}

test('createCarClub auto-joins its real creator', () => {
  const store = createVokenStore();
  const club = createCarClub(store, { name: 'Midnight Riders', creatorId: 'marcus' });
  assert.deepEqual(club.memberIds, ['marcus']);
});

test('joinCarClub is a real, idempotent membership -- joining twice changes nothing', () => {
  const store = createVokenStore();
  const club = createCarClub(store, { name: 'Midnight Riders', creatorId: 'marcus' });
  joinCarClub(store, { clubId: club.id, userId: 'dana' });
  joinCarClub(store, { clubId: club.id, userId: 'dana' });
  assert.deepEqual(club.memberIds, ['marcus', 'dana']);
});

test('leaveCarClub is a real, idempotent no-op for someone not a member', () => {
  const store = createVokenStore();
  const club = createCarClub(store, { name: 'Midnight Riders', creatorId: 'marcus' });
  leaveCarClub(store, { clubId: club.id, userId: 'stranger' });
  assert.deepEqual(club.memberIds, ['marcus']);

  joinCarClub(store, { clubId: club.id, userId: 'dana' });
  leaveCarClub(store, { clubId: club.id, userId: 'dana' });
  assert.deepEqual(club.memberIds, ['marcus']);
});

test('getCarClubLeaderboard ranks real members by total wallet value, highest first', () => {
  const store = createVokenStore();
  const club = createCarClub(store, { name: 'Midnight Riders', creatorId: 'marcus' });
  joinCarClub(store, { clubId: club.id, userId: 'dana' });

  const marcusCard = mintMusicCard(store, 'marcus');
  recordPeakValueScore(store, { cardId: marcusCard.id, combinedRealValueScore: 20 });

  const danaCard = mintMusicCard(store, 'dana');
  recordPeakValueScore(store, { cardId: danaCard.id, combinedRealValueScore: 80 });

  const leaderboard = getCarClubLeaderboard(store, club.id);
  assert.equal(leaderboard[0].userId, 'dana', 'the real higher-value member must rank first');
  assert.equal(leaderboard[0].rank, 1);
  assert.equal(leaderboard[1].userId, 'marcus');
  assert.equal(leaderboard[1].rank, 2);
});

test('the leaderboard real total covers "cards and cars" together -- a real vehicle card counts toward it', () => {
  const store = createVokenStore();
  const club = createCarClub(store, { name: 'Midnight Riders', creatorId: 'marcus' });

  const vehicleCard = mintVehicleCard(store, 'marcus');
  verifySubjectIdentity(store, { cardId: vehicleCard.id, verifierId: 'marcus' });
  updateCardStatistics(store, {
    cardId: vehicleCard.id, updaterId: 'marcus',
    statistics: { referenceValue: 50000, mileage: 20000, condition: 'excellent', modelYear: 2020 },
  });
  recordPeakValueScore(store, { cardId: vehicleCard.id, combinedRealValueScore: 60 });

  const leaderboard = getCarClubLeaderboard(store, club.id);
  assert.equal(leaderboard[0].userId, 'marcus');
  assert.ok(leaderboard[0].totalValue > 0, 'a real vehicle card must contribute to the real club standing');
  assert.equal(leaderboard[0].holdings.length, 1);
});

test('createCarClub, joinCarClub, leaveCarClub, getCarClubLeaderboard all require their real ids', () => {
  const store = createVokenStore();
  assert.throws(() => createCarClub(store, { creatorId: 'marcus' }), /requires a name/);
  assert.throws(() => createCarClub(store, { name: 'X' }), /requires a creatorId/);
  assert.throws(() => joinCarClub(store, { clubId: 999, userId: 'dana' }), /no car club with id 999/);
  assert.throws(() => leaveCarClub(store, { clubId: 999, userId: 'dana' }), /no car club with id 999/);
  assert.throws(() => getCarClubLeaderboard(store, 999), /no car club with id 999/);
  assert.equal(getCarClub(store, 999), null);
});
