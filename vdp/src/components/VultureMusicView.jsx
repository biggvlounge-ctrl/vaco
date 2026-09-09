import { useState } from "react";
import {
  submitRelease, markDistributing, markLive, reportStreamingRevenue, getArtistSummary,
} from "../lib/vultureMusicClient.js";

// VDP's real Vvltvre Music district -- a live client of Vvltvre
// Music's own real release/distribution/royalty engine. No release
// logic here, every real distribution fee and every real streaming
// payout comes back from Vvltvre Music's own server.

export default function VultureMusicView({ session }) {
  const [release, setRelease] = useState(null);
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      const newRelease = await submitRelease({
        artistId: session.userId, title: "VDP Sessions EP", format: "single", targetPlatforms: ["Spotify", "Apple Music"],
      });
      setRelease(newRelease);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleGoLive = async () => {
    setBusy(true);
    setError(null);
    try {
      await markDistributing(release.id);
      const live = await markLive(release.id);
      setRelease(live);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleReportRevenue = async () => {
    setBusy(true);
    setError(null);
    try {
      await reportStreamingRevenue({ releaseId: release.id, amount: 50, source: "Spotify" });
      const artistSummary = await getArtistSummary(session.userId);
      setSummary(artistSummary);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px 0" }}>Vvltvre Music — real release + royalties</h2>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
        A real distribution fee, a real status pipeline, and a real streaming-revenue payout.
      </p>

      {!release && (
        <button onClick={handleSubmit} disabled={busy}>Submit a single (9.99 VCoin distribution fee)</button>
      )}

      {release && (
        <div style={{ borderTop: "1px dashed #ccc", paddingTop: 8 }}>
          <p style={{ fontSize: 13, margin: "0 0 4px" }}>
            Release #{release.id} — {release.title} — status: {release.status}
          </p>
          {release.status === "submitted" && (
            <button onClick={handleGoLive} disabled={busy}>Take it live</button>
          )}
          {release.status === "live" && !summary && (
            <button onClick={handleReportRevenue} disabled={busy}>Report 50 VCoin streaming revenue</button>
          )}
          {summary && (
            <p style={{ fontSize: 12, color: "#1a7d3c" }}>
              Real payout landed — total streaming revenue: {summary.totalStreamingRevenue} VCoin, net earnings after distribution fees: {summary.netEarnings} VCoin.
            </p>
          )}
        </div>
      )}

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </div>
  );
}
