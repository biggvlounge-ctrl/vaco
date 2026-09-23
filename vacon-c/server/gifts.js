// server/gifts.js
//
// **What a person is FOR** — the thing they are primarily good at, where
// it sits on a named scale, and how much of their own potential they
// have actually realised.
//
// ---------------------------------------------------------------------
// Three things, and only one of them is new information
// ---------------------------------------------------------------------
//   gift         which of the sixteen `skills` an entity is best at.
//                Everyone has one; it is an argmax, not an award.
//   calibration  where that gift sits on the Hawkins Map of
//                Consciousness, 20-1000, with its published level names.
//   mastery      how much of their own ceiling they have reached —
//                trained capability against natural aptitude.
//
// **Nothing here is stored.** Gift, calibration and mastery are computed
// from live traits on every read, which is the third standing rule:
// Reemergence, Property Value, Community Health and Family Wealth are
// all computed and never stored, and a person's gift is the same kind of
// thing. A stored gift would be a birth value that stopped being true
// the first time somebody learned anything.
//
// Traits are read through `getLiveEntity`, never `npc.traits` — the
// ninth standing rule. The sheet on the object is frozen at generation;
// a person who has been taught, injured, imprisoned or promoted has
// moved, and a gift computed off the birth sheet would be a plausible
// frozen number, which is harder to see than a null.
//
// ---------------------------------------------------------------------
// The scale is Hawkins, and what that does and does not claim
// ---------------------------------------------------------------------
// David R. Hawkins' Map of Consciousness (*Power vs. Force*, 1995) is a
// logarithmic 1-1000 ladder with seventeen named calibration levels.
// It is used here as a NAMED, PUBLISHED SCALE — the same reason
// `world-layer/imports/noaaImport.js` classifies climate with
// Köppen-Geiger and `blsImport.js` uses SOC major groups: a published
// vocabulary somebody else defined beats one invented for the occasion,
// because it can be checked against its source and it does not drift.
//
// **What it is not**: Hawkins' calibrations are a spiritual and
// philosophical framework, derived by applied kinesiology, and they are
// not an empirical measurement of anything. Nothing in this file claims
// otherwise, and no conclusion about a real person should be drawn from
// it. Inside a simulation it is a scale with good names and useful
// spacing, which is all it is being asked to be.
//
// The scale is LOGARITHMIC, and that is the property worth having.
// Linear 0-100 makes the difference between a competent person and a
// great one look the same size as the difference between a great one
// and a generational one. On a log scale it does not — which is how
// capability actually distributes, and it is why the top of this scale
// is reachable and almost never reached.
//
// ---------------------------------------------------------------------
// Every trait name below is verbatim from traits.js
// ---------------------------------------------------------------------
// A support map naming a trait that does not exist returns nothing
// forever and no fixture notices — the sixth standing rule, which this
// project has now hit in flows.js, salvage.js and an importer. The test
// asserts every name here against `TRAIT_FAMILIES` rather than trusting
// this comment.

'use strict';

const { getLiveEntity } = require('./entityTraits.js');
const { TRAIT_FAMILIES } = require('./traits.js');

// ---------------------------------------------------------------------
// The Hawkins levels, as published
// ---------------------------------------------------------------------
//: Seventeen named calibration levels. Values and names are Hawkins';
//: nothing here is interpolated or renamed. `LEVELS` is ascending so a
//: lookup can walk it once.
const LEVELS = [
  { at: 20, name: 'Shame' },
  { at: 30, name: 'Guilt' },
  { at: 50, name: 'Apathy' },
  { at: 75, name: 'Grief' },
  { at: 100, name: 'Fear' },
  { at: 125, name: 'Desire' },
  { at: 150, name: 'Anger' },
  { at: 175, name: 'Pride' },
  { at: 200, name: 'Courage' },
  { at: 250, name: 'Neutrality' },
  { at: 310, name: 'Willingness' },
  { at: 350, name: 'Acceptance' },
  { at: 400, name: 'Reason' },
  { at: 500, name: 'Love' },
  { at: 540, name: 'Joy' },
  { at: 600, name: 'Peace' },
  { at: 700, name: 'Enlightenment' },
];

const SCALE_MIN = 20;
const SCALE_MAX = 1000;

//: Hawkins' own pivot. 200 (Courage) is where his scale turns from what
//: he calls force to power, and it is the one threshold in the ladder
//: that means something structural rather than being another rung. Used
//: here as the line above which a gift is **established** rather than
//: merely present: everyone has a best skill, not everyone has made
//: anything of it.
const ESTABLISHED_AT = 200;

