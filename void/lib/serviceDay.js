// VOID -- the service day: one provider, several verticals, one schedule.
//
// **This is the thing no comparable does.** Rover makes you a dog
// walker. Uber makes you a driver. TaskRabbit makes you a Tasker in
// the categories it approved you for, and each of those platforms
// owns its own day. A person working three of them is running three
// apps that do not know about each other, and the gaps between jobs
// are unpaid and invisible.
//
// VOID holds all 25 verticals and one provider pool, so it can answer
// a question none of them can: *given what I can do, where I am, and
// when I am free, what does a full day look like?* A dog walk at 9, a
// laundry pickup at 11, a courier run at 2 -- one schedule, one
// payout, one app.
//
// **What this module is, precisely.** A feasibility planner over jobs
// that already exist. It does not create jobs, price them, or assign
// them -- `marketplace.js` does that, and this module deliberately
// does not duplicate it. It answers "which of these open jobs could
// this provider actually string together," which is a scheduling
// question, and then a provider accepts them through the normal loop.
//
// **The honest limitation, stated up front.** Travel time is estimated
// from straight-line distance at an assumed average speed. That is the
// same approximation `realEstateMedia.js` already makes, and it is
// wrong in the way every straight-line estimate is wrong: it
// under-estimates real driving time, more so in dense cities. It is
// good enough to reject an obviously infeasible plan and not good
// enough to promise an arrival time to a customer. Routing against
// real road data is a real upgrade, not a tweak.

const { haversineDistanceKm } = require('./geo');
const { VERTICALS } = require('./verticals');
const { requireProvider, canWorkVertical } = require('./providerProfiles');

//: Flagged interpretive: same assumed speed `realEstateMedia.js` uses,
//: kept identical on purpose so two modules do not quietly disagree
//: about how long the same trip takes.
const DEFAULT_AVERAGE_TRAVEL_SPEED_KMH = 50;

//: A buffer between jobs, because back-to-back scheduling with zero
//: slack produces a plan that fails on the first red light. Fifteen
//: minutes is the convention gig scheduling tools use.
const DEFAULT_BUFFER_MINUTES = 15;

//: Assumed duration for a job whose vertical does not specify one.
//: Real durations vary enormously (a 20-minute dog walk versus a
//: 6-hour move), so this is a planning placeholder that a vertical
//: module should override by passing `durationMinutes` on the job.
const DEFAULT_JOB_DURATION_MINUTES = 60;

const MS_PER_MINUTE = 60 * 1000;

class ServiceDayError extends Error {}

function travelMinutes(fromLat, fromLng, toLat, toLng, speedKmh) {
  const km = haversineDistanceKm(fromLat, fromLng, toLat, toLng);
  return (km / speedKmh) * 60;
}

function jobDuration(job) {
  return typeof job.durationMinutes === 'number' && job.durationMinutes > 0
    ? job.durationMinutes
    : DEFAULT_JOB_DURATION_MINUTES;
}

// A job is schedulable only if it has a place and a time. Jobs created
// through the plain marketplace loop carry neither, which is not a
// defect -- a courier run posted for "whenever" is a real thing. Those
// are simply not day-plannable, and are reported as skipped rather
// than silently dropped.
function isPlannable(job) {
  return typeof job.lat === 'number'
    && typeof job.lng === 'number'
    && typeof job.scheduledFor === 'number';
}

