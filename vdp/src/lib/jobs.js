// VDP — jobs/careers.
//
// Real, fixed job slots tied to districts that already exist and
// already have a real money path: Food District (`foodDistrict.js`,
// a real order ledger), Venus Resort (`venusResort.js`'s `NPCS`
// dealer role — a decorative staff slot a player can now fill), a
// Vulture Music gig (`vultureMusicClient.js`, a real `-embed` client),
// the Combat Sports District, and the Fashion District (DEGVCHI) --
// the latter two are `vdp-native` content in `world.js`'s own
// `DISTRICTS`, same as Food, so a job there needs no second app's
// cooperation. `payShift` pays through V3 (`v3Client.js`'s
// `transferVCoin`) from a named payroll account for that district —
// the same pattern this repo already uses for non-player ledger
// accounts (DEGVCHI's brand `sponsor`/`creatorId` fields) — with the
// claim-before-pay ordering `degvchi.js`'s `purchaseWearable` proved:
// the shift is marked paid before the transfer is awaited, rolled
// back on failure, so no second place invents a payout.
//
// **The three frontier jobs (8 Oct 2026), per direct instruction**:
// hunting, lumberjacking and farming, so the settlement can work the
// undeveloped land around Meridian rather than only its built
// districts. `districtId: 'frontier'` is deliberately NOT one of
// `world.js`'s real `DISTRICTS` ids, unlike every job above it — these
// three are the one case where that is correct: the frontier is
// `worldExpansion.js`'s own real distinction, the backdrop beyond
// whatever has been hand-built, and hunting specifically belongs there
// by the instruction's own words ("hunting in areas that aren't
// developed yet"). `skill` is `occupations.js`'s real tier-2 entry for
// each, verbatim (`hunter`: Combat/hunting, `farmer`: Agriculture/
// farming) — lumberjack has no literal entry there, so it takes
// `carpenter`'s Construction, the nearest real one, same as this
// file's own skill already covers "labourer/carpenter." `yields` is
// new: a real, produced resource (`resources.js`'s `grantMaterials`)
// on top of the usual VCoin pay — "this will lead to product as
// well," per instruction, starting with the raw material each job
// actually produces. `payrollAccountId` is the planet's own governors
// — per direct instruction, "all the initial operations will be done
// by us, the governors of the new planet": these three are founder-run
// from day one, the same payroll-is-the-employer pattern every other
// job here already uses, just with the founders as that employer
// instead of a district's own business.

export const PLANETARY_GOVERNORS_PAYROLL = 'planetary-governors-payroll';

export const JOBS = {
  'food-cashier': {
    title: 'Food District Cashier', districtId: 'food', skill: 'Business',
    payrollAccountId: 'food-district-payroll', payPerShift: 15,
  },
  'resort-dealer': {
    title: 'Venus Resort Dealer', districtId: 'venus-resort', skill: 'Management',
    payrollAccountId: 'venus-resort-payroll', payPerShift: 20,
  },
  'music-gig': {
    title: 'Vulture Music Gig', districtId: 'vulture-music', skill: 'Crafting',
    payrollAccountId: 'vulture-music-payroll', payPerShift: 18,
  },
  'combat-trainer': {
    title: 'Combat Sports Trainer', districtId: 'combat-sports', skill: 'Athletics',
    payrollAccountId: 'combat-sports-payroll', payPerShift: 22,
  },
  'boutique-stylist': {
    title: 'DEGVCHI Boutique Stylist', districtId: 'fashion', skill: 'Art',
    payrollAccountId: 'fashion-district-payroll', payPerShift: 17,
  },
  lumberjack: {
    title: 'Frontier Lumberjack', districtId: 'frontier', skill: 'Construction',
    payrollAccountId: PLANETARY_GOVERNORS_PAYROLL, payPerShift: 14,
    yields: { type: 'wood', amount: 8 },
  },
  farmer: {
    title: 'Frontier Farmer', districtId: 'frontier', skill: 'Agriculture',
    payrollAccountId: PLANETARY_GOVERNORS_PAYROLL, payPerShift: 14,
    yields: { type: 'crop', amount: 8 },
  },
  hunter: {
    title: 'Frontier Hunter', districtId: 'frontier', skill: 'Combat',
    payrollAccountId: PLANETARY_GOVERNORS_PAYROLL, payPerShift: 16,
    yields: { type: 'game', amount: 5 },
  },
};

