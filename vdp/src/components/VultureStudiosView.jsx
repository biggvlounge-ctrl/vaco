import { useState, useCallback, useEffect } from "react";
import {
  listProjects, greenlightProject, investInProject, getProjectEquity,
  startProduction, completeProject, distributeProject, reportProjectRevenue,
} from "../lib/vultureStudiosClient.js";

// VDP's real Vvltvre Studios district -- a live client of Vvltvre
// Studios' own real fund-and-produce engine. No financing/production/
// distribution logic here: every real investor transfer, every real
// status transition (greenlit -> funded -> in-production -> completed),
// and every real cross-app distribution hand-off (film/tv into Vvltvre
// Flix, music/podcast into Vvltvre Music, investors paid as that
// release's own real co-writers) comes back from Vvltvre Studios' own
// server. Covers the real loop: greenlight a project, invest as a real
// backer, watch it move through production, distribute it, and report
// real revenue against it.

const MEDIUMS = ["film", "tv", "music", "podcast"];

export default function VultureStudiosView({ session }) {
  const [projects, setProjects] = useState(null);
  const [title, setTitle] = useState("");
  const [medium, setMedium] = useState("film");
  const [synopsis, setSynopsis] = useState("");
  const [budget, setBudget] = useState(500);
  const [investAmounts, setInvestAmounts] = useState({});
  const [equityByProject, setEquityByProject] = useState({});
  const [revenueAmounts, setRevenueAmounts] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const refresh = useCallback(() => {
    listProjects().then(setProjects).catch((err) => setError(err.message));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const runAction = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleGreenlight = (e) => {
    e.preventDefault();
    runAction(async () => {
      await greenlightProject({
        title, medium, synopsis, budgetRequested: Number(budget),
      });
      setTitle("");
      setSynopsis("");
    });
  };

  const handleInvest = (projectId) => runAction(async () => {
    const amount = Number(investAmounts[projectId] || 0);
    await investInProject({ projectId, investorId: session.userId, amount });
  });

  const handleViewEquity = (projectId) => runAction(async () => {
    const equity = await getProjectEquity(projectId);
    setEquityByProject((prev) => ({ ...prev, [projectId]: equity }));
  });

  const handleStartProduction = (projectId) => runAction(() => startProduction(projectId));
  const handleComplete = (projectId) => runAction(() => completeProject(projectId));

  const handleDistribute = (projectId) => runAction(async () => {
    const result = await distributeProject(projectId);
    setLastResult({ type: "distribute", projectId, result });
  });

  const handleReportRevenue = (projectId) => runAction(async () => {
    const amount = Number(revenueAmounts[projectId]?.amount || 0);
    const source = revenueAmounts[projectId]?.source || "revenue";
    const result = await reportProjectRevenue(projectId, { amount, source });
    setLastResult({ type: "revenue", projectId, result });
  });

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px 0" }}>Vvltvre Studios — fund, produce, distribute</h2>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
        A real Universal-Studios-style financing round: invest as a real backer, watch a project move
        greenlit &rarr; funded &rarr; in-production &rarr; completed, then distribute it and earn a real,
        proportional share of whatever revenue comes back.
      </p>

      <form onSubmit={handleGreenlight} style={{ borderTop: "1px dashed #ccc", paddingTop: 8, marginBottom: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 600, margin: "0 0 6px" }}>Greenlight a project</p>
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          style={{ width: 130, marginRight: 6 }}
        />
        <select value={medium} onChange={(e) => setMedium(e.target.value)} style={{ marginRight: 6 }}>
          {MEDIUMS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input
          placeholder="Synopsis"
          value={synopsis}
          onChange={(e) => setSynopsis(e.target.value)}
          required
          style={{ width: 140, marginRight: 6 }}
        />
        <input
          type="number"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          style={{ width: 70, marginRight: 6 }}
        />
        <button type="submit" disabled={busy}>Greenlight</button>
      </form>

      <div style={{ borderTop: "1px dashed #ccc", paddingTop: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 600, margin: "0 0 6px" }}>Real projects</p>
        {projects && projects.length === 0 && <p style={{ fontSize: 12, color: "#888" }}>No projects greenlit yet.</p>}
        {projects && projects.map((p) => {
          const remaining = Math.round((p.budgetRequested - p.amountRaised) * 100) / 100;
          const equity = equityByProject[p.id];
          return (
            <div key={p.id} style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
              <p style={{ fontSize: 12, margin: "0 0 4px" }}>
                <strong>&ldquo;{p.title}&rdquo;</strong> ({p.medium}) — <em>{p.status}</em> — raised {p.amountRaised}/{p.budgetRequested} VCoin
                {p.status === "greenlit" && remaining > 0 && ` (${remaining} still open)`}
                {p.distributionApp && ` — distributed via ${p.distributionApp} (#${p.distributionTitleId})`}
              </p>

              {p.status === "greenlit" && (
                <span style={{ marginRight: 6 }}>
                  <input
                    type="number"
                    placeholder="Invest"
                    value={investAmounts[p.id] || ""}
                    onChange={(e) => setInvestAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    style={{ width: 60, marginRight: 4 }}
                  />
                  <button onClick={() => handleInvest(p.id)} disabled={busy}>Invest</button>
                </span>
              )}
              {p.status === "funded" && (
                <button onClick={() => handleStartProduction(p.id)} disabled={busy} style={{ marginRight: 6 }}>
                  Start production
                </button>
              )}
              {p.status === "in-production" && (
                <button onClick={() => handleComplete(p.id)} disabled={busy} style={{ marginRight: 6 }}>
                  Complete
                </button>
              )}
              {p.status === "completed" && !p.distributionApp && (
                <button onClick={() => handleDistribute(p.id)} disabled={busy} style={{ marginRight: 6 }}>
                  Distribute
                </button>
              )}
              <button onClick={() => handleViewEquity(p.id)} disabled={busy} style={{ marginRight: 6 }}>
                View equity
              </button>

              {p.status === "completed" && p.distributionApp !== "vulture-music" && (
                <span style={{ display: "block", marginTop: 4 }}>
                  <input
                    type="number"
                    placeholder="Amount"
                    value={revenueAmounts[p.id]?.amount || ""}
                    onChange={(e) => setRevenueAmounts((prev) => ({ ...prev, [p.id]: { ...prev[p.id], amount: e.target.value } }))}
                    style={{ width: 60, marginRight: 4 }}
                  />
                  <input
                    placeholder="Source"
                    value={revenueAmounts[p.id]?.source || ""}
                    onChange={(e) => setRevenueAmounts((prev) => ({ ...prev, [p.id]: { ...prev[p.id], source: e.target.value } }))}
                    style={{ width: 80, marginRight: 4 }}
                  />
                  <button onClick={() => handleReportRevenue(p.id)} disabled={busy}>Report revenue</button>
                </span>
              )}
              {p.distributionApp === "vulture-music" && (
                <p style={{ fontSize: 11, color: "#888", margin: "4px 0 0" }}>
                  Revenue for this project is reported through Vvltvre Music&rsquo;s own release
                  (#{p.distributionTitleId}) — investors are paid there directly as real co-writers.
                </p>
              )}

              {equity && (
                <div style={{ marginTop: 4 }}>
                  {equity.investors.map((inv) => (
                    <p key={inv.investorId} style={{ fontSize: 11, color: "#555", margin: "1px 0" }}>
                      {inv.investorId}: {Math.round(inv.equityPercent * 10000) / 100}% equity, {inv.contributed} VCoin invested, {inv.totalRevenueReceived} VCoin received so far
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {lastResult && (
        <div style={{ borderTop: "1px dashed #ccc", paddingTop: 8, marginTop: 8 }}>
          <p style={{ fontSize: 12, color: "#1a7d3c", margin: 0 }}>
            {lastResult.type === "distribute"
              ? `Project #${lastResult.projectId} distributed via ${lastResult.result.project.distributionApp} (#${lastResult.result.project.distributionTitleId}).`
              : `Reported ${lastResult.result.amount} VCoin revenue for project #${lastResult.projectId}.`}
          </p>
        </div>
      )}

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </div>
  );
}
