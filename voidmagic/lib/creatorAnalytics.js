// VOID MAGIC -- Creator Analytics (Section 35, Phase 2's fourth real
// slice). Source of truth: VOID_MAGIC_MASTER_BUILD_BRIEF.md SS35's
// real, named metric list: bookings, revenue, attendance, no-shows,
// conversion, average order value, experience duration, creator
// earnings, customer retention, repeat booking, geographic demand,
// digital vs physical, experience type, peak booking periods,
// advertising performance, transportation usage, security usage,
// venue performance.
//
// A real, pure read-side aggregation over data this codebase already
// has -- no new store fields, no new writes. Of the 18 named metrics,
// 12 are genuinely computable from what's actually been built
// (Experience, Booking, EventServiceRequest); the other 6 are honestly
// flagged as not computable here rather than faked:
//   - conversion: needs real experience-page view tracking, which
//     doesn't exist anywhere in this codebase.
//   - geographic demand / venue performance: `Experience.location` is
//     a free-text string, not a real venue entity with coordinates --
//     grouping by that string would be a fragile, misleading proxy,
//     not a real metric.
//   - advertising performance: needs DREAMS integration, Section 41's
//     Phase 3, not built.
// `creatorEarnings` deliberately recomputes the exact same real
// formula `bookings.js`'s `completeExperience` already used at
// settlement (`PLATFORM_TAKE_RATE`, per-booking rounding) rather than
// inventing a second formula -- it reports what was actually paid,
// not an estimate.

const { getExperience } = require('./experiences');
const { PLATFORM_TAKE_RATE } = require('./bookings');
const { EVENT_SERVICE_TYPES } = require('./eventServices');

function round(n) {
  return Math.round(n * 100) / 100;
}

function getCreatorAnalytics(store, hostId) {
  if (!hostId) throw new Error('getCreatorAnalytics requires a hostId');

  const experiences = store.experiences.filter((e) => e.hostId === hostId);
  const experienceIds = new Set(experiences.map((e) => e.id));
  const bookings = store.bookings.filter((b) => experienceIds.has(b.experienceId));
  const serviceRequests = store.eventServiceRequests.filter((r) => experienceIds.has(r.experienceId));

  const totalBookings = bookings.length;
  const grossRevenue = round(bookings.reduce((sum, b) => sum + b.pricePaid, 0));
  const averageOrderValue = totalBookings > 0 ? round(grossRevenue / totalBookings) : 0;

  const completedBookings = bookings.filter((b) => b.status === 'completed');
  // Real, exact reconstruction of `completeExperience`'s own per-booking
  // rounding -- not `grossRevenue * (1 - PLATFORM_TAKE_RATE)`, which
  // would drift from what was actually transferred booking-by-booking.
  const creatorEarnings = round(completedBookings.reduce((sum, b) => {
    if (b.pricePaid <= 0) return sum;
    const platformFee = round(b.pricePaid * PLATFORM_TAKE_RATE);
    return sum + round(b.pricePaid - platformFee);
  }, 0));

  const attendedCount = completedBookings.filter((b) => b.checkedInAt !== null).length;
  const noShowCount = completedBookings.filter((b) => b.checkedInAt === null).length;
  const attendanceRate = completedBookings.length > 0 ? round(attendedCount / completedBookings.length) : null;

  const bookingsPerCustomer = {};
  for (const b of bookings) {
    bookingsPerCustomer[b.customerId] = (bookingsPerCustomer[b.customerId] || 0) + 1;
  }
  const repeatCustomerCount = Object.values(bookingsPerCustomer).filter((n) => n > 1).length;

  const bookingsByFormat = { physical: 0, digital: 0, hybrid: 0 };
  const bookingsByType = {
    'meet-greet': 0, interaction: 0, conversation: 0, custom: 0,
  };
  const durations = [];
  for (const b of bookings) {
    const experience = getExperience(store, b.experienceId);
    bookingsByFormat[experience.format] += 1;
    bookingsByType[experience.type] += 1;
    durations.push(experience.durationMinutes);
  }
  const averageExperienceDurationMinutes = durations.length > 0
    ? round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
    : null;

  const eventServiceUsage = {};
  for (const serviceType of EVENT_SERVICE_TYPES) eventServiceUsage[serviceType] = 0;
  for (const r of serviceRequests) eventServiceUsage[r.serviceType] += 1;

  const bookingsByHourUTC = Array(24).fill(0);
  for (const b of bookings) bookingsByHourUTC[new Date(b.createdAt).getUTCHours()] += 1;
  const peakBookingHourUTC = bookings.length > 0 ? bookingsByHourUTC.indexOf(Math.max(...bookingsByHourUTC)) : null;

  return {
    hostId,
    totalExperiences: experiences.length,
    totalBookings,
    grossRevenue,
    creatorEarnings,
    averageOrderValue,
    attendedCount,
    noShowCount,
    attendanceRate,
    repeatCustomerCount,
    bookingsByFormat,
    bookingsByType,
    averageExperienceDurationMinutes,
    eventServiceUsage,
    bookingsByHourUTC,
    peakBookingHourUTC,
    notComputable: ['conversion', 'geographicDemand', 'venuePerformance', 'advertisingPerformance'],
  };
}

module.exports = { getCreatorAnalytics };
