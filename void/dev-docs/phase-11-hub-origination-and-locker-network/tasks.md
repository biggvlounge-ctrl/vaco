# Tasks — Phase 11: Hub Walk-Up Origination + Locker Network + Locker-to-Door

- [x] Create `lib/hubOrigination.js`: `ORIGINATION_METHODS`,
      `originateShipmentAtHub`, `getHubOriginatedShipment`,
      `decideFulfillmentForShipment`.
- [x] Create `lib/voidLocker.js`: `LOCKER_LOCATION_TYPES`,
      `PMS_OPTIONS`, `COMPARTMENT_SIZES`, `registerLocker`, `getLocker`,
      `depositPackage`, `retrievePackage`.
- [x] Create `lib/lockerToDoor.js`: `LOCKER_TO_DOOR_STATUSES`,
      `ACCESS_CODE_VALID_HOURS`, `requestLockerToDoor`,
      `getLockerToDoorRequest`, `assignDriverToLockerRequest`,
      `retrieveWithDriverAccess`, `completeLockerToDoorDelivery`.
- [x] Extend `createVoidStore()` with `hubOriginatedShipments`/
      `voidLockers`/`lockerToDoorRequests` and their `next*Id`
      counters.
- [x] Wire `server.js`: 16 new endpoints.
- [x] Verify pure logic in plain Node (throwaway `.cjs`, deleted after
      — 19 checks, all passed clean on first run):
      - `originateShipmentAtHub`: rejects `staff-assisted` without a
        `staffMemberId` and rejects `self-service-kiosk` *with* one
        (both directions checked); creates a real underlying `courier`
        job.
      - `decideFulfillmentForShipment` correctly resolves to `drone`
        (no ground capacity) and `driver` (ground capacity available)
        via the real, existing air-vs-ground rule.
      - `registerLocker`: rejects invalid location type, PMS, and
        compartment size; builds real compartments, courier-agnostic
        by default.
      - `depositPackage`: picks the true best-fit compartment (small
        request → small compartment, not medium/large); escalates
        correctly once the exact size is taken; throws once nothing
        fits.
      - `retrievePackage` rejects a mismatched recipient, succeeds for
        the real one.
      - Locker-to-Door: a non-recipient is rejected from requesting
        the service; the generated access code is real and distinct
        from the customer's own identity; retrieval rejects before a
        driver is assigned, rejects a wrong code, and rejects an
        expired code (checked as three separate cases); succeeds with
        the real code before expiry and genuinely frees the
        compartment; `completeLockerToDoorDelivery` only fires from
        `retrieved` and rejects being called twice.
- [x] Verify live with `void/server.js` running alone:
      - A real staff-assisted hub shipment created and resolved to
        `drone` fulfillment through the actual HTTP API.
      - A locker registered and a package deposited into the correct
        best-fit compartment.
      - The full Locker-to-Door lifecycle run live: request → early
        retrieval attempt correctly rejected (`"requested"`, expected
        `"driver-assigned"`) → driver assigned → wrong-code attempt
        correctly rejected → real-code retrieval succeeded → the
        compartment independently re-fetched via `GET /api/locker/1`
        and confirmed freed, not just trusted from the retrieval
        response → delivery completed.
- [x] Shut down the server cleanly; confirmed via follow-up `curl`.
- [x] Commit as its own change.

## Next
Phase 12: full cross-phase regression across all 11 phases, then final
delivery — this closes out every item from all 8 follow-up VOID docs.
