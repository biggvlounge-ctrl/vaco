// VOID -- Provider Training ("VOID Academy").
//
// Same real pattern as HVNTZ's Hunts Academy (direct instruction: "do
// the same with all the void service apps"): a real course catalog,
// real enrollment/completion against a real provider record, and a
// recommendation computed from that provider's own real claimed
// skills -- never a static "take everything" list. Every number
// quoted in a course's `summary` is interpolated from the real
// constant it describes (`verticals.js`'s own `takeRate`), not
// retyped.
//
// Delivery formats are the same five, real and distinct, this
// ecosystem already settled on for HVNTZ's Hunts Academy: self-paced
// online, in-app, a scheduled live virtual class, a recorded virtual
// class, or an in-person class tied to a real city.

const { getProvider } = require('./providerProfiles');
const { VERTICALS } = require('./verticals');

const FORMATS = ['self-paced-online', 'in-app', 'live-virtual', 'recorded-virtual', 'in-person-city'];

const LOGISTICS_VERTICALS = ['transportation', 'courier', 'freightMoving'];
const HOME_SERVICE_VERTICALS = ['cleaningHandyman', 'laundry', 'petCare', 'landscaping', 'beauty'];
const LICENSING_GATED_VERTICALS = ['cannabisDelivery', 'medicalTransportation'];

const COURSES = [
  {
    id: 'marketplace-101',
    title: "Working VOID's One Marketplace Loop",
    format: 'self-paced-online',
    city: null,
    verticalIds: null, // every vertical, not a cluster
    summary: 'Every one of VOID\'s '
      + `${Object.keys(VERTICALS).length} real verticals runs through the same lifecycle: `
      + 'request, match, accept, complete, pay, rate. Learn that one loop once and every vertical you '
      + 'add afterward works the same way.',
  },
  {
    id: 'logistics-301',
    title: 'Driving, Courier & Freight: Routing That Pays You',
    format: 'in-app',
    city: null,
    verticalIds: LOGISTICS_VERTICALS,
    summary: `Transportation, courier, and freight/moving all take VOID's standard ${Math.round(VERTICALS.transportation.takeRate * 100)}% platform `
      + 'share, paid per trip or per flat quote. Covers the real dead-time suggestion VOID\'s own dispatch logic '
      + 'surfaces between jobs, so a gap in your schedule becomes a real, nearby next job instead of idle time.',
  },
  {
    id: 'home-services-301',
    title: 'Running a Home-Services Business on VOID',
    format: 'live-virtual',
    city: null,
    verticalIds: HOME_SERVICE_VERTICALS,
    summary: 'Cleaning/handyman, pet care, landscaping, and beauty all take VOID\'s standard '
      + `${Math.round(VERTICALS.cleaningHandyman.takeRate * 100)}% platform share. Laundry is the one real exception: `
      + `priced per pound, taking ${Math.round(VERTICALS.laundry.takeRate * 100)}%, with free pickup and delivery built in. `
      + 'Covers real pricing units -- hourly, per-job, per-pound -- so you quote correctly from day one.',
  },
  {
    id: 'licensing-401',
    title: 'Cannabis Delivery & Medical Transportation: The Licensing Gate',
    format: 'recorded-virtual',
    city: null,
    verticalIds: LICENSING_GATED_VERTICALS,
    summary: 'Both verticals are real, and both are licensing-gated: VOID\'s own job-request route refuses '
      + 'either one outright without a verified license on file. This gate does not relax for anyone, and this '
      + 'course exists so a provider learns that before applying, not after a job is refused.',
  },
  {
    id: 'void-drop-stl',
    title: 'VOID DROP In-Person: Deploying Your Mobile Unit',
    format: 'in-person-city',
    city: 'St. Louis',
    verticalIds: ['voidDrop'],
    summary: 'A hands-on class, taught in St. Louis (VOID\'s own real seed network), on the real VOID DROP '
      + 'lifecycle: book, two-leg delivery, deploy, operate, retrieve. Covers how a unit inside a real Drop Zone '
      + 'inherits that zone\'s own proven location and road access.',
  },
];

function listCourses() {
  return COURSES;
}

function getCourse(courseId) {
  const course = COURSES.find((c) => c.id === courseId);
  if (!course) throw new Error(`getCourse: no course with id ${courseId}`);
  return course;
}

function enrollProvider(store, options = {}) {
  const { providerId, courseId, now = Date.now() } = options;
  if (!getProvider(store, providerId)) {
    throw new Error(`enrollProvider: no provider registered as "${providerId}"`);
  }
  getCourse(courseId); // throws on an unreal course id rather than enrolling in nothing

  if (store.trainingEnrollments.some((e) => e.providerId === providerId && e.courseId === courseId)) {
    throw new Error(`enrollProvider: provider "${providerId}" is already enrolled in "${courseId}"`);
  }

  const enrollment = {
    id: store.nextTrainingEnrollmentId++,
    providerId,
    courseId,
    status: 'enrolled', // enrolled | completed
    enrolledAt: now,
    completedAt: null,
  };
  store.trainingEnrollments.push(enrollment);
  return enrollment;
}

function completeCourse(store, options = {}) {
  const { providerId, courseId, now = Date.now() } = options;
  const enrollment = store.trainingEnrollments.find(
    (e) => e.providerId === providerId && e.courseId === courseId,
  );
  if (!enrollment) {
    throw new Error(`completeCourse: provider "${providerId}" is not enrolled in "${courseId}"`);
  }
  if (enrollment.status === 'completed') {
    throw new Error(`completeCourse: provider "${providerId}" already completed "${courseId}"`);
  }
  enrollment.status = 'completed';
  enrollment.completedAt = now;
  return enrollment;
}

