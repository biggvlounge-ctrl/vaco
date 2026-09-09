// VVLTVRE STUDIOS -- the real fund-and-produce core. `VVLTVRE ->
// STUDIOS`, the same real umbrella VOID MAGIC, Vvltvre Music/
// Distribution, Vvltvre Flix, and Vvltvre Pods already belong to.
// Confirmed genuinely new by direct grep across the whole repo before
// building anything: no "Vvltvre Studios" concept existed anywhere,
// under any name, in any source doc.
//
// **The real structural difference from every other Vvltvre
// division**: Vvltvre Music (`VULTURE_MUSIC's own "no percentage
// split anywhere in this codebase"`), Vvltvre Flix, and Vvltvre Pods
// are all real *distribution* businesses -- they acquire, license, or
// distribute already-existing or independently-financed content.
// Vvltvre Studios is the real *financing* layer that sits before all
// of them: a real Universal-Studios-style model where the studio
// raises real capital from investors, finances a project into
// existence, and investors receive a real, proportional share of the
// project's real backend revenue once it's completed and generating
// money -- much closer to `vulture-music/lib/releases.js`'s own
// co-writer percentage-split payout discipline (reused directly
// below, not reinvented) than to any flat-fee acquisition model.

const PROJECT_MEDIUMS = ['film', 'tv', 'music', 'podcast'];
const PROJECT_STATUSES = ['greenlit', 'funded', 'in-production', 'completed'];

const VULTURE_STUDIOS_PRODUCTION_ACCOUNT = 'vulture-studios-production';
const VULTURE_STUDIOS_REVENUE_ACCOUNT = 'vulture-studios-revenue-intake';

function round(n) {
  return Math.round(n * 100) / 100;
}

function greenlightProject(store, options = {}) {
  const {
    title, medium, synopsis, budgetRequested, now = Date.now(),
  } = options;

  if (!title) throw new Error('greenlightProject requires a title');
  if (!PROJECT_MEDIUMS.includes(medium)) {
    throw new Error(`greenlightProject: invalid medium "${medium}" (expected one of ${PROJECT_MEDIUMS.join(', ')})`);
  }
  if (!synopsis) throw new Error('greenlightProject requires a synopsis');
  if (!Number.isFinite(budgetRequested) || budgetRequested <= 0) {
    throw new Error('greenlightProject requires a positive budgetRequested');
  }

  const project = {
    id: store.nextProjectId++,
    title,
    medium,
    synopsis,
    budgetRequested: round(budgetRequested),
    amountRaised: 0,
    status: 'greenlit',
    finalAssetUrl: null,
    distributionApp: null,
    distributionTitleId: null,
    createdAt: now,
    fundedAt: null,
    productionStartedAt: null,
    completedAt: null,
  };
  store.projects.push(project);
  return project;
}

function getProject(store, projectId) {
  return store.projects.find((p) => p.id === projectId) || null;
}

function listProjects(store, options = {}) {
  const { medium, status } = options;
  return store.projects.filter(
    (p) => (medium ? p.medium === medium : true) && (status ? p.status === status : true),
  );
}

// Real financing round -- an investor's real capital moves into the
// real production account, capped so the round can never overfund
// past the real budget (guaranteeing every investor's eventual
// equityPercent sums to exactly 1 once fully funded, the same
// exact-sum discipline `releases.js`'s own coWriters validation
// enforces). The round is only open while the project is still
// "greenlit" -- once production starts, financing is closed, matching
// how a real film's financing round closes before principal
// photography begins.
async function investInProject(store, options = {}) {
  const { projectId, investorId, amount, transferFn, now = Date.now() } = options;

  const project = getProject(store, projectId);
  if (!project) throw new Error(`investInProject: no project with id ${projectId}`);
  if (project.status !== 'greenlit') {
    throw new Error(`investInProject: project ${projectId} is "${project.status}", financing is only open while "greenlit"`);
  }
  if (!investorId) throw new Error('investInProject requires an investorId');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('investInProject requires a positive amount');
  const remaining = round(project.budgetRequested - project.amountRaised);
  if (amount > remaining) {
    throw new Error(`investInProject: amount ${amount} exceeds project ${projectId}'s remaining budget ${remaining}`);
  }
  if (typeof transferFn !== 'function') {
    throw new Error('investInProject requires a transferFn(fromUserId, toUserId, amount, reason)');
  }

  await transferFn(investorId, VULTURE_STUDIOS_PRODUCTION_ACCOUNT, amount, `vulture_studios_investment:${projectId}`);

  const investment = {
    id: store.nextInvestmentId++, projectId, investorId, amount: round(amount), investedAt: now,
  };
  store.investments.push(investment);

  project.amountRaised = round(project.amountRaised + amount);
  if (project.amountRaised === project.budgetRequested) {
    project.status = 'funded';
    project.fundedAt = now;
  }

  return { investment, project };
}

