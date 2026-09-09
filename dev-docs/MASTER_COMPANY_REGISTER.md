# Master Company Register

Every company in the ecosystem, top to bottom. This is the definitive
list — the other structure documents explain *why*; this one just
enumerates.

Anything marked **(built)** exists in code today. Anything marked
**(corporate)** is an entity function with no app behind it. Anything
marked **(not built)** is named but has no implementation.

---

## Holding companies — 3

| | Company | Role |
|---|---|---|
| 1 | **VVI — Vertical Vision, Inc.** | Grandparent. Never customer-facing; everything ships branded VACO. |
| 2 | **VEGA** | The vehicle system — technology arm |
| 3 | **VEDA** | Real estate · investment · stock — physical arm |

---

## VEGA — the vehicle system — 32

### The shell — 1
| | | |
|---|---|---|
| 4 | **VACO Shell / Vehicle Shell** | App store, 31-app registry, SSO **(built)** |

### VOID group — 2
| | | |
|---|---|---|
| 5 | **VOID** | 25 service verticals, logistics **(built)** |
| 6 | **VOID MAGIC** | Meet & greets, ticketing, 15.5% **(built)** |

### VOKEN group — 3
| | | |
|---|---|---|
| 7 | **VOKEN** | The card engine — minting, editions, provenance, value scores **(built)** |
| 7a | **CVLTVRE / CVLTVRE** | *Parent #17.* Packs, raffles, trades, applications, referrals **(built)**<br>Brand declared in `voken/lib/brand.js` |
| 7b | **VADO** | *Parent #18.* The Art District — auctions, galleries, art frames **(built)** |

All three run in **one process on 8794**. Promoted to parents
2026-08-26; no code moved, and none should — see
`dev-docs/CVLTVRE_AND_VADO_EXTRACTION_AUDIT.md` for why splitting the
runtime would break auction settlement.

### Vvltvre group — 5
| | | |
|---|---|---|
| 8 | **Vvltvre Music / Distribution** | Releases, royalties, label deals **(built)** |
| 9 | **Vvltvre Flix** | Subscription video **(built)** |
| 10 | **Vvltvre Pods** | Podcasts, 10% **(built)** |
| 11 | **Vvltvre Studios** | Fund-and-produce financing **(built)** |
| 12 | **VENVM** | AI production pipeline **(built)** |

*Also: Vvltvre Touring & Tix — the commercial identity VOID MAGIC
trades under.*

### VACON group — 3
| | | |
|---|---|---|
| 13 | **VACON** | Operating network, 14 agents **(built)** |
| 14 | **VSAFE** | Shared safety layer **(built)** |
| 15 | **VACON-C / VACANCY** | Civ-sim engine **(paused)** |

### V4 group — 2
| | | |
|---|---|---|
| 16 | **V4 Agent Proxy** | Agent interface, twin profiles **(built)** |
| 17 | **V4 Search** | Cross-app search **(built)** |

### V3 group — 2
| | | |
|---|---|---|
| 18 | **V3** | VCoin/VASH ledger — 18 apps settle here **(built)** |
| 19 | **VACA** | Identity & authenticity attestation **(built)** |

### CVNVO group — 2
| | | |
|---|---|---|
| 20 | **CVNVO** | Dating, 11 formats **(built)** |
| 21 | **YAP** | Reviews **(built)** — *highest liability item* |

### HVNTZ group — 1
| | | |
|---|---|---|
| 22 | **HVNTZ** | Local business network, 14 revenue streams **(built)** |

*DREAMS operates here as an HVNTZ sub-app; its revenue is attributed
to VRG. Listed under VEDA.*

### CHOPZ group — 2
| | | |
|---|---|---|
| 23 | **CHOPZ** | Short-form video feed **(built)** |
| 24 | **CHOPZ SHOP** | Commerce, 15% apparel / 7% default **(built)** |

### VACAY group — 1
| | | |
|---|---|---|
| 25 | **VACAY** | **(built)** — five businesses inside: Stays, Experiences, Auto, Homes, Flights |

### Standalone — 7
| | | |
|---|---|---|
| 26 | **VAGO** | Gaming — markets, sportsbook, casino, fantasy **(built)** |
| 27 | **Vavlt Stvdios** | Streaming, 8-screen sessions, 80/20 **(built)** |
| 28 | **VXLLAGE** | Social, villages, cosmetics **(built)** |
| 29 | **VENVS** | Marketplace, shop, publishing **(built)** |
| 30 | **VDP** | The walkable world, 22 districts **(built)** |
| 31 | **Shield** | Auth & SSO **(built)** |
| 32 | **VACO Analytics** | Metrics & anomaly detection **(built)** |

