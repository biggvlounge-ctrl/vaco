// VENVM -- the real production pipeline status machine: script ->
// storyboard -> render-queued -> rendered. Real, enforced stage
// ordering (can't skip a stage, matching every other real state
// machine in this ecosystem -- VOID's job statuses, Vvltvre Flix's
// title lifecycle, etc.).
//
// **Real, honest ceiling, same posture as Vavlt Stvdios' own
// `streamUrl`**: `markRendered` accepts a real `videoUrl` field but
// never produces one itself -- no actual video-rendering
// infrastructure (Seedance/Kling/Runway/Nerfstudio-class tools, named
// only in a master index this repo doesn't actually contain) exists
// in this environment. A caller can mark a job "rendered" with a real
// external URL if one genuinely exists; VENVM itself cannot generate
// pixels.

const { requireConsent, ConsentError } = require('./likenessConsent');
const { assertRoutable, RoutingError } = require('./contentRouting');

const PRODUCTION_STAGES = ['script-ready', 'storyboard-ready', 'render-queued', 'rendered'];

// A job that depicts a real, identifiable person carries the subject
// and the scopes it needs. Consent is then re-checked at every stage
// that moves the job closer to a render -- not once at creation --
// because revocation must take effect on work already in flight. A
// person withdrawing consent should not have to wait for a queue to
// drain.
function enforceLikenessConsent(store, job, action, now) {
  if (!job.likenessSubjectId) return null;
  return requireConsent(store, {
    subjectId: job.likenessSubjectId,
    requestedScopes: job.likenessScopes,
    now,
    action,
  });
}

function createProductionJob(store, options = {}) {
  const {
    requesterApp, scriptRequestId = null, title, now = Date.now(),
    likenessSubjectId = null, likenessScopes = null,
    //: Routing, per THOUSAND_VIDEO_CONTENT_PLAN.md. Optional, because
    //: jobs predating the plan have neither and must keep working --
    //: but if either is given, both are required and the pair is
    //: checked. A destination with no duration cannot be tier-checked,
    //: and a duration with no destination checks nothing.
    destination = null, durationSeconds = null,
    //: The caller's own count of what each destination already holds.
    //: VENVM's job store is the record of what exists; a second tally
    //: inside contentRouting would be a second truth about one fact.
    produced = {},
  } = options;
  if (!requesterApp) throw new Error('createProductionJob requires a requesterApp');
  if (!title) throw new Error('createProductionJob requires a title');
  //: Both or neither. A subject without scopes would sail through the
  //: gate on an empty request, which is the failure mode most likely
  //: to happen by accident rather than by intent.
  if (likenessSubjectId && (!Array.isArray(likenessScopes) || likenessScopes.length === 0)) {
    throw new ConsentError(
      'createProductionJob: a job naming a likenessSubjectId must also declare likenessScopes -- '
      + 'what this render will actually do with the person\'s likeness'
    );
  }
  if (likenessScopes && !likenessSubjectId) {
    throw new ConsentError('createProductionJob: likenessScopes given without a likenessSubjectId');
  }

  //: Same both-or-neither shape as the likeness pair above, and for the
  //: same reason: a half-declared routing sails through unchecked.
  if ((destination === null) !== (durationSeconds === null)) {
    throw new RoutingError(
      'createProductionJob: destination and durationSeconds go together — '
      + 'a destination with no duration cannot be tier-checked, and a duration '
      + 'with no destination checks nothing'
    );
  }
  //: Checked before the job exists, so a video that could never be
  //: routed is never produced -- the same posture as the consent gate.
  let routing = null;
  if (destination !== null) {
    routing = assertRoutable({ destination, durationSeconds, produced });
  }

  const job = {
    id: store.nextProductionJobId++,
    requesterApp,
    scriptRequestId,
    title,
    stage: 'script-ready',
    storyboard: null,
    videoUrl: null,
    likenessSubjectId,
    likenessScopes: likenessScopes ? [...likenessScopes] : null,
    destination: routing ? routing.destination : null,
    durationSeconds,
    lengthTier: routing ? routing.tier : null,
    createdAt: now,
    stageUpdatedAt: now,
  };
  // Checked before the job exists, so a job that could never legally
  // render is never created in the first place.
  enforceLikenessConsent(store, job, 'createProductionJob', now);
  store.productionJobs.push(job);
  return job;
}

function getProductionJob(store, jobId) {
  return store.productionJobs.find((j) => j.id === jobId) || null;
}

function requireStage(store, jobId, expectedStage, action) {
  const job = getProductionJob(store, jobId);
  if (!job) throw new Error(`${action}: no production job with id ${jobId}`);
  if (job.stage !== expectedStage) {
    throw new Error(`${action}: job ${jobId} is "${job.stage}", expected "${expectedStage}"`);
  }
  return job;
}

function advanceToStoryboard(store, options = {}) {
  const { jobId, storyboard, now = Date.now() } = options;
  if (!storyboard) throw new Error('advanceToStoryboard requires a storyboard');
  const job = requireStage(store, jobId, 'script-ready', 'advanceToStoryboard');
  enforceLikenessConsent(store, job, 'advanceToStoryboard', now);
  job.storyboard = storyboard;
  job.stage = 'storyboard-ready';
  job.stageUpdatedAt = now;
  return job;
}

function queueRender(store, options = {}) {
  const { jobId, now = Date.now() } = options;
  const job = requireStage(store, jobId, 'storyboard-ready', 'queueRender');
  enforceLikenessConsent(store, job, 'queueRender', now);
  job.stage = 'render-queued';
  job.stageUpdatedAt = now;
  return job;
}

function markRendered(store, options = {}) {
  const { jobId, videoUrl = null, now = Date.now() } = options;
  const job = requireStage(store, jobId, 'render-queued', 'markRendered');
  // The last gate, and the one that matters most: this is the point a
  // real generated asset is attached to the job.
  enforceLikenessConsent(store, job, 'markRendered', now);
  job.stage = 'rendered';
  job.videoUrl = videoUrl;
  job.stageUpdatedAt = now;
  return job;
}

module.exports = {
  PRODUCTION_STAGES, createProductionJob, getProductionJob, advanceToStoryboard, queueRender, markRendered,
  RoutingError,
  enforceLikenessConsent,
};
