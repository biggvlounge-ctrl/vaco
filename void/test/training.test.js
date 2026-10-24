// VOID Academy -- provider training (the same real Hunts Academy
// pattern, grounded in VOID's own real verticals, take rates, and
// licensing gates), plus the real AI-presenter video request against
// VENVM.

const test = require('node:test');
const assert = require('node:assert');

const { createVoidStore } = require('../lib/store');
const { registerProvider, addSkill } = require('../lib/providerProfiles');
const {
  FORMATS, COURSES, listCourses, getCourse,
  enrollProvider, completeCourse, getProviderProgress, getRecommendedCourses,
  requestCourseVideo, getCourseVideoJobs,
} = require('../lib/training');

const BASE = { homeBaseLat: 38.6270, homeBaseLng: -90.1994 };

function provider(store, id = 'maria', overrides = {}) {
  return registerProvider(store, { providerId: id, displayName: id, ...BASE, ...overrides });
}

test('the catalog covers every real delivery format and names a real city only for in-person-city', () => {
  const courses = listCourses();
  assert.ok(courses.length >= 4);
  const formatsUsed = new Set(courses.map((c) => c.format));
  for (const f of formatsUsed) assert.ok(FORMATS.includes(f));
  for (const f of FORMATS) assert.ok(formatsUsed.has(f), `no course uses format "${f}"`);

  for (const course of COURSES) {
    if (course.format === 'in-person-city') {
      assert.ok(course.city, `${course.id} is in-person-city but names no city`);
    } else {
      assert.equal(course.city, null, `${course.id} is not in-person-city but names one anyway`);
    }
  }
});

test('getCourse refuses an unreal id', () => {
  assert.throws(() => getCourse('not-a-real-course'), /no course with id/);
});

test('enrolling requires a real provider and a real course, and refuses a repeat', () => {
  const store = createVoidStore();
  provider(store, 'maria');

  assert.throws(
    () => enrollProvider(store, { providerId: 'ghost', courseId: 'marketplace-101' }),
    /no provider registered/,
  );
  assert.throws(
    () => enrollProvider(store, { providerId: 'maria', courseId: 'not-real' }),
    /no course with id/,
  );

  const enrollment = enrollProvider(store, { providerId: 'maria', courseId: 'marketplace-101' });
  assert.equal(enrollment.status, 'enrolled');
  assert.equal(enrollment.completedAt, null);

  assert.throws(
    () => enrollProvider(store, { providerId: 'maria', courseId: 'marketplace-101' }),
    /already enrolled/,
  );
});

test('completing requires a real enrollment and is not repeatable', () => {
  const store = createVoidStore();
  provider(store, 'maria');

  assert.throws(
    () => completeCourse(store, { providerId: 'maria', courseId: 'marketplace-101' }),
    /is not enrolled in/,
  );

  enrollProvider(store, { providerId: 'maria', courseId: 'marketplace-101' });
  const completed = completeCourse(store, { providerId: 'maria', courseId: 'marketplace-101' });
  assert.equal(completed.status, 'completed');
  assert.ok(completed.completedAt);

  assert.throws(
    () => completeCourse(store, { providerId: 'maria', courseId: 'marketplace-101' }),
    /already completed/,
  );
});

test('progress counts completed vs. enrolled against the real catalog size', () => {
  const store = createVoidStore();
  provider(store, 'maria');
  enrollProvider(store, { providerId: 'maria', courseId: 'marketplace-101' });
  enrollProvider(store, { providerId: 'maria', courseId: 'home-services-301' });
  completeCourse(store, { providerId: 'maria', courseId: 'marketplace-101' });

  const progress = getProviderProgress(store, 'maria');
  assert.equal(progress.enrollments.length, 2);
  assert.equal(progress.completedCount, 1);
  assert.equal(progress.totalCourses, COURSES.length);
});

