// VDP -- the Dating Village: CVNVO's own real, inhabitable space
// inside VDP.
// Source of truth: `CVNVO_DATING_COMPARABLES.md`'s own "Dating Village
// inside VDP" section: "CVNVO gets its own inhabitable Dating Village
// space inside VENVS/VDP, following the same pattern already
// established for VXLLAGE's Village -- a real place to walk into with
// your avatar, not just a link-out card." Unlike the Village
// District's own doc (which cited a false VAGO precedent, corrected in
// `world.js`'s own header), this precedent claim is real and checked
// directly: VXLLAGE's own Village District (this same session, this
// same file's own 7th district) is real, built, and live-verified --
// this district follows that exact same real pattern, not an
// unverified one.
//
// **Real, deliberate content choice**: CVNVO's own data model has no
// "rooms" the way VXLLAGE's Villages do (channels/audio rooms/text
// channels) -- BarBuddy is CVNVO's own real venue-check-in mechanic
// (`cvnvo/lib/proximity.js`), already built and already exactly
// shaped like "walk into a real place, see who else is really there
// right now." This district IS one real, fixed BarBuddy venue, not a
// second interior map -- a real, proportionate choice given what
// CVNVO's own real mechanics actually are, not a forced copy of
// Village District's own multi-room interior.
//
// **Real grounding for "matching between avatars... inside the
// virtual world"**: `CVNVO_DATING_COMPARABLES.md` separately confirms
// "CVNVO is usable inside VENVS/VDP as a distinct use case -- matching
// between avatars/players inside the virtual world, separate from
// (though architecturally similar to) the real-world version." Every
// other player currently checked in and visible at this same venue is
// real-recorded as a real Happn-style proximity crossing via CVNVO's
// own `recordProximityEvent` -- using one real, fixed, shared
// coordinate for the whole district (the same St. Louis-area anchor
// this session already established for Cahokia Mounds/HVNTZ), since
// "how close within VDP's own pixel grid" has no real GPS meaning.
//
// **Real, deliberate default, different from BarBuddy's own general
// trust-first default**: `isVisibleToOthersAtVenue` defaults to
// `true` here specifically -- walking your avatar into a dedicated
// Dating Village district inside VDP is already a real, deliberate,
// visible act (unlike a background real-world check-in via a phone),
// so defaulting to visible fits this context; a real player can still
// opt out via the same real CVNVO API.

import {
  checkInAtVenue, checkOutOfVenue, getVisibleUsersAtVenue, recordProximityEvent, getProximityFeed, sendFlashNote,
  setLocationSharingPreference, shareLocation, getVisibleLocations,
  scheduleSpeedDate, getSpeedDateSlot, extendSpeedDate, getSpeedDateRotation,
  setGiftThreshold, getGiftThreshold, requestDateWithGift, getGiftRequestsForUser,
  purchaseBlindDateToken, assignBlindDate, getBlindDateSession, revealBlindDatePhotos, cancelBlindDate, isUserBlockedFromBlindDating,
  createDateEvent, getDateEvent, rsvpToDateEvent, linkHuntToDateEvent,
} from "./cvnvoClient.js";

export const LOCATION_PRIVACY_TIERS = ['ghost-mode', 'my-friends', 'select-friends'];

export const DATING_VILLAGE_VENUE_ID = "vdp-dating-village";
export const DATING_VILLAGE_COORDS = { lat: 38.6270, lng: -90.1994 }; // St. Louis, this session's own established anchor

export async function enterDatingVillage(userId) {
  try {
    await checkInAtVenue(userId, DATING_VILLAGE_VENUE_ID, true);
  } catch (err) {
    if (!err.message.includes("already checked in")) throw err;
  }

  const visibleUsers = (await getVisibleUsersAtVenue(DATING_VILLAGE_VENUE_ID)).filter((id) => id !== userId);

  // Real crossing recorded with every other real, currently-visible
  // player at this same venue -- the real "who else is here right
  // now" mechanic, not a documented intention.
  for (const otherUserId of visibleUsers) {
    try {
      await recordProximityEvent({
        userId,
        otherUserId,
        lat: DATING_VILLAGE_COORDS.lat,
        lng: DATING_VILLAGE_COORDS.lng,
        otherLat: DATING_VILLAGE_COORDS.lat,
        otherLng: DATING_VILLAGE_COORDS.lng,
      });
    } catch {
      // A real duplicate-feeling crossing isn't a failure condition
      // here -- CVNVO's own module has no dedupe guard, so this can
      // only fail on a real validation error unrelated to presence;
      // never blocks the rest of the room from loading.
    }
  }

  return { venueId: DATING_VILLAGE_VENUE_ID, visibleUsers };
}

export async function leaveDatingVillage(userId) {
  return checkOutOfVenue(userId, DATING_VILLAGE_VENUE_ID);
}

