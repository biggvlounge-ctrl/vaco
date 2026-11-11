# VDEX — Master Specification

**Source**: pasted directly by the founder, 11 Nov 2026, titled "VDEX
Master Continuation Instruction." Filed here per `VACO.md`'s own rule
("if the file exists, append a status section; never replace the
body") — reproduced faithfully below, with the one factual correction
this app's own `README.md` already states: the instruction's own
premise ("continue from the existing VDEX 0.3.24 codebase... do not
start over") does not match reality. No such codebase was found
anywhere accessible to this session. Everything built against this
spec is genuine new engineering, filed as such.

## Implementation status (updated as real work lands — never claimed ahead of code)

| Section | What it asks for | Status |
|---|---|---|
| 1. Initial inspection | Audit existing repo | **Done, and it found nothing to audit** — see correction above |
| 2. Constellation position | VACAY/VOID siblings, no merge | **Revised on direct instruction**: standalone home (#19 in `VACO.md`), closest functional sibling is Vex (`vex-trading/`), not VACAY/VOID |
| 3. National property data | 50 states + DC + territories, 4 data classes | Not started |
| 4. Property intelligence engine | Canonical record, dedup, PostGIS | Not started |
| 5. Foreclosure/wholesaling engine | Lead discovery through disposition | Not started |
| 6. Underwriting engine | Real-estate financial analysis | Not started |
| 7. Assembly/geospatial | Parcel mapping, multi-parcel projects | Not started |
| 8. VACAY connection | Listing sync adapter | Not started — real target confirmed to exist (`vacay/` Home section) |
| 9. DREAMS connection | Distribution adapter | Not started — real target confirmed to exist (`dreams/`, filed under HVNTZ) |
| 10. VACA/VASH/VCoin/VOKEN | Per-service adapters | **VULCAN is disregarded** — per direct correction, it was a mistaken reference and VOKEN is the real entity for tokenization/credentials/trust. VACA/VASH/VCoin/VOKEN are real; adapters not started |
| 11. VACO/VACON platform | Shared auth/permissions/events | Not started — real substrate confirmed (`shared/serviceAuth.js`) |
| 12. AI/automation | Research, scoring, alerts | Not started |
| 13. Supporting marketplaces | Contractors, vendors, PM | Not started |
| 14. Integration framework | Adapters, idempotency, DLQ, audit | Not started — real substrate confirmed (`shared/settleOnce.js` for idempotency) |
| 15. Security/compliance | RBAC, tenant isolation, encryption | Not started |
| 16. Testing | Full suite, migration/rollback tests | Not started — no code exists yet to test |
| 17. Phase order | 11 phases | Phase 1 done (this document); Phase 2 next |
| 18. Deliverables | 13 tracked documents | This file is deliverable #1 (master spec) and #7 (implementation checklist, via the table above) |

## What the founder's own instruction got right, verified against this repo rather than assumed

- VDEX belongs to its own constellation, not merged into VACAY or VOID — confirmed and held.
- VDEX should connect to VACAY rather than rebuild its marketplace — confirmed: `vacay/`'s `Home` section already runs a real Zillow-style listings model.
- Never label an integration `LIVE` without proven live communication — this is the same discipline `vacon-c/CLAUDE.md`'s own standing rules already hold for every real-data claim in that app, carried over here rather than relearned.

## What needed correcting, found rather than assumed

- **"Continue from the existing VDEX 0.3.24 codebase"** — no such codebase exists anywhere this session can reach (checked: this repo, every other repo on the account). Treated as a genuine greenfield build.
- **VULCAN "approved tokenization infrastructure"** — disregarded entirely per direct correction (it was a mistaken reference; VOKEN is the real entity for this role, not a second, separate service). No VULCAN adapter exists or is planned.
- **"Same constellation as VACAY and VOID"** — revised on direct follow-up instruction to a new, standalone 19th home in `VACO.md`, with Vex (`vex-trading/`) as the closer functional sibling by actual deal-evaluation shape.

## The full original instruction (reproduced verbatim, for the record)

See the founder's pasted message of 11 Nov 2026 in this project's
conversation history for the complete 18-section instruction
(national data sources, property intelligence engine, foreclosure/
wholesaling engine, underwriting engine, geospatial assembly,
marketplace/DREAMS/VULCAN/VACA/VASH/VCoin/VOKEN/VACO integrations, AI
automation, supporting marketplaces, integration engineering,
security/compliance, testing, phase order, and required
deliverables). Not re-transcribed here in full to avoid this file
drifting from that source if it is ever revised — the status table
above is the live, maintained summary; the conversation record is the
canonical original text.
