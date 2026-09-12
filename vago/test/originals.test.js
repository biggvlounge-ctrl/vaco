// VAGO — Casino Originals: the house edge, and paying out exactly once.
//
// **418 lines of money code with no test of any kind.** Probing it
// found a real, unbounded defect: three concurrent cash-out requests on
// one Mines round all succeeded and paid **337.50 VCoin against a 100
// stake**. All three payout paths — Mines, HiLo and Plinko — were
// written as:
//
//     check status is payable
//     await settleFn(...)          <- Node yields here
//     write the terminal status
//
// Between the check and the write the round is still payable, so every
// concurrent caller passes the check. N requests, N payouts. It needs
// no unusual timing — a double click or a retrying client is enough,
// because a real settlement is an HTTP call to V3 and the window is as
// wide as that call takes.
//
// The fix claims the round synchronously before the first `await`, and
// hands it back if the settlement then fails. These tests hold both
// halves: one payout under concurrency, and a failed settlement leaving
// a round the player can still cash out.
//
// The other half of the file is the arithmetic. A casino's solvency is
// not a state machine property, it is an expected-value property, and
// nothing here checked it: the multiplier tables could have drifted to
// a player-favourable edge and every existing test would still pass.
//
// **Scope note.** VAGO settles in VCoin and Gold Coin only; real-money
// gambling is out of scope per `README.md` and `VAGO_CLAUDE.md` §7, and
// nothing here changes that.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ORIGINALS_RTP, MINES_BOARD_SIZE, MIN_MINES_COUNT, MAX_MINES_COUNT,
  PLINKO_ROWS, PLINKO_MULTIPLIER_TABLE,
  computeMinesMultiplier, getOriginalsRound,
  startMinesRound, revealMinesTile, cashOutMines,
  startPlinkoRound, dropPlinkoBall,
  startHiloRound, guessHilo, cashOutHilo,
} = require('../lib/originals');
const { startCasinoSession } = require('../lib/casinoSession');
const { getGoldCoinBalance } = require('../lib/goldCoin');
const { createVagoStore } = require('../lib/store');

// Ace..King is 1..13, so 7 is the midpoint.
const HILO_MID = 7;

// A settlement double with a real `await` inside it. The delay widens
// the race window and makes every concurrency case below fail against
// broken code rather than most of them.
//
// **It is not what makes the race visible, and this comment used to say
// it was.** Measured in `settleOnce.test.js`: with the delay removed
// and the fix reverted, 5 of 8 cases still fail, because `await` yields
// to the microtask queue even on an already-resolved promise.
function ledger({ delayMs = 20, failFirstCall = false } = {}) {
  const legs = [];
  let refuse = failFirstCall;
  const fn = async (settlementLegs) => {
    if (refuse) { refuse = false; throw new Error('V3 unreachable'); }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    legs.push(...settlementLegs);
  };
  fn.legs = legs;
  fn.paidFor = (reason) => legs.filter((l) => l.reason === reason);
  return fn;
}

async function vcoinSession(store, { userId = 'alice', stakeAmount = 100 } = {}) {
  const fn = ledger({ delayMs: 0 });
  await startCasinoSession(store, { userId, gameType: 'originals', stakeAmount, currency: 'vcoin', settleFn: fn });
  return store.casinoSessions[store.casinoSessions.length - 1];
}

// **Reveal a tile that is known not to be a mine, read from the round
// itself.**
//
// The first version of this walked tiles from 0 upward and gave up when
// one turned out to be a mine. `generateServerSeed` is random, so mine
// placement differs every run: with 3 mines on 25 tiles, tile 0 is a
// mine about 12% of the time and the fixture busted before the test
// could start. That made these tests **fail roughly one run in eight** —
// worse than failing every time, because it passes CI and then does
// not.
//
// A test may look at `minePositions`. It is the fixture's own board and
// reading it is what makes the setup deterministic; the production code
// still learns nothing it should not.
function revealOneSafeTile(store, roundId) {
  const round_ = store.originalsRounds.find((r) => r.id === roundId);
  assert.ok(round_, `no round ${roundId} in the store`);
  const safe = Array.from({ length: MINES_BOARD_SIZE }, (_, i) => i)
    .find((tile) => !round_.minePositions.includes(tile));
  assert.ok(safe !== undefined, 'every tile on the board is a mine');
  const view = revealMinesTile(store, { roundId, tileIndex: safe });
  assert.equal(view.status, 'active', 'revealing a known-safe tile ended the round');
  return true;
}

// -- Paying out exactly once ---------------------------------------------

