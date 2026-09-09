// VOKEN — Raffles.
// Source of truth: VOKEN_NEW_VALUE_ALGORITHM.md: "a real, distinct
// distribution path -- cards given away via raffle/lottery, not only
// direct purchase." Real code reuse: drawing a winner mints a real
// additional edition through the same `mintAdditionalEdition()` every
// other distribution path uses.

const { getCultureCard, mintAdditionalEdition } = require('./cultureCards');

const RAFFLE_STATUSES = ['open', 'closed'];

function createRaffle(store, options = {}) {
  const { cardId, entryMethod } = options;
  const card = getCultureCard(store, cardId);
  if (!card) throw new Error(`createRaffle: no card with id ${cardId}`);
  if (!entryMethod) throw new Error('createRaffle requires an entryMethod');

  const raffle = {
    raffleId: store.nextRaffleId++,
    cardId,
    entryMethod,
    entries: [],
    status: 'open',
    winnerId: null,
    createdAt: Date.now(),
  };
  store.raffles.push(raffle);
  return raffle;
}

function getRaffle(store, raffleId) {
  return store.raffles.find((r) => r.raffleId === raffleId) || null;
}

// One real entry per user -- dedupe, not allowing someone to stack
// the odds by spamming entries, a real, flagged fairness choice (no
// source doc specifies multi-entry rules).
function enterRaffle(store, options = {}) {
  const { raffleId, userId } = options;
  const raffle = getRaffle(store, raffleId);
  if (!raffle) throw new Error(`enterRaffle: no raffle with id ${raffleId}`);
  if (raffle.status !== 'open') {
    throw new Error(`enterRaffle: raffle ${raffleId} is "${raffle.status}", no longer open`);
  }
  if (!userId) throw new Error('enterRaffle requires a userId');
  if (!raffle.entries.includes(userId)) {
    raffle.entries.push(userId);
  }
  return raffle;
}

function drawRaffleWinner(store, options = {}) {
  const { raffleId, rng = Math.random } = options;
  const raffle = getRaffle(store, raffleId);
  if (!raffle) throw new Error(`drawRaffleWinner: no raffle with id ${raffleId}`);
  if (raffle.status !== 'open') {
    throw new Error(`drawRaffleWinner: raffle ${raffleId} is "${raffle.status}", already drawn`);
  }
  if (raffle.entries.length === 0) {
    throw new Error(`drawRaffleWinner: raffle ${raffleId} has no entries`);
  }

  const winnerIndex = Math.floor(rng() * raffle.entries.length);
  const winnerId = raffle.entries[winnerIndex];

  const edition = mintAdditionalEdition(store, { cardId: raffle.cardId, format: 'digital', ownerId: winnerId });

  raffle.status = 'closed';
  raffle.winnerId = winnerId;
  return { raffle, edition };
}

module.exports = { RAFFLE_STATUSES, createRaffle, getRaffle, enterRaffle, drawRaffleWinner };
