import { useState, useCallback, useEffect } from "react";
import {
  getCatalog, acquireTitle, markStreaming, subscribe, watchTitle, startStream, endStream,
} from "../lib/vultureFlixClient.js";

// VDP's real Vvltvre Flix district -- a live client of Vvltvre Flix's
// own real title/subscription/stream-session engine. No title logic
// here, every real acquisition payout, subscription fee, and
// concurrent-stream-limit check comes back from Vvltvre Flix's own
// server.

export default function VultureFlixView({ session }) {
  const [catalog, setCatalog] = useState(null);
  const [title, setTitle] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [stream, setStream] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    getCatalog().then(setCatalog).catch((err) => setError(err.message));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleAcquire = async () => {
    setBusy(true);
    setError(null);
    try {
      const record = await acquireTitle({ creatorId: `studio-${session.userId}`, title: "VDP Originals: Season One", type: "series" });
      const streaming = await markStreaming(record.id);
      setTitle(streaming);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSubscribe = async () => {
    setBusy(true);
    setError(null);
    try {
      const sub = await subscribe({ userId: session.userId, tier: "standard" });
      setSubscription(sub);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleWatch = async () => {
    setBusy(true);
    setError(null);
    try {
      await watchTitle({ userId: session.userId, titleId: title.id });
      const session_ = await startStream({ userId: session.userId, titleId: title.id });
      setStream(session_);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleEndStream = async () => {
    setBusy(true);
    setError(null);
    try {
      const ended = await endStream(stream.id);
      setStream(ended);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px 0" }}>Vvltvre Flix — real streaming</h2>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
        A real acquisition payout, a real subscription tier, and a real concurrent-stream-limit check.
      </p>

      {catalog && (
        <p style={{ fontSize: 12, color: "#666", margin: "0 0 8px" }}>
          Real catalog: {catalog.length} title(s) currently streaming.
        </p>
      )}

      {!title && (
        <button onClick={handleAcquire} disabled={busy}>Acquire a title (40 VCoin exclusive acquisition)</button>
      )}

      {title && (
        <div style={{ borderTop: "1px dashed #ccc", paddingTop: 8 }}>
          <p style={{ fontSize: 13, margin: "0 0 4px" }}>&ldquo;{title.title}&rdquo; — {title.status}</p>
          {!subscription && <button onClick={handleSubscribe} disabled={busy}>Subscribe (standard tier, 15.49 VCoin)</button>}
          {subscription && !stream && <button onClick={handleWatch} disabled={busy}>Watch (starts a real stream session)</button>}
          {stream && stream.status === "active" && (
            <>
              <p style={{ fontSize: 12, color: "#1a7d3c", margin: "0 0 8px" }}>Streaming — session #{stream.id}.</p>
              <button onClick={handleEndStream} disabled={busy}>End stream</button>
            </>
          )}
          {stream && stream.status === "ended" && (
            <p style={{ fontSize: 12, color: "#888" }}>Stream ended.</p>
          )}
        </div>
      )}

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </div>
  );
}
