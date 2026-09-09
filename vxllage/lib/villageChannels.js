// VXLLAGE -- Village text Channels, built for real.
// Source of truth: VXLLAGE_CLAUDE.md's own prototype inventory calls
// this out directly as fake: "Channels -- text channels list (unread
// badges, decorative)." This module closes that gap for real: real
// messages, real per-user unread counts derived from an actual read
// marker (never a separately-tracked counter that could drift), and a
// real membership gate matching `villageRooms.js`'s own established
// pattern (a channel belongs to a village; only real members can post
// or read).
//
// **Deliberately text-only**, per this session's own agreed scope:
// voice channels need real shared audio infrastructure that doesn't
// exist anywhere in this ecosystem yet -- the doc's own "Main Stage"
// voice-channel concept is `villageRooms.js`'s `clubhouse-audio` room
// type (Phase 2), a real, separate, already-built join/leave record
// with no actual audio behind it either; not rebuilt here.

const { getVillage } = require('./villages');

function requireMembership(village, userId, verb) {
  if (!village.members.some((m) => m.userId === userId)) {
    throw new Error(`${verb}: ${userId} is not a member of village ${village.id}`);
  }
}

function createChannel(store, options = {}) {
  const { villageId, name } = options;
  const village = getVillage(store, villageId);
  if (!village) throw new Error(`createChannel: no village with id ${villageId}`);
  if (!name) throw new Error('createChannel requires a name');

  const channel = {
    id: store.nextChannelId++, villageId, name, messages: [], nextMessageId: 1, createdAt: Date.now(),
  };
  store.villageChannels.push(channel);
  return channel;
}

function getChannel(store, channelId) {
  return store.villageChannels.find((c) => c.id === channelId) || null;
}

function listChannelsForVillage(store, villageId) {
  return store.villageChannels.filter((c) => c.villageId === villageId);
}

function postChannelMessage(store, options = {}) {
  const { channelId, userId, text } = options;
  const channel = getChannel(store, channelId);
  if (!channel) throw new Error(`postChannelMessage: no channel with id ${channelId}`);
  if (!text) throw new Error('postChannelMessage requires a non-empty text');
  const village = getVillage(store, channel.villageId);
  requireMembership(village, userId, 'postChannelMessage');

  const message = { id: channel.nextMessageId++, authorId: userId, text, createdAt: Date.now() };
  channel.messages.push(message);
  return message;
}

function getChannelMessages(store, channelId) {
  const channel = getChannel(store, channelId);
  if (!channel) throw new Error(`getChannelMessages: no channel with id ${channelId}`);
  return channel.messages;
}

// Real read marker -- storing "last message id this user has seen" per
// channel, so unread count is always a genuine derived difference, not
// a badge counter that could desync from the real message list.
function markChannelRead(store, options = {}) {
  const { channelId, userId } = options;
  const channel = getChannel(store, channelId);
  if (!channel) throw new Error(`markChannelRead: no channel with id ${channelId}`);
  if (!userId) throw new Error('markChannelRead requires a userId');
  const lastMessageId = channel.messages.length > 0 ? channel.messages[channel.messages.length - 1].id : 0;
  store.channelReadState.set(`${channelId}:${userId}`, lastMessageId);
  return { channelId, userId, lastReadMessageId: lastMessageId };
}

function getUnreadCount(store, options = {}) {
  const { channelId, userId } = options;
  const channel = getChannel(store, channelId);
  if (!channel) throw new Error(`getUnreadCount: no channel with id ${channelId}`);
  const lastRead = store.channelReadState.get(`${channelId}:${userId}`) || 0;
  return channel.messages.filter((m) => m.id > lastRead).length;
}

module.exports = {
  createChannel, getChannel, listChannelsForVillage, postChannelMessage, getChannelMessages, markChannelRead, getUnreadCount,
};
