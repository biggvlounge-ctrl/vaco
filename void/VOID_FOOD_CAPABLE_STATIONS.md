# VOID — Food-Capable Stations (v1)

**Decision**: not dedicated food-only stations — a temperature-
controlled compartment **variant** deployed at a subset of the
existing general station network, placed near real food-density areas.

DRONEDEK already has a confirmed "hot and cold section" variant —
real, existing technology. Meituan's real model confirms the same
approach: general-purpose stations with food-handling capability built
in, not a separate parallel network.

**Placement**: temperature-controlled variant near HVNTZ-onboarded
restaurants, VDP's Food District, and high-density food-delivery
areas. Standard stations remain default elsewhere.

**New Gibson dispatch rule**: food orders route with less delay
tolerance than standard deliveries.

```
VoidStation { temperatureControlled: boolean }
DeliveryPriority { orderType: "food" | "general-package",
  maxAcceptableDelayMinutes: number }
```

---

## Implementation status (added when this file was placed into the repo)

- **`temperatureControlled`** — `lib/stations.js`: a real boolean on
  the existing `VoidStation`, defaulting to `false`, exactly as the
  "variant at a subset of the general network, not a parallel
  network" decision above specifies. No separate food-station entity
  was created.
- **`DeliveryPriority` / the Gibson rule** — `lib/dispatchIntelligence.js`:
  real `ORDER_TYPES` (`food`, `general-package`), `getDeliveryPriority`,
  and `computeAcceptanceDelay`. The food vertical's tighter window was
  live-verified in the Phase 12 regression to actually change Gibson's
  real air-vs-ground decision, not just to exist as a field.
- **`foodDelivery` vertical** — `lib/verticals.js`: registered to
  close a real gap this doc's own assumptions depended on (the
  Logistics section named restaurant/grocery delivery repeatedly, but
  it had never been given its own Service Marketplace registry entry;
  three separate follow-up docs all assumed it existed).

**Not built**: real temperature telemetry or a cold-chain integrity
check — `temperatureControlled` records a real station capability, but
nothing measures or verifies actual temperature. That would need real
hardware sensor integration.
