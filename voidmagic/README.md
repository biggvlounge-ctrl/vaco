# VOID MAGIC

A Meet & Greet / Interactions / Conversations booking platform —
personal-access experiences between customers and creators/public
figures (artists, athletes, executives, influencers, speakers,
experts), across physical, digital, and hybrid formats. Commercially
under Vvltvre → Touring & Tix; operationally powered by VOID; its own
independently deployable app, not hard-coded into VOID.

Source doc: `VOID_MAGIC_MASTER_BUILD_BRIEF.md` (the full 47-section
master brief — product concept, experience modes, VOID Event Services,
safety architecture, scheduling, marketplace, revenue model, and the
explicit phased build plan). Pasted inline by the user rather than
uploaded as a file; saved verbatim here under the filename originally
referenced.

**Scope note, read this before touching anything here**: Section 39 is
explicit — "DO NOT build the entire ecosystem at once." Phase 1 built
exactly the MVP's own 11-step minimum viable transaction loop. **Phase
2 is now built out, one real slice at a time, across all eight items
Section 40 names**: VOID Event Services (Security/Transport/Space/
Staffing/Fulfillment — Section 47's defining "direct app-to-app
relationships" principle, no V4 message bus), Digital Waiting Room,
Notifications, Creator Analytics, a double-booking guard (Section 10's
own named, minimal piece of "advanced scheduling" — the rest of that
section is real, substantial, still-deferred "intelligent scheduling
system" work), Customer Profiles (Favorites + Upcoming/My Experiences),
Media (MAGIC PHOTO/VIDEO/MEMORY), and Geofencing (real arrival
verification). Hybrid experiences beyond the waiting room's own format
gate is the one Phase 2 line item without its own dedicated slice yet.
Phase 3 (V4 AI Event Builder, DREAMS, Vvltvre/Vavlt Stvdios/CHOPZ
integration, dynamic pricing, enterprise) and Phase 4 (the full "Magic
Network") remain untouched. One structural rule holds regardless of
phase: per Section 16, VOID MAGIC never builds its own financial
ledger — every payment/settlement routes through V3, the same real,
injected `transferFn` pattern already proven across VOID, VOKEN, VAGO,
and now here.

## Run
```
cd voidmagic && npm install && npm start   # localhost:8797
```

## Test
```
curl http://localhost:8797/api/health
curl -X POST http://localhost:8797/api/experiences -H "Content-Type: application/json" -d '{
  "hostId":"artist-x","title":"Private Conversation","type":"conversation","format":"physical",
  "capacity":1,"durationMinutes":30,"price":100,"scheduledAt":9999999999999,"location":"Venue"
}'
curl "http://localhost:8797/api/experiences?type=conversation"
```

## What's here
- `lib/experiences.js` — **Experiences (Phase 1)**: a real, deliberate
  scoping choice, flagged since the brief's Section 38 only names
  entities without field shapes — modeled as one specific, already-
  dated/timed bookable slot (the same real shape VACAY's own
  `Experience`/`Booking` pair uses), not a recurring-availability
  template. Section 10's "serious scheduling engine" is real,
  substantial, explicitly later work, not built here. Pricing is
  limited to free/fixed; tiered/auction/invitation-only/subscription
  pricing are each their own real engineering lift, deferred.
  **Phase 2, fifth slice adds Section 10's own named double-booking
  guard**: a real, standard interval-overlap check against a host's
  other active (`open`/`full`) experiences, regardless of format —
  cancelled/completed experiences correctly free their slot, back-to-
  back scheduling is correctly allowed, and the rejection names the
  real conflicting experience. Travel time, setup/security buffers,
  and venue availability remain the genuinely deferred "intelligent
  scheduling system" work.
- `lib/bookings.js` — the real core transaction loop, under a real
  escrow model: the MVP's own step list separates "Payment is
  processed" (step 4) from "Host receives settlement" (step 10),
  which only makes sense if the customer is charged at booking time
  and the host paid later, at completion — a deliberately different
  real shape from VOID's own job-marketplace pattern (customer pays at
  completion), since event ticketing and gig-work marketplaces are
  genuinely different real-world models. Settlement is a real dual
  payout (host share + platform fee) from the same escrowed source,
  proven to drain the escrow account to exactly zero, not just
  spot-checked. The real credential reuses this session's established
  `crypto.randomBytes` pattern from VOID's own Locker-to-Door codes.
- `lib/eventServices.js` — **VOID Event Services (Phase 2, first
  slice)**: a real cross-app call into VOID's own existing job
  marketplace (mirroring CHOPZ SHOP's `requestVoidCourierJob` pattern)
  for Security, Transport, Space, Staffing, and Fulfillment. One real
  `EventServiceRequest` model across all five types, mirroring VOID's
  own "one loop for many types" design. Each service type maps to a
  real, distinct VOID vertical (`security`, `transportation`,
  `eventPlanning` for venue since VOID has no dedicated venue
  vertical, `staffing`, `courier` for fulfillment) — a real,
  interpretive choice flagged directly, since the brief never names
  VOID's vertical ids. The host, not the attendee, is the real
  customerId on VOID's job — event organizers pay for logistics, and
  that payment happens entirely inside VOID's own `completeJob` once
  the job completes, not duplicated here.
- `lib/digitalWaitingRoom.js` — **Digital Waiting Room (Phase 2,
  second slice)**: the real state flow for digital/hybrid experiences
  (`waiting-room` → `identity-verified` → `admitted` → `exited`),
  gated so a physical-only booking can't enter one. Real code reuse,
  not a second verification concept: `verifyIdentity` calls straight
  into `bookings.js`'s own `checkIn()` with the same credential issued
  at booking time — a digital identity check and a physical QR scan
  are the same real action through two different channels, proven
  live: the underlying `Booking.status` genuinely flips to
  `checked-in` as a side effect, and a wrong credential surfaces
  `checkIn()`'s own real rejection message, not a duplicate one.
- `lib/notifications.js` — **Notifications (Phase 2, third slice)**:
  a real `Notification` record validated against the doc's own
  14-type vocabulary. Four types are wired to genuine, already-built
  state transitions rather than left inert — `booking-confirmation`/
  `payment-confirmation` at booking, `experience-starting` at waiting-
  room admission, `experience-ending`/`post-event-follow-up` at
  completion. The remaining ten (reminders, delay/transportation
  updates, security instructions, host updates, media ready) have no
  automatic trigger built yet — genuinely need a time-based scheduler,
  a live poll of VOID Event Services' job status, or Media (Section
  13, unbuilt), none of which exist in this codebase — but remain
  real and constructible via the general endpoint, not silently
  faked. Same standing caveat as VSAFE's own escalations: real trigger
  logic and a real recipient are computed here; actual delivery
  (push/SMS/email) is separate infrastructure.
- `lib/creatorAnalytics.js` — **Creator Analytics (Phase 2, fourth
  slice)**: a real, pure read-side aggregation over data already
  built, no new store fields. Of the doc's 18 named metrics, 12 are
  genuinely computed (bookings, gross revenue, average order value,
  creator earnings, attendance/no-shows, repeat customers, digital-
  vs-physical and experience-type breakdowns, average experience
  duration, transportation/security usage via Event Services, peak
  booking hour) and 6 are explicitly named as not computable rather
  than faked (conversion — no page-view tracking exists; geographic
  demand/venue performance — `Experience.location` is a free-text
  string, not a real venue entity with coordinates; advertising
  performance — needs DREAMS, Phase 3). `creatorEarnings`
  deliberately recomputes `completeExperience`'s own exact real
  settlement formula booking-by-booking, not an approximation.
- `lib/customerProfiles.js` — **Customer Profiles (Phase 2, sixth
  slice)**: the two real, concretely-specified pieces of Section 28's
  HOME nav this codebase can actually support — Favorites (a real,
  duplicate-rejecting customer↔creator relationship) and Upcoming/My
  Experiences (one real query serving both, over the same real
  `Booking`/`Experience` data `creatorAnalytics.js` already reads,
  just from the customer's side). Upcoming is proven to genuinely
  diverge from a raw timestamp filter — a booking that actually
  completes drops out of Upcoming even before its original
  `scheduledAt` would, while the full history still shows it. Wallet
  is real but stays V3's job (Section 16); Messages and a full Profile
  entity are genuinely undocumented anywhere in the brief, not
  invented here.
- `lib/media.js` — **Media (Phase 2, seventh slice)**: real
  `MediaOrder` tracking and real revenue settlement for MAGIC PHOTO/
  VIDEO/MEMORY — charges the buyer into the same real escrow account
  at order time, pays a real host+platform dual payout only at
  delivery. Never generates media itself: `deliverMedia` requires a
  real, non-empty, externally-supplied `assetUrl`, the same standing
  no-fake-media rule already applied to VXLLAGE/CHOPZ. MAGIC MEMORY's
  own real gate (a "Post-event experience package" per the brief) —
  both ordering one and assembling `getMagicMemoryPackage` require the
  booking to have actually completed; the package bundles real receipt
  data plus only the real, delivered assets for that booking.
- `lib/geofencing.js` — **Geofencing (Phase 2, eighth slice)**: a real
  Haversine distance check (the same formula CVNVO's own
  `compatibility.js` already established, reused in meters for a
  venue-scale radius) against a new, optional `Experience.geofence`
  field. Builds the one of Section 32's six named examples that's
  genuinely self-contained — real arrival verification — and honestly
  scopes out the rest: venue/digital-availability geofencing is
  already covered by the waiting room's credential check instead,
  transportation geofencing is VOID's own data, and VIP/security
  geofencing need live infrastructure this phase doesn't build.
- `lib/bookings.js` — **Cancellations/refunds (Phase 2, ninth slice)**:
  not one of Section 40's own named 8 items, but the same real,
  gap-closing discipline as those slices — `cancelBooking` closes the
  README's own previously-flagged "Cancellation/refunds" gap. The
  brief names "Refund policy" as a real field shown on the experience
  page (Section 29) and lists refunds as a real line item in the event
  financial model (Section 27), but gives no exact window or
  percentage anywhere — a real, flagged, interpretive choice, same
  discipline as `PLATFORM_TAKE_RATE`: modeled on Airbnb Experiences'
  own real, well-known cancellation policy (full refund if cancelled
  at least 24 hours before the experience starts, no refund after). A
  late (post-cutoff) cancellation settles economically the same way
  `completeExperience` does — host share + platform fee, from the same
  escrowed source, summing to exactly what was charged — rather than
  inventing a third split: the host held reserved capacity through the
  cutoff that could no longer be resold, the same real economic
  position as a completed booking, and matches the brief's own
  Section 41 framing of no-shows as an analytics metric alongside
  completed bookings. Either way, a cancelled booking's slot is
  correctly released back to the experience (`full` → `open`,
  `remainingCapacity` incremented). `lib/notifications.js` gained one
  real, flagged 15th type, `booking-cancellation` — none of the
  brief's own 14 named types fit a cancellation notice.
- `server.js` — a real Express API (CommonJS) wrapping the above.

## Verified
Phase 1: 14 plain-Node checks, plus a live pass: `voidmagic/server.js`
and `venvs-mock-backend` together confirmed the full 11-step MVP loop
end to end — experience created and discovered, a real $100 booking
charge, a real credential lifecycle (wrong code rejected, correct one
accepted, double check-in rejected), and real completion settlement
**independently confirmed against the mock V3 ledger**: the host
received exactly $84.50, the platform kept exactly $15.50, and the
escrow account returned to precisely its starting balance — proof the
dual payout summed exactly to what was charged, with zero drift.

Phase 2 (VOID Event Services): 22 plain-Node checks (every service
type maps to its real, distinct VOID vertical; the host, not the
attendee, is the real customerId; rejections for an unknown
experience/invalid type/non-positive quantity/missing `voidRequestFn`;
per-experience-scoped listing), plus a live pass: VOID, VOID MAGIC, and
the V3 mock all running independently — a real security request and a
real staffing request placed against a real experience, both confirmed
as real, live jobs on VOID's own server via its own `/api/job/:id`
endpoint, not stubbed responses. The Phase 1 MVP booking flow re-run
and reconfirmed unaffected.

Phase 2 (Digital Waiting Room): 18 plain-Node checks (physical-format
rejection, the real four-state happy path, duplicate-session
rejection, wrong-credential rejection leaving both session and booking
untouched, correct-credential proven to genuinely invoke the real
`checkIn()`, admission/exit ordering enforced, hybrid format allowed),
plus a live pass: a real digital experience booked, a real waiting
room entered, a wrong credential genuinely rejected via `checkIn()`'s
own real error message, the correct credential accepted and confirmed
to flip the underlying booking to `checked-in`, admission and exit
both confirmed, and the experience's real completion re-run afterward
— host received exactly $33.80, platform kept exactly $6.20 on a $40
booking, escrow returned to precisely its starting balance, proving a
waiting-room booking still settles correctly.

Phase 2 (Notifications): 18 plain-Node checks (invalid type/missing
recipient rejected, a manual un-auto-triggered type still works, free
vs. priced bookings fire the correct notification set, waiting-room
admission and completion each fire their correct real types, `relatedId`
and sort order correct, `unreadOnly` filtering and `markAsRead` both
correct, per-user isolation), plus a live pass: a real booking,
waiting-room admission, and completion run end to end against the
actual running server, with the real notification list confirmed to
grow exactly as expected after each step (2 → 3 → 5 notifications),
`markAsRead` and the `unreadOnly` query filter both confirmed live.

Phase 2 (Creator Analytics): 18 plain-Node checks (zeroed stats for an
empty host, `attendanceRate` null rather than 0 when uncomputable, a
real multi-booking/multi-experience/one-no-show/one-repeat-customer
scenario proven correct metric-by-metric including exact settlement-
formula-matching `creatorEarnings`, cross-host isolation), plus a live
pass: the same real scenario run against VOID MAGIC, VOID, and the V3
mock all running independently, confirmed to match the plain-Node
results exactly.

Phase 2 (Double-Booking Guard): 9 plain-Node checks (exact-slot,
partial-overlap, and containment cases all correctly rejected;
back-to-back scheduling and different-host same-window both correctly
allowed; cancelled/completed experiences confirmed to free their
slot), plus a live pass: a real overlapping booking attempt confirmed
rejected against the actual running server, existing MVP flow
reconfirmed unaffected.

Phase 2 (Customer Profiles): 18 plain-Node checks (favorite/unfavorite
validation and rejection cases, per-customer scoping, real enriched
experience data sorted correctly, Upcoming proven to diverge from a
raw timestamp filter once a booking actually completes, empty list for
a customer with no bookings), plus a live pass: a real favorite and a
real booking both confirmed via their respective endpoints, favorite
removal confirmed.

Phase 2 (Media + Geofencing, verified together — 27 plain-Node checks):
magic-memory's post-event gate; a real order charge and a real
host+platform delivery-time payout summing exactly to the media
price, escrow returned to its starting balance; empty/fabricated
`assetUrl` rejected; double-delivery rejected; the memory package
proven to bundle real receipt data plus only real delivered assets;
Haversine distance proven correct against a known real-world value
(~111.19km per degree of longitude at the equator); geofence-optional
handling; in/out-of-radius classification; arrival verification proven
to genuinely gate on distance. Plus a live pass: a real geofenced
experience, a rejected far-away arrival and an accepted in-zone one, a
real magic-photo order/delivery, and the resulting magic-memory
package, all confirmed against the actual running server and the real
V3 mock ledger. This completes every item in Section 40's own named
Phase 2 list except Advanced scheduling's full "intelligent scheduling
system" (buffers/travel-time), which stays deliberately beyond the
double-booking guard already built. See `dev-docs/` for the full
record.

Phase 2 (Cancellations/refunds, ninth slice): 9 plain-Node checks
(full refund when cancelled well before the 24h cutoff, no refund with
a real host+platform settlement when cancelled inside the cutoff, the
exact-24h boundary correctly refund-eligible, a free experience
cancels cleanly with no `transferFn` required, double-cancel and
cancel-after-complete both rejected, a priced cancel without a
`transferFn` rejected, an unknown booking rejected, capacity/status
correctly released either way), plus a live pass against the actual
running server and the real V3 mock: an early cancellation on a real
$100 booking refunded the customer in full and reopened the
experience's slot; a late cancellation on a separate real $100 booking
left the customer's balance unchanged and instead paid the host
exactly $84.50 and the platform exactly $15.50 (matching
`completeExperience`'s own real split), with the escrow account
confirmed returned to precisely its starting balance; a double-cancel
and a cancel of an unknown booking were both confirmed rejected with
the real error message, over real HTTP.

## Real persistence
`lib/persistence.js` wraps `server.js`'s own store in a real file-backed
store, `data/store.json` (port 8797) — VOID MAGIC's own real state now
survives a restart. Live-verified: created a real bookable experience,
killed the running process, restarted it, and confirmed the same real state
came back from a real GET. See `dev-docs/phase-3-real-persistence/`.

## Not yet built
- Hybrid experiences beyond the waiting room's own format gate — a
  real, later slice.
- Wallet (stays V3's job per Section 16), Messages, and a full Profile
  entity — the latter two genuinely undocumented anywhere in the
  brief.
- Travel time, setup/security buffers, venue availability — the
  substantial "intelligent scheduling system" work Section 10 itself
  flags as beyond a simple double-booking check.
- Real page-view tracking, real venue/geographic entities, and real
  DREAMS ad-performance integration — the reason conversion,
  geographic demand, venue performance, and advertising performance
  stay in Creator Analytics' own `notComputable` list.
- Real delivery (push/SMS/email) for notifications, time-based
  reminder scheduling, and a live poll of VOID Event Services' job
  status for delay/transportation-update triggers.
- V4 AI Event Builder ("Build My Experience"), DREAMS advertising,
  Vvltvre Touring & Tix / Vavlt Stvdios / CHOPZ integration, dynamic
  pricing, enterprise events, sponsorship marketplace — Phase 3.
- The full "Magic Network" — Phase 4.
- The Event Organizer role (managing multiple creators/venues/security
  for professional event companies and tour operators) — a real,
  confirmed third role in the brief, not built in this phase.
