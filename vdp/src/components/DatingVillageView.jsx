import { useState, useEffect, useCallback } from "react";
import {
  enterDatingVillage, leaveDatingVillage, getDatingVillageFeed, sendDatingVillageFlashNote,
  LOCATION_PRIVACY_TIERS, setSnapMapPrivacy, shareSnapMapLocation, getSnapMapVisibleUsers,
  scheduleDatingVillageSpeedDate, extendDatingVillageSpeedDate, getDatingVillageSpeedDateRotation,
  setDatingVillageGiftThreshold, getDatingVillageGiftThreshold, requestDatingVillageDateWithGift, getDatingVillageGiftRequests,
  purchaseDatingVillageBlindDateToken, assignDatingVillageBlindDate, revealDatingVillageBlindDatePhotos,
  cancelDatingVillageBlindDate, isDatingVillageUserBlockedFromBlindDating,
  createDatingVillageDateEvent, rsvpToDatingVillageDateEvent, linkDatingVillageHuntToDateEvent,
} from "../lib/datingVillage.js";

// CVNVO's real Dating Village, inhabited inside VDP -- a real BarBuddy
// venue check-in the moment a player walks in, real proximity
// crossings recorded with every other real, currently-visible player
// here, and a real FlashNote form to break the ice before any match
// exists. See `datingVillage.js`'s own header for why this district is
// one real venue rather than a second interior map.

