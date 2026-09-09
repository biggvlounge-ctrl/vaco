// VAVLT STVDIOS -- Screen Sessions, the "up to 8 interactive screens"
// mechanic named directly by the user as the platform's own defining
// idea (comparables named directly: YouTube, Instagram, Patreon,
// OnlyFans, Kick, Twitch). See README.md's own repositioning section
// for the full comparable-by-comparable breakdown -- in short, every
// other real mechanic already built here (Channels ~ YouTube, the
// Post/Feed/Stories/Reels layer ~ Instagram, LockedContentTier ~
// Patreon/OnlyFans, ChannelTip ~ Kick/Twitch) already answers one
// comparable each. None of them let a single session genuinely compose
// several independently-interactive live channels together -- Twitch's
// own attempt (Squad Stream) was retired, and today's real demand is
// served only by third-party tools (MultiTwitch, ViewGrid,
// TwitchTheater) that just embed multiple players side by side with
// none of the per-screen chat/tip context Phase 1 already built here.
//
// **Real, deliberately unified mechanic, per direct instruction**: the
// same `ScreenSession` shape serves both directions the user named --
// a broadcaster composing up to 8 of their OWN channels into one
// presented session (e.g. eight camera angles across one venue), and a
// viewer freely combining up to 8 channels from ANY owners into their
// own personal multi-view session (the real MultiTwitch/ViewGrid gap).
// `sessionType` is the one real structural difference between them:
// a `broadcaster` session enforces every included channel is actually
// owned by the session's own `ownerId`; a `viewer` session has no such
// constraint, since combining channels across unrelated owners is the
// entire point.
//
// **Real, honest limit of what "interactive" means here**: a screen
// session is a real, structural grouping of channels that are each
// ALREADY independently interactive (their own chat via
// `channelChat.js`, their own tippable person via `channelTips.js`,
// both proven live in Phase 1) -- not a new, separate video-wall
// compositing engine. There is no source doc or instruction describing
// real synced multi-stream video composition, and none is invented
// here; see README.md's own "Not yet built" for the honest line.

const { getChannel } = require('./channels');

const MAX_SCREENS = 8;
const SESSION_TYPES = ['broadcaster', 'viewer'];

function createScreenSession(store, options = {}) {
  const {
    sessionType, ownerId, channelIds = [], now = Date.now(),
  } = options;

  if (!SESSION_TYPES.includes(sessionType)) {
    throw new Error(`createScreenSession requires a sessionType of ${SESSION_TYPES.join(', ')}`);
  }
  if (!ownerId) throw new Error('createScreenSession requires an ownerId');
  if (!Array.isArray(channelIds) || channelIds.length < 1 || channelIds.length > MAX_SCREENS) {
    throw new Error(`createScreenSession requires 1-${MAX_SCREENS} channelIds`);
  }
  if (new Set(channelIds).size !== channelIds.length) {
    throw new Error('createScreenSession: channelIds must not contain duplicates');
  }

  const channels = channelIds.map((channelId) => {
    const channel = getChannel(store, channelId);
    if (!channel) throw new Error(`createScreenSession: no channel with id ${channelId}`);
    return channel;
  });

  if (sessionType === 'broadcaster') {
    const foreign = channels.find((c) => c.ownerId !== ownerId);
    if (foreign) {
      throw new Error(`createScreenSession: a broadcaster session cannot include channel ${foreign.id}, which is not owned by ${ownerId}`);
    }
  }

  const session = {
    id: store.nextScreenSessionId++,
    sessionType,
    ownerId,
    channelIds: [...channelIds],
    createdAt: now,
  };
  store.screenSessions.push(session);
  return session;
}

function getScreenSession(store, sessionId) {
  return store.screenSessions.find((s) => s.id === sessionId) || null;
}

function addScreenToSession(store, sessionId, channelId) {
  const session = getScreenSession(store, sessionId);
  if (!session) throw new Error(`addScreenToSession: no screen session with id ${sessionId}`);
  if (session.channelIds.length >= MAX_SCREENS) {
    throw new Error(`addScreenToSession: session ${sessionId} already has the max ${MAX_SCREENS} screens`);
  }
  if (session.channelIds.includes(channelId)) {
    throw new Error(`addScreenToSession: channel ${channelId} is already in session ${sessionId}`);
  }
  const channel = getChannel(store, channelId);
  if (!channel) throw new Error(`addScreenToSession: no channel with id ${channelId}`);
  if (session.sessionType === 'broadcaster' && channel.ownerId !== session.ownerId) {
    throw new Error(`addScreenToSession: a broadcaster session cannot include channel ${channelId}, which is not owned by ${session.ownerId}`);
  }
  session.channelIds.push(channelId);
  return session;
}

function removeScreenFromSession(store, sessionId, channelId) {
  const session = getScreenSession(store, sessionId);
  if (!session) throw new Error(`removeScreenFromSession: no screen session with id ${sessionId}`);
  const idx = session.channelIds.indexOf(channelId);
  if (idx === -1) throw new Error(`removeScreenFromSession: channel ${channelId} is not in session ${sessionId}`);
  session.channelIds.splice(idx, 1);
  return session;
}

function listScreenSessionsForOwner(store, ownerId) {
  return store.screenSessions.filter((s) => s.ownerId === ownerId);
}

// The real, composed read: each screen paired with its own already-
// independent channel record (and, through it, its own chat and its
// own tippable person) -- proving the session is a real grouping of
// genuinely interactive units, not a flattened, de-interactified view.
function getScreenSessionWithChannels(store, sessionId) {
  const session = getScreenSession(store, sessionId);
  if (!session) return null;
  return { ...session, screens: session.channelIds.map((channelId) => getChannel(store, channelId)) };
}

module.exports = {
  MAX_SCREENS,
  SESSION_TYPES,
  createScreenSession,
  getScreenSession,
  addScreenToSession,
  removeScreenFromSession,
  listScreenSessionsForOwner,
  getScreenSessionWithChannels,
};
