# VOID — Compliance, Legality, and Cost Register

The category you asked to be kept as the build ran. Everything here is
**parked, not resolved** — recorded so it is a decision someone makes
deliberately rather than a surprise discovered after launch.

Nothing in this document blocks the code that exists. All 25 verticals
are built and running. These are the things that gate *operating* them.

---

## 1. Blocks launch in that vertical

Real legal barriers. The code is written and the gates are closed.

| Vertical | Requirement | Status in code |
|---|---|---|
| **Cannabis delivery** | State cannabis licence; delivery permits are separate from retail and vary by municipality. Federally illegal, so no interstate operation and severe banking limits. | `licensingGated: true` — `requestJob` refuses; `canWorkVertical` demands a verified skill **and** credential vetting. |
| **Medical transportation** | DOT and state medical-transport authority. Wheelchair and stretcher tiers carry vehicle certification. Medicaid/insurance billing is its own registration. | Same double gate. |
| **Security** | Guard licensing in most states; armed guard is a separate and stricter licence. | Credential vetting required. Not otherwise gated — **flagged: arguably should be `licensingGated`.** |
| **Notary** | A notary commission is the product. Remote online notarisation is authorised state by state. | Credential vetting required. |

**The open question here:** `security` and `notaryLegal` require
credential *vetting* but are not `licensingGated`, so `requestJob`
accepts them. Cannabis and medical transport get both. Whether that
asymmetry is right is a legal call, not an engineering one.

---

## 2. Employment classification — the largest item

**This affects all 25 verticals at once and is the single biggest legal
exposure in VOID.**

Every provider in the system is modelled as an independent contractor:
they set availability, choose jobs, and hold their own skills. That is
a deliberate design, and it is exactly the model that has been
litigated repeatedly — California AB5 and Prop 22, the UK Supreme Court
ruling against Uber, ongoing EU platform-work directives, and US
Department of Labor rule changes that have shifted more than once.

**Where VOID's own design cuts both ways:**

- *Toward contractor:* providers set their own availability windows,
  accept individual jobs, work across multiple verticals, and can hold
  skills on other platforms simultaneously. The service day is
  suggested, never assigned.
- *Toward employee:* the platform sets the take rate, controls
  matching, sets cancellation penalties, and can suspend a skill. The
  `suspendSkill` function is, in a classification argument, a
  disciplinary mechanism.

**The cross-vertical workday is genuinely novel here and cuts both
ways too.** A provider assembling a full day inside one platform looks
more like a job than three separate gigs do — while the fact that they
chose the mix themselves argues the other direction. This has no
precedent because no platform has done it.

**Parked. Needs employment counsel before real providers onboard**,
and the answer likely differs per jurisdiction. It is not a code
change; it is a business-model decision the code should then reflect.

---

## 3. Vetting, background checks, and FCRA

`serviceCommon.js` requires background checks for childcare, senior
care, and tutoring. Actually running one is regulated:

- **FCRA** governs consumer reports in the US. Running a background
  check requires disclosure, written authorisation, and — if the result
  is used adversely — a pre-adverse-action notice, a copy of the
  report, and a waiting period before final action.
- **Ban-the-box and fair-chance laws** restrict when criminal history
  may be asked about, and they vary by state and city.
- **Rechecks.** The code enforces expiry, which is the right shape.
  Whether the recheck interval is annual is a policy decision.

**Cost:** a real background check is not free — the going rate is
meaningful per provider, recurring annually, and it is a direct drag on
provider acquisition in exactly the categories with the highest
consequences.

**Parked:** VOID currently records a *result* (`verifiedBy`,
`referenceId`, `expiresAt`). It does not run the check. A vendor
integration is required, and the FCRA workflow above must live around
it. `revokeVetting` exists but there is no adverse-action flow.

---

## 4. Insurance — per vertical, and a real cost

| Vertical group | Exposure |
|---|---|
| Transportation, courier, food delivery | Commercial auto; personal policies exclude commercial use. The gap between "app on, no passenger" and "passenger aboard" is the known hard problem. |
| Cleaning, handyman, landscaping | General liability plus property damage inside a customer's home. |
| Pet care | Animal injury, bite liability, and loss of the animal. |
| Childcare, senior care | Professional liability. The highest-premium category here. |
| Auto repair | Garage keepers liability while the vehicle is in custody. |
| Freight/moving | Cargo insurance; interstate moving carries federal registration. |
| Security | Errors and omissions, plus specific armed-guard coverage. |

