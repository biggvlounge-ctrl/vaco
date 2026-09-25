// VAGO -- Group Wagers, the narrowest real slice of
// `dev-docs/on-deck/VAGO_GROUP_WAGERS_FREEZE.md`, per its own §29
// mandatory audit (see `dev-docs/on-deck/README.md`, "The VAGO Group
// Wagers audit, 25 Sep 2026").
//
// **Not a second wagering engine.** §29's own rule: "do not create
// duplicate versions... reuse existing VACO/VAGO systems, build only
// the missing group-specific functionality." The audit found the
// freeze's own named prerequisites (Wager Contract Engine, Wager
// Graph, Odds Layer, Escrow Adapter, Resolution Engine) at zero files
// -- but found their real mechanics already built under a different
// name: `predictionMarkets.js`'s pari-mutuel pool already supports any
// number of participants staking on a proposition, already prices by
// real demand, already escrows through the real `VAGO_HOUSE_ACCOUNT`,
// and already resolves solvently with `settleOnce` protection against
// duplicate payout. A Group Wager here is a social/organizational
// frame around one real prediction market -- creator, name, entry
// deadline, participant cap, visibility, an optional linked VXLLAGE
// thread -- not a parallel pooling mechanic.
//
// **Binary only, by inheritance.** `predictionMarkets.js` is a
// yes/no market. "Who wins tonight?" maps onto that directly (yes =
// the named side); a group wager with more than two named outcomes
// would need a multi-outcome engine that does not exist, so that is
// out of scope here, not silently assumed away.
//
// **Scoped to §1's OPEN and PRIVATE types only**, the two the freeze
// itself defines by an access rule rather than by social context
// (FRIEND GROUP, COMMUNITY GROUP, CREATOR GROUP WAGER, TEAM GROUP
// WAGER and the rest are framing on top of the same open/private
// access shape, not a different mechanic -- building all eleven names
// as distinct types would be inventing categories the underlying
// access-control logic does not actually need).
//
// **Not built: tournaments, leagues, side wagers, team roles, a
// leaderboard, or QVAN-based group-risk monitoring.** Each of those
// needs a subsystem invented from nothing -- a bracket/standings
// engine, a wager-to-wager relationship, a real risk-analysis layer --
// which is the gap this session's own audits keep finding and keep
// refusing to paper over.
//
// **The invitation state machine, added 25 Sep 2026, is different.**
// It needs no external subsystem -- only a richer status on data this
// module already owns (`groupWager.invitedUserIds`), the same shape as
// HVNTZ's own Node invite/accept/decline. §13's own chain reads
// "Invited -> Viewed -> Joined -> Funded -> Locked -> Settled", six
// names, but `joinGroupWager` already does JOIN+FUND as one atomic
// `buyContract` call -- this file's own comment on that function
// already called that a feature ("no window where a participant is
// charged but not recorded"), so a per-invitation status that pretends
// a joined-not-yet-funded moment exists would invent a race this
// system deliberately does not have. `INVITATION_STATUSES` below is
// therefore `invited -> viewed -> funded` (three real states an
// invitee's own actions cause), and Locked/Settled are read from the
// group wager's own already-live-computed state
// (`isGroupWagerLocked`/`groupWager.status`) rather than copied onto
// the invitation -- the same "never a second copy of state that
// already exists elsewhere" rule this session applies everywhere else.

'use strict';

const { createPredictionMarket, buyContract, resolveMarket, getPredictionMarket } = require('./predictionMarkets');

const VISIBILITIES = ['open', 'private'];
const INVITATION_STATUSES = ['invited', 'viewed', 'funded'];

function findGroupWager(store, groupWagerId) {
  return store.groupWagers.find((g) => g.id === groupWagerId) || null;
}

// A group is locked once its own entry deadline passes, or once its
// underlying market is no longer open -- whichever comes first. Not a
// separately stored flag: a stored `locked: true` could drift from the
// deadline it is supposed to track, the same class of bug this
// session's own tap/passport work kept finding in other apps.
function isGroupWagerLocked(groupWager, market, now = Date.now()) {
  return now >= groupWager.entryDeadline || !market || market.status !== 'open';
}

