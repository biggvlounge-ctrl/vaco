import { useState, useEffect, useRef, useCallback } from "react";
import {
  ensureVillageDistrict, ensureMembership, createInteriorState, moveInteriorPlayer,
  getNearbyRoom, getInteriorCameraOffset, ROOMS_LAYOUT,
  INTERIOR_VIEWPORT_WIDTH, INTERIOR_VIEWPORT_HEIGHT, INTERIOR_MOVE_STEP,
} from "../lib/villageDistrict.js";
import {
  joinRoom, leaveRoom, getMessages, postMessage, boostVillage, getBoostStatus,
  getAvatarCosmeticCatalog, purchaseAvatarCosmetic, equipAvatarCosmetic, unequipAvatarCosmetic, getAvatarProfile,
} from "../lib/vxllageClient.js";

// VXLLAGE's real Village District, inhabited inside VDP -- a real,
// small interior map (see `villageDistrict.js`'s own header for why
// this reuses `WorldView.jsx`'s real movement/camera shape rather than
// a single static room list). Two real rooms: "Main Stage"
// (clubhouse-audio -- real join/leave participant tracking) and "The
// Lounge" (discord-hangout -- this district's own real text channel).

const ROOM_COLORS = { "clubhouse-audio": "#a54a8f", "discord-hangout": "#4a6fa5" };

