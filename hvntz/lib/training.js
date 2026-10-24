// HVNTZ -- Business Owner Training ("Hunts Academy").
//
// Teaches what THIS app's own real revenue mechanics are, with real
// numbers pulled from the modules that compute them -- not generic
// small-business advice, and not a second, disagreeing explanation of
// something `digitalTwin.js`/`participation.js`/`screenAnalytics.js`
// already define. Per direct instruction, four real topics:
//
//   1. VDP as a digital double            -> digitalTwin.js
//   2. The streaming-platform unlock       -> digitalTwin.js's
//      `vavltStreamingUnlocked` (Level 3), the real `vavlt-streaming`
//      revenue event type
//   3. The screen network -- scans and DTC -> participation.js's
//      `scanRevenueShare`/`dtcRevenueShare`, the real `screen-ad` /
//      `screen-dtc-sale` event types any screen on a property
//      (a table, a menu, a bench -- anything with a scan) produces
//   4. Selling through the screen network, for a VENVS seller
//
// Delivery formats are real and distinct, per direct instruction: a
// course can be self-paced online content, something inside the app
// itself, a scheduled live virtual class, a recorded virtual class, or
// an in-person class held in a real city -- never collapsed into one
// generic "online" bucket. This module is the catalog, the
// enrollment, and the completion record; it does not invent a video
// platform -- hosting a live or recorded session is vaco-media's job,
// the same real boundary every other media-bearing feature in this
// ecosystem already respects.

const { getBusiness } = require('./revenueStack');
const { getParticipations } = require('./participation');
const {
  computeDigitalTwinLevel, LEVEL_2_LOCATION_THRESHOLD, LEVEL_3_LOCATION_THRESHOLD,
} = require('./digitalTwin');

const FORMATS = ['self-paced-online', 'in-app', 'live-virtual', 'recorded-virtual', 'in-person-city'];

// Every number quoted in a course's `summary` is read directly off the
// real constant it describes (interpolated below, not retyped), so a
// future change to a threshold cannot leave this course teaching a
// stale figure silently.
const COURSES = [
  {
    id: 'digital-double-101',
    title: 'Your VDP Digital Double',
    format: 'self-paced-online',
    city: null,
    summary: `Your real-world Franchise List computes your Digital Twin Level automatically — it is never a separate purchase. `
      + `${LEVEL_2_LOCATION_THRESHOLD}+ real locations (or one location carrying 50%+ of its scan revenue) reaches Level 2. `
      + `${LEVEL_3_LOCATION_THRESHOLD}+ locations, a hub-as-store participation, or $200+ in tracked revenue reaches Level 3, `
      + 'which is what actually unlocks the next two courses.',
  },
  {
    id: 'streaming-unlock-201',
    title: 'Unlocking Your Streaming Channel',
    format: 'recorded-virtual',
    city: null,
    summary: 'What Digital Twin Level 3 turns on for real: a Vavlt Stvdios streaming channel and AI Business Intelligence. '
      + 'Covers the real `vavlt-streaming` revenue event your channel produces once it is broadcasting, not a projected number.',
  },
  {
    id: 'screen-network-301',
    title: 'The Screen Network: Scans & Direct-to-Consumer',
    format: 'live-virtual',
    city: null,
    summary: 'Any screen on your property — a table, a menu, a bench, anything carrying a scan — earns through two real event '
      + 'types: screen-ad and screen-dtc-sale. Your participation type sets your real scanRevenueShare and dtcRevenueShare; '
      + 'own-hunt-location keeps 100% of both, paid-screen/hub-presence scales with what you have paid in, and hub-as-store '
      + 'needs $500+ paid in to reach full share.',
  },
  {
    id: 'venvs-sellers-401',
    title: 'Selling Through the Screen Network — for VENVS Sellers',
    format: 'in-app',
    city: null,
    summary: 'For a VENVS seller rather than a venue: how a product reaches a real screen at a hunt location, and what a '
      + 'screen-dtc-sale event actually pays the seller versus the venue hosting the screen.',
  },
  // Real, scheduled in-person sessions. Unlike the four above, this
  // format names a specific city rather than being available anywhere
  // — a second St. Louis or Chicago session is a second course entry
  // with its own id, not a parameter on this one.
  {
    id: 'in-person-stl',
    title: 'In-Person: Running Your Digital Double & Screen Network',
    format: 'in-person-city',
    city: 'St. Louis',
    summary: 'A hands-on session, taught in St. Louis, covering all three owner-facing mechanics above for businesses in the '
      + 'St. Louis hunt network.',
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

function enrollBusiness(store, options = {}) {
  const { businessId, courseId, now = Date.now() } = options;
  if (!getBusiness(store, businessId)) {
    throw new Error(`enrollBusiness: no business with id ${businessId}`);
  }
  getCourse(courseId); // throws on an unreal course id rather than enrolling in nothing

  if (store.trainingEnrollments.some((e) => e.businessId === businessId && e.courseId === courseId)) {
    throw new Error(`enrollBusiness: business ${businessId} is already enrolled in "${courseId}"`);
  }

  const enrollment = {
    id: store.nextTrainingEnrollmentId++,
    businessId,
    courseId,
    status: 'enrolled', // enrolled | completed
    enrolledAt: now,
    completedAt: null,
  };
  store.trainingEnrollments.push(enrollment);
  return enrollment;
}

function completeCourse(store, options = {}) {
  const { businessId, courseId, now = Date.now() } = options;
  const enrollment = store.trainingEnrollments.find(
    (e) => e.businessId === businessId && e.courseId === courseId,
  );
  if (!enrollment) {
    throw new Error(`completeCourse: business ${businessId} is not enrolled in "${courseId}"`);
  }
  if (enrollment.status === 'completed') {
    throw new Error(`completeCourse: business ${businessId} already completed "${courseId}"`);
  }
  enrollment.status = 'completed';
  enrollment.completedAt = now;
  return enrollment;
}

function getBusinessProgress(store, businessId) {
  if (!getBusiness(store, businessId)) {
    throw new Error(`getBusinessProgress: no business with id ${businessId}`);
  }
  const enrollments = store.trainingEnrollments.filter((e) => e.businessId === businessId);
  return {
    businessId,
    enrollments,
    completedCount: enrollments.filter((e) => e.status === 'completed').length,
    totalCourses: COURSES.length,
  };
}

// A real recommendation, computed from the business's own real state
// — never a static "take everything" list. Below Level 2, the digital
// double course comes first; past Level 2 but not yet streaming, the
// streaming-unlock course; no participation registered anywhere yet,
// the screen-network course. Already-enrolled courses are not
// repeated.
function getRecommendedCourses(store, businessId) {
  const twin = computeDigitalTwinLevel(store, businessId);
  const participations = getParticipations(store, businessId);
  const enrolledIds = new Set(
    store.trainingEnrollments.filter((e) => e.businessId === businessId).map((e) => e.courseId),
  );
  const recommended = [];

  if (twin.level < 2 && !enrolledIds.has('digital-double-101')) {
    recommended.push(getCourse('digital-double-101'));
  }
  if (twin.level >= 2 && !twin.vavltStreamingUnlocked && !enrolledIds.has('streaming-unlock-201')) {
    recommended.push(getCourse('streaming-unlock-201'));
  }
  if (participations.length === 0 && !enrolledIds.has('screen-network-301')) {
    recommended.push(getCourse('screen-network-301'));
  }
  return recommended;
}

module.exports = {
  FORMATS,
  COURSES,
  listCourses,
  getCourse,
  enrollBusiness,
  completeCourse,
  getBusinessProgress,
  getRecommendedCourses,
};
