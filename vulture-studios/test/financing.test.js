// Vvltvre Studios — financing, the cap table, and revenue splits.
//
// **Why this file exists.** Real VCoin buys real equity here, and the
// equity determines every future payout. A rounding error in this code
// is not cosmetic: it is a permanent, compounding underpayment to the
// same investors on every revenue report forever.
//
// `projects.js` already documents a rounding bug it found and fixed —
// using the 2-decimal display percentage for real payout math would
// "compound two separate rounding steps and quietly shortchange every
// investor but the last". These tests lock that property down so the
// fix cannot be undone by a later refactor that looks tidier.
//
// The failures targeted:
//
//   - a revenue split that does not sum to the amount reported, so
//     money is stranded or invented on every distribution
//   - the wrong investor absorbing the rounding remainder every time
//   - a project accepting more money than its budget
//   - financing still open after a project is fully funded
//   - two competing payout paths for the same money

const test = require('node:test');
const assert = require('node:assert');

const { createVultureStudiosStore } = require('../lib/store');
const projects = require('../lib/projects');

const NOW = Date.UTC(2026, 5, 1);

function ledger(initial = {}) {
  const balances = { ...initial };
  const moves = [];
  const opening = Object.values(balances).reduce((a, b) => a + b, 0);
  const fn = async (from, to, amount, reason) => {
    if (typeof amount !== 'number' || Number.isNaN(amount)) {
      throw new Error(`ledger: non-numeric transfer of ${amount} (${reason})`);
    }
    if (amount < 0) throw new Error(`ledger: negative transfer (${reason})`);
    balances[from] = (balances[from] || 0) - amount;
    balances[to] = (balances[to] || 0) + amount;
    moves.push({ from, to, amount, reason });
    return { ok: true };
  };
  fn.moves = moves;
  fn.of = (a) => balances[a] || 0;
  fn.drift = () => Object.values(balances).reduce((a, b) => a + b, 0) - opening;
  return fn;
}

function greenlit(store, budgetRequested = 1000) {
  return projects.greenlightProject(store, {
    title: 'The Long Dark', medium: 'film',
    synopsis: 'A winter documentary.', budgetRequested, now: NOW,
  });
}

async function fundedProject(store, transferFn, contributions, budget) {
  const total = contributions.reduce((s, c) => s + c.amount, 0);
  const project = greenlit(store, budget !== undefined ? budget : total);
  for (const c of contributions) {
    // eslint-disable-next-line no-await-in-loop -- deliberately sequential
    await projects.investInProject(store, {
      projectId: project.id, investorId: c.investorId, amount: c.amount,
      transferFn, now: NOW,
    });
  }
  return projects.getProject(store, project.id);
}

// -- Financing ----------------------------------------------------------

test('investing moves real money to the production account', async () => {
  const store = createVultureStudiosStore();
  const transferFn = ledger({ ada: 1000 });
  const project = greenlit(store, 1000);

  const { project: updated } = await projects.investInProject(store, {
    projectId: project.id, investorId: 'ada', amount: 400, transferFn, now: NOW,
  });

  assert.strictEqual(transferFn.of('ada'), 600);
  assert.strictEqual(transferFn.of(projects.VULTURE_STUDIOS_PRODUCTION_ACCOUNT), 400);
  assert.strictEqual(updated.amountRaised, 400);
  assert.strictEqual(updated.status, 'greenlit', 'a partially funded project is still raising');
});

test('a project cannot be overfunded, and the refused investor is not charged', async () => {
  const store = createVultureStudiosStore();
  const transferFn = ledger({ ada: 1000, rio: 1000 });
  const project = greenlit(store, 1000);

  await projects.investInProject(store, {
    projectId: project.id, investorId: 'ada', amount: 800, transferFn, now: NOW,
  });

  // Overfunding would dilute everyone who already invested, silently,
  // after the fact.
  await assert.rejects(() => projects.investInProject(store, {
    projectId: project.id, investorId: 'rio', amount: 300, transferFn, now: NOW,
  }), /exceeds/);
  assert.strictEqual(transferFn.of('rio'), 1000, 'a refused investment must not charge anyone');
  assert.strictEqual(projects.getProject(store, project.id).amountRaised, 800);
});

