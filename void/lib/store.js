// VOID — shared, growing store object.
// Same pattern established across this session (world-layer/venvs/
// hvntz): one factory whose shape grows by adding new top-level
// array/counter fields as each phase adds a module, rather than
// separate disconnected stores per module.

const { SERVICE_CONFIGS } = require('./verticalServiceConfigs');

function createVoidStore() {
  return {
    stations: [],
    nextStationId: 1,
    noFlyZones: [],
    nextNoFlyZoneId: 1,
    droneRoutes: [],
    nextRouteId: 1,
    jobs: [],
    nextJobId: 1,
    // Provider profiles: who can do what, and when. See
    // lib/providerProfiles.js -- skills live on the provider rather
    // than the provider living inside a vertical, which is what makes
    // a cross-vertical service day possible at all.
    providerProfiles: [],

    // Two-person rule for licensing-gated verticals only -- see
    // lib/twoPersonVetting.js and OPERATOR_ROLES_SCOPE.md §3.4. One
    // operator proposes, a different one approves.
    skillVerificationProposals: [],
    nextSkillProposalId: 1,
    // Per-vertical domain records. Each service app owns its own
    // shape; they share the marketplace loop, not their vocabulary.
    pets: [],
    nextPetId: 1,
    petCareBookings: [],
    nextPetCareBookingId: 1,
    laundryOrders: [],
    nextLaundryOrderId: 1,
    // The service engine: every vertical's booking flow through one
    // lifecycle machine. See lib/serviceEngine.js and
    // lib/verticalServiceConfigs.js.
    serviceConfigs: SERVICE_CONFIGS,
    serviceSubjects: [],
    nextServiceSubjectId: 1,
    serviceBookings: [],
    nextServiceBookingId: 1,
    tripDeclarations: [],
    vehicleProfiles: [],
    reserveBookings: [],
    nextReserveBookingId: 1,
    commuteBatches: [],
    nextCommuteBatchId: 1,
    dedicatedLanes: [],
    nextDedicatedLaneId: 1,
    spotLoads: [],
    nextSpotLoadId: 1,
    hourlyBookings: [],
    nextHourlyBookingId: 1,
    externalBusinesses: [],
    nextExternalBusinessId: 1,
    deliveryManifests: [],
    nextManifestId: 1,
    affiliateStations: [],
    nextAffiliateStationId: 1,
    deliveryMethodSelections: [],
    nextDeliveryMethodSelectionId: 1,
    businessLockers: [],
    nextBusinessLockerId: 1,
    sellerInventoryPlacements: [],
    nextSellerInventoryPlacementId: 1,
    droneLoadingEvents: [],
    nextDroneLoadingEventId: 1,
    regulatedDeliveryBoxes: [],
    nextRegulatedDeliveryBoxId: 1,
    staffingPositions: [],
    nextStaffingPositionId: 1,
    huntStaffingRequests: [],
    nextHuntStaffingRequestId: 1,
    mobileDockingVehicles: [],
    nextMobileDockingVehicleId: 1,
    launchpadDrivers: [],
    nextLaunchpadDriverId: 1,
    dualMobilityCoordinations: [],
    nextDualMobilityCoordinationId: 1,
    taasSubscriptions: [],
    nextTaasSubscriptionId: 1,
    gigDrivers: [],
    voidDSPs: [],
    nextDspId: 1,
    kitchenStreams: [],
    movingJobs: [],
    nextMovingJobId: 1,
    realEstateMediaJobs: [],
    nextRealEstateMediaJobId: 1,
    hubOriginatedShipments: [],
    nextHubShipmentId: 1,
    voidLockers: [],
    nextLockerId: 1,
    lockerToDoorRequests: [],
    nextLockerToDoorId: 1,
  };
}

module.exports = { createVoidStore };
