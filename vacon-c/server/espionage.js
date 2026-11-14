// server/espionage.js
//
// By direct instruction: "gangs, organizations, tribes, drug
// organizations, gangs, families can send out a listener or spy to
// get information in the neighborhood. Multiple spies, however,
// whatever they want to do. The person who is... the better they are
// at listening, infiltrating, spying, is the more information they
// will come back with... you can choose a range if you want them to
// watch from close range, mid-range, far away. And you can organize
// how they infiltrate. You can tell them keep a close eye, don't be
// seen, infiltrate the whole organization."
//
// ---------------------------------------------------------------------
// Who sends a spy: the identical real authority `assignRole` already
// established, reused rather than duplicated
// ---------------------------------------------------------------------
// "Tribe, organization, delegation" — `leadership.js`'s own eighty-
// third standing rule already generalized Leader mode's directive
// across both real seats of authority this engine has
// (`organizations.leader_id`, `families.head_npc_id`), with compliance
// gated on the subordinate's own real `relationships.loyalty`. A spy
// is sent, not self-dispatched, so this reuses that exact seat-of-
// authority check and `leadership.complianceDraw` directly — a
// reluctant member can refuse a risky spying assignment the same way
// they can refuse any other order, never a second, silently different
// cutoff for the identical kind of question.
//
// ---------------------------------------------------------------------
// "The better they are at listening, infiltrating, spying" — a real
// composite, the `influenceRatingOf` shape applied to a new question
// ---------------------------------------------------------------------
// `criminal.Stealth` (not being seen) and `criminal.Deception`
// (holding a cover) are both generated on every NPC and already read
// elsewhere in this engine (`bluff.js`, `policing.evasionOf`) for the
// identical kind of question — can this person avoid notice. `social.
// 'Network Reach'` is the real substrate for "plugging into gossip
// lines" the user's own words describe elsewhere in the same message
// (word-of-mouth is already real — see `media.js`'s own
// `word_of_mouth` channel, which this file deliberately does not
// duplicate: that channel is how ordinary facts already spread to
// everybody; a sponsored spy is a targeted, directed, risk-bearing
// action against one specific place, a different kind of event).
// Weighted to sum to 1.0, the same discipline `influenceRatingOf`
// already holds, never a second, disagreeing composite invented here.
//
// ---------------------------------------------------------------------
// Range and stance: the user's own three words each, not six invented
// ones
// ---------------------------------------------------------------------
// "Close range, mid-range, far away" is `RANGES`. "Keep a close eye,
// don't be seen, infiltrate the whole organization" is `STANCES` —
// `close_watch`, `low_profile`, `deep_infiltration` respectively.
// Closer range and deeper infiltration both raise detection risk and
// raise how much the spy can plausibly learn; `low_profile` trades
// yield for safety on purpose, because "don't be seen" is explicitly
// a caution, not a request for more detail.
//
// ---------------------------------------------------------------------
// What a spy can actually bring back — real substrate this engine
// already has, never a second information model
// ---------------------------------------------------------------------
// `dominance.dominantOrganizationOf` and `authority.writOf` already
// answer "who runs this place and how far does the state's own writ
// reach it" — exactly what a listener sent into a neighbourhood would
// come back with. `deep_infiltration` against a NAMED target
// organization additionally reads that organization's own real,
// already-public-ish facts (`leader_id`, `influence`, `isFaction`,
// real member count) — never its private finances or anything this
// engine has no mechanism for an outsider to actually observe.
//
// ---------------------------------------------------------------------
// Getting caught: a real, narrow trigger, not a reopening of heat.js's
// own declared scope
// ---------------------------------------------------------------------
// `heat.js`'s own header is explicit that faction heat rises only when
// a faction actually ACTS on an offence (`justice.answerByGroup`),
// never from a passive, omniscient awareness of crime in its own
// territory. This is a different, narrower event than the one that
// header declines: a spy detection is not the target organization
// noticing a crime happened somewhere in its own ground — it is the
// target organization directly, personally catching the specific
// person it was infiltrated by. `heat.raiseHeat` is reused with its
// own default amount (`heat.HEAT_GAIN`), the identical real magnitude
// `justice.js` already assigns to the equivalent "a faction dealt with
// you and it mattered" event on the other side of it — never a second,
// different number invented for what is structurally the same thing.
//
// ---------------------------------------------------------------------
// "NPCs become main characters... through their actions and usage"
// ---------------------------------------------------------------------
// See `leadership.js#recordService`'s own header. A real spy mission
// that returns without being detected records service for the spy,
// the identical real counter `directMission`/`assignRole` already
// write to — not a fourth, disagreeing tracker for the same fact.