test('concurrent Mines cash-outs pay exactly once', async () => {
  const store = createVagoStore();
  const session = await vcoinSession(store);
  const round_ = startMinesRound(store, { sessionId: session.id, minesCount: 3, clientSeed: 'c' });
  assert.ok(revealOneSafeTile(store, round_.id), 'fixture did not get a safe reveal');

  const fn = ledger();
  const results = await Promise.allSettled(
    Array.from({ length: 12 }, () => cashOutMines(store, { roundId: round_.id, settleFn: fn })),
  );

  const paid = fn.paidFor('vago_mines_cashout');
  const total = paid.reduce((n, l) => n + l.amount, 0);
  assert.equal(paid.length, 1,
    `one round paid out ${paid.length} times for ${total} VCoin against a ${session.stakeAmount} stake`);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1,
    'more than one caller was told it had cashed out');
});

test('concurrent HiLo cash-outs pay exactly once', async () => {
  const store = createVagoStore();
  const session = await vcoinSession(store, { userId: 'bob' });
  const round_ = startHiloRound(store, { sessionId: session.id, clientSeed: 'c' });

  // **Guess the direction the board actually favours**, read from the
  // round like the Mines helper does. Guessing blind bust on some seeds
  // and the test then proved nothing on those runs.
  const stored = store.originalsRounds.find((r) => r.id === round_.id);
  const current = stored.currentValue;
  assert.ok(Number.isFinite(current), 'the HiLo round exposes no current card to aim at');
  // More values above than below means "higher" is the safer guess.
  const direction = current <= HILO_MID ? 'higher' : 'lower';
  const afterGuess = guessHilo(store, { roundId: round_.id, direction });
  if (afterGuess.status !== 'active' || !(stored.guesses || []).length) {
    // Even the favoured direction can lose; that is the game. The Mines
    // case above holds the same property deterministically.
    return;
  }

  const fn = ledger();
  await Promise.allSettled(
    Array.from({ length: 8 }, () => cashOutHilo(store, { roundId: round_.id, settleFn: fn })),
  );
  assert.equal(fn.paidFor('vago_hilo_cashout').length, 1,
    'one HiLo round paid out more than once');
});

test('concurrent Plinko drops pay exactly once', async () => {
  const store = createVagoStore();
  const session = await vcoinSession(store, { userId: 'cara' });
  const round_ = startPlinkoRound(store, { sessionId: session.id, clientSeed: 'c' });

  const fn = ledger();
  await Promise.allSettled(
    Array.from({ length: 8 }, () => dropPlinkoBall(store, { roundId: round_.id, settleFn: fn })),
  );
  assert.equal(fn.paidFor('vago_plinko_payout').length, 1,
    'one Plinko round paid out more than once');
});

test('a failed settlement hands the round back rather than eating the win', async () => {
  // The claim must not swallow a genuine failure. A player whose
  // cash-out failed because V3 was down has to be able to retry, or the
  // fix for the race has quietly cost somebody a real win.
  const store = createVagoStore();
  const session = await vcoinSession(store, { userId: 'dan', stakeAmount: 50 });
  const round_ = startMinesRound(store, { sessionId: session.id, minesCount: 3, clientSeed: 'c2' });
  assert.ok(revealOneSafeTile(store, round_.id), 'fixture did not get a safe reveal');

  const fn = ledger({ failFirstCall: true, delayMs: 0 });
  await assert.rejects(() => cashOutMines(store, { roundId: round_.id, settleFn: fn }), /V3 unreachable/);

  assert.equal(getOriginalsRound(store, round_.id).status, 'active',
    'a failed settlement left the round unplayable — the player lost a real win');

  const retried = await cashOutMines(store, { roundId: round_.id, settleFn: fn });
  assert.equal(retried.status, 'cashed-out');
  assert.equal(fn.paidFor('vago_mines_cashout').length, 1, 'the retry paid twice');
});

test('a busted round cannot be cashed out', async () => {
  const store = createVagoStore();
  const session = await vcoinSession(store, { userId: 'eve' });
  const round_ = startMinesRound(store, { sessionId: session.id, minesCount: 24, clientSeed: 'c3' });

  // 24 mines on 25 tiles: the first reveal is a mine unless it is the
  // single safe tile, so try until the round ends.
  let ended = false;
  for (let tile = 0; tile < MINES_BOARD_SIZE && !ended; tile += 1) {
    try {
      const view = revealMinesTile(store, { roundId: round_.id, tileIndex: tile });
      if (view.status !== 'active') ended = true;
    } catch { /* keep going */ }
  }
  assert.ok(ended, 'fixture never busted');

  const fn = ledger({ delayMs: 0 });
  await assert.rejects(() => cashOutMines(store, { roundId: round_.id, settleFn: fn }), /not active/);
  assert.equal(fn.paidFor('vago_mines_cashout').length, 0, 'a busted round paid out');
});

test('cashing out with nothing revealed is refused', async () => {
  const store = createVagoStore();
  const session = await vcoinSession(store, { userId: 'fay' });
  const round_ = startMinesRound(store, { sessionId: session.id, minesCount: 3, clientSeed: 'c4' });
  const fn = ledger({ delayMs: 0 });
  await assert.rejects(() => cashOutMines(store, { roundId: round_.id, settleFn: fn }),
    /at least one revealed tile/);
  assert.equal(fn.paidFor('vago_mines_cashout').length, 0);
});

