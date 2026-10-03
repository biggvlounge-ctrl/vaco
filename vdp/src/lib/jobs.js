// VDP — jobs/careers.
//
// Real, fixed job slots tied to districts that already exist and
// already have a real money path: Food District (`foodDistrict.js`,
// a real order ledger), Venus Resort (`venusResort.js`'s `NPCS`
// dealer role — a decorative staff slot a player can now fill), and a
// Vulture Music gig (`vultureMusicClient.js`, a real `-embed` client).
// `payShift` pays through V3 (`v3Client.js`'s `transferVCoin`) from a
// named payroll account for that district — the same pattern this
// repo already uses for non-player ledger accounts (DEGVCHI's brand
// `sponsor`/`creatorId` fields) — with the claim-before-pay ordering
// `degvchi.js`'s `purchaseWearable` proved: the shift is marked paid
// before the transfer is awaited, rolled back on failure, so no
// second place invents a payout.

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
// money-moving pure-logic module in this directory.
export async function clockOutAndPay(store, { workerId, transferFn, now = Date.now() } = {}) {
  const assignment = store.assignments[workerId];
  if (!assignment) throw new Error(`clockOutAndPay: "${workerId}" is not clocked in`);
  if (typeof transferFn !== 'function') throw new Error('clockOutAndPay requires a transferFn');

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

  return shift;
}

export function currentAssignment(store, workerId) {
  return store.assignments[workerId] || null;
}

export function shiftsFor(store, workerId) {
  return store.shifts.filter((s) => s.workerId === workerId);
}