// Finds every open job this provider is qualified for, within their
// service radius, that they have not already been assigned.
function findEligibleJobs(store, providerId, options = {}) {
  const { now = Date.now() } = options;
  const profile = requireProvider(store, providerId, 'findEligibleJobs');

  const eligible = [];
  const skipped = [];

  for (const job of store.jobs) {
    if (job.status !== 'requested') continue;
    if (job.providerId) continue;

    const permission = canWorkVertical(store, providerId, job.verticalId);
    if (!permission.allowed) continue;

    if (!isPlannable(job)) {
      skipped.push({ jobId: job.id, reason: 'job has no location or scheduled time' });
      continue;
    }
    if (job.scheduledFor < now) {
      skipped.push({ jobId: job.id, reason: 'scheduled in the past' });
      continue;
    }

    const distanceKm = haversineDistanceKm(
      profile.homeBaseLat, profile.homeBaseLng, job.lat, job.lng,
    );
    if (distanceKm > profile.serviceRadiusKm) {
      skipped.push({ jobId: job.id, reason: `${distanceKm.toFixed(1)}km exceeds ${profile.serviceRadiusKm}km radius` });
      continue;
    }

    eligible.push({ job, distanceKm });
  }

  return { eligible, skipped };
}

function withinAnyWindow(profile, startsAt, endsAt) {
  return profile.availability.some((w) => startsAt >= w.startsAt && endsAt <= w.endsAt);
}

// Builds a feasible day.
//
// **Greedy by scheduled time, deliberately.** The optimal version of
// this is a vehicle-routing problem with time windows, which is
// NP-hard and which VOID already approximates elsewhere with 2-opt for
// drone routing. Greedy-by-time is used here instead for a reason that
// is about the product rather than the maths: a provider reading their
// day wants it in chronological order and wants to understand why each
// job is in it. A cleverly optimised schedule that reorders their
// morning to save eight minutes is worse than a legible one.
//
// Returns the accepted plan *and* every rejection with its reason, so
// "why isn't this job in my day" is always answerable.
function buildServiceDay(store, options = {}) {
  const {
    providerId,
    dayStart,
    dayEnd,
    bufferMinutes = DEFAULT_BUFFER_MINUTES,
    speedKmh = DEFAULT_AVERAGE_TRAVEL_SPEED_KMH,
    now = Date.now(),
  } = options;

  const profile = requireProvider(store, providerId, 'buildServiceDay');
  if (!Number.isFinite(dayStart) || !Number.isFinite(dayEnd)) {
    throw new ServiceDayError('buildServiceDay requires numeric dayStart and dayEnd timestamps');
  }
  if (dayEnd <= dayStart) throw new ServiceDayError('buildServiceDay requires dayEnd after dayStart');

  const { eligible, skipped } = findEligibleJobs(store, providerId, { now });

  const inDay = eligible
    .filter(({ job }) => job.scheduledFor >= dayStart && job.scheduledFor < dayEnd)
    .sort((a, b) => a.job.scheduledFor - b.job.scheduledFor);

  const plan = [];
  const rejected = [...skipped];
  let cursorAt = dayStart;
  let cursorLat = profile.homeBaseLat;
  let cursorLng = profile.homeBaseLng;
  let totalTravelMinutes = 0;
  let totalEarnings = 0;

  for (const { job } of inDay) {
    const travel = travelMinutes(cursorLat, cursorLng, job.lat, job.lng, speedKmh);
    const earliestArrival = cursorAt + Math.round(travel * MS_PER_MINUTE);

    if (earliestArrival > job.scheduledFor) {
      const lateBy = Math.round((earliestArrival - job.scheduledFor) / MS_PER_MINUTE);
      rejected.push({
        jobId: job.id,
        verticalId: job.verticalId,
        reason: `cannot arrive in time -- ${lateBy} min late from the previous stop`,
      });
      continue;
    }

    const endsAt = job.scheduledFor + jobDuration(job) * MS_PER_MINUTE;
    if (endsAt > dayEnd) {
      rejected.push({ jobId: job.id, verticalId: job.verticalId, reason: 'would run past the end of the day' });
      continue;
    }
    // Availability is checked against the declared windows, not just
    // the day bounds -- a provider free 9-12 and 3-6 must not be given
    // a 1pm job just because it falls inside 9-6.
    if (profile.availability.length > 0 && !withinAnyWindow(profile, job.scheduledFor, endsAt)) {
      rejected.push({ jobId: job.id, verticalId: job.verticalId, reason: 'outside declared availability windows' });
      continue;
    }

    const vertical = VERTICALS[job.verticalId];
    const grossEarnings = typeof job.totalPrice === 'number' ? job.totalPrice : 0;
    const providerEarnings = Math.round(grossEarnings * (1 - vertical.takeRate) * 100) / 100;

    plan.push({
      jobId: job.id,
      verticalId: job.verticalId,
      verticalName: vertical.name,
      scheduledFor: job.scheduledFor,
      endsAt,
      travelMinutesFromPrevious: Math.round(travel),
      providerEarnings,
    });

    totalTravelMinutes += travel;
    totalEarnings = Math.round((totalEarnings + providerEarnings) * 100) / 100;
    cursorAt = endsAt + bufferMinutes * MS_PER_MINUTE;
    cursorLat = job.lat;
    cursorLng = job.lng;
  }

  const workedMinutes = plan.reduce((sum, p) => sum + (p.endsAt - p.scheduledFor) / MS_PER_MINUTE, 0);

  return {
    providerId,
    dayStart,
    dayEnd,
    plan,
    rejected,
    summary: {
      jobCount: plan.length,
      // How many distinct verticals the day spans -- the number that
      // makes this different from any single-vertical platform.
      verticalsSpanned: [...new Set(plan.map((p) => p.verticalId))].length,
      totalEarnings,
      workedMinutes: Math.round(workedMinutes),
      travelMinutes: Math.round(totalTravelMinutes),
      // Stated honestly: travel is unpaid on every comparable platform
      // too, and surfacing it is the point. A day that looks like six
      // hours of work and is really eight is the single most common
      // complaint gig workers have.
      utilisationPercent: workedMinutes + totalTravelMinutes > 0
        ? Math.round((workedMinutes / (workedMinutes + totalTravelMinutes)) * 100)
        : 0,
    },
  };
}

