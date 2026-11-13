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
const mortality = require('./mortality.js');
const characterCreation = require('./characterCreation.js');
const { seededDraw } = require('./seeded.js');

// No cycle to check here, unlike `justice.js`'s own `ensurePrisonGang`
// needing a lazy, in-function `require('./engine.js')`: `mortality.js`
// and `characterCreation.js` both sit outside the `engine.js` →
// `tick.js` → `recruitment.js` loop that forces that one lazy — neither
// requires `tick.js`, `engine.js`, or this file back.

// ---------------------------------------------------------------------
// Scope at this section: real gangs only — see this file's own
// "Families/tribes" section, below `runChaosRecruitment`, for what
// closes the tribes/families half and what stays a real, named,
// narrower gap even there
// ---------------------------------------------------------------------
// `membership.organizationPresence`'s own `isGang` flag (type 'gang'
// OR a real faction) is the only group shape in this engine an NPC
// actually JOINS as a STRANGER, through a real, already-built
// mechanism (`membership.joinOrganization`). `characterCreation.js`'s
// real extended-family generation (aunts/uncles/cousins) and the
// `families` table itself have no equivalent "an unrelated stranger
// joins this family" mechanism anywhere in this engine, and none is
// built here either — family membership for a stranger stays fixed at
// birth or at `addFamilyMember`-time generation, never recruited into
// after the fact. What the "Families/tribes" section below closes is
// narrower and real: kinship absorbing an already-orphaned CHILD, not
// a stranger joining as a peer, which is this engine's own real
// family-side analogue of what a gang does with a stranger rather than
// a copy of the gang mechanism's own shape.

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

// ---------------------------------------------------------------------
// Families/tribes: the gap the section above named is now closed, at
// exactly the width this engine's real substrate actually supports
// ---------------------------------------------------------------------
// The scope note above is still correct as written: there is no "a
// stranger joins this family" mechanism, and none is built here
// either. What this closes is narrower and real — kinship absorbing an
// already-orphaned child during local danger, the direct family-side
// analogue of a gang absorbing a vulnerable stranger. "Tribe" needs no
// separate mechanism of its own: `engine.tribeIdFor` already reads a
// tribe straight off `family_memberships` (see that function's own
// comment), so "tribes, families" in the original instruction names
// one real engine concept twice, not two.
//
// **Why this reads birth records, not `family_memberships.role`.**
// The obvious design is "find family members with role 'parent', check
// if they're alive" — and it was tried first here, against a real
// generated world, and measured to be permanently empty. `worldgen.js`
// assigns every ordinary NPC's own family role a flat `'member'`
// (line ~1268/1547, the forty-ninth standing rule's own finding), and
// `births.js` gives a NEWBORN role `'child'` but never relabels the
// bearing parent `'parent'` — so `familyMembersWithRole(..., 'parent')`
// returns empty for every family in every world this engine has ever
// generated, the sixth standing rule's own trap in a new place. The
// real place a child's parent is recorded is `births.js`'s own birth
// record (`historicalRecords` entry, `what: 'birth'`, `who: [child,
// bearer, other?]` — that file's own comment: "the only place a
// parent's identity is stored"). `parentIdsOf` reads that instead.
//
// **Real, honest, named scope limit this creates**: only a child who
// was actually BORN during this simulation (via `births.js`) can ever
// be detected as an orphan here, because only such a child has a real
// birth record to read a parent's identity from. An NPC present from
// initial world generation has no birth record and is never a
// candidate — not a silent gap, the identical honest-ceiling posture
// `PARENT_DECEASED_CHANCE`'s own one-time character-creation draw
// already holds for a different mechanism entirely.
function parentIdsOf(worldState, childId) {
  const birthRecord = (worldState.historicalRecords || [])
    .find((r) => r.what === 'birth' && Array.isArray(r.who) && r.who[0] === childId);
  if (!birthRecord) return null;
  return birthRecord.who.slice(1);
}

const ADULT_AGE_YEARS = 18;

// A minor with a real, recorded birth parent, none of whom are among
// the living. `parentIds === null` (no birth record at all) and an
// empty `parentIds` array are both "not a modeled orphan case," not
// "orphaned" — the sixth standing rule's own lesson about not reading
// a missing fact as a zero.
function isOrphan(worldState, npc) {
  const age = mortality.ageInYears(worldState, npc);
  if (age === null || age >= ADULT_AGE_YEARS) return false;
  const parentIds = parentIdsOf(worldState, npc.id);
  if (!parentIds || parentIds.length === 0) return false;
  const livingIds = new Set((worldState.npcs || []).map((n) => n.id));
  return parentIds.every((pid) => !livingIds.has(pid));
}

// Already absorbed once: this engine gives nobody a second real
// `family_memberships` row through any other path (a cousin/aunt/uncle
// is cross-linked via a `relationships` row instead, never a second
// membership row on the SAME entity — `characterCreation.js`'s own
// `cousinsThroughParent` reads it that way), so more than one row for
// this entity can only mean this pass already ran for them.
function alreadyAbsorbed(worldState, entityId) {
  return (worldState.familyMemberships || []).filter((m) => m.entity_id === entityId).length > 1;
}

function communityHasLivingMember(worldState, familyId, communityId) {
  const memberIds = new Set(
    (worldState.familyMemberships || [])
      .filter((m) => m.family_id === familyId)
      .map((m) => m.entity_id),
  );
  return (worldState.npcs || []).some((n) => memberIds.has(n.id) && n.communityId === communityId);
}

