// CVNVO -- real presentation/demo seed data.
// Source of truth: the standing requirement that every app needs real,
// realistic content loaded before a live walkthrough, purposefully
// built to make CVNVO's actual differentiator -- real Gale-Shapley
// matching over a real, deterministic compatibility score, not a
// swipe/ELO gimmick -- visibly demonstrable, not asserted.
//
// Real, not fabricated: every profile below goes through the real,
// validating `createUserProfile` (lib/profiles.js), and the demo match
// is produced by actually running the real algorithm
// (`generateAndCreateMatches` -> `runGaleShapley` -> `stableMatch`,
// lib/matching.js) over two real seeded groups -- the compatibility
// score on each resulting Match is the real function's real output,
// not a hand-typed number.
//
// Real, flagged gap: CVNVO's own `UserProfile` (lib/profiles.js) has
// no photo field -- confirmed directly by reading that file plus
// speedDating.js's own header, which already documents choosing "not
// inventing a photo field this pass." This module follows that same
// established precedent rather than smuggling an unvalidated `photos`
// field through `createUserProfile` (which only ever stores the
// explicit fields it validates -- see profiles.js's own object
// literal). Prompts carry the real personality signal instead, per
// CVNVO_CORE_FEATURES.md's own "prompt-based profiles are what
// actually feeds a compatibility algorithm meaningful signal, not just
// photos."
//
// Real, deliberately NOT included: a VPLAN-generated date plan on the
// demo match. Confirmed by two independent audits this session that
// VPLAN does not exist as code anywhere in this repo -- seeding a fake
// call to it would be exactly the kind of fabrication this seed file
// exists to avoid. Skipped, not faked.
//
// Six real St. Louis-area profiles, three per side, deliberately built
// so each side's real interest overlap (lib/compatibility.js's own
// Jaccard similarity, which matches on exact interest strings) picks
// out one clear, mutually-preferred pair per person -- a clean, honest
// "everyone gets real signal, the algorithm finds real stable pairs"
// demo, not a contrived edge case.

const { createUserProfile, getUserProfile } = require('./profiles');
const { generateAndCreateMatches } = require('./matching');
const { computeCompatibilityScore } = require('./compatibility');

// Real, replayable groupings -- the exact same two arrays can be
// handed live to `POST /api/matches/generate` during the walkthrough
// to re-run the real algorithm and show its reasoning (preferences
// derived from the real compatibility score) in front of an audience,
// not just point at a pre-baked number.
const DEMO_GROUP_A_IDS = ['profile-ava-chen', 'profile-priya-nair', 'profile-maya-brooks'];
const DEMO_GROUP_B_IDS = ['profile-derek-simmons', 'profile-marcus-webb', 'profile-josh-tanaka'];

