// server/investments.js
//
// `investments` — genuinely unbuilt rather than deferred. `economy.js`
// names this table alongside `trade_routes` and is explicit that only
// `trade_routes` is closed scope under CLAUDE.md's Transportation
// deferral: "`investments` and `trade_routes` are still NOT built.
// Trade routes fall under the Transportation deferral... [investments
// does not]." No mechanism anywhere created, valued or settled one.
//
// ---------------------------------------------------------------------
// The real mechanic, and why it is this shape
// ---------------------------------------------------------------------
// `investments.category` is the schema's own enum (the comment on the
// column, verbatim): businesses, property, resources, infrastructure,
// technology, education, transportation, energy, healthcare. Every
// category is a real, choosable label; nothing here builds a second
// mechanic for `transportation` specifically, so choosing it records a
// real row without implying a trade-route system exists.
//
// An investment moves real money from the investor's own savings
// (`individual_finances`, the same claim-before-pay discipline
// `barter.exchange` already uses) into the target entity's assets —
// `organizations.assets`, the exact field `economy.runProduction`
// already grows from labour. Money funds capital either way; this is
// the other real source of it.
//
// **The return, and why it is a steady share rather than tied to this
// tick's output.** `runProduction` does not expose a per-organization
// revenue figure to callers (`byEmployer` stays internal), and reading
// it indirectly by diffing `assets` across ticks would double-count
// against `runDividends`' own payout the tick after it ran. A flat,
// named `DIVIDEND_RATE_PER_TICK` share of the organization's CURRENT
// assets, paid out proportional to each investor's stake, is a real,
// bounded, measurable return with no second opinion about what the
// business made this tick — flagged interpretive, same as `salvage.js`'s
// `SKILL_PER_TIER` and every other invented constant in this package.
//
// **Only an organization target pays a dividend.** `target_entity_id`
// can be any entity — `education`/`healthcare` naturally point at a
// PERSON (funding somebody's schooling or care), and a person has no
// production engine to grow the gift. That is honest: a scholarship
// does not pay the giver back, and this file does not invent a return
// for it.

'use strict';

const { nextAfter } = require('./nextAfter.js');
const economy = require('./economy.js');

const CATEGORIES = [
  'businesses', 'property', 'resources', 'infrastructure', 'technology',
  'education', 'transportation', 'energy', 'healthcare',
];

// Interpretive: no document gives a rate of return. Small and steady,
// matching `salvage.js`'s own "quantities are small and deliberately
// so" posture — this is a stake in a business, not a windfall.
const DIVIDEND_RATE_PER_TICK = 0.005;

let nextInvestmentId = 1;

function invest(worldState, options = {}) {
  const {
    investorEntityId, targetEntityId, category, amount, tick = worldState.tick ?? 0,
  } = options;

  if (!investorEntityId) throw new Error('invest requires an investorEntityId');
  if (!targetEntityId) throw new Error('invest requires a targetEntityId');
  if (!CATEGORIES.includes(category)) {
    throw new Error(`invest: "${category}" is not a real investments.category (one of: ${CATEGORIES.join(', ')})`);
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('invest requires a positive finite amount');
  }

  const investor = (worldState.npcs || []).find((n) => n.id === investorEntityId);
  if (!investor) throw new Error(`invest: no entity ${investorEntityId}`);

  const finances = economy.getLatestFinances(worldState, investorEntityId);
  const savings = Number(finances?.savings ?? 0);
  if (savings < amount) {
    throw new Error(`invest: entity ${investorEntityId} has ${savings} savings, not ${amount}`);
  }

  // Claim first: the row is written before the target side is
  // touched, so a thrown error below (an unknown target type) leaves
  // the investor's own money exactly where it was rather than half
  // charged.
  const row = {
    id: nextInvestmentId++,
    investor_entity_id: investorEntityId,
    target_entity_id: targetEntityId,
    category,
    amount,
    tick,
  };

  const target = (worldState.organizations || []).find((o) => o.id === targetEntityId);
  if (target) {
    target.assets = (Number(target.assets) || 0) + amount;
  }
  // A non-organization target (a person, funded for education or
  // healthcare) still records the real transfer -- the giver's money
  // leaves; nothing here invents a holding account for the receiver,
  // the same way a gift does not create a second ledger.

  economy.generateIndividualFinances(worldState, investorEntityId, {
    income: finances?.income ?? 0,
    savings: savings - amount,
    debt: finances?.debt ?? 0,
    assets: finances?.assets ?? 0,
    tick,
  });

  (worldState.investments || (worldState.investments = [])).push(row);
  return row;
}

