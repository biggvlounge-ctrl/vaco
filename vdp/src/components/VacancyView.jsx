import { useState, useEffect, useCallback } from "react";
import {
  getWorldState, advanceTick, generateNPC, generateArtifact, generateMission,
} from "../lib/vacancyClient.js";

// VDP's real VACON-C district -- a live client of VACON-C's own
// civilization-simulation engine. Same real-cross-app-fetch shape as
// VAGO/VACAY ('vago-embed'/'vacay-embed'): no simulation logic here,
// every real tick count, NPC trait, artifact, and mission comes back
// from VACON-C's own server. This is VDP's real, previously-missing
// frontend for VACON-C -- the one confirmed gap the ecosystem audit
// found among the 16 real parents.
//
// Scope matches VACON-C's own real, currently-live API exactly (5
// endpoints: state/tick/npc/artifacts/mission) -- its own locked
// Phase 1 roadmap names ~40 further endpoints across later phases;
// this view doesn't pretend any of those exist yet.

export default function VacancyView() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [npcName, setNpcName] = useState("");
  const [npcRole, setNpcRole] = useState("");
  const [artifactName, setArtifactName] = useState("");
  const [lastArtifact, setLastArtifact] = useState(null);
  const [missionObjective, setMissionObjective] = useState("");
  const [lastMission, setLastMission] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const s = await getWorldState();
      setState(s);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runAction = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleTick = () => runAction(async () => {
    const s = await advanceTick();
    setState(s);
  });

  const handleGenerateNPC = () => runAction(async () => {
    const { state: s } = await generateNPC({
      name: npcName.trim() || undefined,
      role: npcRole.trim() || undefined,
    });
    setState(s);
    setNpcName("");
    setNpcRole("");
  });

  const handleGenerateArtifact = () => runAction(async () => {
    if (!artifactName.trim()) throw new Error("Artifact needs a name.");
    const artifact = await generateArtifact({ name: artifactName.trim() });
    setLastArtifact(artifact);
    setArtifactName("");
  });

  const handleGenerateMission = () => runAction(async () => {
    if (!lastArtifact) throw new Error("Generate an artifact first -- missions need a real artifact_id.");
    const { mission } = await generateMission({
      artifactId: lastArtifact.id,
      objective: missionObjective.trim() || undefined,
    });
    setLastMission(mission);
    setMissionObjective("");
  });

  if (!state && !error) {
    return <div className="vacancy-view"><p>Loading VACON-C world state…</p></div>;
  }

  const recentNpcs = state ? state.npcs.slice(-5).reverse() : [];

  return (
    <div className="vacancy-view" style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 640 }}>
      <h2>VACON-C — Civilization Simulation</h2>

      {error && <p style={{ color: "#c0392b" }}>{error}</p>}

      {state && (
        <div style={{ display: "flex", gap: "1.5rem" }}>
          <div><strong>Tick:</strong> {state.tick}</div>
          <div><strong>NPCs:</strong> {state.npcs.length}</div>
          <div><strong>Organizations:</strong> {state.organizations.length}</div>
        </div>
      )}

      <button type="button" disabled={busy} onClick={handleTick}>
        Advance tick
      </button>

      <section>
        <h3>Generate NPC</h3>
        <input placeholder="Name (optional)" value={npcName} onChange={(e) => setNpcName(e.target.value)} />
        <input placeholder="Role (optional)" value={npcRole} onChange={(e) => setNpcRole(e.target.value)} />
        <button type="button" disabled={busy} onClick={handleGenerateNPC}>Generate</button>
      </section>

      <section>
        <h3>Recent NPCs</h3>
        {recentNpcs.length === 0 && <p>None yet.</p>}
        <ul>
          {recentNpcs.map((npc) => (
            <li key={npc.id}>
              #{npc.id} {npc.name} {npc.role ? `— ${npc.role}` : ""} (created tick {npc.createdTick})
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Artifacts &amp; Missions</h3>
        <input placeholder="Artifact name" value={artifactName} onChange={(e) => setArtifactName(e.target.value)} />
        <button type="button" disabled={busy} onClick={handleGenerateArtifact}>Generate artifact</button>
        {lastArtifact && <p>Artifact #{lastArtifact.id}: {lastArtifact.name}</p>}

        <input
          placeholder="Mission objective (optional)"
          value={missionObjective}
          onChange={(e) => setMissionObjective(e.target.value)}
          disabled={!lastArtifact}
        />
        <button type="button" disabled={busy || !lastArtifact} onClick={handleGenerateMission}>
          Generate mission
        </button>
        {lastMission && <p>Mission #{lastMission.id} for artifact #{lastMission.artifact_id}: {lastMission.objective || "(no objective set)"} — status {lastMission.status}</p>}
      </section>
    </div>
  );
}
