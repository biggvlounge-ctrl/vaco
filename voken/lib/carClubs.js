// VOKEN — real Culture Car Clubs, by direct instruction: "also add in
// groups where people could have car clubs, culture car clubs, where
// they have car club interactions and see who has the most value in
// the car club through cards and cars."
//
// "through cards and cars" is answered by genuine code reuse, not a
// second value formula: a member's real standing in the club is the
// exact same `computeWalletValue()` (`walletValue.js`) VOKEN already
// uses for a personal wallet total — it already sums every category
// of card a user holds (Culture Cars included, since a vehicle card
// is just another real card with a real `marketPrice`), so "cards and
// cars" together is what that function already returns with no
// vehicle-specific carve-out needed.
//
// A club membership is a real, durable relationship (the same real
// shape `cardFollows.js` already established for following a card) --
// joining twice or leaving when not a member are real no-ops, never
// errors.

const { computeWalletValue } = require('./walletValue');

function createCarClub(store, options = {}) {
  const { name, creatorId } = options;
  if (!name) throw new Error('createCarClub requires a name');
  if (!creatorId) throw new Error('createCarClub requires a creatorId');

  const club = {
    id: store.nextCarClubId++,
    name,
    creatorId,
    memberIds: [creatorId],
    createdAt: Date.now(),
  };
  store.carClubs.push(club);
  return club;
}

function getCarClub(store, clubId) {
  return store.carClubs.find((c) => c.id === clubId) || null;
}

// Idempotent -- joining a club you're already in is a real no-op, the
// same real property `followCard()` already has.
function joinCarClub(store, options = {}) {
  const { clubId, userId } = options;
  const club = getCarClub(store, clubId);
  if (!club) throw new Error(`joinCarClub: no car club with id ${clubId}`);
  if (!userId) throw new Error('joinCarClub requires a userId');

  if (!club.memberIds.includes(userId)) club.memberIds.push(userId);
  return club;
}

// Also idempotent -- leaving a club you're not in is a real no-op,
// never an error.
function leaveCarClub(store, options = {}) {
  const { clubId, userId } = options;
  const club = getCarClub(store, clubId);
  if (!club) throw new Error(`leaveCarClub: no car club with id ${clubId}`);
  if (!userId) throw new Error('leaveCarClub requires a userId');

  const index = club.memberIds.indexOf(userId);
  if (index === -1) return club;
  club.memberIds.splice(index, 1);
  return club;
}

// The real "who has the most value in the car club" ranking --
// each member's real total wallet value (cards AND cars, since
// computeWalletValue already covers every category), ranked
// highest-first.
function getCarClubLeaderboard(store, clubId) {
  const club = getCarClub(store, clubId);
  if (!club) throw new Error(`getCarClubLeaderboard: no car club with id ${clubId}`);

  return club.memberIds
    .map((userId) => ({ userId, ...computeWalletValue(store, { ownerId: userId }) }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .map((row, i) => ({ rank: i + 1, ...row }));
}

module.exports = {
  createCarClub,
  getCarClub,
  joinCarClub,
  leaveCarClub,
  getCarClubLeaderboard,
};