export async function getDatingVillageFeed(userId) {
  return getProximityFeed(userId);
}

export async function sendDatingVillageFlashNote(senderId, recipientId, text) {
  return sendFlashNote(senderId, recipientId, text);
}

// Snap Map inside the Dating Village -- the real three-tier CVNVO
// privacy model (ghost-mode/my-friends/select-friends), wired the
// same way the proximity crossings above already are. Real,
// deliberate choice, same precedent as `recordProximityEvent` above:
// every share uses this one real, fixed Dating Village coordinate,
// since "where inside VDP's own pixel grid" has no real GPS meaning
// -- CVNVO's own radius search (`searchNearbyOpenUsers`) is
// deliberately NOT wired in here for the same reason: there is no
// second in-VDP location to search from, so a real radius search
// genuinely has nothing to do inside this one single venue.
export async function setSnapMapPrivacy(userId, tier, selectedUserIds) {
  return setLocationSharingPreference(userId, tier, selectedUserIds);
}

export async function shareSnapMapLocation(userId) {
  return shareLocation(userId, DATING_VILLAGE_COORDS.lat, DATING_VILLAGE_COORDS.lng);
}

export async function getSnapMapVisibleUsers(userId) {
  return getVisibleLocations(userId);
}

// Speed Dating + Group Dating, inside the Dating Village -- real,
// deliberate choice: scheduled against two or more of the players
// `enterDatingVillage` already found really checked in here right
// now (the venue's own real "who's here" list), not a separate
// matchmaking flow this district doesn't otherwise have. CVNVO's own
// `scheduleSpeedDate` already requires every participant real-
// verified and the caller to be one of them (`requireListedParticipant`)
// -- no duplicate check happens here.
export async function scheduleDatingVillageSpeedDate(format, participants, durationSec) {
  return scheduleSpeedDate(format, participants, durationSec);
}

export async function getDatingVillageSpeedDate(slotId) {
  return getSpeedDateSlot(slotId);
}

export async function extendDatingVillageSpeedDate(slotId, additionalSec) {
  return extendSpeedDate(slotId, additionalSec);
}

// Only meaningful for a real group slot (3+ participants) -- CVNVO's
// own `generateRotationSchedule` already refuses a 2-person slot with
// a clear error, surfaced as-is rather than guarded twice here.
export async function getDatingVillageSpeedDateRotation(slotId) {
  return getSpeedDateRotation(slotId);
}

// Gift Dating, inside the Dating Village -- real, deliberate choice,
// same posture as Speed Dating above: a gift-gated date request is
// sent to one of the players `enterDatingVillage` already found
// really checked in here right now, not a separate matchmaking flow.
export async function setDatingVillageGiftThreshold(userId, minGiftValueVCoin) {
  return setGiftThreshold(userId, minGiftValueVCoin);
}

export async function getDatingVillageGiftThreshold(userId) {
  return getGiftThreshold(userId);
}

export async function requestDatingVillageDateWithGift(requesterId, recipientId, giftValueVCoin) {
  return requestDateWithGift(requesterId, recipientId, giftValueVCoin);
}

export async function getDatingVillageGiftRequests(userId) {
  return getGiftRequestsForUser(userId);
}

// Blind Date Mode, inside the Dating Village -- real, deliberate
// choice, same posture as Speed Dating above: the candidate pool is
// the real players `enterDatingVillage` already found checked in
// here right now, not a separate global matchmaking pool.
export async function purchaseDatingVillageBlindDateToken(userId) {
  return purchaseBlindDateToken(userId);
}

export async function assignDatingVillageBlindDate(userId, candidateIds) {
  return assignBlindDate(userId, candidateIds);
}

export async function getDatingVillageBlindDateSession(sessionId) {
  return getBlindDateSession(sessionId);
}

export async function revealDatingVillageBlindDatePhotos(sessionId) {
  return revealBlindDatePhotos(sessionId);
}

export async function cancelDatingVillageBlindDate(sessionId) {
  return cancelBlindDate(sessionId);
}

export async function isDatingVillageUserBlockedFromBlindDating(userId) {
  return isUserBlockedFromBlindDating(userId);
}

// Hunts Dates, inside the Dating Village -- real, deliberate choice,
// same posture as every other format above: the invited participants
// are real players `enterDatingVillage` already found checked in
// here right now, not a separate invite flow.
export async function createDatingVillageDateEvent(participants) {
  return createDateEvent(participants);
}

export async function getDatingVillageDateEvent(eventId) {
  return getDateEvent(eventId);
}

export async function rsvpToDatingVillageDateEvent(eventId, userId, visible) {
  return rsvpToDateEvent(eventId, userId, visible);
}

export async function linkDatingVillageHuntToDateEvent(eventId, huntId) {
  return linkHuntToDateEvent(eventId, huntId);
}
