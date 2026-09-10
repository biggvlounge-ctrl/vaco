// VACO -- generates deploy/ecosystem.config.js from the same
// authoritative app/path/port manifest as start-ecosystem.sh /
// generate-docker-compose.js / generate-nginx-conf.js.
//
// **Why this exists.** `generate-docker-compose.js`'s own header says a
// new app added to the manifest "can never silently drift out of the
// Docker deployment the way it can't drift out of pm2 or nginx
// either." Half of that was true. nginx and Compose really are
// generated from the manifest. `ecosystem.config.js` was not: it said
// "Generated from the same authoritative app/path/port manifest" and
// the README said it "is not meant to be hand-edited; re-run the same
// generation this file was built with" -- but no such generator was
// ever committed, so the only way to change the file was by hand, and
// hands forget.
//
// By the time anyone checked, it had drifted by six apps. `pm2 start
// deploy/ecosystem.config.js` on a real VPS would have brought up 28
// of the 34 backends and left these six down:
//
//   vaco-audit      the decision log every group-2 route writes to
//   vaco-operator   the authority service that grants operator roles
//   vaco-media      live sessions and recorded-asset registration
//   vaco-notify     the notification channel vsafe/dreams/analytics use
//   vex             the trading app
//   vex-trading     its market-data backend
//
// Nothing would have crashed at boot. The apps that call them fail
// soft on signals by standing rule, so the failure mode was an
// ecosystem that starts clean, reports 28/28 online, and silently
// records no decisions, grants no roles and sends no notifications.
// That is the exact shape of the VACO_NOTIFY_URL bug the Compose
// generator's own table carries a `//:` note about -- a real cross-app
// call landing nowhere, in production, with every health check green.
//
// So the file is now genuinely generated, and
// `scripts/test/deploy-readme.test.mjs` holds the committed output
// against this manifest rather than trusting the header.
//
// **What is deliberately NOT injected.** The Compose generator
// rewrites every cross-app `*_API_URL` to a container DNS name,
// because containers cannot reach each other on `localhost`. pm2 runs
// every app on one host, where each app's own
// `http://localhost:<port>` default is already correct. Secrets and
// tokens come from the operator's real environment (`.env` / shell) as
// they do for any pm2 deployment. Only PORT and NODE_ENV are set here,
// which is what the hand-written file set too.
//
// Usage:
//   node deploy/generate-ecosystem-config.js

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const src = fs.readFileSync(path.join(ROOT, "start-ecosystem.sh"), "utf8");
const match = src.match(/APPS=\(([\s\S]*?)\n\)/);
if (!match) {
  throw new Error("generate-ecosystem-config: could not find the APPS=( ... ) manifest in start-ecosystem.sh");
}
const lines = match[1].split("\n").map((l) => l.trim()).filter((l) => l.startsWith('"'));
const apps = lines.map((l) => {
  const [name, appPath, cmd, port] = l.slice(1, -1).split(":");
  return { name, appPath, cmd, port };
});

// The two real Vite frontends are `npm run dev` in the manifest and
// every backend is `npm start`. That is the same distinction the
// Compose generator makes when it picks Dockerfile.vite over
// Dockerfile.node, read from the same field rather than re-listed
// here -- a third hand-maintained list of frontends is precisely the
// thing this file exists to stop.
// **Split on the entry point, not on the command string.** This read
// `a.cmd === "npm start"` until the manifest changed those to
// `node server.js` to save a process per app. Both filters would then
// have matched nothing: zero backends, every app a "frontend", and a
// pm2 config with no processes in it -- generated successfully, with
// no error, because an empty filter is not a failure.
//
// The real distinction is what the app IS: a Node service with a
// server.js, or a Vite dev server. Ask that, and a future change to
// how the command is spelled cannot silently invert the answer.
const backends = apps.filter((a) => fs.existsSync(path.join(ROOT, a.appPath, "server.js")));
const frontends = apps.filter((a) => !fs.existsSync(path.join(ROOT, a.appPath, "server.js")));

if (backends.length === 0) {
  throw new Error(
    "generate-ecosystem-config: no app in the manifest has a server.js. A pm2 config with no "
    + "processes generates cleanly and starts nothing, so this refuses rather than writing it.",
  );
}

// pm2's `script` is resolved relative to `cwd`. Every backend in the
// manifest is a plain Express app whose entry point is `server.js`;
// assert it rather than assume it, because a missing file here is a
// process pm2 restarts ten times and then gives up on, at 3am, on
// somebody else's server.
// Kept, though `backends` is now defined BY having a server.js, so
// this can no longer fire. That is the point: the assertion moved from
// runtime into the definition, which is strictly better than checking
// it afterwards. Left as an explicit statement of the invariant rather
// than deleted, so the next person to loosen the filter above finds
// out here.
const missing = backends.filter((a) => !fs.existsSync(path.join(ROOT, a.appPath, "server.js")));
if (missing.length > 0) {
  throw new Error(
    `generate-ecosystem-config: ${missing.map((a) => `${a.name} (${a.appPath}/server.js)`).join(", ")} `
    + "has no server.js. Either the manifest path is wrong or the app has a different entry point -- "
    + "this generator assumes server.js for every `npm start` app.",
  );
}

const header = `// VACO -- pm2 process list for production deployment.
//
// **GENERATED FILE -- do not edit.** Re-run:
//
//     node deploy/generate-ecosystem-config.js
//
// after adding or removing an app in start-ecosystem.sh's own APPS
// array, which is the authoritative app/path/port manifest for this
// ecosystem. \`scripts/test/deploy-readme.test.mjs\` fails if this file
// stops matching that manifest, which is how six apps that had quietly
// dropped out of the pm2 deployment were found.
//
// ${backends.length} real Express backends. The ${frontends.length} Vite frontends (${frontends.map((a) => a.name).join(", ")})
// are deliberately NOT pm2-managed here -- they get a real production
// build (npm run build) and are served as static files by nginx
// instead, since the Vite dev server used by start-ecosystem.sh (for
// local dev) is not meant to hold production traffic. See the
// deployment guide for the full build + nginx steps.
//
// Usage:
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup        (then run the printed command once, as root)
//
// Redeploy after a code update:
//   pm2 reload ecosystem.config.js --update-env
`;

const entries = backends.map((a) => `    {
      name: "${a.name}",
      cwd: "./${a.appPath}",
      script: "server.js",
      env: { PORT: "${a.port}", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },`).join("\n");

const out = `${header}module.exports = {
  apps: [
${entries}
  ],
};
`;

fs.writeFileSync(path.join(__dirname, "ecosystem.config.js"), out);
console.error(`Wrote deploy/ecosystem.config.js (${backends.length} pm2-managed backends, `
  + `${frontends.length} Vite frontends excluded).`);
