import { useState, useEffect, useCallback } from "react";
import { ORG_TYPES } from "../lib/organizations.js";

// Founding/inviting/leaving a real organization (family/tribe/cult) --
// membership mixes real players and NPCs (an `npc-<id>` id, the same
// convention server.cjs's own /api/players/:id/talk route already
// uses). Cohesion moves from real activity (chat with an org-mate,
// player or NPC) server-side; this just shows it and the real actions.

const VDP_API_URL = import.meta.env?.VITE_VDP_API_URL || "http://localhost:8827";

export default function OrganizationsView({ session, onChange }) {
  const [org, setOrg] = useState(null);
  const [name, setName] = useState("");
  const [type, setType] = useState(ORG_TYPES[0]);
  const [inviteId, setInviteId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!session?.userId) return;
    try {
      const res = await fetch(`${VDP_API_URL}/api/players/${encodeURIComponent(session.userId)}/organization`);
      const body = await res.json();
      setOrg(body.organization);
    } catch {
      // Transient fetch failure -- the next refresh tries again.
    }
  }, [session?.userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleFound = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${VDP_API_URL}/api/organizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.sessionToken}` },
        body: JSON.stringify({ name: name.trim(), type, founderId: session.userId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `found failed (${res.status})`);
      setOrg(body);
      setName("");
      if (onChange) await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteId.trim() || !org) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${VDP_API_URL}/api/organizations/${org.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.sessionToken}` },
        body: JSON.stringify({ inviterId: session.userId, memberId: inviteId.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `invite failed (${res.status})`);
      setOrg(body);
      setInviteId("");
      if (onChange) await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!org) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${VDP_API_URL}/api/organizations/${org.id}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.sessionToken}` },
        body: JSON.stringify({ memberId: session.userId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `leave failed (${res.status})`);
      setOrg(null);
      if (onChange) await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!session) return null;

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>My Organization</h2>
      {error && <p style={{ fontSize: 12, color: "#e04a4a" }}>{error}</p>}

      {!org && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            placeholder="organization name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ fontSize: 12 }}
          />
          <select value={type} onChange={(e) => setType(e.target.value)} style={{ fontSize: 12 }}>
            {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={handleFound} disabled={busy || !name.trim()}>
            {busy ? "…" : "Found"}
          </button>
        </div>
      )}

      {org && (
        <div>
          <p style={{ fontSize: 13 }}>
            <strong>{org.name}</strong> ({org.type}) — cohesion {Math.round(org.cohesion)}
          </p>
          <ul style={{ fontSize: 12, margin: "0 0 8px 0", paddingLeft: 18 }}>
            {org.memberIds.map((id) => (
              <li key={id}>{id}{id === org.founderId && <em> (founder)</em>}</li>
            ))}
          </ul>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              placeholder="userId or npc-<id> to invite"
              value={inviteId}
              onChange={(e) => setInviteId(e.target.value)}
              style={{ fontSize: 12 }}
            />
            <button onClick={handleInvite} disabled={busy || !inviteId.trim()}>
              {busy ? "…" : "Invite"}
            </button>
          </div>
          <button onClick={handleLeave} disabled={busy}>
            {busy ? "…" : "Leave"}
          </button>
        </div>
      )}
    </div>
  );
}
