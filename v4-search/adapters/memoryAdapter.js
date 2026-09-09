import { SearchAdapter } from "./SearchAdapter.js";

// Working, in-process implementation of the SearchAdapter contract.
// Seeded with a handful of real documents per app so the cross-ecosystem
// routing is genuinely exercisable end to end. This is the default and
// only adapter for now — swap it for a real provider (Elasticsearch,
// Algolia, ...) by writing a class with the same search() signature and
// pointing server.js at it instead.
const SEED_DOCUMENTS = [
  { app: "HVNTZ", type: "hunt", id: "hvntz-1", title: "Downtown Scavenger Hunt", subtitle: "Riverfront Coffee Co. checkpoint" },
  { app: "HVNTZ", type: "hunt", id: "hvntz-2", title: "Gallery District Mural Hunt", subtitle: "4 checkpoints, live leaderboard" },
  { app: "VACAY", type: "stay", id: "vacay-1", title: "Kyoto Machiya Stay", subtitle: "Hosted stay, 2br, walkable to Gion" },
  { app: "VACAY", type: "experience", id: "vacay-2", title: "Harbor District Food Walk", subtitle: "Local-hosted Experience, 3hr" },
  { app: "VENVS", type: "product", id: "venvs-1", title: "VACO Founders Hoodie", subtitle: "Storefront listing, limited run" },
  { app: "VENVS", type: "product", id: "venvs-2", title: "Vvltvre Live Set Vinyl", subtitle: "Storefront listing" },
  { app: "Vvltvre", type: "track", id: "vulture-1", title: "Ava — Discovery Mix Vol. 3", subtitle: "New release" },
  { app: "Vvltvre", type: "artist", id: "vulture-2", title: "Autumn", subtitle: "Creator profile" },
  { app: "VOKEN", type: "culture-card", id: "voken-1", title: "Founders Cvltvre Card #0091", subtitle: "412 VOKEN" },
  { app: "VOKEN", type: "culture-card", id: "voken-2", title: "VACAY Stay Voucher — Kyoto", subtitle: "150 VOKEN" },
  { app: "VACON-C", type: "location", id: "vacancy-1", title: "Union Station Plaza", subtitle: "Simulation discovery point" },
  { app: "VACON-C", type: "location", id: "vacancy-2", title: "Harbor Overlook", subtitle: "Simulation discovery point" },
];

function scoreMatch(query, doc) {
  const q = query.toLowerCase();
  const title = doc.title.toLowerCase();
  const subtitle = doc.subtitle.toLowerCase();
  if (title === q) return 100;
  if (title.startsWith(q)) return 80;
  if (title.includes(q)) return 60;
  if (subtitle.includes(q)) return 40;
  return 0;
}

export class MemorySearchAdapter extends SearchAdapter {
  constructor(documents = SEED_DOCUMENTS) {
    super();
    this.documents = documents;
  }

  async search(query, { apps, limit = 20 } = {}) {
    const scoped = apps && apps.length ? this.documents.filter((d) => apps.includes(d.app)) : this.documents;
    return scoped
      .map((d) => ({ ...d, score: scoreMatch(query, d) }))
      .filter((d) => d.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
