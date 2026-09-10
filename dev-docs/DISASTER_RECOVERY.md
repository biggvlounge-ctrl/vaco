# Disaster Recovery

**Date:** 2026-08-26 · **Updated 2026-09-10 after a real total loss —
see §0.** · **Status:** backup and restore are built and tested.
**Off-host delivery is not yet automated** — see §6, which is the one
part of this document describing something that does not exist.

---

## 0. The loss that actually happened

**2026-09-08. The entire repository was lost: 444 commits, gone.**

Not the stores this document was written to protect. The *code*. The
one thing everybody assumed was safe, because "it's in git."

What happened, plainly:

1. This ecosystem was being built inside an ephemeral container. The
   container is reclaimed after inactivity, and everything on its disk
   goes with it. That was documented in the environment and known.
2. `git push` began failing with a 403 — a GitHub App permission scope
   problem, not a code problem.
3. The push was abandoned as a distraction and work continued, with
   commits landing **locally only**, for over a hundred commits.
4. The container was reclaimed. `/home/user/vaco` came back empty, with
   a fresh `.git` holding zero commits, zero refs, zero objects, and an
   empty reflog. The remote had zero branches.

Everything was recovered from a release archive plus a session
transcript, which was luck rather than a procedure.

### The three lessons, stated as rules

**A local commit is not a backup.** `git commit` writes to a disk that
can disappear. Until an object exists somewhere else, it exists once.
Committing frequently while pushing never is not a cautious workflow;
it is a single point of failure with extra steps.

**A blocked push is an incident, not an inconvenience.** The moment
`git push` stops working, durability is gone and the clock is running.
It does not matter that the cause is administrative. Either fix the
remote or start producing off-machine artifacts that same session —
never "keep building and sort it out later."

**When there is no remote, `git bundle` is the answer.** A bundle is
the whole repository — every commit, branch and tag — in one file that
can be handed to a person, attached to a message, or copied anywhere.
It is a real git remote: you clone from it.

```bash
# Take one. Do this whenever a push is not available.
git bundle create vaco-full-history-$(git rev-parse --short HEAD).bundle --all

# Prove it before trusting it — `verify` reads the file, `clone` proves
# the file. Do both.
git bundle verify vaco-full-history-<sha>.bundle
git clone --branch <branch> vaco-full-history-<sha>.bundle /tmp/restore-test
cd /tmp/restore-test && git rev-list --count HEAD && git ls-files | wc -l
```

Then **get the file off the machine.** A bundle sitting beside the
repository it backs up is worth precisely nothing — the same argument
§6 makes about snapshots, and the same one that was ignored about
commits.

### The second finding, from the same backup

Making that first bundle meant listing what git was ignoring, which
surfaced something no clean `git status` could ever have shown: six
real source files had been silently untracked for two weeks.

`.gitignore`'s `**/data/` rule (§1) matches any directory named `data`
at any depth, so two source directories in the CALL app were carved
back out by name. CALL was then renamed to `vex-business`. The
directories moved; the negations did not, and `**/data/` quietly
reclaimed the ORM layer of the futures-research platform.

**Ignored files are not untracked files — they do not appear.** They
were absent from git, absent from every release archive, and would have
been lost with the container alongside everything else.
`scripts/test/gitignore-carveouts.test.mjs` now holds every carve-out
to the two claims it makes: the path exists, and the files beneath it
are really tracked.

When auditing what is actually saved, `git status --short --ignored` is
the command that tells the truth. `git status` alone will reassure you.

Every claim this repository makes about money being correct assumes the
data still exists. Until this document, there was no mechanism by which
V3's ledger survived the loss of one disk, no restore procedure, and no
test of one. `dev-docs/COMPLETION_AUDIT.md` catalogued untested apps; it
never listed this, because nothing was *broken* — there was simply
nothing there.

---

## 1. What there is to lose

Measured 2026-08-26.

| | |
|---|---|
| Live stores | **17** (`<app>/data/store.json`) |
| Total size | ~87 KB |
| V3 ledger | **33 accounts, 136 transactions, 33,000 VCoin** |
| Largest store | `v3` at 20.7 KB, then `vaco-shell` 14.2 KB, `void` 13.5 KB |
| Apps with a `data/` dir but no store yet | 6 (dreams, venvm, vulture-flix, vulture-music, vulture-pods, vulture-studios) |

**Git is not a backup of this data, and never has been.** `.gitignore`
carries a blanket `**/data/` rule, so no `store.json` has ever been
committed. Anyone assuming "it's in the repo" is wrong, and that
assumption is the most likely reason this gap survived as long as it
did.

**`vex-business` is out of scope here.** It runs its own PostgreSQL with
Alembic migrations and needs a database backup strategy, not a file
copy. Flagged, not solved.

