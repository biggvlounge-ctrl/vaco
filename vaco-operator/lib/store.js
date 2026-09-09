// VACO OPERATOR — the store factory.
//
// Three collections, and the shape is the design:
//
//   operators  a person who may hold authority. Has a credential.
//   grants     one operator + one scope. Never a list of scopes on an
//              operator, because a grant carries its own provenance:
//              who granted it, when, and whether it was revoked.
//   (no roles) there is deliberately no role/group indirection. A
//              "role" that bundles scopes is the wildcard problem with
//              extra steps: it grows, nobody prunes it, and the answer
//              to "what can this person do" stops being readable.

function createOperatorStore() {
  return {
    operators: [],
    nextOperatorId: 1,
    grants: [],
    nextGrantId: 1,
  };
}

module.exports = { createOperatorStore };
