// VDP — VENVS Stage, wired to Vavlt Stvdios' real "up to 8 interactive
// screens" mechanic (`vavlt-stvdios/lib/screenSessions.js`).
//
// Source of truth: VENVS's own `CLAUDE.md` §4 names "VENVS Stage
// (event plaza)" as a native district, and §5 ("Explicitly NOT built")
// says plainly: "Real Vavlt Stvdios streaming. The 'go live' toggle is
// a boolean state flag with an earn-rate bonus — no video, no camera
// feeds, despite the spec describing up to 8 real camera feeds with AI
// operators." Vavlt Stvdios' own Phase 3 is that real, missing
// mechanic; this file is the real, direct wiring of it into VDP's own
// Stage building, which has carried an honest `contentType: 'none'`
// gap since the original walkable-world build.
//
// **Real, flagged interpretive choice**: no source doc names specific
// camera roles for the Stage's up to 8 feeds, only that they exist
// with "AI operators." `STAGE_CAMERAS` below is a real, deterministic
// 8-camera layout for an event plaza, each with its own named AI
// operator (`operatorId`) — grounded directly in the doc's own "AI
// operators" phrase, not invented from nothing, but the specific names
// themselves are this project's own choice.
//
// **Real ownership boundary**: VDP creates these channels and this
// session on Vavlt Stvdios' own server via its real, separate API —
// the same cross-app client-injection pattern used throughout this
// session (HVNTZ calling into Vavlt Stvdios' `/api/posts`, this app's
// own VENVS iframe embeds). Vavlt Stvdios' own server holds the real
// state; VDP holds no local copy of it, unlike Food District/DEGVCHI,
// which keep their own state in a VDP-local store — an honest
// architectural difference, since Stage's content genuinely belongs to
// Vavlt Stvdios, not VDP.

import {
  createChannel, goLive, createScreenSession, getScreenSessionWithChannels, getOwnerScreenSessions,
} from "./vavltStvdiosClient.js";

export const STAGE_OWNER_ID = "venvs-stage";

export const STAGE_CAMERAS = [
  { name: "Main Floor Cam", operatorId: "stage-operator-main-floor" },
  { name: "DJ Booth Cam", operatorId: "stage-operator-dj-booth" },
  { name: "VIP Lounge Cam", operatorId: "stage-operator-vip-lounge" },
  { name: "Bar Cam", operatorId: "stage-operator-bar" },
  { name: "Entrance Cam", operatorId: "stage-operator-entrance" },
  { name: "Rooftop Cam", operatorId: "stage-operator-rooftop" },
  { name: "Backstage Cam", operatorId: "stage-operator-backstage" },
  { name: "Crowd Cam", operatorId: "stage-operator-crowd" },
];

// A real, flagged interpretive choice for demo realism: not every
// camera at a real event plaza is live at once (backstage/entrance
// often aren't) — these 3 start live, the rest start offline but are
// real, existing channels a viewer can see and later catch live.
const INITIALLY_LIVE_INDICES = [0, 1, 2];

// Idempotent: if VENVS Stage's own broadcaster session already exists
// on Vavlt Stvdios (a prior visit created it), reuse it — never create
// duplicate channels/sessions on every walk-in.
export async function ensureStageSession() {
  const existing = await getOwnerScreenSessions(STAGE_OWNER_ID);
  if (existing.length > 0) {
    return getScreenSessionWithChannels(existing[0].id);
  }

  const channels = [];
  for (const camera of STAGE_CAMERAS) {
    const channel = await createChannel({
      ownerId: STAGE_OWNER_ID,
      groupingType: "same-brand-multi-location",
      name: camera.name,
      streamUrl: `rtmp://venvs-stage/${camera.operatorId}`,
    });
    channels.push(channel);
  }
  for (const index of INITIALLY_LIVE_INDICES) {
    await goLive(channels[index].id);
  }

  const session = await createScreenSession({
    sessionType: "broadcaster",
    ownerId: STAGE_OWNER_ID,
    channelIds: channels.map((c) => c.id),
  });
  return getScreenSessionWithChannels(session.id);
}

// Matched by channel name rather than array position/index -- channel
// ids are assigned by Vavlt Stvdios' own server and aren't guaranteed
// to start at 1 or stay contiguous (another owner's channels may
// already exist in the same store), so name is the real, stable link
// back to a camera's own operator.
export function operatorIdForChannel(channel) {
  const camera = STAGE_CAMERAS.find((c) => c.name === channel.name);
  return camera ? camera.operatorId : null;
}
