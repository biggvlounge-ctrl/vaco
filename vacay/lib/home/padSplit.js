// VACAY HOMES -- Pad Split: one house, rented a room at a time.
//
// Built against the real, named comparable: PadSplit's room-by-room
// co-living model. A host takes a single property and splits it into
// individually rentable rooms; members rent a **room**, weekly, at an
// all-inclusive rate, with no long lease behind it.
//
// **This is the second money direction in a division that said it had
// one, and that is the point worth reading before the code.**
// `listings.js` states — correctly, for Zillow — that no escrow-then-
// settle flow exists here and that the agent, never the renter, is the
// one who pays. Pad Split is a genuinely different business from
// Zillow, and it inverts both halves: the resident pays, weekly, and
// the platform takes a cut before passing the rest to the host. That
// note in `listings.js` now says so rather than remaining true only
// about the half of the division it was written for.
//
// So this division now carries two money paths that must not be
// confused:
//
//   leads.js     the AGENT pays a flat fee for a lead. Nothing the
//                buyer or renter does costs them anything.
//   padSplit.js  the RESIDENT pays weekly rent, split host/platform.
//
// **What is deliberately not built.** PadSplit's real product includes
// reporting on-time rent to credit bureaus, and member screening
// before move-in. Both need a real external provider — a bureau, a
// background-check vendor — and neither exists in this repo. A
// `reportToBureau()` that wrote a local record would look exactly like
// a real one to every caller while reporting to nobody, which is worse
// than the gap. `residency.creditReported` is therefore absent, not
// `false`. Same posture as PATRN's `generateFn`.

const { VACAY_HOMES_PLATFORM_ACCOUNT } = require('./leads');

const ROOM_STATUSES = ['available', 'occupied'];
const RESIDENCY_STATUSES = ['active', 'ended'];

// Real, deliberately interpretive. PadSplit's own take is not a
// published flat percentage — it varies by market and by what the host
// hands over (furnished, utilities included, managed or not). This is a
// flagged structural stand-in for "the platform takes a cut of each
// week's rent before the host is paid", not a scraped real number. Same
// treatment as `LEAD_FEE` next door.
const PLATFORM_TAKE_RATE = 0.12;

// A week, in milliseconds. The weekly cadence *is* the model — it is
// what makes the rate reachable without a deposit and a year's lease —
// so it is named rather than inlined as a magic number.
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const round = (n) => Math.round(n * 100) / 100;

// -- splitting a property ----------------------------------------------

// Turns one `for-rent` listing into N individually rentable rooms.
//
// Refuses a `for-sale` listing outright: a room in a house somebody is
// trying to sell is not a rental product, and silently allowing it
// would put residents in a property under contract.
function splitProperty(store, options = {}) {
  const {
    listingId, hostId, rooms, now = Date.now(),
  } = options;

  const listing = (store.listings || []).find((l) => l.id === listingId);
  if (!listing) throw new Error(`splitProperty: no listing with id ${listingId}`);
  if (listing.purpose !== 'for-rent') {
    throw new Error(`splitProperty: listing ${listingId} is "${listing.purpose}" — only a for-rent property can be split into rooms`);
  }
  if (!hostId) throw new Error('splitProperty requires a hostId');
  if (!Array.isArray(rooms) || rooms.length === 0) {
    throw new Error('splitProperty requires at least one room');
  }
  if ((store.rooms || []).some((r) => r.listingId === listingId)) {
    throw new Error(`splitProperty: listing ${listingId} is already split into rooms`);
  }
  // A house cannot be split into more private rooms than it has
  // bedrooms. Without this a host could list eight rooms in a
  // three-bedroom house, and the listing's own `bedrooms` field — which
  // renters read — would be quietly contradicted by the rooms on offer.
  if (rooms.length > listing.bedrooms) {
    throw new Error(`splitProperty: ${rooms.length} rooms in a ${listing.bedrooms}-bedroom listing`);
  }

  const created = rooms.map((room, i) => {
    const { name, weeklyRate } = room || {};
    if (!name) throw new Error(`splitProperty: room ${i + 1} requires a name`);
    if (!Number.isFinite(weeklyRate) || weeklyRate <= 0) {
      throw new Error(`splitProperty: room "${name}" requires a positive weeklyRate`);
    }
    const record = {
      id: store.nextRoomId++,
      listingId,
      hostId,
      name,
      // All-inclusive by definition: utilities, wifi and furnishing are
      // inside this number, which is what makes a weekly rate legible.
      // There is deliberately no separate utilities field to diverge
      // from it.
      weeklyRate,
      status: 'available',
      createdAt: now,
    };
    store.rooms.push(record);
    return record;
  });

  return created;
}

function getRoom(store, roomId) {
  return (store.rooms || []).find((r) => r.id === roomId) || null;
}

function listRooms(store, listingId) {
  return (store.rooms || []).filter((r) => r.listingId === listingId);
}

// **Derived, never stored.** A stored occupancy count and the rooms it
// describes are two numbers that can disagree, and the stored one
// disagrees silently. Same rule as VOID's station scale.
function occupancy(store, listingId) {
  const rooms = listRooms(store, listingId);
  const occupied = rooms.filter((r) => r.status === 'occupied').length;
  return {
    listingId,
    rooms: rooms.length,
    occupied,
    available: rooms.length - occupied,
    // A property with no rooms has no occupancy rate — `null`, not a
    // fabricated 0, which would read as "empty" rather than "not split".
    rate: rooms.length === 0 ? null : round(occupied / rooms.length),
  };
}

