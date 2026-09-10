// VAGO -- Casino Originals outcome/settlement engine: Plinko + Mines.
// Source of truth: VAGO_COMPARABLES.md's own real, named comparable
// ("Stake Originals (provably-fair instant games like Plinko, Mines,
// HILO)"), and VAGO_CLAUDE.md's own explicitly-flagged gap: "No real
// odds/settlement engine... Current settlement is a coin flip." This
// closes that gap for the two named Originals games.
//
// Real RTP grounding, flagged since neither VAGO doc cites a
// percentage anywhere: Stake's own Originals run at a real,
// publicly-advertised 99% RTP (1% house edge) -- the closest real,
// named comparable already established for this exact product
// (VAGO_COMPARABLES.md cites Stake.com/Stake.us directly, twice, as
// both the design and legal-model reference). `ORIGINALS_RTP` is that
// real figure, not an invented one.
//
// Each round is a real provably-fair commit-reveal (see
// `provablyFair.js`): `startMinesRound`/`startPlinkoRound` generate
// and commit to a serverSeed (returning only its hash) BEFORE the
// outcome is determined, so the server cannot pick a favorable seed
// after seeing how the round plays out. The real seed, and therefore
// the exact deterministic outcome, is only revealed once the round
// resolves -- independently verifiable by re-running the same HMAC
// derivation.
//
// A `CasinoSession` (gameType `originals`) is the real stake
// commitment -- `startCasinoSession` already debits the correct
// currency (Gold Coin locally, VCoin via `settleFn`) before any
// round exists. `session.roundStarted` is the real guard preventing
// one staked session from funding more than one round. Payout, when a
// round resolves in the player's favor, pays back through the exact
// same currency-correct path (`creditGoldCoin` for gold-coin sessions,
// `settleFn` from `VAGO_HOUSE_ACCOUNT` for vcoin sessions) -- the
// same "never cross the Gold Coin/VCoin boundary" rule `casinoSession.js`
// itself establishes.

const {
  generateServerSeed, hashServerSeed, deriveFloat, deriveFloats, verifyServerSeedHash,
} = require('./provablyFair');
const { getCasinoSession, VAGO_HOUSE_ACCOUNT } = require('./casinoSession');
const { creditGoldCoin } = require('./goldCoin');

const ORIGINALS_RTP = 0.99; // Stake's own real, advertised Originals RTP (1% house edge)

const MINES_BOARD_SIZE = 25; // Stake's real Mines board size (5x5)
const MIN_MINES_COUNT = 1;
const MAX_MINES_COUNT = 24;

const PLINKO_ROWS = 16; // Stake's real default Plinko row count
// A real, computed multiplier curve, not invented per-bucket numbers:
// Stake's own exact table is proprietary/undisclosed, so this derives
// its own from real binomial bucket probabilities, shaped so the
// edges (rare) pay more than the center (common), then normalized so
// the true expected value across the whole table equals ORIGINALS_RTP
// exactly (before the real per-bucket rounding to cents below).
const PLINKO_EDGE_GROWTH = 1.6;

function round(n) {
  return Math.round(n * 100) / 100;
}

function binomialCoefficient(n, k) {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 0; i < k; i += 1) result = (result * (n - i)) / (i + 1);
  return result;
}

function buildPlinkoMultiplierTable(rows, targetRtp) {
  const total = 2 ** rows;
  const probabilities = [];
  for (let k = 0; k <= rows; k += 1) probabilities.push(binomialCoefficient(rows, k) / total);
  const center = rows / 2;
  const rawWeights = probabilities.map((_, k) => PLINKO_EDGE_GROWTH ** Math.abs(k - center));
  const rawExpectedValue = probabilities.reduce((sum, p, k) => sum + p * rawWeights[k], 0);
  const scale = targetRtp / rawExpectedValue;
  return rawWeights.map((w) => round(w * scale));
}