function investmentsBy(worldState, investorEntityId) {
  return (worldState.investments || []).filter((r) => r.investor_entity_id === investorEntityId);
}

function investmentsIn(worldState, targetEntityId) {
  return (worldState.investments || []).filter((r) => r.target_entity_id === targetEntityId);
}

function totalInvestedIn(worldState, targetEntityId) {
  return investmentsIn(worldState, targetEntityId)
    .reduce((sum, r) => sum + Number(r.amount), 0);
}

// This investor's share of everything put into this one target, as a
// 0-1 fraction. Null when nobody has invested in it at all -- a stake
// of nothing is not a stake of zero, the same unknown-is-not-zero rule
// every reader in this engine follows.
function stakeOf(worldState, investorEntityId, targetEntityId) {
  const total = totalInvestedIn(worldState, targetEntityId);
  if (total <= 0) return null;
  const mine = investmentsBy(worldState, investorEntityId)
    .filter((r) => r.target_entity_id === targetEntityId)
    .reduce((sum, r) => sum + Number(r.amount), 0);
  return mine / total;
}

// One tick's dividend pass. Real, bounded money leaving an
// organization's own assets into the savings of whoever funded it,
// proportional to their real stake -- never minted, never more than
// the organization actually has.
function runDividends(worldState, tick) {
  const events = [];
  const byTarget = new Map();
  for (const row of worldState.investments || []) {
    if (!byTarget.has(row.target_entity_id)) byTarget.set(row.target_entity_id, []);
    byTarget.get(row.target_entity_id).push(row);
  }

  let totalPaid = 0;
  for (const [targetEntityId, rows] of byTarget) {
    const org = (worldState.organizations || []).find((o) => o.id === targetEntityId);
    if (!org) continue; // a person-held investment pays no dividend -- see the header

    const totalStake = rows.reduce((sum, r) => sum + Number(r.amount), 0);
    if (totalStake <= 0) continue;

    const pool = Math.floor((Number(org.assets) || 0) * DIVIDEND_RATE_PER_TICK);
    if (pool <= 0) continue;

    const byInvestor = new Map();
    for (const row of rows) {
      byInvestor.set(row.investor_entity_id, (byInvestor.get(row.investor_entity_id) ?? 0) + Number(row.amount));
    }

    let distributed = 0;
    for (const [investorEntityId, stake] of byInvestor) {
      const share = Math.floor(pool * (stake / totalStake));
      if (share <= 0) continue;
      const finances = economy.getLatestFinances(worldState, investorEntityId);
      economy.generateIndividualFinances(worldState, investorEntityId, {
        income: finances?.income ?? 0,
        savings: (finances?.savings ?? 0) + share,
        debt: finances?.debt ?? 0,
        assets: finances?.assets ?? 0,
        tick,
      });
      distributed += share;
    }

    if (distributed > 0) {
      org.assets = Math.max(0, (Number(org.assets) || 0) - distributed);
      totalPaid += distributed;
      events.push({ type: 'dividend_paid', organizationId: targetEntityId, amount: distributed, tick });
    }
  }

  return { events, paid: totalPaid };
}

function reseedIds(worldState) {
  nextInvestmentId = nextAfter(worldState.investments);
  return { nextInvestmentId };
}

module.exports = {
  CATEGORIES,
  DIVIDEND_RATE_PER_TICK,
  invest,
  investmentsBy,
  investmentsIn,
  totalInvestedIn,
  stakeOf,
  runDividends,
  reseedIds,
};
