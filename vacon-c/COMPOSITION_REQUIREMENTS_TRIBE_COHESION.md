# VACANCY — Composition Requirements & Tribe Cohesion

Confirming that unlocking a mission doesn't make it easy — real,
specific role-based composition requirements, and internal Tribe
cohesion as a genuine, separate difficulty factor beyond headcount.

Real, specific composition requirements: the Control Key's Population
Requirement should specify a real, specific role-based composition,
not just a raw number — e.g., 5 Enforcers, 10 Youth (general labor/
support), 1 Elder (leadership/legitimacy).

ControlKeyComposition {
  locationId
  requiredRoles: [
    { role: "enforcer", count: 5 },
    { role: "youth-labor", count: 10 },
    { role: "elder", count: 1 }
  ]
}

Internal cohesion — confirmed as a real, separate difficulty factor:
having the right numbers and roles isn't sufficient by itself — the
Tribe's actual internal cohesion matters just as much, using the
existing Family/Tribe trait fields already built (unity, cooperation,
conflictLevel) as a real, direct multiplier on whether an attempt
actually succeeds.

TakeoverAttemptResolution {
  locationId, tribeId
  compositionRequirementMet: boolean
  tribeCohesionScore: number
  finalSuccessProbability: number
}

Why this is the right additional layer: keeps the game from becoming a
simple recruitment-counting exercise. A Tribe can meet every technical
requirement and still fail because the people involved don't actually
work well together.

Status: Takeovers now require both a real, specific role-based
composition and genuine internal Tribe cohesion, pulled directly from
existing unity/cooperation trait fields.
