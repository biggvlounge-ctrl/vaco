# VOID Infrastructure Naming Convention (v1)

Clarifies and locks in consistent naming across all VOID infrastructure
documents — resolving inconsistent terminology used across earlier
documents ("VOID Station," "Hub," "drone station" used somewhat
interchangeably).

## The two, distinct station types

**VOID Hub Stations** — the general Hub Network: sorting, storage,
fleet staging, driver dispatch coordination. Not drone-specific — the
broader logistics backbone already established throughout VOID's
architecture.

**VOID Port Stations** — the drone-specific stations: the SkyPort/
DRONEDEK-style units with drone landing, charging, and package
pickup/drop-off capability. A Port Station is a specific type of
physical node; a Hub Station is the broader logistics facility.

**Relationship**: a single physical location can be a Hub Station, a
Port Station, or both — e.g., a full VOID Hub might also have Port
Station capability built in, while a smaller HVNTZ business hosting
just a drone kiosk is a Port Station without full Hub functions.

## Multi-modal relay — already established, restated for clarity

The existing relay system (drone-to-drone or drone-to-ground handoff)
extends naturally to **drone-to-human handoff** at a Port Station — a
drone delivers to the station, a VOID driver retrieves it for final
delivery (per the already-established Locker-to-Door mechanic), or
vice versa for pickups.

## "Double units" — real, sensible throughput upgrade

**Sourcing correction**: real research could not confirm China/Meituan
specifically documents dual-bay or "double unit" stations — their real
SkyPort kiosks, based on available research, appear to be single-bay
units. The actual, confirmed real precedent is **A2Z Drone Delivery's
"multi-use drone dock network"** — a different company, not Chinese —
which achieves BVLOS (beyond visual line of sight) operation with a
**single operator managing multiple drones** from shared
infrastructure.

Interpreting "double units" as **dual-bay Port Stations** — a single
physical unit with two drone landing/charging bays instead of one,
doubling throughput at high-demand locations — remains sound,
real-world-grounded engineering logic, now correctly attributed to
A2Z's real multi-drone model rather than a Chinese precedent that
doesn't appear to exist.

```
VoidStation {
  id, stationType: "hub" | "port" | "hub-and-port"
  bayCount: number  // 1 for standard, 2+ for "double unit" high-
                      // throughput locations
  supportsRelay: boolean  // drone-to-drone, drone-to-ground, or
                            // drone-to-human handoff
}
```

## Status
Naming/organizational clarification — no new technology, just
consistent terminology going forward across all VOID documents and
Claude Code build specs.

## Standard requirement: every Hub Station includes at least one Port Station

Confirmed as a baseline rule, not optional: **every VOID Hub Station
must include at least one Port Station** (drone landing/charging +
package pickup capability). This ensures every full logistics Hub
also has real drone-delivery capability from day one, rather than
drone infrastructure being deployed inconsistently across the network.
A Hub can have more than one Port Station (per the "double units"
throughput upgrade), but never zero.