// Real candidate families to absorb an orphan: present (a living
// member actually resides here — never the orphan's own community by
// label alone) in the real community, excluding the orphan's own
// family (re-absorbing into the family that already counts them would
// not be the real growth the instruction asked be measured).
function absorbingFamilyCandidates(worldState, communityId, excludeFamilyId) {
  return (worldState.families || [])
    .filter((f) => f.id !== excludeFamilyId && communityHasLivingMember(worldState, f.id, communityId));
}

// The real family-side "characteristics of the people that they
// encounter": `families.unity` is this engine's own already-real,
// already-written measure of how well a household actually holds
// together (`control.js#cohesionOf`'s own real substrate) — the
// family-level parallel to picking a gang's recruit by the highest
// `influence.influenceRatingOf`, not a second invented score. Tie
// broken on the lower real id, the same deterministic-pick shape
// `justice.js#ensurePrisonGang`'s own leader draw already uses.
function bestAbsorbingFamily(candidates) {
  let best = candidates[0];
  for (const candidate of candidates.slice(1)) {
    if (candidate.unity > best.unity || (candidate.unity === best.unity && candidate.id < best.id)) {
      best = candidate;
    }
  }
  return best;
}

// The real write, direct on the passed `worldState` — mirroring
// `engine.addFamilyMember`'s own field semantics exactly, but never
// calling through it. `engine.addFamilyMember` mutates `engine.
// WorldState`'s own family object by reference; a constructed test
// fixture's `worldState.families` entry is deliberately a DIFFERENT
// object with the same id (standing rule 8), and `justice.js#
// ensurePrisonGang`'s own header already names exactly this hazard for
// `generateOrganization`/`generateFaction`. `membership.
// joinOrganization` in this same file's own sibling module never
// routes through `engine.js` for the identical reason — this follows
// that real, already-established precedent rather than the
// reconcile-after-the-fact one `ensurePrisonGang` needed because IT
// had no choice but to call through `engine.js` for trait generation.
// This call needs no trait generation at all, so it has the choice,
// and takes it.
function absorbIntoFamily(worldState, { familyId, entityId, role, generationNumber }) {
  const family = (worldState.families || []).find((f) => f.id === familyId);
  if (!family) throw new Error(`absorbIntoFamily: no family with id ${familyId}`);
  const membershipRow = {
    entity_id: entityId,
    family_id: familyId,
    role: role ?? null,
    generation_number: generationNumber ?? family.generation,
  };
  worldState.familyMemberships = worldState.familyMemberships || [];
  worldState.familyMemberships.push(membershipRow);
  family.total_members = (family.total_members ?? 0) + 1;
  family.updatedTick = worldState.tick;
  return membershipRow;
}

// One real chaos-driven family-absorption pass, same real danger-
// scaled rate as `runChaosRecruitment` above (`BASE_RECRUITMENT_RISK`
// reused, not a second invented constant needing its own defence —
// the real mechanism differs in WHO is eligible and WHO receives them,
// not in how chaotic the area has to be for either to happen at all).
function runChaosFamilyAbsorption(worldState, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const danger = crime.dangerByCommunity(worldState, { tick });
  const absorbed = [];

  for (const community of worldState.communities || []) {
    const dangerScore = danger.get(community.id);
    if (!dangerScore) continue;

    const orphans = (worldState.npcs || []).filter(
      (n) => n.communityId === community.id && isOrphan(worldState, n) && !alreadyAbsorbed(worldState, n.id),
    );

    for (const orphan of orphans) {
      const ownFamilyId = characterCreation.familyIdFor(worldState, orphan.id);
      const candidates = absorbingFamilyCandidates(worldState, community.id, ownFamilyId);
      if (candidates.length === 0) continue;

      const chance = BASE_RECRUITMENT_RISK * dangerScore;
      const draw = seededDraw([orphan.id, community.id, tick, 'chaos-family-absorption']);
      if (draw >= chance) continue;

      const family = bestAbsorbingFamily(candidates);
      absorbIntoFamily(worldState, {
        familyId: family.id, entityId: orphan.id, role: 'child', generationNumber: family.generation,
      });

      worldState.chaosFamilyAbsorptionEvents = worldState.chaosFamilyAbsorptionEvents || [];
      worldState.chaosFamilyAbsorptionEvents.push({
        familyId: family.id, communityId: community.id, entityId: orphan.id, tick,
      });

      worldStore.addHistoricalRecord(worldState, {
        event_type: 'chaos_family_absorption',
        description: `the ${family.surname} family takes in an orphaned child`
          + `${community.name ? ` in ${community.name}` : ''}, where real danger reads `
          + `${dangerScore.toFixed(2)}`,
        when_tick: tick,
        participants: [orphan.id],
        where_location_id: null,
      });

      absorbed.push({ familyId: family.id, communityId: community.id, entityId: orphan.id });
    }
  }

  return absorbed;
}

// The real growth-over-time figure for `statistics.js`'s own
// `tribe_family_recruitment_growth` entry — the same
// read-the-log-rather-than-a-second-counter shape
// `recruitmentEventsFor` above already takes (standing rule 3).
function familyAbsorptionEventsFor(worldState, communityId) {
  return (worldState.chaosFamilyAbsorptionEvents || []).filter((e) => e.communityId === communityId);
}

module.exports = {
  BASE_RECRUITMENT_RISK,
  eligibleCandidates,
  runChaosRecruitment,
  recruitmentEventsFor,
  parentIdsOf,
  isOrphan,
  runChaosFamilyAbsorption,
  familyAbsorptionEventsFor,
};
