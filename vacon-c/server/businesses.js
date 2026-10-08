// server/businesses.js
//
// §7 system 28, Business: "formation, growth and failure are not
// driven. No business is ever founded or wound up in a running world
// — `worldgen` makes them all and the set never changes." Three other
// files already pointed at this exact gap and waited for it:
// `snapshots.js` leaves Business out of `economy_snapshots` because
// "`businesses.revenue`/`.profit` are schema-only columns nothing has
// ever written (system #28 Business stays `partial` for exactly this
// reason)", and `economy_snapshots.gdp`'s own note names the same two
// columns as what a real GDP figure would have to sum.
//
// ---------------------------------------------------------------------
// Revenue and profit are not invented here — they already exist
// ---------------------------------------------------------------------
// `organizations.income`/`.expenses` are real, accumulated figures —
// `economy.runProduction` adds to income every tick a business has
// staff producing, `economy.runPayroll` adds to expenses every tick it
// pays them. `businesses.revenue`/`.profit` are a SUBTYPE VIEW of the
// same organization (standing rule 4, and `completeness.js`'s own
// `BY_DESIGN.businesses` entry says so), so this file computes them at
// the moment something needs to read them — `migrate.js`, the same way
// `families.wealth` is computed from `engine.getFamilyWealth()` rather
// than stored a second time — and never stores a duplicate.
// `market_share` is the same kind of derived figure: this business's
// income against every business's income in the same city. `industry`
// is derived too, from the real, named occupation its employees
// actually hold (`occupations.OCCUPATIONS[position].source`), not a
// label picked from a list nobody specified. `brand_value` stays null
// — no mechanism anywhere in this engine moves a "brand" (reputation
// is the nearest candidate and it is a frozen generation-time value,
// standing rule 9's trap exactly), and a number substituted in for it
// would be the body-composition mistake again: a plausible wrong
// answer where an honest gap belongs.
//
// ---------------------------------------------------------------------
// Formation
// ---------------------------------------------------------------------
// `foundBusiness` is the ordinary act: a working-age person with
// savings puts some of it up as capital and opens a business, quitting
// whatever job they held to run it (measured: 100 of 103 working-age
// people on a fresh world already hold one by tick 50, so requiring an
// unemployed founder would mean nearly nobody could ever found one —
// see the function's own header). The capital is real money moved —
// out of the founder's own
// `individual_finances`, same ledger `investments.invest` already uses
// — not a number materialised from nowhere. How much is asked is the
// one number in this file nobody measured from a spec, because no spec
// names one: `STARTUP_CAPITAL_WAGE_MULTIPLE` ties it to the economy's
// own going wage rather than a flat constant, flagged interpretive the
// same way `investments.DIVIDEND_RATE_PER_TICK` is.
//
// A founder has to hire themselves on the spot. `economy.runLabour`'s
// hiring pass only considers employers who already have somebody —
// "an employer that has nobody has no wage scale of its own and no
// evidence it can pay" — so a business founded with nobody on its own
// payroll could never take its first employee through the ordinary
// market and would sit at `idea` forever. The founder taking the first
// job at their own company is the same shape `worldgen` already uses
// to staff a hospital or a school that opened with nobody qualified
// yet: somebody keeps the door.
//
// ---------------------------------------------------------------------
// Failure, and its inverse
// ---------------------------------------------------------------------
// CLAUDE.md's thirteenth standing rule: a mechanism with no inverse is
// a one-way ratchet. `economy.runLabour` already makes "losing every
// employee" permanent — once an organization has nobody, it drops out
// of the hiring pass's `staffed` map and can never be chosen again —
// so "business death" already existed as a structural fact with no
// name, no event and no `lifecycle_stage` to show it. This file names
// it (`decline`, then `legacy` after it has stayed empty and unable to
// afford anyone for a month of ticks) and gives it the inverse that was
// missing: `attemptRescueHire` lets a staffless business that can still
// afford the market's going wage take on one person — the exact test
// `runLabour` itself applies to a business that still has staff — which
// is what makes `decline` a real state a business can leave rather than
// a slower way of writing `legacy`.
//
// `lifecycle_stage`'s schema enum names eight stages: idea, startup,
// growth, expansion, maturity, decline, transformation, legacy. This
// file drives four of them. The other four — growth, expansion,
// maturity, transformation — are judgments about scale and strategy
// nothing in this engine measures, and inventing a size threshold for
// "growth" would be standing rule 12's third clause with a business
// plan attached. Left unwired rather than given invented coefficients,
// the same treatment system 36's CITY DNA gives its other seven
// dimensions.

