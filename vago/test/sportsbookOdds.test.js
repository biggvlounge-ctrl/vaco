// VAGO — odds as percentages, and the margin that makes them not add up.
//
// **Why this exists.** `-150` is opaque to almost everyone and `60%` is
// not, and they are the same statement. Showing the percentage is the
// cheapest thing that makes a board readable the way a Polymarket or
// Kalshi board is readable — no new mechanic, no new money path.
//
// The part that needs a test rather than a comment is the margin. A
// bookmaker's posted odds embed the vig, so raw implied probabilities
// across an event total **more than 100%**. Rendering those numbers
// under the word "probability" tells a user that a two-outcome game is
// 103% likely to happen. That is not a rounding artefact; it is the
// price of the book, and it has to be either divided out or labelled.
//
// **Scope note.** VAGO settles in VCoin and Gold Coin only; real-money
// gambling is out of scope per `README.md` and `VAGO_CLAUDE.md` §7, and
// nothing here changes that. These are display and pricing helpers.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  impliedProbability, eventProbabilities, eventOverround,
} = require('../lib/sportsbook');

// Worked by hand from the standard conversions, so these are a check on
// the formula rather than a recording of whatever it currently returns.
test('American odds convert to the standard implied probability', () => {
  // favorite: |odds| / (|odds| + 100)
  assert.equal(impliedProbability(-150), 0.6); // 150/250
  assert.equal(impliedProbability(-200), 0.6667); // 200/300
  // underdog: 100 / (odds + 100)
  assert.equal(impliedProbability(130), 0.4348); // 100/230
  assert.equal(impliedProbability(100), 0.5); // an even-money line is a coin flip
});

test('invalid odds are refused rather than converted to nonsense', () => {
  // American odds have no values between -100 and +100; 0 and 50 are
  // not "long shots", they are malformed.
  for (const bad of [0, 50, -50, 99, 1.5, '150', null]) {
    assert.throws(() => impliedProbability(bad), /invalid American odds/,
      `odds ${JSON.stringify(bad)} were accepted`);
  }
});

test('the posted probabilities do not sum to 1, and the excess is the margin', () => {
  const outcomes = [
    { outcomeId: 'home', label: 'Home', odds: -150 },
    { outcomeId: 'away', label: 'Away', odds: 130 },
  ];
  const rows = eventProbabilities(outcomes);
  const posted = rows.reduce((n, r) => n + r.impliedProbability, 0);

  assert.ok(posted > 1,
    'the posted probabilities summed to 1 or less — a book with no margin is not a book');
  // The overround is exactly that excess, which is what makes it a
  // number a reader can act on rather than a mystery.
  assert.equal(eventOverround(outcomes), Math.round((posted - 1) * 10000) / 10000);
});

test('the fair probabilities do sum to 1', () => {
  // Three-way, because a two-outcome event can hide a normalisation bug
  // that happens to be symmetric.
  const outcomes = [
    { outcomeId: 'home', label: 'Home', odds: -150 },
    { outcomeId: 'draw', label: 'Draw', odds: 260 },
    { outcomeId: 'away', label: 'Away', odds: 320 },
  ];
  const fair = eventProbabilities(outcomes).reduce((n, r) => n + r.fairProbability, 0);
  assert.ok(Math.abs(fair - 1) < 0.0005,
    `the de-vigged probabilities summed to ${fair}, not 1`);
});

test('de-vigging lowers every outcome, never raises one', () => {
  // The margin is divided out proportionally, so each fair probability
  // must sit below its posted one. A fair number *above* its posted one
  // would mean the de-vig had inverted somewhere.
  const outcomes = [
    { outcomeId: 'a', label: 'A', odds: -300 },
    { outcomeId: 'b', label: 'B', odds: 240 },
  ];
  for (const row of eventProbabilities(outcomes)) {
    assert.ok(row.fairProbability < row.impliedProbability,
      `${row.label}: fair ${row.fairProbability} is not below posted ${row.impliedProbability}`);
  }
});

test('a fair probability is always a tradeable opening price', () => {
  // This is the number a paired market opens at, and
  // `createPredictionMarket` refuses anything outside 0.01–0.99. A
  // lopsided line must not produce an opening price the market then
  // rejects — that would make event creation fail on exactly the
  // fixtures a demo wants.
  const lopsided = [
    { outcomeId: 'lock', label: 'Heavy favorite', odds: -5000 },
    { outcomeId: 'dog', label: 'Long shot', odds: 2500 },
  ];
  for (const row of eventProbabilities(lopsided)) {
    assert.ok(row.fairProbability >= 0.01 && row.fairProbability <= 0.99,
      `${row.label} produced ${row.fairProbability}, which a market would refuse as an opening price`);
  }
});

test('an event needs at least two outcomes to have probabilities at all', () => {
  assert.throws(() => eventProbabilities([{ outcomeId: 'a', label: 'A', odds: -150 }]),
    /at least 2 outcomes/);
  assert.throws(() => eventProbabilities([]), /at least 2 outcomes/);
});
