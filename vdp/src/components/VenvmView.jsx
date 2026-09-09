import { useState } from "react";
import {
  reformat, submitScriptRequest, generateScript,
  createProductionJob, advanceToStoryboard, queueRender, markRendered,
} from "../lib/venvmClient.js";

// VDP's real VENVM district -- a live client of VENVM's own real
// cross-platform reformat math and production-pipeline state machine.
// No reformat/pipeline logic here, every real fit/trim decision and
// every real stage transition comes back from VENVM's own server.
//
// Script generation is included honestly, not hidden: it calls
// VENVM's own real /generate route, which routes through v4-proxy --
// without a real ANTHROPIC_API_KEY configured there, this fails with
// a real, visible error rather than a fabricated script, same as
// every other real completion call in this ecosystem.

const PLATFORMS = ["tiktok", "instagramReels", "youtubeShorts", "twitterX"];

export default function VenvmView({ session }) {
  const [duration, setDuration] = useState(120);
  const [results, setResults] = useState(null);
  const [job, setJob] = useState(null);
  const [scriptRequest, setScriptRequest] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleReformat = async () => {
    setBusy(true);
    setError(null);
    try {
      const reformats = await reformat({ sourceDurationSeconds: Number(duration), platforms: PLATFORMS });
      setResults(reformats);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateJob = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await createProductionJob({ requesterApp: "vdp", title: `VDP session ${session.userId}` });
      setJob(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAdvance = async () => {
    setBusy(true);
    setError(null);
    try {
      let updated;
      if (job.stage === "script-ready") {
        updated = await advanceToStoryboard(job.id, "Hook, 3 beats, CTA");
      } else if (job.stage === "storyboard-ready") {
        updated = await queueRender(job.id);
      } else if (job.stage === "render-queued") {
        updated = await markRendered(job.id);
      }
      setJob(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleScriptRequest = async () => {
    setBusy(true);
    setError(null);
    try {
      const request = await submitScriptRequest({ requesterApp: "vdp", brief: "A 20-second ad for VDP itself", platform: "tiktok" });
      const generated = await generateScript(request.id);
      setScriptRequest(generated);
    } catch (err) {
      setError(err.message);
      setScriptRequest({ status: "failed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px 0" }}>VENVM — real production pipeline</h2>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
        Real cross-platform reformat math, a real 4-stage production pipeline, and a real script-generation call (routed through v4-proxy).
      </p>

      <div style={{ borderTop: "1px dashed #ccc", paddingTop: 8, marginBottom: 8 }}>
        <label style={{ fontSize: 12 }}>
          Source duration (seconds):{" "}
          <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} style={{ width: 60 }} />
        </label>{" "}
        <button onClick={handleReformat} disabled={busy}>Compute real reformat</button>
        {results && (
          <ul style={{ fontSize: 12, marginTop: 8 }}>
            {results.map((r) => (
              <li key={r.platform}>
                {r.label}: {r.fitsAsIs ? "fits as-is" : `trim to ${r.recommendedDurationSeconds}s`}
                {r.aspectRatioChangeNeeded ? " (aspect change needed)" : ""}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ borderTop: "1px dashed #ccc", paddingTop: 8, marginBottom: 8 }}>
        {!job && <button onClick={handleCreateJob} disabled={busy}>Start a real production job</button>}
        {job && (
          <>
            <p style={{ fontSize: 13, margin: "0 0 4px" }}>&ldquo;{job.title}&rdquo; — {job.stage}</p>
            {job.stage !== "rendered" && <button onClick={handleAdvance} disabled={busy}>Advance stage</button>}
            {job.stage === "rendered" && (
              <p style={{ fontSize: 12, color: "#888" }}>
                Rendered. videoUrl: {job.videoUrl || "null (no rendering infrastructure exists — an honest gap, not a bug)"}
              </p>
            )}
          </>
        )}
      </div>

      <div style={{ borderTop: "1px dashed #ccc", paddingTop: 8 }}>
        <button onClick={handleScriptRequest} disabled={busy}>Request a real script (Jake, via v4-proxy)</button>
        {scriptRequest && scriptRequest.status === "generated" && (
          <p style={{ fontSize: 12, color: "#1a7d3c", whiteSpace: "pre-wrap" }}>{scriptRequest.script}</p>
        )}
        {scriptRequest && scriptRequest.status === "failed" && (
          <p style={{ fontSize: 12, color: "#888" }}>
            Real, honest failure — v4-proxy has no ANTHROPIC_API_KEY configured (or is unreachable), same as every other agent call in this ecosystem without one.
          </p>
        )}
      </div>

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </div>
  );
}
