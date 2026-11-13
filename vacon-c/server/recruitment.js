// server/recruitment.js
//
// Chaos-driven recruitment, by direct instruction: "once the chaos
// starts to erupt, there will be a lot of recruitment and added
// members for safety. This will depend on the characteristics of
// people that they encounter. These things should be put into our
// statistics as organizations, gangs, tribes, families grow."
//
// ---------------------------------------------------------------------
// No invented threshold — the real danger score IS the rate
// ---------------------------------------------------------------------
// The seventeenth standing rule's own four-attempt lesson on
// `keys.resolveAggression`'s escalation floor is the reason this file
// has no "chaos has erupted" cutoff at all: a hard gate rolled every
// tick against a real, moving measure is exactly the failure mode
// that cost four attempts there (a snapshot percentile does not
// survive repeated sampling). `crime.dangerByCommunity`'s own real
// 0..1 score scales a flat base rate directly instead — zero danger
// means zero extra recruitment pressure, and a genuinely chaotic,
// long-run area produces a real, continuously-scaling one, with
// nothing here to separately calibrate.
//
// `BASE_RECRUITMENT_RISK` is a multiple of an already-justified real
// constant, not an invented one — the same documentation discipline
// `influence.js`'s own `IMMEDIATE_FAMILY_BOND_BONUS` already holds,
// naming its figure as a multiple of `INFLUENCE_DELTA` rather than a
// bare number. `crime.BASE_DEPRIVATION_RISK` (0.0006) is this
// engine's own real reference for "a flat per-person-per-tick
// pressure," already measured and held steady since the thirteenth
// standing rule's own famine-ratchet fix; ten times that is this
// file's real rate, named as a multiple of that constant so a future
// reader can see exactly where it came from rather than defend it on
// its own.
//
// Measured once, on a small 150-person/5-community/200-tick generated
// world (`danger-measure-2`, this file's own development note, not
// re-run automatically here): real `dangerByCommunity` values ran
// 0.048 to 0.190, mean 0.118 — a thin sample (5 real crime incidents
// total), reported honestly as thin rather than treated as a settled
// population statistic. At that measured ceiling, this file's own
// rate produces roughly a 0.00114 chance per eligible (gang,
// community) pair per tick — modest in a quiet world, and it only
// grows with the real chaos that is actually happening, never with a
// second number tuned to make it feel right.
const crime = require('./crime.js');

// No cycle to avoid here — unlike `ensurePrisonGang`'s own
// `require('./engine.js')` inside the function (justice.js. sits
// behind a real cycle through `tick.js`), `crime.js` does not require
// this file back, so a plain top-level require is the real, simplest
// answer.
const BASE_RECRUITMENT_RISK = crime.BASE_DEPRIVATION_RISK * 10;

const membership = require('./membership.js');
const influence = require('./influence.js');
const worldStore = require('./worldStore.js');
const { seededDraw } = require('./seeded.js');

// ---------------------------------------------------------------------
// Scope: real gangs only — tribes and families are a real, named,
// NOT-closed gap, not a silent omission
// ---------------------------------------------------------------------
// `membership.organizationPresence`'s own `isGang` flag (type 'gang'
// OR a real faction) is the only group shape in this engine an NPC
// actually JOINS through a real, already-built mechanism
// (`membership.joinOrganization`). `characterCreation.js`'s real
// extended-family generation (aunts/uncles/cousins) and the
// `families` table itself have no equivalent "a stranger joins this
// family" mechanism anywhere in this engine — family membership is
// fixed at birth or at `addFamilyMember`-time generation, never
// recruited into after the fact. Building one here would be
// fabricating a family-adoption mechanic nobody asked for in order to
// answer a word in the request ("tribes, families") that this
// engine's own real substrate does not yet support — named here as
// the honest, open gap for a future round, the same posture
// `worldgen.js`'s prison-operator fix just took for every OTHER hero
// landmark category it did not also fix.

