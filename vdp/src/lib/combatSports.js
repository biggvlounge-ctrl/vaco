// VDP -- the Combat Sports District, per
// `vdp/VDP_COMBAT_SPORTS_DISTRICT.md`: "a genuine combat sports and
// wrestling district, covering every real match format and skill
// level, from street-level to professional, generalized to any combat
// sport, not wrestling alone."
//
// **Same split as the Venus Resort, for the same reason.** VDP owns
// the card: who is fighting, in what format, at what tier, and whether
// a bout is well-formed. Vavlt Stvdios owns the broadcast, VAGO owns
// the prediction market and the money, VOKEN owns the cards. This
// module hands those three the facts they need and calls none of them
// -- every one of them is already reachable through an existing client
// in this directory, and a second place that computes a payout is how
// two systems start disagreeing about what somebody is owed.
//
// **`combatSportType` stays an open string, deliberately.** The source
// document is explicit -- "genuinely open -- wrestling, boxing, mma, or
// any other discipline." An enum here would be a quiet contradiction
// of that, and the next discipline would need a code change to exist.
// It is validated for being a real non-empty name and normalised, not
// constrained to a list.
//
// **What the formats actually constrain is headcount**, and that is
// where the bug lives. A "one-on-one" with three participants, or a
// tag team match with five, is well-formed as a JSON object and
// nonsense as a bout -- it will stream, take predictions and pay out
// while being unrunnable. So the roster is checked against the format
// on every construction rather than trusted from the caller.
//
// **Street tier settles nothing.** The source document confirms
// street-level as a real tier and says nothing about money. An
// unlicensed underground-fight economy is a different compliance
// object than a professional bout, so the conservative answer is taken
// and stated: street matches are real, streamable and rankable, and
// cannot open a prediction market. `vdp/VDP_COMBAT_SPORTS_DISTRICT.md`
// records this as an open decision; if it is decided the other way,
// `SETTLING_TIERS` is the one line to change.

export const DISTRICT_NAME = "Combat Sports District";

export const MATCH_FORMATS = ["royal-rumble", "tag-team", "cage-match", "one-on-one"];

// Ordered, because it is a progression path -- the source document's
// own "a real complete progression path," not four unrelated labels.
export const SKILL_LEVELS = ["street", "amateur", "semi-pro", "professional"];

// Which tiers may have money on them. See the header.
export const SETTLING_TIERS = ["amateur", "semi-pro", "professional"];

// Headcount rules per format. `teamSize` non-null means the roster
// must divide evenly into teams of that size.
export const FORMAT_RULES = {
  "one-on-one": { min: 2, max: 2, teamSize: null },
  "cage-match": { min: 2, max: 2, teamSize: null },
  "tag-team": { min: 4, max: 8, teamSize: 2 },
  "royal-rumble": { min: 3, max: 30, teamSize: null },
};

export class CombatError extends Error {}

function requireString(value, field, action) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CombatError(`${action} requires a non-empty ${field}`);
  }
  return value.trim();
}

export function tierRank(skillLevel) {
  return SKILL_LEVELS.indexOf(skillLevel);
}

export function createMatch(options = {}) {
  const a = "createMatch";
  const {
    matchId, matchFormat, combatSportType, skillLevel,
    participantIds = [], scheduledAt = null,
  } = options;

  if (!MATCH_FORMATS.includes(matchFormat)) {
    throw new CombatError(`${a}: matchFormat must be one of ${MATCH_FORMATS.join(", ")}`);
  }
  if (!SKILL_LEVELS.includes(skillLevel)) {
    throw new CombatError(`${a}: skillLevel must be one of ${SKILL_LEVELS.join(", ")}`);
  }

  const id = requireString(matchId, "matchId", a);
  // Open by design, validated for being real rather than for being on
  // a list. Lower-cased so "Boxing" and "boxing" are one discipline.
  const sport = requireString(combatSportType, "combatSportType", a).toLowerCase();

  if (!Array.isArray(participantIds)) {
    throw new CombatError(`${a}: participantIds must be an array`);
  }
  const roster = participantIds.map((p) => requireString(String(p ?? ""), "participantId", a));

  // The same fighter entered twice fills a slot nobody is standing in
  // -- and in a rumble it is genuinely easy to do.
  const unique = new Set(roster);
  if (unique.size !== roster.length) {
    throw new CombatError(`${a}: the same fighter appears twice on the card`);
  }

  const rules = FORMAT_RULES[matchFormat];
  if (roster.length < rules.min || roster.length > rules.max) {
    throw new CombatError(
      `${a}: "${matchFormat}" takes ${rules.min === rules.max ? rules.min : `${rules.min}-${rules.max}`} `
      + `fighters, got ${roster.length}`,
    );
  }
  if (rules.teamSize && roster.length % rules.teamSize !== 0) {
    throw new CombatError(
      `${a}: "${matchFormat}" needs whole teams of ${rules.teamSize}, and ${roster.length} does not divide`,
    );
  }

  return {
    matchId: id,
    matchFormat,
    combatSportType: sport,
    skillLevel,
    participantIds: roster,
    scheduledAt,
    status: "scheduled",
    winnerIds: null,
  };
}

