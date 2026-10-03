import { useState, useEffect } from "react";

const VDP_API_URL = import.meta.env?.VITE_VDP_API_URL || "http://localhost:8827";
const POLL_INTERVAL_MS = 10000;

const KIND_LABEL = {
  job: "Job",
  property: "Property",
  library: "Library",
  chat: "Chat",
  npc: "NPC",
};

export default function NewsTicker() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`${VDP_API_URL}/api/news?limit=20`);
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled) setEvents(body.events);
      } catch {
        // Transient fetch failure -- the next poll tries again.
      }
    }
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>Live World News</h2>
      {events.length === 0 && <p style={{ fontSize: 12, color: "#888" }}>Nothing has happened yet.</p>}
      <ul style={{ fontSize: 12, margin: 0, paddingLeft: 0, listStyle: "none" }}>
        {events.map((e) => (
          <li key={e.id} style={{ padding: "4px 0", borderTop: "1px solid #eee" }}>
            <span style={{ color: "#888", marginRight: 6 }}>[{KIND_LABEL[e.kind] || e.kind}]</span>
            {e.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
