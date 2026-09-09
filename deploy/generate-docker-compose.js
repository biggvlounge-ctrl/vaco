// VACO -- generates docker-compose.yml from the same authoritative
// app/path/port manifest as start-ecosystem.sh / ecosystem.config.js /
// nginx-vaco.conf.example -- one source of truth, so a new app added
// to the manifest can never silently drift out of the Docker
// deployment the way it can't drift out of pm2 or nginx either.
//
// Every real Express backend builds from the shared deploy/Dockerfile.node;
// the two real Vite frontends (vdp, venvs) build from
// deploy/Dockerfile.vite. Every app that calls another app over HTTP
// (checked directly against every real `process.env.*_API_URL`
// reference in this repo's own server.js files, not guessed) gets that
// var rewritten from its bare-metal `http://localhost:<port>` default
// to the real Docker Compose service DNS name (`http://<service>:<port>`)
// -- containers can't reach each other via `localhost`, only by
// service name on the shared `vaco` network. Every app confirmed to
// use `lib/persistence.js` (grep-verified) gets a real named volume
// mounted at `/app/data`, so `docker compose down` (without `-v`)
// doesn't silently wipe state the way an ungrounded default would.
//
// Usage:
//   node deploy/generate-docker-compose.js
//   node deploy/generate-nginx-conf.js --docker
//   docker compose up --build

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const src = fs.readFileSync(path.join(ROOT, "start-ecosystem.sh"), "utf8");
const match = src.match(/APPS=\(([\s\S]*?)\n\)/);
const lines = match[1].split("\n").map((l) => l.trim()).filter((l) => l.startsWith('"'));
const apps = lines.map((l) => {
  const inner = l.slice(1, -1);
  const [name, appPath, cmd, port] = inner.split(":");
  return { name, appPath, cmd, port: Number(port) };
});

// Real, grep-verified cross-app HTTP call targets -- every
// `process.env.<VAR>_URL` this repo's own server.js files actually
// read, mapped to the Compose service name that owns it. Kept as an
// explicit table (not derived automatically) so a rename on either
// side is a visible, deliberate edit here, not a silent regex match.
const ENV_VAR_TO_SERVICE = {
  CHOPZ_SHOP_API_URL: "chopz-shop",
  CVNVO_API_URL: "cvnvo",
  HVNTZ_API_URL: "hvntz",
  SHIELD_API_URL: "shield",
  V3_API_URL: "v3",
  V4_PROXY_URL: "v4-proxy",
  VACA_API_URL: "vaca",
  VACON_API_URL: "vacon",
  VACO_ANALYTICS_URL: "vaco-analytics",
  VACO_AUDIT_URL: "vaco-audit",
  VACO_OPERATOR_URL: "vaco-operator",
  VACO_MEDIA_URL: "vaco-media",
  //: Absent from this table until 2026-08-28, while vsafe, dreams and
  //: vaco-analytics all read it. All three fell back to
  //: `http://localhost:8818`, which inside a container is the container
  //: itself -- so every notification the ecosystem raised was refused by
  //: nothing and swallowed by three deliberately-silent catch blocks.
  //: The channel worked in local dev and was dead in Docker.
  VACO_NOTIFY_URL: "vaco-notify",
  VAULT_STVDIOS_API_URL: "vavlt-stvdios",
  VAVLT_STVDIOS_API_URL: "vavlt-stvdios",
  VOID_API_URL: "void",
  //: Found by scripts/test/cross-app-urls.test.mjs the moment that check
  //: existed -- `vex/lib/vokenClient.js` reads it to look up a Cvltvre
  //: card and its edition. Same shape as the VACO_NOTIFY_URL gap: a real
  //: cross-app call falling back to localhost inside a container.
  VOKEN_API_URL: "voken",
  VSAFE_API_URL: "vsafe",
  VULTURE_FLIX_API_URL: "vulture-flix",
  VULTURE_MUSIC_API_URL: "vulture-music",
  YAP_API_URL: "yap",
};

