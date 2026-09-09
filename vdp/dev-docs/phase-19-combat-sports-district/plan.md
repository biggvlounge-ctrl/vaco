# Plan — Phase 19: The Combat Sports District

## Goal
A real combat sports district per `vdp/VDP_COMBAT_SPORTS_DISTRICT.md`:
four formats, four skill tiers, any discipline, integrated with Vavlt
Stvdios' streaming, VAGO's predictions and VOKEN's rookie cards.

## Real investigation before any code
Unlike the casino document filed the same day, all three of this
document's integration claims check out: Vavlt Stvdios' multi-channel
core, VAGO's prediction mechanics and VOKEN's card mechanic are all
built, and all three are already reachable from `vdp/src/lib/` as
clients. The district is new work; none of its dependencies are.

## Design
- **`combatSportType` stays an open string.** The document is explicit
  — "genuinely open." An enum would quietly contradict it and make the
  next discipline a code change. Validated for being a real non-empty
  name, normalised to lower case so "Boxing" and "boxing" are one
  discipline.
- **What formats actually constrain is headcount**, and that is where
  the bug lives. A one-on-one with three fighters is well-formed JSON
  and an unrunnable bout — it would stream, take predictions and pay
  out. So the roster is checked against the format on construction.
- **Seams, not calls.** `broadcastChannels()`,
  `predictionMarketEligibility()` and `isRookieEligible()` return the
  facts the other three apps need. None of them are invoked here, for
  the same reason `venusResort.js` does not settle a stake.
- **Street tier settles nothing.** The document confirms street as a
  real tier and is silent on money. An unlicensed underground-fight
  economy is a different compliance object than a sanctioned bout, so
  the conservative answer is taken and stated in one place —
  `SETTLING_TIERS`.
- **`vdp-native`, for a different reason than the resort.** There is no
  standalone combat-sports app to link out to; the card is the
  district.

## Also in this phase
VDP's exit affordance, per `vdp/VDP_SHELL_EXIT_FLOW_RESOLUTION.md` —
whose named mechanism does not exist. `vaco-shell` has no React and the
quoted `setScreen("hub")` is nowhere in the repo. The real contract is
`vaco-ui.js`'s masthead brand link to `SHELL_URL`; VDP is deliberately
outside the design-system targets, so it needed that link built
directly. Port 8789 was checked against both `vaco-ui.js`'s default and
`start-ecosystem.sh`, not assumed.
