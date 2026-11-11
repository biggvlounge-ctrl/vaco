# START HERE — VDEX Claude Code Handoff

**Current prepared release: 0.3.24 (contract-first integration registry update).**

Read these in order:
1. `docs/CLAUDE_CODE_HANDOFF.md` — active engineering handoff and historical build record.
2. `docs/VDEX_COMPLETENESS_AUDIT_0.3.23.md` — authoritative built-vs-missing inventory, ecosystem integration boundaries, compliance rules, recommended build order.
3. `docs/MASTER_SPEC.md` — product mission and full module blueprint.
4. `docs/INTEGRATION_CONTRACTS.md` — integration ownership, event envelope and delivery controls.
5. `README.md` — local run instructions and API overview.
6. `docs/BUILD_STATUS_0.3.24.md` — this release's exact changes and verification.

## Binding decisions
- Name is **VDEX — Vertical Vision Development Exchange**. Do not rename to VACO DEX.
- VDEX is an independent app grouped with VACAY and VOID; it is not merged into them or placed inside V3/V4.
- Integrate with VACAY for authorized listings/discovery and seller/owner workflow handoffs; attach to DREAMS Network; use VULCAN for approved tokenization. All three are not yet connected in this package. `GET /api/integrations` now exposes the contract-first integration registry for VACAY, DREAMS Network, VULCAN, VACA, VASH, VCoin, VOKEN, VACO/VACON and VOID; it never reports configuration as a live connection.
- Reuse VACA, VASH, VCoin, VOKEN and VACO/VACON services only through actual contracts. Do not duplicate identity, financial ledger, wallet, payment or token services.
- VEX stocks/trading remains separate. Do not add Pivx-like trading to VDEX.
- B. VXLA is an exact project name; role and permissions are not defined in this code snapshot and must be confirmed rather than invented.
- Historical reference materials under `docs/reference/vaco_dex_preclaude_v0_3/` are not active instructions where they conflict with the current product name or architecture. See the archive notice in that folder's README.

## First Claude session
1. Inspect repository status, current app registry, actual VACO/VACON/VACA/VACAY/DREAMS/VULCAN/VASH/VCoin/VOKEN contracts and any newer user changes.
2. Run `npm run check`, `npm test`, and `npm run db:dry-run` against a copied/isolated database. Never overwrite the user's database.
3. Compare actual repository against `docs/VDEX_COMPLETENESS_AUDIT_0.3.23.md` and report drift before changing code.
4. Do not claim a feed is connected because it appears in the catalog or a fixture test passes.
5. Start with P0 production data/security foundations, then canonical parcel identity and authorized national data coverage.

The prepared package is a runnable local MVP and pre-Claude engineering snapshot, not a production-ready national marketplace. External credentials, contracts, licenses, live database, and production deployment are not included.
