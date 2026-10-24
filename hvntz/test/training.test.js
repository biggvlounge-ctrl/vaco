// HVNTZ -- Hunts Academy (business owner training).
//
// Real course catalog, real enrollment/completion, and a real
// recommendation computed off a business's own state -- not a static
// "take everything" list.

const test = require('node:test');
const assert = require('node:assert');

const { createHvntzStore, registerBusiness } = require('../lib/revenueStack');
const { registerLocationParticipation } = require('../lib/participation');
const {
  FORMATS, COURSES, listCourses, getCourse,
  enrollBusiness, completeCourse, getBusinessProgress, getRecommendedCourses,
} = require('../lib/training');

test('the catalog is real and covers every direct-instruction format', () => {
  const courses = listCourses();
  assert.ok(courses.length >= 4);
  const formatsUsed = new Set(courses.map((c) => c.format));
  for (const f of formatsUsed) assert.ok(FORMATS.includes(f));
  // At least one of each named delivery shape exists somewhere in the
  // real catalog -- not every course needs every format, but the
  // catalog as a whole has to actually offer all of them.
  assert.ok(formatsUsed.has('self-paced-online'));
  assert.ok(formatsUsed.has('in-app'));
  assert.ok(formatsUsed.has('live-virtual'));
  assert.ok(formatsUsed.has('recorded-virtual'));
  assert.ok(formatsUsed.has('in-person-city'));
});

test('an in-person-city course names a real city; the others do not', () => {
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

test('enrolling requires a real business and a real course, and refuses a repeat', () => {
  const store = createHvntzStore();
  const business = registerBusiness(store, { name: 'Ada Coffee', ownerId: 'owner-1' });

  assert.throws(
    () => enrollBusiness(store, { businessId: 9999, courseId: 'digital-double-101' }),
    /no business with id/,
  );
  assert.throws(
    () => enrollBusiness(store, { businessId: business.id, courseId: 'not-real' }),
    /no course with id/,
  );

  const enrollment = enrollBusiness(store, { businessId: business.id, courseId: 'digital-double-101' });
  assert.equal(enrollment.status, 'enrolled');
  assert.equal(enrollment.completedAt, null);

  assert.throws(
    () => enrollBusiness(store, { businessId: business.id, courseId: 'digital-double-101' }),
    /already enrolled/,
  );
});

test('completing requires a real enrollment and is not repeatable', () => {
  const store = createHvntzStore();
  const business = registerBusiness(store, { name: 'Ada Coffee', ownerId: 'owner-1' });

  assert.throws(
    () => completeCourse(store, { businessId: business.id, courseId: 'digital-double-101' }),
    /is not enrolled in/,
  );

  enrollBusiness(store, { businessId: business.id, courseId: 'digital-double-101' });
  const completed = completeCourse(store, { businessId: business.id, courseId: 'digital-double-101' });
  assert.equal(completed.status, 'completed');
  assert.ok(completed.completedAt);

  assert.throws(
    () => completeCourse(store, { businessId: business.id, courseId: 'digital-double-101' }),
    /already completed/,
  );
});

test('progress counts completed vs. enrolled against the real catalog size', () => {
  const store = createHvntzStore();
  const business = registerBusiness(store, { name: 'Ada Coffee', ownerId: 'owner-1' });
  enrollBusiness(store, { businessId: business.id, courseId: 'digital-double-101' });
  enrollBusiness(store, { businessId: business.id, courseId: 'screen-network-301' });
  completeCourse(store, { businessId: business.id, courseId: 'digital-double-101' });

  const progress = getBusinessProgress(store, business.id);
  assert.equal(progress.enrollments.length, 2);
  assert.equal(progress.completedCount, 1);
  assert.equal(progress.totalCourses, COURSES.length);
});

test('recommendations are computed from real state, not a static list', () => {
  const store = createHvntzStore();
  // Brand-new business: Level 1, no participation anywhere -- both the
  // digital-double course and the screen-network course should come
  // back, and the streaming-unlock course should not (not past Level 2
  // yet, so it isn't the right next step).
  const fresh = registerBusiness(store, { name: 'Fresh Co', ownerId: 'owner-fresh' });
  const freshRecs = getRecommendedCourses(store, fresh.id).map((c) => c.id);
  assert.ok(freshRecs.includes('digital-double-101'));
  assert.ok(freshRecs.includes('screen-network-301'));
  assert.ok(!freshRecs.includes('streaming-unlock-201'));

  // A business with a real screen participation should not be told to
  // take the screen-network course again.
  const withScreen = registerBusiness(store, { name: 'Screened Co', ownerId: 'owner-screen' });
  const { registerLocation } = require('../lib/revenueStack');
  const location = registerLocation(store, {
    businessId: withScreen.id, locationType: 'screen', address: '1 Main St', lat: 38.6, lng: -90.2,
  });
  registerLocationParticipation(store, {
    businessId: withScreen.id, locationId: location.id, participationType: 'paid-screen-presence', feesPaid: 50,
  });
  const screenRecs = getRecommendedCourses(store, withScreen.id).map((c) => c.id);
  assert.ok(!screenRecs.includes('screen-network-301'));

  // Already-enrolled courses are not re-recommended.
  enrollBusiness(store, { businessId: fresh.id, courseId: 'digital-double-101' });
  const afterEnroll = getRecommendedCourses(store, fresh.id).map((c) => c.id);
  assert.ok(!afterEnroll.includes('digital-double-101'));
});