// Apps that actually write to a real `data/store.json` via
// `lib/persistence.js` -- everyone else stays in-memory-only, same as
// running them directly with `npm start`, so no volume is invented for
// an app that wouldn't use one anyway.
//
// **This was a hardcoded list, and the same bug bit it twice.** Its
// own comment said "Real, grep-verified list (`grep -l
// createPersistentStore */server.js`)" and recorded the first miss:
// vex persisted, was absent here, and its container lost its store on
// every restart. It was added, the comment was updated -- and then
// `vaco-notify` shipped, persisted, and was absent for exactly the
// same reason. `scripts/deploy-preflight.mjs` found it: "writes to
// /app/data but compose mounts no volume there".
//
// A list that claims to be the output of a command should be the
// output of that command. So the grep is now run rather than
// transcribed, and the third app to persist gets its volume without
// anybody remembering to add it.
const PERSISTED_APPS = new Set(
  apps
    .filter((app) => {
      try {
        return /createPersistentStore/
          .test(fs.readFileSync(path.join(ROOT, app.appPath, "server.js"), "utf8"));
      } catch {
        // A Vite frontend has no server.js and no store.
        return false;
      }
    })
    .map((app) => app.name),
);

// A derivation that silently finds nothing would emit a compose file
// where every app is in-memory -- valid YAML, and every store in the
// ecosystem lost on `docker compose restart`.
if (PERSISTED_APPS.size === 0) {
  throw new Error(
    "generate-docker-compose: no app appears to call createPersistentStore. "
    + "That is almost certainly a broken scan rather than an ecosystem with no state; "
    + "refusing to write a compose file that mounts no volumes.",
  );
}

const services = {};
const volumes = {};

