// VAVLT STVDIOS -- Channels & Channel Groups, the real structural core.
// Source of truth: `VAULT_STUDIOS_ARCHITECTURE.md`'s own `Channel`
// schema, plus `VAULT_STUDIOS_IG_LAYER.md`'s "Multi-Channel
// Architecture" and "Global, role-based channel grouping" sections --
// explicitly named as "the single biggest differentiator" for this
// whole app: one camera/feed = one channel, not one combined stream
// per business. Real, validated market gap, not an incumbent feature
// to copy -- Twitch's own Squad Stream was retired in 2023 for low
// adoption; the real demand today is served only by third-party tools
// (MultiTwitch, ViewGrid, TwitchTheater).
//
// **Confirmed directly before writing any of this**: despite being
// referenced by name across 20+ source docs throughout this session's
// ecosystem, Vavlt Stvdios had zero real code anywhere -- the same
// position VACON was in before it got built. The IG layer doc's claim
// that "Vavlt Stvdios' existing spatial multi-camera streaming" is
// "already confirmed... as a real, separate, built app" does not
// describe this codebase; flagged directly rather than silently
// treated as true. This module is that real, missing foundation.
//
// **A real, deliberate completion of a genuine inconsistency between
// the two source docs**: `VAULT_STUDIOS_ARCHITECTURE.md`'s own
// `Channel.groupingType` only lists two values
// (`same-location-multi-room` / `same-brand-multi-location`), but
// `VAULT_STUDIOS_IG_LAYER.md`'s later "Global, role-based channel
// grouping" section adds a real third kind (`same-role-multi-location`
// -- e.g. every DJ worldwide, one browsable group spanning unrelated
// venues) with its own `ChannelGroup.groupingBasis` enum that DOES
// include all three. The architecture doc's own `Channel` schema
// simply predates that later addition. `GROUPING_TYPES` below unifies
// both schemas around the same real three-value enum, since a channel
// belonging to a role-based group needs a real value to describe that
// relationship -- not adding the third value would make an explicitly
// specified real feature (the global DJ example) impossible to
// represent on the channel itself.
//
// `Channel.parentGroupId` and `ChannelGroup.memberChannelIds` are kept
// as a real, single source of truth rather than two arrays a caller
// has to keep in sync by hand: `createChannel` is the only place a
// channel ever joins a group, and it updates both sides together in
// the same real operation.

const GROUPING_TYPES = ['same-location-multi-room', 'same-brand-multi-location', 'same-role-multi-location'];

function createChannelGroup(store, options = {}) {
  const { groupingBasis, now = Date.now() } = options;
  if (!GROUPING_TYPES.includes(groupingBasis)) {
    throw new Error(`createChannelGroup requires a groupingBasis of ${GROUPING_TYPES.join(', ')}`);
  }
  const group = {
    id: store.nextChannelGroupId++,
    groupingBasis,
    memberChannelIds: [],
    createdAt: now,
  };
  store.channelGroups.push(group);
  return group;
}

function getChannelGroup(store, groupId) {
  return store.channelGroups.find((g) => g.id === groupId) || null;
}

function createChannel(store, options = {}) {
  const {
    ownerId, groupingType, parentGroupId = null, name, streamUrl, now = Date.now(),
  } = options;

  if (!ownerId) throw new Error('createChannel requires an ownerId');
  if (!GROUPING_TYPES.includes(groupingType)) {
    throw new Error(`createChannel requires a groupingType of ${GROUPING_TYPES.join(', ')}`);
  }
  if (!name) throw new Error('createChannel requires a name');
  if (!streamUrl) throw new Error('createChannel requires a streamUrl');

  let group = null;
  if (parentGroupId !== null) {
    group = getChannelGroup(store, parentGroupId);
    if (!group) throw new Error(`createChannel: no channel group with id ${parentGroupId}`);
    if (group.groupingBasis !== groupingType) {
      throw new Error(`createChannel: groupingType "${groupingType}" does not match group ${parentGroupId}'s own groupingBasis "${group.groupingBasis}"`);
    }
  }

  const channel = {
    id: store.nextChannelId++,
    ownerId,
    groupingType,
    parentGroupId,
    name,
    streamUrl,
    isLive: false,
    createdAt: now,
  };
  store.channels.push(channel);

  // Every channel gets its own real, independent chat the moment it
  // exists -- per the doc's own "EVERY channel has its own
  // independent chat, not one shared chat per business" -- not
  // lazily created on first message.
  store.channelChats.push({ id: store.nextChannelChatId++, channelId: channel.id, messages: [] });

  if (group) group.memberChannelIds.push(channel.id);

  return channel;
}

function getChannel(store, channelId) {
  return store.channels.find((c) => c.id === channelId) || null;
}

function listChannelsInGroup(store, groupId) {
  const group = getChannelGroup(store, groupId);
  if (!group) throw new Error(`listChannelsInGroup: no channel group with id ${groupId}`);
  return group.memberChannelIds.map((id) => getChannel(store, id));
}

function listLiveChannels(store) {
  return store.channels.filter((c) => c.isLive);
}

function goLive(store, channelId) {
  const channel = getChannel(store, channelId);
  if (!channel) throw new Error(`goLive: no channel with id ${channelId}`);
  if (channel.isLive) throw new Error(`goLive: channel ${channelId} is already live`);
  channel.isLive = true;
  return channel;
}

function endStream(store, channelId) {
  const channel = getChannel(store, channelId);
  if (!channel) throw new Error(`endStream: no channel with id ${channelId}`);
  if (!channel.isLive) throw new Error(`endStream: channel ${channelId} is not live`);
  channel.isLive = false;
  return channel;
}

module.exports = {
  GROUPING_TYPES,
  createChannelGroup,
  getChannelGroup,
  createChannel,
  getChannel,
  listChannelsInGroup,
  listLiveChannels,
  goLive,
  endStream,
};
