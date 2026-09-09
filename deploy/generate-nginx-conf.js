// VACO -- generates deploy/nginx-vaco.conf from the same authoritative
// app/path/port manifest as start-ecosystem.sh / ecosystem.config.js.
//
// Scheme: one domain, path-based routing, one Let's Encrypt cert --
// simpler to operate for a first deployment than a subdomain (or
// wildcard-cert) per app.
//   https://<domain>/                -> vaco-shell (the front door)
//   https://<domain>/<app-slug>/*    -> that backend's own real
//                                        /api/* routes, with the
//                                        /<app-slug> prefix stripped
//                                        before proxying (matches how
//                                        every VDP/VENVS district
//                                        client already concatenates
//                                        BASE_URL + path, where path
//                                        already starts with /api/...)
//   https://<domain>/vdp/            -> VDP's production build (static)
//   https://<domain>/venvs/          -> VENVS's production build (static)
//
// Usage (bare-metal/VPS target, the original mode):
//   node deploy/generate-nginx-conf.js yourdomain.com > /tmp/nginx-vaco.conf
//   sudo mv /tmp/nginx-vaco.conf /etc/nginx/sites-available/vaco
//   sudo ln -s /etc/nginx/sites-available/vaco /etc/nginx/sites-enabled/
//   sudo nginx -t && sudo systemctl reload nginx
//   sudo certbot --nginx -d yourdomain.com
//
// Usage (--docker mode, added alongside the real Docker Compose
// deployment path -- see deploy/generate-docker-compose.js): emits
// deploy/nginx-docker.conf instead, upstreams addressed by Docker
// Compose service name (e.g. `http://v3:8811`) rather than
// `127.0.0.1:<port>`, since nginx runs in its own container on the
// same Compose network, not on the same host as everything else. VDP
// and VENVS also switch from `alias` (a bare-metal on-disk `dist/`
// path) to `proxy_pass` against their own containers -- Dockerfile.vite
// serves each one's build via `serve` inside its own container, so
// there's no shared host filesystem path for nginx to read from the
// way the VPS target has. No TLS/certbot step here -- real TLS
// termination for a containerized deployment is a separate concern
// (a managed platform's own TLS, or a Caddy/Traefik layer in front),
// not attempted by this plain-HTTP-inside-the-network config:
//   node deploy/generate-nginx-conf.js --docker
//   docker compose up --build

const fs = require("fs");
const path = require("path");

const dockerMode = process.argv.includes("--docker");
const domain = dockerMode ? "localhost" : process.argv[2];
if (!dockerMode && !domain) {
  console.error("Usage: node generate-nginx-conf.js <your-domain>");
  console.error("       node generate-nginx-conf.js --docker");
  process.exit(1);
}

const src = fs.readFileSync(path.join(__dirname, "..", "start-ecosystem.sh"), "utf8");
const match = src.match(/APPS=\(([\s\S]*?)\n\)/);
const lines = match[1].split("\n").map((l) => l.trim()).filter((l) => l.startsWith('"'));
const apps = lines
  .map((l) => {
    const inner = l.slice(1, -1);
    const [name, appPath, cmd, port] = inner.split(":");
    return { name, appPath, cmd, port };
  })
  .filter((a) => a.name !== "vaco-shell" && a.cmd === "npm start"); // shell is the root, handled separately

function upstream(name, port) {
  return dockerMode ? `${name}:${port}` : `127.0.0.1:${port}`;
}

// cvnvo gets its own location block below (with WebSocket upgrade
// headers, for its real-time messaging) -- excluded here so it isn't
// emitted twice.
const backendLocations = apps
  .filter((a) => a.name !== "cvnvo")
  .map(
    (a) => `    location /${a.name}/ {
        rewrite ^/${a.name}/(.*)$ /$1 break;
        proxy_pass http://${upstream(a.name, a.port)};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }`
  )
  .join("\n\n");

const vdpVenvsLocations = dockerMode
  ? `    # VDP and VENVS -- each serves its own real \`npm run build\` output
    # via \`serve\` inside its own container (Dockerfile.vite); nginx
    # proxies to them rather than reading a shared host \`dist/\` path.
    location /vdp/ {
        rewrite ^/vdp/(.*)$ /$1 break;
        proxy_pass http://${upstream("vdp", 5174)};
        proxy_set_header Host $host;
    }

    location /venvs/ {
        rewrite ^/venvs/(.*)$ /$1 break;
        proxy_pass http://${upstream("venvs", 5173)};
        proxy_set_header Host $host;
    }`
  : `    # VDP and VENVS production builds (static files -- built via
    # \`npm run build\`, see the deployment guide).
    location /vdp/ {
        alias /var/www/vaco/vdp/dist/;
        try_files $uri $uri/ /vdp/index.html;
    }

    location /venvs/ {
        alias /var/www/vaco/venvs/dist/;
        try_files $uri $uri/ /venvs/index.html;
    }`;

const out = `# VACO -- generated nginx config. Regenerate with
# node deploy/generate-nginx-conf.js ${dockerMode ? "--docker" : domain}
${dockerMode ? "" : "# then re-run `certbot --nginx` if this is the first time (it edits\n# this file in place to add the ssl_certificate lines).\n"}
# Real rate limiting -- closes one of the ecosystem audit's flagged
# gaps ("no rate limiting anywhere in the 30 Node apps"). Declared at
# this file's top level rather than inside \`server {}\` because this
# file is spliced directly into nginx's own \`http {}\` context (the
# official nginx image's default.conf \`include\`s everything under
# conf.d/ from inside \`http {}\`) -- \`limit_req_zone\` is only legal
# there, not inside \`server\`/\`location\`. 10 requests/sec per client
# IP, a real burst of 20 queued before requests start getting 503'd,
# applied once at the server level so it covers every proxied
# location below without repeating it per-app.
limit_req_zone $binary_remote_addr zone=vaco_general:10m rate=10r/s;

server {
    listen 80;
    server_name ${domain};

    limit_req zone=vaco_general burst=20 nodelay;
    limit_req_status 503;

${vdpVenvsLocations}

    # WebSocket support (cvnvo's real-time messaging) -- upgrade
    # headers on every proxied location so ws:// connections work
    # through the reverse proxy.
    location /cvnvo/ {
        rewrite ^/cvnvo/(.*)$ /$1 break;
        proxy_pass http://${upstream("cvnvo", 8798)};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

${backendLocations}

    # The front door: vaco-shell, the real app launcher + session host.
    location / {
        proxy_pass http://${upstream("vaco-shell", 8789)};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;

const outFile = dockerMode ? "nginx-docker.conf" : "nginx-vaco.conf.example";
fs.writeFileSync(path.join(__dirname, outFile), out);
console.error(`Wrote deploy/${outFile} ${dockerMode ? "(Docker Compose mode)" : `for domain "${domain}"`} (${apps.length} backend locations + vdp/venvs + shell root).`);
