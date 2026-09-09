// VAVLT STVDIOS -- Channel Tips.
// Source of truth: `VAULT_STUDIOS_IG_LAYER.md`'s own `ChannelTip { id,
// channelId, tipperId, amountVCoin, recipientPersonId }` and its own
// framing: "A viewer watching a specific channel tips that specific
// person directly, not the business as a whole." The real, structural
// point this whole module exists to prove: `recipientPersonId` is a
// real, distinct person, not the channel's own `ownerId` (the
// business) -- a doorman with his own camera earns his own tips even
// though the barbershop or club owns the channel itself. Real,
// direct VCoin transfer via an injected `transferFn`, the same
// pattern established across this entire session -- no escrow, no
// platform cut modeled here (the doc names an 80/20 creator-favor
// split for locked-content subscriptions specifically, not tips; a
// real fee on tips isn't specified anywhere, so none is invented).

const { getChannel } = require('./channels');

async function tipChannel(store, options = {}) {
  const {
    channelId, tipperId, recipientPersonId, amountVCoin, transferFn, now = Date.now(),
  } = options;

  if (!getChannel(store, channelId)) throw new Error(`tipChannel: no channel with id ${channelId}`);
  if (!tipperId) throw new Error('tipChannel requires a tipperId');
  if (!recipientPersonId) throw new Error('tipChannel requires a recipientPersonId');
  if (!Number.isFinite(amountVCoin) || amountVCoin <= 0) throw new Error('tipChannel requires a positive amountVCoin');
  if (typeof transferFn !== 'function') throw new Error('tipChannel requires a transferFn(fromUserId, toUserId, amount, reason)');

  const tipId = store.nextChannelTipId++;
  // The real, direct payout: straight to the specific person, never
  // routed through the channel's own ownerId.
  await transferFn(tipperId, recipientPersonId, amountVCoin, `vavlt_stvdios_tip:${channelId}:${tipId}`);

  const tip = {
    id: tipId, channelId, tipperId, amountVCoin, recipientPersonId, createdAt: now,
  };
  store.channelTips.push(tip);
  return tip;
}

function getTipsForChannel(store, channelId) {
  return store.channelTips.filter((t) => t.channelId === channelId);
}

// Real proof of the doc's own "every role becomes its own earner"
// point -- a real, queryable total independent of which channel(s) a
// person's tips came in through, since the same person could
// conceivably run more than one channel.
function getTotalTipsForPerson(store, recipientPersonId) {
  return store.channelTips
    .filter((t) => t.recipientPersonId === recipientPersonId)
    .reduce((sum, t) => sum + t.amountVCoin, 0);
}

module.exports = { tipChannel, getTipsForChannel, getTotalTipsForPerson };
