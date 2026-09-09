# Tasks — Phase 1: Scaffold + wallet/auth wiring

- [x] Create `venvs-mock-backend/`: `server.js` (Shield session +
      V3 VCoin/VASH contract), `package.json`, `.env.example`,
      `.gitignore`.
- [x] Verify the mock backend live via `curl` (15 checks):
      - `/api/health` reports itself as a mock standing in for V3 +
        Shield.
      - Session issue rejects missing `userId`; issues and validates a
        real token; an invalid token correctly reports `valid: false`.
      - New user's VCoin balance starts at 1000.
      - Transfer rejects missing/non-positive `amount` and insufficient
        balance; a real 250-VCoin transfer correctly updates both
        sides' balances and appears in transaction history.
      - Cashout rejects insufficient balance; a real 500-VCoin cashout
        correctly computes 5.00 VASH at the 0.01 rate and updates both
        balances.
- [x] Create `venvs/`: Vite + React 18 scaffold (`package.json`,
      `vite.config.js`, `index.html`, `src/main.jsx`).
- [x] Create `src/lib/v3Client.js`, `src/lib/shieldAuth.js`,
      `src/lib/persistence.js`.
- [x] Create `src/App.jsx`: Phase 1 smoke-test shell (login, real
      balance display, real cashout button, logout).
- [x] `npm install` in both `venvs-mock-backend/` and `venvs/`.
- [x] Verify live in a real browser (Playwright + the environment's
      pre-installed Chromium, installed temporarily in scratchpad —
      not part of the repo):
      - Page renders with the correct title.
      - Login button present before login; clicking it produces a
        real Shield session and displays "Signed in as demo-user."
      - VCoin balance renders as 1000 (fetched from the mock, not
        hardcoded) and VASH as 0 — screenshotted.
      - Clicking "Cash out" triggers a real `POST
        /api/vash/cashout` (confirmed via captured network
        responses), correctly drops VCoin to 900 and raises VASH to 1
        — screenshotted.
      - **Caught and fixed a bug in the verification script itself**:
        first pass asserted VASH would be 5 after a 100-VCoin cashout
        (a stale expectation copied from an earlier 500-VCoin `curl`
        test); the correct value at the 0.01 rate is 1. Confirmed via
        live network response inspection that the app and backend
        were both correct before concluding the test assertion was
        wrong, not the code.
      - Logout correctly returns to the login screen.
      - No unexpected console/page errors (one harmless favicon 404).
- [x] Shut down both dev processes cleanly; confirmed via follow-up
      `curl` that neither port accepts connections anymore.
- [x] Commit as its own change.

## Next
Analog-mode Shop/Marketplace/Publishing/VEX/VADO and the digital-mode
walkable world are next, not started here. The 3 new feature docs
(Shopify integration, Publishing addition with the Ingram Content
Group catalog path, Digital Planet comparables for DEGVCHI's avatar
economy) all land inside the Marketplace/Publishing/Fashion District
work specifically, once that phase starts.
