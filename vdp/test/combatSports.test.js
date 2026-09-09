// The Combat Sports District's own rules.
//
// Every assertion was watched failing against a reintroduced bug
// before being trusted, per
// `dev-docs/STANDING_INSTRUCTION_TEST_VERIFICATION.md`.

import test from "node:test";
import assert from "node:assert";

import {
  MATCH_FORMATS, SKILL_LEVELS, SETTLING_TIERS, FORMAT_RULES, CombatError,
  createMatch, assertBookable, assertSameTier, startMatch, recordResult,
  broadcastChannels, predictionMarketEligibility, isRookieEligible, tierRank, describeMatch,
} from "../src/lib/combatSports.js";

const fighters = (n, prefix = "f") => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

const singles = (over = {}) => createMatch({
  matchId: "m1", matchFormat: "one-on-one", combatSportType: "boxing",
  skillLevel: "professional", participantIds: ["ada", "bo"], ...over,
});

// -- Shape ---------------------------------------------------------------

test("every format has a headcount rule, and every rule is coherent", () => {
  for (const f of MATCH_FORMATS) {
    const r = FORMAT_RULES[f];
    assert.ok(r, `${f} has no rule -- createMatch would throw on a valid format`);
    assert.ok(r.min <= r.max, `${f}: min ${r.min} exceeds max ${r.max}`);
    if (r.teamSize) assert.equal(r.min % r.teamSize, 0, `${f}: min is not a whole number of teams`);
  }
});

test("skill levels are an ordered progression, street lowest", () => {
  assert.deepEqual(SKILL_LEVELS, ["street", "amateur", "semi-pro", "professional"]);
  assert.ok(tierRank("street") < tierRank("amateur"));
  assert.ok(tierRank("semi-pro") < tierRank("professional"));
});

test("combatSportType is genuinely open, not an enum", () => {
  for (const sport of ["wrestling", "boxing", "mma", "muay thai", "lethwei", "sumo"]) {
    const m = singles({ combatSportType: sport });
    assert.equal(m.combatSportType, sport.toLowerCase());
  }
});

test("sport names are normalised so one discipline is not two", () => {
  assert.equal(singles({ combatSportType: "  Boxing  " }).combatSportType, "boxing");
});

test("an empty or missing sport is still refused -- open is not unchecked", () => {
  assert.throws(() => singles({ combatSportType: "   " }), /combatSportType/);
  assert.throws(() => singles({ combatSportType: undefined }), /combatSportType/);
});

// -- Headcount, which is where the bug lives -----------------------------

test("one-on-one takes exactly two", () => {
  singles();
  assert.throws(
    () => singles({ participantIds: ["ada", "bo", "cy"] }),
    (e) => e instanceof CombatError && /takes 2 fighters, got 3/.test(e.message),
  );
  assert.throws(() => singles({ participantIds: ["ada"] }), /takes 2 fighters, got 1/);
});

test("tag team needs whole teams", () => {
  createMatch({
    matchId: "t", matchFormat: "tag-team", combatSportType: "wrestling",
    skillLevel: "professional", participantIds: fighters(4),
  });
  assert.throws(
    () => createMatch({
      matchId: "t", matchFormat: "tag-team", combatSportType: "wrestling",
      skillLevel: "professional", participantIds: fighters(5),
    }),
    // Asserting on the reason: 5 is inside the 4-8 range, so this must
    // fail on the team-division rule, not on the range check.
    (e) => /whole teams of 2/.test(e.message),
  );
});

test("a royal rumble needs a crowd, and a cage match does not", () => {
  createMatch({
    matchId: "r", matchFormat: "royal-rumble", combatSportType: "wrestling",
    skillLevel: "semi-pro", participantIds: fighters(20),
  });
  assert.throws(
    () => createMatch({
      matchId: "r", matchFormat: "royal-rumble", combatSportType: "wrestling",
      skillLevel: "semi-pro", participantIds: fighters(2),
    }),
    /3-30 fighters, got 2/,
  );
  assert.throws(
    () => createMatch({
      matchId: "c", matchFormat: "cage-match", combatSportType: "mma",
      skillLevel: "professional", participantIds: fighters(3),
    }),
    /takes 2 fighters, got 3/,
  );
});

test("the same fighter cannot be entered twice", () => {
  assert.throws(
    () => createMatch({
      matchId: "r", matchFormat: "royal-rumble", combatSportType: "wrestling",
      skillLevel: "amateur", participantIds: ["ada", "bo", "ada"],
    }),
    (e) => /twice on the card/.test(e.message),
  );
});

test("an unknown format or tier is refused rather than stored", () => {
  assert.throws(() => singles({ matchFormat: "battle-royale" }), /matchFormat must be/);
  assert.throws(() => singles({ skillLevel: "elite" }), /skillLevel must be/);
});

// -- Booking -------------------------------------------------------------

test("a fighter already in a live match cannot be booked into another", () => {
  const live = startMatch(singles({ matchId: "live", participantIds: ["ada", "bo"] }));
  const next = singles({ matchId: "next", participantIds: ["bo", "cy"] });
  assert.throws(
    () => assertBookable(next, [live]),
    (e) => e instanceof CombatError && /bo is already in a live match/.test(e.message),
  );
});