'use strict';

const { seededDraw } = require('./seeded.js');
const economy = require('./economy.js');
const membership = require('./membership.js');
const occupations = require('./occupations.js');

// A founder's own savings against the market's real going wage, not a
// flat invented figure — flagged interpretive, same discipline
// `investments.DIVIDEND_RATE_PER_TICK` carries.
const STARTUP_CAPITAL_WAGE_MULTIPLE = 10;

// Per eligible person per tick. `migration.MOVE_CHANCE` (0.02, gating a
// much more common decision) is the nearest precedent for "how often
// does a rare personal choice happen"; founding a business is rarer
// than moving house, so this sits an order of magnitude under it.
const FOUNDING_CHANCE_PER_TICK = 0.0008;

// Ticks a business can sit fully unstaffed and unable to afford anyone
// before it is written off rather than left an empty shell forever. A
// tick is a day (`behavior.js`) — this is a month.
const LEGACY_AFTER_TICKS = 30;

// ---------------------------------------------------------------------
// Derived figures — never stored, same reason families.wealth is not
// ---------------------------------------------------------------------

function revenueOf(org) {
  return Number(org?.income) || 0;
}

function profitOf(org) {
  return (Number(org?.income) || 0) - (Number(org?.expenses) || 0);
}

// The real, named occupation its employment history actually shows —
// the most recent position anybody has held there, not a label from a
// list nobody specified. Null for a business that has never had a
// position on record (every one of its hires drew no occupation,
// which only happens for an organization type `occupations.js` has
// nothing for).
function industryOf(worldState, organizationId) {
  const records = (worldState.employmentRecords || []).filter(
    (r) => r.employer_organization_id === organizationId && r.position,
  );
  if (records.length === 0) return null;
  const latest = records[records.length - 1];
  return occupations.definitionOf(latest.position)?.source ?? null;
}

// This business's income against every business's, world-wide. Null
// with no denominator, same convention `statistics.js` uses throughout
// for "the substrate cannot answer this" rather than a fabricated 0.
function marketShareOf(worldState, organizationId) {
  const businesses = (worldState.organizations || []).filter((o) => o.type === 'business');
  const total = businesses.reduce((sum, o) => sum + revenueOf(o), 0);
  if (total <= 0) return null;
  const mine = businesses.find((o) => o.id === organizationId);
  if (!mine) return null;
  return revenueOf(mine) / total;
}

// ---------------------------------------------------------------------
// Formation
// ---------------------------------------------------------------------

function foundBusiness(worldState, options = {}) {
  const {
    founderId, name, tick = worldState.tick ?? 0, generateOrganization,
  } = options;

  if (!founderId) throw new Error('foundBusiness requires a founderId');
  if (!name) throw new Error('foundBusiness requires a name');
  if (typeof generateOrganization !== 'function') {
    throw new Error(
      'foundBusiness requires options.generateOrganization (engine.generateOrganization), '
      + 'so this module does not have to require engine.js and close a cycle.',
    );
  }

  const founder = (worldState.npcs || []).find((n) => n.id === founderId);
  if (!founder) throw new Error(`foundBusiness: no entity ${founderId}`);

  const wage = economy.goingWage(worldState, null);
  const capital = Math.round((wage ?? 0) * STARTUP_CAPITAL_WAGE_MULTIPLE);
  const finances = economy.getLatestFinances(worldState, founderId);
  const savings = Number(finances?.savings ?? 0);
  if (!(capital > 0) || savings < capital) {
    throw new Error(
      `foundBusiness: entity ${founderId} has ${savings} savings, needs ${capital}`,
    );
  }

  const organization = generateOrganization({
    name, type: 'business', founderId, leaderId: founderId,
  });
  organization.assets = capital;
  organization.lifecycleStage = 'idea';
  organization.vacantSinceTick = null;

  economy.generateIndividualFinances(worldState, founderId, {
    income: finances?.income ?? 0,
    savings: savings - capital,
    debt: finances?.debt ?? 0,
    assets: finances?.assets ?? 0,
    tick,
  });

  // **Most working-age people in a running world already hold a job**
  // — measured, 100 of 103 at tick 50 on a fresh world, because
  // `economy.runLabour` keeps the market close to saturated. Requiring
  // an unemployed founder, this file's first version, made founding
  // depend on the one or two people the labour market happened to have
  // spat out — nearly always nobody. A founder who already works quits
  // that job to open their own, the same way a person actually starts
  // a business; `economy.hireEntity` refuses anybody still under an
  // active contract, so this has to come before it.
  if (economy.getEmployment(worldState, founderId)) {
    economy.endEmployment(worldState, { entityId: founderId });
  }

  // The founder's own first job, at their own company — see the header.
  const position = occupations.drawOccupation({
    npc: founder,
    worldState,
    organizationType: 'business',
    seed: worldState.seed ?? 'world',
    extra: [organization.id, 'founding'],
  });
  economy.hireEntity(worldState, {
    entityId: founderId,
    employerOrganizationId: organization.id,
    wage: Math.max(1, Math.round(wage)),
    position,
    tick,
  });
  membership.joinOrganization(worldState, {
    entityId: founderId, organizationId: organization.id, role: 'employee', tick,
  });
  organization.lifecycleStage = 'startup';

  return organization;
}

