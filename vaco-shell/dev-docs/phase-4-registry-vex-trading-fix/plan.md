# Plan — Phase 4: registry fix + Vex Trading entry

## Real investigation before any code
Checked `lib/registry.js` directly for a "numbered app" convention
before assuming one existed anywhere in this ecosystem — none does;
it's a flat, static array with no index field. Also found a real,
stale bug while checking VENVS's own entry: its description still
read "...Shop, Marketplace, Publishing, VEX, VADO" — accurate when
written, but VENVS's own `vex.js` was deleted outright when VOKEN
became canonical for VEX/VADO (an earlier phase, `../venvs/README.md`'s
own Phase 12), and this registry line was never updated to match. Not
assumed — confirmed by reading `../venvs/README.md` directly.

## Changes
- VENVS's description: dropped the stale "VEX" mention (VADO stays,
  since VENVS never built its own VADO — this description was always
  listing sibling divisions, not claiming to host both).
- New entry: `vex-trading` (Vex Trading, the new parent shell over VEX
  and Vex Business — see `../vex-trading/README.md`), port 8814,
  category `consumer`.

## Verification approach
Booted `vaco-shell` live, called `GET /api/apps`, confirmed both real:
VENVS's description no longer mentions VEX, and the new `vex-trading`
entry is present with the right id/url/category.
