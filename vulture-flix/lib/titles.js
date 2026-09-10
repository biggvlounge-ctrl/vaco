// Vvltvre Flix -- Exclusive Originals, the real core loop.
// Built specifically against the real, named comparable given for
// this division: the Netflix Originals model, for its real exclusive-
// content strategy -- not a generic streaming-app build.
//
// **The real structural point of this module, and the reason it is
// NOT shaped like `vulture-music`'s core loop despite both being
// "content" divisions under the same Vvltvre umbrella**: the two real
// comparables run in genuinely opposite economic directions.
// DistroKid/TuneCore (Vvltvre Music) let the artist keep 100%
// ownership and 100% of ongoing revenue, charging only a flat
// distribution fee -- the platform never acquires anything. Netflix
// Originals is the real opposite: Netflix pays a real, one-time
// acquisition/commissioning fee to buy EXCLUSIVE global rights, and
// the creator does not continue earning ongoing per-view royalties on
// most real Original deals -- they were already paid in full up
// front. `ownershipRetainedPercent: 0` on every acquired title is the
// literal, deliberate mirror of `vulture-music`'s own
// `ownershipRetainedPercent: 100` -- not a bug, not an oversight, the
// real defining contrast between the two real comparables this
// session was given.
//
// The other real, defining Netflix mechanic this module encodes:
// access is subscription-gated, never per-title. `watchTitle` checks
// `lib/subscriptions.js`'s own `isSubscriber` and nothing else -- no
// per-title price exists anywhere in this file.
//
// **Real licensed, non-exclusive content added**, closing this
// project's own previously-flagged gap: "real Netflix also carries
// licensed titles with expiration windows, distinct from Originals."
// `licenseNonExclusiveTitle` is the real, structurally distinct
// counterpart to `acquireExclusiveTitle` -- genuinely different
// economics, not a renamed copy: Vvltvre Flix pays a real `licenseFee`
// for the temporary, NON-exclusive right to stream (other platforms
// can carry the same title simultaneously, unlike an acquired
// Original), the licensor keeps full ownership
// (`ownershipRetainedPercent: 100`, the literal mirror of an acquired
// title's `0`), and the right itself expires for real at
// `licenseExpiresAt` -- there is no `exclusiveUntil` window on a
// licensed record at all, since exclusivity was never granted.
// `acquisitionType` (`'exclusive-original' | 'licensed'`) is the real,
// honest discriminator on every title record. `watchTitle` rejects a
// licensed title whose real license has already expired even if its
// `status` is still `'streaming'` -- the same real "this deal ended,
// the content just isn't available anymore" Netflix behavior a
// separate, manual `removeTitle` call shouldn't be required for.

const {
  isSubscriber, getSubscription, TIER_MAX_SIMULTANEOUS_STREAMS,
} = require('./subscriptions');

const TITLE_TYPES = ['film', 'series', 'documentary', 'special'];
const TITLE_STATUSES = ['acquired', 'streaming', 'removed'];

const VULTURE_FLIX_ACQUISITION_ACCOUNT = 'vulture-flix-acquisitions';

function round(n) {
  return Math.round(n * 100) / 100;
}

