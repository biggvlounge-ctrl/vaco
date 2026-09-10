// Vvltvre Music — a revenue report settles once, or not at all.
//
// **The defect these exist for is worse than a half-paid report.**
//
// `reportStreamingRevenue` pays up to three parties per co-writer:
// label recoupment, the artist's net share, and the manager's
// commission. It used to pay each with its own `await transferFn`,
// inside a loop, while mutating as it went — `applyLabelDeal` reduced
// the deal's recoupment balance *before* the money for later payees had
// moved, and each commission was pushed to `store.commissionPayouts`
// the same way.
//
// So a failure part-way through left some co-writers paid and others
// not, recoupment already applied against revenue that never left the
// intake account, orphan commission records, and **no revenue report at
// all** — the report is only pushed at the very end.
//
// Then the retry ran the whole loop again. It recouped a **second time
// against the same revenue**, which permanently reduces what the artist
// is owed on every future report, and re-paid everyone the first pass
// had reached. Nothing anywhere recorded why the artist's balance was
// short.
//
// The fix is structural, not cosmetic: compute every payee's split
// touching nothing (`computeLabelDeal`), settle the entire report in one
// call, and only then commit the mutations (`commitLabelDeal`, the
// commission records, the report).

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  submitRelease, markDistributing, markLive, reportStreamingRevenue,
  VULTURE_MUSIC_REVENUE_INTAKE_ACCOUNT,
} = require('../lib/releases');
const { signLabelDeal, getLabelDeal } = require('../lib/labelDeals');
const { createVultureMusicStore } = require('../lib/store');

const NOW = Date.UTC(2026, 8, 1);

// **Refusal is armed explicitly, not on the first call.** These tests
// need a specific settlement to fail — the revenue report — and the
// fixtures settle too (a label advance is real money). An earlier
// version refused the first call and hit `signLabelDeal`'s advance
// instead, which proves nothing about the report.
function recorder() {
  const legs = [];
  const settlements = [];
  let refuse = false;
  const fn = async (settlementLegs, meta = {}) => {
    if (refuse) {
      refuse = false;
      throw new Error('legs[1]: Insufficient VCoin balance. Nothing in this settlement was applied.');
    }
    settlements.push({ legs: settlementLegs, meta });
    legs.push(...settlementLegs);
  };
  fn.refuseNext = () => { refuse = true; };
  fn.legs = legs;
  fn.settlements = settlements;
  fn.paidTo = (userId) => legs
    .filter((l) => l.toUserId === userId)
    .reduce((n, l) => n + l.amount, 0);
  return fn;
}

async function liveRelease(store, settleFn, coWriters = null) {
  const release = await submitRelease(store, {
    artistId: 'nova', title: 'Cherokee Street', format: 'single',
    targetPlatforms: ['Spotify'], coWriters, settleFn, now: NOW,
  });
  markDistributing(store, release.id);
  markLive(store, release.id);
  return release;
}

test('a whole revenue report is ONE settlement, however many payees', async () => {
  const store = createVultureMusicStore();
  const settleFn = recorder();
  const release = await liveRelease(store, settleFn, [
    { userId: 'nova', splitPercent: 0.6 },
    { userId: 'kai', splitPercent: 0.4 },
  ]);
  const before = settleFn.settlements.length;

  await reportStreamingRevenue(store, {
    releaseId: release.id, amount: 100, source: 'spotify', settleFn, now: NOW,
  });

  const reportSettlements = settleFn.settlements.slice(before);
  assert.equal(reportSettlements.length, 1,
    'every payee in one report must be paid in a single atomic settlement');
  assert.equal(reportSettlements[0].legs.length, 2, 'two co-writers, two legs');
  const total = reportSettlements[0].legs.reduce((n, l) => n + l.amount, 0);
  assert.ok(Math.abs(total - 100) < 0.01, 'the legs must sum to exactly the reported revenue');
  assert.ok(reportSettlements[0].legs.every((l) => l.fromUserId === VULTURE_MUSIC_REVENUE_INTAKE_ACCOUNT));
});

test('a refused report does not recoup, and the retry recoups exactly once', async () => {
  // **The regression, and the reason this file exists.** Recoupment is
  // the mutation that used to happen before the money moved. If a
  // refused report still advanced it, the artist is underpaid on every
  // future report and there is no record of why.
  const store = createVultureMusicStore();
  const settleFn = recorder();
  const release = await liveRelease(store, settleFn);

  const deal = await signLabelDeal(store, {
    labelId: 'vulture-records', artistId: 'nova', dealType: 'per-release',
    release, advanceAmount: 500, settleFn, now: NOW,
  });
  const balanceBefore = getLabelDeal(store, deal.id).recoupmentBalance;
  assert.ok(balanceBefore > 0, 'the fixture must start with a real advance to recoup');

  settleFn.refuseNext();
  await assert.rejects(
    () => reportStreamingRevenue(store, {
      releaseId: release.id, amount: 100, source: 'spotify', settleFn, now: NOW,
    }),
    /Nothing in this settlement was applied/,
  );

  assert.equal(getLabelDeal(store, deal.id).recoupmentBalance, balanceBefore,
    'a refused report recouped against revenue that never moved');
  assert.equal(store.revenueReports.length, 0, 'a refused report was recorded');

  // The retry, which the absent report record deliberately permits.
  await reportStreamingRevenue(store, {
    releaseId: release.id, amount: 100, source: 'spotify', settleFn, now: NOW,
  });

  assert.equal(getLabelDeal(store, deal.id).recoupmentBalance, balanceBefore - 100,
    'the retry recouped a second time against the same revenue');
  assert.equal(store.revenueReports.length, 1);
});

test('a refused report writes no commission record', async () => {
  // Commission rows were pushed inside the loop, before later payees
  // were paid — so a failure left a manager credited in the ledger's
  // eyes for a report that never happened.
  const store = createVultureMusicStore();
  const settleFn = recorder();
  const release = await liveRelease(store, settleFn);

  settleFn.refuseNext();
  await assert.rejects(
    () => reportStreamingRevenue(store, {
      releaseId: release.id, amount: 100, source: 'spotify', settleFn, now: NOW,
    }),
    /Nothing in this settlement was applied/,
  );

  assert.equal(store.commissionPayouts.length, 0,
    'a refused report recorded a commission payout');
});

test('a report that fully recoups pays nobody and still records', async () => {
  // A legitimate zero: the label recoups the entire share, so there is
  // nothing to settle. Settling an empty leg set would be refused by
  // V3, so the report must skip the call rather than fail.
  const store = createVultureMusicStore();
  const settleFn = recorder();
  const release = await liveRelease(store, settleFn);

  await signLabelDeal(store, {
    labelId: 'vulture-records', artistId: 'nova', dealType: 'per-release',
    release, advanceAmount: 5000, settleFn, now: NOW,
  });
  const before = settleFn.settlements.length;

  const report = await reportStreamingRevenue(store, {
    releaseId: release.id, amount: 50, source: 'spotify', settleFn, now: NOW,
  });

  // The advance (5000) far exceeds this report (50), so the label
  // recoups the whole share and the artist nets zero. The recoupment
  // itself is a real payout, so exactly one settlement of one leg.
  const settlements = settleFn.settlements.slice(before);
  assert.equal(settlements.length, 1, 'the label recoupment is a real payout and must settle');
  assert.equal(settlements[0].legs.length, 1, 'only the label is paid on a fully-recouped report');
  assert.equal(report.artistNet, 0, 'a fully-recouped report pays the artist nothing');
  assert.equal(report.payouts[0].labelPayout.recoupedAmount, 50, 'the whole share recouped');
});
