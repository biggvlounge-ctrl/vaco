import { useState, useEffect, useCallback } from "react";
import { login, getCurrentSession, logout, adoptToken } from "./lib/shieldAuth.js";
import { getVCoinBalance, cashOutToVash, getVashBalance } from "./lib/v3Client.js";
import { createCatalog, publishBook } from "./lib/catalog.js";
import { createShop, listProduct } from "./lib/shop.js";
import PublishingView from "./components/PublishingView.jsx";
import MarketplaceView from "./components/MarketplaceView.jsx";
import ShopView from "./components/ShopView.jsx";

// Phase 1 smoke-test shell: proves CLAUDE.md's "single highest-
// leverage change" actually works end-to-end in a real browser --
// Shield session, then a VCoin balance genuinely fetched from the
// ledger service, not localStorage.
// Phase 2 adds Publishing (PublishingView), Phase 3 Marketplace
// (MarketplaceView), Phase 9 completed CLAUDE.md's original 5-tab
// analog mode (Shop, Marketplace, Publishing, VEX, VADO).
//
// **Split note (Phase 10)**: DEGVCHI, the walkable world, and CHOPZ
// District moved out to their own project, `../vdp/` -- per explicit
// instruction, VENVS is the real, analog/physical commerce layer
// only; VDP is the real, digital/virtual layer (land ownership,
// avatar economy, the walkable world). They were never meant to be
// one blended app. VDP's own WorldView embeds this app's Publisher
// view via a real `<iframe>` when a player walks into that building,
// pointed at the real `?view=` route this phase adds below -- not a
// shared component instance, since the two are genuinely separate
// processes/origins now.
//
// **VEX/VADO removed (Phase 12)**: this app's own `vex.js`/`vado.js`
// (a generic trading floor + auction gallery, CLAUDE.md §4's original
// 5-tab list) and their 2 tabs are gone, per direct instruction.
// VOKEN independently built its own, separately-real `vex.js`/
// `vadoExplore.js` two days later (real brokerage trading + auctions
// of actual Culture Card editions) under the same names -- checked
// directly via git history, not assumed: neither codebase ever
// referenced the other, these were never one feature "moved," they
// were built twice. VOKEN is now the single canonical home for both;
// VDP's own VEX/VADO districts render real clients of VOKEN's API
// directly (see `../vdp/src/lib/world.js`'s own header), no longer
// iframing into this app at all. This is a real, deliberate
// deviation from CLAUDE.md §4's original 5-tab spec, flagged here
// rather than silently reconciled -- the same kind of later,
// more-specific instruction overriding an earlier general spec that
// VXLLAGE's own Village District already established as this
// project's precedent.

// `view` reads from the URL's `?view=` query param so VDP's iframe
// can deep-link directly to Publisher; with no param, this renders
// VENVS's own real tab switcher.

const SEED_CATALOG = (catalog) => {
  publishBook(catalog, {
    title: "Cherokee St After Dark",
    authorId: "author-1",
    format: "ebook",
    listPrice: 5.99,
    deliveryFee: 0.15,
  });
  publishBook(catalog, {
    title: "An Existing Backlist Title",
    authorId: "ingram-catalog",
    format: "ebook",
    listPrice: 8.99,
    source: "ingram",
  });
  return catalog;
};

const SEED_SHOP = (shop) => {
  listProduct(shop, { title: "VENVS Branded Mug", price: 14.99, category: "merch" });
  listProduct(shop, { title: "VENVS Founders Hoodie", price: 48.0, category: "apparel" });
  return shop;
};

const TABS = [
  { id: 'shop', label: 'Shop' },
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'publisher', label: 'Publishing' },
];

function readViewFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('view');
  return TABS.some((t) => t.id === requested) ? requested : null;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [vcoinBalance, setVcoinBalance] = useState(null);
  const [vashBalance, setVashBalance] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [catalog] = useState(() => SEED_CATALOG(createCatalog()));
  const [shop] = useState(() => SEED_SHOP(createShop()));

  // A deep-linked `?view=` (VDP's iframe embed use case) locks the tab
  // bar to that one view and hides chrome that doesn't make sense
  // inside a small embedded frame; with no param, this is real,
  // standalone VENVS with a real tab switcher, defaulting to Shop.
  const embeddedView = readViewFromUrl();
  const [activeTab, setActiveTab] = useState(embeddedView || TABS[0].id);
  // Real bug this session already found and fixed once (Phase 8,
  // before this Phase 10 rewrite dropped it by omission) --
  // React's setState bails out of re-rendering when the new value is
  // Object.is-identical to the old one. A non-money action (VADO's
  // real bidding, before an auction closes) never changes VCoin, so
  // refreshBalances alone never gives React a reason to re-render, and
  // a real, correctly-mutated store update can silently never reach
  // the DOM. `tick` always changes on every call, forcing the real
  // re-render regardless of whether the balance itself changed.
  const [tick, setTick] = useState(0);

  const refreshBalances = useCallback(async (userId) => {
    const [vcoin, vash] = await Promise.all([getVCoinBalance(userId), getVashBalance(userId)]);
    setVcoinBalance(vcoin.balance);
    setVashBalance(vash.vashBalance);
  }, []);

  const notifyStateChange = useCallback(async () => {
    setTick((t) => t + 1);
    if (session) {
      await refreshBalances(session.userId);
    }
  }, [session, refreshBalances]);

  useEffect(() => {
    // Real cross-origin SSO handoff: a session token riding along on
    // the URL (attached by vaco-shell's own launcher) takes priority
    // over any session already stored locally -- a real user clicking
    // in from the Shell should land as themselves, not whoever last
    // used this browser. Falls back to the normal stored-session check
    // if there's no token, or if the token turns out to be invalid.
    const params = new URLSearchParams(window.location.search);
    const handoffToken = params.get("shieldToken");

    const adoptOrRestore = handoffToken
      ? adoptToken(handoffToken).then((adopted) => {
        if (adopted) {
          // Real, deliberate cleanup: the token doesn't need to keep
          // living in the visible address bar once it's been adopted
          // into this origin's own session storage.
          params.delete("shieldToken");
          const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
          window.history.replaceState({}, "", cleanUrl);
          return adopted;
        }
        return getCurrentSession();
      })
      : getCurrentSession();

    adoptOrRestore.then((existing) => {
      if (existing) {
        setSession(existing);
        refreshBalances(existing.userId).catch((err) => setError(err.message));
      }
    });
  }, [refreshBalances]);

  const handleLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      const newSession = await login("demo-user");
      setSession(newSession);
      await refreshBalances(newSession.userId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    logout();
    setSession(null);
    setVcoinBalance(null);
    setVashBalance(null);
  };

  const handleCashOut = async () => {
    setBusy(true);
    setError(null);
    try {
      await cashOutToVash({ userId: session.userId, vcoinAmount: 100 });
      await refreshBalances(session.userId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 32, maxWidth: 480 }}>
      {!embeddedView && (
        <>
          <h1>VENVS</h1>
          <p style={{ color: "#666" }}>Analog commerce — Shop, Marketplace, Publishing, VEX, VADO. Wallet wired to V3, auth wired to Shield.</p>
        </>
      )}

      {!session && (
        <button onClick={handleLogin} disabled={busy}>
          {busy ? "Logging in…" : "Log in (Shield session)"}
        </button>
      )}

      {session && (
        <div>
          {!embeddedView && (
            <>
              <p>
                Signed in as <strong>{session.userId}</strong> via Shield session.
              </p>
              <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 12 }}>
                <div>VCoin balance: <strong>{vcoinBalance ?? "…"}</strong></div>
                <div>VASH balance: <strong>{vashBalance ?? "…"}</strong></div>
              </div>
              <button onClick={handleCashOut} disabled={busy}>
                {busy ? "Working…" : "Cash out 100 VCoin → VASH"}
              </button>{" "}
              <button onClick={handleLogout}>Log out</button>

              <div style={{ display: 'flex', gap: 4, marginTop: 16, marginBottom: 8, borderBottom: '1px solid #ddd' }}>
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    style={{
                      padding: '6px 12px',
                      border: 'none',
                      borderBottom: activeTab === t.id ? '2px solid #333' : '2px solid transparent',
                      background: 'transparent',
                      fontWeight: activeTab === t.id ? 'bold' : 'normal',
                      cursor: 'pointer',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {activeTab === 'shop' && <ShopView session={session} shop={shop} onPurchase={notifyStateChange} />}
          {activeTab === 'marketplace' && <MarketplaceView session={session} onPurchase={notifyStateChange} />}
          {activeTab === 'publisher' && <PublishingView session={session} catalog={catalog} onPurchase={notifyStateChange} />}
        </div>
      )}

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </div>
  );
}
