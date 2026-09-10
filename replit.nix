# VACO -- Nix packages for the Replit container.
#
# **Not verified against a real Replit container**, for the same reason
# `.replit` is not: there is no Replit account attached to this work.
# The versions below are pinned to what this repo actually requires and
# what the development machine actually runs, so a correction here
# should be a package name, not a version guess.
#
# Node 22 is not a preference. Every package.json in this repo declares
# `"engines": { "node": ">=22" }`, and `scripts/test/node-version.test.mjs`
# holds that claim to the lockfiles. The development machine runs
# v22.22.2.

{ pkgs }: {
  deps = [
    pkgs.nodejs_22

    # `start-ecosystem.sh`, `install-ecosystem.sh`, `stop-ecosystem.sh`
    # and `deploy/replit-boot.sh` are bash, not sh -- they use arrays
    # throughout (the APPS manifest is one). Under dash they do not
    # parse.
    pkgs.bash

    # The health-check loop at the end of start-ecosystem.sh is curl.
    # Without it every app reports DOWN while running perfectly.
    pkgs.curl

    # stop-ecosystem.sh's leftover sweep -- the pass that catches the
    # node/vite children npm's own PID does not cover. Verified doing
    # real work on this machine: a stop reported "force-stopped 39
    # leftover node/vite process(es)".
    pkgs.procps

    # git, for `scripts/snapshot.mjs` and because several checks read
    # tracked-file state (`scripts/test/gitignore-carveouts.test.mjs`
    # skips its second claim when .git is absent, which is a weaker
    # test, not a passing one).
    pkgs.git
  ];

  # Deliberately NOT included: python3 / uv.
  #
  # `vex-business/` is a Python monorepo (requires-python >=3.12, uv
  # workspace, alembic migrations) with its own docker-compose.yml. It
  # is excluded from `install-ecosystem.sh`, excluded from
  # `start-ecosystem.sh`'s APPS manifest, and listed in
  # `scripts/run-all-tests.mjs`'s NOT_NODE set as needing its own CI
  # job. The gateway therefore has no route to it and nothing here
  # would start it.
  #
  # Adding a Python toolchain would make the container bigger and
  # change nothing about what runs. If vex-business is ever meant to be
  # part of a single-port deployment, that is a real design decision
  # about a service with its own database and migration story -- not a
  # line in this file.
}
