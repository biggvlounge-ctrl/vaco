import { useState } from "react";
import {
  createShow, createEpisode, publishEpisode, listen, subscribeToShow,
} from "../lib/vulturePodsClient.js";

// VDP's real Vvltvre Pods district -- a live client of Vvltvre Pods'
// own real show/episode/subscription engine. No podcast logic here,
// every real subscription payout and every real listen event comes
// back from Vvltvre Pods' own server. Publishing an episode is a real
// cross-app call from Vvltvre Pods into Vvltvre Music -- both real
// services need to be running for that step.

export default function VulturePodsView({ session }) {
  const [show, setShow] = useState(null);
  const [episode, setEpisode] = useState(null);
  const [listened, setListened] = useState(null);
  const [subscribed, setSubscribed] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleCreateShow = async () => {
    setBusy(true);
    setError(null);
    try {
      const newShow = await createShow({
        creatorId: session.userId,
        title: "VDP Sessions",
        description: "A real podcast about the VACO ecosystem itself.",
        category: "technology",
        subscriptionTiers: [{ name: "Supporter", priceVCoin: 5 }],
      });
      setShow(newShow);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handlePublish = async () => {
    setBusy(true);
    setError(null);
    try {
      const newEpisode = await createEpisode({
        showId: show.id, title: "Episode 1: Building the World", episodeNumber: 1, durationSeconds: 1800,
      });
      const published = await publishEpisode(newEpisode.id);
      setEpisode(published);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleListen = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await listen({ episodeId: episode.id, userId: session.userId });
      setListened(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSubscribe = async () => {
    setBusy(true);
    setError(null);
    try {
      const sub = await subscribeToShow({ userId: session.userId, showId: show.id, tierId: 1 });
      setSubscribed(sub);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px 0" }}>Vvltvre Pods — real podcast</h2>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
        Free listening by default (real Spotify/Apple economics); a real 5 VCoin/mo Supporter tier alongside it.
      </p>

      {!show && (
        <button onClick={handleCreateShow} disabled={busy}>Create a demo show</button>
      )}

      {show && !episode && (
        <button onClick={handlePublish} disabled={busy}>Publish episode 1 (real cross-app release via Vvltvre Music)</button>
      )}

      {episode && (
        <div style={{ borderTop: "1px dashed #ccc", paddingTop: 8 }}>
          <p style={{ fontSize: 13, margin: "0 0 4px" }}>
            {show.title} — &ldquo;{episode.title}&rdquo; ({episode.status})
          </p>
          {!listened && <button onClick={handleListen} disabled={busy}>Listen (free)</button>}
          {listened && <p style={{ fontSize: 12, color: "#1a7d3c", margin: "0 0 8px" }}>Listen recorded.</p>}
          {!subscribed && <button onClick={handleSubscribe} disabled={busy}>Subscribe to Supporter tier (5 VCoin)</button>}
          {subscribed && <p style={{ fontSize: 12, color: "#1a7d3c" }}>Subscribed — real VCoin split to creator + platform.</p>}
        </div>
      )}

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </div>
  );
}
