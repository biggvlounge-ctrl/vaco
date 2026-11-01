'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  VENUES, VENUE_PAYROLL_ACCOUNT, VenueError, listVenues, getVenue, createVenueStore, getBooking,
  bookVenue, setTicketPrice, sellTicket, eventFinance, bookingsByPromoter,
} from '../src/lib/venues.js';

function fakeTransferFn(ledger) {
  return async ({ fromUserId, toUserId, amount, reason }) => {
    ledger.push({ fromUserId, toUserId, amount, reason });
    return { ok: true };
  };
}

test('listVenues/getVenue expose the real, named catalog', () => {
  const venues = listVenues();
  assert.ok(venues.some((v) => v.id === 'combat-sports-gym'));
  assert.ok(venues.some((v) => v.id === 'downtown-stadium'));
  assert.throws(() => getVenue('made-up'), VenueError);
});

test('bookVenue charges the promoter the real rental cost before recording the booking', async () => {
  const store = createVenueStore();
  const ledger = [];
  const booking = await bookVenue(store, {
    promoterId: 'promoter-1', venueId: 'combat-sports-gym', label: 'Friday Night Fights',
    transferFn: fakeTransferFn(ledger),
  });
  assert.equal(booking.rentalCost, VENUES['combat-sports-gym'].rentalCostPerEvent);
  assert.equal(ledger.length, 1);
  assert.deepEqual(ledger[0], {
    fromUserId: 'promoter-1', toUserId: VENUE_PAYROLL_ACCOUNT,
    amount: VENUES['combat-sports-gym'].rentalCostPerEvent, reason: 'venue_rental:combat-sports-gym',
  });
  assert.equal(getBooking(store, booking.id).id, booking.id);
});

test('bookVenue refuses an unknown venue and never charges for it', async () => {
  const store = createVenueStore();
  const ledger = [];
  await assert.rejects(
    () => bookVenue(store, { promoterId: 'promoter-1', venueId: 'made-up', transferFn: fakeTransferFn(ledger) }),
    VenueError,
  );
  assert.equal(ledger.length, 0, 'an unknown venue must never charge anything');
});

test('bookVenue refuses with no transferFn, and requires a promoterId', async () => {
  const store = createVenueStore();
  await assert.rejects(() => bookVenue(store, { promoterId: 'p1', venueId: 'combat-sports-gym' }), /transferFn/);
  await assert.rejects(
    () => bookVenue(store, { venueId: 'combat-sports-gym', transferFn: fakeTransferFn([]) }),
    /promoterId/,
  );
});

test('setTicketPrice refuses anyone but the event\'s own promoter', async () => {
  const store = createVenueStore();
  const booking = await bookVenue(store, { promoterId: 'promoter-1', venueId: 'combat-sports-gym', transferFn: fakeTransferFn([]) });
  assert.throws(() => setTicketPrice(store, booking.id, 'someone-else', 10), /only this event's own promoter/);
  setTicketPrice(store, booking.id, 'promoter-1', 25);
  assert.equal(getBooking(store, booking.id).ticketPrice, 25);
});

test('setTicketPrice refuses a non-positive price', async () => {
  const store = createVenueStore();
  const booking = await bookVenue(store, { promoterId: 'promoter-1', venueId: 'combat-sports-gym', transferFn: fakeTransferFn([]) });
  assert.throws(() => setTicketPrice(store, booking.id, 'promoter-1', 0), /positive price/);
  assert.throws(() => setTicketPrice(store, booking.id, 'promoter-1', -5), /positive price/);
});

test('sellTicket refuses before a ticket price is set', async () => {
  const store = createVenueStore();
  const booking = await bookVenue(store, { promoterId: 'promoter-1', venueId: 'combat-sports-gym', transferFn: fakeTransferFn([]) });
  await assert.rejects(
    () => sellTicket(store, booking.id, { buyerId: 'fan-1', transferFn: fakeTransferFn([]) }),
    /no ticket price set yet/,
  );
});

test('sellTicket moves real VCoin from buyer to promoter directly, and increments ticketsSold', async () => {
  const store = createVenueStore();
  const booking = await bookVenue(store, { promoterId: 'promoter-1', venueId: 'combat-sports-gym', transferFn: fakeTransferFn([]) });
  setTicketPrice(store, booking.id, 'promoter-1', 25);
  const ledger = [];
  await sellTicket(store, booking.id, { buyerId: 'fan-1', transferFn: fakeTransferFn(ledger) });
  assert.deepEqual(ledger[0], { fromUserId: 'fan-1', toUserId: 'promoter-1', amount: 25, reason: `venue_ticket:${booking.id}` });
  assert.equal(getBooking(store, booking.id).ticketsSold, 1);
});

test('sellTicket refuses once the real venue capacity is sold out', async () => {
  const store = createVenueStore();
  // Use the gym's real small capacity directly, never hardcoded, so a
  // future catalog change cannot silently make this test meaningless.
  const capacity = VENUES['combat-sports-gym'].capacity;
  const booking = await bookVenue(store, { promoterId: 'promoter-1', venueId: 'combat-sports-gym', transferFn: fakeTransferFn([]) });
  setTicketPrice(store, booking.id, 'promoter-1', 10);
  for (let i = 0; i < capacity; i += 1) {
    await sellTicket(store, booking.id, { buyerId: `fan-${i}`, transferFn: fakeTransferFn([]) });
  }
  await assert.rejects(
    () => sellTicket(store, booking.id, { buyerId: 'fan-overflow', transferFn: fakeTransferFn([]) }),
    /sold out/,
  );
});

test('eventFinance computes real revenue, cost, and net profit fresh from the booking', async () => {
  const store = createVenueStore();
  const booking = await bookVenue(store, { promoterId: 'promoter-1', venueId: 'combat-sports-gym', transferFn: fakeTransferFn([]) });
  setTicketPrice(store, booking.id, 'promoter-1', 25);
  for (let i = 0; i < 10; i += 1) {
    await sellTicket(store, booking.id, { buyerId: `fan-${i}`, transferFn: fakeTransferFn([]) });
  }
  const finance = eventFinance(store, booking.id);
  assert.equal(finance.rentalCost, 200);
  assert.equal(finance.ticketsSold, 10);
  assert.equal(finance.ticketRevenue, 250);
  assert.equal(finance.netProfit, 50);
});

test('eventFinance reports a real loss when ticket revenue never covers the rental cost', async () => {
  const store = createVenueStore();
  const booking = await bookVenue(store, { promoterId: 'promoter-1', venueId: 'combat-sports-gym', transferFn: fakeTransferFn([]) });
  setTicketPrice(store, booking.id, 'promoter-1', 5);
  await sellTicket(store, booking.id, { buyerId: 'fan-1', transferFn: fakeTransferFn([]) });
  const finance = eventFinance(store, booking.id);
  assert.equal(finance.netProfit, 5 - 200);
});

test('bookingsByPromoter lists only a real promoter\'s own events', async () => {
  const store = createVenueStore();
  await bookVenue(store, { promoterId: 'promoter-1', venueId: 'combat-sports-gym', transferFn: fakeTransferFn([]) });
  await bookVenue(store, { promoterId: 'promoter-2', venueId: 'downtown-stadium', transferFn: fakeTransferFn([]) });
  await bookVenue(store, { promoterId: 'promoter-1', venueId: 'downtown-stadium', transferFn: fakeTransferFn([]) });
  assert.equal(bookingsByPromoter(store, 'promoter-1').length, 2);
  assert.equal(bookingsByPromoter(store, 'promoter-2').length, 1);
});
