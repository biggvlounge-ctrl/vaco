import { useState, useEffect } from "react";
import { listBooks, purchaseBook } from "../lib/publishingClient.js";

// Phase 17 (1 Nov 2026): rewired from a local, in-memory
// `createCatalog()` -- reset on every component mount, so a title
// published and a purchase made both vanished on reload and were
// never visible to any other session -- to `publishingClient.js`'s
// real HTTP calls against `server.cjs`'s own real, persisted
// backend. Mirrors `MarketplaceView.jsx`'s own Phase 14 rewire
// exactly. The demo catalog (the same 7 titles `App.jsx`'s old
// `SEED_CATALOG` used to build client-side) is now seeded server-side,
// once, at boot.
//
// **Also fixes a real, pre-existing bug found while rewiring this**:
// the old `handleBuy` called `purchaseBook` with a `transferFn` but
// no `payoutFn` at all. `purchaseBook` throws immediately
// (`requirePayoutFn`'s own guard) whenever the book owes its author a
// royalty -- which every self-published title here does -- since a
// browser must never be trusted to instruct the platform's own payout
// leg. Only the royalty-free Ingram titles could ever have been
// bought from this view before. The real backend now supplies both
// legs itself, server-side, the same two-layer split checkout already
// uses for Marketplace.

export default function PublishingView({ session, onPurchase }) {
  const [books, setBooks] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [lastPurchase, setLastPurchase] = useState(null);

  // Closes this project's own flagged "no full tab UI (search, skill
  // tags, cover art)" gap -- real filters against the same
  // format/source `getCatalog` already supported server-side but this
  // view never exposed, plus the new real text search.
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState("");
  const [source, setSource] = useState("");

  const loadBooks = () => listBooks({ query, format, source }).then(setBooks).catch((err) => setLoadError(err.message));

  useEffect(() => {
    loadBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, format, source]);

  const handleBuy = async (bookId) => {
    setBusy(bookId);
    setError(null);
    try {
      const result = await purchaseBook(bookId, { buyerId: session.userId });
      setLastPurchase(result);
      await onPurchase();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>Publishing</h2>

      <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search titles…"
          style={{ flex: 1, minWidth: 120 }}
        />
        <select value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="">Any format</option>
          <option value="ebook">Ebook</option>
          <option value="print">Print</option>
          <option value="audiobook">Audiobook</option>
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Any source</option>
          <option value="self_published">Self-published</option>
          <option value="ingram">Ingram catalog</option>
        </select>
      </div>

      {loadError && <p style={{ color: "crimson" }}>Could not load the catalog: {loadError}</p>}
      {books.length === 0 && !loadError && <p style={{ fontSize: 12, color: "#888" }}>No titles match.</p>}
      {books.map((book) => (
        <div
          key={book.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "6px 0",
            borderTop: "1px solid #eee",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {book.coverArtUrl ? (
              <img src={book.coverArtUrl} alt="" style={{ width: 32, height: 44, objectFit: "cover", borderRadius: 2 }} />
            ) : (
              <div style={{ width: 32, height: 44, background: "#eee", borderRadius: 2, flexShrink: 0 }} />
            )}
            <div>
              <div>{book.title}</div>
              <div style={{ fontSize: 12, color: "#666" }}>
                ${book.listPrice.toFixed(2)} ·{" "}
                {book.source === "ingram" ? "Ingram catalog" : `royalty ${(book.royalty.rate * 100).toFixed(0)}%`}
              </div>
              {(book.skillSubject || book.beliefTopic) && (
                <span style={{ fontSize: 11, background: "#eef", color: "#446", borderRadius: 4, padding: "1px 5px" }}>
                  {book.skillSubject ? `teaches: ${book.skillSubject}` : `${book.beliefType}: ${book.beliefTopic}`}
                </span>
              )}
            </div>
          </div>
          <button onClick={() => handleBuy(book.id)} disabled={busy === book.id}>
            {busy === book.id ? "Buying…" : "Buy"}
          </button>
        </div>
      ))}
      {lastPurchase && (
        <p style={{ fontSize: 12, color: "#2a7" }}>
          Bought "{lastPurchase.book.title}" for {lastPurchase.pricePaid} VCoin
          {lastPurchase.royaltyPaid
            ? ` — ${lastPurchase.royaltyPaid} VCoin paid to author.`
            : " — no author royalty (Ingram catalog title)."}
        </p>
      )}
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </div>
  );
}
