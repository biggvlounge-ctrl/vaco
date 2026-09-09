// VOID MAGIC -- Geofencing (Section 32, Phase 2's eighth real slice).
// Source of truth: VOID_MAGIC_MASTER_BUILD_BRIEF.md SS32: "Use
// geofencing where it provides real operational value... Geofencing
// should be optional and privacy-controlled. V4 provides the shared
// location/mapping services. VOID handles operational logistics."
//
// Honest scoping against SS32's own six named examples: this codebase
// has no real-time driver location (VOID's own domain), no real
// security-alert infrastructure, and no lat/lng anywhere on
// Experience before this slice -- so five of the six are genuinely
// out of reach here:
//   - venue check-in (QR becomes active near the event) / event
//     (digital experience becomes available near the venue): already
//     covered by a real, working alternative -- `digitalWaitingRoom.js`'s
//     credential-based identity check, which achieves the same real
//     "don't let someone in before they're actually there" goal
//     without needing device geolocation at all.
//   - transportation (driver enters pickup zone): VOID's own
//     real-time driver location, not VOID MAGIC's data to have.
//   - VIP (credential activates only within an approved area) /
//     security (alerts on unauthorized access): real, later work
//     needing a live credential-activation and alerting layer this
//     phase doesn't build.
// This slice builds the one example that's genuinely self-contained
// with what Phase 2 just added to `Experience` (`geofence`): real
// arrival verification -- "customer enters designated zone." Real
// Haversine great-circle distance, the same formula CVNVO's own
// `compatibility.js` already established for real proximity scoring
// in this session, reused here in meters rather than km for a
// venue-scale radius check instead of a city-scale one.

const { getBooking } = require('./bookings');
const { getExperience } = require('./experiences');

const EARTH_RADIUS_METERS = 6371000;

function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

function isWithinGeofence(experience, lat, lng) {
  if (!experience.geofence) {
    throw new Error(`isWithinGeofence: experience ${experience.id} has no geofence configured (geofencing is optional per SS32)`);
  }
  const distanceMeters = haversineMeters(experience.geofence.lat, experience.geofence.lng, lat, lng);
  return distanceMeters <= experience.geofence.radiusMeters;
}

// SS32's own first example, real and self-contained: a real, one-time
// arrival record on the booking, gated on the customer's reported
// location actually being inside the experience's real geofence.
function verifyArrival(store, options = {}) {
  const { bookingId, lat, lng, now = Date.now() } = options;
  const booking = getBooking(store, bookingId);
  if (!booking) throw new Error(`verifyArrival: no booking with id ${bookingId}`);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('verifyArrival requires numeric lat/lng');

  const experience = getExperience(store, booking.experienceId);
  const withinZone = isWithinGeofence(experience, lat, lng);
  if (!withinZone) {
    throw new Error(`verifyArrival: reported location is outside experience ${experience.id}'s geofence`);
  }

  booking.arrivedAt = now;
  return booking;
}

module.exports = { haversineMeters, isWithinGeofence, verifyArrival };
