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

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 32, maxWidth: 480 }}>
      <h1>VDP</h1>
      <p style={{ color: "#666" }}>Digital Planet — the walkable, virtual layer. Wallet wired to V3, auth wired to Shield.</p>

      {/*
        **Exit, per `VDP_SHELL_EXIT_FLOW_RESOLUTION.md` -- but the
        mechanism that document names does not exist.** It says every
        Shell app screen "already receives a standard onBack handler"
        and quotes `setScreen("hub")`. `vaco-shell` has no JSX and no
        React at all: it is an Express app whose `public/index.html`
        launches each app into a *new tab* (`target = '_blank'`, with
        the Shield token on the query string). There is no component
        tree for an onBack prop to travel through, and that quoted line
        exists nowhere in this repo.

        The document's instruction still stands and is followed here:
        use the ecosystem's standard exit rather than inventing one.
        The standard that actually exists is `vaco-ui.js`'s masthead
        brand link home -- `brand.href = VACO.SHELL_URL`, titled "Back
        to the VACO app store". VDP is deliberately outside
        `sync-design-system.sh`'s targets (a Vite app whose assets live
        elsewhere), so it does not inherit that masthead and needs the
        same link built directly. This is that link, and it is the same
        contract, not a bespoke one.
      */}
      <p style={{ margin: "0 0 16px" }}>
        <a href={SHELL_URL} title="Back to the VACO app store" style={{ color: "#555", fontSize: 13 }}>
          ← Back to the VACO app store
        </a>
      </p>

      {!session && (
        <button onClick={handleLogin} disabled={busy}>
          {busy ? "Logging in…" : "Log in (Shield session)"}
        </button>
      )}

      {session && (
        <div>
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

          <WorldView session={session} degvchiStore={degvchiStore} foodDistrictStore={foodDistrictStore} onPurchase={notifyStateChange} />
          <ChopzView session={session} onPurchase={notifyStateChange} />
        </div>
      )}

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
    </div>
  );
}