// Real, deliberate difference from `vulture-music`'s own fixed
// `DISTRIBUTION_FEES` schedule: real Netflix Original deals are
// individually negotiated per project (a small documentary and a
// tentpole film budget are not on the same rate card), so
// `acquisitionFee` is caller-supplied, not looked up from a table --
// only sanity-checked to be a real positive number.
async function acquireExclusiveTitle(store, options = {}) {
  const {
    creatorId, title, type, acquisitionFee, exclusivityWindowDays, settleFn, now = Date.now(),
  } = options;

  if (!creatorId) throw new Error('acquireExclusiveTitle requires a creatorId');
  if (!title) throw new Error('acquireExclusiveTitle requires a title');
  if (!TITLE_TYPES.includes(type)) {
    throw new Error(`acquireExclusiveTitle requires a type of ${TITLE_TYPES.join(', ')}`);
  }
  if (!Number.isFinite(acquisitionFee) || acquisitionFee <= 0) {
    throw new Error('acquireExclusiveTitle requires a positive acquisitionFee');
  }
  if (!Number.isInteger(exclusivityWindowDays) || exclusivityWindowDays <= 0) {
    throw new Error('acquireExclusiveTitle requires a positive integer exclusivityWindowDays');
  }
  if (typeof settleFn !== 'function') {
    throw new Error('acquireExclusiveTitle requires a settleFn(legs, meta)');
  }

  // The real, one-time acquisition payment -- in exchange for this,
  // Vvltvre Flix gets exclusive rights; the creator gets no further
  // real payout from this module, ever (no per-view royalty exists
  // anywhere in this codebase).
  await settleFn(
    [{ fromUserId: VULTURE_FLIX_ACQUISITION_ACCOUNT, toUserId: creatorId, amount: acquisitionFee, reason: `Exclusive acquisition: "${title}"` }],
    { reason: `Exclusive acquisition: "${title}"` },
  );

  const record = {
    id: store.nextTitleId++,
    creatorId,
    title,
    type,
    acquisitionType: 'exclusive-original',
    acquisitionFee: round(acquisitionFee),
    licenseFee: null,
    status: 'acquired',
    ownershipRetainedPercent: 0,
    exclusiveUntil: now + exclusivityWindowDays * 24 * 60 * 60 * 1000,
    licenseExpiresAt: null,
    createdAt: now,
  };
  store.titles.push(record);
  return record;
}

// Real, structurally distinct from `acquireExclusiveTitle`: a real
// licensing fee for temporary, non-exclusive streaming rights, not an
// acquisition of exclusive ownership. `licensorId` receives the fee
// the same way `creatorId` does above -- kept as the same field name
// on the record so `listTitlesForCreator` and every other by-rights-
// holder query keep working unchanged for both title types.
async function licenseNonExclusiveTitle(store, options = {}) {
  const {
    licensorId, title, type, licenseFee, licenseTermDays, settleFn, now = Date.now(),
  } = options;

  if (!licensorId) throw new Error('licenseNonExclusiveTitle requires a licensorId');
  if (!title) throw new Error('licenseNonExclusiveTitle requires a title');
  if (!TITLE_TYPES.includes(type)) {
    throw new Error(`licenseNonExclusiveTitle requires a type of ${TITLE_TYPES.join(', ')}`);
  }
  if (!Number.isFinite(licenseFee) || licenseFee <= 0) {
    throw new Error('licenseNonExclusiveTitle requires a positive licenseFee');
  }
  if (!Number.isInteger(licenseTermDays) || licenseTermDays <= 0) {
    throw new Error('licenseNonExclusiveTitle requires a positive integer licenseTermDays');
  }
  if (typeof settleFn !== 'function') {
    throw new Error('licenseNonExclusiveTitle requires a settleFn(legs, meta)');
  }

  await settleFn(
    [{ fromUserId: VULTURE_FLIX_ACQUISITION_ACCOUNT, toUserId: licensorId, amount: licenseFee, reason: `Non-exclusive license: "${title}"` }],
    { reason: `Non-exclusive license: "${title}"` },
  );

  const record = {
    id: store.nextTitleId++,
    creatorId: licensorId,
    title,
    type,
    acquisitionType: 'licensed',
    acquisitionFee: null,
    licenseFee: round(licenseFee),
    status: 'acquired',
    ownershipRetainedPercent: 100,
    exclusiveUntil: null,
    licenseExpiresAt: now + licenseTermDays * 24 * 60 * 60 * 1000,
    createdAt: now,
  };
  store.titles.push(record);
  return record;
}