function findInvitation(store, groupWagerId, userId) {
  return store.groupWagerInvitations.find(
    (i) => i.groupWagerId === groupWagerId && i.userId === userId,
  ) || null;
}

function invitationsForGroupWager(store, groupWagerId) {
  return store.groupWagerInvitations.filter((i) => i.groupWagerId === groupWagerId);
}

// Internal — both `createGroupWager` (for the initial list) and
// `inviteToGroupWager` (for later additions) create one of these; a
// caller never constructs the record shape directly.
function createInvitation(store, groupWagerId, userId, now) {
  if (findInvitation(store, groupWagerId, userId)) {
    throw new Error(`createInvitation: ${userId} is already invited to group wager ${groupWagerId}`);
  }
  const invitation = {
    id: store.nextGroupWagerInvitationId++,
    groupWagerId,
    userId,
    status: 'invited',
    invitedAt: now,
    viewedAt: null,
    fundedAt: null,
  };
  store.groupWagerInvitations.push(invitation);
  return invitation;
}

// Only the creator may invite past the initial list — the same
// ownership shape `linkGroupWagerThread`'s route already enforces, just
// checked at the route layer there and here in the function itself
// since there is no separate "existing" read needed first.
function inviteToGroupWager(store, options = {}) {
  const { groupWagerId, userId, invitedBy, now = Date.now() } = options;
  const groupWager = findGroupWager(store, groupWagerId);
  if (!groupWager) throw new Error(`inviteToGroupWager: no group wager ${groupWagerId}`);
  if (groupWager.visibility !== 'private') {
    throw new Error(`inviteToGroupWager: group wager ${groupWagerId} is not private — invitations only apply to private group wagers`);
  }
  if (String(invitedBy) !== String(groupWager.creatorId)) {
    throw new Error('inviteToGroupWager: only the creator may invite someone to this group wager');
  }
  if (!userId) throw new Error('inviteToGroupWager requires a userId');

  const invitation = createInvitation(store, groupWagerId, userId, now);
  if (!groupWager.invitedUserIds.includes(userId)) groupWager.invitedUserIds.push(userId);
  return invitation;
}

// The invitee's own action — §13's "Viewed" step. Idempotent: viewing
// again, or viewing after already funding, is a no-op rather than an
// error, since a real person re-opening a group wager they already
// joined is the normal case, not a mistake to reject.
function markInvitationViewed(store, options = {}) {
  const { groupWagerId, userId, now = Date.now() } = options;
  const invitation = findInvitation(store, groupWagerId, userId);
  if (!invitation) throw new Error(`markInvitationViewed: ${userId} has no invitation to group wager ${groupWagerId}`);
  if (invitation.status === 'invited') {
    invitation.status = 'viewed';
    invitation.viewedAt = now;
  }
  return invitation;
}

// Internal — called from `joinGroupWager` once `buyContract` actually
// succeeds, never before. A user who joins an OPEN group wager they
// were never invited to has no invitation record at all, which is
// correct: invitations track a private group's own guest list, not
// participation in general.
function advanceInvitationToFunded(store, groupWagerId, userId, now) {
  const invitation = findInvitation(store, groupWagerId, userId);
  if (!invitation) return null;
  invitation.status = 'funded';
  invitation.fundedAt = now;
  return invitation;
}

// A merged read, same reasoning as `groupWagerView`: the invitation's
// own three real states plus the group's already-live-computed
// locked/settled state, never copied onto the invitation itself.
function invitationView(store, groupWagerId, userId, options = {}) {
  const { now = Date.now() } = options;
  const invitation = findInvitation(store, groupWagerId, userId);
  if (!invitation) return null;
  const groupWager = findGroupWager(store, groupWagerId);
  const market = groupWager ? getPredictionMarket(store, groupWager.marketId) : null;
  return {
    ...invitation,
    groupWagerLocked: groupWager ? isGroupWagerLocked(groupWager, market, now) : null,
    groupWagerStatus: groupWager ? groupWager.status : null,
  };
}

