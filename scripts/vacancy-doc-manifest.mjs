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

// **What each document was about, and which part of the index it sat
// under.** A list of 74 filenames tells somebody that things are
// missing; it does not help them decide what to spend an afternoon
// hunting for. The index already carries a one-line description per
// entry and groups them under `## ` headings that separate the
// technical handoff from the world bible from the marketing material,
// which is most of what determines whether a given document still
// matters. Both are lifted here rather than left for a reader to
// cross-reference by hand.
function describeFromIndex() {
  const described = new Map();
  let section = '(unsectioned)';
  const lines = index.split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const heading = line.match(/^##+\s+(.*)$/);
    if (heading) { section = heading[1].trim(); continue; }

    const entry = line.match(/^\s*-\s+\*\*`([A-Za-z0-9_./-]+\.(?:md|sql|js|mjs|json))`\*\*\s*(?:—|--)?\s*(.*)$/);
    if (!entry) continue;

    // Descriptions wrap. Keep consuming while the next line is neither
    // a new entry nor a heading nor blank.
    let text = entry[2].trim();
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j];
      if (!next.trim() || /^##+\s/.test(next) || /^\s*-\s+\*\*`/.test(next)) break;
      text += ` ${next.trim()}`;
    }
    described.set(entry[1].split('/').pop(), {
      section,
      text: text.replace(/\s+/g, ' ').replace(/^[—-]\s*/, '').trim(),
    });
  }
  return described;
}

const described = describeFromIndex();

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
repository.** Verified rather than assumed: every file under
\`vacon-c/\` was listed (tracked and untracked alike), both uploaded
archives were searched by filename, and the whole repo was searched by
*content* for each document's distinctive subject matter. None of them
are here under another name.

Treat the index as a *record of what was written*, not an inventory of
what is here. Anything below is a document you will not find by
following it.

**Confirmed on 12 Sep 2026: they are not coming.** The owner stated
there are no further VACANCY documents, which settles a question this
file had left open-ended. These 68 are gone permanently, not pending.

**Seven of them were superseded the same day rather than recovered.**
A consolidated handoff now sits at
\`vacon-c/VACANCY_CONSOLIDATED_MASTER_SPEC.md\` and covers the ground
held by \`VACANCY_WORLD_BIBLE_COMPLETION_MAP.md\`,
\`VACANCY_CITY_DNA_MASTER_FRAMEWORK.md\`,
\`VACANCY_CIVILIZATION_DNA_DATABASE.md\`,
\`VACANCY_GAME_DNA_MASTER_FRAMEWORK.md\` and world-bible parts
\`_31_35\`, \`_36_45\`, \`_46_50_FINAL\`. It is the design authority for
VACANCY and outranks every other VACANCY document here.

**What it does not restore, stated by its sender:** the literal
2,100-entry trait catalogue and the per-part world-bible entries. It
carries the *architecture* for both. Those enumerations have to be
generated during the build, and a generated trait list must be
labelled as generated rather than cited as recovered source.
\`dev-docs/VACANCY_SPEC_IMPLEMENTATION_MAP.md\` maps the spec section
by section against what is actually built — 128 trait definitions
against the 2,100 asked for, among other things — and is the document
to read before starting work.

### What survived them, which is more than the list suggests

A missing document is not the same as a lost decision, and for the
technical handoff the difference is large. Three documents in this
repository absorbed the incoming ones at intake:

- **\`VACANCY_MASTER_ARCHITECTURE_DOCUMENT.md\`** (558 lines) is the
  reconciliation underlying the whole handoff package. §2 carries the
  10-category system map with the implemented/gap split per category;
  §7 the prototype development plan; §12 the Game DNA mapping table's
  conclusions; §5 the database design "preserved in detail".
- **\`VACANCY_SEED.md\`** logged each document as it arrived *and
  checked it against the code*: §7 records where Doc 6's status column
  was stale in seven places, §11 that Doc 4's premise does not hold,
  §12 verifies Doc 5's Phase 1 checklist item by item.
- **\`VACANCY_INVENTORY.md\`** tracks the same intake against the API
  and route map.

So the *architecture* is not lost. What is lost is the detail those
summaries point at — §3 says "full detail preserved as sent", and "as
sent" means in a document that is now gone. The reference tables, the
per-part world-bible material, and the long enumerations are the real
casualties, not the decisions taken from them.

The group most worth recovering is therefore **Core Gameplay Systems**
below: mechanics for work not yet built, where no summary stands in for
the specification.

Grouped by the part of the index each sat under, with the index's own
one-line description — so this is a hunting list you can triage, not
just a list of things that are gone.

${(() => {
    const groups = new Map();
    for (const r of missing) {
      const d = described.get(r.name);
      const section = d ? d.section : '(not described by the index)';
      if (!groups.has(section)) groups.set(section, []);
      groups.get(section).push({ name: r.name, text: d ? d.text : '' });
    }
    return [...groups]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([section, items]) => `### ${section} — ${items.length} missing\n\n`
        + items.map((it) => `- \`${it.name}\`${it.text ? ` — ${it.text}` : ''}`).join('\n'))
      .join('\n\n');
  })()}

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