// ---------------------------------------------------------------------
// What supports each of the sixteen skills
// ---------------------------------------------------------------------
//: A skill's own `skills` trait is the trained half. These are the
//: natural half — the traits from the other nineteen families that
//: would make somebody good at it before they were taught anything.
//:
//: **Interpretive, and flagged as such**: no document maps traits to
//: skills. What is NOT interpretive is the vocabulary — every name is
//: verbatim from `traits.js`, and `test/gifts.test.js` asserts it, so
//: this cannot quietly become a list of fields that do not exist.
const SUPPORT = {
  Communication: [
    ['social', 'Charisma'], ['social', 'Persuasion'], ['social', 'Network Reach'],
    ['personality', 'Teaching Ability'], ['technology', 'Signal/Comms Literacy'],
  ],
  Leadership: [
    ['leadership', 'Command Presence'], ['leadership', 'Strategic Vision'],
    ['leadership', 'Delegation'], ['leadership', 'Crisis Composure'], ['social', 'Charisma'],
  ],
  Engineering: [
    ['technology', 'Machinery Aptitude'], ['technology', 'Electronics Repair'],
    ['technology', 'Salvage Engineering'], ['mental', 'Problem Solving'],
    ['educational', 'Technical Knowledge'],
  ],
  Medicine: [
    ['emotional', 'Empathy'], ['mental', 'Memory'], ['mental', 'Focus'],
    ['educational', 'Technical Knowledge'], ['educational', 'Literacy'],
  ],
  Science: [
    ['mental', 'Intelligence'], ['mental', 'Problem Solving'], ['mental', 'Curiosity'],
    ['educational', 'Literacy'], ['educational', 'Technical Knowledge'],
  ],
  Technology: [
    ['technology', 'Electronics Repair'], ['technology', 'Signal/Comms Literacy'],
    ['technology', 'Machinery Aptitude'], ['mental', 'Learning Speed'],
  ],
  Art: [
    ['mental', 'Creativity'], ['physical', 'Vision Acuity'], ['mental', 'Focus'],
    ['special', 'Signal Perception'],
  ],
  Music: [
    ['mental', 'Creativity'], ['sports', 'Coordination'], ['mental', 'Memory'],
    ['emotional', 'Empathy'],
  ],
  Business: [
    ['economic', 'Barter Skill'], ['economic', 'Risk Appetite'], ['economic', 'Frugality'],
    ['social', 'Persuasion'], ['mental', 'Risk Assessment'],
  ],
  Agriculture: [
    ['environmental', 'Weather Tolerance'], ['environmental', 'Wilderness Survival'],
    ['behavioral', 'Patience'], ['physical', 'Endurance'],
  ],
  Construction: [
    ['physical', 'Strength'], ['physical', 'Endurance'], ['technology', 'Machinery Aptitude'],
    ['sports', 'Coordination'], ['behavioral', 'Discipline'],
  ],
  Combat: [
    ['combat', 'Melee Skill'], ['combat', 'Ranged Skill'], ['combat', 'Tactical Awareness'],
    ['combat', 'Composure Under Fire'], ['combat', 'Weapon Mastery'],
  ],
  Athletics: [
    ['sports', 'Speed'], ['sports', 'Coordination'], ['sports', 'Competitive Drive'],
    ['physical', 'Stamina'], ['physical', 'Agility'],
  ],
  Crafting: [
    ['sports', 'Coordination'], ['mental', 'Creativity'], ['behavioral', 'Patience'],
    ['technology', 'Salvage Engineering'], ['physical', 'Reflexes'],
  ],
  Research: [
    ['mental', 'Curiosity'], ['mental', 'Focus'], ['mental', 'Memory'],
    ['educational', 'Self-Taught Aptitude'], ['educational', 'Historical Knowledge'],
  ],
  Management: [
    ['leadership', 'Delegation'], ['leadership', 'Strategic Vision'],
    ['behavioral', 'Discipline'], ['social', 'Group Loyalty'], ['mental', 'Risk Assessment'],
  ],
};

const SKILL_NAMES = Object.keys(SUPPORT);

//: How much of the evidence is the trained skill against the natural
//: aptitude behind it. **Even, and deliberately so**: weighting either
//: side higher would be asserting whether talent or training makes
//: somebody good at a thing, which is not this file's to decide and is
//: not in any document.
const TRAINED_SHARE = 0.5;

