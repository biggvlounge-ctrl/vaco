# VDP — Shell Exit Flow Resolution (v1)

VDP's own Master Freeze summary flagged one open item: "exit" behavior
pending a decision from whoever owns VACO Shell / cross-app navigation.
That decision-owner is Shell's own architecture, already built — the
answer already exists, it just needed to be connected back.

The resolution: every app screen in Vaco Shell already receives a
standard `onBack` handler that returns to Shell's home hub:

```jsx
{app && AppComponent && <AppComponent app={app} onBack={() => setScreen("hub")} ... />}
```

This is VDP's exit behavior, with no new mechanism needed — exiting VDP
returns the player to Shell's avatar-centric home hub, the same exit
pattern every other app in the ecosystem already uses. There is no
special-case "leave the planet" flow to design; VDP plugs into the exact
same `onBack` contract HVNTZ, VOID, CVNVO, and every other app already
use.

What this means for VDP's build docs: `VDP_MASTER_ARCHITECTURE.md` (or
wherever Entry/Exit flow is documented) should state this plainly:
Visitors spawn at the Genesis hub, Citizens spawn at their home, and
exit — for either — calls Shell's standard `onBack`/home-hub return, not
a bespoke mechanism. This closes the one explicitly flagged open
dependency in VDP's own summary.

---

## Implementation status — filed 2026-08-27. **Premise does not hold.**

Filed per `VACO.md`'s filing form. Classified **CODE-BEARING**. The
conclusion above — *VDP should use the ecosystem's standard exit, not a
bespoke one* — is right and is adopted. **The mechanism it names is
not real**, so the item it claims to close is still open.

### What the duplication check found

1. **`vaco-shell` contains no JSX and no React.** It is an Express app:
   `server.js`, `lib/`, and a `public/` directory holding
   `index.html`, `vaco-design.css` and `vaco-ui.js`. There is no
   component tree for an `onBack` prop to be passed through.

2. **The quoted line does not exist anywhere in this repo.** A search
   for `setScreen("hub")` across every `.js`/`.jsx` returns nothing. The
   nearest real code is `v4-proxy/V4Prototype.jsx`, which does have
   `onBack` props — but that is V4's own prototype screen stack, a
   different app, and it does not govern cross-app navigation.

   This is the failure mode `VACO.md` already records by name:
   *"`V4_CLAUDE.md` was cited in working code while the file itself had
   never been saved. Citation is not presence."* Same shape here — a
   mechanism quoted as already-built, which nothing implements.

3. **VDP has no exit affordance of any kind.** `vdp/src/App.jsx`
   renders a wallet, a login button and the world; there is no link,
   button or handler that returns to Shell. `vdp/` has no `public/`
   directory and is deliberately excluded from `sync-design-system.sh`'s
   targets (it is a Vite app whose assets live elsewhere), so it does
   not inherit the masthead that carries the standard exit.

### What the real ecosystem exit contract is

There *is* a standard, and it is not `onBack`. Two mechanisms, both
real and both readable in the code:

- **Shell launches apps as separate origins in a new tab.**
  `vaco-shell/public/index.html` builds each tile as
  `tile.href = app.url + '?shieldToken=' + …` with `target = '_blank'`.
  Apps are not mounted inside Shell as components — which is exactly
  why no `onBack` prop could exist.
- **Every app that serves the shared design system gets a masthead
  brand link home.** `vaco-ui.js` builds it with
  `brand.href = VACO.SHELL_URL` and `title = 'Back to the VACO app
  store'`.

So the document's *intent* is satisfiable and its *instruction* stands:
VDP should use the ecosystem's standard exit rather than inventing one.
It just has to be the standard that exists — a return link to
`SHELL_URL` — and VDP needs one built, because it currently has none.

### Remaining work, stated honestly

- Give VDP a real exit affordance to `SHELL_URL`, matching the
  `vaco-ui.js` masthead contract rather than a new pattern.
- Then, and only then, document Entry/Exit in VDP's architecture notes.
  `VDP_MASTER_ARCHITECTURE.md` does not exist in this repo either, so
  the "where Entry/Exit flow is documented" question is open too; VDP's
  `README.md` is the honest home for it until that document arrives.

### Resolved 2026-08-27

VDP now carries the real exit: a "← Back to the VACO app store" link in
`App.jsx` pointing at `SHELL_URL` (`VITE_SHELL_URL`, defaulting to
`http://localhost:8789` — the same default `vaco-ui.js` hardcodes, and
the port `start-ecosystem.sh` actually runs the Shell on, both checked
rather than assumed). Same contract as every other app's masthead brand
link, built directly because VDP does not inherit the masthead.

So the document's instruction is satisfied and its mechanism is not,
and both facts are recorded above. `VDP_MASTER_ARCHITECTURE.md` still
does not exist; the note lives at the render site in `App.jsx`, where
the next person to touch the exit will actually read it.
