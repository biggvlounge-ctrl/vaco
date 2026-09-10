# VACANCY — Player Death & Generational Continuity

Real death, real causes, real grief — and a death mechanic built
specifically to match the civilization-and-legacy feeling already
established, rather than a generic permadeath or respawn system.

Real, confirmed causes of death: violent, gun-related death genuinely
becomes rarer over time as ammunition depletes (the already-
established bullet scarcity system) — but death never disappears.
Illness, age, and crime-related death remain real, ongoing causes
throughout, tied directly to the existing NPC lifecycle (Birth → ... →
Aging → Death → Legacy) and the Healthcare/Crime systems already
built.

Real, confirmed grief backdrop: many people already died during the
reset itself — this is real, existing emotional context every player
and NPC carries in, not something introduced only when a player
character eventually dies. Ties directly to the existing Memory system
(traumatic memories resist normal decay) and the Relationship system's
grief-adjacent fields already established.

The real death mechanic — generational continuity, not permadeath or
simple respawn: given this is fundamentally a civilization and legacy
simulation, not just an individual character sim, the right mechanic
is neither harsh permadeath nor a trivial respawn. When a player's NPC
dies, the player continues playing as a real, related family member —
an heir, a sibling, or a grown child — who genuinely inherits the
deceased's legacy.

Why this is the right fit: uses systems already fully built — the
existing Inheritance resolution priority (Will → Family → Organization
→ Government → Auction → Abandoned → Disputed) already determines who
receives property and assets. The existing Legacy Score and Reputation
carry forward to the successor, appropriately reduced but not erased.
The existing Family Bloodline/Generational system already tracks
exactly this kind of succession. The existing Memory system lets the
successor genuinely remember and grieve the person they're continuing
for.

PlayerGenerationalContinuity {
  deceasedNpcId, playerId
  successorNpcId: string
  inheritedLegacyScore: number
  inheritedReputation: number
  inheritedProperty: [string]
  successorGriefMemory: {
    memoryType: "traumatic"
    relatedEntityId: "deceased_npc_id"
    resistsNormalDecay: true
  }
}

What happens if no real family member is available: the successor
comes from the deceased's closest real relationship (a mentor's
apprentice, a tribe member) — using the existing relationships table's
trust/loyalty fields to determine who's the most fitting continuation.

Why this genuinely matches the intended feeling: keeps death real and
consequential — genuine loss, genuine grief, real reduction in
standing — without erasing the player's investment in the world
entirely. Individual lives end, but the family, the tribe, and the
legacy continue.

Status: a real, specific death mechanic reasoned directly from what
already exists — the Inheritance system, Legacy Score, Family
Bloodline, and Memory/Grief systems combine into generational
continuity rather than permadeath or simple respawn.
