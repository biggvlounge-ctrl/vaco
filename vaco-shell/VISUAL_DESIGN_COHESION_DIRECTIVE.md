# Visual Design Cohesion Directive (v1)

Direct instruction for Claude Code: functional correctness alone isn't
the bar. Every app should feel like a genuine, polished product — and
the whole ecosystem should feel like one coherent family of apps, not
14+ disconnected pieces that happen to share a name.

The real problem this prevents: AI-generated code, left to its own
defaults, tends toward a generic look — unstyled or minimally-styled
components, generic centered-card layouts, default framework styling,
no real visual hierarchy or personality. This is the real difference
between code that works and a product that feels finished.

Two real, distinct requirements:

**1. A shared, unifying design system across the whole ecosystem.**
Switching between VOID, CVNVO, VDP, and any other app should feel like
moving through one coherent family of products — consistent
typography, spacing, component patterns, and interaction language —
the same way Google's Material Design or Apple's Human Interface
Guidelines create a recognizable family feeling across dozens of
distinct apps. This shared system should live in Vaco Shell's own
design foundation and be referenced by every individual app.

**2. Real, intentional visual identity per app, within that shared
system.** Some apps already have real, established visual direction
worth preserving — VACAY's confirmed "dusk navy + sunset coral + brass
gold" palette is a real example already locked in. Every app should
have this same level of deliberate, specific visual identity, not a
generic default reused everywhere. Where an app doesn't yet have a
confirmed palette/identity, one should be deliberately chosen — never
left to whatever a framework defaults to.

Direct instruction for Claude Code:
- Reference the /mnt/skills/public/frontend-design/SKILL.md guidance
  already available.
- Build Vaco Shell's shared design tokens (color system, typography
  scale, spacing, component library) FIRST, before individual app
  UIs, so every app pulls from the same real foundation rather than
  each inventing its own.
- For any app without an already-confirmed visual identity, make a
  real, deliberate choice matching the app's actual purpose and
  audience.
- Treat visual polish as a real requirement, not a nice-to-have to
  revisit later — a functionally complete but generically-styled app
  is not actually finished.

Status: Ready for Claude Code — this should be read alongside the
Kickoff Message, treated as a real, standing quality bar for every app
built from this repository, not just the first one.

---

## Implementation status (added when this file was placed into the repo)

**This directive was not followed, and the honest reason is that the
ecosystem was built as backend services rather than as UIs.** Recorded
plainly rather than softened, because it is a real gap between the
stated quality bar and what exists.

### What was actually checked

- **Shared design tokens in Vaco Shell: none.** `vaco-shell/lib/`
  contains `registry.js` and `insight.js`. `vaco-shell/public/`
  contains a single 289-line `index.html` with one inline `<style>`
  block — so the shell is *styled*, but privately: zero CSS custom
  properties, nothing another app could import. There is no token
  file, no shared color system, no type scale, no component library.
- **CSS across the entire ecosystem: one real file.** Searching every
  non-vendor directory turns up `vex-business/apps/web/app/globals.css`
  and nothing else. Every other app either serves plain HTML or exposes
  JSON only.
- **VACAY's "dusk navy + sunset coral + brass gold" palette**, cited
  here as "real … already locked in," appears in **no** file in this
  repository — not in CSS, not in a config, not in a component. It is
  locked in as a decision, not as an implementation.

### Why this happened, stated without excuse-making

The instruction says to build tokens **first, before individual app
UIs**. What actually got built, across a hundred-plus completed tasks,
was ledgers, matching algorithms, routing engines, revenue splits,
auth, and persistence — with visible surfaces concentrated in VDP's
districts and a handful of React frontends.

That sequencing was not unreasonable given what each task asked for.
But it does mean the directive's own failure condition has been met:
a functionally complete but generically-styled system is, by this
document's standard, not finished. The directive is right that this is
expensive to retrofit, and the retrofit is now larger than it would
have been.

### What is genuinely true in this document's favor

The diagnosis of the default failure mode — "generic centered-card
layouts, default framework styling, no real visual hierarchy" — is
accurate and is exactly what would happen if each app's UI were
generated independently later. The prescription (tokens first, in the
shell, referenced by everyone) remains the right shape.

The referenced skill path is real and available:
`/mnt/skills/public/frontend-design/SKILL.md` exists in this
environment.

### The smallest real first step, if this gets picked up

Not "style every app." That is the version that never starts. The
version that starts:

1. A single token file in `vaco-shell` — color, type scale, spacing,
   radii. No components yet.
2. Apply it to the **shell itself**, which already has a real
   `index.html` and is the surface every user sees first.
3. Apply it to **one** app with a real frontend, as proof the tokens
   survive contact with a second consumer.

Per-app identities come after a shared foundation exists, not before —
otherwise each app's palette is invented against nothing, which is the
outcome this document is trying to prevent.