// ---------------------------------------------------------------------
// The scale
// ---------------------------------------------------------------------
// 0..100 evidence to a Hawkins calibration, logarithmically.
//
// **An evidence of 0 lands at 20 and an evidence of 100 at 1000**, with
// everything between placed on the log curve rather than the line. A
// trait sheet generated around 50 therefore calibrates near the middle
// of the LADDER rather than the middle of the numbers — which is the
// whole reason for a log scale, and it is why Reason 400 is a real
// achievement rather than what an average person gets.
function calibrate(evidence) {
  const clamped = Math.max(0, Math.min(100, Number(evidence)));
  if (!Number.isFinite(clamped)) return null;
  const logMin = Math.log(SCALE_MIN);
  const logMax = Math.log(SCALE_MAX);
  return Math.round(Math.exp(logMin + (clamped / 100) * (logMax - logMin)));
}

// The named level at or below a calibration. Hawkins' own names.
function levelFor(calibration) {
  if (!Number.isFinite(calibration)) return null;
  let found = LEVELS[0];
  for (const level of LEVELS) {
    if (calibration >= level.at) found = level;
    else break;
  }
  return found.name;
}

// ---------------------------------------------------------------------
// Reading a person
// ---------------------------------------------------------------------
// `null` for an entity with no trait rows at all, never a gift at the
// bottom of the scale. **Unknown is not a zero** — the corollary this
// project has already shipped wrong once in `moodFor`, where an
// unobserved person read as content. Somebody the engine has no traits
// for has no gift, which is different from being good at nothing.
function evidenceFor(sheet, skill) {
  const support = SUPPORT[skill];
  if (!support) return null;

  const trained = Number(sheet?.skills?.[skill]);
  const natural = [];
  for (const [family, trait] of support) {
    const value = Number(sheet?.[family]?.[trait]);
    if (Number.isFinite(value)) natural.push(value);
  }
  if (!Number.isFinite(trained) && natural.length === 0) return null;

  const naturalMean = natural.length
    ? natural.reduce((a, b) => a + b, 0) / natural.length
    : null;

  // Either half alone is still a reading; both is the normal case.
  if (!Number.isFinite(trained)) return { evidence: naturalMean, trained: null, natural: naturalMean };
  if (naturalMean === null) return { evidence: trained, trained, natural: null };

  return {
    evidence: trained * TRAINED_SHARE + naturalMean * (1 - TRAINED_SHARE),
    trained,
    natural: naturalMean,
  };
}

// **Mastery is against the person's OWN ceiling, not against 100.**
//
// This is the part the request named most precisely: "you pretty much
// mastered who that NPC could be using all the traits". So it is not
// how good somebody is — `calibration` already says that — it is how
// much of what they could have been they have become.
//
// natural aptitude is the ceiling, trained skill is the realisation.
// Somebody with enormous talent and no training masters little of it;
// somebody who has trained a modest gift to its limit has mastered it.
// Both readings are true at once and the scale says so.
function masteryOf(reading) {
  if (!reading || reading.natural === null || reading.trained === null) return null;
  if (reading.natural <= 0) return null;
  return Math.round(Math.min(1, reading.trained / reading.natural) * 1000) / 1000;
}

//: Named bands for mastery, so a number has a word. **Thresholds are
//: interpretive and stated**: nothing in the package sets them, and the
//: population they apply to is measured in `test/gifts.test.js` rather
//: than assumed — the twelfth rule's third clause, which cost this
//: project four wrong thresholds in `resolveAggression` alone.
const MASTERY_BANDS = [
  { at: 0, name: 'latent' },
  { at: 0.5, name: 'developing' },
  { at: 0.75, name: 'practised' },
  { at: 0.9, name: 'accomplished' },
  { at: 1, name: 'mastered' },
];

function masteryBand(mastery) {
  if (mastery === null || !Number.isFinite(mastery)) return null;
  let found = MASTERY_BANDS[0];
  for (const band of MASTERY_BANDS) {
    if (mastery >= band.at) found = band;
    else break;
  }
  return found.name;
}