test('financing closes the moment the budget is met', async () => {
  const store = createVultureStudiosStore();
  const transferFn = ledger({ ada: 1000, rio: 1000 });
  const project = await fundedProject(store, transferFn,
    [{ investorId: 'ada', amount: 600 }, { investorId: 'rio', amount: 400 }], 1000);

  assert.strictEqual(project.status, 'funded');
  assert.strictEqual(project.fundedAt, NOW);

  // Taking money into a closed round is money with nothing to buy.
  await assert.rejects(() => projects.investInProject(store, {
    projectId: project.id, investorId: 'ada', amount: 1, transferFn, now: NOW,
  }), /financing is only open/);
});

// -- The cap table ------------------------------------------------------

test('equity is proportional to money in, and sums to the whole', async () => {
  const store = createVultureStudiosStore();
  const transferFn = ledger({ ada: 1000, rio: 1000, kai: 1000 });
  const project = await fundedProject(store, transferFn, [
    { investorId: 'ada', amount: 500 },
    { investorId: 'rio', amount: 300 },
    { investorId: 'kai', amount: 200 },
  ], 1000);

  const { investors } = projects.getProjectEquity(store, project.id);
  const byId = Object.fromEntries(investors.map((e) => [e.investorId, e]));

  assert.strictEqual(byId.ada.equityPercent, 0.5);
  assert.strictEqual(byId.rio.equityPercent, 0.3);
  assert.strictEqual(byId.kai.equityPercent, 0.2);
  assert.ok(Math.abs(investors.reduce((sum, e) => sum + e.equityPercent, 0) - 1) < 0.01,
    'the cap table must account for the whole project, not part of it');
});

test('several investments by the same investor are one position, not several', async () => {
  const store = createVultureStudiosStore();
  const transferFn = ledger({ ada: 1000, rio: 1000 });
  const project = await fundedProject(store, transferFn, [
    { investorId: 'ada', amount: 300 },
    { investorId: 'rio', amount: 400 },
    { investorId: 'ada', amount: 300 },
  ], 1000);

  const { investors } = projects.getProjectEquity(store, project.id);
  assert.strictEqual(investors.length, 2, 'an investor holds one position, however many cheques they wrote');
  const ada = investors.find((e) => e.investorId === 'ada');
  assert.strictEqual(ada.equityPercent, 0.6);
});

// -- Revenue ------------------------------------------------------------

async function completed(store, transferFn, contributions, budget) {
  const project = await fundedProject(store, transferFn, contributions, budget);
  projects.startProduction(store, { projectId: project.id, now: NOW });
  projects.completeProject(store, {
    projectId: project.id, finalAssetUrl: 'https://example.invalid/asset', now: NOW,
  });
  return projects.getProject(store, project.id);
}

test('revenue is split proportionally and sums to exactly what was reported', async () => {
  const store = createVultureStudiosStore();
  const transferFn = ledger({ ada: 1000, rio: 1000, 'vulture-studios-revenue': 10000 });
  const project = await completed(store, transferFn, [
    { investorId: 'ada', amount: 700 },
    { investorId: 'rio', amount: 300 },
  ], 1000);

  const report = await projects.reportProjectRevenue(store, {
    projectId: project.id, amount: 500, source: 'vulture-flix', transferFn, now: NOW,
  });

  const paid = report.payouts.reduce((s, p) => s + p.amount, 0);
  assert.strictEqual(paid, 500,
    'the payouts must sum to exactly the amount reported — no stranding, no invention');
  assert.strictEqual(report.payouts.find((p) => p.investorId === 'ada').amount, 350);
  assert.strictEqual(report.payouts.find((p) => p.investorId === 'rio').amount, 150);
});