function getProviderProgress(store, providerId) {
  if (!getProvider(store, providerId)) {
    throw new Error(`getProviderProgress: no provider registered as "${providerId}"`);
  }
  const enrollments = store.trainingEnrollments.filter((e) => e.providerId === providerId);
  return {
    providerId,
    enrollments,
    completedCount: enrollments.filter((e) => e.status === 'completed').length,
    totalCourses: COURSES.length,
  };
}

// A real recommendation, computed from the provider's own real
// claimed skills (`profile.skills`, from lib/providerProfiles.js) --
// never a static list. The onboarding course comes first for anyone
// who hasn't taken it; every other course is recommended only when
// the provider has actually claimed a skill in that course's cluster.
function getRecommendedCourses(store, providerId) {
  const profile = getProvider(store, providerId);
  if (!profile) throw new Error(`getRecommendedCourses: no provider registered as "${providerId}"`);

  const claimed = new Set(profile.skills.map((s) => s.verticalId));
  const enrolledIds = new Set(
    store.trainingEnrollments.filter((e) => e.providerId === providerId).map((e) => e.courseId),
  );
  const hasAny = (verticalIds) => verticalIds.some((v) => claimed.has(v));
  const recommended = [];

  if (!enrolledIds.has('marketplace-101')) recommended.push(getCourse('marketplace-101'));
  if (hasAny(LOGISTICS_VERTICALS) && !enrolledIds.has('logistics-301')) recommended.push(getCourse('logistics-301'));
  if (hasAny(HOME_SERVICE_VERTICALS) && !enrolledIds.has('home-services-301')) recommended.push(getCourse('home-services-301'));
  if (hasAny(LICENSING_GATED_VERTICALS) && !enrolledIds.has('licensing-401')) recommended.push(getCourse('licensing-401'));
  if (claimed.has('voidDrop') && !enrolledIds.has('void-drop-stl')) recommended.push(getCourse('void-drop-stl'));

  return recommended;
}

// -- AI-presenter training videos, via VENVM ---------------------------
//
// Per direct instruction: "make them personable using our AI... AI
// training videos where they're actual people using AI... stick
// whatever script you have inside of our Vulture program... Venom" --
// VENVM, the ecosystem's real AI production/script pipeline. The real
// use case already named in VENVM's own AI_HUMAN_TWIN_AD_GENERATION_
// VENVM.md ("business-owner-appearing-in-their-own-DREAMS-ad-without-
// a-shoot") is reused here for training content instead of an ad.
//
// **What is real versus honestly unbuilt.** A real script request and
// a real production job are created against VENVM's own real, running
// service -- a real LLM completion attempt (via V4), and a real,
// consent-gated production-stage machine. What this does NOT do, and
// cannot: render actual video. No generative-video infrastructure
// exists anywhere in this ecosystem (VENVM's own README: "VENVM itself
// cannot produce pixels"). This function's result always reflects
// VENVM's honest real stage -- script generated or failed, a
// production job sitting at `script-ready` -- never a fabricated
// finished video.
async function requestCourseVideo(store, options = {}, deps = {}) {
  const {
    courseId, likenessSubjectId = null, likenessScopes = null, now = Date.now(),
  } = options;
  const { submitScriptFn, generateScriptFn, createProductionJobFn } = deps;
  if (typeof submitScriptFn !== 'function' || typeof generateScriptFn !== 'function' || typeof createProductionJobFn !== 'function') {
    throw new Error('requestCourseVideo requires submitScriptFn, generateScriptFn, and createProductionJobFn');
  }

  const course = getCourse(courseId); // throws on an unreal course id

  const brief = `Write a short training-video script for VOID Academy's "${course.title}" course.`
    + (likenessSubjectId
      ? ' The presenter appears as their own real AI twin, consented in advance, teaching this material directly to camera.'
      : '')
    + ` Teach: ${course.summary}`;

  const scriptRequest = await submitScriptFn({ requesterApp: 'void', brief, platform: 'in-app' });
  const generated = await generateScriptFn(scriptRequest.id);

  let productionJob = null;
  let productionError = null;
  // A production job is only worth opening once there is a real script
  // to film -- opening one against a failed script would just be a
  // second honest failure standing in for the first.
  if (generated.status === 'generated') {
    try {
      productionJob = await createProductionJobFn({
        requesterApp: 'void',
        scriptRequestId: scriptRequest.id,
        title: course.title,
        likenessSubjectId,
        likenessScopes,
      });
    } catch (err) {
      productionError = err.message;
    }
  }

  const record = {
    id: store.nextCourseVideoJobId++,
    courseId,
    scriptRequestId: scriptRequest.id,
    scriptStatus: generated.status,
    scriptError: generated.error || null,
    productionJobId: productionJob ? productionJob.id : null,
    productionStage: productionJob ? productionJob.stage : null,
    productionError,
    createdAt: now,
  };
  store.courseVideoJobs.push(record);
  return record;
}

function getCourseVideoJobs(store, courseId) {
  return store.courseVideoJobs.filter((j) => j.courseId === courseId);
}

module.exports = {
  FORMATS,
  COURSES,
  listCourses,
  getCourse,
  enrollProvider,
  completeCourse,
  getProviderProgress,
  getRecommendedCourses,
  requestCourseVideo,
  getCourseVideoJobs,
};
