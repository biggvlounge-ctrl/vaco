import { useState, useEffect, useCallback } from "react";
import { login, getCurrentSession, logout, adoptToken } from "./lib/shieldAuth.js";
import { getVCoinBalance, cashOutToVash, getVashBalance } from "./lib/v3Client.js";
import { createDegvchi, registerWearable } from "./lib/degvchi.js";
import { seedSvmikoDegvchiWearables } from "./lib/svmikoDegvchiWearables.js";
import { createFoodDistrict } from "./lib/foodDistrict.js";
import { seedDemoData } from "./lib/seedDemoData.js";
import WorldView from "./components/WorldView.jsx";
import ChopzView from "./components/ChopzView.jsx";

// Where "exit VDP" goes. Same target as every other app's masthead
// brand link -- see the note at the render site below.
const SHELL_URL = import.meta.env.VITE_SHELL_URL || "http://localhost:8789";

// VDP — the digital, virtual layer of the VACO ecosystem (land
// ownership, avatar economy, the walkable world), split out of VENVS
// (the analog commerce layer) per explicit instruction: two real,
// distinct systems sharing V3/Shield infrastructure, not one blended
// app. See `../venvs/README.md` and this project's own README for the
// full split rationale.
//
// This shell mirrors VENVS's own Phase 1 smoke-test shape (real
// Shield login, real V3 balances) since both apps are real, separate
// clients of the same shared infrastructure -- not because the code
// is shared. WorldView renders the walkable world; walking into a
// VENVS-owned district (VEX/VADO/Publisher) embeds VENVS's own,
// separately-running app via a real iframe. Fashion District (DEGVCHI)
// and CHOPZ District are VDP's own native content, standalone below
// the world for now -- CHOPZ was never placed in the world's district
// grid even before the split (a real, pre-existing gap, not
// introduced here).

const SEED_DEGVCHI = (store) => {
  registerWearable(store, { name: "Sunset Glow Palette", category: "cosmetics", price: 12, creatorId: "elf-cosmetics-brand", sponsor: "e.l.f. Cosmetics" });
  registerWearable(store, { name: "DEGVCHI Signature Jacket", category: "clothing", price: 25, creatorId: "degvchi-original" });
  registerWearable(store, { name: "Chrome Chain", category: "accessories", price: 8, creatorId: "degvchi-original" });
  // Real SVMIKO DEGVCHI house wearables (13 real sub-brands), appended
  // after the original 3 demo fixtures -- additive, not a replacement,
  // the same posture VENVS's own Marketplace seeding took.
  seedSvmikoDegvchiWearables(store);
  return store;
};

export default function App() {
  const [session, setSession] = useState(null);
  const [vcoinBalance, setVcoinBalance] = useState(null);
  const [vashBalance, setVashBalance] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [degvchiStore] = useState(() => SEED_DEGVCHI(createDegvchi()));
  // Food District's own menu data is static (FLAGSHIP_BRANDS), not
  // seeded into the store the way DEGVCHI's wearables are -- only real
  // orders live in this store.
  const [foodDistrictStore] = useState(() => createFoodDistrict());
  // Real bug this session already found and fixed once, in VENVS's own
  // App.jsx before the VDP split (and re-introduced here by omission
  // when this shell was written fresh) -- React's setState bails out
  // of re-rendering when the new value is Object.is-identical to the
  // old one. Equipping a wearable doesn't touch VCoin, so
  // refreshBalances alone never changes anything React can see, and a
  // real, correctly-mutated store update silently never reaches the
  // DOM. `tick` always changes on every call, forcing the real
  // re-render regardless of whether the balance itself changed.
  const [tick, setTick] = useState(0);

  // Real seed/demo data for the live walkthrough — sample Food
  // District orders and sample DEGVCHI avatars, via the real
  // order/purchase/equip functions (see `lib/seedDemoData.js`'s own
  // header). Runs once at boot; each half is internally guarded by a
  // real empty-array check, so it never double-seeds a store that
  // already has real data.
  useEffect(() => {
    seedDemoData({ foodDistrictStore, degvchiStore }).catch((err) => {
      console.warn("seedDemoData failed:", err.message);
    });
  }, [foodDistrictStore, degvchiStore]);

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

  // **The masthead, not `vaco-ui.js`'s.** Every server-rendered app in
  // the register gets its masthead from `VACO.app()`'s DOM-manipulating
  // runtime; VDP is React, and importing a script that calls
  // `document.getElementById(...).appendChild(...)` into a page React
  // also owns is how the two fight over the same nodes. So this hand-
  // builds the same markup — `.vaco-masthead`/`.vaco-brand`/
  // `.vaco-wallet`, the exact classes `vaco-design.css` defines for it
  // — as real JSX instead. Same contract, React's own rendering.
  return (
    <>
      <header className="vaco-masthead">
        <div className="vaco-container vaco-masthead-inner">
          <a className="vaco-brand" href={SHELL_URL} title="Back to the VACO app store">
            <span className="vaco-brand-mark">VDP</span>
            <span className="vaco-brand-tag">Digital Planet</span>
          </a>
          <span className="vaco-spacer" />
          {session && (
            <div className="vaco-row-tight">
              {vcoinBalance !== null && (
                <span className="vaco-wallet" title="VCoin balance, live from V3">
                  <span className="vaco-price vaco-num">{vcoinBalance}</span>
                </span>
              )}
              <span className="vaco-small vaco-dim">{session.userId}</span>
              <button className="vaco-btn vaco-btn-ghost vaco-btn-sm" onClick={handleLogout}>Sign out</button>
            </div>
          )}
        </div>
      </header>

      <main id="vaco-main" className="vaco-container">
        <div className="vaco-stack">
          <div className="vaco-row">
            <h1 className="vaco-h1">Digital Planet</h1>
          </div>
          <p className="vaco-body vaco-dim" style={{ maxWidth: "64ch" }}>
            The walkable, virtual layer — land ownership and the avatar economy. Wallet wired to V3, auth wired to Shield.
          </p>

          {!session && (
            <div className="vaco-row">
              <button className="vaco-btn vaco-btn-primary" onClick={handleLogin} disabled={busy}>
                {busy ? "Logging in…" : "Log in (Shield session)"}
              </button>
            </div>
          )}

          {session && (
            <div className="vaco-stack">
              <div className="vaco-card vaco-stack-sm">
                <div className="vaco-row-tight">
                  <span className="vaco-label">VCoin balance</span>
                  <span className="vaco-price vaco-num">{vcoinBalance ?? "…"}</span>
                </div>
                <div className="vaco-row-tight">
                  <span className="vaco-label">VASH balance</span>
                  <span className="vaco-num">{vashBalance ?? "…"}</span>
                </div>
                <div className="vaco-row">
                  <button className="vaco-btn vaco-btn-primary" onClick={handleCashOut} disabled={busy}>
                    {busy ? "Working…" : "Cash out 100 VCoin → VASH"}
                  </button>
                </div>
              </div>

              <WorldView session={session} degvchiStore={degvchiStore} foodDistrictStore={foodDistrictStore} onPurchase={notifyStateChange} />
              <ChopzView session={session} onPurchase={notifyStateChange} />
            </div>
          )}

          {error && <div className="vaco-notice vaco-notice-danger">Error: {error}</div>}
        </div>
      </main>
    </>
  );
}
