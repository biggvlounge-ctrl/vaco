# Comparables Index — every app, and where its comparables live

Built from an audit prompted by a direct question: does every service
have comparables, given that each is an app in its own right?

The answer at audit time was **no**. Nine apps had dedicated
comparables documents; the rest had passing mentions inside READMEs or
nothing at all. This index records the result and exists so the next
audit takes one command instead of a sweep.

## Coverage

| App | Comparables document | Status |
|---|---|---|
| **VOID** | `void/VOID_SERVICE_VERTICALS_COMPARABLES.md` | All **25** verticals, after this pass |
| **VOID MAGIC** | `voidmagic/VOID_MAGIC_COMPARABLES.md` | **Added this pass** |
| **VOKEN** | `voken/VOKEN_VALUE_DISPLAY_CARD_INDUSTRY_COMPARABLES.md` | Existing |
| **CVNVO** | `cvnvo/CVNVO_DATING_COMPARABLES.md` | Existing |
| **YAP** | `cvnvo/yap/YAP_REVIEW_PLATFORM_COMPARABLES.md` | **Added this pass** |
| **VAGO** | `vago/VAGO_COMPARABLES.md` | Existing |
| **VACAY** | `vacay/VACAY_COMPARABLES.md` | Existing |
| **VENVS** | `venvs/VENVS_DIGITAL_PLANET_COMPARABLES.md` | Existing |
| **CHOPZ** | `chopz/chopz-shop/CHOPZ_TIKTOK_COMPARABLES.md` | Existing |
| **VACA** | `vaca/VACA_BLOCKCHAIN_IDENTITY_COMPARABLES.md` | Existing |
| **Vvltvre Music** | `vulture-music/KICK_GAMMA_MUSIC_COMPARABLES.md` | Existing |
| **Vvltvre Pods** | `vulture-pods/VULTURE_PODS_COMPARABLES.md` | **Added this pass** |
| **Vvltvre Flix** | `vulture-flix/VULTURE_FLIX_COMPARABLES.md` | **Added this pass** |
| **Vvltvre Studios** | `vulture-studios/VULTURE_STUDIOS_COMPARABLES.md` | **Added this pass** |
| **Vavlt Stvdios** | `vavlt-stvdios/VAVLT_STVDIOS_STREAMING_COMPARABLES.md` | **Added this pass** |
| **DREAMS** | `dreams/DREAMS_DOOH_COMPARABLES.md` | **Added this pass** |
| **VXLLAGE** | `vxllage/VXLLAGE_SOCIAL_COMPARABLES.md` | **Added this pass** |
| **VENVM** | `venvm/VENVM_AI_PRODUCTION_COMPARABLES.md` | **Added this pass** |
| **VEX** | `vex/VEX_BROKERAGE_COMPARABLES.md` | **Added this pass** |
| **Vex Business** | `vex-business/packages/research/research/comparables.py` | Existing — in code, not prose |
| **HVNTZ** | `hvntz/HVNTZ_COMPLETE_REVENUE_STACK.md` | Covered inside the revenue-stack doc |

### Deliberately not covered

`v3`, `shield`, `vacon`, `v4-proxy`, `v4-search`, `vsafe`,
`vaco-shell`, `vaco-analytics`, `vdp`, `world-layer`.

These are shared infrastructure, not products with a market. A ledger,
a session service, and an agent registry do not compete with anything —
they exist so the sixteen consumer apps do not each build their own.
Writing comparables for them would be filling in a template rather than
answering a question. Recorded here so their absence reads as a
decision.

## What the audit actually found

**VOID was covered 23 of 25.** The document was written when VOID had
24 verticals and still says so in its opening paragraph.

- `realEstateMedia` — **false alarm**. Genuinely covered, in
  `VOID_MOVING_REAL_ESTATE_MEDIA.md` (HomeJab), just never
  cross-referenced. Auditing the comparables file alone reported it
  missing. Cross-referenced now.
- `foodDelivery` — **a real gap**. The Meituan document covers
  super-app structure, which is a different question from what a US
  food delivery vertical competes against. Filled in with DoorDash,
  Uber Eats, Grubhub, and Instacart.

That split — one false alarm, one real gap — is the reason this index
exists. Comparables were scattered across differently-named documents,
so no single grep answered the question.

## Recurring findings across the new documents

Three patterns showed up independently while writing these, which is
usually a sign they are real rather than artifacts of one analysis:

1. **The take rates are defensible, and mostly for the same reason.**
   VOID MAGIC at 15.5% undercuts Cameo, Vavlt Stvdios at 80/20 beats
   Twitch, Vvltvre Pods at 10% sits with Patreon rather than Apple, and
   VOID's flat 20% avoids Thumbtack's pay-per-lead and Upwork's
   pay-to-bid. The shared justification is that these apps do not carry
   the cost bases their competitors do — talent acquisition, logistics,
   and payments are shared infrastructure. That is a genuine structural
   argument, and it holds only as long as the sharing does.

2. **The real-time media gap bounds four apps at once.** Vavlt Stvdios,
   Vvltvre Flix, VOID MAGIC, and V4's call surfaces all model the
   economics of something they cannot yet transport. Every comparable
   in those four categories solves it with substantial infrastructure
   or a vendor. That is task #106, and it is the single most
   leveraged missing piece in the ecosystem.

3. **Two items belong with Deskins, not with engineering.** YAP is the
   highest-liability product here by a wide margin — the direct
   analogue is in active defamation litigation. And Vvltvre Studios
   accepts project investment with no compliance gate, while VOKEN
   cannot sell a fractional share without clearing one. Whether those
   are genuinely different instruments is a legal question. Both are
   flagged rather than decided.

## Re-running this audit

VOID's verticals are the part most likely to drift, since they live in
code:

```sh
# every vertical in code
grep -oP "^  \K\w+(?=: \{ name:)" void/lib/verticals.js

# check each against the comparables document by display name
```

`void/test/licensingGates.test.js` pins the vertical table itself —
a vertical added without an explicit `licensingGated` boolean fails a
test. There is no equivalent test for comparables coverage, because a
research obligation is not a code invariant. This index is the manual
check.
