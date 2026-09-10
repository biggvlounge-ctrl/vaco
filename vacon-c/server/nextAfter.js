// server/nextAfter.js
//
// One function, in its own file, purely to keep `idSequences.js` from
// being required by the nine modules it itself requires. Every module
// that owns an id counter needs this helper inside its `reseedIds`;
// `idSequences.js` needs those modules. Putting the helper there and
// importing it back would be a cycle, and a cycle here resolves to
// `undefined` at exactly the moment a restore calls it.

'use strict';

// max(id) + 1 over a set of rows, or 1 for an empty set.
//
// Ids that are absent or non-numeric are skipped rather than allowed
// to make the max NaN — a row with no id is a real problem, but it is
// a different one, and silently returning NaN here would turn it into
// every subsequent id being NaN.
function nextAfter(rows, field = 'id') {
  let max = 0;
  for (const row of rows || []) {
    const value = Number(row?.[field]);
    if (Number.isFinite(value) && value > max) max = value;
  }
  return max + 1;
}

module.exports = { nextAfter };
