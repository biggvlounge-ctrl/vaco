#!/usr/bin/env node
// Which documents does VACON-C's own index name, and which of them are
// actually here?
//
// **Why this exists.** `vacon-c/VACANCY_MASTER_SESSION_INDEX.md` calls
// itself "the single reference document for everything built this
// session — read this one document to understand what exists and
// where, rather than opening all 230+ individual files." It names each
// document by filename and says what it covers.
//
// Most of them are not in this repository. Not renamed, not moved —
// absent. They were produced in earlier threads and never brought in,
// and the index has been describing them as present ever since.
//
// That is a worse failure than a missing file, because the index is
// exactly what somebody reads *instead of* looking. A reader following
// it to `VACANCY_500_SYSTEM_MASTER_INDEX.md` ("Document 6: honest
// status audit of all 500 systems") finds nothing, and has no way to
// tell whether it was lost, renamed, or never written.
//
// So the claim gets measured. This generates
// `vacon-c/VACANCY_DOCUMENT_MANIFEST.md`: every filename the index
// names, whether it is in the repository, and where. The number moves
// on its own as documents arrive — nobody has to remember to re-count.
//
// **Deliberately not a gate.** `scripts/test/vacancy-doc-manifest.test.mjs`
// checks that the manifest matches reality; it does not require the
// missing count to be zero. A test that fails until 76 documents from
// earlier threads are located is a test that gets skipped, and a
// skipped test protects nothing. The manifest makes the gap visible
// and keeps it honest; closing it needs the files, which is a person's
// job, not a test's.
//
// Usage:
//   node scripts/vacancy-doc-manifest.mjs            # write the manifest
//   node scripts/vacancy-doc-manifest.mjs --check    # fail if it drifted

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(REPO_ROOT, 'vacon-c', 'VACANCY_MASTER_SESSION_INDEX.md');
const OUT = path.join(REPO_ROOT, 'vacon-c', 'VACANCY_DOCUMENT_MANIFEST.md');

const index = fs.readFileSync(INDEX, 'utf8');

// Every backticked filename the index names. The index writes them as
// `**\`NAME.md\`** — description`, so a backtick-delimited scan finds
// them without a hand-maintained list, which is the whole point.
const named = [...new Set(
  [...index.matchAll(/`([A-Za-z0-9_./-]+\.(?:md|sql|js|mjs|json))`/g)].map((m) => m[1]),
)].sort();

if (named.length === 0) {
  process.stderr.write('vacancy-doc-manifest: the index names no documents at all.\n'
    + 'That is a broken scan, not an empty index; refusing to write a manifest saying nothing is missing.\n');
  process.exit(2);
}

// **A continuation line is not a document.** The index wraps a series
// across lines as `PARTS_31_35.md`, `_36_45.md`, `_46_50_FINAL.md` —
// the second and third are the tail of the first's name, not separate
// files. Counting them as missing documents would invent two.
const CONTINUATIONS = new Set(['_36_45.md', '_46_50_FINAL.md']);

// Where everything actually is, from git rather than the filesystem:
// an untracked file is not in the repository in any sense that
// survives this machine, which is the question being asked.
const tracked = spawnSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8' });
if (tracked.status !== 0) {
  process.stderr.write(`vacancy-doc-manifest: git ls-files failed: ${tracked.stderr}\n`);
  process.exit(2);
}
const byBasename = new Map();
for (const p of tracked.stdout.split('\n').filter(Boolean)) {
  const b = p.split('/').pop();
  if (!byBasename.has(b)) byBasename.set(b, []);
  byBasename.get(b).push(p);
}

const rows = named
  .filter((n) => !CONTINUATIONS.has(n))
  .map((n) => {
    const base = n.split('/').pop();
    return { name: base, paths: byBasename.get(base) || [] };
  });

const present = rows.filter((r) => r.paths.length > 0);
const missing = rows.filter((r) => r.paths.length === 0);

const doc = `# VACANCY — Document Manifest

**GENERATED FILE — do not edit.** Re-run:

    node scripts/vacancy-doc-manifest.mjs

\`VACANCY_MASTER_SESSION_INDEX.md\` describes itself as "the single
reference document for everything built this session — read this one
document to understand what exists and where, rather than opening all
230+ individual files." This checks that claim against the repository.

| | |
|---|---:|
| Documents the index names | **${rows.length}** |
| Present in this repository | **${present.length}** |
| **Not in this repository** | **${missing.length}** |

---

## Not in this repository

These filenames are named by the index and exist nowhere in the repo —
not renamed, not moved, absent. They were produced in earlier threads
and never brought in.

**This is a real gap and it cannot be closed from inside the
repository.** They are not in any release archive, not in the
\`vacon-c-game\` upload (which turned out to be a strict subset of what
is already here), and not in any session transcript available to the
work. Recovering them means locating the original files.

Until then, treat the index as a *record of what was written*, not an
inventory of what is here. Anything below is a document you will not
find by following it.

${missing.map((r) => `- \`${r.name}\``).join('\n')}

---

## Present

${present.map((r) => `- \`${r.name}\` — \`${r.paths.join('`, `')}\``).join('\n')}

---

## What this does not check

Only whether a named file exists. It says nothing about whether a
present document is current, complete, or consistent with the code —
\`scripts/test/vacancy-schema-alignment.test.mjs\` is the one check
that holds a VACANCY document against the implementation, and it
covers the schema alone.
`;

if (process.argv.includes('--check')) {
  const committed = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (committed !== doc) {
    process.stderr.write('vacancy-doc-manifest: vacon-c/VACANCY_DOCUMENT_MANIFEST.md is out of date.\n'
      + 'Re-run `node scripts/vacancy-doc-manifest.mjs`.\n');
    process.exit(1);
  }
  process.stdout.write(`vacancy-doc-manifest: up to date (${present.length} present, ${missing.length} missing).\n`);
} else {
  fs.writeFileSync(OUT, doc);
  process.stdout.write(`Wrote vacon-c/VACANCY_DOCUMENT_MANIFEST.md `
    + `(${rows.length} named, ${present.length} present, ${missing.length} NOT in this repository).\n`);
}
