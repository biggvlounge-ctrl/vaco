// VAGO -- claim a record before paying for it, not after.
//
// **Every settlement path in this app had the same race, and it was
// found by probing rather than by reading.** They were all written as:
//
//     if (thing.status !== 'open') throw ...     <- the guard
//     await settleFn(...)                        <- Node yields HERE
//     thing.status = 'settled';                  <- the write
//
// Between the guard and the write the record is still payable, and
// `await` is exactly where Node hands control to the next pending
// request. So every concurrent caller passes the guard, every one
// settles, and every one pays. Measured, five concurrent calls each:
//
//   settleSportsEvent    250.05 paid out for 3 winning bets
//   resolveEsportsMatch  200.00 paid out of a 40.00 pool
//   gradeFantasyEntry    150.00 paid on a 10.00 stake
//   resolveMarket         86.00 paid out of a 17.20 pool
//   cashOutMines        1350.00 paid on a 100.00 stake (12 calls)
//
// None of it needs exotic timing. A double-click, a retrying client, or
// two operators pressing settle at once is enough, because a real
// settlement is an HTTP call to V3 and the window is as wide as that
// call takes. `settleSportsEvent` is the worst of them: it settles in a
// loop with an await per bet, so its window grows with the number of
// bets on the event.
//
// **This also corrects a claim made in `predictionMarkets.js`.** Its
// header calls pooled pari-mutuel settlement "solvent by construction",
// and that is true of the arithmetic and was never true of the
// concurrency: the pool can only pay out what it collected *once*, and
// nothing stopped it paying out five times.
//
// ---------------------------------------------------------------------
//
// The fix is to claim the record synchronously, before the first
// `await`. Node runs a function body up to its first suspension point
// without interruption, so a second caller arriving afterwards sees the
// terminal state and throws before it can pay.
//
// **And it must hand the claim back if the payment fails.** A claim
// that swallowed a genuine failure would be worse than the race it
// fixes: a player whose payout failed because V3 was down would be
// left with a settled record and no money, and no way to retry. So the
// claimed fields are snapshotted and restored on a throw.
//
// Only the fields being claimed are snapshotted. Restoring the whole
// record would also undo anything the payment legitimately wrote before
// it failed, and would fight with `Object.assign` patterns the callers
// already use.
//
// The same shape as `v3/lib/idempotencyPg.js`, which claims an
// idempotency key with `INSERT ... ON CONFLICT DO NOTHING` before the
// handler runs rather than recording it afterwards. Record-after is
// always a race; the only question is how wide the window is.

'use strict';

/**
 * Apply `claim` to `target` synchronously, then run `pay`.
 *
 * @param {object}   target  the record being settled -- a match, an
 *                           event, an entry, a market, a round
 * @param {object}   claim   the terminal fields, e.g.
 *                           `{ status: 'resolved', winnerId }`
 * @param {function} pay     async; does the actual settlement. Any
 *                           throw restores the claimed fields and
 *                           re-throws, so the caller can retry.
 * @returns {Promise<*>}     whatever `pay` resolved to
 */
async function settleOnce(target, claim, pay) {
  if (!target || typeof target !== 'object') {
    throw new Error('settleOnce requires the record being settled');
  }
  if (!claim || typeof claim !== 'object') {
    throw new Error('settleOnce requires a claim describing the terminal state');
  }
  if (typeof pay !== 'function') {
    throw new Error('settleOnce requires a pay() function');
  }

  // Snapshot before claiming, so a failure can put it back exactly.
  // `Object.prototype.hasOwnProperty` rather than a truthiness check:
  // a field that was legitimately `null` or `0` must come back as that
  // and not as `undefined`.
  const had = {};
  const previous = {};
  for (const key of Object.keys(claim)) {
    had[key] = Object.prototype.hasOwnProperty.call(target, key);
    previous[key] = target[key];
  }

  Object.assign(target, claim);

  try {
    return await pay();
  } catch (err) {
    for (const key of Object.keys(claim)) {
      if (had[key]) target[key] = previous[key];
      else delete target[key];
    }
    throw err;
  }
}

module.exports = { settleOnce };