Its `data/`-named directories hold no runtime state — but two of them
hold **source**: `packages/data/` is a Python package (the ORM layer)
and `data/sample/` is the seed-data directory. Both are carved out of
the `**/data/` rule by name, and both stopped being carved out when the
app was renamed from CALL. See §0.

---

## 2. RPO and RTO

**RPO — Recovery Point Objective.** How much data may be lost.

| Store class | Target | Achievable today |
|---|---|---|
| **`v3` (the ledger)** | **~0** | **= the backup interval** |
| `shield` (sessions) | minutes | = the backup interval |
| Everything else | 1 hour | = the backup interval |

**The honest position on V3: the target and the achievable number do not
match, and cannot with file snapshots.** A VCoin transfer that is lost
cannot be reconstructed from anything — V3 has no reversal endpoint by
design, no external system holds a second copy, and the counterparty
apps record their *own* view of a settlement, not the ledger's. So
RPO ≈ 0 is the correct target and periodic file copies cannot deliver
it; they deliver "you lose at most one interval".

Closing that gap needs continuous archiving, which means Postgres —
Acceleration Matrix §12 names `v3` as the first app to migrate for
exactly this reason. **Until then, the backup interval *is* the RPO for
the ledger, so choose it deliberately rather than by habit.**

**RTO — Recovery Time Objective.** How long until service is back.

At 87 KB total, the restore itself takes under a second. **RTO here is
dominated entirely by detection and decision, not by the mechanism.**
That is unusual and worth naming: the technical recovery is effectively
free, so every minute of a real outage will be spent noticing, deciding
which snapshot, and stopping servers. Practising §5 is therefore worth
more than optimising anything in §3.

---

## 3. Taking a backup

```bash
node scripts/backup-stores.mjs
```

Writes a timestamped snapshot to `$VACO_BACKUP_DIR`, defaulting to
`../vaco-backups` — **outside the repository on purpose**. A backup
committed alongside the thing it backs up protects against nothing.

What it does, in order:

1. Discovers every `<app>/data/store.json`. Discovered, not listed, so a
   new app is covered without anyone remembering to add it.
2. Parses each file **before** accepting it. A backup of a corrupt store
   is a corrupt backup that looks healthy in a directory listing.
3. Copies, then reads the copy back and compares digests. The difference
   between "wrote it" and "it is on disk".
4. Writes `manifest.json`: SHA-256, byte size, and for `v3` a **ledger
   summary** — account count, transaction count, total VCoin.
5. Prunes to `--keep` snapshots (default 30).

**Exits non-zero if any store fails.** A scheduled job that ignores that
exit code is storing corruption and believing it has a backup.

**Why the manifest records the money.** A checksum proves the bytes came
back. It cannot prove they were the *right* bytes — a store corrupted
before the backup ran checksums perfectly against itself. The ledger
summary is an independent second witness, the same reason the test
suites assert on balances rather than on statuses.

### Scheduling

```cron
# Hourly, on the hour. The interval IS the ledger's RPO — see §2.
0 * * * * cd /path/to/vaco && node scripts/backup-stores.mjs --quiet >> logs/backup.log 2>&1
```

