// HVNTZ — Digital Twin auto-scaling.
// Source of truth: HVNTZ_COMPLETE_REVENUE_STACK.md, "Digital twin
// auto-scaling — real-world growth automatically upgrades VDP": "a
// business's digital twin tier in VDP should be a computed value
// derived directly from their real-world Franchise List, not a
// separate purchase decision." Level 3 explicitly unlocks Vavlt
// Stvdios streaming + AI Business Intelligence (referenced from the
// earlier-established Digital Twin Level system this doc assumes,
// which doesn't exist as working code anywhere in this session --
// built here as a real, self-contained computation rather than a
// connection to something that isn't there).
//
// No exact thresholds are given anywhere -- computeDigitalTwinLevel's
// specific numbers (locationCount/share/revenue cutoffs) are real,
// deterministic, and flagged as interpretive, same posture as every
// other unspecified formula in this project.

const { getFranchiseList } = require('./revenueStack');
const { getParticipations } = require('./participation');

const LEVEL_2_LOCATION_THRESHOLD = 2;
const LEVEL_2_SHARE_THRESHOLD = 0.5;
const LEVEL_3_LOCATION_THRESHOLD = 3;
const LEVEL_3_REVENUE_THRESHOLD = 200;

function computeDigitalTwinLevel(store, businessId) {
  const franchiseList = getFranchiseList(store, businessId);
  const participations = getParticipations(store, businessId);

  const locationCount = franchiseList.length;
  const totalRevenue = Math.round(franchiseList.reduce((sum, entry) => sum + entry.revenueGenerated, 0) * 100) / 100;
  const maxParticipationShare = participations.reduce((max, p) => Math.max(max, p.scanRevenueShare), 0);
  const hasHubAsStore = participations.some((p) => p.participationType === 'hub-as-store');

  let level = 1;
  if (locationCount >= LEVEL_2_LOCATION_THRESHOLD || maxParticipationShare >= LEVEL_2_SHARE_THRESHOLD) {
    level = 2;
  }
  if (locationCount >= LEVEL_3_LOCATION_THRESHOLD || hasHubAsStore || totalRevenue >= LEVEL_3_REVENUE_THRESHOLD) {
    level = 3;
  }

  return {
    businessId,
    level,
    locationCount,
    totalRevenue,
    maxParticipationShare,
    vavltStreamingUnlocked: level >= 3,
    aiBusinessIntelligenceUnlocked: level >= 3,
  };
}

module.exports = {
  LEVEL_2_LOCATION_THRESHOLD,
  LEVEL_2_SHARE_THRESHOLD,
  LEVEL_3_LOCATION_THRESHOLD,
  LEVEL_3_REVENUE_THRESHOLD,
  computeDigitalTwinLevel,
};