// -- Booking a card ------------------------------------------------------

// A fighter in two live bouts at once is the booking error that only
// shows up when both are streaming. `liveMatches` is the caller's own
// view of what is currently running -- VDP does not hold a global
// fixture list, and inventing one here would be a second source of
// truth for something the district already tracks.
export function assertBookable(match, liveMatches = []) {
  const a = "assertBookable";
  const busy = new Set();
  for (const live of liveMatches) {
    if (live.status !== "live") continue;
    for (const p of live.participantIds) busy.add(p);
  }
  const clash = match.participantIds.filter((p) => busy.has(p));
  if (clash.length > 0) {
    throw new CombatError(`${a}: ${clash.join(", ")} ${clash.length === 1 ? "is" : "are"} already in a live match`);
  }
  return match;
}

// Tiers exist to mean something. A professional against a street
// fighter is not a bout, it is an injury -- so a card is single-tier,
// and mixing is refused rather than averaged.
export function assertSameTier(match, fightersById = {}) {
  const a = "assertSameTier";
  const wrong = [];
  for (const id of match.participantIds) {
    const fighter = fightersById[id];
    if (!fighter) continue;                       // unknown fighters are the caller's problem
    if (fighter.skillLevel !== match.skillLevel) {
      wrong.push(`${id} is ${fighter.skillLevel}, card is ${match.skillLevel}`);
    }
  }
  if (wrong.length > 0) throw new CombatError(`${a}: ${wrong.join("; ")}`);
  return match;
}

export function startMatch(match) {
  if (match.status !== "scheduled") {
    throw new CombatError(`startMatch: match ${match.matchId} is "${match.status}", not scheduled`);
  }
  match.status = "live";
  return match;
}

export function recordResult(match, winnerIds) {
  const a = "recordResult";
  if (match.status !== "live") {
    throw new CombatError(`${a}: match ${match.matchId} is "${match.status}", not live`);
  }
  if (!Array.isArray(winnerIds) || winnerIds.length === 0) {
    throw new CombatError(`${a}: a result needs at least one winner`);
  }
  // A winner who was never on the card is how a settled market pays
  // the wrong person.
  const outsiders = winnerIds.filter((w) => !match.participantIds.includes(w));
  if (outsiders.length > 0) {
    throw new CombatError(`${a}: ${outsiders.join(", ")} did not fight on this card`);
  }
  if (winnerIds.length >= match.participantIds.length) {
    throw new CombatError(`${a}: everyone cannot win`);
  }
  match.status = "finished";
  match.winnerIds = [...winnerIds];
  return match;
}

// -- The three integration seams -----------------------------------------

// Vavlt Stvdios' multi-channel architecture, per the source document:
// "multiple camera angles as separate, monetizable channels." Returns
// the channel specs; opening them is `vavltStvdiosClient.js`'s job.
export function broadcastChannels(match) {
  const angles = ["hard-camera", "corner-cam", "crowd-cam"];
  if (match.matchFormat === "cage-match") angles.push("cage-top");
  if (match.matchFormat === "royal-rumble") angles.push("entrance-ramp");
  return angles.map((angle) => ({
    key: `${match.matchId}:${angle}`,
    name: `${match.combatSportType} — ${angle}`,
    matchId: match.matchId,
    angle,
    monetizable: true,
  }));
}

// The gate before calling VAGO. Returns a reason rather than a bare
// false, because "why can I not bet on this" is the question a player
// will actually ask.
export function predictionMarketEligibility(match) {
  if (!SETTLING_TIERS.includes(match.skillLevel)) {
    return {
      eligible: false,
      reason: `${match.skillLevel}-tier bouts do not settle. An unlicensed underground-fight `
        + "economy is a different compliance object than a sanctioned one, and that decision "
        + "is recorded as open in VDP_COMBAT_SPORTS_DISTRICT.md.",
    };
  }
  if (match.status === "finished") {
    return { eligible: false, reason: "this match is already finished" };
  }
  return { eligible: true, reason: null };
}

// VOKEN rookie cards, per the source document: "capturing a fighter's
// early career," the same mechanic already used for musicians/actors.
// Rookie is a fact about where they are in the progression, so it is
// derived from the tier rather than stored and left to rot.
export function isRookieEligible(fighter) {
  if (!fighter || !SKILL_LEVELS.includes(fighter.skillLevel)) return false;
  if (fighter.proDebutAt) return false;         // a debut ends the rookie window
  return tierRank(fighter.skillLevel) < tierRank("professional");
}

export function describeMatch(match) {
  const market = predictionMarketEligibility(match);
  return {
    matchId: match.matchId,
    headline: `${match.combatSportType} · ${match.matchFormat} · ${match.skillLevel}`,
    fighters: match.participantIds.length,
    status: match.status,
    channels: broadcastChannels(match).length,
    predictions: market.eligible ? "open" : market.reason,
  };
}
