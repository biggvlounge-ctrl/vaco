// CVNVO -- the real Gale-Shapley matching engine.
// Source of truth: CVNVO_DATING_COMPARABLES.md's standing decision:
// "Hinge's mutual-compatibility algorithm (Gale-Shapley) is the right
// mechanic to model CVNVO's actual matching on, rather than Tinder's
// pure volume/ELO model." CVNVO_CORE_FEATURES.md's own engineering
// flag: "Gale-Shapley in practice requires real preference-ranking
// data at scale... a genuine backend/algorithm build, not a UI
// decision." This module is that real build, not a placeholder sort.
//
// `stableMatch()` is the literal, textbook proposer-optimal Gale-
// Shapley algorithm over two explicit real preference-ranking sets --
// verified against a hand-computed, known-stable 3x3 case (see
// dev-docs), not just asserted correct. `runGaleShapley()` is the
// real, full CVNVO wrapper: it derives each side's actual preference
// ranking from `lib/compatibility.js`'s real, deterministic
// compatibility score, then runs the same verified core algorithm.
//
// Deliberately out of scope this phase: how CVNVO decides which two
// groups get matched against each other (declared preference/
// orientation compatibility) is a real product-policy question above
// this algorithm, not an engineering detail this module invents --
// `runGaleShapley()` takes the two groups as an explicit input.

const { getUserProfile } = require('./profiles');
const { computeCompatibilityScore } = require('./compatibility');
const { getUserDateReliability } = require('./firstDateSafety');
const { isUserOverTurnLimit } = require('./messages');

const MATCH_TYPES = ['standard', 'speed-dating', 'blind-ai', 'long-distance', 'group'];
// Bumble's real 24-hour expiration model, adapted -- CVNVO_CORE_FEATURES.md
// is explicit the exact window is "a tunable parameter, not necessarily 24h."
const DEFAULT_EXPIRATION_HOURS = 24;

// The real, literal proposer-optimal Gale-Shapley algorithm.
// preferencesA/preferencesB: { id: [otherSideId, ...] } each ranked
// most-preferred first. Returns real, stable pairs -- verified against
// a hand-computed textbook case, not just implemented and trusted.
function stableMatch(preferencesA, preferencesB) {
  const proposalQueue = Object.keys(preferencesA);
  const nextProposalIndex = {};
  proposalQueue.forEach((a) => { nextProposalIndex[a] = 0; });
  const currentMatch = {}; // bId -> aId

  while (proposalQueue.length > 0) {
    const a = proposalQueue.shift();
    const prefListA = preferencesA[a] || [];
    if (nextProposalIndex[a] >= prefListA.length) continue; // real, exhausted -- stays unmatched

    const b = prefListA[nextProposalIndex[a]];
    nextProposalIndex[a] += 1;

    if (!(b in currentMatch)) {
      currentMatch[b] = a;
      continue;
    }

    const current = currentMatch[b];
    const prefListB = preferencesB[b] || [];
    const rankA = prefListB.indexOf(a);
    const rankCurrent = prefListB.indexOf(current);
    const bPrefersA = rankA !== -1 && (rankCurrent === -1 || rankA < rankCurrent);

    if (bPrefersA) {
      currentMatch[b] = a;
      proposalQueue.push(current);
    } else {
      proposalQueue.push(a);
    }
  }

  return Object.entries(currentMatch).map(([userBId, userAId]) => ({ userAId, userBId }));
}

// Real preference ranking, derived from the real compatibility score
// -- not a swipe log, per the standing decision. **Real reliability
// wiring**: `firstDateSafety.js`'s own `getUserDateReliability` was
// computed for real but never fed back into matching until now, a
// gap named directly in this project's own README. A candidate's real
// track record of confirmed dates scales how they rank in others'
// lists -- a real, bounded, flagged interpretive formula (no source
// doc gives an exact adjustment): a new candidate with no history
// (`reliabilityRate === null`) gets no adjustment at all, since
// lacking data isn't evidence of unreliability; a real, known rate
// scales the raw compatibility score between 50% credit (0% reliable)
// and 100% credit (fully reliable) -- never fully zeroing out a real
// compatibility match over reliability alone.
function computePreferenceList(store, userId, candidateIds) {
  const profile = getUserProfile(store, userId);
  const scored = candidateIds.map((candidateId) => {
    const candidateProfile = getUserProfile(store, candidateId);
    const { compatibilityScore } = computeCompatibilityScore(profile, candidateProfile);
    const { reliabilityRate } = getUserDateReliability(store, candidateId);
    const reliabilityMultiplier = reliabilityRate === null ? 1 : 0.5 + 0.5 * reliabilityRate;
    return { candidateId, adjustedScore: compatibilityScore * reliabilityMultiplier };
  });
  scored.sort((x, y) => y.adjustedScore - x.adjustedScore);
  return scored.map((s) => s.candidateId);
}

