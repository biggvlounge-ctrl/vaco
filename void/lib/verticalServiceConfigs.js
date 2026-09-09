// VOID -- every vertical's service app, as configuration.
//
// **All 25 verticals are defined here.** Two of them (petCare, laundry)
// also have hand-written domain modules with depth the engine does not
// try to express; their entries below are kept in sync so
// `describeService` can answer for every vertical uniformly, and are
// marked `hasDedicatedModule`.
//
// **Where the service menus come from.** Each is drawn from what the
// vertical's real comparables actually sell, not invented — the
// comparables are listed on each entry so the derivation is checkable.
// `dev-docs/COMPARABLES_INDEX.md` maps the fuller research.
//
// **What is deliberately NOT here.** Prices. A service menu is a
// product decision that generalises; a price is local, competitive, and
// changes weekly. `verticals.js` holds the pricing *unit* and the take
// rate; the number itself belongs to the provider setting it.

const SERVICE_CONFIGS = {
  // -- A. Relationship & recurrence ------------------------------------
  // The customer wants the same person again. The product is the
  // rebooking, which is why every one of these supports a series and
  // most require an intro session first.

  petCare: {
    archetype: 'recurring',
    hasDedicatedModule: 'lib/petCare.js',
    services: ['walk', 'drop-in', 'daycare', 'boarding', 'grooming', 'training'],
    requiresSubject: true,
    requiresIntroSession: true,
    requiredSubjectAttributes: ['species'],
    defaultDurationMinutes: 30,
    comparables: ['Rover', 'Wag'],
  },

  cleaningHandyman: {
    archetype: 'recurring',
    services: ['standard-clean', 'deep-clean', 'move-out-clean', 'handyman-repair', 'appliance-install'],
    requiresSubject: true,
    // Someone is alone in an empty home with a key.
    requiresIntroSession: true,
    requiredSubjectAttributes: ['propertyType'],
    defaultDurationMinutes: 120,
    comparables: ['Handy', 'TaskRabbit', 'Thumbtack'],
  },

  landscaping: {
    archetype: 'recurring',
    services: ['mow', 'edge-and-trim', 'leaf-removal', 'seasonal-cleanup', 'planting', 'irrigation'],
    requiresSubject: true,
    // Outdoor work, no interior access -- no intro needed.
    requiresIntroSession: false,
    requiredSubjectAttributes: ['lotSizeSqM'],
    defaultDurationMinutes: 60,
    comparables: ['LawnStarter', 'GreenPal'],
  },

  tutoring: {
    archetype: 'recurring',
    services: ['one-to-one', 'small-group', 'exam-prep', 'homework-help'],
    requiresSubject: true,
    requiresIntroSession: true,
    requiredSubjectAttributes: ['subjectArea', 'level'],
    defaultDurationMinutes: 60,
    comparables: ['Wyzant', 'Varsity Tutors'],
  },

  personalTraining: {
    archetype: 'recurring',
    services: ['one-to-one-session', 'small-group', 'programme-design', 'assessment'],
    requiresSubject: false,
    requiresIntroSession: true,
    defaultDurationMinutes: 60,
    comparables: ['Trainiac', 'Fyt'],
  },

  seniorCare: {
    archetype: 'recurring',
    services: ['companionship', 'personal-care', 'meal-preparation', 'medication-reminders', 'transport-assist'],
    requiresSubject: true,
    requiresIntroSession: true,
    requiredSubjectAttributes: ['careNeeds'],
    defaultDurationMinutes: 180,
    comparables: ['Care.com', 'Honor'],
    // Elevated because unsupervised care of a vulnerable adult is
    // where the consequences are highest.
    freeCancellationHours: 48,
  },

  childcare: {
    archetype: 'recurring',
    services: ['babysitting', 'after-school', 'full-day', 'overnight'],
    requiresSubject: true,
    requiresIntroSession: true,
    requiredSubjectAttributes: ['childAgeYears'],
    defaultDurationMinutes: 240,
    comparables: ['Care.com', 'UrbanSitter'],
    freeCancellationHours: 48,
  },

  // -- B. Round trip with work in the middle ---------------------------
  // Pickup and delivery ARE the service, and the price is not known
  // until the item is assessed.

  laundry: {
    archetype: 'round-trip',
    hasDedicatedModule: 'lib/laundry.js',
    services: ['wash-and-fold', 'dry-cleaning', 'wash-only', 'press-only'],
    requiresSubject: false,
    defaultDurationMinutes: 45,
    comparables: ['Rinse', 'Tide Cleaners'],
  },

  autoRepairDetailing: {
    archetype: 'round-trip',
    services: ['oil-change', 'brake-service', 'diagnostic', 'detail-interior', 'detail-exterior', 'tyre-service'],
    requiresSubject: true,
    requiredSubjectAttributes: ['makeModel'],
    defaultDurationMinutes: 120,
    comparables: ['YourMechanic', 'Spiffy'],
    // Whole-currency-unit rounding: nobody quotes a repair to the cent.
    roundsToWholeUnits: true,
  },

  wasteRemoval: {
    archetype: 'round-trip',
    services: ['single-item', 'partial-load', 'full-load', 'construction-debris', 'appliance-removal'],
    requiresSubject: false,
    defaultDurationMinutes: 60,
    comparables: ['1-800-GOT-JUNK', 'LoadUp'],
    roundsToWholeUnits: true,
  },

  // -- C. Appointment with a specialist --------------------------------
  // A slot with a named person at a known price. The cancellation
  // policy is the commercial mechanism, because an empty slot is the
  // loss.

  beauty: {
    archetype: 'appointment',
    services: ['haircut', 'colour', 'blowout', 'manicure', 'pedicure', 'makeup', 'barbering'],
    requiresSubject: false,
    defaultDurationMinutes: 60,
    comparables: ['StyleSeat', 'Booksy', 'GlamSquad'],
    // Short-notice cancellation is the defining problem of this
    // category -- a stylist's day is a grid of slots.
    freeCancellationHours: 24,
    lateFeeRate: 0.5,
  },

  photography: {
    archetype: 'appointment',
    services: ['portrait', 'event', 'product', 'headshot', 'real-estate'],
    requiresSubject: false,
    defaultDurationMinutes: 120,
    comparables: ['Thumbtack', 'Snappr'],
    freeCancellationHours: 72,
  },

  eventPlanning: {
    archetype: 'appointment',
    services: ['consultation', 'day-of-coordination', 'full-planning', 'vendor-sourcing'],
    requiresSubject: false,
    defaultDurationMinutes: 90,
    comparables: ['Thumbtack', 'The Bash'],
    freeCancellationHours: 168,
  },

  notaryLegal: {
    archetype: 'appointment',
    services: ['document-notarisation', 'mobile-notary', 'loan-signing', 'apostille-prep'],
    requiresSubject: false,
    defaultDurationMinutes: 30,
    comparables: ['Notarize', 'NotaryCam'],
  },

  itTechSupport: {
    archetype: 'appointment',
    services: ['diagnostic', 'device-repair', 'setup-and-install', 'data-recovery', 'network-setup'],
    requiresSubject: true,
    requiredSubjectAttributes: ['deviceType'],
    defaultDurationMinutes: 60,
    comparables: ['Puls', 'Geek Squad'],
  },

  // -- D. Quote first ---------------------------------------------------
  // The work cannot be priced from a form. Someone must assess.

  freightMoving: {
    archetype: 'quote',
    services: ['local-move', 'long-distance-move', 'single-item', 'loading-only', 'packing'],
    requiresSubject: false,
    defaultDurationMinutes: 240,
    comparables: ['Dolly', 'Lugg', 'uShip'],
    roundsToWholeUnits: true,
  },

  freelance: {
    archetype: 'quote',
    services: ['writing', 'design', 'development', 'video-editing', 'consulting'],
    requiresSubject: false,
    defaultDurationMinutes: 480,
    comparables: ['Upwork', 'Fiverr'],
  },

  realEstateMedia: {
    archetype: 'quote',
    hasDedicatedModule: 'lib/realEstateMedia.js',
    services: ['photos', 'video-walkthrough', 'aerial-drone', '3d-tour', 'floor-plan'],
    requiresSubject: true,
    requiredSubjectAttributes: ['propertyType'],
    defaultDurationMinutes: 90,
    comparables: ['HomeJab'],
  },

  security: {
    archetype: 'quote',
    services: ['event-security', 'static-guard', 'patrol', 'fire-watch', 'executive-protection'],
    requiresSubject: false,
    defaultDurationMinutes: 480,
    comparables: ['Calvis', 'Guardy', 'Fast Guard'],
  },

  // -- E. Shift & dispatch ----------------------------------------------
  // No relationship, no quote. Volume, speed, utilisation. These are
  // what VOID was originally built for, and their real mechanics live
  // in dispatchIntelligence.js / marketplace.js -- the entries here
  // exist so every vertical is describable through one interface.

  transportation: {
    archetype: 'appointment',
    services: ['ride', 'black', 'xl', 'carpool', 'scoot'],
    requiresSubject: false,
    defaultDurationMinutes: 30,
    comparables: ['Uber', 'Lyft'],
    freeCancellationHours: 0.08, // ~5 minutes; dispatch, not a booking
  },

  courier: {
    archetype: 'appointment',
    services: ['same-day', 'scheduled', 'return-pickup', 'multi-stop'],
    requiresSubject: false,
    defaultDurationMinutes: 45,
    comparables: ['Roadie', 'Postmates'],
    freeCancellationHours: 0.08,
  },

  foodDelivery: {
    archetype: 'appointment',
    services: ['restaurant-delivery', 'grocery-delivery', 'convenience', 'catering-delivery'],
    requiresSubject: false,
    defaultDurationMinutes: 40,
    comparables: ['DoorDash', 'Uber Eats', 'Grubhub', 'Instacart'],
    freeCancellationHours: 0.08,
  },

  staffing: {
    archetype: 'appointment',
    hasDedicatedModule: 'lib/staffing.js',
    services: ['hospitality-shift', 'warehouse-shift', 'retail-shift', 'event-shift'],
    requiresSubject: false,
    defaultDurationMinutes: 480,
    comparables: ['Instawork', 'Bluecrew'],
    freeCancellationHours: 24,
  },

  // -- Licensing-gated ---------------------------------------------------
  // Configured for completeness so the service app exists the moment
  // licensing clears. `requestJob` and `canWorkVertical` both still
  // refuse these; nothing here relaxes that.

  cannabisDelivery: {
    archetype: 'appointment',
    services: ['scheduled-delivery', 'express-delivery'],
    requiresSubject: false,
    defaultDurationMinutes: 45,
    comparables: ['Eaze', 'Weedmaps'],
  },

  medicalTransportation: {
    archetype: 'appointment',
    services: ['ambulatory', 'wheelchair', 'stretcher', 'recurring-treatment-transport'],
    requiresSubject: true,
    requiredSubjectAttributes: ['mobilityNeeds'],
    defaultDurationMinutes: 60,
    comparables: ['Roundtrip', 'ModivCare'],
    freeCancellationHours: 24,
  },
};

module.exports = { SERVICE_CONFIGS };