test('recommendations are computed from the provider\'s own real claimed skills, not a static list', () => {
  const store = createVoidStore();

  // A brand-new provider with no claimed skills: only the onboarding
  // course comes back.
  provider(store, 'fresh');
  const freshRecs = getRecommendedCourses(store, 'fresh').map((c) => c.id);
  assert.deepEqual(freshRecs, ['marketplace-101']);

  // A provider who claimed a logistics skill gets the logistics
  // course too, but not the home-services or licensing ones.
  provider(store, 'driver');
  addSkill(store, { providerId: 'driver', verticalId: 'courier' });
  const driverRecs = getRecommendedCourses(store, 'driver').map((c) => c.id);
  assert.ok(driverRecs.includes('logistics-301'));
  assert.ok(!driverRecs.includes('home-services-301'));
  assert.ok(!driverRecs.includes('licensing-401'));

  // A provider who claimed a licensing-gated skill gets that course
  // recommended -- the whole point of the course existing.
  provider(store, 'dispensary-runner');
  addSkill(store, { providerId: 'dispensary-runner', verticalId: 'cannabisDelivery' });
  const gatedRecs = getRecommendedCourses(store, 'dispensary-runner').map((c) => c.id);
  assert.ok(gatedRecs.includes('licensing-401'));

  // Already-enrolled courses are not re-recommended.
  enrollProvider(store, { providerId: 'driver', courseId: 'logistics-301' });
  const afterEnroll = getRecommendedCourses(store, 'driver').map((c) => c.id);
  assert.ok(!afterEnroll.includes('logistics-301'));
});

test('getRecommendedCourses refuses an unreal provider', () => {
  const store = createVoidStore();
  assert.throws(() => getRecommendedCourses(store, 'ghost'), /no provider registered/);
});

test('requestCourseVideo opens a real production job once the script is real, honestly reflecting VENVM\'s stage', async () => {
  const store = createVoidStore();
  const calls = [];

  const record = await requestCourseVideo(store, { courseId: 'marketplace-101' }, {
    submitScriptFn: async (opts) => { calls.push(['submit', opts]); return { id: 501, status: 'requested' }; },
    generateScriptFn: async (id) => { calls.push(['generate', id]); return { id, status: 'generated', script: 'real script text', error: null }; },
    createProductionJobFn: async (opts) => { calls.push(['createJob', opts]); return { id: 901, stage: 'script-ready', requesterApp: opts.requesterApp }; },
  });

  assert.equal(record.courseId, 'marketplace-101');
  assert.equal(record.scriptRequestId, 501);
  assert.equal(record.scriptStatus, 'generated');
  assert.equal(record.scriptError, null);
  assert.equal(record.productionJobId, 901);
  assert.equal(record.productionStage, 'script-ready');
  assert.equal(calls[0][0], 'submit');
  assert.equal(calls[0][1].requesterApp, 'void');
  assert.match(calls[0][1].brief, /marketplace-101|Working VOID/);
  assert.deepEqual(getCourseVideoJobs(store, 'marketplace-101'), [record]);
});

test('requestCourseVideo never fabricates a production job when the real script generation fails', async () => {
  const store = createVoidStore();
  let jobFnCalled = false;

  const record = await requestCourseVideo(store, { courseId: 'logistics-301' }, {
    submitScriptFn: async () => ({ id: 777, status: 'requested' }),
    generateScriptFn: async (id) => ({ id, status: 'failed', script: null, error: 'v4-proxy unreachable' }),
    createProductionJobFn: async () => { jobFnCalled = true; return { id: 1, stage: 'script-ready' }; },
  });

  assert.equal(record.scriptStatus, 'failed');
  assert.equal(record.scriptError, 'v4-proxy unreachable');
  assert.equal(record.productionJobId, null);
  assert.equal(record.productionStage, null);
  assert.equal(jobFnCalled, false, 'a production job must never open against a failed script');
});

test('requestCourseVideo refuses an unreal course id', async () => {
  const store = createVoidStore();
  await assert.rejects(
    requestCourseVideo(store, { courseId: 'not-real' }, {
      submitScriptFn: async () => ({ id: 1, status: 'requested' }),
      generateScriptFn: async () => ({ status: 'generated' }),
      createProductionJobFn: async () => ({ id: 1, stage: 'script-ready' }),
    }),
    /no course with id/,
  );
});