export default function VillageDistrictView({ session }) {
  const [district, setDistrict] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [interiorState, setInteriorState] = useState(() => createInteriorState());
  const [enteredRoom, setEnteredRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [boostStatus, setBoostStatus] = useState(null);
  const [boostAmount, setBoostAmount] = useState("25");
  const [catalog, setCatalog] = useState([]);
  const [avatarProfile, setAvatarProfile] = useState(null);
  const [cosmeticBusyId, setCosmeticBusyId] = useState(null);
  const canvasRef = useRef(null);
  const interiorStateRef = useRef(interiorState);

  useEffect(() => {
    interiorStateRef.current = interiorState;
  }, [interiorState]);

  useEffect(() => {
    let cancelled = false;
    ensureVillageDistrict()
      .then(async (d) => {
        if (cancelled) return;
        await ensureMembership(d.village.id, session.userId);
        if (!cancelled) setDistrict(d);
      })
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, [session.userId]);

  const refreshShop = useCallback(async (villageId) => {
    try {
      const [boost, avatarCatalog, profile] = await Promise.all([
        getBoostStatus(villageId),
        getAvatarCosmeticCatalog(),
        getAvatarProfile(session.userId),
      ]);
      setBoostStatus(boost);
      setCatalog(avatarCatalog);
      setAvatarProfile(profile);
    } catch (err) {
      setActionError(err.message);
    }
  }, [session.userId]);

  useEffect(() => {
    if (district) refreshShop(district.village.id);
  }, [district, refreshShop]);

  const handleBoost = async () => {
    const amountVCoin = Number(boostAmount);
    if (!Number.isFinite(amountVCoin) || amountVCoin <= 0) return;
    setBusy(true);
    setActionError(null);
    try {
      await boostVillage(district.village.id, session.userId, amountVCoin);
      await refreshShop(district.village.id);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handlePurchaseCosmetic = async (itemId) => {
    setCosmeticBusyId(itemId);
    setActionError(null);
    try {
      await purchaseAvatarCosmetic(session.userId, itemId);
      await refreshShop(district.village.id);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setCosmeticBusyId(null);
    }
  };

  const handleEquipCosmetic = async (itemId) => {
    setCosmeticBusyId(itemId);
    setActionError(null);
    try {
      await equipAvatarCosmetic(session.userId, itemId);
      await refreshShop(district.village.id);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setCosmeticBusyId(null);
    }
  };

  const handleUnequipCosmetic = async () => {
    setCosmeticBusyId("unequip");
    setActionError(null);
    try {
      await unequipAvatarCosmetic(session.userId);
      await refreshShop(district.village.id);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setCosmeticBusyId(null);
    }
  };

  const handleKeyDown = useCallback((e) => {
    let dx = 0;
    let dy = 0;
    if (e.key === "ArrowUp" || e.key === "w") dy = -INTERIOR_MOVE_STEP;
    else if (e.key === "ArrowDown" || e.key === "s") dy = INTERIOR_MOVE_STEP;
    else if (e.key === "ArrowLeft" || e.key === "a") dx = -INTERIOR_MOVE_STEP;
    else if (e.key === "ArrowRight" || e.key === "d") dx = INTERIOR_MOVE_STEP;
    else return;
    e.preventDefault();
    const next = { ...interiorStateRef.current };
    moveInteriorPlayer(next, dx, dy);
    setInteriorState(next);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !district) return;
    const ctx = canvas.getContext("2d");
    const camera = getInteriorCameraOffset(interiorState);

    ctx.fillStyle = "#12121e";
    ctx.fillRect(0, 0, INTERIOR_VIEWPORT_WIDTH, INTERIOR_VIEWPORT_HEIGHT);

    for (const room of ROOMS_LAYOUT) {
      const sx = room.x - camera.x;
      const sy = room.y - camera.y;
      ctx.fillStyle = ROOM_COLORS[room.key] || "#555";
      ctx.fillRect(sx, sy, room.width, room.height);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, room.width, room.height);
      ctx.fillStyle = "#fff";
      ctx.font = "12px sans-serif";
      ctx.fillText(room.name, sx + 6, sy + 16);
    }

    const px = interiorState.x - camera.x;
    const py = interiorState.y - camera.y;
    ctx.fillStyle = "#ffd700";
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fill();
  }, [interiorState, district]);

  const nearbyLayout = getNearbyRoom(interiorState);
  const nearbyRoom = district && nearbyLayout ? district.rooms.find((r) => r.roomType === nearbyLayout.key) : null;

  const refreshRoomMessages = useCallback(() => {
    if (district) getMessages(district.generalChannel.id).then(setMessages).catch((err) => setActionError(err.message));
  }, [district]);

  const handleEnter = () => {
    if (!nearbyRoom) return;
    setEnteredRoom(nearbyRoom);
    if (nearbyRoom.roomType === "discord-hangout") refreshRoomMessages();
  };

  const handleJoinRoom = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const updated = await joinRoom(enteredRoom.id, session.userId);
      setEnteredRoom(updated);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleLeaveRoom = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const updated = await leaveRoom(enteredRoom.id, session.userId);
      setEnteredRoom(updated);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatText.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      await postMessage(district.generalChannel.id, session.userId, chatText.trim());
      setChatText("");
      refreshRoomMessages();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <p style={{ color: "crimson" }}>Error loading the Village District: {loadError}</p>;
  if (!district) return <p style={{ fontSize: 12, color: "#888" }}>Loading the Village District…</p>;

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>{district.village.name}</h2>
      <p style={{ fontSize: 12, color: "#666" }}>
        A real, inhabitable space with two rooms, live from VXLLAGE. Click the map, then use arrow keys or WASD.
      </p>
      <canvas
        ref={canvasRef}
        width={INTERIOR_VIEWPORT_WIDTH}
        height={INTERIOR_VIEWPORT_HEIGHT}
        tabIndex={0}
        style={{ border: "1px solid #444", outline: "none" }}
      />
      {nearbyRoom && (
        <div style={{ marginTop: 8 }}>
          <button onClick={handleEnter}>Enter {nearbyLayout.name}</button>
        </div>
      )}

      {enteredRoom && enteredRoom.roomType === "clubhouse-audio" && (
        <div style={{ marginTop: 12, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
          <p style={{ fontSize: 13, fontWeight: "bold" }}>Main Stage — live audio room</p>
          <p style={{ fontSize: 12, color: "#666" }}>
            In the room: {enteredRoom.activeParticipants.length === 0 ? "no one yet" : enteredRoom.activeParticipants.join(", ")}
          </p>
          {enteredRoom.activeParticipants.includes(session.userId) ? (
            <button onClick={handleLeaveRoom} disabled={busy}>Leave room</button>
          ) : (
            <button onClick={handleJoinRoom} disabled={busy}>Join room</button>
          )}
        </div>
      )}

      {enteredRoom && enteredRoom.roomType === "discord-hangout" && (
        <div style={{ marginTop: 12, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
          <p style={{ fontSize: 13, fontWeight: "bold" }}>The Lounge — #general</p>
          {messages.length === 0 && <p style={{ fontSize: 12, color: "#888" }}>No messages yet.</p>}
          {messages.map((m, i) => (
            <p key={i} style={{ fontSize: 12, margin: "2px 0" }}><strong>{m.authorId}:</strong> {m.text}</p>
          ))}
          <div style={{ marginTop: 6, display: "flex", gap: 4 }}>
            <input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Say something…" style={{ flex: 1 }} />
            <button onClick={handleSendChat} disabled={busy || !chatText.trim()}>Send</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
        <p style={{ fontSize: 13, fontWeight: "bold" }}>Community Boosting</p>
        {boostStatus && (
          <p style={{ fontSize: 12, color: "#666" }}>
            Level {boostStatus.boostLevel} — {boostStatus.totalBoostVCoin} VCoin contributed so far
            {boostStatus.nextLevelAt != null
              ? ` (${boostStatus.vCoinToNextLevel} more to level ${boostStatus.boostLevel + 1})`
              : " (top level reached)"}
          </p>
        )}
        <div style={{ display: "flex", gap: 4 }}>
          <input
            type="number" min="1" value={boostAmount} onChange={(e) => setBoostAmount(e.target.value)}
            style={{ width: 80 }}
          />
          <button onClick={handleBoost} disabled={busy}>Boost (VCoin)</button>
        </div>
      </div>

      <div style={{ marginTop: 12, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
        <p style={{ fontSize: 13, fontWeight: "bold" }}>Avatar Cosmetics</p>
        {avatarProfile && (
          <p style={{ fontSize: 12, color: "#666" }}>
            Equipped: {avatarProfile.equippedItemId
              ? catalog.find((c) => c.id === avatarProfile.equippedItemId)?.name || avatarProfile.equippedItemId
              : "none"}
            {avatarProfile.equippedItemId && (
              <button onClick={handleUnequipCosmetic} disabled={cosmeticBusyId === "unequip"} style={{ marginLeft: 8, fontSize: 11 }}>
                Unequip
              </button>
            )}
          </p>
        )}
        {catalog.map((item) => {
          const owned = avatarProfile?.ownedCosmetics?.some((o) => o.id === item.id);
          const equipped = avatarProfile?.equippedItemId === item.id;
          return (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0", fontSize: 12 }}>
              <span>{item.name} ({item.priceVCoin} VCoin){owned && !equipped ? " — owned" : ""}{equipped ? " — equipped" : ""}</span>
              {!owned && (
                <button onClick={() => handlePurchaseCosmetic(item.id)} disabled={cosmeticBusyId === item.id} style={{ fontSize: 11 }}>
                  Buy
                </button>
              )}
              {owned && !equipped && (
                <button onClick={() => handleEquipCosmetic(item.id)} disabled={cosmeticBusyId === item.id} style={{ fontSize: 11 }}>
                  Equip
                </button>
              )}
            </div>
          );
        })}
      </div>

      {actionError && <p style={{ color: "crimson" }}>Error: {actionError}</p>}
    </div>
  );
}