### Update — the first three steps are done

The "smallest real first step" above was taken, in the order it
prescribed:

1. **`vaco-shell/public/vaco-design.css` exists** — colour, type scale,
   spacing, radii, motion, plus the component shapes the shell needed
   (button, input, card, tile, tab, badge, table, notice, toast). Both
   themes are defined token-level: the bare `:root` carries the full
   light palette, and `@media (prefers-color-scheme: dark)` plus
   `[data-vaco-theme]` redefine **only** tokens, never a component rule,
   so a colour cannot exist in one theme and be missing in the other.
2. **The shell itself was rebuilt on it.** `public/index.html` now
   declares no colours and no sizes of its own — only layout. Verified
   in a real browser, not by inspection: `--vaco-space-4` resolves to
   16px, `.vaco-card` computes to 16px padding and a 9px radius, and
   both themes render with correct contrast.
3. **A second consumer**: VDP's new `vaco-merch` district. That one
   deliberately follows VDP's existing inline-style house pattern rather
   than importing the tokens cross-origin, which is the honest state —
   see the open item below.

**A real bug this caught, worth recording** because it is invisible to
review and fatal in effect: the first version of the token file had a
`/* … */` comment nested inside another one. CSS comments do not nest,
so the inner `*/` closed the block early and the entire `:root` token
declaration was swallowed as garbage. Every rule still *parsed* — the
page just rendered with every `var()` undefined, which looks like
"unstyled" rather than "broken", exactly the generic default this
document warns about. It was caught by asserting computed styles in a
headless browser, not by reading the file. A repo-wide scan for nested
CSS comments now comes back clean.

**The split this document asked to be made explicit is now written into
the token file itself**: the shared layer owns structure, the per-app
layer owns colour and nothing else, via four accent tokens. An app that
overrides anything beyond those is eroding the family look.

**Still open**: the other thirteen-plus apps have not been converted,
and VDP consumes the system by convention rather than by importing the
stylesheet (it is a separate Vite origin; a shared npm-style package or
a build-time copy is the real fix). Per-app palettes remain undecided
except VACAY's, which is still a decision rather than an implementation.

### Update, 13 Nov 2026 — the above is now substantially stale

**The build-time copy this document asked for has happened.** Checked
directly: `public/vaco-design.css` and `public/vaco-ui.js` are no
longer private to the shell — byte-for-byte identical copies now live
in `public/` for every app that has a frontend (`chopz`,
`chopz-shop`, `cvllex`, `cvnvo`, `cvnvo/yap`, `dreams`, `hvntz`,
`shield`, `v3`, `v4-proxy`, `v4-search`, `vaca`, `vacay`,
`vaco-analytics`, `vaco-assistant`, `vaco-notify`, `vaco-passport`,
`vacon`, `vacon-c`, `vago`, `vash-tap`, `vavlt-stvdios`, `vdp`,
`venvm`, `vex`, `vex-trading`, `void`, `voidmagic`, `voken`, `vsafe`,
`vulture-flix`, `vulture-music`, `vulture-pods`, `vulture-studios`,
`vxllage` — 34 apps, not "thirteen-plus" still owing a conversion).
`diff` against this shell's own copy comes back empty for every one
checked, so this is the "shared npm-style package or a build-time
copy" the document called "the real fix," not a divergent fork.

**Per-app palettes are no longer undecided either.** Every one of
those 34 apps' own `index.html` calls `VACO.app({ … accent, accentDim,
accentInk … })` with its own real hex values, each with a one-line
rationale comment in the source — not just VACAY's. `VACO_PALETTE_REGISTER.md`
is the register of record for these; as of this pass it is missing
rows for four of them (CVLLEX, YAP, VACO Analytics, VACO Passport),
corrected there in the same pass that found this.

What is genuinely still open: VDP (a separate Vite origin) takes only
the CSS half. `vdp/index.html` links `vaco-design.css` as a plain
static file (not a bundled/npm import) and sets its own accent via an
inline `style` attribute rather than calling `VACO.app()` — `vdp/index.html`'s
own comment explains why: `vaco-ui.js` manipulates the DOM directly and
would fight React for it, so VDP skips that half and hand-builds the
equivalent in `App.jsx`. That is a real, deliberate exception, not an
oversight, but it means VDP is not a full second consumer of the shared
runtime the way the single-origin Express apps are.

### One thing to decide before starting

The directive asks for both a unifying family look *and* a distinct
identity per app. Those pull against each other, and the resolution
should be explicit rather than discovered per-app: typically the
shared layer owns **structure** (type scale, spacing, component
shapes, interaction language) and the per-app layer owns only
**color** and a small amount of character. VACAY's palette fits that
model cleanly. Left unstated, the likely outcome is fourteen apps that
each reinterpret the shared system differently — which looks exactly
like the disconnected family this document exists to prevent.