// Not filtered on employment — see `foundBusiness`'s header: most of
// this engine's working-age population already holds a job, and
// founding quits it rather than requiring it to be empty first.
function eligibleFounders(worldState, tick) {
  return (worldState.npcs || []).filter((npc) => {
    if (npc.status === 'imprisoned') return false;
    const age = (tick - (npc.createdTick ?? 0)) / 365;
    return age >= economy.WORKING_AGE;
  });
}

// One tick of people deciding whether to open a business. Runs in the
// Organization phase — after the Economy phase has settled this tick's
// wages, so `economy.goingWage` reflects what the market is actually
// paying today rather than last tick's figure.
function runBusinessFormation(worldState, tick, options = {}) {
  const { generateOrganization } = options;
  const events = [];
  if (typeof generateOrganization !== 'function') return { events, founded: 0 };

  const wage = economy.goingWage(worldState, null);
  if (wage === null) return { events, founded: 0 };
  const capital = Math.round(wage * STARTUP_CAPITAL_WAGE_MULTIPLE);
  if (!(capital > 0)) return { events, founded: 0 };

  const seed = worldState.seed ?? 'world';
  let founded = 0;

  const candidates = eligibleFounders(worldState, tick)
    .filter((npc) => Number(economy.getLatestFinances(worldState, npc.id)?.savings ?? 0) >= capital)
    .sort((a, b) => a.id - b.id);

  for (const npc of candidates) {
    if (seededDraw([seed, 'found-business', tick, npc.id]) >= FOUNDING_CHANCE_PER_TICK) continue;
    const organization = foundBusiness(worldState, {
      founderId: npc.id,
      name: `${npc.name ?? `Entity ${npc.id}`}'s business`,
      tick,
      generateOrganization,
    });
    founded += 1;
    events.push({
      type: 'business_founded',
      severity: 'low',
      note: `Entity ${npc.id} founded ${organization.name} with ${capital} in startup capital`,
      tick,
      affected_entity_ids: [npc.id],
      global_effects: { organizationId: organization.id, capital },
    });
  }

  return { events, founded };
}

// ---------------------------------------------------------------------
// Failure, and the one rescue a staffless business gets each tick
// ---------------------------------------------------------------------