// The whole reading for one entity.
//
// Returns null where there is nothing to read. Otherwise:
//   skill        the gift — one of the sixteen
//   calibration  20..1000, Hawkins
//   level        the published level name at that calibration
//   established  whether it is at or above Courage 200
//   mastery      0..1 of their own ceiling, or null where unknowable
//   band         the mastery band's name
//   runnersUp    the next two skills, so a gift is visibly a CHOICE
//                between sixteen rather than a label with nothing behind
//                it. A gift two points clear of the next thing is a
//                different fact from one fifty points clear.
function giftOf(worldState, entityId) {
  const entity = getLiveEntity(worldState, entityId);
  if (!entity) return null;
  const sheet = entity.traits;

  const readings = [];
  for (const skill of SKILL_NAMES) {
    const reading = evidenceFor(sheet, skill);
    if (reading === null) continue;
    readings.push({ skill, ...reading });
  }
  if (readings.length === 0) return null;

  // Ties broken by name so the same world always reads the same way —
  // §88's replay guarantee reaches derived readings too.
  readings.sort((a, b) => b.evidence - a.evidence || a.skill.localeCompare(b.skill));
  const best = readings[0];
  const calibration = calibrate(best.evidence);
  const mastery = masteryOf(best);

  return {
    entityId,
    skill: best.skill,
    evidence: Math.round(best.evidence * 10) / 10,
    calibration,
    level: levelFor(calibration),
    established: calibration >= ESTABLISHED_AT,
    trained: best.trained === null ? null : Math.round(best.trained * 10) / 10,
    natural: best.natural === null ? null : Math.round(best.natural * 10) / 10,
    mastery,
    band: masteryBand(mastery),
    runnersUp: readings.slice(1, 3).map((r) => ({
      skill: r.skill,
      evidence: Math.round(r.evidence * 10) / 10,
    })),
  };
}

// Every skill's reading for one entity, best first. The full sheet
// behind `giftOf`, for a dashboard that wants to show what somebody is
// made of rather than only what they are best at.
function profileOf(worldState, entityId) {
  const entity = getLiveEntity(worldState, entityId);
  if (!entity) return null;
  const sheet = entity.traits;

  const out = [];
  for (const skill of SKILL_NAMES) {
    const reading = evidenceFor(sheet, skill);
    if (reading === null) continue;
    const calibration = calibrate(reading.evidence);
    out.push({
      skill,
      evidence: Math.round(reading.evidence * 10) / 10,
      calibration,
      level: levelFor(calibration),
      mastery: masteryOf(reading),
    });
  }
  if (out.length === 0) return null;
  out.sort((a, b) => b.evidence - a.evidence || a.skill.localeCompare(b.skill));
  return out;
}

// ---------------------------------------------------------------------
// describeGifts — the guard
// ---------------------------------------------------------------------
// The claim is that a gift distinguishes people. That is false if the
// whole world has the same one, or if no gift is ever established, or
// if a skill can never win. **The twentieth standing rule applies to
// this function too**: it must be able to fail, so it counts the things
// that would show the system is decorative.
function describeGifts(worldState, options = {}) {
  const { entityIds = null } = options;
  const people = entityIds
    ?? (worldState.npcs || []).filter((n) => n.status !== 'deceased').map((n) => n.id);

  const bySkill = {};
  const byLevel = {};
  const byBand = {};
  const calibrations = [];
  const masteries = [];
  let established = 0;
  let read = 0;

  for (const id of people) {
    const gift = giftOf(worldState, id);
    if (!gift) continue;
    read += 1;
    bySkill[gift.skill] = (bySkill[gift.skill] ?? 0) + 1;
    byLevel[gift.level] = (byLevel[gift.level] ?? 0) + 1;
    if (gift.band) byBand[gift.band] = (byBand[gift.band] ?? 0) + 1;
    calibrations.push(gift.calibration);
    if (gift.mastery !== null) masteries.push(gift.mastery);
    if (gift.established) established += 1;
  }

  calibrations.sort((a, b) => a - b);
  masteries.sort((a, b) => a - b);
  const mid = (arr) => (arr.length ? arr[Math.floor(arr.length / 2)] : null);

  return {
    read,
    // **A skill nothing in the world is best at.** Not automatically a
    // defect — sixteen skills and a small population will leave some
    // empty — but a skill that is NEVER anybody's gift across a large
    // world means its support map cannot compete, which is.
    unreachedSkills: SKILL_NAMES.filter((s) => !bySkill[s]),
    bySkill,
    byLevel,
    byBand,
    establishedShare: read === 0 ? null : Math.round((established / read) * 1000) / 1000,
    calibration: {
      lowest: calibrations[0] ?? null,
      median: mid(calibrations),
      highest: calibrations[calibrations.length - 1] ?? null,
    },
    mastery: {
      lowest: masteries[0] ?? null,
      median: mid(masteries),
      highest: masteries[masteries.length - 1] ?? null,
    },
  };
}

module.exports = {
  LEVELS,
  SCALE_MIN,
  SCALE_MAX,
  ESTABLISHED_AT,
  SUPPORT,
  SKILL_NAMES,
  TRAINED_SHARE,
  MASTERY_BANDS,
  calibrate,
  levelFor,
  masteryBand,
  giftOf,
  profileOf,
  describeGifts,
};