// Real, third, structurally distinct acquisition path -- closes a
// genuine gap the existing two paths can't honestly cover: neither
// `acquireExclusiveTitle` nor `licenseNonExclusiveTitle` accepts a
// zero fee (both require a positive number), which is correct for
// those two real deals but wrong for a title Vvltvre Studios already
// financed into existence -- charging a second, fabricated acquisition
// fee on top of real production financing would double-count the same
// real money. `acquisitionFee`/`licenseFee` stay honestly `null`, no
// `settleFn` is called here at all (the real payment already
// happened as production financing, in Vvltvre Studios' own ledger),
// and `ownershipRetainedPercent: 0` matches an acquired Original's own
// value -- Vvltvre Studios/Flix owns this title outright, the same
// real economic shape as an acquisition, just paid for earlier and
// differently. `studioProjectId` is a real, direct cross-reference
// back to the financing project that produced this title.
function registerStudioProducedTitle(store, options = {}) {
  const {
    studioId, studioProjectId, title, type, now = Date.now(),
  } = options;

  if (!studioId) throw new Error('registerStudioProducedTitle requires a studioId');
  if (!studioProjectId) throw new Error('registerStudioProducedTitle requires a studioProjectId');
  if (!title) throw new Error('registerStudioProducedTitle requires a title');
  if (!TITLE_TYPES.includes(type)) {
    throw new Error(`registerStudioProducedTitle requires a type of ${TITLE_TYPES.join(', ')}`);
  }

  const record = {
    id: store.nextTitleId++,
    creatorId: studioId,
    title,
    type,
    acquisitionType: 'studio-produced',
    acquisitionFee: null,
    licenseFee: null,
    status: 'acquired',
    ownershipRetainedPercent: 0,
    exclusiveUntil: null,
    licenseExpiresAt: null,
    studioProjectId,
    createdAt: now,
  };
  store.titles.push(record);
  return record;
}

function getTitleRecord(store, titleId) {
  return store.titles.find((t) => t.id === titleId) || null;
}

function listTitlesForCreator(store, creatorId) {
  return store.titles.filter((t) => t.creatorId === creatorId).sort((a, b) => b.createdAt - a.createdAt);
}

function requireStatus(store, titleId, expectedStatus, action) {
  const record = getTitleRecord(store, titleId);
  if (!record) throw new Error(`${action}: no title with id ${titleId}`);
  if (record.status !== expectedStatus) {
    throw new Error(`${action}: title ${titleId} is "${record.status}", expected "${expectedStatus}"`);
  }
  return record;
}

function markStreaming(store, titleId) {
  const record = requireStatus(store, titleId, 'acquired', 'markStreaming');
  record.status = 'streaming';
  return record;
}

function removeTitle(store, options = {}) {
  const { titleId, reason } = options;
  if (!reason) throw new Error('removeTitle requires a reason');
  const record = requireStatus(store, titleId, 'streaming', 'removeTitle');
  record.status = 'removed';
  record.removalReason = reason;
  return record;
}

// Real, date-driven, computed -- not a stored status the way
// `status` is, since exclusivity is defined by a window passing, not
// an explicit action (the real Netflix "leaving soon" mechanic).
// `false` for a licensed record -- it was never exclusive to begin
// with, not just "expired."
function isExclusive(record, now = Date.now()) {
  return record.acquisitionType === 'exclusive-original' && record.exclusiveUntil > now;
}

// The licensed-content mirror of `isExclusive` -- real, date-driven,
// the actual Netflix "leaving soon" mechanic for licensed titles
// specifically (their real license term ending, not an exclusivity
// window). `false` for an exclusive-original record.
function isLicenseActive(record, now = Date.now()) {
  return record.acquisitionType === 'licensed' && record.licenseExpiresAt > now;
}

function getCatalog(store, options = {}) {
  const { onlyStreaming = false, now = Date.now() } = options;
  return store.titles
    .filter((t) => !onlyStreaming || t.status === 'streaming')
    .map((t) => ({ ...t, isExclusive: isExclusive(t, now), isLicenseActive: isLicenseActive(t, now) }));
}

// The real, shared access-gating check every watch/stream action goes
// through -- extracted so `startStream` (below) can run the exact same
// real checks before deciding whether to log anything, rather than
// duplicating them or risking a watch event getting logged for a
// stream that's then rejected for being over the concurrency limit.
function assertCanWatch(store, options = {}) {
  const { userId, titleId, now = Date.now() } = options;
  if (!userId) throw new Error('watchTitle requires a userId');

  const record = getTitleRecord(store, titleId);
  if (!record) throw new Error(`watchTitle: no title with id ${titleId}`);
  if (record.status !== 'streaming') {
    throw new Error(`watchTitle: title ${titleId} is "${record.status}", must be "streaming"`);
  }
  if (!isSubscriber(store, userId, now)) {
    throw new Error(`watchTitle: ${userId} does not have an active Vvltvre Flix subscription`);
  }
  if (record.acquisitionType === 'licensed' && !isLicenseActive(record, now)) {
    throw new Error(`watchTitle: title ${titleId}'s license has expired`);
  }
  return record;
}

