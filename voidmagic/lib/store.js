// VOID MAGIC -- shared, growing store object.
// Same pattern established across this session (world-layer/venvs/
// hvntz/void/voken/vago/vxllage): one factory whose shape grows by
// adding new top-level array/counter fields as each phase adds a
// module.

function createVoidMagicStore() {
  return {
    experiences: [],
    nextExperienceId: 1,
    bookings: [],
    nextBookingId: 1,
    eventServiceRequests: [],
    nextEventServiceRequestId: 1,
    waitingRoomSessions: [],
    nextWaitingRoomSessionId: 1,
    notifications: [],
    nextNotificationId: 1,
    favorites: [],
    nextFavoriteId: 1,
    mediaOrders: [],
    nextMediaOrderId: 1,
  };
}

module.exports = { createVoidMagicStore };
