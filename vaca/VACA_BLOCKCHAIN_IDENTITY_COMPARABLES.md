# VACA — Blockchain Identity Comparables (v1)

VACA is V3's blockchain identity layer. Grounds it in real, current
decentralized identity (DCI) platforms and standards.

Real category: Decentralized Identity (DCI) — decentralizes storage
and use of identity data. Built from four components: a trust fabric
(distributed ledger/blockchain), a digital wallet, Verifiable
Credentials (cryptographically secured, tamper-proof identity
attributes), Decentralized Identifiers (pseudonymous identifiers for
issuing/verifying claims without a central authority).

Core value: a credential gets issued once, stored in the user's own
wallet, reused across systems — eliminating redundant identity checks.

Real platforms: Veriff (fastest, best compliance footprint at scale),
Civic (open standards, no vendor lock-in), Onfido (KYC-coupled),
Dock/Dock Certs (no-code credential issuance), BlockID Verify
(biometrics + government ID + liveness detection), Hyperledger Indy
(public blockchain for identity, used by real government programs).

Direct relevance to VACA: its real job is to be VACO's own trust
fabric + wallet + credential layer — a user verifies identity once,
and that becomes a reusable credential every other VACO app can check
against, rather than each app (HVNTZ, VAGO, CVNVO, VOKEN) running its
own separate verification. Same "shared infrastructure, don't
duplicate" principle already applied to V3, V4, DREAMS, VOID, Vavlt
Stvdios.

Open item: on-chain identity verification is "immature but shipping"
— the category moves fast. Whichever platform VACA integrates with
should be revisited close to actual implementation time, not locked in
now.

---

## Implementation status (added when this file was placed into the repo)

**VACA is built and genuinely in use — but it is not a blockchain
identity layer, and the difference matters for anyone planning
against this document.** Two corrections up front, both checked
directly against the code.

**Correction 1: VACA is not "V3's identity layer" — it is a separate
app.** `vaca/` is its own service on port 8804, with its own store,
its own persistence, and its own `server.js`. V3 (`v3/`) holds VCoin
and VASH only. The original design did put VACA inside V3 (see
`v3/V3_FIRST_PROMPT.md`, which describes four layers sharing one
ledger object); it was split out. Anything written against "VACA
inside V3" is describing a structure that no longer exists.

**Correction 2: none of the four DCI components are present.** Not one:

| Component | Status in `vaca/` |
|---|---|
| Trust fabric (distributed ledger) | Not present — state is a JSON file, `vaca/data/store.json` |
| Digital wallet | Not present — no user-held anything |
| Verifiable Credentials | Not present — no cryptographic issuance, no tamper-proofing |
| Decentralized Identifiers | Not present — subject IDs are app-assigned plain strings |

**What VACA actually is, stated accurately:** a real, working
centralized attestation service. `submitVerification` records a claim
about a subject (`subjectType`, `subjectId`, `claimType`, `evidence`);
a human reviewer resolves it via `approveVerification` or
`rejectVerification`; other apps read the outcome through
`GET /api/identity-status/:subjectType/:subjectId` and
`GET /api/authenticity-grade/:subjectType/:subjectId`.

That grading is a deliberate human judgment call made at approval
time, not an auto-computed score — a design decision documented in
`vaca/lib/verifications.js` and grounded in how real KYC review and
provenance authentication houses actually work. It is the right
posture. It is also the *opposite* of decentralized: it depends
entirely on a trusted central reviewer.

**The "verify once, reuse everywhere" claim is half-true, and the
false half is the interesting one.** Real cross-app consumption
exists and was verified by direct search — three apps query VACA:

- `voken/server.js` → `/api/authenticity-grade/voken-card/:id`
- `void/server.js` → `/api/identity-status/void-provider/:id` **and**
  `/api/identity-status/void-recipient/:id`
- `cvnvo/server.js` → `/api/identity-status/cvnvo-user/:id`

VACA genuinely closed a real hole here: before it existed, VOKEN's
`POST /api/card/:id/value-score` trusted whatever `authenticityGrade`
the caller put in the request body. That is a real fix, already
shipped.

But look at the `subjectType` values: `voken-card`, `void-provider`,
`void-recipient`, `cvnvo-user`. **Every app verifies inside its own
namespace.** A person verified as a `cvnvo-user` is not thereby a
verified `void-provider` — they would submit a second, independent
verification, be reviewed again, and receive a separate record. Which
means the exact redundancy this document says VACA eliminates is
still happening; VACA centralized the *storage* of verification
results without unifying the *subject*. The shared infrastructure is
real; the shared credential is not.

Whether that is a bug is a genuine product question, not a technical
one. "Verified their government ID" and "verified as a delivery
provider in good standing" are legitimately different claims about the
same person, and collapsing them would be wrong. But "verified their
government ID for CVNVO" and "verified their government ID for VOID"
are the same claim, and today those are two records. The fix is a real
person-level subject that app-level verifications attach to — not
blockchain, just a shared identity primitive underneath the existing
namespaces.

**The one piece of PQC-relevant groundwork that is done.**
`vaca/lib/cryptoAgility.js` exists, and it is worth being precise
about what it does and does not mean. It provides config-selected
signing, verification, and hashing so that when VACA does start
signing credentials, the algorithm is an env var rather than a
literal. It does **not** mean anything in VACA is currently signed —
verification decisions today carry no signature at all. It is a
foundation placed early precisely because there was nothing to
retrofit, per `v4-proxy/QVAN_SECURITY_RESILIENCE_SCOPE.md`.

This is directly relevant to any platform choice made from this
document's list: Verifiable Credentials are cryptographically signed
by definition, so adopting VCs means VACA starts signing, which means
the algorithm choice happens then. The migration target is already
recorded (`ml-dsa-65`, FIPS 204, currently unavailable in this Node
runtime) so the decision does not have to be rediscovered.

**On the platform list — the document's own closing advice is the
right advice, and applies more strongly than it realizes.** "Revisit
close to actual implementation time, not locked in now" is correct,
and implementation time is not close: VACA would need a wallet, a
credential format, and a person-level subject model before a platform
integration would even have somewhere to plug in. The six platforms
named are real and the category framing is accurate; treat the list as
a starting point for a future evaluation rather than a shortlist to
choose from today.

**Genuinely unbuilt, recorded so it is not rediscovered:** wallet,
Verifiable Credentials, DIDs, any distributed ledger, and any external
identity-platform integration. **Genuinely built and working:** the
attestation loop, the grading scale, three real consuming apps, and
crypto-agility groundwork.
