import { useState, useEffect, useCallback } from "react";
import { NEED_NAMES, TRAIT_NAMES, HABIT_NAMES, mostPressingNeed, topTrait } from "../lib/npcs.js";

// The player needs/goals engine (vdp/server.cjs reusing npcs.js's own
// stepNeeds/updateGoal, the same tick that steps NPCs) has been real
// and server-ticked since Foundation, but nothing ever displayed it --
// a player had no way to see what they need or what their own current
// goal is, the one thing that should be telling them what to do next.
//
// **The habit buttons below closed a second, real gap found the same
// way**: `POST /api/players/:id/actions` (server.cjs) reinforces a
// habit via the exact function an NPC's own `applyAction` already
// uses, and nothing anywhere in `src/` ever called it -- a route with
// real logic and no caller, same shape as every other unwired-route
// finding this session kept turning up. A player could see their own
// needs drifting and had no verb to do anything about it.
//
// **Citations and detention (8 Oct 2026), per direct instruction**:
// "people can get ticketed. They will be sent directly to their
// profile." This is that profile -- the real, honest place a real
// citation (`justice.js`) lands, with a real "pay it" action, and the
// real fact of whether this player is currently detained.

const VDP_API_URL = import.meta.env?.VITE_VDP_API_URL || "http://localhost:8827";
const POLL_INTERVAL_MS = 10000;

function needBar(value) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct < 25 ? "#e04a4a" : pct < 50 ? "#d9a441" : "#3a9d6f";
  return (
    <div style={{ background: "#eee", borderRadius: 4, height: 8, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, background: color, height: "100%" }} />
    </div>
  );
}

export default function MyStatusView({ session, refreshSignal }) {
  const [state, setState] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [detention, setDetention] = useState(null);
  const [error, setError] = useState(null);
  const [busyAction, setBusyAction] = useState(null);
  const [payingTicketId, setPayingTicketId] = useState(null);

  const refresh = useCallback(async () => {
    if (!session?.userId) return;
    try {
      const userId = encodeURIComponent(session.userId);
      const [res, ticketsRes, detainedRes] = await Promise.all([
        fetch(`${VDP_API_URL}/api/players/${userId}/state`),
        fetch(`${VDP_API_URL}/api/justice/tickets/${userId}`),
        fetch(`${VDP_API_URL}/api/justice/detained/${userId}`),
      ]);
      if (!res.ok) throw new Error(`state failed (${res.status})`);
      const body = await res.json();
      setState(body.state);
      setTickets((await ticketsRes.json()).tickets || []);
      setDetention((await detainedRes.json()).detention);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [session?.userId]);

  const handlePayTicket = async (ticketId) => {
    setPayingTicketId(ticketId);
    setError(null);
    try {
      const res = await fetch(`${VDP_API_URL}/api/justice/tickets/${ticketId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.sessionToken}` },
        body: JSON.stringify({ personId: session.userId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `pay failed (${res.status})`);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setPayingTicketId(null);
    }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, refreshSignal]);

  const doAction = async (action) => {
    if (!session?.userId) return;
    setBusyAction(action);
    setError(null);
    try {
      const res = await fetch(`${VDP_API_URL}/api/players/${encodeURIComponent(session.userId)}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.sessionToken}` },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `actions failed (${res.status})`);
      }
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyAction(null);
    }
  };

  if (!session || !state) return null;

  const pressing = mostPressingNeed(state);
  const dominant = topTrait(state);

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>My Status</h2>
      {error && <p style={{ fontSize: 12, color: "#e04a4a" }}>{error}</p>}

      <p style={{ fontSize: 13, margin: "0 0 12px 0" }}>
        {state.currentGoal
          ? <><strong>Goal:</strong> {state.currentGoal.description}</>
          : <>No open goal right now -- needs are holding steady.</>}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 12, margin: "0 0 6px 0", color: "#888" }}>NEEDS</h3>
          {NEED_NAMES.map((name) => (
            <div key={name} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span>
                  {name}
                  {name === pressing && <strong> (most pressing)</strong>}
                </span>
                <span>{Math.round(state.needs[name])}</span>
              </div>
              {needBar(state.needs[name])}
            </div>
          ))}
        </div>

        <div>
          <h3 style={{ fontSize: 12, margin: "0 0 6px 0", color: "#888" }}>TRAITS</h3>
          <ul style={{ fontSize: 11, margin: 0, paddingLeft: 16 }}>
            {TRAIT_NAMES.map((name) => (
              <li key={name}>
                {name}: {state.traits[name]}
                {name === dominant && <strong> (dominant)</strong>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        {HABIT_NAMES.map((action) => (
          <button
            key={action}
            onClick={() => doAction(action)}
            disabled={busyAction !== null}
            style={{ fontSize: 11 }}
          >
            {busyAction === action ? "…" : action}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 12, borderTop: "1px dashed #ccc", paddingTop: 8 }}>
        <h3 style={{ fontSize: 12, margin: "0 0 6px 0", color: "#888" }}>CITATIONS &amp; DETENTION</h3>
        {detention && (
          <p style={{ fontSize: 12, color: "crimson", margin: "0 0 6px" }}>
            Currently detained: {detention.reason}
          </p>
        )}
        {tickets.filter((t) => !t.paid).length === 0 && !detention && (
          <p style={{ fontSize: 12, color: "#888" }}>No open citations.</p>
        )}
        {tickets.filter((t) => !t.paid).map((t) => (
          <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "2px 0" }}>
            <span>{t.reason} — {t.amountOwed} VCoin</span>
            <button onClick={() => handlePayTicket(t.id)} disabled={payingTicketId === t.id} style={{ fontSize: 11 }}>
              {payingTicketId === t.id ? "…" : "Pay"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
