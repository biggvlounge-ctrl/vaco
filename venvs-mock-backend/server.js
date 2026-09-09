// VENVS mock backend — stands in for two real, separate VACO
// ecosystem services that VENVS's own CLAUDE.md (§0) says VENVS
// should be a client of, not reimplement: V3 (the canonical VCoin/
// VASH ledger) and Shield (the ecosystem-wide session/auth layer).
//
// Neither V3's real source nor Shield's real source exists anywhere
// in this session, and V3's exact API surface is only referenced in
// VENVS's brief ("see V3's CLAUDE.md for the exact API surface") —
// that document wasn't provided. The routes below are therefore a
// real, working, but INFERRED contract, not a copy of a real spec.
// Combined into one process for now purely to keep this session's
// scope manageable; in the real ecosystem these are two distinct
// services VENVS depends on, not one.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl -X POST http://localhost:8791/api/shield/session -H "Content-Type: application/json" -d '{"userId":"u1"}'
//   curl http://localhost:8791/api/vcoin/balance/u1

import express from "express";
import cors from "cors";
import "dotenv/config";

import tracingModule from "./lib/tracing.cjs";
const { traceMiddleware } = tracingModule;

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());


const PORT = process.env.PORT || 8791;

// --- In-memory state (mock only — a real V3/Shield would persist) ---
const balances = new Map(); // userId -> vcoin balance
const vashBalances = new Map(); // userId -> vash balance
const transactions = []; // vcoin transfer log
const sessions = new Map(); // token -> { userId, expiresAt }

const STARTING_VCOIN_BALANCE = 1000;
const VCOIN_TO_VASH_RATE = 0.01; // inferred, not specified anywhere -- flagged

function getBalance(userId) {
  if (!balances.has(userId)) {
    balances.set(userId, STARTING_VCOIN_BALANCE);
  }
  return balances.get(userId);
}

function getVashBalance(userId) {
  return vashBalances.get(userId) || 0;
}

// --- Shield session contract (inferred) ---

app.post("/api/shield/session", (req, res) => {
  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: "'userId' is required." });
  }
  const token = `shield_${userId}_${Date.now()}`;
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24; // 24h
  sessions.set(token, { userId, expiresAt });
  res.status(201).json({ sessionToken: token, userId, expiresAt });
});

app.get("/api/shield/session/:token", (req, res) => {
  const session = sessions.get(req.params.token);
  if (!session || session.expiresAt < Date.now()) {
    return res.status(404).json({ valid: false });
  }
  res.json({ valid: true, userId: session.userId, expiresAt: session.expiresAt });
});

// --- V3 VCoin contract (inferred) ---

app.get("/api/vcoin/balance/:userId", (req, res) => {
  const { userId } = req.params;
  res.json({ userId, balance: getBalance(userId) });
});

app.post("/api/vcoin/transfer", (req, res) => {
  const { fromUserId, toUserId, amount, reason = null } = req.body || {};
  if (!fromUserId || !toUserId) {
    return res.status(400).json({ error: "'fromUserId' and 'toUserId' are required." });
  }
  if (typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ error: "'amount' must be a positive number." });
  }
  const fromBalance = getBalance(fromUserId);
  if (fromBalance < amount) {
    return res.status(400).json({ error: "Insufficient VCoin balance." });
  }
  balances.set(fromUserId, fromBalance - amount);
  balances.set(toUserId, getBalance(toUserId) + amount);

  const tx = {
    id: transactions.length + 1,
    fromUserId,
    toUserId,
    amount,
    reason,
    timestamp: Date.now(),
  };
  transactions.push(tx);
  res.status(201).json({
    transaction: tx,
    fromBalance: balances.get(fromUserId),
    toBalance: balances.get(toUserId),
  });
});

app.get("/api/vcoin/transactions/:userId", (req, res) => {
  const { userId } = req.params;
  const userTxs = transactions.filter((t) => t.fromUserId === userId || t.toUserId === userId);
  res.json({ userId, transactions: userTxs });
});

// --- V3 VASH contract (inferred) ---

app.post("/api/vash/cashout", (req, res) => {
  const { userId, vcoinAmount } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: "'userId' is required." });
  }
  if (typeof vcoinAmount !== "number" || vcoinAmount <= 0) {
    return res.status(400).json({ error: "'vcoinAmount' must be a positive number." });
  }
  const currentVcoin = getBalance(userId);
  if (currentVcoin < vcoinAmount) {
    return res.status(400).json({ error: "Insufficient VCoin balance for cashout." });
  }
  const vashAmount = Math.round(vcoinAmount * VCOIN_TO_VASH_RATE * 100) / 100;
  balances.set(userId, currentVcoin - vcoinAmount);
  vashBalances.set(userId, getVashBalance(userId) + vashAmount);

  res.status(201).json({
    userId,
    vcoinDeducted: vcoinAmount,
    vashCredited: vashAmount,
    rate: VCOIN_TO_VASH_RATE,
    newVcoinBalance: balances.get(userId),
    newVashBalance: vashBalances.get(userId),
  });
});

app.get("/api/vash/balance/:userId", (req, res) => {
  const { userId } = req.params;
  res.json({ userId, vashBalance: getVashBalance(userId) });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, mock: true, standsInFor: ["V3 ledger", "Shield session"] });
});

app.listen(PORT, () => {
  console.log(`VENVS mock backend (V3 + Shield stand-in) listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
