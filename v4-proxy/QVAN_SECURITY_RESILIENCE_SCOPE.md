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

**DREAMS local fallback** — also not built. `dreams/` has no offline
content cache; a screen losing connectivity has no defined behavior.
Real, small, and genuinely worth doing before any physical screen is
deployed.