// **§5's own worked example**: "A user creates: '$20 Group Bet — Who
// wins tonight?'" -- a real person, not a service. This deliberately
// diverges from `POST /api/markets`' own `requireCallingService()`
// gate (VAGO's real-world markets are curated by staff); Group Wagers
// is the freeze's own explicit case for a user-created market, and
// creating one decides nothing yet -- same reasoning server.js's own
// comment already gives for why creating an event needs no operator.
async function createGroupWager(store, options = {}) {
  const {
    creatorId, name, description = null, visibility = 'open',
    maxParticipants = null, entryDeadline, invitedUserIds = [],
    question, category, source, openingYesPrice, now = Date.now(),
  } = options;

  if (!creatorId) throw new Error('createGroupWager requires a creatorId');
  if (!name) throw new Error('createGroupWager requires a name');
  if (!VISIBILITIES.includes(visibility)) {
    throw new Error(`createGroupWager: visibility must be one of ${VISIBILITIES.join(', ')}`);
  }
  if (!Number.isFinite(entryDeadline) || entryDeadline <= now) {
    throw new Error('createGroupWager requires an entryDeadline in the future');
  }
  if (maxParticipants !== null && (!Number.isInteger(maxParticipants) || maxParticipants < 2)) {
    throw new Error('createGroupWager: maxParticipants must be an integer of at least 2, or omitted');
  }
  if (visibility === 'private' && invitedUserIds.length === 0) {
    throw new Error('createGroupWager: a private group wager needs at least one invited user');
  }

  // The market IS the group's stake/odds/escrow — §29's own rule.
  const market = createPredictionMarket(store, { question, category, source, creatorId, openingYesPrice });

  const groupWager = {
    id: store.nextGroupWagerId++,
    marketId: market.id,
    creatorId,
    name,
    description,
    visibility,
    maxParticipants,
    entryDeadline,
    invitedUserIds: visibility === 'private' ? [...invitedUserIds] : [],
    threadPostId: null,
    status: 'open', // open -> settled (there is no separate stored "locked": see isGroupWagerLocked)
    createdAt: now,
  };
  store.groupWagers.push(groupWager);

  // §13's invitation state machine starts here for every name on the
  // initial list — each gets a real 'invited' record, not just a bare
  // id sitting in `invitedUserIds`.
  for (const userId of groupWager.invitedUserIds) {
    createInvitation(store, groupWager.id, userId, now);
  }
  return groupWager;
}

// §5's JOIN → FUND → CONFIRM → LOCK. `buyContract` already does
// JOIN+FUND atomically (one settlement, no window where a participant
// is charged but not recorded); CONFIRM is the response this returns;
// LOCK is `isGroupWagerLocked`, checked before the purchase is allowed
// to happen at all.
async function joinGroupWager(store, options = {}) {
  const { groupWagerId, userId, side, quantity, settleFn, now = Date.now() } = options;
  const groupWager = findGroupWager(store, groupWagerId);
  if (!groupWager) throw new Error(`joinGroupWager: no group wager ${groupWagerId}`);
  const market = getPredictionMarket(store, groupWager.marketId);
  if (!market) throw new Error(`joinGroupWager: group wager ${groupWagerId} has no underlying market`);

  if (isGroupWagerLocked(groupWager, market, now)) {
    throw new Error(`joinGroupWager: group wager ${groupWagerId} is locked (entry deadline passed or market closed)`);
  }
  if (groupWager.visibility === 'private' && userId !== groupWager.creatorId && !groupWager.invitedUserIds.includes(userId)) {
    throw new Error(`joinGroupWager: ${userId} is not invited to this private group wager`);
  }
  if (groupWager.maxParticipants !== null) {
    const currentParticipants = new Set(market.contracts.map((c) => c.userId));
    if (!currentParticipants.has(userId) && currentParticipants.size >= groupWager.maxParticipants) {
      throw new Error(`joinGroupWager: group wager ${groupWagerId} is full (${groupWager.maxParticipants} participants)`);
    }
  }

  const result = await buyContract(store, { marketId: groupWager.marketId, userId, side, quantity, settleFn });
  // Only after the real settlement confirms — same "never recorded
  // before the ledger confirms" discipline as VASH TAP's payViaTap.
  // A no-op for the creator or an OPEN-group joiner with no invitation
  // record at all, which is correct: they were never on a guest list.
  advanceInvitationToFunded(store, groupWagerId, userId, now);
  return { groupWager, ...result };
}