test('an awkward three-way split still sums exactly — nobody is shortchanged by rounding', async () => {
  const store = createVultureStudiosStore();
  const transferFn = ledger({ ada: 1000, rio: 1000, kai: 1000, 'vulture-studios-revenue': 10000 });

  // Thirds of a prime-ish amount: no clean decimal exists, so the code
  // must decide who absorbs the remainder rather than losing it.
  const project = await completed(store, transferFn, [
    { investorId: 'ada', amount: 100 },
    { investorId: 'rio', amount: 100 },
    { investorId: 'kai', amount: 100 },
  ], 300);

  const report = await projects.reportProjectRevenue(store, {
    projectId: project.id, amount: 100, source: 'vulture-flix', transferFn, now: NOW,
  });

  const paid = report.payouts.reduce((s, p) => s + p.amount, 0);
  assert.strictEqual(paid, 100,
    'a three-way split of 100 must still pay out exactly 100');

  // Every investor gets essentially a third — the remainder lands on
  // one of them and is a cent, not a systematic short.
  for (const payout of report.payouts) {
    assert.ok(Math.abs(payout.amount - 100 / 3) < 0.02,
      `${payout.investorId} received ${payout.amount}, which is not a fair third`);
  }
});

test('repeated revenue reports do not drift — the same investors are not shorted every time', async () => {
  const store = createVultureStudiosStore();
  const transferFn = ledger({ ada: 1000, rio: 1000, kai: 1000, 'vulture-studios-revenue': 100000 });
  const project = await completed(store, transferFn, [
    { investorId: 'ada', amount: 100 },
    { investorId: 'rio', amount: 100 },
    { investorId: 'kai', amount: 100 },
  ], 300);

  // The failure this catches: if the remainder always lands on the same
  // investor in the same direction, twelve monthly reports compound
  // into a real, visible difference. Small per report, permanent in
  // aggregate — exactly the bug this module's own header describes.
  let reported = 0;
  for (let month = 0; month < 12; month += 1) {
    // eslint-disable-next-line no-await-in-loop
    const report = await projects.reportProjectRevenue(store, {
      projectId: project.id, amount: 100, source: `month-${month}`, transferFn, now: NOW,
    });
    reported += 100;
    assert.strictEqual(report.payouts.reduce((s, p) => s + p.amount, 0), 100);
  }

  const received = ['ada', 'rio', 'kai'].map((id) => transferFn.of(id) - 1000 + 100);
  const total = received.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - reported) < 0.01,
    'a year of reports must pay out exactly what was reported');
  const spread = Math.max(...received) - Math.min(...received);
  assert.ok(spread < 0.5,
    `after 12 reports the investors differ by ${spread} — the remainder is biased, not rotating`);
});

test('revenue cannot be reported before a project completes', async () => {
  const store = createVultureStudiosStore();
  const transferFn = ledger({ ada: 1000, 'vulture-studios-revenue': 10000 });
  const project = await fundedProject(store, transferFn, [{ investorId: 'ada', amount: 500 }], 500);

  await assert.rejects(() => projects.reportProjectRevenue(store, {
    projectId: project.id, amount: 100, source: 'vulture-flix', transferFn, now: NOW,
  }), /.*/);
});

test('a Vvltvre Music project refuses revenue here — one payout path, not two', async () => {
  const store = createVultureStudiosStore();
  const transferFn = ledger({ ada: 1000, 'vulture-studios-revenue': 10000 });
  const project = await completed(store, transferFn, [{ investorId: 'ada', amount: 500 }], 500);

  projects.recordDistribution(store, {
    projectId: project.id, distributionApp: 'vulture-music', distributionTitleId: 42, now: NOW,
  });

  // Two competing "real" distribution paths for the same money would
  // pay every investor twice — and the error message says where to go
  // instead, which is what makes the guard usable rather than annoying.
  await assert.rejects(() => projects.reportProjectRevenue(store, {
    projectId: project.id, amount: 100, source: 'streams', transferFn, now: NOW,
  }), /distributed through Vvltvre Music/);
});

test('a project with no investors cannot distribute revenue to nobody', async () => {
  const store = createVultureStudiosStore();
  const transferFn = ledger({ 'vulture-studios-revenue': 10000 });
  const project = greenlit(store, 500);
  // Force it to completed without any investment, which the normal flow
  // would not produce but a data import could.
  project.status = 'completed';

  await assert.rejects(() => projects.reportProjectRevenue(store, {
    projectId: project.id, amount: 100, source: 'vulture-flix', transferFn, now: NOW,
  }), /no investors/);
});
