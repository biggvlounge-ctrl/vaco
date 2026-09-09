// V4 -- display surface capabilities for agent presentation.
// Source of truth: QVAN_LESLIE_DESKINS_TECH_AVATAR.md ("TV Play,
// CarPlay, FaceTime -- all three agents use the same real,
// already-built V4 surfaces"), plus the same three surfaces asserted
// as existing in hvntz/HVNTZ_COMPLETE_REVENUE_STACK.md and
// cvnvo/CVNVO_DATING_COMPARABLES.md.
//
// **Correcting the record those documents share**: all three describe
// these surfaces as already built and inherited for free ("No new
// capability needs to be built -- this is confirming an existing V4
// feature applies here too"). They were not built. Before this module,
// `v4-proxy/server.js` was 106 lines holding exactly one route, a
// pass-through to the Anthropic API. There was no surface concept at
// all. This file is the server-side half of that missing foundation.
//
// **What a surface is here**: not a renderer. This repo has no client
// display code for a television, a car head unit, or a video call.
// What is real and genuinely belongs on the server is deciding *what
// a given surface is allowed to show* and handing back a presentation
// contract a client can implement. A client obeying this contract
// would be correct; nothing here pretends to draw pixels.
//
// **The one rule in this file that is not a preference**: a moving
// vehicle never gets video. See CARPLAY below.

export const FRAMINGS = ['none', 'avatar-static', 'head-and-shoulders', 'full-body'];

//: Real ordering, used to clamp a request down to what a surface
//: permits. A request for more than the surface allows is not an
//: error -- it is clamped and reported, so a caller can ask for its
//: ideal framing everywhere and get the best legal answer per surface.
const FRAMING_RANK = Object.fromEntries(FRAMINGS.map((f, i) => [f, i]));

export const SURFACES = {
  'tv-play': {
    label: 'TV Play',
    supportsVideo: true,
    maxFraming: 'full-body',
    audioPrimary: false,
    // The lean-back surface: largest canvas, viewer is seated and
    // attentive, and the only one where full-body actually reads at
    // viewing distance. This is the surface full-body was asked for.
    driverSafetyGoverned: false,
    interactionModel: 'lean-back',
  },
  carplay: {
    label: 'CarPlay',
    supportsVideo: false,
    maxFraming: 'avatar-static',
    audioPrimary: true,
    //: Not a stylistic choice and not overridable. Automotive head-unit
    //: platforms prohibit video playback and animated content while the
    //: vehicle is in motion, because the driver is the audience. A
    //: full-body animated presenter on a dashboard is precisely the
    //: thing that rule exists to prevent. Encoded as a hard ceiling on
    //: the surface itself rather than a check some call site might
    //: forget.
    driverSafetyGoverned: true,
    interactionModel: 'voice-first',
  },
  facetime: {
    label: 'FaceTime-style call',
    supportsVideo: true,
    //: Head-and-shoulders, not full-body, and this is a real
    //: constraint rather than a limitation: a video call frames a
    //: face. A full-body figure in a call window is the wrong shape
    //: for the medium and reads as a broadcast, not a conversation.
    maxFraming: 'head-and-shoulders',
    audioPrimary: false,
    driverSafetyGoverned: false,
    interactionModel: 'two-way-realtime',
  },
  web: {
    label: 'Web / in-app',
    supportsVideo: true,
    maxFraming: 'head-and-shoulders',
    audioPrimary: false,
    driverSafetyGoverned: false,
    interactionModel: 'two-way-realtime',
  },
  text: {
    label: 'Text only',
    supportsVideo: false,
    maxFraming: 'none',
    audioPrimary: false,
    driverSafetyGoverned: false,
    interactionModel: 'asynchronous',
  },
};

export const SURFACE_IDS = Object.keys(SURFACES);

export class UnknownSurfaceError extends Error {}

export function getSurface(surfaceId) {
  const surface = SURFACES[surfaceId];
  if (!surface) {
    throw new UnknownSurfaceError(
      `unknown surface "${surfaceId}" (known: ${SURFACE_IDS.join(', ')})`
    );
  }
  return surface;
}

// The real decision this module exists to make: given a surface, a
// requested framing, and the vehicle's motion state, what may actually
// be shown right now.
//
// Degrading is the normal path, not a failure. A driver being handed
// audio instead of video is the system working correctly, so it
// returns a result with a stated reason rather than throwing. An
// unknown *surface* does throw -- that is a caller bug, not a
// runtime condition.
export function resolvePresentation(options = {}) {
  const {
    surfaceId, requestedFraming = 'head-and-shoulders', vehicleMoving,
  } = options;
  const surface = getSurface(surfaceId);
  if (!FRAMING_RANK[requestedFraming] && requestedFraming !== 'none') {
    throw new Error(`unknown framing "${requestedFraming}" (known: ${FRAMINGS.join(', ')})`);
  }

  const notes = [];
  let framing = requestedFraming;
  let video = surface.supportsVideo;

  // Clamp to the surface's own ceiling first.
  if (FRAMING_RANK[framing] > FRAMING_RANK[surface.maxFraming]) {
    notes.push(
      `${surface.label} caps framing at "${surface.maxFraming}"; "${requestedFraming}" was clamped`
    );
    framing = surface.maxFraming;
  }

  //: The safety clamp, applied after and never before -- it must be
  //: able to override whatever the surface would otherwise allow.
  //: `vehicleMoving` being undefined is treated as moving, not as
  //: "no": on a driver-facing surface the unknown state is the
  //: dangerous one, so the safe assumption is the default rather than
  //: something a caller has to remember to pass.
  let assumedMoving = false;
  if (surface.driverSafetyGoverned) {
    const moving = vehicleMoving === undefined ? true : Boolean(vehicleMoving);
    assumedMoving = vehicleMoving === undefined;
    if (moving) {
      video = false;
      if (framing !== 'none') {
        notes.push(
          assumedMoving
            ? 'vehicle motion state was not provided; assumed moving and reduced to audio-only'
            : 'vehicle is in motion; reduced to audio-only for driver safety'
        );
      }
      framing = 'none';
    }
  }

  return {
    surfaceId,
    label: surface.label,
    framing,
    video,
    audioPrimary: surface.audioPrimary || !video,
    interactionModel: surface.interactionModel,
    requestedFraming,
    degraded: framing !== requestedFraming,
    degradedForSafety: surface.driverSafetyGoverned && framing === 'none' && requestedFraming !== 'none',
    assumedMoving,
    notes,
  };
}

export function describeSurfaces() {
  return SURFACE_IDS.map((id) => ({ id, ...SURFACES[id] }));
}