test("a finished match does not block the next booking", () => {
  const done = recordResult(startMatch(singles({ matchId: "d", participantIds: ["ada", "bo"] })), ["ada"]);
  const next = singles({ matchId: "n", participantIds: ["bo", "cy"] });
  assert.doesNotThrow(() => assertBookable(next, [done]));
});

test("a card is single-tier -- a pro is not matched against a street fighter", () => {
  const m = singles({ skillLevel: "professional", participantIds: ["ada", "bo"] });
  assert.throws(
    () => assertSameTier(m, { ada: { skillLevel: "professional" }, bo: { skillLevel: "street" } }),
    (e) => /bo is street, card is professional/.test(e.message),
  );
  assert.doesNotThrow(
    () => assertSameTier(m, { ada: { skillLevel: "professional" }, bo: { skillLevel: "professional" } }),
  );
});

// -- Results -------------------------------------------------------------

test("a match must be live before it can have a result", () => {
  const m = singles();
  assert.throws(() => recordResult(m, ["ada"]), /not live/);
  startMatch(m);
  recordResult(m, ["ada"]);
  assert.equal(m.status, "finished");
  assert.deepEqual(m.winnerIds, ["ada"]);
});

test("starting a match twice is refused", () => {
  const m = startMatch(singles());
  assert.throws(() => startMatch(m), /not scheduled/);
});

test("a winner who never fought is refused -- that is how a market pays the wrong person", () => {
  const m = startMatch(singles({ participantIds: ["ada", "bo"] }));
  assert.throws(
    () => recordResult(m, ["cy"]),
    (e) => /cy did not fight on this card/.test(e.message),
  );
  assert.equal(m.status, "live", "a rejected result still changed the match");
});

test("everyone cannot win", () => {
  const m = startMatch(singles({ participantIds: ["ada", "bo"] }));
  assert.throws(() => recordResult(m, ["ada", "bo"]), /everyone cannot win/);
});

test("a tag team result may name a whole team", () => {
  const m = startMatch(createMatch({
    matchId: "t", matchFormat: "tag-team", combatSportType: "wrestling",
    skillLevel: "professional", participantIds: fighters(4),
  }));
  recordResult(m, ["f1", "f2"]);
  assert.deepEqual(m.winnerIds, ["f1", "f2"]);
});

// -- The three integration seams -----------------------------------------

test("every match gets multiple monetizable camera angles", () => {
  const chans = broadcastChannels(singles());
  assert.ok(chans.length >= 3, "multi-channel with fewer than three angles is not multi-channel");
  assert.ok(chans.every((c) => c.monetizable));
  // Keys must be unique or Vavlt Stvdios opens one channel for two angles.
  assert.equal(new Set(chans.map((c) => c.key)).size, chans.length);
});

test("format-specific angles are added, not substituted", () => {
  const base = broadcastChannels(singles()).map((c) => c.angle);
  const cage = broadcastChannels(singles({ matchFormat: "cage-match" })).map((c) => c.angle);
  for (const angle of base) assert.ok(cage.includes(angle), `cage match lost the ${angle}`);
  assert.ok(cage.includes("cage-top"));
});

test("street-tier bouts cannot open a prediction market", () => {
  const street = singles({ skillLevel: "street" });
  const verdict = predictionMarketEligibility(street);
  assert.equal(verdict.eligible, false);
  assert.match(verdict.reason, /do not settle/);
  // And the tier list is the single place that decides it.
  assert.ok(!SETTLING_TIERS.includes("street"));
});

test("every non-street tier can settle", () => {
  for (const tier of SKILL_LEVELS.filter((t) => t !== "street")) {
    const v = predictionMarketEligibility(singles({ skillLevel: tier }));
    assert.equal(v.eligible, true, `${tier} was refused a market`);
  }
});

test("a finished match cannot open a new market", () => {
  const m = recordResult(startMatch(singles()), ["ada"]);
  const v = predictionMarketEligibility(m);
  assert.equal(v.eligible, false);
  // The reason must be the finished one, not the tier one -- this is a
  // professional bout, so a tier-shaped refusal here would mean the
  // test proved the wrong rule.
  assert.match(v.reason, /already finished/);
});

test("rookie eligibility is derived from the progression, and a debut ends it", () => {
  assert.equal(isRookieEligible({ skillLevel: "amateur" }), true);
  assert.equal(isRookieEligible({ skillLevel: "semi-pro" }), true);
  assert.equal(isRookieEligible({ skillLevel: "professional" }), false);
  assert.equal(isRookieEligible({ skillLevel: "amateur", proDebutAt: 1 }), false);
  assert.equal(isRookieEligible({ skillLevel: "nonsense" }), false);
  assert.equal(isRookieEligible(null), false);
});

test("describeMatch surfaces why predictions are closed rather than just that they are", () => {
  const d = describeMatch(singles({ skillLevel: "street" }));
  assert.match(d.headline, /boxing · one-on-one · street/);
  assert.match(d.predictions, /do not settle/);
  assert.equal(describeMatch(singles()).predictions, "open");
});