// Links an already-created VXLLAGE post as this group's shared thread
// (§9). Deliberately does not create the post itself: VXLLAGE's own
// `POST /api/posts` is `requireActor('authorId')`, so only the
// author's own live session can create it -- VAGO has no session to
// forward on the caller's behalf without inventing a session-relay
// convention this ecosystem does not otherwise use. The creator posts
// through VXLLAGE's own real flow, then links it here.
function linkGroupWagerThread(store, options = {}) {
  const { groupWagerId, threadPostId, now = Date.now() } = options;
  const groupWager = findGroupWager(store, groupWagerId);
  if (!groupWager) throw new Error(`linkGroupWagerThread: no group wager ${groupWagerId}`);
  if (!threadPostId) throw new Error('linkGroupWagerThread requires a threadPostId');
  groupWager.threadPostId = threadPostId;
  groupWager.updatedAt = now;
  return groupWager;
}

// §15's settlement steps, in order: determine the outcome, calculate
// payout, release funds, record settlement -- all of it is
// `resolveMarket`, already solvent-by-construction and
// `settleOnce`-protected against duplicate payout. This only marks the
// group itself settled once the real resolution has completed.
async function resolveGroupWager(store, options = {}) {
  const { groupWagerId, outcome, settleFn, now = Date.now() } = options;
  const groupWager = findGroupWager(store, groupWagerId);
  if (!groupWager) throw new Error(`resolveGroupWager: no group wager ${groupWagerId}`);

  const result = await resolveMarket(store, { marketId: groupWager.marketId, outcome, settleFn });
  groupWager.status = 'settled';
  groupWager.settledAt = now;
  return { groupWager, ...result };
}

// A merged read: the group's own fields plus what only the underlying
// market can answer (locked, participant count) -- computed fresh
// rather than cached, same reasoning as `isGroupWagerLocked`.
function groupWagerView(store, groupWagerId, options = {}) {
  const { now = Date.now() } = options;
  const groupWager = findGroupWager(store, groupWagerId);
  if (!groupWager) return null;
  const market = getPredictionMarket(store, groupWager.marketId);
  const participantCount = market ? new Set(market.contracts.map((c) => c.userId)).size : 0;
  return {
    ...groupWager,
    locked: isGroupWagerLocked(groupWager, market, now),
    participantCount,
    market,
  };
}

function reseedIds(store) {
  const maxOf = (rows) => rows.reduce((max, r) => (r.id > max ? r.id : max), 0);
  store.nextGroupWagerId = maxOf(store.groupWagers) + 1;
  store.nextGroupWagerInvitationId = maxOf(store.groupWagerInvitations) + 1;
  return { nextGroupWagerId: store.nextGroupWagerId, nextGroupWagerInvitationId: store.nextGroupWagerInvitationId };
}

module.exports = {
  VISIBILITIES,
  INVITATION_STATUSES,
  findGroupWager,
  isGroupWagerLocked,
  createGroupWager,
  joinGroupWager,
  linkGroupWagerThread,
  resolveGroupWager,
  groupWagerView,
  findInvitation,
  invitationsForGroupWager,
  inviteToGroupWager,
  markInvitationViewed,
  invitationView,
  reseedIds,
};