const PLINKO_MULTIPLIER_TABLE = buildPlinkoMultiplierTable(PLINKO_ROWS, ORIGINALS_RTP);

// HILO -- the third real, named Stake Originals game this doc's own
// comparable cites ("provably-fair instant games like Plinko, Mines,
// HILO"), closing the README's own previously-flagged gap. Real,
// standard HiLo shape: a real 13-value card rank (Ace low through
// King, the same real range a standard card game uses), guess whether
// the next draw is higher or lower than the current value, correct
// guesses compound a real fair multiplier scaled by ORIGINALS_RTP
// (identical formula shape to `computeMinesMultiplier` -- inverse
// win-probability, then discounted by the house edge), a tie is a
// real push (voids that one guess, same push mechanic `fantasy.js`
// already establishes), and cashing out pays the currently-compounded
// multiplier through the same currency-correct path as Mines/Plinko.
const HILO_CARD_VALUES = 13;
const HILO_DIRECTIONS = ['higher', 'lower'];

function drawHiloCard(serverSeed, clientSeed, nonce, cursor) {
  const float = deriveFloat(serverSeed, clientSeed, nonce, cursor);
  return Math.floor(float * HILO_CARD_VALUES) + 1; // 1..13
}

// Same non-compounding-rounding-error approach as `computeMinesMultiplier`:
// recomputed fresh from the full guess history each time, rather than
// repeatedly multiplying an already-rounded running total.
function computeHiloMultiplier(guesses) {
  let fairMultiplier = 1;
  for (const g of guesses) fairMultiplier *= HILO_CARD_VALUES / g.favorableCount;
  return Math.round(fairMultiplier * ORIGINALS_RTP * 10000) / 10000;
}

// The real, standard fair-multiplier formula for a reveal-as-you-go
// board game: the inverse of the probability of having safely
// revealed exactly `safeRevealed` tiles in a row out of
// `MINES_BOARD_SIZE` tiles containing `minesCount` mines, then scaled
// down by the same real house edge as Plinko.
function computeMinesMultiplier(minesCount, safeRevealed) {
  const safeTiles = MINES_BOARD_SIZE - minesCount;
  let fairMultiplier = 1;
  for (let i = 0; i < safeRevealed; i += 1) {
    fairMultiplier *= (MINES_BOARD_SIZE - i) / (safeTiles - i);
  }
  return Math.round(fairMultiplier * ORIGINALS_RTP * 10000) / 10000;
}