// The same test `economy.runLabour` applies to a business that already
// has staff — productivity clears its own wage — applied here to the
// one case that loop structurally cannot reach: an employer with
// nobody on payroll. Duplicated rather than shared, because
// `runLabour`'s applicant pool is sorted and consumed across every
// employer in one pass and splitting one employer's hire out of that
// would change what the ordinary pass sees this tick.
function attemptRescueHire(worldState, org, tick) {
  const wage = economy.goingWage(worldState, null);
  if (wage === null || !(Number(org.assets) >= wage)) return null;

  const employed = new Set((worldState.employmentRecords || [])
    .filter((r) => r.status === 'active')
    .map((r) => r.entity_id));
  const candidates = (worldState.npcs || []).filter((npc) => {
    if (employed.has(npc.id)) return false;
    if (npc.status === 'imprisoned') return false;
    const age = (tick - (npc.createdTick ?? 0)) / 365;
    if (!(age >= economy.WORKING_AGE)) return false;
    return economy.productivityOf(worldState, npc.id) >= economy.BREAK_EVEN_PRODUCTIVITY;
  });
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => (
    economy.productivityOf(worldState, b.id) - economy.productivityOf(worldState, a.id)
  ) || a.id - b.id);
  const applicant = candidates[0];

  const position = occupations.drawOccupation({
    npc: applicant,
    worldState,
    organizationType: 'business',
    seed: worldState.seed ?? 'world',
    extra: [org.id, tick, 'rescue'],
  });
  economy.hireEntity(worldState, {
    entityId: applicant.id,
    employerOrganizationId: org.id,
    wage: Math.round(wage),
    position,
    tick,
  });
  membership.joinOrganization(worldState, {
    entityId: applicant.id, organizationId: org.id, role: 'employee', tick,
  });
  return applicant;
}

// One tick of the lifecycle. Runs after `runBusinessFormation` in the
// same Organization-phase pass, so a business founded this very tick
// is seen with its founder already on staff and is never mistaken for
// one that opened empty.
function advanceBusinessLifecycle(worldState, tick) {
  const events = [];

  for (const org of worldState.organizations || []) {
    if (org.type !== 'business') continue;

    // A business from before this module existed, or founded directly
    // by `worldgen` rather than through `foundBusiness` — every one of
    // those is staffed at generation (see `worldgen.js`'s institution
    // pass), so `startup` is the honest label, not `idea`.
    if (!org.lifecycleStage) org.lifecycleStage = 'startup';

    if (org.lifecycleStage === 'legacy') continue;

    const activeStaff = (worldState.employmentRecords || []).filter(
      (r) => r.status === 'active' && r.employer_organization_id === org.id,
    ).length;

    if (activeStaff > 0) {
      if (org.lifecycleStage === 'decline') {
        org.lifecycleStage = 'startup';
        events.push({
          type: 'business_recovered',
          severity: 'low',
          note: `${org.name} is staffed again`,
          tick,
          affected_entity_ids: [],
          global_effects: { organizationId: org.id },
        });
      }
      org.vacantSinceTick = null;
      continue;
    }

    if (org.lifecycleStage === 'idea') continue;

    const rescued = attemptRescueHire(worldState, org, tick);
    if (rescued) {
      org.lifecycleStage = 'startup';
      org.vacantSinceTick = null;
      events.push({
        type: 'business_recovered',
        severity: 'low',
        note: `${org.name} could still afford to hire and took on entity ${rescued.id}`,
        tick,
        affected_entity_ids: [rescued.id],
        global_effects: { organizationId: org.id },
      });
      continue;
    }

    // `== null` on purpose: a business that has never been staffless
    // before has no `vacantSinceTick` field at all (`undefined`), not a
    // `null` one, and a strict check would silently skip starting the
    // clock on it.
    if (org.vacantSinceTick == null) org.vacantSinceTick = tick;
    if (org.lifecycleStage !== 'decline') {
      org.lifecycleStage = 'decline';
      events.push({
        type: 'business_declined',
        severity: 'moderate',
        note: `${org.name} has no staff left and could not hire anyone`,
        tick,
        affected_entity_ids: [],
        global_effects: { organizationId: org.id },
      });
    }

    if (tick - org.vacantSinceTick >= LEGACY_AFTER_TICKS) {
      org.lifecycleStage = 'legacy';
      events.push({
        type: 'business_closed',
        severity: 'moderate',
        note: `${org.name} closed — ${LEGACY_AFTER_TICKS} ticks with no staff and not enough to hire anyone`,
        tick,
        affected_entity_ids: [],
        global_effects: { organizationId: org.id },
      });
    }
  }

  return events;
}

module.exports = {
  STARTUP_CAPITAL_WAGE_MULTIPLE,
  FOUNDING_CHANCE_PER_TICK,
  LEGACY_AFTER_TICKS,
  revenueOf,
  profitOf,
  industryOf,
  marketShareOf,
  foundBusiness,
  runBusinessFormation,
  attemptRescueHire,
  advanceBusinessLifecycle,
};
