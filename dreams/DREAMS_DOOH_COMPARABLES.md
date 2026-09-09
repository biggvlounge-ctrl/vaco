# DREAMS — Digital Out-of-Home Advertising Comparables

Written to close a comparables-coverage gap. DREAMS is the ecosystem's
ad/screen network and had no comparables document of its own.

**What it is:** a screen network with campaigns, impression tracking,
traffic-based dynamic pricing, an offline cache for screens that lose
connectivity, and a self-serve advertiser flow. DREA represents it in
VACON.

## Comparables — two different businesses

DOOH splits into two layers, and DREAMS is currently building both,
which is worth stating because the comparables are not interchangeable.

### The technology layer (what DREAMS' code most resembles)

| Platform | Role |
|---|---|
| **Vistar Media** | The dominant DOOH demand-side platform — programmatic buying across other people's screens, with real audience and location targeting. The closest analogue to DREAMS' campaign and targeting model. |
| **Broadsign** | Screen-side: content management, playback scheduling, and inventory for network operators. The closest analogue to DREAMS' screen and offline-cache model. |
| **Place Exchange** | The supply-side platform making DOOH inventory biddable through standard programmatic pipes. |
| **Hivestack** | Programmatic DOOH, now part of Perion. |

### The media-owner layer (who actually owns the screens)

| Company | Note |
|---|---|
| **Lamar Advertising** | Large US outdoor operator, heavy on roadside. |
| **Clear Channel Outdoor** | Global; significant urban and transit inventory. |
| **OUTFRONT Media** | Strong transit and street-furniture position. |
| **JCDecaux** | Global leader in street furniture and transit. |

//: Flagged interpretive: DOOH consolidates quickly — Hivestack/Perion
//: is one example, and the DSP/SSP layer has been active. Names above
//: are the durable set; ownership is worth re-checking before any
//: partnership decision.

## Where DREAMS actually sits, honestly

DREAMS is currently **the technology layer without the media layer**.
The code models screens, campaigns, impressions, and pricing — it does
not own or contract a single physical screen.

That is not a flaw, it is a sequencing question, and it is the most
important strategic fact about this app. Every comparable above is
either a technology vendor selling into networks that own screens, or a
media owner with screens. DREAMS is built as the former while the
ecosystem's actual advantage would be the latter:

- **HVNTZ businesses and VOID stations are real screen locations.** The
  ecosystem has a physical footprint no ad-tech startup has. That is
  the media-owner position, and it is the one worth taking, because the
  technology layer is a crowded market with entrenched incumbents.
- **The self-serve flow plus VENVM** is the genuinely differentiated
  combination: a small business that cannot afford a shoot could
  generate the creative and buy the placement in one flow. No
  comparable offers that — Vistar sells you placement and assumes you
  arrive with a finished asset.

**The honest caveat on that second point**, consistent with what
VENVM's own docs already say: VENVM models the production *process* but
cannot generate media. The self-serve creative half of that pitch
depends on generative video that is not built and needs a vendor.

## What is genuinely built

Screens, campaigns, impression recording, traffic-based dynamic
pricing, and a real offline cache so a disconnected screen keeps
playing and reconciles later. Feeds VACO Analytics. Persisted.

## Not covered here

Real audience measurement. Every comparable above lives or dies on
verified impression data — that is what advertisers actually buy.
DREAMS records impressions it is told about; there is no independent
measurement, and no comparable would accept that. This is the gap to
close before selling inventory to anyone outside the ecosystem.
