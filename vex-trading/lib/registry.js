// Vex Trading -- the real, static sub-app registry. Same "static
// array, not a database" posture as vaco-shell's own lib/registry.js,
// scoped down to just this shell's own two real sub-apps rather than
// the whole ecosystem.
//
// Neither sub-app is a UI Vex Trading owns or renders itself:
// - VEX's real trading-floor UI lives inside VDP's own VEX district
//   (`../vdp`, VexView.jsx) -- VEX itself is an API-only backend
//   (`../vex`). `uiUrl` points at VDP, honestly labeled as "not VEX's
//   own UI," rather than pretending VEX has a dedicated frontend it
//   doesn't.
// - Vex Business has its own real dashboard (`../vex-business/apps/web`).

export const SUB_APPS = [
  {
    id: 'vex',
    name: 'VEX',
    description: 'Robinhood-style Cvltvre Card brokerage. Real backend only -- its live trading-floor UI is VDP\'s own VEX district.',
    apiUrl: 'http://localhost:8816',
    uiUrl: 'http://localhost:5174',
    uiNote: 'Opens VDP -- walk into the VEX district for the real trading floor.',
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
