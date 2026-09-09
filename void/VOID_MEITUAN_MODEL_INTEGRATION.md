# VOID — Meituan Model Integration (v1)

Real research on Meituan (China's dominant local-services super-app).

**Scale**: ~70% of China's food delivery market, $51.1B 2025 revenue,
550M+ users. Strategy: "Retail + Technology" spanning 200+ service
categories in one app.

**Real technical sophistication**: system-wide AI dispatch — order
batching (grouping nearby orders), "demand smoothing" (staggering
acceptance during peak times), real-time optimization weighing
delivery time, rider utilization, restaurant readiness, weather, and
traffic simultaneously.

**Real trust innovation — "Raccoon Canteen"**: Meituan-supported
kitchens with live, transparent kitchen streaming.

**Real autonomous delivery**: actively integrating an unmanned
delivery system, full integration targeted by 2027.

**Honest assessment**: basic food delivery exists in the US, but the
specific combination — a true 200+ category super-app with this level
of AI optimization plus transparent-kitchen trust-building — hasn't
been replicated in the US market.

**Direct validation**: VOID's existing 18+ vertical structure under
one shared dispatch is already directionally aligned with Meituan's
model.

**Three concrete additions**: (1) upgrade Gibson's dispatch logic to
system-wide optimization — order batching and demand-smoothing, not
just one-to-one matching; (2) a transparent-kitchen/verification
feature for VOID's food-delivery vertical, tying into HVNTZ's existing
trust signals; (3) real validation for expanding VOID's vertical count
further over time.

## 2026 performance data

900,000+ cumulative drone orders as of May 2026 (up from 740,000 end
of 2025). Per-delivery operating cost falling 40-50% annually;
human-to-drone supervision ratio at 1:50. Medical delivery segment
already profitable; food delivery segment not yet profitable due to
competitive pricing pressure — targets scaled profitability within
2-3 years.

**4th-gen drone specs**: 2.5kg payload, 3km radius in 15 minutes, 10km
max range, operates -20°C to 50°C, handles Level 6 winds, flies
through moderate rain/snow — covers 97%+ of Chinese urban areas
year-round.

Meituan and Google Wing are ranked as the two global co-leaders in
commercial drone delivery volume per ARK Invest's 2025 report.

**SkyPort kiosks**: automated locker stations with drone landing pad
and weather monitoring on the roof. Drone deposits cargo into an
insulated compartment; customer scans QR code to retrieve. Named tech:
M-Drone 4L Winch (winch/rappel-based, lowers cargo via cable for tight
urban spaces), M-Port 3 (smart transfer hub), M-DaaS 3 (cloud
dispatch). Deploys on existing space (rooftops, retail center areas,
parks) — directly applicable to VOID's Hub/Affiliate Network
placement.

**Honest regulatory reality check**: Meituan holds China's first
national, full-territory drone logistics license — ONE certificate for
the entire country. This is fundamentally different from the
fragmented, route-by-route FAA approval VOID's drone partners operate
under in the US. The physical infrastructure design is directly
replicable; the regulatory ease is not.

---

## Implementation status (added when this file was placed into the repo)

All three concrete additions are real:

1. **System-wide dispatch, not one-to-one** —
   `lib/droneRouting.js`'s `groupOrdersIntoRoutes` is real order
   batching (nearest-neighbour construction + 2-opt improvement over
   real payload/range/no-fly constraints), and
   `lib/dispatchIntelligence.js`'s `computeAcceptanceDelay` is real
   demand smoothing (`STAGGER_INTERVAL_MINUTES = 5`, a flagged
   interpretive value since the doc gives no formula). Live-verified
   in VOID's own seed data: three nearby orders genuinely batch onto
   one drone route while a distant fourth gets its own.
2. **Transparent kitchen** — `lib/foodTrust.js`:
   `registerKitchenStream` / `getKitchenTrustStatus`, the Raccoon
   Canteen mechanic tied to real business trust signals.
3. **Vertical expansion** — `lib/verticals.js` now carries 25
   registered verticals.

**Real sourcing correction recorded elsewhere**: `VOID_STATION_NAMING_CONVENTION.md`
notes that research could *not* confirm Meituan documents dual-bay or
"double unit" SkyPort stations — their real kiosks appear to be
single-bay. The confirmed real precedent for multi-drone docks is
A2Z Drone Delivery instead. Left as the corrected sourcing rather
than quietly attributing it to Meituan.

**Not built**: the weather/traffic/restaurant-readiness inputs to
real-time optimization (no real weather or traffic data source is
wired in), autonomous/unmanned delivery, and anything touching the
regulatory position — the FAA reality above is a genuine constraint,
not a software gap.
