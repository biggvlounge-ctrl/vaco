// Contract every search backend must satisfy. server.js only ever talks
// to this shape, so swapping MemorySearchAdapter for a real provider
// (Elasticsearch, Algolia, etc.) later means writing one adapter class
// and changing a single import in server.js — nothing else moves.
//
// search(query, { apps, limit }) -> Promise<Array<{
//   app: string,       // one of APP_IDS in server.js
//   type: string,       // app-defined document type, e.g. "hunt", "stay"
//   id: string,
//   title: string,
//   subtitle: string,
//   score: number,      // higher is more relevant; adapter defines the scale
// }>>

export class SearchAdapter {
  async search(_query, _opts) {
    throw new Error("search() not implemented");
  }
}
