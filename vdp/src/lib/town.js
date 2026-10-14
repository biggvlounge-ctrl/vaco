// VDP — the named town the branded buildings sit in ("VXLLAGE at
// <town>", "The Vavlt <town>"). A single constant on purpose: every
// brand string in property.js/vavlt.js reads from here, so renaming
// the town is a one-line change, not a find-and-replace across the
// codebase.
//
// **"Meridian" retired (14 Oct 2026), per direct instruction**:
// "instead of the meridian, it will be the four countries that are
// ran by the Vaco system... the four starter lands that are ran by
// the families that came over and built what's going on." There is
// no separate hidden settlement a tech team secretly found anymore --
// see `VDP_FOUNDING.md`'s own dated correction. This town is now real
// as the starter CAPITAL of one of the four real mainland countries
// (`worldAtlas.js`'s `MAINLAND_COUNTRIES[0]`, named Ironreach) --
// reusing the master lore document's own already-given placeholder
// for exactly this slot ("Founders' Capital," §6's own example city
// name for a mainland country's first city), rather than inventing a
// new one. Still flagged, not asserted as final -- the same standing
// every other placeholder name in this project carries.
export const TOWN_NAME = "Founders' Capital";