for (const app of apps) {
  const isVite = app.cmd === "npm run dev";
  const dockerfile = isVite ? "deploy/Dockerfile.vite" : "deploy/Dockerfile.node";

  const environment = { PORT: String(app.port) };
  // Real, per-app scoping -- only sets a cross-app URL var if this
  // app's own server.js actually reads it (checked directly against
  // the real file on disk), not every var blasted into every service.
  let serverSrc = "";
  try {
    serverSrc = fs.readFileSync(path.join(ROOT, app.appPath, "server.js"), "utf8");
  } catch {
    // no server.js (shouldn't happen for an `npm start`/`npm run dev`
    // entry in the manifest) -- leave environment at just PORT.
  }
  // ...plus lib/, because not every cross-app call lives in server.js.
  // `vaco-shell` and `vxllage` both reach V3 through their own
  // `lib/v3Client.js`, so scanning server.js alone would have shipped
  // them without a V3 service credential -- which, now that V3
  // enforces, is a container that boots fine and 401s on every
  // settlement. Exactly the kind of gap that only shows up in
  // production.
  //
  // `.cjs` counts, and that omission was itself a live bug: every
  // module `sync-shared-runtime.sh` copies lands as `.cjs` (the two ESM
  // apps parse a bare `.js` as ESM), so a `.js`-only scan reads none of
  // shieldAuth, serviceAuth or decisionLog. `VACO_AUDIT_URL` lives in
  // `lib/decisionLog.cjs` and nowhere else -- scanning `.js` alone
  // shipped seven containers pointing their decision log at
  // `localhost:8819`, which in a container is *itself*. In enforce mode
  // that is every group-2 route 503ing on a service that is up.
  try {
    const libDir = path.join(ROOT, app.appPath, "lib");
    for (const file of fs.readdirSync(libDir)) {
      if (file.endsWith(".js") || file.endsWith(".cjs")) {
        serverSrc += fs.readFileSync(path.join(libDir, file), "utf8");
      }
    }
  } catch {
    // no lib/ -- fine, plenty of apps keep everything in server.js.
  }
  for (const [envVar, serviceName] of Object.entries(ENV_VAR_TO_SERVICE)) {
    if (!serverSrc.includes(`process.env.${envVar}`)) continue;
    const target = apps.find((a) => a.name === serviceName);
    if (target) environment[envVar] = `http://${serviceName}:${target.port}`;
  }
  // v4-proxy is the one app with a real, required external secret --
  // never invented a default for this, same honesty as the app's own
  // "FATAL: ANTHROPIC_API_KEY is not set" startup check.
  if (app.name === "v4-proxy") {
    environment.ANTHROPIC_API_KEY = "${ANTHROPIC_API_KEY:?Set ANTHROPIC_API_KEY in a .env file at the repo root}";
  }

  // -- Trusted-service credentials -------------------------------------
  //
  // A service credential has two ends and they need different env vars.
  // Conflating them is how this block was wrong until now:
  //
  //   verifier  runs `createServiceAuth()` and checks incoming
  //             credentials. Needs VACO_SERVICE_TOKENS (the allowlist)
  //             and VACO_SERVICE_AUTH_MODE.
  //   caller    presents a credential to somebody else. Needs
  //             VACO_SERVICE_NAME and VACO_SERVICE_TOKEN (singular).
  //
  // Most apps are both. The previous version hardcoded `app.name ===
  // "v3"` as the only verifier, back when it was -- serviceAuth has
  // since spread to 22 apps, and every one of the other 21 was being
  // generated with *no allowlist at all*. An empty allowlist is not
  // permissive: `classify()` returns 'unauthenticated' for every
  // credential it cannot find, so in `enforce` those containers 401
  // every mutating server-to-server call while looking perfectly
  // healthy. Deriving the role from the source is what stops that from
  // silently recurring the next time serviceAuth reaches a new app.
  //
  // The `\b` in the caller test is load-bearing: plain
  // `includes("VACO_SERVICE_TOKEN")` also matches VACO_SERVICE_TOKENS,
  // which handed a *client* token to pure verifiers like vaco-audit
  // that never call anyone.
  //
  // `:?` on every one of these is deliberate. A missing token would
  // otherwise start a container that boots healthy and fails only when
  // money moves.
  const isVerifier = /createServiceAuth\s*\(/.test(serverSrc);
  const isCaller = /process\.env\.VACO_SERVICE_TOKEN\b/.test(serverSrc);
  if (isVerifier) {
    environment.VACO_SERVICE_TOKENS =
      "${VACO_SERVICE_TOKENS:?Set VACO_SERVICE_TOKENS in .env -- see .env.example}";
    environment.VACO_SERVICE_AUTH_MODE = "${VACO_SERVICE_AUTH_MODE:-enforce}";
  }
  if (isCaller) {
    environment.VACO_SERVICE_NAME = app.name;
    environment.VACO_SERVICE_TOKEN =
      `\${VACO_TOKEN_${app.name.toUpperCase().replace(/-/g, "_")}:?Set a V3 service token for ${app.name} in .env}`;
  }

  // The decision log's mode, for the apps that record decisions. Left
  // overridable with a default rather than `:?` because `observe` is
  // the documented lever for riding out a vaco-audit outage -- it has
  // to be reachable without editing a generated file.
  //
  // Matched on the bare name, not `process.env.` + name: decisionLog
  // reads it as `env.VACO_AUDIT_MODE` through a `readMode(env =
  // process.env)` parameter, so the literal prefix is never in the
  // source. The URL table above can stay strict because every var in it
  // is read directly off `process.env`; this one cannot.
  if (/\bVACO_AUDIT_MODE\b/.test(serverSrc)) {
    environment.VACO_AUDIT_MODE = "${VACO_AUDIT_MODE:-enforce}";
  }

  // Same shape for operator authority, and one addition: the service
  // itself needs its bootstrap seed. `:-` with an empty default rather
  // than `:?`, because "no operators yet" is the correct starting state
  // for an authority service -- see scope doc §3.5.
  if (/\bVACO_OPERATOR_MODE\b/.test(serverSrc)) {
    environment.VACO_OPERATOR_MODE = "${VACO_OPERATOR_MODE:-enforce}";
  }
  // The media transport: which SFU, and where. Defaults to loopback --
  // the control plane runs and says plainly that nothing will connect --
  // so a stack comes up honest rather than either broken or pretending.
  if (app.name === "vaco-media") {
    environment.VACO_MEDIA_TRANSPORT = "${VACO_MEDIA_TRANSPORT:-loopback}";
    environment.LIVEKIT_URL = "${LIVEKIT_URL:-ws://livekit:7880}";
    environment.LIVEKIT_API_KEY = "${LIVEKIT_API_KEY:-}";
    environment.LIVEKIT_API_SECRET = "${LIVEKIT_API_SECRET:-}";
    // Storage for recorded assets. Same shape, same reason: `local`
    // runs the catalogue with no bytes behind it and says so, rather
    // than the stack coming up either broken or pretending.
    environment.VACO_MEDIA_STORAGE = "${VACO_MEDIA_STORAGE:-local}";
    environment.VACO_MEDIA_S3_ENDPOINT = "${VACO_MEDIA_S3_ENDPOINT:-}";
    environment.VACO_MEDIA_S3_BUCKET = "${VACO_MEDIA_S3_BUCKET:-}";
    environment.VACO_MEDIA_S3_REGION = "${VACO_MEDIA_S3_REGION:-us-east-1}";
    environment.VACO_MEDIA_S3_ACCESS_KEY = "${VACO_MEDIA_S3_ACCESS_KEY:-}";
    environment.VACO_MEDIA_S3_SECRET_KEY = "${VACO_MEDIA_S3_SECRET_KEY:-}";
    environment.VACO_MEDIA_CDN_BASE = "${VACO_MEDIA_CDN_BASE:-}";
  }
  if (app.name === "vaco-operator") {
    environment.VACO_OPERATOR_BOOTSTRAP = "${VACO_OPERATOR_BOOTSTRAP:-}";
  }

  // -- Build-context hygiene, enforced ---------------------------------
  //
  // `COPY . .` takes everything in the app directory that .dockerignore
  // does not exclude, and an image is a distributable artifact. Two of
  // these were real, live problems found the first time anyone looked:
  //
  //   .env   `v4-proxy/.env` holds a live Anthropic key, and none of the
  //          .dockerignore files excluded it -- the key would have been
  //          baked into the image.
  //   data/  `vex/` and `vex-trading/` had no .dockerignore at all, so
  //          `vex/data/store.json` would ship inside the image. Docker
  //          SEEDS a fresh named volume from image content, so that
  //          local dev data would have become the deployed starting
  //          state: real balances and orders, shipped.
  //
  // Checked here rather than trusted, because the generator is the last
  // place that sees every app before it becomes a build instruction, and
  // this check runs in CI already.
  const REQUIRED_IGNORES = ["node_modules/", "data/", ".env"];
  const ignorePath = path.join(ROOT, app.appPath, ".dockerignore");
  let ignoreSrc = null;
  try {
    ignoreSrc = fs.readFileSync(ignorePath, "utf8");
  } catch { /* handled below */ }
  if (ignoreSrc === null) {
    throw new Error(
      `${app.name}: no .dockerignore in ${app.appPath}/ -- \`COPY . .\` would bake ` +
      `node_modules/, data/ and any .env into the image. Add one before deploying.`,
    );
  }
  const ignoreLines = new Set(
    ignoreSrc.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")),
  );
  const missing = REQUIRED_IGNORES.filter((entry) => !ignoreLines.has(entry));
  if (missing.length > 0) {
    throw new Error(
      `${app.name}: ${app.appPath}/.dockerignore does not exclude ${missing.join(", ")}. ` +
      `Secrets and runtime state must not be copied into an image.`,
    );
  }

  // `dockerfile` is resolved relative to `context`, so the number of
  // `../` segments has to match how deep the context is — not be fixed
  // at one.
  //
  // **This was `../${dockerfile}` and it was wrong for the two nested
  // apps.** `chopz/chopz-shop` and `cvnvo/yap` sit two levels down, so
  // a single `..` resolved to `chopz/deploy/Dockerfile.node` and
  // `cvnvo/deploy/Dockerfile.node` — neither of which exists. Both
  // services would have failed at build time with a missing Dockerfile,
  // and nothing caught it because `docker compose config` validates
  // YAML and interpolation without ever resolving a build path, and no
  // build had ever been run.
  const upToRoot = "../".repeat(app.appPath.split("/").length);

  const service = {
    build: {
      context: `./${app.appPath}`,
      dockerfile: `${upToRoot}${dockerfile}`,
      args: { PORT: String(app.port) },
    },
    container_name: app.name,
    environment,
    ports: [`${app.port}:${app.port}`],
    networks: ["vaco"],
    restart: "unless-stopped",
  };

  if (PERSISTED_APPS.has(app.name)) {
    const volumeName = `${app.name.replace(/[^a-z0-9]/g, "_")}_data`;
    volumes[volumeName] = null;
    service.volumes = [`${volumeName}:/app/data`];
  }

  services[app.name] = service;
}

// nginx -- the one real front door, generated separately by
// `deploy/generate-nginx-conf.js --docker` (deploy/nginx-docker.conf),
// proxying every service above by its own Compose service name.
services.nginx = {
  image: "nginx:alpine",
  container_name: "vaco-nginx",
  volumes: ["./deploy/nginx-docker.conf:/etc/nginx/conf.d/default.conf:ro"],
  ports: ["80:80"],
  networks: ["vaco"],
  depends_on: ["vaco-shell"],
  restart: "unless-stopped",
};

// Minimal, real, dependency-order hint -- every backend that talks to
// V3/Shield waits for them to at least be started (not necessarily
// healthy; none of these apps expose a real `/api/health`-backed
// Docker HEALTHCHECK yet, flagged honestly in deploy/README.md rather
// than faked with an unverified one here).
//
// vaco-audit and vaco-operator joined this list when they became hard
// dependencies rather than optional ones. In `enforce` -- the default
// for both -- a group-2 route refuses outright if it cannot record the
// decision or verify the operator. Starting VAGO before them means a
// window where every settlement 503s, from a stack that came up clean.
// The dependency is only added for apps that actually carry the client,
// so an app that records no decisions is not made to wait.
const INFRA = ["v3", "shield"];
for (const [name, service] of Object.entries(services)) {
  if (INFRA.includes(name) || name === "nginx") continue;
  const env = service.environment || {};
  const deps = [
    ...INFRA,
    ...(env.VACO_AUDIT_URL ? ["vaco-audit"] : []),
    ...(env.VACO_OPERATOR_URL ? ["vaco-operator"] : []),
  ].filter((dep) => services[dep] && dep !== name);
  if (deps.length) service.depends_on = deps;
}

// -- The media plane -------------------------------------------------
//
// `vaco-media` has minted valid LiveKit tokens since it was written, and
// its adapter's own header recorded the gap honestly: "that needs an
// actual SFU process, and `deploy/` does not run one yet." This is that
// process, so a token now has somewhere to be spent.
//
// Added after the depends_on loop above on purpose. That loop gives
// every non-infrastructure service a dependency on V3 and Shield, and
// an SFU has no business waiting on a ledger.
services.livekit = {
  image: "livekit/livekit-server:v1.8",
  container_name: "vaco-livekit",
  command: "--config /etc/livekit.yaml",
  environment: {
    // livekit-server's own format is "key: secret". Empty by default so
    // the stack still comes up without media configured -- the same
    // posture as VACO_MEDIA_TRANSPORT defaulting to loopback.
    LIVEKIT_KEYS: "${LIVEKIT_API_KEY:-}: ${LIVEKIT_API_SECRET:-}",
  },
  volumes: ["./deploy/livekit.yaml:/etc/livekit.yaml:ro"],
  ports: ["7880:7880", "7881:7881", "7882:7882/udp"],
  networks: ["vaco"],
  restart: "unless-stopped",
};

// vaco-media waits for it. Harmless when the transport is loopback --
// the container starts either way -- and necessary when it is not.
if (services["vaco-media"]) {
  services["vaco-media"].depends_on = [
    ...(services["vaco-media"].depends_on || []),
    "livekit",
  ];
}

function yamlValue(v, indent) {
  if (v === null) return "";
  if (typeof v === "string") {
    // Quote anything with a `$` (compose variable interpolation) or a
    // colon, so plain YAML parsing can't misread it.
    return /[:$]/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : v;
  }
  return String(v);
}

function yamlBlock(obj, indent = 0) {
  const pad = "  ".repeat(indent);
  let out = "";
  for (const [key, value] of Object.entries(obj)) {
    if (value === null) {
      out += `${pad}${key}:\n`;
    } else if (Array.isArray(value)) {
      out += `${pad}${key}:\n`;
      for (const item of value) out += `${pad}  - ${yamlValue(item)}\n`;
    } else if (typeof value === "object") {
      out += `${pad}${key}:\n${yamlBlock(value, indent + 1)}`;
    } else {
      out += `${pad}${key}: ${yamlValue(value)}\n`;
    }
  }
  return out;
}

const out = `# VACO -- generated Docker Compose config. Regenerate with
# node deploy/generate-docker-compose.js
# (also regenerate deploy/nginx-docker.conf: node deploy/generate-nginx-conf.js --docker)
#
# Run:
#   cp .env.example .env   # set ANTHROPIC_API_KEY for v4-proxy
#   docker compose up --build
# Front door: http://localhost/ (nginx -> vaco-shell)
# Direct per-app access (bypassing nginx): http://localhost:<port>/api/health

services:
${yamlBlock(services, 1)}
volumes:
${Object.keys(volumes).length ? Object.keys(volumes).map((v) => `  ${v}:\n`).join("") : "  {}\n"}
networks:
  vaco:
    driver: bridge
`;

fs.writeFileSync(path.join(ROOT, "docker-compose.yml"), out);
console.error(`Wrote docker-compose.yml (${Object.keys(services).length - 2} app services + nginx + livekit, ${Object.keys(volumes).length} persisted volumes).`);
