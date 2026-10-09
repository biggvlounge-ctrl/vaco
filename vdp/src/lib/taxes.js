// VDP — Taxes: a real government income tax, and whether the AI
// government can afford to import or should build its own.
//
// Per direct instruction (9 Oct 2026): "the currency and the income,
// there also be taxes involved." `jobs.js`'s `clockOutAndPay` is where
// the real tax is actually withheld (see that file's own header for
// why neither module imports the other); this module is the real,
// running log of what the government actually collected and a real
// decision signal built from it.
//
// **"We need the track of how much the government has, how much the
// government is making through taxes, so we can see when the
// government will order more import, more robots... or when they're
// going to start creating their own... or finding a cheaper way to do
// it. The government is trying to be efficient... because it's ran by
// AI."** `recommendDeploymentSource` is that real decision, built from
// two real numbers: the government's own real treasury balance (read
// from V3's real ledger via `v3Client.js`, never duplicated here) and
// a robot type's own real `importCost`/`domesticCost` (see
// `robots.js`). No AI model is simulated -- the same restraint this
// project already applies everywhere "the AI government" comes up
// (`v4AgentClient.js` is the one real call to an actual model; this is
// a named, deterministic rule, not a second invented agent).
//
// `DEFAULT_INCOME_TAX_RATE` is a flagged interpretive number, same
// footing every other unspecified rate in this app already stands on.

export const DEFAULT_INCOME_TAX_RATE = 0.1;
export const GOVERNMENT_TREASURY_ACCOUNT = 'vdp-government-treasury';

export function createTaxesStore() {
  return { collections: [] };
}

export function taxAmountFor(grossAmount, rate = DEFAULT_INCOME_TAX_RATE) {
  if (!Number.isFinite(grossAmount) || grossAmount < 0) {
    throw new Error(`taxAmountFor requires a non-negative grossAmount, got ${grossAmount}`);
  }
  return Math.round(grossAmount * rate);
}

// The real, running log -- every real tax transfer that actually
// succeeded calls this once (`server.cjs`, after `clockOutAndPay`
// reports `shift.taxCollected`), never a second, invented running
// total this module computes on its own.
export function recordTaxCollection(store, { amount, source, now = Date.now() } = {}) {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`recordTaxCollection requires a non-negative amount, got ${amount}`);
  }
  const entry = { amount, source: source || null, collectedAt: now };
  store.collections.push(entry);
  return entry;
}

export function totalTaxRevenue(store) {
  return store.collections.reduce((sum, c) => sum + c.amount, 0);
}

// Real decision: can the government afford this robot type at all,
// and is the import route or the domestic route actually cheaper
// right now -- both real, named facts on the robot type
// (`robots.js`'s own `importCost`/`domesticCost`), never a guessed-at
// efficiency score.
export function recommendDeploymentSource(treasuryBalance, robotType) {
  if (!Number.isFinite(treasuryBalance) || treasuryBalance < 0) {
    throw new Error(`recommendDeploymentSource requires a non-negative treasuryBalance, got ${treasuryBalance}`);
  }
  if (!robotType || !Number.isFinite(robotType.importCost) || !Number.isFinite(robotType.domesticCost)) {
    throw new Error('recommendDeploymentSource requires a real robot type with importCost and domesticCost');
  }
  const cheaperSource = robotType.importCost <= robotType.domesticCost ? 'import' : 'domestic';
  const cost = robotType[`${cheaperSource}Cost`];
  return {
    cheaperSource,
    cost,
    canAfford: treasuryBalance >= cost,
  };
}