export function listJobs() {
  return Object.entries(JOBS).map(([id, job]) => ({ id, ...job }));
}

export function getJob(jobId) {
  const job = JOBS[jobId];
  if (!job) throw new Error(`jobs: no job "${jobId}"`);
  return job;
}

export function createJobsStore() {
  return { assignments: {}, shifts: [], nextShiftId: 1 };
}

export function clockIn(store, { workerId, jobId, now = Date.now() } = {}) {
  if (!workerId) throw new Error('clockIn requires a workerId');
  getJob(jobId); // throws on an unknown job
  if (store.assignments[workerId]) {
    throw new Error(`clockIn: "${workerId}" is already clocked in to "${store.assignments[workerId].jobId}"`);
  }
  store.assignments[workerId] = { jobId, startedAt: now };
  return store.assignments[workerId];
}

// `transferFn` is injected, same decoupling as every other
// money-moving pure-logic module in this directory. `resourcesStore`/
// `grantMaterialsFn` are optional and injected the same way
// `property.js`'s `upgradeHome` takes its own materials wiring — omit
// both and only VCoin is paid, which is what every job without a real
// `yields` entry, and every existing caller/test, still does. When
// given, a real yield is granted strictly AFTER the VCoin transfer
// succeeds: it is a produced bonus, not a payment FROM the worker, so
// there is nothing to roll back on its own, and a failed payout must
// not also hand out a yield for a shift that never completed.
export async function clockOutAndPay(store, {
  workerId, transferFn, now = Date.now(), resourcesStore, grantMaterialsFn,
} = {}) {
  const assignment = store.assignments[workerId];
  if (!assignment) throw new Error(`clockOutAndPay: "${workerId}" is not clocked in`);
  if (typeof transferFn !== 'function') throw new Error('clockOutAndPay requires a transferFn');
  if (resourcesStore && typeof grantMaterialsFn !== 'function') {
    throw new Error('clockOutAndPay: resourcesStore requires a grantMaterialsFn');
  }

  const job = getJob(assignment.jobId);
  // Deleted before the transfer is attempted (same claim-before-pay
  // ordering as the shift record below) but restored on failure —
  // a worker whose payout fails is still clocked in, not quietly
  // un-assigned with no pay and no shift to show for it.
  delete store.assignments[workerId];

  const shift = {
    id: store.nextShiftId++,
    workerId,
    jobId: assignment.jobId,
    skill: job.skill,
    startedAt: assignment.startedAt,
    endedAt: now,
    pay: job.payPerShift,
    paid: false,
  };
  // Claim before pay: the shift record exists, unpaid, before the
  // transfer is even attempted — so a crash mid-transfer leaves a
  // real, visible "owed" record rather than nothing at all.
  store.shifts.push(shift);

  try {
    await transferFn({
      fromUserId: job.payrollAccountId,
      toUserId: workerId,
      amount: job.payPerShift,
      reason: `vdp-shift-${job.title}`,
    });
    shift.paid = true;
  } catch (err) {
    store.shifts.splice(store.shifts.indexOf(shift), 1);
    store.assignments[workerId] = assignment;
    throw err;
  }

  if (resourcesStore && job.yields) {
    const granted = grantMaterialsFn(resourcesStore, workerId, { [job.yields.type]: job.yields.amount });
    shift.yielded = { type: job.yields.type, amount: job.yields.amount };
    shift.materialsAfter = granted;
  }

  return shift;
}

export function currentAssignment(store, workerId) {
  return store.assignments[workerId] || null;
}

export function shiftsFor(store, workerId) {
  return store.shifts.filter((s) => s.workerId === workerId);
}