export default function DatingVillageView({ session }) {
  const [visibleUsers, setVisibleUsers] = useState(null);
  const [feed, setFeed] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [flashTarget, setFlashTarget] = useState(null);
  const [flashText, setFlashText] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const [snapMapTier, setSnapMapTier] = useState("ghost-mode");
  const [snapMapShared, setSnapMapShared] = useState(false);
  const [snapMapVisible, setSnapMapVisible] = useState([]);
  const [snapMapError, setSnapMapError] = useState(null);
  const [snapMapBusy, setSnapMapBusy] = useState(false);

  const [speedDatePicked, setSpeedDatePicked] = useState([]);
  const [speedDateFormat, setSpeedDateFormat] = useState("all-facetime");
  const [speedDateSlot, setSpeedDateSlot] = useState(null);
  const [speedDateRotation, setSpeedDateRotation] = useState(null);
  const [speedDateError, setSpeedDateError] = useState(null);
  const [speedDateBusy, setSpeedDateBusy] = useState(false);

  const [giftThreshold, setGiftThresholdState] = useState(null);
  const [giftThresholdInput, setGiftThresholdInput] = useState("0");
  const [giftTarget, setGiftTarget] = useState(null);
  const [giftAmountInput, setGiftAmountInput] = useState("");
  const [giftRequests, setGiftRequests] = useState([]);
  const [giftError, setGiftError] = useState(null);
  const [giftBusy, setGiftBusy] = useState(false);

  const [blindDateToken, setBlindDateToken] = useState(null);
  const [blindDateCandidates, setBlindDateCandidates] = useState([]);
  const [blindDateSession, setBlindDateSession] = useState(null);
  const [blindDateBlocked, setBlindDateBlocked] = useState(false);
  const [blindDateError, setBlindDateError] = useState(null);
  const [blindDateBusy, setBlindDateBusy] = useState(false);

  const [huntDatePicked, setHuntDatePicked] = useState([]);
  const [huntDateEvent, setHuntDateEvent] = useState(null);
  const [huntIdInput, setHuntIdInput] = useState("");
  const [huntDateVisible, setHuntDateVisible] = useState(true);
  const [huntDateError, setHuntDateError] = useState(null);
  const [huntDateBusy, setHuntDateBusy] = useState(false);

  const refreshSnapMap = useCallback(() => {
    getSnapMapVisibleUsers(session.userId).then(setSnapMapVisible).catch((err) => setSnapMapError(err.message));
  }, [session.userId]);

  useEffect(() => {
    refreshSnapMap();
  }, [refreshSnapMap]);

  const handleSetSnapMapTier = async (tier) => {
    setSnapMapBusy(true);
    setSnapMapError(null);
    try {
      await setSnapMapPrivacy(session.userId, tier);
      setSnapMapTier(tier);
      refreshSnapMap();
    } catch (err) {
      setSnapMapError(err.message);
    } finally {
      setSnapMapBusy(false);
    }
  };

  const handleShareSnapMapLocation = async () => {
    setSnapMapBusy(true);
    setSnapMapError(null);
    try {
      await shareSnapMapLocation(session.userId);
      setSnapMapShared(true);
      refreshSnapMap();
    } catch (err) {
      setSnapMapError(err.message);
    } finally {
      setSnapMapBusy(false);
    }
  };

  const refreshFeed = useCallback(() => {
    getDatingVillageFeed(session.userId).then(setFeed).catch((err) => setActionError(err.message));
  }, [session.userId]);

  const refreshGiftRequests = useCallback(() => {
    getDatingVillageGiftRequests(session.userId).then(setGiftRequests).catch((err) => setGiftError(err.message));
  }, [session.userId]);

  useEffect(() => {
    getDatingVillageGiftThreshold(session.userId)
      .then((t) => { setGiftThresholdState(t); setGiftThresholdInput(String(t.minGiftValueVCoin)); })
      .catch((err) => setGiftError(err.message));
    refreshGiftRequests();
  }, [session.userId, refreshGiftRequests]);

  useEffect(() => {
    isDatingVillageUserBlockedFromBlindDating(session.userId).then(setBlindDateBlocked).catch((err) => setBlindDateError(err.message));
  }, [session.userId]);

  useEffect(() => {
    let cancelled = false;
    enterDatingVillage(session.userId)
      .then((result) => {
        if (cancelled) return;
        setVisibleUsers(result.visibleUsers);
        refreshFeed();
      })
      .catch((err) => !cancelled && setLoadError(err.message));

    return () => {
      cancelled = true;
      leaveDatingVillage(session.userId).catch(() => { /* real, best-effort cleanup on unmount */ });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.userId]);

  const togglePicked = (userId) => {
    setSpeedDatePicked((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  // CVNVO's own real shared SpeedDateSlot entity: 2 total participants
  // is Speed Dating, 3+ is Group Dating's 2v1/3v1 rotation format --
  // same slot, same call, more picked users.
  const handleScheduleSpeedDate = async () => {
    if (speedDatePicked.length === 0) return;
    setSpeedDateBusy(true);
    setSpeedDateError(null);
    setSpeedDateRotation(null);
    try {
      const slot = await scheduleDatingVillageSpeedDate(speedDateFormat, [session.userId, ...speedDatePicked]);
      setSpeedDateSlot(slot);
      setSpeedDatePicked([]);
    } catch (err) {
      setSpeedDateError(err.message);
    } finally {
      setSpeedDateBusy(false);
    }
  };

  const handleExtendSpeedDate = async () => {
    if (!speedDateSlot) return;
    setSpeedDateBusy(true);
    setSpeedDateError(null);
    try {
      const slot = await extendDatingVillageSpeedDate(speedDateSlot.id, 60);
      setSpeedDateSlot((prev) => ({ ...prev, ...slot }));
    } catch (err) {
      setSpeedDateError(err.message);
    } finally {
      setSpeedDateBusy(false);
    }
  };

  const handleShowRotation = async () => {
    if (!speedDateSlot) return;
    setSpeedDateBusy(true);
    setSpeedDateError(null);
    try {
      setSpeedDateRotation(await getDatingVillageSpeedDateRotation(speedDateSlot.id));
    } catch (err) {
      setSpeedDateError(err.message);
    } finally {
      setSpeedDateBusy(false);
    }
  };

  const handleSetGiftThreshold = async () => {
    const minGiftValueVCoin = Number(giftThresholdInput);
    if (!Number.isFinite(minGiftValueVCoin) || minGiftValueVCoin < 0) return;
    setGiftBusy(true);
    setGiftError(null);
    try {
      setGiftThresholdState(await setDatingVillageGiftThreshold(session.userId, minGiftValueVCoin));
    } catch (err) {
      setGiftError(err.message);
    } finally {
      setGiftBusy(false);
    }
  };

  const handleRequestDateWithGift = async () => {
    const giftValueVCoin = Number(giftAmountInput);
    if (!giftTarget || !Number.isFinite(giftValueVCoin) || giftValueVCoin <= 0) return;
    setGiftBusy(true);
    setGiftError(null);
    try {
      await requestDatingVillageDateWithGift(session.userId, giftTarget, giftValueVCoin);
      setGiftTarget(null);
      setGiftAmountInput("");
    } catch (err) {
      setGiftError(err.message);
    } finally {
      setGiftBusy(false);
    }
  };

  const toggleBlindDateCandidate = (userId) => {
    setBlindDateCandidates((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const handlePurchaseBlindDateToken = async () => {
    setBlindDateBusy(true);
    setBlindDateError(null);
    try {
      setBlindDateToken(await purchaseDatingVillageBlindDateToken(session.userId));
    } catch (err) {
      setBlindDateError(err.message);
    } finally {
      setBlindDateBusy(false);
    }
  };

  // Real, deliberate choice: the candidate pool is who's really here
  // right now, not a separate global matchmaking pool.
  const handleAssignBlindDate = async () => {
    if (blindDateCandidates.length === 0) return;
    setBlindDateBusy(true);
    setBlindDateError(null);
    try {
      setBlindDateSession(await assignDatingVillageBlindDate(session.userId, blindDateCandidates));
    } catch (err) {
      setBlindDateError(err.message);
    } finally {
      setBlindDateBusy(false);
    }
  };

  const handleRevealBlindDatePhotos = async () => {
    if (!blindDateSession) return;
    setBlindDateBusy(true);
    setBlindDateError(null);
    try {
      setBlindDateSession(await revealDatingVillageBlindDatePhotos(blindDateSession.id));
    } catch (err) {
      setBlindDateError(err.message);
    } finally {
      setBlindDateBusy(false);
    }
  };

  const handleCancelBlindDate = async () => {
    if (!blindDateSession) return;
    setBlindDateBusy(true);
    setBlindDateError(null);
    try {
      setBlindDateSession(await cancelDatingVillageBlindDate(blindDateSession.id));
      setBlindDateBlocked(await isDatingVillageUserBlockedFromBlindDating(session.userId));
    } catch (err) {
      setBlindDateError(err.message);
    } finally {
      setBlindDateBusy(false);
    }
  };

  const toggleHuntDatePicked = (userId) => {
    setHuntDatePicked((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  // Real, deliberate choice, same posture as every other format above:
  // invited participants are who's really here right now.
  const handleCreateDateEvent = async () => {
    if (huntDatePicked.length === 0) return;
    setHuntDateBusy(true);
    setHuntDateError(null);
    try {
      const event = await createDatingVillageDateEvent([session.userId, ...huntDatePicked]);
      setHuntDateEvent(event);
      setHuntDatePicked([]);
    } catch (err) {
      setHuntDateError(err.message);
    } finally {
      setHuntDateBusy(false);
    }
  };

  const handleRsvpToDateEvent = async () => {
    if (!huntDateEvent) return;
    setHuntDateBusy(true);
    setHuntDateError(null);
    try {
      await rsvpToDatingVillageDateEvent(huntDateEvent.id, session.userId, huntDateVisible);
      setHuntDateEvent((prev) => ({ ...prev, visibleAttendeeCount: (prev.visibleAttendeeCount || 0) + (huntDateVisible ? 1 : 0) }));
    } catch (err) {
      setHuntDateError(err.message);
    } finally {
      setHuntDateBusy(false);
    }
  };

  // Real, live cross-app validation: CVNVO itself looks the hunt up
  // against HVNTZ's own GET /api/hunt/:huntId before linking it, not a
  // caller-declared id.
  const handleLinkHunt = async () => {
    if (!huntDateEvent || !huntIdInput) return;
    setHuntDateBusy(true);
    setHuntDateError(null);
    try {
      setHuntDateEvent(await linkDatingVillageHuntToDateEvent(huntDateEvent.id, Number(huntIdInput)));
    } catch (err) {
      setHuntDateError(err.message);
    } finally {
      setHuntDateBusy(false);
    }
  };

  const handleSendFlashNote = async () => {
    if (!flashTarget || !flashText.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      await sendDatingVillageFlashNote(session.userId, flashTarget, flashText.trim());
      setFlashText("");
      setFlashTarget(null);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <p style={{ color: "crimson" }}>Error loading the Dating Village: {loadError}</p>;
  if (visibleUsers === null) return <p style={{ fontSize: 12, color: "#888" }}>Checking in at the Dating Village…</p>;

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>CVNVO Dating Village</h2>
      <p style={{ fontSize: 12, color: "#666" }}>
        A real BarBuddy venue, live from CVNVO. Everyone here right now is a real, visible check-in.
      </p>

      <div style={{ marginTop: 8 }}>
        <p style={{ fontSize: 13, fontWeight: "bold", margin: "0 0 4px" }}>Here right now</p>
        {visibleUsers.length === 0 && <p style={{ fontSize: 12, color: "#888" }}>No one else checked in yet.</p>}
        {visibleUsers.map((userId) => (
          <div key={userId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" }}>
            <span>{userId}</span>
            <button onClick={() => setFlashTarget(userId)}>Send a FlashNote</button>
          </div>
        ))}
      </div>

      {flashTarget && (
        <div style={{ marginTop: 12, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
          <p style={{ fontSize: 13 }}>FlashNote to <strong>{flashTarget}</strong> (no match required yet):</p>
          <div style={{ display: "flex", gap: 4 }}>
            <input value={flashText} onChange={(e) => setFlashText(e.target.value)} placeholder="Say hi…" style={{ flex: 1 }} />
            <button onClick={handleSendFlashNote} disabled={busy || !flashText.trim()}>Send</button>
            <button onClick={() => setFlashTarget(null)} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
        <p style={{ fontSize: 13, fontWeight: "bold", margin: "0 0 4px" }}>Your real crossing feed</p>
        {feed.length === 0 && <p style={{ fontSize: 12, color: "#888" }}>No crossings recorded yet.</p>}
        {feed.map((event) => (
          <p key={event.id} style={{ fontSize: 12, margin: "2px 0" }}>
            Crossed paths with <strong>{event.userId === session.userId ? event.otherUserId : event.userId}</strong>
            {" "}({event.distanceKm}km apart)
          </p>
        ))}
      </div>

      <div style={{ marginTop: 12, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
        <p style={{ fontSize: 13, fontWeight: "bold", margin: "0 0 4px" }}>Snap Map</p>
        <p style={{ fontSize: 11, color: "#888", margin: "0 0 6px" }}>
          Who can see where you are: Ghost Mode (no one), My Friends (an active match only), or Select Friends
          (only who you choose).
        </p>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {LOCATION_PRIVACY_TIERS.map((tier) => (
            <button
              key={tier}
              onClick={() => handleSetSnapMapTier(tier)}
              disabled={snapMapBusy}
              style={{ fontWeight: tier === snapMapTier ? "bold" : "normal" }}
            >
              {tier}
            </button>
          ))}
          <button onClick={handleShareSnapMapLocation} disabled={snapMapBusy}>
            {snapMapShared ? "Update my location" : "Share my location"}
          </button>
        </div>

        <p style={{ fontSize: 12, margin: "8px 0 2px" }}>
          Visible to you right now ({snapMapVisible.length}):
        </p>
        {snapMapVisible.length === 0 && <p style={{ fontSize: 12, color: "#888" }}>No one visible to you yet.</p>}
        {snapMapVisible.map((loc) => (
          <p key={loc.userId} style={{ fontSize: 12, margin: "2px 0" }}>{loc.userId}</p>
        ))}
        {snapMapError && <p style={{ color: "crimson" }}>Error: {snapMapError}</p>}
      </div>

      <div style={{ marginTop: 12, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
        <p style={{ fontSize: 13, fontWeight: "bold", margin: "0 0 4px" }}>Speed Dating / Group Dating</p>
        <p style={{ fontSize: 11, color: "#888", margin: "0 0 6px" }}>
          Pick 1 other person here for Speed Dating, or 2+ for a real rotating Group Dating slot.
        </p>
        {visibleUsers.length === 0 && <p style={{ fontSize: 12, color: "#888" }}>No one else here to schedule with yet.</p>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {visibleUsers.map((userId) => (
            <label key={userId} style={{ fontSize: 12 }}>
              <input
                type="checkbox"
                checked={speedDatePicked.includes(userId)}
                onChange={() => togglePicked(userId)}
              />
              {" "}{userId}
            </label>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
          <select value={speedDateFormat} onChange={(e) => setSpeedDateFormat(e.target.value)}>
            <option value="all-facetime">all-facetime</option>
            <option value="in-person">in-person</option>
          </select>
          <button onClick={handleScheduleSpeedDate} disabled={speedDateBusy || speedDatePicked.length === 0}>
            Schedule
          </button>
        </div>

        {speedDateSlot && (
          <div style={{ marginTop: 8, fontSize: 12 }}>
            <p style={{ margin: "2px 0" }}>
              Slot #{speedDateSlot.id} ({speedDateSlot.format}, {speedDateSlot.durationSec}s, {speedDateSlot.participants.length} participants)
            </p>
            {speedDateSlot.media?.sessionId && <p style={{ margin: "2px 0" }}>Video session ready: {speedDateSlot.media.sessionId}</p>}
            {speedDateSlot.media?.available === false && (
              <p style={{ margin: "2px 0", color: "#888" }}>Scheduled without video ({speedDateSlot.media.reason}).</p>
            )}
            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
              <button onClick={handleExtendSpeedDate} disabled={speedDateBusy || speedDateSlot.extended}>
                {speedDateSlot.extended ? "Already extended" : "Extend +60s"}
              </button>
              {speedDateSlot.participants.length > 2 && (
                <button onClick={handleShowRotation} disabled={speedDateBusy}>Show rotation</button>
              )}
            </div>
            {speedDateRotation && (
              <div style={{ marginTop: 4 }}>
                {speedDateRotation.map((round, i) => (
                  <p key={i} style={{ margin: "2px 0" }}>{round.userAId} ↔ {round.userBId}</p>
                ))}
              </div>
            )}
          </div>
        )}
        {speedDateError && <p style={{ color: "crimson" }}>Error: {speedDateError}</p>}
      </div>

      <div style={{ marginTop: 12, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
        <p style={{ fontSize: 13, fontWeight: "bold", margin: "0 0 4px" }}>Gift Dating</p>
        <p style={{ fontSize: 11, color: "#888", margin: "0 0 6px" }}>
          A real VCoin minimum, not a sugar-dating feature — a request only goes through once the gift meets it.
        </p>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: 12 }}>Your minimum gift:</span>
          <input
            type="number" min="0" value={giftThresholdInput}
            onChange={(e) => setGiftThresholdInput(e.target.value)}
            style={{ width: 70 }}
          />
          <button onClick={handleSetGiftThreshold} disabled={giftBusy}>Save</button>
          {giftThreshold && <span style={{ fontSize: 11, color: "#888" }}>(current: {giftThreshold.minGiftValueVCoin})</span>}
        </div>

        {visibleUsers.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 12, margin: "0 0 2px" }}>Request a date with a gift:</p>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {visibleUsers.map((userId) => (
                <button key={userId} onClick={() => setGiftTarget(userId)} style={{ fontWeight: giftTarget === userId ? "bold" : "normal" }}>
                  {userId}
                </button>
              ))}
            </div>
            {giftTarget && (
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                <input
                  type="number" min="1" placeholder="VCoin amount" value={giftAmountInput}
                  onChange={(e) => setGiftAmountInput(e.target.value)}
                  style={{ width: 100 }}
                />
                <button onClick={handleRequestDateWithGift} disabled={giftBusy || !giftAmountInput}>Send gift + request</button>
                <button onClick={() => setGiftTarget(null)} disabled={giftBusy}>Cancel</button>
              </div>
            )}
          </div>
        )}

        <p style={{ fontSize: 12, margin: "8px 0 2px" }}>Gift requests you've received ({giftRequests.length}):</p>
        {giftRequests.length === 0 && <p style={{ fontSize: 12, color: "#888" }}>None yet.</p>}
        {giftRequests.map((r) => (
          <p key={r.id} style={{ fontSize: 12, margin: "2px 0" }}>{r.requesterId} sent {r.giftValueVCoin} VCoin</p>
        ))}
        {giftError && <p style={{ color: "crimson" }}>Error: {giftError}</p>}
      </div>

      <div style={{ marginTop: 12, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
        <p style={{ fontSize: 13, fontWeight: "bold", margin: "0 0 4px" }}>Blind Date Mode</p>
        <p style={{ fontSize: 11, color: "#888", margin: "0 0 6px" }}>
          A real 20-VCoin date token, then a deterministic AI-ranked assignment from who's checked in here — photos stay hidden until 3 real messages happen.
        </p>
        {blindDateBlocked && (
          <p style={{ fontSize: 12, color: "crimson" }}>Temporarily blocked after too many consecutive cancellations.</p>
        )}

        {!blindDateSession && (
          <>
            <button onClick={handlePurchaseBlindDateToken} disabled={blindDateBusy || blindDateBlocked || !!blindDateToken}>
              {blindDateToken ? "Token purchased" : "Buy a date token (20 VCoin)"}
            </button>
            {visibleUsers.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <p style={{ fontSize: 12, margin: "0 0 2px" }}>Candidate pool (here right now):</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {visibleUsers.map((userId) => (
                    <label key={userId} style={{ fontSize: 12 }}>
                      <input type="checkbox" checked={blindDateCandidates.includes(userId)} onChange={() => toggleBlindDateCandidate(userId)} />
                      {" "}{userId}
                    </label>
                  ))}
                </div>
                <button onClick={handleAssignBlindDate} disabled={blindDateBusy || blindDateCandidates.length === 0 || !blindDateToken} style={{ marginTop: 4 }}>
                  Get my blind date assignment
                </button>
              </div>
            )}
          </>
        )}

        {blindDateSession && (
          <div style={{ fontSize: 12 }}>
            <p style={{ margin: "2px 0" }}>
              Session #{blindDateSession.id} — {blindDateSession.photosRevealed ? "photos revealed" : "photos hidden until real conversation happens"}
              {blindDateSession.cancelled ? " (cancelled)" : ""}
            </p>
            {!blindDateSession.cancelled && !blindDateSession.photosRevealed && (
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                <button onClick={handleRevealBlindDatePhotos} disabled={blindDateBusy}>Try to reveal photos</button>
                <button onClick={handleCancelBlindDate} disabled={blindDateBusy}>Cancel this date</button>
              </div>
            )}
          </div>
        )}
        {blindDateError && <p style={{ color: "crimson" }}>Error: {blindDateError}</p>}
      </div>

      <div style={{ marginTop: 12, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
        <p style={{ fontSize: 13, fontWeight: "bold", margin: "0 0 4px" }}>Hunts Dates</p>
        <p style={{ fontSize: 11, color: "#888", margin: "0 0 6px" }}>
          Turn this date into a real HVNTZ scavenger hunt — the hunt id is checked live against HVNTZ, not just trusted.
        </p>

        {!huntDateEvent && visibleUsers.length > 0 && (
          <div>
            <p style={{ fontSize: 12, margin: "0 0 2px" }}>Invite who's here right now:</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {visibleUsers.map((userId) => (
                <label key={userId} style={{ fontSize: 12 }}>
                  <input type="checkbox" checked={huntDatePicked.includes(userId)} onChange={() => toggleHuntDatePicked(userId)} />
                  {" "}{userId}
                </label>
              ))}
            </div>
            <button onClick={handleCreateDateEvent} disabled={huntDateBusy || huntDatePicked.length === 0} style={{ marginTop: 4 }}>
              Create date event
            </button>
          </div>
        )}

        {huntDateEvent && (
          <div style={{ fontSize: 12 }}>
            <p style={{ margin: "2px 0" }}>
              Date event #{huntDateEvent.id} — {huntDateEvent.participants.length} invited, {huntDateEvent.visibleAttendeeCount ?? 0} visibly going
              {huntDateEvent.huntId ? ` — linked to hunt "${huntDateEvent.huntTitle}"` : ""}
            </p>
            <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 4 }}>
              <label>
                <input type="checkbox" checked={huntDateVisible} onChange={(e) => setHuntDateVisible(e.target.checked)} />
                {" "}show I'm going
              </label>
              <button onClick={handleRsvpToDateEvent} disabled={huntDateBusy}>RSVP</button>
            </div>
            {!huntDateEvent.huntId && (
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                <input
                  type="number" placeholder="Real HVNTZ hunt id" value={huntIdInput}
                  onChange={(e) => setHuntIdInput(e.target.value)}
                  style={{ width: 120 }}
                />
                <button onClick={handleLinkHunt} disabled={huntDateBusy || !huntIdInput}>Link hunt</button>
              </div>
            )}
          </div>
        )}
        {huntDateError && <p style={{ color: "crimson" }}>Error: {huntDateError}</p>}
      </div>

      {actionError && <p style={{ color: "crimson" }}>Error: {actionError}</p>}
    </div>
  );
}
