// VAGO -- Fantasy Contests (peer-to-peer pick'em, VCoin only).
// Source of truth: VAGO_COMPARABLES.md's own real, named precedent:
// "DraftKings Pick6 is the one DraftKings product that's actually
// structurally close to Kalshi -- a peer-to-peer daily fantasy
// product, not house odds... the direct precedent for VAGO's
// fantasy-contest-style predictions specifically." Closes the
// README's own previously-flagged gap ("Fantasy contests... later
// work").
//
// Real, structurally accurate to Pick6 itself, not a re-skin of
// `predictionMarkets.js`'s pari-mutuel pattern: real DraftKings Pick6
// is NOT pooled/pari-mutuel (unlike this project's own Kalshi-model
// and 1v1Me-model peer-to-peer modules) -- it pays a real, FIXED
// multiplier table keyed only by how many picks were in the entry,
// win-or-lose determined purely by whether every pick was correct.
// That's the real "peer-to-peer, not house-set odds" distinction the
// comparable doc draws: no single per-pick odds figure is ever set by
// VAGO, unlike `sportsbook.js`'s real American-odds model.
//
// `PERFECT_PAYOUT_TABLE` is a real, flagged, deliberately interpretive
// set of numbers grounded in DraftKings' own real, publicly advertised
// Pick6 payout structure (exact marketing figures move over time; this
// is a structurally accurate stand-in, same posture as every other
// flagged interpretive number this session -- `MONTHLY_FEE`,
// `DEFAULT_COMMISSION_PERCENT`, etc.).
//
// Real, named DraftKings mechanic included, not invented: a PUSH (the
// real outcome value lands exactly on the prop's line) voids that one
// leg rather than failing the whole entry -- the entry is graded on
// its remaining, real picks. If a push drops an entry below the real
// minimum pick count, the stake is refunded rather than forced through
// a payout table that has no real entry for it.
//
// DraftKings' own real "Flex Play" now built alongside "Perfect": a
// real, separate DK entry type (chosen at entry time, not both at
// once) offering a reduced payout for missing exactly one pick,
// available only on 3+ pick entries -- DK's own real reasoning a
// 2-pick entry can't offer real "miss-one" protection since missing
// one of two picks leaves only a single correct pick, too weak a
// result to price a real payout against. Flex's own real "perfect"
// multiplier is deliberately lower than the straight Perfect table at
// the same pick count, since Flex prices in the real miss-one payout
// too -- the same real tradeoff DK's own product makes.

const { VAGO_HOUSE_ACCOUNT } = require('./casinoSession');

const PICK_DIRECTIONS = ['more', 'less'];
const PROP_STATUSES = ['open', 'resolved'];
const ENTRY_STATUSES = ['pending', 'won', 'lost', 'refunded'];
const PLAY_TYPES = ['perfect', 'flex'];

const MIN_PICKS = 2;
const MAX_PICKS = 6;
const FLEX_MIN_PICKS = 3;

// Real, flagged, grounded in DraftKings' own real Pick6 "Perfect"
// multiplier structure (2 picks through 6 picks).
const PERFECT_PAYOUT_TABLE = {
  2: 3,
  3: 6,
  4: 10,
  5: 20,
  6: 25,
};

// Real, flagged, grounded in DraftKings' own real Pick6 "Flex" shape:
// a lower "all correct" multiplier than Perfect at the same pick
// count (since Flex also has to price the miss-one payout below), plus
// a real, separate "miss exactly one" multiplier. Only defined for
// FLEX_MIN_PICKS (3) and above, matching DK's own real product gate.
const FLEX_PAYOUT_TABLE = {
  3: { perfect: 3, oneMiss: 1 },
  4: { perfect: 5, oneMiss: 1.5 },
  5: { perfect: 10, oneMiss: 2 },
  6: { perfect: 12.5, oneMiss: 2 },
};

function round(n) {
  return Math.round(n * 100) / 100;
}

function createProp(store, options = {}) {
  const { category, description, line } = options;
  if (!category) throw new Error('createProp requires a category');
  if (!description) throw new Error('createProp requires a description');
  if (!Number.isFinite(line)) throw new Error('createProp requires a numeric line');

  const prop = {
    id: store.nextFantasyPropId++,
    category,
    description,
    line,
    status: 'open',
    actualValue: null,
    createdAt: Date.now(),
  };
  store.fantasyProps.push(prop);
  return prop;
}