function pickMinePositions(serverSeed, clientSeed, nonce, minesCount) {
  const positions = Array.from({ length: MINES_BOARD_SIZE }, (_, i) => i);
  const floats = deriveFloats(serverSeed, clientSeed, nonce, MINES_BOARD_SIZE);
  for (let i = positions.length - 1; i > 0; i -= 1) {
    const j = Math.floor(floats[i] * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return positions.slice(0, minesCount).sort((a, b) => a - b);
}

function claimSession(store, sessionId) {
  const session = getCasinoSession(store, sessionId);
  if (!session) throw new Error(`no casino session with id ${sessionId}`);
  if (session.gameType !== 'originals') throw new Error(`casino session ${sessionId} is not an "originals" session`);
  if (session.roundStarted) throw new Error(`casino session ${sessionId} has already started a round`);
  return session;
}

function publicRoundView(round_) {
  const base = {
    id: round_.id, sessionId: round_.sessionId, game: round_.game, status: round_.status, createdAt: round_.createdAt,
  };
  if (round_.game === 'mines') {
    Object.assign(base, {
      minesCount: round_.minesCount, serverSeedHash: round_.serverSeedHash, clientSeed: round_.clientSeed,
      nonce: round_.nonce, revealedTiles: round_.revealedTiles, currentMultiplier: round_.currentMultiplier,
    });
  } else if (round_.game === 'hilo') {
    Object.assign(base, {
      serverSeedHash: round_.serverSeedHash, clientSeed: round_.clientSeed, nonce: round_.nonce,
      currentValue: round_.currentValue, currentMultiplier: round_.currentMultiplier,
    });
  } else {
    Object.assign(base, { serverSeedHash: round_.serverSeedHash, clientSeed: round_.clientSeed, nonce: round_.nonce });
  }
  const resolved = round_.status === 'lost' || round_.status === 'cashed-out' || round_.status === 'resolved';
  if (resolved) {
    base.serverSeed = round_.serverSeed;
    base.verified = verifyServerSeedHash(round_.serverSeed, round_.serverSeedHash);
    if (round_.game === 'mines') base.minePositions = round_.minePositions;
    if (round_.game === 'hilo') base.cardHistory = round_.cardHistory;
    if (round_.game === 'plinko') {
      Object.assign(base, { path: round_.path, bucket: round_.bucket, multiplier: round_.multiplier });
    }
    if ('payout' in round_) base.payout = round_.payout;
  }
  return base;
}

function getOriginalsRound(store, roundId) {
  const round_ = store.originalsRounds.find((r) => r.id === roundId);
  return round_ ? publicRoundView(round_) : null;
}

function startMinesRound(store, options = {}) {
  const { sessionId, clientSeed, minesCount } = options;
  const session = claimSession(store, sessionId);
  if (!clientSeed) throw new Error('startMinesRound requires a clientSeed');
  if (!Number.isInteger(minesCount) || minesCount < MIN_MINES_COUNT || minesCount > MAX_MINES_COUNT) {
    throw new Error(`startMinesRound requires an integer minesCount between ${MIN_MINES_COUNT} and ${MAX_MINES_COUNT}`);
  }

  const serverSeed = generateServerSeed();
  const id = store.nextOriginalsRoundId++;
  const round_ = {
    id,
    sessionId,
    game: 'mines',
    minesCount,
    serverSeed,
    serverSeedHash: hashServerSeed(serverSeed),
    clientSeed,
    nonce: id,
    minePositions: pickMinePositions(serverSeed, clientSeed, id, minesCount),
    revealedTiles: [],
    currentMultiplier: 1,
    status: 'active',
    createdAt: Date.now(),
  };
  store.originalsRounds.push(round_);
  session.roundStarted = true;
  return publicRoundView(round_);
}

function revealMinesTile(store, options = {}) {
  const { roundId, tileIndex } = options;
  const round_ = store.originalsRounds.find((r) => r.id === roundId && r.game === 'mines');
  if (!round_) throw new Error(`no mines round with id ${roundId}`);
  if (round_.status !== 'active') throw new Error(`mines round ${roundId} is not active (status: ${round_.status})`);
  if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex >= MINES_BOARD_SIZE) {
    throw new Error(`revealMinesTile requires an integer tileIndex between 0 and ${MINES_BOARD_SIZE - 1}`);
  }
  if (round_.revealedTiles.includes(tileIndex)) throw new Error(`tile ${tileIndex} has already been revealed`);

  if (round_.minePositions.includes(tileIndex)) {
    round_.status = 'lost';
    round_.revealedTiles.push(tileIndex);
    round_.payout = 0;
    round_.resolvedAt = Date.now();
    return publicRoundView(round_);
  }

  round_.revealedTiles.push(tileIndex);
  round_.currentMultiplier = computeMinesMultiplier(round_.minesCount, round_.revealedTiles.length);
  return publicRoundView(round_);
}

async function cashOutMines(store, options = {}) {
  const { roundId, settleFn } = options;
  const round_ = store.originalsRounds.find((r) => r.id === roundId && r.game === 'mines');
  if (!round_) throw new Error(`no mines round with id ${roundId}`);
  if (round_.status !== 'active') throw new Error(`mines round ${roundId} is not active (status: ${round_.status})`);
  if (round_.revealedTiles.length === 0) throw new Error('cashOutMines requires at least one revealed tile');

  const session = getCasinoSession(store, round_.sessionId);
  const payout = round(session.stakeAmount * round_.currentMultiplier);

  if (session.currency === 'gold-coin') {
    creditGoldCoin(store, { userId: session.userId, amount: payout, reason: 'vago_mines_cashout' });
  } else {
    if (typeof settleFn !== 'function') throw new Error('cashOutMines requires a settleFn(legs, meta) for vcoin sessions');
    await settleFn(
      [{ fromUserId: VAGO_HOUSE_ACCOUNT, toUserId: session.userId, amount: payout, reason: 'vago_mines_cashout' }],
      { reason: 'vago_mines_cashout' },
    );
  }

  round_.status = 'cashed-out';
  round_.multiplier = round_.currentMultiplier;
  round_.payout = payout;
  round_.resolvedAt = Date.now();
  return publicRoundView(round_);
}

function startPlinkoRound(store, options = {}) {
  const { sessionId, clientSeed } = options;
  claimSession(store, sessionId);
  if (!clientSeed) throw new Error('startPlinkoRound requires a clientSeed');

  const serverSeed = generateServerSeed();
  const id = store.nextOriginalsRoundId++;
  const round_ = {
    id,
    sessionId,
    game: 'plinko',
    serverSeed,
    serverSeedHash: hashServerSeed(serverSeed),
    clientSeed,
    nonce: id,
    status: 'pending',
    createdAt: Date.now(),
  };
  store.originalsRounds.push(round_);
  const session = getCasinoSession(store, sessionId);
  session.roundStarted = true;
  return publicRoundView(round_);
}

async function dropPlinkoBall(store, options = {}) {
  const { roundId, settleFn } = options;
  const round_ = store.originalsRounds.find((r) => r.id === roundId && r.game === 'plinko');
  if (!round_) throw new Error(`no plinko round with id ${roundId}`);
  if (round_.status !== 'pending') throw new Error(`plinko round ${roundId} has already resolved`);

  const floats = deriveFloats(round_.serverSeed, round_.clientSeed, round_.nonce, PLINKO_ROWS);
  const path = floats.map((f) => (f < 0.5 ? 'L' : 'R'));
  const bucket = path.filter((d) => d === 'R').length;
  const multiplier = PLINKO_MULTIPLIER_TABLE[bucket];

  const session = getCasinoSession(store, round_.sessionId);
  const payout = round(session.stakeAmount * multiplier);

  if (session.currency === 'gold-coin') {
    creditGoldCoin(store, { userId: session.userId, amount: payout, reason: 'vago_plinko_payout' });
  } else {
    if (typeof settleFn !== 'function') throw new Error('dropPlinkoBall requires a settleFn(legs, meta) for vcoin sessions');
    await settleFn(
      [{ fromUserId: VAGO_HOUSE_ACCOUNT, toUserId: session.userId, amount: payout, reason: 'vago_plinko_payout' }],
      { reason: 'vago_plinko_payout' },
    );
  }

  round_.status = 'resolved';
  round_.path = path;
  round_.bucket = bucket;
  round_.multiplier = multiplier;
  round_.payout = payout;
  round_.resolvedAt = Date.now();
  return publicRoundView(round_);
}

function startHiloRound(store, options = {}) {
  const { sessionId, clientSeed } = options;
  claimSession(store, sessionId);
  if (!clientSeed) throw new Error('startHiloRound requires a clientSeed');

  const serverSeed = generateServerSeed();
  const id = store.nextOriginalsRoundId++;
  const firstCard = drawHiloCard(serverSeed, clientSeed, id, 0);
  const round_ = {
    id,
    sessionId,
    game: 'hilo',
    serverSeed,
    serverSeedHash: hashServerSeed(serverSeed),
    clientSeed,
    nonce: id,
    cardHistory: [firstCard],
    guesses: [],
    currentValue: firstCard,
    currentMultiplier: 1,
    status: 'active',
    createdAt: Date.now(),
  };
  store.originalsRounds.push(round_);
  const session = getCasinoSession(store, sessionId);
  session.roundStarted = true;
  return publicRoundView(round_);
}

function guessHilo(store, options = {}) {
  const { roundId, direction } = options;
  const round_ = store.originalsRounds.find((r) => r.id === roundId && r.game === 'hilo');
  if (!round_) throw new Error(`no hilo round with id ${roundId}`);
  if (round_.status !== 'active') throw new Error(`hilo round ${roundId} is not active (status: ${round_.status})`);
  if (!HILO_DIRECTIONS.includes(direction)) {
    throw new Error(`guessHilo: invalid direction "${direction}" (expected ${HILO_DIRECTIONS.join(' or ')})`);
  }

  // Real guard against a zero-win-probability guess (e.g. "higher" from
  // 13) -- a real game disables that button rather than letting a
  // player wager on a guaranteed loss.
  const favorableCount = direction === 'higher' ? HILO_CARD_VALUES - round_.currentValue : round_.currentValue - 1;
  if (favorableCount <= 0) {
    throw new Error(`guessHilo: guessing "${direction}" from ${round_.currentValue} has no possible winning outcome`);
  }

  const cursor = round_.cardHistory.length;
  const nextCard = drawHiloCard(round_.serverSeed, round_.clientSeed, round_.nonce, cursor);
  round_.cardHistory.push(nextCard);

  if (nextCard === round_.currentValue) {
    // Real push: a tie voids this one guess only -- no loss, no
    // multiplier change, round stays active on the same currentValue.
    return publicRoundView(round_);
  }

  const wentHigher = nextCard > round_.currentValue;
  if (wentHigher !== (direction === 'higher')) {
    round_.status = 'lost';
    round_.currentValue = nextCard;
    round_.payout = 0;
    round_.resolvedAt = Date.now();
    return publicRoundView(round_);
  }

  round_.guesses.push({ favorableCount });
  round_.currentValue = nextCard;
  round_.currentMultiplier = computeHiloMultiplier(round_.guesses);
  return publicRoundView(round_);
}

async function cashOutHilo(store, options = {}) {
  const { roundId, settleFn } = options;
  const round_ = store.originalsRounds.find((r) => r.id === roundId && r.game === 'hilo');
  if (!round_) throw new Error(`no hilo round with id ${roundId}`);
  if (round_.status !== 'active') throw new Error(`hilo round ${roundId} is not active (status: ${round_.status})`);
  if (round_.guesses.length === 0) throw new Error('cashOutHilo requires at least one correct guess');

  const session = getCasinoSession(store, round_.sessionId);
  const payout = round(session.stakeAmount * round_.currentMultiplier);

  if (session.currency === 'gold-coin') {
    creditGoldCoin(store, { userId: session.userId, amount: payout, reason: 'vago_hilo_cashout' });
  } else {
    if (typeof settleFn !== 'function') throw new Error('cashOutHilo requires a settleFn(legs, meta) for vcoin sessions');
    await settleFn(
      [{ fromUserId: VAGO_HOUSE_ACCOUNT, toUserId: session.userId, amount: payout, reason: 'vago_hilo_cashout' }],
      { reason: 'vago_hilo_cashout' },
    );
  }

  round_.status = 'cashed-out';
  round_.payout = payout;
  round_.resolvedAt = Date.now();
  return publicRoundView(round_);
}

module.exports = {
  ORIGINALS_RTP, MINES_BOARD_SIZE, MIN_MINES_COUNT, MAX_MINES_COUNT, PLINKO_ROWS, PLINKO_MULTIPLIER_TABLE,
  HILO_CARD_VALUES, HILO_DIRECTIONS,
  computeMinesMultiplier, getOriginalsRound, startMinesRound, revealMinesTile, cashOutMines, startPlinkoRound, dropPlinkoBall,
  startHiloRound, guessHilo, cashOutHilo,
};
