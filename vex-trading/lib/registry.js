// Vex Trading -- the real, static sub-app registry. Same "static
// array, not a database" posture as vaco-shell's own lib/registry.js,
// scoped down to just this shell's own two real sub-apps rather than
// the whole ecosystem.
//
// Neither sub-app is a UI Vex Trading owns or renders itself:
// - VEX now has its own real frontend (`../vex/public/index.html`,
//   served statically from its own API port, 8816) -- compliance
//   gates, accounts, order entry, the VXC coin market. VDP's own VEX
//   district (`../vdp`, VexView.jsx) is still real too and still the
//   in-world trading floor -- the two are different real surfaces onto
//   the same API, not one standing in for a missing other. `uiUrl`
//   points at VEX's own frontend as the primary surface; `uiNote`
//   still names VDP as the in-world alternate.
// - Vex Business has its own real dashboard (`../vex-business/apps/web`).

export const SUB_APPS = [
  {
    id: 'vex',
    name: 'VEX',
    description: 'Robinhood-style Cvltvre Card brokerage. Has its own real frontend (compliance gates, accounts, order entry) -- VDP\'s own VEX district is a second, real, in-world trading-floor surface onto the same API.',
    apiUrl: 'http://localhost:8816',
    uiUrl: 'http://localhost:8816',
    uiNote: 'Opens VEX\'s own real frontend. VDP\'s VEX district (walk in at localhost:5174) is the same API\'s in-world trading floor.',
  },
  {
    id: 'vex-business',
    name: 'Vex Business',
    description: 'Autonomous futures-trading research platform (ES/5-minute). Real dashboard: pipeline demo, backtest engine, live safety posture.',
    apiUrl: 'http://localhost:9000',
    uiUrl: 'http://localhost:9001',
    uiNote: 'The real Vex Business dashboard.',
  },
];

export function listSubApps() {
  return SUB_APPS;
}

export function getSubApp(id) {
  return SUB_APPS.find((a) => a.id === id) || null;
}
