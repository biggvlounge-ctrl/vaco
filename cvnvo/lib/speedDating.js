// CVNVO -- Speed Dating + Group Dating, sharing one real entity per
// `CVNVO_ARCHITECTURE.md`'s own schema: `SpeedDateSlot { id, format:
// "in-person" | "all-facetime", participants: [userId], durationSec }`
// -- `participants` already real-supports "2 for standard, 3+ for
// group 2v1/3v1," so Group Dating isn't a separate system, it's this
// same slot with more real participants and a real rotation schedule.
//
// Source of truth: `CVNVO_DATING_COMPARABLES.md`'s own Speed Dating
// research (Tinder's real, live 2026 pilot: scheduled 3-minute video
// "vibe checks," "requires verified profile photos before access")
// and Group Dating research ("2v1/3v1 in-person rotating dates...
// extends the Speed Dating research... into a live, multi-person event
// format").
//
// **Real, flagged substitution**: the doc requires "verified profile
// photos" before access. CVNVO's own `UserProfile` has no photo field
// at all (Hinge-model prompts only, per `profiles.js`'s own header) --
// `verifiedBadge` (VACA-backed real identity verification) is the
// closest real, already-built proxy for "this profile has been
// verified," used here instead of inventing a photo field this pass
// doesn't otherwise need.
//
// **Real rotation schedule for group slots**: `CVNVO_DATING_COMPARABLES.md`
// describes 2v1/3v1 "rotating" dates but gives no exact rotation
// algorithm. `generateRotationSchedule` below is a real, deterministic,
// round-robin pairing generator (every participant pairs with every
// other participant exactly once) -- a real, bounded, flagged
// interpretive choice, the same posture as this session's other
// unscoped formulas.
//
// Real, deliberate non-dependency: a call session for an "all-facetime"
// 2-person slot can reuse `communicationControls.js`'s own
// `startAnonymousCall` once a real matchId exists for that pair --
// left as a real, natural next step rather than modifying that
// already-tested module to accept a slot id it was never designed
// around.

const { getUserProfile } = require('./profiles');

const SPEED_DATE_FORMATS = ['in-person', 'all-facetime'];
const DEFAULT_SPEED_DATE_DURATION_SEC = 180; // Tinder's own real, published 3-minute pilot window

function requireVerifiedParticipants(store, participants) {
  for (const userId of participants) {
    const profile = getUserProfile(store, userId);
    if (!profile) throw new Error(`no real profile for ${userId}`);
    if (!profile.verifiedBadge) throw new Error(`${userId} does not have a real verified badge -- speed dating requires verified participants`);
  }
}

function scheduleSpeedDate(store, options = {}) {
  const {
    format, participants, durationSec = DEFAULT_SPEED_DATE_DURATION_SEC, now = Date.now(),
  } = options;
  if (!SPEED_DATE_FORMATS.includes(format)) {
    throw new Error(`scheduleSpeedDate requires a format of ${SPEED_DATE_FORMATS.join(', ')}`);
  }
  if (!Array.isArray(participants) || participants.length < 2) {
    throw new Error('scheduleSpeedDate requires at least 2 real participants');
  }
  if (new Set(participants).size !== participants.length) {
    throw new Error('scheduleSpeedDate: participants must not contain duplicates');
  }
  if (!Number.isInteger(durationSec) || durationSec <= 0) {
    throw new Error('scheduleSpeedDate requires a positive integer durationSec');
  }
  requireVerifiedParticipants(store, participants);

  const slot = {
    id: store.nextSpeedDateSlotId++, format, participants: [...participants], durationSec, extended: false, createdAt: now,
  };
  store.speedDateSlots.push(slot);
  return slot;
}

function getSpeedDateSlot(store, slotId) {
  return store.speedDateSlots.find((s) => s.id === slotId) || null;
}

// "the option to extend a promising conversation past the initial 3
// minutes" -- a real, one-time real extension, not an unbounded timer.
function extendSpeedDate(store, options = {}) {
  const { slotId, additionalSec, now = Date.now() } = options;
  const slot = getSpeedDateSlot(store, slotId);
  if (!slot) throw new Error(`extendSpeedDate: no speed date slot with id ${slotId}`);
  if (slot.extended) throw new Error(`extendSpeedDate: slot ${slotId} has already been extended once`);
  if (!Number.isInteger(additionalSec) || additionalSec <= 0) throw new Error('extendSpeedDate requires a positive integer additionalSec');

  slot.durationSec += additionalSec;
  slot.extended = true;
  slot.extendedAt = now;
  return slot;
}

function isGroupSlot(slot) {
  return slot.participants.length > 2;
}

// Real, deterministic round-robin: every participant meets every other
// participant exactly once -- the real, literal implementation of
// "rotating" for a 2v1/3v1 group slot.
function generateRotationSchedule(store, options = {}) {
  const { slotId } = options;
  const slot = getSpeedDateSlot(store, slotId);
  if (!slot) throw new Error(`generateRotationSchedule: no speed date slot with id ${slotId}`);
  if (!isGroupSlot(slot)) throw new Error(`generateRotationSchedule: slot ${slotId} has only ${slot.participants.length} participants, not a real group slot`);

  const rounds = [];
  const { participants } = slot;
  for (let i = 0; i < participants.length; i += 1) {
    for (let j = i + 1; j < participants.length; j += 1) {
      rounds.push({ userAId: participants[i], userBId: participants[j] });
    }
  }
  return rounds;
}

module.exports = {
  SPEED_DATE_FORMATS,
  DEFAULT_SPEED_DATE_DURATION_SEC,
  scheduleSpeedDate,
  getSpeedDateSlot,
  extendSpeedDate,
  isGroupSlot,
  generateRotationSchedule,
};
