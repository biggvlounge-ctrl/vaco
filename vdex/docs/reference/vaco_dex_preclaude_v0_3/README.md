> **ARCHIVED REFERENCE — NOT THE ACTIVE PRODUCT SPECIFICATION**
> This folder is preserved for historical code, research and feature ideas. Its old VACO DEX rename proposal is superseded: the confirmed product name is **VDEX — Vertical Vision Development Exchange**. Its VASH Fundraising material describes a separate VASH-owned extension, not a VDEX-owned finance module. Do not apply old rename or ownership instructions. Follow `docs/CLAUDE_CODE_START_HERE.md`, `docs/MASTER_SPEC.md` and `docs/VDEX_COMPLETENESS_AUDIT_0.3.23.md`.

# VACO DEX Pre-Claude Engineering Kit 0.3.0

Additive engineering source and handoff package for **VACO DEX — VACO Development Exchange**, formerly VDEX, plus the new **VASH Fundraising** extension and shared VACO Social Distribution Hub contracts.

Preserve the existing VDEX 0.3.0 application baseline. This kit does not claim to provide production authentication, a production database, live payment processing, approved social API access, or live VACON/VASH/VACA/VCoin integrations.

## Contents
- `src/domain/` — property, evidence-oriented highlights, scoring, development reference logic.
- `src/api/` — property intelligence handler.
- `src/fundraising/` — campaign validation and confirmed-payment event accounting reference logic.
- `src/integrations/social/` — social connector capability contract and safe share payload builder.
- `docs/PRODUCT_RENAME_AND_VASH_FUNDRAISING.md` — product and engineering requirements.
- `docs/fundraising/COMPETITIVE_LANDSCAPE.md` — competitor and feature research baseline.
- `docs/RENAME_MIGRATION.md` — non-destructive rename plan.
- `tests/` — automated tests.

## Verify
Requires Node.js 18+:

```bash
npm run check
npm test
```

## Important boundaries
The campaign module records confirmed payment events; it does not process, custody, or transfer money. Securities crowdfunding is excluded from the donation module. Social posting is never assumed available: use approved OAuth APIs where allowed, otherwise official share flows or manual share links. All real VACO service integrations require inspection of the existing APIs, credentials, scopes, and end-to-end verification.
