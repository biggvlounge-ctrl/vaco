// VDP — Justice: citations and detention.
//
// Direct instruction (8 Oct 2026): "people can get ticketed. They
// will be sent directly to their profile." and "people... can get
// locked up in... some type of futuristic glowing jail system, or
// would be more like an open area." The real mechanic is built here --
// a citation lands on a real person's own record, a detention is a
// real, named state with a start and (eventually) an end. Which of
// the two visual treatments ("or would be more like") is NOT decided
// by the instruction's own words, so no `cellType`/visual field is
// invented here -- see `VDP_FOUNDING.md`'s "still open" list.
//
// VACON-C's own `server/justice.js` already owns arrest/court/prison
// at civilization scale -- this is VDP's own small, real record of
// its own small world, the same "borrow the shape, not the scale"
// discipline `npcs.js`/`skills.js` already apply, not a second
// implementation of that system.
//
// `personId` works for a player or an NPC alike (`immigration.js`'s
// own `npc-<id>` convention for a migration wave's arrivals) --
// citations and detention are about the settlement catching someone,
// never about which kind of person they are.

// Flagged interpretive VCoin fine -- no document gives VDP a real one.
export const TICKET_FINE = 15;

export function createJusticeStore() {
  return {
    tickets: [], nextTicketId: 1,
    detentions: [], nextDetentionId: 1,
  };
}

// "Sent directly to their profile" -- a real record keyed to the
// person it's about, read back by `ticketsFor` the same way a
// player's own profile reads it (`server.cjs`/`MyStatusView.jsx`).
export function issueTicket(store, { personId, reason, issuedBy, now = Date.now() } = {}) {
  if (!personId) throw new Error('issueTicket requires a personId');
  if (!reason) throw new Error('issueTicket requires a reason');
  const ticket = {
    id: store.nextTicketId++,
    personId,
    reason,
    issuedBy: issuedBy || null,
    amountOwed: TICKET_FINE,
    paid: false,
    issuedAt: now,
  };
  store.tickets.push(ticket);
  return ticket;
}

export function ticketsFor(store, personId) {
  return store.tickets.filter((t) => t.personId === personId);
}

export function unpaidTicketsFor(store, personId) {
  return ticketsFor(store, personId).filter((t) => !t.paid);
}

// Claim-before-pay, same ordering as every other paid action in this
// directory: marked paid before the transfer is awaited, rolled back
// if the transfer then fails.
export async function payTicket(store, ticketId, { transferFn, now = Date.now() } = {}) {
  const ticket = store.tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error(`payTicket: no ticket #${ticketId}`);
  if (ticket.paid) throw new Error(`payTicket: ticket #${ticketId} is already paid`);
  if (typeof transferFn !== 'function') throw new Error('payTicket requires a transferFn');

  ticket.paid = true;
  ticket.paidAt = now;

  try {
    await transferFn({ fromUserId: ticket.personId, amount: ticket.amountOwed, reason: `vdp-ticket-${ticketId}` });
  } catch (err) {
    ticket.paid = false;
    delete ticket.paidAt;
    throw err;
  }

  return ticket;
}

// A real, named detention -- distinct from `catchIllegalArrival`
// (`immigration.js`), which only marks an existing illegal arrival
// record caught. Detention is a separate, deliberate act any real
// enforcement identity can take against any real person, legal
// standing or not -- a citizen can be detained too, the same way a
// real jail isn't only for people who crossed illegally.
export function detainPerson(store, { personId, reason, detainedBy, now = Date.now() } = {}) {
  if (!personId) throw new Error('detainPerson requires a personId');
  if (!reason) throw new Error('detainPerson requires a reason');
  if (store.detentions.some((d) => d.personId === personId && !d.releasedAt)) {
    throw new Error(`detainPerson: "${personId}" is already detained`);
  }
  const detention = {
    id: store.nextDetentionId++,
    personId,
    reason,
    detainedBy: detainedBy || null,
    detainedAt: now,
    releasedAt: null,
  };
  store.detentions.push(detention);
  return detention;
}

export function releasePerson(store, detentionId, { releasedBy, now = Date.now() } = {}) {
  const detention = store.detentions.find((d) => d.id === detentionId);
  if (!detention) throw new Error(`releasePerson: no detention #${detentionId}`);
  if (detention.releasedAt) throw new Error(`releasePerson: detention #${detentionId} is already released`);
  detention.releasedAt = now;
  detention.releasedBy = releasedBy || null;
  return detention;
}

export function isDetained(store, personId) {
  return store.detentions.some((d) => d.personId === personId && !d.releasedAt);
}

export function activeDetentionFor(store, personId) {
  return store.detentions.find((d) => d.personId === personId && !d.releasedAt) || null;
}

export function listActiveDetentions(store) {
  return store.detentions.filter((d) => !d.releasedAt);
}