'use strict';

const authority = require('./authority.js');
const membership = require('./membership.js');
const dominance = require('./dominance.js');
const heat = require('./heat.js');
const leadership = require('./leadership.js');
const { seededDraw } = require('./seeded.js');
const { getLiveEntity } = require('./entityTraits.js');

const RANGES = ['close', 'mid', 'far'];
const STANCES = ['low_profile', 'close_watch', 'deep_infiltration'];

// Centred on the trait scale's own neutral 50 for anything unmeasured
// — the twelfth standing rule's own discipline, applied to a third
// composite the way `influenceRatingOf` already applies it to the
// first.
function espionageAptitudeOf(worldState, entityId) {
  const live = getLiveEntity(worldState, entityId);
  const stealth = Number(live?.traits?.criminal?.Stealth);
  const deception = Number(live?.traits?.criminal?.Deception);
  const networkReach = Number(live?.traits?.social?.['Network Reach']);
  return 0.4 * (Number.isFinite(stealth) ? stealth : 50)
    + 0.3 * (Number.isFinite(deception) ? deception : 50)
    + 0.3 * (Number.isFinite(networkReach) ? networkReach : 50);
}

// Flagged interpretive, the same posture every other hand-fitted band
// in this engine declares rather than hides: no document gives real
// numbers for how much range or stance should move detection risk, so
// these are chosen to produce the real, stated ORDERING the user asked
// for (closer and deeper is riskier) rather than fitted against a
// measured population the way a calibrated constant like
// `crime.DANGER_REFERENCE_PER_1K` was.
const RANGE_RISK = { close: 0.5, mid: 0.3, far: 0.12 };
const STANCE_RISK = { low_profile: -0.1, close_watch: 0, deep_infiltration: 0.25 };
const STANCE_YIELD = { low_profile: 0.6, close_watch: 1, deep_infiltration: 1.4 };

// Aptitude centred on 50 scales the base risk down as skill rises
// above average and up as it falls below — standing rule 12's own
// "centre on the average person" discipline, applied to a risk term
// instead of a modifier. Bounded so a flawless spy is still not
// literally undetectable and a hopeless one is not a certainty.
function detectionChanceFor(aptitude, range, stance) {
  const base = RANGE_RISK[range] + STANCE_RISK[stance];
  const scaled = base * (1 - (aptitude - 50) / 100);
  return Math.max(0.02, Math.min(0.9, scaled));
}