### Vex group — 3
| | | |
|---|---|---|
| 33 | **Vex Trading** | Parent shell **(built)** |
| 34 | **VEX** | Consumer brokerage **(built, gated)** — needs broker-dealer registration |
| 35 | **Vex Business** | Futures research, Python stack **(built)** |

---

## VEDA — real estate, investment, physical — 29

### The three groups — 3
| | | |
|---|---|---|
| 36 | **VEDA Real Estate Group (VRG)** | Property, physical assets **(corporate)** |
| 37 | **VEDA Food Group** | Holds the ten food brands **(corporate)** |
| 38 | **VEDA Investment Group** | Investment, stock, capital **(corporate)** |

### DREAMS — 1
| | | |
|---|---|---|
| 39 | **DREAMS** | Screen/ad network **(built)** — **operates in VEGA** as an HVNTZ sub-app; **revenue attributed to VRG**. Same split REIT rules require of Lamar and OUTFRONT. |

### VEDA Food Group — 10 brands
| | | |
|---|---|---|
| 40 | **VIVE** | Coffee & fresh-pressed beverages **(built)** |
| 41 | **VIXENS** | Vegan restaurant **(built)** |
| 42 | **VORDABELLO'S** | Upscale Italian, fast **(built)** |
| 43 | **VODEGA** | Sandwich shop, hot & cold **(built)** |
| 44 | **VFRESH** | Fresh produce & grocery **(built)** |
| 45 | **TACO TOWN** | Mexican **(built)** |
| 46 | **BIG JACK'S** | Burgers **(built)** |
| 47 | **NETTY'S** | Soul food **(built)** |
| 48 | **WEDGE** | Potato wedges **(built)** |
| 49 | **Chicken Spot** | Chicken tenders — **name not locked** |

### SVMIKO DEGVCHI — fashion house + 13 houses — 14
| | | |
|---|---|---|
| 50 | **SVMIKO DEGVCHI** | The house **(built)** — European simplicity × Japanese craftsmanship |
| 51 | **DEGVCHI** | **(built)** |
| 52 | **LVCII** | **(built)** |
| 53 | **Devil in Details (DND)** | **(built)** |
| 54 | **BOOBI / BOOBI Couture** | **(built)** |
| 55 | **Boulevard (BLVD)** | **(built)** |
| 56 | **JACQVÉ** | **(built)** |
| 57 | **ZV** | **(built)** |
| 58 | **RED VEIL** | **(built)** |
| 59 | **VEDELLÍN** | **(built)** |
| 60 | **VvLGAR** | **(built)** |
| 61 | **VAISON / △AISON** | **(built)** |
| 62 | **ANCÓR** | **(built)** |
| 63 | **DVMB** | **(built)** |

### VAZAN — 1
| | | |
|---|---|---|
| 64 | **VAZAN** | Supplements & skincare **(built)** — own parent company; supplement and skincare companies to be built beneath it |

---

## The count

| Arm | Companies |
|---|---|
| Holding (VVI, VEGA, VEDA) | 3 |
| VEGA — technology | 32 |
| VEDA — physical | 29 |
| **Total** | **64** |

**Of these, 55 exist in code today.** Three are corporate functions
with no app (the VEDA groups), one is paused (VACON-C), one is gated
(VEX), and one has no locked name (Chicken Spot).

---

## Not yet companies, but named

Things that exist as names or documents without being businesses yet:

- **VACO Merch Store** — documented, **not built**
- **Supplement & skincare companies under VAZAN** — to be built
- **Real estate holdings under VRG** — no properties modelled in code
- **Investment vehicles under VEDA Investment Group** — corporate function only
- **VPLAN, VLAY** — proposed placeholder names, never adopted
- **VEGA, VEDA themselves** — no code; they are pure holding entities

---

## What this list is *not*

It does not say which of these should be **separately incorporated**.
Sixty-four entities would mean sixty-four sets of filings, books, and
returns, plus intercompany agreements for every cross-app flow — and
eighteen apps settle through V3 alone.

`REVENUE_ENTITY_INVENTORY.md` covers that question. Its short version:
form the holding companies and the entities the regulated businesses
require, then add entities as businesses reach revenue. Filing for a
company with no customers costs money annually and protects nothing.

**The S-Corp constraint applies across all of it** — an S-Corp cannot
have a corporate shareholder, so nothing in a tree with VVI at the top
can be one.
