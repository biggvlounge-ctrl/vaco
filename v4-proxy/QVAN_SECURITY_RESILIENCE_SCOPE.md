# QVAN — Security & Resilience Scope (v1)

Extends QVAN's existing mandate (bot detection, code security review,
content moderation) with business continuity/disaster recovery and
post-quantum cryptography readiness.

## 1. Business Continuity & Disaster Recovery (BCDR)

Real established platforms: Veeam, Druva, Rubrik, Cohesity, Zerto.
**ControlMonkey** is a newer, important addition specifically for
backing up *infrastructure configuration* (DNS, CDN, identity,
network, SaaS settings), not just data.

**The 3-2-1-1-0 rule**: three copies of critical data, two different
storage media types, one copy off-site, one copy offline/air-gapped,
zero unverified backups. Every real plan defines RTO (Recovery Time
Objective) and RPO (Recovery Point Objective).

**Honest limit**: multi-region/multi-cloud redundancy protects against
a regional/provider outage, not a true total loss of the internet — a
real, honest boundary.

**DREAMS-specific**: physical screens should have a real local
fallback — cached ad content during a brief connectivity loss, rather
than going blank.

**Real cost**: enterprise DR runs $100-500/user/month at large scale;
at VACO's current stage, a basic Veeam/Druva tier or native AWS/Azure
backup tools realistically costs $50-500/month total, not per-user.

## 2. Post-Quantum Cryptography (PQC) readiness

**The real threat**: "harvest now, decrypt later" — data encrypted
today can be captured now and decrypted once quantum computers mature
(projected 2033-2037). Cloudflare, Google, and Apple have already
deployed post-quantum key exchange to billions of real users.

**Real finalized NIST standards (August 2024)**: FIPS 203 (ML-KEM),
FIPS 204 (ML-DSA), FIPS 205 (SLH-DSA). Standard algorithms (RSA-2048,
ECC P-256) phased out starting 2030, fully disallowed by 2035.

**Direct relevance to VACO**: VACA (blockchain identity) relies on
quantum-vulnerable public-key signatures. V3 (financial ledger)
requires long-term confidentiality, making it a real "harvest now,
decrypt later" target.

**Recommendation**: build crypto-agility now — architect V3 and VACA's
cryptographic layer so the algorithm is a **configuration setting, not
hardcoded**. Migrates via config change later; hardcoded requires a
full rewrite. Cheap now, expensive to retrofit.

---

## Implementation status (added when this file was placed into the repo)

**What's real**: QVAN exists as a real agent in `vacon/lib/agents.js`
(`id: 'qvan'`, Chief Security Officer), and this document visibly
shaped it — QVAN's own system prompt covers "disaster recovery" and
"zero-trust security" and names **Rubrik, Cohesity, Zerto** from the
BCDR list above. That is a genuine trace of this document in working
code, even though the file itself was never saved here until now.

**What is not code, and correctly so**: BCDR is an infrastructure and
operations decision — backup tooling, RTO/RPO targets, and the
3-2-1-1-0 rule are things you buy and configure, not things this
repo implements. Same for the cost figures.

**The one genuinely actionable software item, not done**:
crypto-agility in V3 and VACA. Checked directly — neither app has a
cryptographic algorithm layer at all today (V3 is a real ledger over
plain JSON persistence; VACA records verification decisions without
real signature verification). So there is nothing hardcoded to
retrofit *yet*, which is precisely why the recommendation is cheap
right now: the first time a real signing/encryption layer is added to
either, the algorithm should be a config value from day one rather
than a literal. Recorded here so that decision isn't missed when it
arrives.

**Correction, 13 Nov 2026 — doc-vs-code reconciliation.** This is now
done, in both apps, and cites this exact section as its source.
Checked directly: `v3/lib/cryptoAgility.js` and `vaca/lib/
cryptoAgility.js` both exist, both quote this section's own
recommendation verbatim in their header, and both implement it as
written — a named algorithm registry (classical: `ed25519`,
`ecdsa-p256`; post-quantum: `ml-dsa-65`/FIPS 204 and
`ml-kem-768`/FIPS 203, marked `available: false` since Node 22 does
not ship them, rather than silently faked or downgraded) resolved from
configuration at call time, with the rule that nothing in either app
calls a crypto primitive directly. The "nothing hardcoded to retrofit
yet" framing was accurate at the time and is the reason this was cheap
to do before either app had a real signing layer to migrate.

**DREAMS local fallback** — also not built. `dreams/` has no offline
content cache; a screen losing connectivity has no defined behavior.
Real, small, and genuinely worth doing before any physical screen is
deployed.

**Correction, 13 Nov 2026 — doc-vs-code reconciliation.** This is now
built, and cites this exact document as its source. Checked directly:
`dreams/lib/offlineCache.js` exists, its own header quotes this
section's own line ("physical screens should have a real local
fallback — cached ad content during a brief connectivity loss, rather
than going blank") as its source of truth, and it is wired into real
routes in `dreams/server.js` (`GET /api/screens/:id/offline-content`,
`POST /api/screens/:id/offline-plays`, `GET /api/offline-plays`).
Honestly scoped the same way this document is: the server decides
which creatives a screen should cache and records what played while
offline (billed with `wasOffline: true` rather than silently folded
into live impressions); the actual on-device caching happens on
hardware that does not exist in this repo, same split this document's
own BCDR section draws between what this repo implements and what you
buy and configure.