function sendSpy(worldState, sponsorEntityId, options = {}) {
  const {
    organizationId = null, familyId = null, spyEntityId, targetCommunityId,
    targetOrganizationId = null, range = 'mid', stance = 'close_watch',
    tick = worldState.tick ?? 0,
  } = options;

  if (spyEntityId == null) throw new Error('sendSpy requires spyEntityId.');
  if (targetCommunityId == null) throw new Error('sendSpy requires targetCommunityId.');
  if (!RANGES.includes(range)) {
    throw new Error(`sendSpy: "${range}" is not a real range. The three are: ${RANGES.join(', ')}.`);
  }
  if (!STANCES.includes(stance)) {
    throw new Error(`sendSpy: "${stance}" is not a real stance. The three are: ${STANCES.join(', ')}.`);
  }
  const spyId = Number(spyEntityId);
  if (spyId === Number(sponsorEntityId)) {
    throw new Error('sendSpy: a sponsor cannot send themselves -- that is just going to look.');
  }
  const spy = (worldState.npcs || []).find((n) => n.id === spyId);
  if (!spy) throw new Error(`sendSpy: ${spyId} is not among the living.`);
  const community = (worldState.communities || []).find((c) => c.id === Number(targetCommunityId));
  if (!community) throw new Error(`sendSpy: no community with id ${targetCommunityId}.`);
  if ((organizationId == null) === (familyId == null)) {
    throw new Error('sendSpy requires exactly one of organizationId or familyId.');
  }

  // The identical real seat-of-authority check `assignRole` already
  // established -- see this file's own header for why it is reused
  // rather than duplicated.
  if (organizationId != null) {
    const organization = (worldState.organizations || [])
      .find((o) => o.id === Number(organizationId));
    if (!organization) throw new Error(`sendSpy: no organization with id ${organizationId}.`);
    if (organization.leader_id !== Number(sponsorEntityId)) {
      throw new Error(
        `sendSpy: entity ${sponsorEntityId} does not lead organization ${organizationId}.`,
      );
    }
    if (!membership.findMembership(worldState, spyId, organization.id)) {
      throw new Error(`sendSpy: entity ${spyId} is not a member of organization ${organization.id}.`);
    }
  } else {
    const family = (worldState.families || []).find((f) => f.id === Number(familyId));
    if (!family) throw new Error(`sendSpy: no family with id ${familyId}.`);
    if (family.head_npc_id !== Number(sponsorEntityId)) {
      throw new Error(`sendSpy: entity ${sponsorEntityId} does not head family ${familyId}.`);
    }
    const inFamily = (worldState.familyMemberships || []).some(
      (m) => m.entity_id === spyId && m.family_id === family.id,
    );
    if (!inFamily) throw new Error(`sendSpy: entity ${spyId} is not a member of family ${familyId}.`);
  }

  const { complied, gatingValue, complianceChance } = leadership.complianceDraw(
    worldState, sponsorEntityId, spyId, 'send-spy', tick,
  );
  if (!complied) {
    return {
      complied: false, spyEntityId: spyId, communityId: community.id, gatingValue, complianceChance,
      report: null, detected: false, caughtBy: null,
    };
  }

  const aptitude = espionageAptitudeOf(worldState, spyId);
  const detectionChance = detectionChanceFor(aptitude, range, stance);
  const detected = seededDraw([
    worldState.seed ?? 'world', 'espionage-detect', spyId, community.id, tick,
  ]) < detectionChance;

  const report = {
    communityId: community.id,
    regime: authority.writOf(worldState, community.id).regime,
    dominantOrganization: dominance.dominantOrganizationOf(worldState, community.id),
  };

  let targetOrganization = null;
  if (targetOrganizationId != null && stance === 'deep_infiltration') {
    const org = (worldState.organizations || []).find((o) => o.id === Number(targetOrganizationId));
    if (org) {
      targetOrganization = {
        organizationId: org.id,
        type: org.type,
        leaderId: org.leader_id,
        influence: org.influence,
        isFaction: org.isFaction === true,
        realMemberCount: membership.memberCount(worldState, org.id),
      };
    }
  }
  if (targetOrganization) report.targetOrganization = targetOrganization;

  const yieldScore = Math.round(aptitude * STANCE_YIELD[stance]);
  const fidelity = yieldScore >= 90 ? 'detailed' : (yieldScore >= 50 ? 'partial' : 'thin');
  report.fidelity = fidelity;

  let caughtBy = null;
  if (detected && targetOrganizationId != null) {
    const org = (worldState.organizations || []).find((o) => o.id === Number(targetOrganizationId));
    if (org) {
      heat.raiseHeat(worldState, { entityId: spyId, factionOrganizationId: org.id });
      caughtBy = org.id;
    }
  }

  if (!detected) leadership.recordService(worldState, spyId);

  return {
    complied: true, spyEntityId: spyId, communityId: community.id, gatingValue, complianceChance,
    aptitude, detectionChance, detected, caughtBy, report,
  };
}

module.exports = {
  RANGES,
  STANCES,
  espionageAptitudeOf,
  detectionChanceFor,
  sendSpy,
};
