// VDP — the named town the branded buildings sit in ("VXLLAGE at
// <town>", "The Vavlt <town>"). A single constant on purpose: every
// brand string in property.js/vavlt.js reads from here, so renaming
// the town is a one-line change, not a find-and-replace across the
// codebase. "Meridian" is a placeholder pending a real decision --
// flagged, not asserted as final.

export const TOWN_NAME = 'Meridian';
