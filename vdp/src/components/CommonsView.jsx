import { classifyMeridian } from "../lib/cityTiers.js";

// Meridian Commons -- the real landscape cityTiers.js describes
// (water feature, nature trails, farm distribution at the top two
// tiers, casino eligibility, building-height direction), made
// walkable. Per direct instruction: "landscapes very natural trails
// lagoons at the largest we want fishing spots," "a small farm
// distribution" at tiers 4-5, "different scales of the heights of the
// buildings." Read live from classifyMeridian(), not hardcoded --
// this panel (and the matching canvas treatment in WorldView.jsx)
// changes the moment Meridian's own real amenity coverage does.
//
// Purely informational, same as My Status's needs/goal readout --
// nothing here moves money or state, there is no "activity" to do in
// a trail or a lagoon that any real VDP/VOID/VACAY system models yet.

export default function CommonsView() {
  const tier = classifyMeridian();

  if (!tier) {
    return (
      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 8px 0" }}>Meridian Commons</h2>
        <p style={{ fontSize: 12, color: "#888" }}>Meridian doesn't yet qualify for a real city tier -- no landscape assigned.</p>
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px 0" }}>Meridian Commons</h2>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px" }}>
        Meridian's own real landscape, scaled by its {tier.name} classification.
      </p>

      <ul style={{ fontSize: 13, margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
        <li>
          <strong>{tier.waterFeature}</strong>
          {tier.hasFishing && " -- real fishing spots"}
        </li>
        <li>{tier.trailMiles} miles of natural walking trails</li>
        <li>
          {tier.hasFarmDistribution
            ? "Small farm distribution feeding Meridian's dining amenity"
            : "No farm distribution at this tier (tiers 4-5 only)"}
        </li>
        <li>
          Casino-eligible -- see the Venus Resort Complex / VAGO,
          Meridian's own real casino
        </li>
        <li>
          Buildings: <strong>{tier.buildingHeightTier}</strong>
        </li>
      </ul>
    </div>
  );
}