**Parked:** none of this is modelled. There is no insurance field on a
provider, no verification of coverage, and no platform policy. Every
comparable carries platform-level coverage and treats it as a headline
trust feature.

---

## 5. Tax and payments

- **1099-NEC / 1099-K reporting** for US contractors, with thresholds
  that have changed repeatedly and been delayed more than once.
- **Sales tax** applies to some services in some states and not others,
  and the rules differ *within* a state by service type. Cleaning is
  taxable in some jurisdictions; tutoring often is not.
- **VCoin.** Every settlement runs through V3 in VCoin. Whether
  provider earnings denominated in an internal currency create a
  reportable event at earning time or at cash-out is a tax question
  that has not been asked. **This is the item most likely to be
  overlooked and most awkward to fix retroactively**, because it
  affects historical records rather than future behaviour.
- **Money transmission.** A platform holding balances and moving value
  between users may require money transmitter licensing state by state.
  V3 does exactly this.

**Parked. Needs a tax adviser and, separately, fintech counsel on
V3.**

---

## 6. Minors, vulnerable adults, and mandatory reporting

Childcare, tutoring, and senior care all involve populations with
specific legal protections:

- **Mandatory reporting** obligations may attach to providers, to the
  platform, or both, depending on jurisdiction.
- **COPPA** applies if under-13s have accounts. Currently a child is a
  *subject* record owned by a parent, not an account — which is the
  right shape and worth preserving deliberately.
- **Care licensing.** Childcare above certain hours or group sizes can
  require a licensed facility rather than an individual.

**Parked.** The `childAgeYears` and `careNeeds` attributes exist; the
obligations around them do not.

---

## 7. Food safety

`foodDelivery` is not licensing-gated and probably has a real
requirement behind it: food handler permits vary by county, and cold
chain and temperature control are regulated for some categories.

Flagged in the comparables document and repeated here because it is the
one vertical where I would expect a requirement and did not add a gate.
**Open question rather than a decision.**

---

## 8. Accessibility and anti-discrimination

- **ADA** obligations for a service platform, particularly
  transportation and medical transport.
- **Service animals** cannot be refused the way pets can.
- **Fair housing rules** touch real estate media.
- **Algorithmic fairness.** The service day planner and skill
  suggestions rank providers and opportunities. Any ranking system is
  a discrimination surface — including one as simple as a distance
  radius, which can correlate with protected characteristics through
  neighbourhood.

**Parked. No fairness review has been done on any ranking in VOID.**

---

## 9. Cost items, separate from compliance

Real recurring costs that no amount of code removes:

| Item | Note |
|---|---|
| Background checks | Per provider, recurring. Concentrated in the highest-value verticals. |
| Insurance | Premiums scale with volume and category. |
| Road routing | Straight-line estimates are free; real routing is a metered vendor API on every plan. |
| Payments | If VCoin ever touches real money, processing plus compliance. |
| Support | Every comparable runs a trust-and-safety team. Twenty-five categories means twenty-five failure vocabularies. |
| Provider acquisition | The real constraint on a marketplace, and it is spent per vertical per city. |

---

## The one thing worth saying plainly

**Twenty-five verticals means twenty-five regulatory surfaces**, and
they do not overlap much. A single-vertical competitor learns one set
of rules; VOID inherits all of them at once.

That is the genuine cost of the strategy, and it is the mirror image of
its advantage. The shared provider pool and cross-vertical workday are
real and defensible. The compliance surface is the price.

The practical implication is about **sequencing rather than scope**:
launching all 25 simultaneously means clearing all 25 at once. Launching
the low-regulation verticals first — courier, freelance, waste removal,
landscaping — builds liquidity in the provider pool, and that pool is
what makes the regulated verticals worth entering later.

Nothing in the code prevents any ordering. That is a business decision,
and this document exists so it is made with the list in view.
