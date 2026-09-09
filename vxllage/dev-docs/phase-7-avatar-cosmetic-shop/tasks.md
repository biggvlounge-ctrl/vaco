# Tasks — Phase 7: the personal, cross-village avatar cosmetic shop

- [x] Investigate: read `villageShop.js` to confirm the real, distinct
      per-village concept already built; read `VXLLAGE_CLAUDE.md`'s own
      "Profile / Wallet sheet" section directly for the real spec (3
      items, Avatar Economy as a distinct revenue stream from
      Community Boosting).
- [x] `lib/avatarCosmetics.js` — new file: `AVATAR_COSMETIC_CATALOG`
      (3 real, flagged placeholder items), `purchaseAvatarCosmetic`,
      `getOwnedAvatarCosmetics`, `equipAvatarCosmetic`,
      `unequipAvatarCosmetic`, `getAvatarProfile`.
- [x] `lib/store.js` — added `avatarCosmeticOwnership`/
      `nextAvatarCosmeticOwnershipId`/`avatarEquippedCosmetic`.
- [x] `server.js` — wired 5 new routes (`GET .../catalog`, `POST
      .../purchase`, `POST .../equip`, `POST .../unequip`, `GET
      /api/users/:userId/avatar-profile`).
- [x] 13 plain-Node checks — all passing.
- [x] Live pass against `venvs-mock-backend` + `vxllage`: real catalog
      fetched, a real purchase confirmed moving real VCoin to the
      platform account (alice 1000→950, platform 1000→1050), a real
      equip confirmed, and the real avatar profile confirmed showing
      both.
- [x] Shut down all test servers; confirmed via port checks.
- [x] Update `README.md` (What's here, Verified, Not yet built).
- [x] Write this plan/tasks pair.

## Next
Level/reputation/XP tracking for the Profile sheet — a separate,
larger, undocumented-formula gap.