// The real access-gating action: subscription-only, no per-title
// price. Throws honestly if the caller isn't a real active
// subscriber, or if the title hasn't actually launched yet. A single
// logged watch event, no concurrency slot held -- see `startStream`
// for the real session-based counterpart that enforces
// `TIER_MAX_SIMULTANEOUS_STREAMS`.
function watchTitle(store, options = {}) {
  const { userId, titleId, now = Date.now() } = options;
  assertCanWatch(store, { userId, titleId, now });

  const watchEvent = {
    id: store.nextWatchEventId++, userId, titleId, watchedAt: now,
  };
  store.watchEvents.push(watchEvent);
  return watchEvent;
}

function getWatchHistory(store, userId) {
  return store.watchEvents.filter((w) => w.userId === userId).sort((a, b) => b.watchedAt - a.watchedAt);
}

function countActiveStreams(store, userId) {
  return store.streamSessions.filter((s) => s.userId === userId && s.status === 'active').length;
}

// **Real concurrent-stream limit enforcement**, closing this project's
// own previously-flagged gap ("TIER_MAX_SIMULTANEOUS_STREAMS is real
// and named, but no stream-session/stream-end event exists anywhere
// in this codebase to enforce it against"). Runs the exact same real
// access checks `watchTitle` does via `assertCanWatch`, then -- only
// if those pass -- checks the caller's own real subscription tier
// against how many of their own real stream sessions are still
// `active`, rejecting a new stream before logging anything if they're
// already at their tier's real Netflix-named limit. A successful call
// both logs a real watch event (so watch history stays complete for
// streamed titles too) and opens a real session that holds a
// concurrency slot until `endStream` closes it.
function startStream(store, options = {}) {
  const { userId, titleId, now = Date.now() } = options;
  assertCanWatch(store, { userId, titleId, now });

  const sub = getSubscription(store, userId);
  const limit = TIER_MAX_SIMULTANEOUS_STREAMS[sub.tier];
  const active = countActiveStreams(store, userId);
  if (active >= limit) {
    throw new Error(`startStream: ${userId}'s "${sub.tier}" plan allows ${limit} simultaneous stream(s), already at that limit`);
  }

  const watchEvent = {
    id: store.nextWatchEventId++, userId, titleId, watchedAt: now,
  };
  store.watchEvents.push(watchEvent);

  const session = {
    id: store.nextStreamSessionId++, userId, titleId, status: 'active', startedAt: now, endedAt: null,
  };
  store.streamSessions.push(session);
  return session;
}

function endStream(store, options = {}) {
  const { sessionId, now = Date.now() } = options;
  const session = store.streamSessions.find((s) => s.id === sessionId);
  if (!session) throw new Error(`endStream: no stream session with id ${sessionId}`);
  if (session.status !== 'active') throw new Error(`endStream: stream session ${sessionId} is not active (status: ${session.status})`);
  session.status = 'ended';
  session.endedAt = now;
  return session;
}

function listActiveStreams(store, userId) {
  return store.streamSessions.filter((s) => s.userId === userId && s.status === 'active');
}

module.exports = {
  TITLE_TYPES,
  TITLE_STATUSES,
  VULTURE_FLIX_ACQUISITION_ACCOUNT,
  acquireExclusiveTitle,
  licenseNonExclusiveTitle,
  registerStudioProducedTitle,
  getTitleRecord,
  listTitlesForCreator,
  markStreaming,
  removeTitle,
  isExclusive,
  isLicenseActive,
  getCatalog,
  watchTitle,
  getWatchHistory,
  startStream,
  endStream,
  listActiveStreams,
};