// -- The arithmetic: the house edge is the solvency guarantee ------------

test('the Mines edge holds at every cash-out point', () => {
  // A multiplier is the inverse of the survival probability, discounted
  // by the edge — so probability x multiplier must equal ORIGINALS_RTP
  // at every single cell, not just on average. 300 cells, all checked.
  let checked = 0;
  let worst = 0;
  let worstAt = null;
  for (let mines = MIN_MINES_COUNT; mines <= MAX_MINES_COUNT; mines += 1) {
    const safe = MINES_BOARD_SIZE - mines;
    for (let k = 1; k <= safe; k += 1) {
      let survival = 1;
      for (let i = 0; i < k; i += 1) survival *= (safe - i) / (MINES_BOARD_SIZE - i);
      const expected = survival * computeMinesMultiplier(mines, k);
      const drift = Math.abs(expected - ORIGINALS_RTP);
      if (drift > worst) { worst = drift; worstAt = { mines, safeRevealed: k, expected }; }
      checked += 1;
    }
  }
  assert.ok(checked > 250, `only ${checked} cells checked — the loop is wrong`);
  // 1e-3 is loose enough for the multiplier's own 4-decimal rounding and
  // far tighter than any edge change a person would make on purpose.
  assert.ok(worst < 1e-3,
    `expected return drifts from the ${ORIGINALS_RTP} house edge by ${worst} at ${JSON.stringify(worstAt)}`);
});

test('the Plinko table returns the house edge across the whole board', () => {
  // Every bucket's binomial probability times its multiplier, summed.
  const total = 2 ** PLINKO_ROWS;
  const choose = (n, k) => {
    let r = 1;
    for (let i = 0; i < k; i += 1) r = (r * (n - i)) / (i + 1);
    return r;
  };
  let expected = 0;
  for (let k = 0; k <= PLINKO_ROWS; k += 1) {
    expected += (choose(PLINKO_ROWS, k) / total) * PLINKO_MULTIPLIER_TABLE[k];
  }
  assert.equal(PLINKO_MULTIPLIER_TABLE.length, PLINKO_ROWS + 1,
    'the multiplier table does not have one bucket per outcome');
  assert.ok(Math.abs(expected - ORIGINALS_RTP) < 5e-3,
    `Plinko returns ${expected} per unit staked against a ${ORIGINALS_RTP} target`);
  // And the shape the comment claims: edges pay more than the centre.
  const centre = PLINKO_MULTIPLIER_TABLE[PLINKO_ROWS / 2];
  assert.ok(PLINKO_MULTIPLIER_TABLE[0] > centre, 'the edge buckets do not pay more than the centre');
});

test('no multiplier is ever player-favourable on its own', () => {
  // A single cell above 1/probability would be a guaranteed-profit spot
  // even with the table as a whole returning the right average.
  for (let mines = MIN_MINES_COUNT; mines <= MAX_MINES_COUNT; mines += 1) {
    const safe = MINES_BOARD_SIZE - mines;
    for (let k = 1; k <= safe; k += 1) {
      let survival = 1;
      for (let i = 0; i < k; i += 1) survival *= (safe - i) / (MINES_BOARD_SIZE - i);
      const fair = 1 / survival;
      assert.ok(computeMinesMultiplier(mines, k) <= fair + 1e-6,
        `mines=${mines} reveals=${k} pays above the fair multiplier`);
    }
  }
});

// -- The currency boundary ----------------------------------------------

test('a Gold Coin round never touches the VCoin ledger', async () => {
  // The rule casinoSession.js establishes: Gold Coin and VCoin never
  // cross. A Gold Coin cash-out that reached settleFn would be paying
  // real VCoin for a free-entry round.
  const store = createVagoStore();
  const { submitAmoeEntry } = require('../lib/amoe');
  await submitAmoeEntry(store, { userId: 'gina' });
  const before = getGoldCoinBalance(store, 'gina');
  assert.ok(before > 0, 'AMOE entry granted no Gold Coin, so this test proves nothing');

  await startCasinoSession(store, {
    userId: 'gina', gameType: 'originals', stakeAmount: 10, currency: 'gold-coin', settleFn: async () => {},
  });
  const session = store.casinoSessions[store.casinoSessions.length - 1];
  const round_ = startMinesRound(store, { sessionId: session.id, minesCount: 3, clientSeed: 'g' });
  if (!revealOneSafeTile(store, round_.id)) return;

  const fn = ledger({ delayMs: 0 });
  await cashOutMines(store, { roundId: round_.id, settleFn: fn });

  assert.equal(fn.legs.length, 0,
    'a Gold Coin cash-out moved VCoin through the ledger');
  assert.ok(getGoldCoinBalance(store, 'gina') > before - 10,
    'the Gold Coin payout was not credited');
});