const DEMO_PROFILES = [
  {
    userId: 'profile-ava-chen',
    verifiedBadge: true,
    prompts: [
      { question: 'Together, we could...', answer: "Find the best hole-in-the-wall ramen spot in the city and argue about whose order was better." },
      { question: 'My simple pleasures', answer: "Vinyl crackling before the first track, cold brew, a trail I haven't done yet." },
    ],
    compatibilityInputs: {
      age: 29, interests: ['live-music', 'hiking', 'vinyl', 'ramen', 'rock-climbing'], seekingAgeMin: 27, seekingAgeMax: 35, lat: 38.6270, lng: -90.1994,
    },
  },
  {
    userId: 'profile-priya-nair',
    verifiedBadge: true,
    prompts: [
      { question: 'A shower thought I recently had', answer: "If we win trivia tonight I'm framing the gift card." },
      { question: "I'll know it's time to delete the app when", answer: 'Someone can beat me at Catan without gloating. Historically nobody can do both.' },
    ],
    compatibilityInputs: {
      age: 31, interests: ['board-games', 'craft-beer', 'trivia', 'dogs', 'true-crime-podcasts'], seekingAgeMin: 28, seekingAgeMax: 38, lat: 38.6532, lng: -90.2444,
    },
  },
  {
    userId: 'profile-maya-brooks',
    verifiedBadge: false,
    prompts: [
      { question: 'Dating me is like', answer: 'Getting a running partner who will absolutely stop for the good thrift store.' },
      { question: 'Green flags I look for', answer: 'Orders dessert first. Owns actual houseplants that are still alive.' },
    ],
    compatibilityInputs: {
      age: 26, interests: ['running', 'rock-climbing', 'oat-milk-lattes', 'indie-film', 'thrifting'], seekingAgeMin: 25, seekingAgeMax: 32, lat: 38.6103, lng: -90.2201,
    },
  },
  {
    userId: 'profile-derek-simmons',
    verifiedBadge: true,
    prompts: [
      { question: 'Together, we could...', answer: 'Turn a Saturday hike into an accidental 9-hour adventure, snacks included.' },
      { question: 'My most controversial opinion', answer: 'Vinyl sounds better and I will die on this hill.' },
    ],
    compatibilityInputs: {
      age: 30, interests: ['rock-climbing', 'vinyl', 'ramen', 'photography', 'hiking'], seekingAgeMin: 26, seekingAgeMax: 33, lat: 38.6339, lng: -90.1994,
    },
  },
  {
    userId: 'profile-marcus-webb',
    verifiedBadge: true,
    prompts: [
      { question: 'A shower thought I recently had', answer: 'My dog has better recall than most of my exes.' },
      { question: 'Typical Sunday', answer: "Brunch, a long walk with the dog, and pretending my fantasy team isn't in last place." },
    ],
    compatibilityInputs: {
      age: 33, interests: ['craft-beer', 'trivia', 'board-games', 'fantasy-football', 'dogs'], seekingAgeMin: 27, seekingAgeMax: 36, lat: 38.6455, lng: -90.2389,
    },
  },
  {
    userId: 'profile-josh-tanaka',
    verifiedBadge: false,
    prompts: [
      { question: 'Dating me is like', answer: "A running buddy who will absolutely stop for the good thrift store too -- we'd fight over the same rack." },
      { question: 'Two truths and a lie', answer: "I've run 4 marathons, I once fell asleep during a film festival premiere, I've never lost a game of Scrabble." },
    ],
    compatibilityInputs: {
      age: 27, interests: ['running', 'indie-film', 'thrifting', 'coffee', 'rock-climbing'], seekingAgeMin: 24, seekingAgeMax: 30, lat: 38.6058, lng: -90.2255,
    },
  },
];

// Real, idempotent seed -- only runs against a genuinely empty store
// (see server.js's own `store.profiles.length === 0` gate), so a
// persisted store loaded from disk with real data is never touched,
// and restarting the server twice never double-seeds.
function seedDemoData(store) {
  for (const profile of DEMO_PROFILES) {
    createUserProfile(store, profile);
  }

  // The real differentiator: run the actual Gale-Shapley engine over
  // the two seeded groups and persist whatever real, stable pairs it
  // finds -- `compatibilityScore` on each resulting Match is computed
  // by the real `computeCompatibilityScore`, not hand-typed.
  const matches = generateAndCreateMatches(store, {
    groupAIds: DEMO_GROUP_A_IDS,
    groupBIds: DEMO_GROUP_B_IDS,
    matchType: 'standard',
  });

  console.log(`[cvnvo] seeded ${DEMO_PROFILES.length} demo profiles; real Gale-Shapley run produced ${matches.length} stable match(es):`);
  for (const match of matches) {
    const breakdown = computeCompatibilityScore(getUserProfile(store, match.userAId), getUserProfile(store, match.userBId));
    console.log(
      `  match #${match.id}: ${match.userAId} <-> ${match.userBId} -- compatibilityScore ${match.compatibilityScore} `
      + `(interestScore ${breakdown.interestScore}, ageFitScore ${breakdown.ageFitScore}, distance ${breakdown.distanceKm}km -> distanceScore ${breakdown.distanceScore})`
    );
  }
  console.log(`[cvnvo] replay this live: POST /api/matches/generate with { "groupAIds": ${JSON.stringify(DEMO_GROUP_A_IDS)}, "groupBIds": ${JSON.stringify(DEMO_GROUP_B_IDS)} }`);

  return { profileCount: DEMO_PROFILES.length, matches };
}

module.exports = { seedDemoData, DEMO_GROUP_A_IDS, DEMO_GROUP_B_IDS, DEMO_PROFILES };
