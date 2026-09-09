# VASH — Banking-as-a-Service & VCoin Advancement (v1)

VASH — real Banking-as-a-Service (BaaS) technology.

Real current providers (2026): Gemba (UK, FCA-authorized), M2P Fintech
(processes $50B+ annually across 300+ banks), ConnectPay (Licensed EMI,
EU/SEPA/SWIFT), Unit, Solaris, Velmie. Real market size: BaaS
projected to exceed $75 billion by 2030, growing ~17% annually.

Key finding — potential real reduction to V3's compliance cost: BaaS
providers offer a "regulatory liability shield" — the provider assumes
full compliance responsibility (KYC/AML, transaction monitoring,
reporting) under their existing banking license. This could meaningfully
reduce the Money Transmitter Licensing cost already documented at
$50,000-300,000, since VASH could operate under a BaaS partner's
regulatory umbrella instead of independent state-by-state licensing.

Action item: get real, direct confirmation from a fintech attorney on
how this applies to VASH's structure before assuming it replaces the
MTL cost — real and worth pursuing, needs professional confirmation.

Real capabilities unlocked: multi-currency accounts with dedicated
IBANs, real debit card issuance, real-time payment rails, lending
infrastructure — off-the-shelf, directly enabling VASH's "full
fintech, not a charm" goal.

VCoin — real technology path forward: a tokenized currency built on
real, established stablecoin infrastructure (Circle's USDC and similar
frameworks are the proven precedent) — real, auditable backing and
interoperability while remaining entirely distinct from a public
cryptocurrency for compliance purposes.

Connection to VACA: natural meeting point between VACA's blockchain
identity layer and VCoin's currency layer.

---

## Implementation status (added when this file was placed into the repo)

**Correctly, entirely a vendor-selection document — nothing here is
code, and nothing here should be.** Every item above requires a
commercial relationship that does not exist: a BaaS contract, a
banking partner, a fintech attorney's opinion. This file is placed in
`v3/` because VASH lives in `v3/lib/vash.js`, so the research sits
next to the thing it is about.

**What VASH actually is today.** `v3/lib/vash.js` is 47 lines. It
holds a per-user VASH balance and a single operation — `cashout`,
converting VCoin to VASH at a fixed rate. There is no account, no
IBAN, no card, no payment rail, no external money movement of any
kind. VASH balances are numbers in a JSON file.

That is not a criticism; it is the honest scale of the gap between
this document and the code. Everything the BaaS section describes —
multi-currency accounts, card issuance, real-time rails — is the
*entire* product, not an enhancement to an existing one.

**One real, findable thing this document should change today.** The
conversion rate:

```js
const VCOIN_TO_VASH_RATE = 0.01; // inferred, not specified anywhere -- flagged
```

That comment is accurate and has been carried, deliberately flagged,
since the original mock backend. It was never a decision — it was a
value inferred from a prototype and preserved rather than silently
promoted to canon. **A BaaS partnership forces this to become a real
number**, because at that point VASH is denominated in actual
currency and the rate stops being an internal accounting fiction. Worth
knowing that this decision is coupled to the vendor decision, not
independent of it.

**On the MTL cost claim — flagged as unverifiable here, not
dismissed.** The "$50,000-300,000 already documented" figure has no
source in this repo: searched for "money transmitter",
"Banking-as-a-Service", and "banking as a service" across every `.md`
and `.js` file — zero matches outside this file. The cost may well be
documented somewhere outside this repo, but it cannot be
cross-checked from here, so it should be treated as an input to
verify with the attorney rather than a settled baseline.

The document's own instinct is right and is the most important line in
it: **get the attorney opinion before assuming the BaaS umbrella
replaces MTL.** Whether a platform sits behind a partner bank's
license or is itself a money transmitter turns on facts about flow of
funds and who holds customer money — it is genuinely fact-specific and
not something to conclude from vendor marketing.

**On the VCoin/stablecoin path — a real architectural tension worth
naming now.** "Entirely distinct from a public cryptocurrency for
compliance purposes" and "built on established stablecoin
infrastructure" pull against each other. USDC *is* a public
cryptocurrency; building on it means inheriting its rails, not
avoiding them. There is a coherent middle position — a closed-loop
balance that is *backed* by reserves audited the way a stablecoin's
are, without being a transferable on-chain token — and that is
probably what is meant. Worth stating explicitly before a vendor
conversation, because the two readings lead to very different
products and very different regulatory postures.

Today VCoin is closed-loop: `v3/lib/vcoin.js` moves balances between
user IDs inside one JSON store. Nothing leaves the system. That is
the compliance-simplest starting point and there is no rush to
complicate it.

**On "connection to VACA" — the connection is thinner than it
reads.** VACA is a separate app in this repo (`vaca/`), not a layer
inside V3, and it does no cryptographic identity work: it records
human review decisions about claims (`submitVerification` →
`approveVerification`/`rejectVerification`) and exposes the results.
There is real per-app consumption of those results — VOKEN, VOID, and
CVNVO all query VACA — but no blockchain, no wallet, no verifiable
credential. So "VACA's blockchain identity layer" describes an
intention, not an implementation. See
`vaca/VACA_BLOCKCHAIN_IDENTITY_COMPARABLES.md` for the full picture.

**Nothing in this document was built, and that is the right
outcome.** Every item is correctly out of scope per
`V3_FIRST_PROMPT.md`'s own explicit deferral of "sponsor bank/BaaS
integration" and "KYC/AML vendor." Recorded here so the research is
not lost when the vendor conversation actually happens.
