import { useState, useEffect, useCallback } from "react";
import { ensureStageSession, operatorIdForChannel } from "../lib/stage.js";
import { getMessages, postMessage, tipChannel } from "../lib/vavltStvdiosClient.js";

// Real "up to 8 interactive screens" grid, sourced live from Vavlt
// Stvdios' own separate API (see `stage.js`'s own header). Each screen
// is a real, independent channel -- clicking one focuses it below the
// grid with its own real chat (fetched/posted through Vavlt Stvdios'
// own chat endpoints) and its own real tip form, paying that screen's
// specific operator directly, never a shared Stage account, per
// `channelTips.js`'s own `recipientPersonId` design. No real video --
// each tile is a real, named, live-or-offline channel record with no
// actual media pipeline behind `streamUrl`, same honest posture as
// Vavlt Stvdios' own README.

export default function StageView({ session, onPurchase }) {
  const [stageSession, setStageSession] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [focusedChannelId, setFocusedChannelId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState("");
  const [tipAmount, setTipAmount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    ensureStageSession()
      .then((s) => {
        if (cancelled) return;
        setStageSession(s);
        if (s.screens.length > 0) setFocusedChannelId(s.screens[0].id);
      })
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshMessages = useCallback((channelId) => {
    if (!channelId) return;
    getMessages(channelId).then(setMessages).catch((err) => setActionError(err.message));
  }, []);

  useEffect(() => {
    refreshMessages(focusedChannelId);
  }, [focusedChannelId, refreshMessages]);

  const focusedChannel = stageSession?.screens.find((c) => c.id === focusedChannelId) || null;

  const handleSendChat = async () => {
    if (!chatText.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      await postMessage(focusedChannelId, { userId: session.userId, text: chatText.trim() });
      setChatText("");
      refreshMessages(focusedChannelId);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleTip = async () => {
    const recipientPersonId = operatorIdForChannel(focusedChannel);
    setBusy(true);
    setActionError(null);
    try {
      await tipChannel(focusedChannelId, {
        tipperId: session.userId, recipientPersonId, amountVCoin: Number(tipAmount),
      });
      await onPurchase();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <p style={{ color: "crimson" }}>Error loading Stage: {loadError}</p>;
  if (!stageSession) return <p style={{ fontSize: 12, color: "#888" }}>Loading Stage's live screens…</p>;

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>VENVS Stage — Event Plaza</h2>
      <p style={{ fontSize: 12, color: "#666" }}>
        Up to 8 real, independently interactive screens, live from Vavlt Stvdios. Click a screen to focus it.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 8 }}>
        {stageSession.screens.map((channel) => (
          <div
            key={channel.id}
            onClick={() => setFocusedChannelId(channel.id)}
            style={{
              cursor: "pointer",
              border: channel.id === focusedChannelId ? "2px solid #ffd700" : "1px solid #444",
              borderRadius: 4,
              padding: 6,
              background: "#1a1a2e",
              color: "#fff",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: "bold" }}>{channel.name}</div>
            <div style={{ fontSize: 10, color: channel.isLive ? "#5f5" : "#999" }}>
              {channel.isLive ? "● LIVE" : "offline"}
            </div>
          </div>
        ))}
      </div>

      {focusedChannel && (
        <div style={{ marginTop: 12, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
          <p style={{ fontSize: 13, fontWeight: "bold", margin: 0 }}>
            {focusedChannel.name} {focusedChannel.isLive ? "(live)" : "(offline)"}
          </p>

          <div style={{ marginTop: 6 }}>
            {messages.length === 0 && <p style={{ fontSize: 12, color: "#888" }}>No chat messages yet.</p>}
            {messages.map((m, i) => (
              <p key={i} style={{ fontSize: 12, margin: "2px 0" }}>
                <strong>{m.userId}:</strong> {m.text}
              </p>
            ))}
          </div>
          <div style={{ marginTop: 6, display: "flex", gap: 4 }}>
            <input
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Say something…"
              style={{ flex: 1 }}
            />
            <button onClick={handleSendChat} disabled={busy || !chatText.trim()}>Send</button>
          </div>

          <div style={{ marginTop: 8, display: "flex", gap: 4, alignItems: "center" }}>
            <input
              type="number"
              min={1}
              value={tipAmount}
              onChange={(e) => setTipAmount(e.target.value)}
              style={{ width: 60 }}
            />
            <button onClick={handleTip} disabled={busy}>Tip this screen's operator</button>
          </div>
        </div>
      )}

      {actionError && <p style={{ color: "crimson" }}>Error: {actionError}</p>}
    </div>
  );
}