// -- moving in and out --------------------------------------------------

// No money moves here. Rent is charged per week of actual residency,
// which is the whole point of the model: no deposit, no lease, nothing
// owed up front.
function startResidency(store, options = {}) {
  const { roomId, memberId, now = Date.now() } = options;

  const room = getRoom(store, roomId);
  if (!room) throw new Error(`startResidency: no room with id ${roomId}`);
  if (!memberId) throw new Error('startResidency requires a memberId');
  if (room.status !== 'available') {
    throw new Error(`startResidency: room ${roomId} is not available (status: ${room.status})`);
  }

  const residency = {
    id: store.nextResidencyId++,
    roomId,
    listingId: room.listingId,
    memberId,
    hostId: room.hostId,
    // Frozen at move-in. A rate change on the room must not silently
    // re-price somebody already living there.
    weeklyRate: room.weeklyRate,
    status: 'active',
    startedAt: now,
    endedAt: null,
    weeksCharged: [],
  };
  store.residencies.push(residency);
  room.status = 'occupied';
  return residency;
}

function getResidency(store, residencyId) {
  return (store.residencies || []).find((r) => r.id === residencyId) || null;
}

function listResidenciesForMember(store, memberId) {
  return (store.residencies || []).filter((r) => r.memberId === memberId);
}

// Ending a residency frees the room. Deliberately no notice period and
// no exit fee: "leave on short notice without breaking a lease" is the
// product, and inventing a penalty here would quietly make it a lease.
function endResidency(store, options = {}) {
  const { residencyId, now = Date.now() } = options;

  const residency = getResidency(store, residencyId);
  if (!residency) throw new Error(`endResidency: no residency with id ${residencyId}`);
  if (residency.status !== 'active') {
    throw new Error(`endResidency: residency ${residencyId} has already ended`);
  }

  residency.status = 'ended';
  residency.endedAt = now;
  const room = getRoom(store, residency.roomId);
  if (room) room.status = 'available';
  return residency;
}

// -- the money ----------------------------------------------------------

// Which week of a residency a moment falls in, counting from move-in.
// Week 0 is the first week. Exported because a caller that wants to
// know what it is about to be charged for should not have to
// re-implement this arithmetic and risk disagreeing with it.
function weekIndexAt(residency, at) {
  return Math.floor((at - residency.startedAt) / WEEK_MS);
}

// Charges one week of rent and splits it host/platform.
//
// **One settlement, both legs or neither.** As two awaited transfers a
// failure on the platform leg would leave the host paid, the fee
// untaken, and the week unrecorded — so charging again would pay the
// host twice for the same week. V3's `/api/vcoin/settle` applies every
// leg or none, and the week is recorded only after it lands.
async function chargeWeek(store, options = {}) {
  const { residencyId, settleFn, now = Date.now() } = options;

  const residency = getResidency(store, residencyId);
  if (!residency) throw new Error(`chargeWeek: no residency with id ${residencyId}`);
  if (residency.status !== 'active') {
    throw new Error(`chargeWeek: residency ${residencyId} has ended and cannot be charged`);
  }
  if (typeof settleFn !== 'function') {
    throw new Error('chargeWeek requires a settleFn(legs, { reason })');
  }

  const week = weekIndexAt(residency, now);
  if (week < 0) throw new Error(`chargeWeek: ${now} is before residency ${residencyId} began`);
  // **Idempotent by week, not by call.** A retry after a network blip,
  // a double-submitted sweep, or an operator running the charge twice
  // must not take a second week's rent. The recorded weeks are the
  // guard, and they are only recorded once the money actually moved.
  if (residency.weeksCharged.includes(week)) {
    throw new Error(`chargeWeek: residency ${residencyId} is already paid for week ${week}`);
  }

  const platformFee = round(residency.weeklyRate * PLATFORM_TAKE_RATE);
  const hostPayout = round(residency.weeklyRate - platformFee);

  await settleFn([
    {
      fromUserId: residency.memberId,
      toUserId: residency.hostId,
      amount: hostPayout,
      reason: `vacay_homes_pad_split_rent:${residencyId}:week${week}`,
    },
    {
      fromUserId: residency.memberId,
      toUserId: VACAY_HOMES_PLATFORM_ACCOUNT,
      amount: platformFee,
      reason: `vacay_homes_pad_split_fee:${residencyId}:week${week}`,
    },
  ], { reason: `vacay_homes_pad_split_week:${residencyId}:${week}` });

  residency.weeksCharged.push(week);
  return {
    residencyId, week, weeklyRate: residency.weeklyRate, hostPayout, platformFee,
  };
}

module.exports = {
  ROOM_STATUSES,
  RESIDENCY_STATUSES,
  PLATFORM_TAKE_RATE,
  WEEK_MS,
  splitProperty,
  getRoom,
  listRooms,
  occupancy,
  startResidency,
  getResidency,
  listResidenciesForMember,
  endResidency,
  weekIndexAt,
  chargeWeek,
};