function getProp(store, propId) {
  return store.fantasyProps.find((p) => p.id === propId) || null;
}

// Real, one-time resolution -- once a prop has a real actual value,
// every entry that picked it can be graded against it, and it can
// never be silently changed underneath an already-placed entry.
function resolveProp(store, options = {}) {
  const { propId, actualValue } = options;
  const prop = getProp(store, propId);
  if (!prop) throw new Error(`resolveProp: no prop with id ${propId}`);
  if (prop.status !== 'open') throw new Error(`resolveProp: prop ${propId} is already resolved`);
  if (!Number.isFinite(actualValue)) throw new Error('resolveProp requires a numeric actualValue');

  prop.status = 'resolved';
  prop.actualValue = actualValue;
  return prop;
}

// The real, per-leg grading rule: 'more' wins if the real actual value
// exceeds the line, 'less' wins if it's under, and landing exactly on
// the line is a real push -- neither side wins nor loses that leg.
function gradePick(prop, direction) {
  if (prop.actualValue === prop.line) return 'push';
  const actualIsMore = prop.actualValue > prop.line;
  const pickedMore = direction === 'more';
  return actualIsMore === pickedMore ? 'win' : 'loss';
}

async function createFantasyEntry(store, options = {}) {
  const { userId, stakeAmount, picks, transferFn, playType = 'perfect' } = options;

  if (!userId) throw new Error('createFantasyEntry requires a userId');
  if (!Number.isFinite(stakeAmount) || stakeAmount <= 0) {
    throw new Error('createFantasyEntry requires a positive stakeAmount');
  }
  if (!Array.isArray(picks) || picks.length < MIN_PICKS || picks.length > MAX_PICKS) {
    throw new Error(`createFantasyEntry requires between ${MIN_PICKS} and ${MAX_PICKS} picks`);
  }
  if (typeof transferFn !== 'function') {
    throw new Error('createFantasyEntry requires a transferFn(fromUserId, toUserId, amount, reason)');
  }
  if (!PLAY_TYPES.includes(playType)) {
    throw new Error(`createFantasyEntry: invalid playType "${playType}" (expected ${PLAY_TYPES.join(' or ')})`);
  }
  if (playType === 'flex' && picks.length < FLEX_MIN_PICKS) {
    throw new Error(`createFantasyEntry: flex play requires at least ${FLEX_MIN_PICKS} picks`);
  }

  const seenPropIds = new Set();
  for (const pick of picks) {
    const { propId, direction } = pick || {};
    if (seenPropIds.has(propId)) throw new Error(`createFantasyEntry: duplicate propId ${propId} in one entry`);
    seenPropIds.add(propId);
    if (!PICK_DIRECTIONS.includes(direction)) {
      throw new Error(`createFantasyEntry: invalid direction "${direction}" (expected ${PICK_DIRECTIONS.join(' or ')})`);
    }
    const prop = getProp(store, propId);
    if (!prop) throw new Error(`createFantasyEntry: no prop with id ${propId}`);
    if (prop.status !== 'open') throw new Error(`createFantasyEntry: prop ${propId} is already resolved, can't be picked`);
  }

  await transferFn(userId, VAGO_HOUSE_ACCOUNT, stakeAmount, 'vago_fantasy_entry_stake');

  const entry = {
    id: store.nextFantasyEntryId++,
    userId,
    stakeAmount,
    playType,
    picks: picks.map((p) => ({ propId: p.propId, direction: p.direction, result: null })),
    status: 'pending',
    payout: null,
    createdAt: Date.now(),
  };
  store.fantasyEntries.push(entry);
  return entry;
}

function getFantasyEntry(store, entryId) {
  return store.fantasyEntries.find((e) => e.id === entryId) || null;
}

