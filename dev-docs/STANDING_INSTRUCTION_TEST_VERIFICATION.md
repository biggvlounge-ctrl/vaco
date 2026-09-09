# Standing Instruction — Watch the test fail before trusting it

**Applies to every test written in this repo from here forward.** Not
only to the class that produced it.

---

## The rule

> **A test you have never seen fail is not evidence. Break the thing it
> covers, watch it go red, then put the thing back.**

A passing test proves one of two things and does not distinguish
between them:

1. the behaviour is correct, or
2. the test does not actually check the behaviour.

Only a test you have watched fail has ruled out (2). Until then a green
suite is a claim about the tests, not about the code — and a green
suite is exactly what everyone reads as a claim about the code.

## Where this came from

`scripts/test/generator-anchors.test.mjs` was written to catch a
specific failure class: tools that match too loosely and therefore
report success while doing nothing or the wrong thing. It passed 7/7 on
the first run.

Then each of the five faults it covered was deliberately reintroduced,
one at a time, to confirm the suite caught them. **Two of the seven
assertions did not catch their own bug:**

- `/UNMANAGED/` still matched after the check was renamed to
  `UNMANAGEDX` — a substring match, so deleting the feature did not
  fail the test.
- The block anchor still matched after `SHIELD_TARGETS`' closing paren
  was disturbed, because the lazy `[\s\S]*?` simply ran on to the *next*
  list's paren. Worse than a no-op: the App Factory would have appended
  the new app to the wrong target list.

A third assertion had been passing against the *comment explaining the
bug* rather than against any code.

All three were the too-loose-match shape — inside the test file written
to catch the too-loose-match shape. Which is the point: writing the
test is not the same as verifying the test, and being the author of the
rule does not exempt you from breaking it.

## How to do it

Cheap, mechanical, no framework:

```bash
cp target.js /tmp/target.bak
# reintroduce the exact bug the test claims to catch
node --test test/target.test.js   # MUST print "not ok"
cp /tmp/target.bak target.js
node --test test/target.test.js   # back to green
```

For a suite of related assertions, script the mutations so all of them
are exercised in one run — see the five-mutation loop used on
`generator-anchors.test.mjs`.

**What counts as the bug.** Reintroduce the *real* failure, not a
convenient one. Deleting the whole function under test will fail almost
any assertion and proves nothing; the mutation has to be the specific
thing the test claims to prevent. If the test says "refuses a settlement
that cannot be recorded", stop the audit service — do not delete
`record()`.

## The three questions

Before a test is finished:

1. **Have I watched it fail?** If not, it is unverified.
2. **Did it fail for the reason I intended?** A test that goes red for
   an unrelated reason — a syntax error, a missing fixture — has still
   not been verified. Read the failure message.
3. **Would it still fail if someone deleted the feature and left the
   name?** That is the substring/rename case, and it is the one that
   slips through most often.

## Related standing rules

This one composes with two the repo already holds:

- **Assert on the money, never on a status.** A status stays correct
  while money goes wrong. Four settlement tests passed for a while
  against a real payout bug because they asserted escrow was drained —
  and it was drained, into the wrong pocket.
- **A tool that finds nothing must not report success**
  (`STANDING_INSTRUCTION_MIDDLEWARE_COMPOSITION.md` §5d). The tooling
  form of the same idea: silence is not confirmation.

Together they are one instruction in three places: **make the failure
visible, then confirm you have seen it.**

## Related

- `dev-docs/STANDING_INSTRUCTION_MIDDLEWARE_COMPOSITION.md` §5d — the
  failure class that produced this rule, with its four sub-shapes.
- `scripts/test/generator-anchors.test.mjs` — the suite in question,
  and the reference for what a verified test file looks like.
- `scripts/test/backup-restore.test.mjs` — the same discipline applied
  to backups: the header states the failures targeted, and the nested
  app case was added only after confirming it failed against the old
  depth-1 scan.
- `dev-docs/DECISION_AUDIT.md` §2 — an example of a safety valve
  (`observe` mode's `describe()`) that was built, left unwired, and
  caught by exercising it rather than by any test.
