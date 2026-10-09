import { useState, useEffect, useRef } from "react";
import { resolveJoin, connectCall, disconnectCall } from "../lib/mediaRuntime.js";

// A real voice/video call panel -- not a placeholder. Given a real
// join credential (from `server.cjs`'s own `call-invite` WebSocket
// message, which opened a real vaco-media session), this resolves it
// to real transport details and either actually connects (when
// `VACO_MEDIA_TRANSPORT=livekit` names a real SFU) or shows exactly
// why it didn't, in vaco-media's own words. See `mediaRuntime.js`'s
// header for why faking the connected state is the one thing this
// must never do.
export default function CallPanel({ callInfo, otherUserId, onEnd }) {
  const [joinInfo, setJoinInfo] = useState(null);
  const [error, setError] = useState(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const roomRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    resolveJoin({ credential: callInfo.credential, sessionId: callInfo.sessionId })
      .then(async (info) => {
        if (cancelled) return;
        setJoinInfo(info);
        const room = await connectCall(info, {
          onRemoteTrack: (track) => {
            if (remoteVideoRef.current) track.attach(remoteVideoRef.current);
          },
          onParticipantDisconnected: () => onEnd(),
        });
        if (cancelled) {
          disconnectCall(room);
          return;
        }
        roomRef.current = room;
        if (room && localVideoRef.current) {
          const camPub = room.localParticipant.getTrackPublication?.('camera');
          camPub?.track?.attach(localVideoRef.current);
        }
      })
      .catch((err) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
      disconnectCall(roomRef.current);
      roomRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callInfo.credential, callInfo.sessionId]);

  const handleEnd = () => {
    disconnectCall(roomRef.current);
    onEnd();
  };

  return (
    <div style={{
      position: "fixed", bottom: 16, right: 16, width: 280, background: "#111", color: "#fff",
      borderRadius: 8, padding: 12, zIndex: 1000, boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
    }}>
      <p style={{ fontSize: 12, margin: "0 0 8px" }}>Call with {otherUserId}</p>
      {error && <p style={{ fontSize: 11, color: "#ff8080" }}>{error}</p>}
      {!joinInfo && !error && <p style={{ fontSize: 11, color: "#aaa" }}>Connecting…</p>}
      {joinInfo && joinInfo.mediaPlane === 'livekit' && (
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "70%", background: "#000", borderRadius: 4 }} />
          <video ref={localVideoRef} autoPlay playsInline muted style={{ width: "30%", background: "#000", borderRadius: 4 }} />
        </div>
      )}
      {joinInfo && joinInfo.mediaPlane !== 'livekit' && (
        <p style={{ fontSize: 11, color: "#ccc", fontStyle: "italic" }}>{joinInfo.note}</p>
      )}
      <button onClick={handleEnd} style={{ fontSize: 11 }}>Hang up</button>
    </div>
  );
}