// "What could I earn if I learned one more thing." Compares the day a
// provider can build now against the day they could build with one
// additional skill, across every vertical they do not already hold.
//
// This is the growth loop for a provider and the supply loop for the
// platform at the same time: the verticals that surface here are, by
// construction, the ones with unmet local demand.
function suggestSkillsToAdd(store, options = {}) {
  const { providerId, dayStart, dayEnd, now = Date.now() } = options;
  const profile = requireProvider(store, providerId, 'suggestSkillsToAdd');

  const held = new Set(profile.skills.map((s) => s.verticalId));
  const baseline = buildServiceDay(store, { providerId, dayStart, dayEnd, now }).summary.totalEarnings;

  const suggestions = [];
  for (const verticalId of Object.keys(VERTICALS)) {
    if (held.has(verticalId)) continue;
    // Licensing-gated verticals are never suggested. Suggesting that
    // someone "add cannabis delivery" to fill an afternoon would be
    // recommending they work without a licence.
    if (VERTICALS[verticalId].licensingGated) continue;

    // Simulate holding the skill without mutating the stored profile.
    profile.skills.push({ verticalId, status: 'claimed', verifiedAt: null, addedAt: now });
    const withSkill = buildServiceDay(store, { providerId, dayStart, dayEnd, now });
    profile.skills.pop();

    const gain = Math.round((withSkill.summary.totalEarnings - baseline) * 100) / 100;
    if (gain > 0) {
      suggestions.push({
        verticalId,
        name: VERTICALS[verticalId].name,
        additionalEarnings: gain,
        additionalJobs: withSkill.summary.jobCount
          - buildServiceDay(store, { providerId, dayStart, dayEnd, now }).summary.jobCount,
      });
    }
  }

  return suggestions.sort((a, b) => b.additionalEarnings - a.additionalEarnings);
}

module.exports = {
  DEFAULT_AVERAGE_TRAVEL_SPEED_KMH,
  DEFAULT_BUFFER_MINUTES,
  DEFAULT_JOB_DURATION_MINUTES,
  ServiceDayError,
  findEligibleJobs,
  buildServiceDay,
  suggestSkillsToAdd,
};