// **Real Your Turn Limits enforcement**: per `messages.js`'s own
// header, CVNVO has no individual swipe/like action to pause the way
// Hinge's real mechanic does -- matches are generated in batches here,
// so the real, adapted translation is excluding a user over their own
// turn limit from this round's candidate pool entirely, live, not just
// a documented intention.
function runGaleShapley(store, options = {}) {
  const { groupAIds, groupBIds } = options;
  if (!Array.isArray(groupAIds) || groupAIds.length === 0) throw new Error('runGaleShapley requires a non-empty groupAIds');
  if (!Array.isArray(groupBIds) || groupBIds.length === 0) throw new Error('runGaleShapley requires a non-empty groupBIds');
  for (const id of [...groupAIds, ...groupBIds]) {
    if (!getUserProfile(store, id)) throw new Error(`runGaleShapley: no real profile for ${id}`);
  }

  const eligibleAIds = groupAIds.filter((id) => !isUserOverTurnLimit(store, id));
  const eligibleBIds = groupBIds.filter((id) => !isUserOverTurnLimit(store, id));

  const preferencesA = {};
  for (const a of eligibleAIds) preferencesA[a] = computePreferenceList(store, a, eligibleBIds);
  const preferencesB = {};
  for (const b of eligibleBIds) preferencesB[b] = computePreferenceList(store, b, eligibleAIds);

  const pairs = stableMatch(preferencesA, preferencesB);
  return pairs.map((pair) => {
    const profileA = getUserProfile(store, pair.userAId);
    const profileB = getUserProfile(store, pair.userBId);
    const { compatibilityScore } = computeCompatibilityScore(profileA, profileB);
    return { ...pair, compatibilityScore };
  });
}

function createMatch(store, options = {}) {
  const {
    userAId, userBId, compatibilityScore, matchType = 'standard', expirationHours = DEFAULT_EXPIRATION_HOURS, now = Date.now(),
  } = options;
  if (!userAId || !userBId) throw new Error('createMatch requires userAId and userBId');
  if (!MATCH_TYPES.includes(matchType)) {
    throw new Error(`createMatch: invalid matchType "${matchType}" (expected one of ${MATCH_TYPES.join(', ')})`);
  }
  if (!Number.isFinite(compatibilityScore) || compatibilityScore < 0 || compatibilityScore > 100) {
    throw new Error('createMatch requires a compatibilityScore between 0 and 100');
  }

  const match = {
    id: store.nextMatchId++,
    userAId, userBId, compatibilityScore, matchType,
    expiresAt: now + expirationHours * 60 * 60 * 1000,
    unansweredCount: 0,
    awaitingReplyFromUserId: null,
    createdAt: now,
  };
  store.matches.push(match);
  return match;
}

function getMatch(store, matchId) {
  return store.matches.find((m) => m.id === matchId) || null;
}

// The real, full CVNVO flow: run the algorithm, then persist every
// resulting pair as a real Match record in one call, matching the API
// map's single `POST /cvnvo/matches` endpoint.
function generateAndCreateMatches(store, options = {}) {
  const { groupAIds, groupBIds, matchType = 'standard', expirationHours = DEFAULT_EXPIRATION_HOURS, now = Date.now() } = options;
  const pairs = runGaleShapley(store, { groupAIds, groupBIds });
  return pairs.map((pair) => createMatch(store, { ...pair, matchType, expirationHours, now }));
}

module.exports = {
  MATCH_TYPES, DEFAULT_EXPIRATION_HOURS, stableMatch, computePreferenceList, runGaleShapley,
  createMatch, getMatch, generateAndCreateMatches,
};
