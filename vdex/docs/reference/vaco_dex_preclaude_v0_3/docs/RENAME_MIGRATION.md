# VACO DEX rename migration

1. Preserve the VDEX 0.3.0 baseline and repository history.
2. Update display name to `VACO DEX` and expansion to `VACO Development Exchange`.
3. Keep historical package names, database identifiers, route aliases, and external references readable during a compatibility period.
4. Add redirects/aliases for old deep links and API paths where safe.
5. Update app registry, navigation, documentation, tests, package metadata, telemetry labels, and deployment display metadata.
6. Search case-insensitively for `VDEX`, `Vertical Vision Development Exchange`, and legacy `VDEV`; classify each hit before changing it.
7. Do not rename VACO platform shell or confuse VACO DEX with the VACO shell.
8. Run migration and regression tests; record any clients that still use old names.
