import { useState, useEffect, useCallback } from "react";
import {
  getWorldState, advanceTick, generateNPC, generateArtifact, generateMission,
  listProperties, listOrganizations, listCultures, listEvents,
  getEconomySnapshot, getMainCharacters, listConditions,
} from "../lib/vacancyClient.js";

// VDP's real VACON-C district -- a live client of VACON-C's own
// civilization-simulation engine. Same real-cross-app-fetch shape as
// VAGO/VACAY ('vago-embed'/'vacay-embed'): no simulation logic here,
// every real tick count, NPC trait, artifact, and mission comes back
// from VACON-C's own server. This is VDP's real, previously-missing
// frontend for VACON-C -- the one confirmed gap the ecosystem audit
// found among the 16 real parents.
//
// **Corrected 13 Nov 2026.** This header used to say scope matched
// VACON-C's "real, currently-live API exactly (5 endpoints)" -- stale
// the moment `vacancyClient.js` was extended on 29 Aug 2026 to cover
// the shared entity types, and still stale more than two months after
// that, because this component kept calling only the original five
// functions. The shared-entity-type section below reads real
// properties (resort venues), organizations (promotions/operators),
// cultures (district DNA), events (Combat Sports matches VACON-C's
// tick pipeline actually produced), the real economy snapshot, a
// community's real local power hierarchy, and real active
// environmental conditions -- all of it already built in
// `vacancyClient.js` and, until now, called by nothing.

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
  const [world, setWorld] = useState(null);
  const [worldError, setWorldError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const s = await getWorldState();
      setState(s);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // The shared entity types and world readouts -- a second, separate
  // fetch so one being unreachable (or a world with no communities
  // yet) never blocks the tick/NPC/artifact/mission panel above it.
  const refreshWorld = useCallback(async (firstCommunityId) => {
    try {
      const [properties, organizations, cultures, events, economy, conditions] = await Promise.all([
        listProperties(), listOrganizations(), listCultures(), listEvents(), getEconomySnapshot(), listConditions(),
      ]);
      const mainCharacters = firstCommunityId != null ? await getMainCharacters(firstCommunityId) : null;
      setWorld({ properties, organizations, cultures, events, economy, conditions, mainCharacters });
      setWorldError(null);
    } catch (err) {
      setWorldError(err.message);
    }
  }, []);

  useEffect(() => {
    if (state?.communities?.[0]) refreshWorld(state.communities[0].id);
  }, [state?.communities, refreshWorld]);

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

      <section>
        <h3>World — shared entity types &amp; readouts</h3>
        {worldError && <p style={{ color: "#c0392b" }}>{worldError}</p>}
        {!world && !worldError && <p>Loading…</p>}
        {world && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div><strong>Properties:</strong> {world.properties.total} ({world.properties.properties.slice(0, 3).map((p) => p.type).join(", ") || "none"}{world.properties.total > 3 ? ", …" : ""})</div>
            <div><strong>Organizations:</strong> {world.organizations.total} ({world.organizations.organizations.slice(0, 3).map((o) => `${o.name} (${o.type})`).join(", ") || "none"})</div>
            <div><strong>Cultures:</strong> {world.cultures.total}</div>
            <div><strong>Recent events:</strong> {world.events.total} ({world.events.events.slice(-3).reverse().map((e) => `${e.type}@${e.tick}`).join(", ") || "none"})</div>
            <div><strong>Active conditions:</strong> {world.conditions.conditions.length} ({world.conditions.conditions.slice(0, 3).map((c) => c.type || c.conditionType || c.name).join(", ") || "none"})</div>
            <div><strong>Resources tracked:</strong> {world.economy.resources.length}</div>
            {world.mainCharacters && (
              <div>
                <strong>This community's main characters:</strong>{" "}
                criminal {world.mainCharacters.criminal ? `org #${world.mainCharacters.criminal.organizationId}` : "none yet"}, political {world.mainCharacters.political ? `org #${world.mainCharacters.political.organizationId}` : "none yet"}, religious {world.mainCharacters.religious ? `org #${world.mainCharacters.religious.organizationId}` : "none yet"}, business {world.mainCharacters.business ? `org #${world.mainCharacters.business.organizationId}` : "none yet"}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
