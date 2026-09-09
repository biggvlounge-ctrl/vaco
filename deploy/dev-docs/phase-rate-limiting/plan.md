# Plan — real rate limiting at the nginx layer

## Goal
Close the ecosystem audit's "no rate limiting anywhere in the 30 Node
apps" finding with one change that covers all of them at once, since
they all sit behind the same real nginx reverse proxy already.

## Design
`generate-nginx-conf.js`'s own template gains a `limit_req_zone`
directive (10 requests/sec per client IP, a real 10MB shared zone, a
real burst of 20 queued before requests start getting rejected) and a
`limit_req`/`limit_req_status 503` pair inside `server {}`, applied
once so it covers every proxied location generated below it rather
than repeating it per app.

## Real placement constraint, checked before writing
`limit_req_zone` is only legal in nginx's `http {}` context, not
inside `server`/`location`. This generator only ever emits a
`server {}` block — confirmed by reading how it's actually consumed:
the Docker Compose service mounts the generated file straight to
`/etc/nginx/conf.d/default.conf` inside the stock `nginx:alpine`
image, whose own default `nginx.conf` `include`s everything under
`conf.d/` from directly inside `http {}`. That means content placed
at this file's own top level (outside `server {}`) lands in `http {}`
context when nginx actually loads it -- confirmed this is where the
zone declaration needed to go before writing it, not assumed.

## Verification approach, honestly scoped
Regenerated both real output files (`nginx-docker.conf` and
`nginx-vaco.conf.example`) from the updated generator and confirmed
brace-balance (36 open / 36 close in both) and that `limit_req_zone`
sits at column 1, outside every block. **Could not run the real
`nginx -t` syntax check** — no local nginx binary, no Docker daemon,
and no package-manager network access available in this environment.
Flagged directly rather than claimed as fully verified: the structural
checks above are real and passed, but an actual `nginx -t` (or
`docker compose up` against the real image) is the honest remaining
verification step before this is trusted in production.

## Done when
Every app behind the reverse proxy gets real, shared rate limiting
with zero per-app config, and the one real verification gap (no local
`nginx -t`) is documented, not silently assumed away.