Once CI exists (task #118), run it there too so a failing backup is
visible without anyone reading a log.

---

## 4. Restoring

```bash
node scripts/restore-stores.mjs --list          # what snapshots exist
node scripts/restore-stores.mjs                 # DRY RUN — writes nothing
node scripts/restore-stores.mjs --apply         # actually restore
```

**Dry run is the default and that is deliberate.** Restore is the one
operation here that destroys current state, and the person running it is
by definition having a bad day. Requiring `--apply` is one keystroke
against overwriting a live ledger with a stale one.

Before writing anything, it verifies that every file in the manifest is
present, that every checksum matches, and that every file still parses.
**If any check fails, nothing is written at all** — there is no
half-restore.

After writing, it re-summarises the restored `v3` ledger and compares it
against the manifest. A restore that returns the right bytes but the
wrong money fails loudly.

Useful flags: `--only v3` (one app), `--into <dir>` (restore elsewhere,
which is how you verify a snapshot without touching production),
`--force` (override the running-server guard).

### The running-server guard

A server holds its store in memory and flushes on a debounce. Restore
over a running server and **the server's stale in-memory copy wins on
its next write** — the restore is lost silently rather than loudly.

So the script refuses when `logs/pids/*.pid` names a live process:

```bash
./stop-ecosystem.sh
node scripts/restore-stores.mjs --apply
./start-ecosystem.sh
```

This is best-effort, not a lock: a server started by hand leaves no pid
file and will not be caught. That is why it is a refusal with an
override rather than a promise.

---

## 5. The runbook

**An untested backup is a belief.** This repo holds gates to that
standard everywhere else. Walk this once, on a copy, before needing it.

### Total loss of the working tree

```bash
git clone <repo> vaco && cd vaco
./install-ecosystem.sh
node scripts/restore-stores.mjs --list
node scripts/restore-stores.mjs <stamp> --apply
./start-ecosystem.sh
node scripts/smoke-frontend.mjs        # all 29 frontends
```

Code comes from git; **data comes only from the snapshot.** Those are
two different recovery paths and both must work.

**`<repo>` assumes a reachable remote, and that assumption is what
failed on 2026-09-08** (§0). If there is no remote — the push is
403ing, the host is gone, the fork was deleted — the first line becomes
a clone from the most recent bundle instead:

```bash
git clone --branch <branch> vaco-full-history-<sha>.bundle vaco && cd vaco
```

Everything after it is unchanged. This is why a bundle has to be taken
*and moved off the machine* whenever pushing is not available: it is
the only thing that makes line one of this runbook work.

A release archive (`scripts/package-release.mjs`) is **not** a
substitute. It is `git archive HEAD` — the tracked files at one commit,
with no history, no branches, and nothing to recover an earlier state
from. It is how the code was rescued in September, and it cost every
commit message and every intermediate state to do it.

### One app's store is corrupt

```bash
./stop-ecosystem.sh
node scripts/restore-stores.mjs --only <app> --apply
./start-ecosystem.sh
```

### The ledger is wrong and you need to know when it went wrong

Snapshots carry ledger totals, so bisect on the money rather than
guessing:

```bash
node scripts/restore-stores.mjs --list    # totalVcoin per snapshot
```

Restore a candidate `--into /tmp/vaco-check` and inspect it there before
touching anything live.

### Verify a snapshot without a disaster

```bash
mkdir -p /tmp/vaco-verify
node scripts/restore-stores.mjs <stamp> --into /tmp/vaco-verify --apply
```

Worth doing monthly. It is the only thing that turns a belief into a
backup.

---

## 6. What this does **not** protect against

Listed because a recovery document that only describes its own successes
is the kind that gets discovered to be wrong during an outage.

### Off-host delivery is not automated — this is the open gap

Snapshots land on the **same machine** as the data. That protects
against a bad deploy, a corrupt write, and a botched migration. It does
**not** protect against the loss of the host, which is the disaster this
document is named for.

The remaining step is one line, chosen for whatever storage exists:

```bash
# S3-compatible
aws s3 sync ../vaco-backups s3://<bucket>/vaco-backups --delete

# any remote host
rsync -az --delete ../vaco-backups/ backup-host:/srv/vaco-backups/

# restic, if versioned dedup is wanted
restic -r <repo> backup ../vaco-backups
```

**This was not run or verified here**, because the session that wrote
these scripts had no network access. It is the one thing between the
current state and a real off-host backup, and it should be treated as
outstanding until someone has both run it and restored *from* the remote
copy.

### Cross-app consistency

Snapshots are per-file. `rename(2)` makes each individual store
atomic — a copy never catches a half-written file — but a backup running
mid-settlement can capture `v3` **after** a transfer and `void`
**before** the job update. On restore the money moved and the job looks
unpaid.

Mitigation today is weak but cheap: back up often, prefer quiet moments.
The real fix is Postgres, where one database has one consistent
snapshot.

### Power loss

`persistence.js` states its own limit precisely and it is repeated here
rather than softened: write-to-temp-then-rename survives process death —
`kill -9`, OOM, container restart, all demonstrated rather than
reasoned about — but **does not survive sudden power loss**, because
`renameSync` alone does not fsync the file or its directory.

### Deliberate destruction

Nothing here defends against someone with write access deleting both the
stores and the snapshots. That needs off-host copies with separate
credentials, or object-lock retention. Note this as soon as the off-host
step above is real.

### Secrets

`.env` files are gitignored and **not** in these snapshots. A restored
ecosystem needs its `ANTHROPIC_API_KEY` and friends supplied separately.
There are 17 `.env.example` templates in this repo; the filled-in
versions live nowhere but the host.

---

## 7. Verifying any of this

```bash
node --test scripts/test/backup-restore.test.mjs   # 13 tests
```

The suite runs entirely against temporary directories, never the real
repo — a test that could overwrite the live V3 ledger to prove restore
works would be a spectacularly bad trade. It covers: a snapshot capturing
every store and skipping dirs without one, the manifest recording the
ledger, a backup **failing** on an unparseable store, pruning, a dry run
writing nothing, a full round-trip proving the ledger comes back exactly,
a flipped byte being refused with nothing written, a truncated file being
refused, `--only`, an unknown app being refused, the running-server
guard firing, a stale pid file **not** blocking, and `--list` reporting
ledger totals.

The two that matter most:

- **the flipped-byte test** — the snapshot still parses, so only the
  checksum knows, and the restore must refuse *before* writing anything
- **the round-trip test** — asserts the restored ledger equals the
  original balance for balance and transaction for transaction, then
  asserts the script reported `3 accounts, 2 transactions, 400 VCoin` on
  its own summary. Bytes and money, checked separately.