// Real residents of a community who are not already a member of this
// organization and are not currently behind bars — the one filter
// `membership.organizationPresence`'s own resident count does not
// apply, because recruiting someone who is physically imprisoned onto
// the street is not a real possibility this engine should model as
// one.
function eligibleCandidates(worldState, organizationId, communityId) {
  const memberIds = new Set(
    (worldState.entityOrganizationMemberships || [])
      .filter((m) => m.organization_id === organizationId)
      .map((m) => m.entity_id),
  );
  return (worldState.npcs || []).filter(
    (n) => n.communityId === communityId && n.status !== 'imprisoned' && !memberIds.has(n.id),
  );
}

// One real chaos-driven recruitment pass over every community with a
// real, measured danger score and at least one real gang already
// present there (`organizationPresence`, never a gang invented for
// this pass). For each such (gang, community) pair, a single real
// seeded draw, scaled by that community's own real danger score,
// decides WHETHER a recruitment happens this tick; WHO is recruited
// is never that same draw — it is the real, already-eligible resident
// with the highest `influence.influenceRatingOf`, the literal
// "depending on the characteristics of people that they encounter"
// the instruction asked for. The same split `ensurePrisonGang`'s own
// deterministic-leader pick already makes between "is there a draw to
// make" and "who wins it" once there is one.
function runChaosRecruitment(worldState, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const danger = crime.dangerByCommunity(worldState, { tick });
  const recruited = [];

  for (const community of worldState.communities || []) {
    // Unmeasured (null) and genuinely quiet (0) both skip — an area
    // nobody has any real crime data for is not "chaotic by default,"
    // the identical reading `dangerByCommunity`'s own header already
    // gives this value everywhere else it is read.
    const dangerScore = danger.get(community.id);
    if (!dangerScore) continue;

    const presentGangs = membership.organizationPresence(worldState, community.id)
      .filter((row) => row.isGang);

    for (const row of presentGangs) {
      const organization = (worldState.organizations || []).find((o) => o.id === row.organizationId);
      if (!organization) continue;

      const chance = BASE_RECRUITMENT_RISK * dangerScore;
      const draw = seededDraw([organization.id, community.id, tick, 'chaos-recruitment']);
      if (draw >= chance) continue;

      const candidates = eligibleCandidates(worldState, organization.id, community.id);
      if (candidates.length === 0) continue;

      let best = candidates[0];
      let bestScore = influence.influenceRatingOf(worldState, best.id);
      for (const candidate of candidates.slice(1)) {
        const score = influence.influenceRatingOf(worldState, candidate.id);
        if (score > bestScore) { best = candidate; bestScore = score; }
      }

      membership.joinOrganization(worldState, { entityId: best.id, organizationId: organization.id, tick });

      // In-memory only, the same posture `worldState.prisonGangs`/
      // `worldState.streetAffiliates` already carry — no schema
      // column exists for a recruitment EVENT log, only for the
      // membership row itself, and this is the real source the
      // statistic below computes over rather than a second, stored
      // rollup (standing rule 3).
      worldState.chaosRecruitmentEvents = worldState.chaosRecruitmentEvents || [];
      worldState.chaosRecruitmentEvents.push({
        organizationId: organization.id, communityId: community.id, entityId: best.id, tick,
      });

      worldStore.addHistoricalRecord(worldState, {
        event_type: 'chaos_recruitment',
        description: `${organization.name} recruits a new member`
          + `${community.name ? ` in ${community.name}` : ''}, where real danger reads `
          + `${dangerScore.toFixed(2)}`,
        when_tick: tick,
        participants: [best.id],
        where_location_id: null,
      });

      recruited.push({ organizationId: organization.id, communityId: community.id, entityId: best.id });
    }
  }

  return recruited;
}

// Every real chaos-recruitment event ever recorded for one community
// — the real growth-over-time figure the instruction asked be put
// into statistics, computed from the log above rather than a second,
// disagreeing counter (standing rule 3).
function recruitmentEventsFor(worldState, communityId) {
  return (worldState.chaosRecruitmentEvents || []).filter((e) => e.communityId === communityId);
}

module.exports = {
  BASE_RECRUITMENT_RISK,
  eligibleCandidates,
  runChaosRecruitment,
  recruitmentEventsFor,
};
