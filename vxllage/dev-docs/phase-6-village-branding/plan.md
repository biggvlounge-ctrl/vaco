# Plan — Phase 6: Village Branding

## Goal
Adopt "Village" as the product's own real brand identity per direct
instruction, with its own tagline ("There's no I in Village"), an
expanded six-comparable list (Zoom, Reddit, Substack, Twitter, Zoom
Business, Clubhouse), and "Note" as the real user-facing term for a
post. A branding/documentation pass, not a functional rebuild.

## Real investigation before any code
Two real ambiguities were resolved by asking directly rather than
guessing, given the real cost of guessing wrong (a data-model rename
would have touched VDP's own already-shipped Village District
integration and `articles.js`/`surfaceLinks.js`, all built against the
real `Post` name):
1. Whether "Note" meant a real rename of the `Post` entity/API, or
   branding for a future UI. Answered: "Post is fine" — the code stays
   exactly as built; Note is real, scoped, user-facing copy only.
2. Whether "Village" describes the whole app now, or just stays scoped
   to the existing Discord-style Villages sub-feature (which the new
   comparable list's own dropped "Discord" entry made ambiguous).
   Answered: Village = the whole app's brand, VXLLAGE stays the
   technical/repo name — the same real relationship VACO now has to
   `vaco-shell/`.

## Design
- The README's own title and intro become the source of truth for the
  brand statement and the six-comparable list, mapped explicitly to
  what's actually built (Home/Threads/Articles/Villages) versus what
  still doesn't exist (Call's two named surfaces, Zoom and Zoom
  Business — real, distinct names now, but neither built, since real
  audio/video infrastructure still doesn't exist anywhere in this
  ecosystem).
- "Village" (the brand) and "Villages"/VDP's own "Village District"
  (the existing sub-feature) now share a name at two different scopes
  on purpose — documented directly as a real naming note, the same
  posture already used for Shell/Shield/VACO and VACANCY/VACON-C,
  rather than silently smoothed over or renamed away.
- `lib/posts.js`'s own header gets a real, scoped naming note pointing
  future UI work at "Note," without touching any of its real exported
  function/field names.

## Explicitly NOT in this task
Renaming `Post`/`createPost`/`/api/posts` or any of their call sites
(VDP's Village District, `articles.js`, `surfaceLinks.js`) — explicit
instruction was to leave these as-is. Building either Call surface
(Zoom or Zoom Business) — both still blocked on real audio/video
infrastructure that doesn't exist anywhere in this session.

## Verification approach
Documentation-only change; no new runtime behavior to test. Confirmed
by re-reading the finished README for internal consistency between the
new brand intro, the naming note, and the existing "What's here"/"Not
yet built" sections it now cross-references.

## Done when
- The brand statement, tagline, and six-comparable list are recorded
  accurately against what's real vs. not.
- The Village/Villages naming overlap is documented, not hidden.
- No code that other real, already-shipped integrations depend on was
  touched.