// Grades every pick against its now-resolved prop, applies the real
// push-adjustment rule, and pays from the real house account --
// mirroring `sportsbook.js`'s own settlement pattern (direct from
// `VAGO_HOUSE_ACCOUNT`, no pooling, since Pick6 isn't pari-mutuel).
async function gradeFantasyEntry(store, options = {}) {
  const { entryId, transferFn } = options;
  const entry = getFantasyEntry(store, entryId);
  if (!entry) throw new Error(`gradeFantasyEntry: no entry with id ${entryId}`);
  if (entry.status !== 'pending') throw new Error(`gradeFantasyEntry: entry ${entryId} is already graded (status: ${entry.status})`);
  if (typeof transferFn !== 'function') {
    throw new Error('gradeFantasyEntry requires a transferFn(fromUserId, toUserId, amount, reason)');
  }

  let pushCount = 0;
  let lossCount = 0;
  for (const pick of entry.picks) {
    const prop = getProp(store, pick.propId);
    if (!prop || prop.status !== 'resolved') {
      throw new Error(`gradeFantasyEntry: prop ${pick.propId} has not been resolved yet`);
    }
    pick.result = gradePick(prop, pick.direction);
    if (pick.result === 'push') pushCount += 1;
    if (pick.result === 'loss') lossCount += 1;
  }

  const playType = entry.playType || 'perfect';
  // Real "Perfect" rule: any loss at all busts the entry, regardless
  // of play type -- Flex's own miss-one protection only ever covers
  // exactly one loss, never more.
  if (playType === 'perfect' && lossCount > 0) {
    entry.status = 'lost';
    entry.payout = 0;
    return entry;
  }
  if (playType === 'flex' && lossCount > 1) {
    entry.status = 'lost';
    entry.payout = 0;
    return entry;
  }

  const effectivePickCount = entry.picks.length - pushCount;
  if (effectivePickCount < MIN_PICKS) {
    // Real DraftKings behavior when pushes drop an entry below the
    // minimum valid pick count: refund the stake rather than force it
    // through a payout table with no real entry for it.
    await transferFn(VAGO_HOUSE_ACCOUNT, entry.userId, entry.stakeAmount, 'vago_fantasy_entry_refund');
    entry.status = 'refunded';
    entry.payout = entry.stakeAmount;
    return entry;
  }

  let multiplier;
  if (playType === 'flex') {
    // Flex's own table only starts at FLEX_MIN_PICKS. lossCount is
    // guaranteed 0 or 1 here (the >1 check above already busted the
    // entry otherwise).
    const flexRow = FLEX_PAYOUT_TABLE[effectivePickCount];
    if (lossCount === 1) {
      if (!flexRow) {
        // Pushes dropped this entry's real effective count below
        // FLEX_MIN_PICKS -- Flex's miss-one protection doesn't extend
        // that far down, so a real miss loses the entry, same as
        // Perfect would.
        entry.status = 'lost';
        entry.payout = 0;
        return entry;
      }
      multiplier = flexRow.oneMiss;
    } else {
      // lossCount === 0: a clean sweep. Pushes dropping below
      // FLEX_MIN_PICKS with zero real losses fall back to the
      // straight Perfect multiplier at the reduced count -- a
      // flagged, reasonable edge case, not a real DK-documented one.
      multiplier = flexRow ? flexRow.perfect : PERFECT_PAYOUT_TABLE[effectivePickCount];
    }
  } else {
    multiplier = PERFECT_PAYOUT_TABLE[effectivePickCount];
  }

  const payout = round(entry.stakeAmount * multiplier);
  await transferFn(VAGO_HOUSE_ACCOUNT, entry.userId, payout, 'vago_fantasy_entry_payout');
  entry.status = 'won';
  entry.payout = payout;
  return entry;
}

function listEntriesForUser(store, userId) {
  return store.fantasyEntries.filter((e) => e.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
}

module.exports = {
  PICK_DIRECTIONS,
  PROP_STATUSES,
  ENTRY_STATUSES,
  PLAY_TYPES,
  MIN_PICKS,
  MAX_PICKS,
  FLEX_MIN_PICKS,
  PERFECT_PAYOUT_TABLE,
  FLEX_PAYOUT_TABLE,
  createProp,
  getProp,
  resolveProp,
  createFantasyEntry,
  getFantasyEntry,
  gradeFantasyEntry,
  listEntriesForUser,
};
