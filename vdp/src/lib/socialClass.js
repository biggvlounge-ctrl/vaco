// VDP — a real social class read, and the real relocation gate it
// feeds.
//
// Per direct instruction (9 Oct 2026): "once more people start to
// enter the economy, people that start to accumulate tickets, crime,
// or face deportation, or have a certain social class level, I guess
// we need some type of class level, they will be moved out to... a
// project style, public housing style environment."
//
// **A read, never stored, same discipline `traits.js`'s own `tagsFor`
// documents.** Class is computed fresh from real, already-kept records
// — `demographics.js`'s income level, `justice.js`'s own unpaid
// tickets and active detention, `elite.js`'s own `isElite` — never a
// second, independently-drifting field on a person. Storing it would
// risk exactly the "two disagreeing answers to the same question"
// failure this ecosystem's own standing rules warn about: a stored
// class could go stale the moment a ticket gets paid off, while a
// computed one never can.
//
// **Flagged interpretive**: no document gives VDP a real class
// taxonomy or a real ticket-count threshold. `SOCIAL_CLASSES` and
// `RELOCATION_UNPAID_TICKET_THRESHOLD` are chosen, not derived, on the
// same footing every other unspecified number in this app already
// stands on (`justice.js`'s own `TICKET_FINE`).
//
// **Distinct from deportation.** `immigration.js`'s `deportPerson`
// is a real, separate, more severe path that only applies to a
// tracked illegal arrival. Relocation to public housing is the new,
// lesser consequence this instruction asks for, and it applies to
// anyone -- citizen or migrant -- whose real standing drops, not only
// someone with an arrival record.

export const SOCIAL_CLASSES = ['elite', 'stable', 'at-risk'];

// Three unpaid tickets, same scale `security.js`'s own `DEFAULT_
// SECURITY_TIERS` uses for its own first real escalation step
// ("Elevated" at 5) -- set lower here because this is a per-person
// threshold, not a settlement-wide crime count.
export const RELOCATION_UNPAID_TICKET_THRESHOLD = 3;

// A real derived class for one person, from inputs the caller already
// has on hand (never looked up here -- this module imports nothing,
// the same decoupled-by-injection shape every cross-module read in
// this directory already uses).
export function classify({
  isElite = false, incomeLevelName = null, maxAffordablePropertyLevel = null,
  unpaidTicketCount = 0, isDetained = false,
} = {}) {
  if (isElite) return 'elite';

  const lowIncome = incomeLevelName === 'low'
    || (Number.isFinite(maxAffordablePropertyLevel) && maxAffordablePropertyLevel === 0);

  if (isDetained) return 'at-risk';
  if (unpaidTicketCount >= RELOCATION_UNPAID_TICKET_THRESHOLD) return 'at-risk';
  // A low-income person with even one open ticket is a real
  // compounding risk a merely-low-income person without one is not --
  // "accumulate tickets... or have a certain social class level" names
  // both as real, separate triggers, and this is where they combine.
  if (lowIncome && unpaidTicketCount >= 1) return 'at-risk';

  return 'stable';
}

export function shouldRelocateToProjectHousing(socialClass) {
  return socialClass === 'at-risk';
}
