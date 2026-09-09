# VOID — Multi-Stop Drone Routing (v1)

Real, well-established logistics technology confirming a single drone
can make multiple deliveries in one flight, optimized for route
sequence — not experimental, an actively-studied operations-research
problem with real, proven algorithms.

## Real, named technology this is built on

**TSP-D / MTSP-TD** (Traveling Salesman Problem with Drones / Multi-
Visit variant) — the real, established formulation for a single drone
making multiple deliveries in one flight, optimizing stop sequence to
minimize total delivery time. **VRP-D** (Vehicle Routing Problem with
Drones) is the broader real category, with real published algorithms
actively refined in current research (2024-2025 papers).

**Real, proven efficiency**: one cited study achieved a **73%
reduction** in delivery time/cost using multi-stop optimization versus
single-stop dispatch.

## Direct fit with VOID's existing architecture

This research models exactly VOID's existing setup: a mobile depot
(a Hub, or a delivery vehicle) launches a drone that makes **multiple
stops before returning**, rather than one drone trip per delivery.
This is not new infrastructure — it's a smarter routing algorithm
layered onto the already-built Hub Network and multi-modal relay
system.

**Real constraints this research already models, to build into
Gibson's dispatch logic**:
- Payload capacity across multiple stops (total cargo must cover every
  delivery on the route, not just one)
- Real battery/range limits per multi-stop trip
- No-fly zones
- Multiple charging depot coordination (relevant to VOID's Hub Network
  spacing)

## Data model addition

```
MultiStopDroneRoute {
  id, droneId, originHubId
  stops: [{ orderId, deliveryLocation, sequenceIndex, payloadWeight }]
  totalPayload: number  // sum across all stops, must stay under
                          // the drone's real capacity
  estimatedRangeUsed: number  // vs. real battery/range limit
  optimizedFor: "shortest-time" | "lowest-cost" | "max-stops"
}
```

**Gibson's routing decision extends**: instead of only choosing driver
vs. drone vs. autonomous vehicle per single order, Gibson can now group
nearby orders into one multi-stop drone route when they share a
similar destination area and combined payload stays within range —
directly reducing the number of individual drone trips needed.

## Network density effect — more midpoints benefit everyone already in the network

A real, important compounding principle worth stating explicitly: as
more businesses opt into VOID's relay/midpoint and pickup process (per
the Multi-Midpoint and HVNTZ Revenue Stack systems), the delivery
network doesn't just grow linearly — it gets **qualitatively better for
every business and customer already using it**. More midpoints mean
shorter average distances between relay points, more real routing
options for the multi-stop optimization above, and a more resilient
network overall (if one midpoint is unavailable, more real
alternatives exist nearby).

**Why this matters for recruitment strategy**: this gives every
business a real, honest reason to encourage others to join beyond
their own individual benefit — network density genuinely improves
service quality for everyone already participating, the same real
effect that makes ride-share driver density valuable to existing
drivers and delivery hub density valuable to real logistics networks
like UPS and FedEx.

```
NetworkDensityMetric {
  regionId
  activeMidpointCount: number
  averageInterMidpointDistance: number  // decreases as more businesses opt in
  routingOptionsAvailable: number  // increases with density, directly
                                     // improving multi-stop optimization quality
}
```

## Status
Ready for Claude Code — real, published algorithms (TSP-D, VRP-D)
exist as a starting reference; Claude Code can implement a working
route-optimization solver from this established literature rather than
inventing one from scratch.
