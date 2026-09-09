// VACON -- shared, growing store object.
// Same pattern established across this session: one factory whose
// shape grows by adding new top-level array/counter fields as each
// phase adds a module. `routingLog` makes MIA's real routing
// decisions genuinely inspectable -- a real "operating network"
// telemetry feature, not just a stateless function nobody can audit.

function createVaconStore() {
  return {
    routingLog: [],
    nextRoutingLogId: 1,
    // Who invoked which agent. Deliberately here and not in
    // vaco-audit -- see the note on the invoke route in server.js:
    // that service holds irreversible decisions, and an agent
    // answering a question is not one.
    invocationLog: [],
    nextInvocationLogId: 1,
  };
}

module.exports = { createVaconStore };