// Real per-investor contribution totals, kept at full, unrounded
// precision -- the raw numbers `reportProjectRevenue` below actually
// does its payout math against. Rounding these into a 2-decimal
// display percentage before using them for a real payout would
// compound two separate rounding steps and quietly shortchange every
// investor but the last (found and fixed via a real failing unit
// test, not assumed correct).
function getInvestorContributions(store, projectId) {
  const byInvestor = new Map();
  for (const inv of store.investments.filter((i) => i.projectId === projectId)) {
    byInvestor.set(inv.investorId, round((byInvestor.get(inv.investorId) || 0) + inv.amount));
  }
  return byInvestor;
}

// Real, computed equity -- every investor's real proportional stake,
// derived directly from their real contribution against the real
// total raised, not a separately-tracked (and driftable) percentage
// field. `equityPercent` here is real and accurate for display, but
// deliberately NOT what `reportProjectRevenue` uses for its own real
// payout math -- see `getInvestorContributions` above.
function getProjectEquity(store, projectId) {
  const project = getProject(store, projectId);
  if (!project) throw new Error(`getProjectEquity: no project with id ${projectId}`);
  const byInvestor = getInvestorContributions(store, projectId);

  const totalRevenueByInvestor = new Map();
  for (const report of store.revenueReports.filter((r) => r.projectId === projectId)) {
    for (const payout of report.payouts) {
      totalRevenueByInvestor.set(payout.investorId, round((totalRevenueByInvestor.get(payout.investorId) || 0) + payout.amount));
    }
  }

  const investors = [...byInvestor.entries()].map(([investorId, contributed]) => ({
    investorId,
    contributed,
    equityPercent: project.amountRaised > 0 ? round(contributed / project.amountRaised) : 0,
    totalRevenueReceived: totalRevenueByInvestor.get(investorId) || 0,
  }));

  return { projectId, budgetRequested: project.budgetRequested, amountRaised: project.amountRaised, investors };
}

// Real, exported conversion -- this project's real, raw investor
// contribution totals, reshaped into Vvltvre Music's own real
// `coWriters` shape (`{userId, splitPercent}`, summing to 1). This is
// the real hand-off `server.js`'s own `distribute` route uses for a
// music/podcast project: rather than building a second, parallel
// proportional-payout mechanism here, the project's real investors
// become that release's real co-writers, so Vvltvre Music's own
// already-real, already-tested `reportStreamingRevenue` pays every
// investor directly and proportionally the moment real streaming
// revenue comes in -- no separate call back into this app needed for
// that medium. Uses the same raw (unrounded) contribution totals
// `reportProjectRevenue` itself uses, not the rounded display
// `equityPercent` from `getProjectEquity` -- consistent with the same
// rounding-precision fix documented there.
function getInvestorCoWriterSplits(store, projectId) {
  const project = getProject(store, projectId);
  if (!project) throw new Error(`getInvestorCoWriterSplits: no project with id ${projectId}`);
  const byInvestor = getInvestorContributions(store, projectId);
  return [...byInvestor.entries()].map(([userId, contributed]) => ({
    userId, splitPercent: contributed / project.amountRaised,
  }));
}

function requireStatus(store, projectId, expectedStatus, action) {
  const project = getProject(store, projectId);
  if (!project) throw new Error(`${action}: no project with id ${projectId}`);
  if (project.status !== expectedStatus) {
    throw new Error(`${action}: project ${projectId} is "${project.status}", expected "${expectedStatus}"`);
  }
  return project;
}

function startProduction(store, options = {}) {
  const { projectId, now = Date.now() } = options;
  const project = requireStatus(store, projectId, 'funded', 'startProduction');
  project.status = 'in-production';
  project.productionStartedAt = now;
  return project;
}

