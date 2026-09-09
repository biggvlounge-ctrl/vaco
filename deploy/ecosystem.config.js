// VACO -- pm2 process list for production deployment.
//
// **GENERATED FILE -- do not edit.** Re-run:
//
//     node deploy/generate-ecosystem-config.js
//
// after adding or removing an app in start-ecosystem.sh's own APPS
// array, which is the authoritative app/path/port manifest for this
// ecosystem. `scripts/test/deploy-readme.test.mjs` fails if this file
// stops matching that manifest, which is how six apps that had quietly
// dropped out of the pm2 deployment were found.
//
// 34 real Express backends. The 2 Vite frontends (venvs, vdp)
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
module.exports = {
  apps: [
    {
      name: "vaco-shell",
      cwd: "./vaco-shell",
      script: "server.js",
      env: { PORT: "8789", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "v4-proxy",
      cwd: "./v4-proxy",
      script: "server.js",
      env: { PORT: "8787", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "v4-search",
      cwd: "./v4-search",
      script: "server.js",
      env: { PORT: "8788", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "vacon",
      cwd: "./vacon",
      script: "server.js",
      env: { PORT: "8805", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "vacon-c",
      cwd: "./vacon-c",
      script: "server.js",
      env: { PORT: "8809", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "hvntz",
      cwd: "./hvntz",
      script: "server.js",
      env: { PORT: "8792", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "void",
      cwd: "./void",
      script: "server.js",
      env: { PORT: "8793", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "voidmagic",
      cwd: "./voidmagic",
      script: "server.js",
      env: { PORT: "8797", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "voken",
      cwd: "./voken",
      script: "server.js",
      env: { PORT: "8794", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "vago",
      cwd: "./vago",
      script: "server.js",
      env: { PORT: "8795", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "vxllage",
      cwd: "./vxllage",
      script: "server.js",
      env: { PORT: "8796", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "cvnvo",
      cwd: "./cvnvo",
      script: "server.js",
      env: { PORT: "8798", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "yap",
      cwd: "./cvnvo/yap",
      script: "server.js",
      env: { PORT: "8802", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "chopz",
      cwd: "./chopz",
      script: "server.js",
      env: { PORT: "8800", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "chopz-shop",
      cwd: "./chopz/chopz-shop",
      script: "server.js",
      env: { PORT: "8801", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "vacay",
      cwd: "./vacay",
      script: "server.js",
      env: { PORT: "8803", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "vavlt-stvdios",
      cwd: "./vavlt-stvdios",
      script: "server.js",
      env: { PORT: "8808", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "vsafe",
      cwd: "./vsafe",
      script: "server.js",
      env: { PORT: "8799", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "vaca",
      cwd: "./vaca",
      script: "server.js",
      env: { PORT: "8804", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "v3",
      cwd: "./v3",
      script: "server.js",
      env: { PORT: "8811", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "shield",
      cwd: "./shield",
      script: "server.js",
      env: { PORT: "8812", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "vaco-analytics",
      cwd: "./vaco-analytics",
      script: "server.js",
      env: { PORT: "8790", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "vulture-music",
      cwd: "./vulture-music",
      script: "server.js",
      env: { PORT: "8806", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "vulture-flix",
      cwd: "./vulture-flix",
      script: "server.js",
      env: { PORT: "8807", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "vulture-pods",
      cwd: "./vulture-pods",
      script: "server.js",
      env: { PORT: "8810", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "venvm",
      cwd: "./venvm",
      script: "server.js",
      env: { PORT: "8813", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "dreams",
      cwd: "./dreams",
      script: "server.js",
      env: { PORT: "8814", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "vulture-studios",
      cwd: "./vulture-studios",
      script: "server.js",
      env: { PORT: "8815", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "vex",
      cwd: "./vex",
      script: "server.js",
      env: { PORT: "8816", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "vex-trading",
      cwd: "./vex-trading",
      script: "server.js",
      env: { PORT: "8817", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "vaco-notify",
      cwd: "./vaco-notify",
      script: "server.js",
      env: { PORT: "8818", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "vaco-audit",
      cwd: "./vaco-audit",
      script: "server.js",
      env: { PORT: "8819", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "vaco-operator",
      cwd: "./vaco-operator",
      script: "server.js",
      env: { PORT: "8820", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
    {
      name: "vaco-media",
      cwd: "./vaco-media",
      script: "server.js",
      env: { PORT: "8821", NODE_ENV: "production" },
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};
