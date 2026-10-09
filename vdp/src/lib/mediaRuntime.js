// VDP — the real client half of a voice/video call.
//
// Finishes the real-time media control plane `server.cjs` already
// wires (`call-invite`/`call-end` over `/ws/world`, backed by
// vaco-media's real sessions/grants): this is the browser side that
// actually turns a join credential into connected media, or an honest
// "not connected" state, never the other thing.
//
// **`resolveJoin` talks to vaco-media directly, not through VDP's own
// backend.** `POST /api/join` is deliberately public on vaco-media's
// own server (no service credential) -- the credential itself is the
// authorization, the same reasoning `vaco-media/server.js`'s own
// comment on that route gives. Routing it through VDP would add a hop
// for no real security gain.
//
// **This never fakes a connection.** Per `vaco-media/lib/transport/
// loopback.js`'s own rule ("do not add a `<video>` tag pointing at a
// placeholder file to make a demo look complete"): `connectCall`
// returns `null` whenever `joinInfo.mediaPlane !== 'livekit'` -- which
// is the real, current, honest state of this whole ecosystem, since
// nothing in `deploy/` runs an SFU yet. The caller is expected to show
// `joinInfo.note` instead, which already says exactly that in plain
// language.

// Deliberately uncovered by node:test, per this project's own stated
// convention for `*Client.js`-shaped network wrappers (`library.js`'s
// header, and `v4AgentClient.js`'s own test file only covering its
// pure JSON parsing): there is no pure logic to split out of
// `resolveJoin`/`connectCall`/`disconnectCall` themselves, and
// `connectCall`'s real branch needs a real browser's WebRTC stack,
// not a Node process. Verified live instead -- see
// `VDP_FOUNDING.md`'s real-time-media section for the actual
// session/join/connect trace this was run against.
import { Room, RoomEvent, Track } from 'livekit-client';

const VACO_MEDIA_URL = import.meta.env?.VITE_VACO_MEDIA_URL || 'http://localhost:8821';

// Turns the opaque join credential VDP's own WebSocket handed this
// client into the real transport details -- a LiveKit URL + token, or
// the loopback adapter's own honest "nothing will connect" note.
export async function resolveJoin({ credential, sessionId }) {
  const res = await fetch(`${VACO_MEDIA_URL}/api/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential, sessionId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `join failed (${res.status})`);
  return body;
}

// Connects for real only when a real SFU is actually configured.
// Returns the connected `Room` (local camera/mic already published)
// so the caller can attach its tracks and everyone else's -- or
// `null`, honestly, when there is nothing to connect to.
export async function connectCall(joinInfo, { onRemoteTrack, onParticipantDisconnected } = {}) {
  if (joinInfo.mediaPlane !== 'livekit') return null;

  const room = new Room();
  room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
    if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio) {
      onRemoteTrack?.(track, participant);
    }
  });
  room.on(RoomEvent.ParticipantDisconnected, (participant) => {
    onParticipantDisconnected?.(participant);
  });

  await room.connect(joinInfo.url, joinInfo.token);
  await room.localParticipant.setCameraEnabled(true);
  await room.localParticipant.setMicrophoneEnabled(true);
  return room;
}

export function disconnectCall(room) {
  if (room) room.disconnect();
}
