// VAVLT STVDIOS -- Channel Chat.
// Source of truth: `VAULT_STUDIOS_ARCHITECTURE.md`'s own `ChannelChat
// { id, channelId, messages: [{ userId, text, timestamp }] }` --
// explicitly "EVERY channel has its own independent chat, not one
// shared chat per business." A channel's chat is created alongside
// the channel itself in `lib/channels.js`'s own `createChannel`, not
// lazily on first message, so `getChannelChat` never has to handle a
// real channel with no chat record.

const { getChannel } = require('./channels');

function getChannelChat(store, channelId) {
  return store.channelChats.find((c) => c.channelId === channelId) || null;
}

function postMessage(store, options = {}) {
  const {
    channelId, userId, text, now = Date.now(),
  } = options;

  if (!getChannel(store, channelId)) throw new Error(`postMessage: no channel with id ${channelId}`);
  if (!userId) throw new Error('postMessage requires a userId');
  if (!text) throw new Error('postMessage requires a non-empty text');

  const chat = getChannelChat(store, channelId);
  if (!chat) throw new Error(`postMessage: channel ${channelId} has no chat record (should never happen)`);

  const message = { userId, text, timestamp: now };
  chat.messages.push(message);
  return message;
}

function getMessages(store, channelId) {
  const chat = getChannelChat(store, channelId);
  if (!chat) throw new Error(`getMessages: no chat for channel ${channelId}`);
  return chat.messages;
}

module.exports = { getChannelChat, postMessage, getMessages };