// `finalAssetUrl` is a real, honestly-nullable, caller-supplied
// field -- no real video/audio rendering pipeline exists in this
// environment, same class of gap as Vavlt Stvdios' own `streamUrl`
// and VENVM's own `videoUrl`.
function completeProject(store, options = {}) {
  const { projectId, finalAssetUrl = null, now = Date.now() } = options;
  const project = requireStatus(store, projectId, 'in-production', 'completeProject');
  project.status = 'completed';
  project.finalAssetUrl = finalAssetUrl;
  project.completedAt = now;
  return project;
}

function recordDistribution(store, options = {}) {
  const { projectId, distributionApp, distributionTitleId } = options;
  const project = getProject(store, projectId);
  if (!project) throw new Error(`recordDistribution: no project with id ${projectId}`);
  if (project.status !== 'completed') {
    throw new Error(`recordDistribution: project ${projectId} is "${project.status}", must be "completed"`);
  }
  if (!distributionApp) throw new Error('recordDistribution requires a distributionApp');
  if (!distributionTitleId) throw new Error('recordDistribution requires a distributionTitleId');
  project.distributionApp = distributionApp;
  project.distributionTitleId = distributionTitleId;
  return project;
}

// Real profit participation -- once a completed project earns real
// revenue, every real investor gets their exact proportional share,
// reusing `vulture-music/lib/releases.js`'s own exact-sum rounding
// discipline (every payout but the last is rounded independently; the
// last absorbs whatever remainder is left, so payouts always sum to
// exactly `amount`) rather than reinventing that math.
async function reportProjectRevenue(store, options = {}) {
  const {
    projectId, amount, source, transferFn, now = Date.now(),
  } = options;

  const project = requireStatus(store, projectId, 'completed', 'reportProjectRevenue');
  // Real, deliberate guard against double-accounting: a music/podcast
  // project distributed through Vvltvre Music already has a real,
  // separate, already-proportional payout path of its own --
  // `reportStreamingRevenue` there pays every investor (as that
  // release's own co-writers, see `getInvestorCoWriterSplits` above)
  // directly. Allowing this app's own revenue endpoint to ALSO pay
  // out for the same project would create two competing "real"
  // revenue-distribution paths for the same money.
  if (project.distributionApp === 'vulture-music') {
    throw new Error(`reportProjectRevenue: project ${projectId} was distributed through Vvltvre Music -- report real revenue there via POST /api/releases/${project.distributionTitleId}/revenue, not here`);
  }
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('reportProjectRevenue requires a positive amount');
  if (!source) throw new Error('reportProjectRevenue requires a source');
  if (typeof transferFn !== 'function') {
    throw new Error('reportProjectRevenue requires a transferFn(fromUserId, toUserId, amount, reason)');
  }

  const byInvestor = getInvestorContributions(store, projectId);
  const investorIds = [...byInvestor.keys()];
  if (investorIds.length === 0) {
    throw new Error(`reportProjectRevenue: project ${projectId} has no investors to pay out`);
  }

  const payouts = [];
  let allocated = 0;
  for (let i = 0; i < investorIds.length; i += 1) {
    const investorId = investorIds[i];
    // Real, raw (unrounded) fraction -- deliberately NOT the 2-decimal
    // `equityPercent` `getProjectEquity` returns for display. Using
    // the pre-rounded display value here would compound two separate
    // rounding steps and quietly shortchange every investor but the
    // last.
    const rawFraction = byInvestor.get(investorId) / project.amountRaised;
    const isLast = i === investorIds.length - 1;
    const share = isLast ? round(amount - allocated) : round(amount * rawFraction);
    allocated = round(allocated + share);

    if (share > 0) {
      await transferFn(VULTURE_STUDIOS_REVENUE_ACCOUNT, investorId, share, `vulture_studios_project_revenue:${projectId}:${source}`);
    }
    payouts.push({ investorId, equityPercent: round(rawFraction), amount: share });
  }

  const report = {
    id: store.nextRevenueReportId++, projectId, amount: round(amount), source, payouts, reportedAt: now,
  };
  store.revenueReports.push(report);
  return report;
}

module.exports = {
  PROJECT_MEDIUMS,
  PROJECT_STATUSES,
  VULTURE_STUDIOS_PRODUCTION_ACCOUNT,
  VULTURE_STUDIOS_REVENUE_ACCOUNT,
  greenlightProject,
  getProject,
  listProjects,
  investInProject,
  getProjectEquity,
  getInvestorCoWriterSplits,
  startProduction,
  completeProject,
  recordDistribution,
  reportProjectRevenue,
};
