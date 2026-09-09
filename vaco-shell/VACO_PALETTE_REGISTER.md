# VACO Palette Register

The one place every app's accent colour is recorded.

`VISUAL_DESIGN_COHESION_DIRECTIVE.md` asks for two things that pull
against each other: a unifying family look, and a real identity per app.
The resolution, decided once and written into `public/vaco-design.css`
itself:

> The **shared layer owns structure** — type scale, spacing, radii,
> component shapes, interaction language. The **per-app layer owns
> colour**, and only colour, via four accent tokens.

This file is the register of that one variable. Without it, the
twenty-sixth app invents a hue against nothing, which is exactly the
outcome the directive exists to prevent.

## How an app declares its identity

```js
VACO.app({
  id: 'void',
  name: 'VOID',
  accent:    '#7c85e8',   // the hue
  accentDim: '#5a63c9',   // hover / pressed
  accentInk: '#080b14',   // text ON the accent — contrast, not taste
});
```

`accentSoft` defaults to the accent at ~15% alpha and rarely needs
setting. Overriding anything beyond these four is how the family look
erodes.

## The register

Accents are distributed around the wheel so that no two apps a user is
likely to have open together read as the same brand. Hue is approximate,
sorted by it.

| Hue | App | Accent | Why this one |
|---:|---|---|---|
| 4° | CVNVO | `#e2716b` | Muted coral. Warm without the saturated hot-pink every dating app defaults to. |
| 12° | VOID MAGIC | `#e86f4f` | Stage-door coral-orange. |
| 16° | VACAY | `#f0845e` | Sunset coral — the "dusk navy + sunset coral + brass" direction the design directive recorded as decided but which appeared in no file until now. |
| 25° | Vvltvre Pods | `#e08a4f` | Radio-studio rust. |
| 26° | Vex Trading | `#a89080` | Brushed bronze — the register's only *warm neutral*, and the low saturation is what keeps it clear of Vvltvre Pods one degree away. A lobby rather than a terminal: like VACON it routes to the apps that do the work, so it stays quieter than either. Chosen over a blue-grey sibling of VEX because a user launching VEX from here has both open at once, and hue separation had to be real rather than a shade difference. |
| 40° | VAGO | `#d9a23f` | Casino brass, without the garishness. Deliberately distinct from the money-green semantic token so a payout never reads as brand chrome. |
| 52° | VACO Notify | `#d8b24a` | Signal amber — the one place a warm alerting colour is the *subject* rather than a semantic overlay. Chosen over red because this service is not an emergency, it is the thing that tells you about one, and a console that always looks alarming stops being read. |
| 78° | HVNTZ | `#a3c94f` | Lime-olive. Outdoors and searching. |
| 95° | CHOPZ | `#5fd44f` | Vivid spring green. Fast and young. |
| 100° | VACON-C | `#7d9e5c` | Moss. Terrain and settlement — the earthiest in the register. |
| 145° | V3 | `#3faf6e` | Money green. The **one** app allowed to use it as an accent: everywhere else green is reserved as the semantic money colour, so the ledger owning it is consistent rather than a collision. |
| 155° | CHOPZ SHOP | `#2fb37a` | A calmer sibling of CHOPZ's green — this is the half where money changes hands. |
| 158° | VXLLAGE | `#3fbf8f` | Green-teal. Communal; a village square rather than a timeline. |
| 174° | **VACO** | `#46d4c4` | Signal aqua. The front door, and the system's default. |
| 190° | VACA | `#2f9fb8` | Teal-blue. Trust infrastructure, adjacent to VSAFE but greener so the two consoles are never confused. |
| 192° | DREAMS | `#3fbde0` | Backlit-display cyan. |
| 205° | VEX | `#6b8299` | Graphite-blue. Trading-terminal restraint; must not read as VOKEN, whose cards it trades. |
| 210° | VSAFE | `#4d94e8` | Signal blue. Calm authority rather than alarm red — the colour of a service you want to be boring. |
| 215° | Vvltvre Studios | `#5a8fd6` | Steel blue. This is the arm that writes cheques; it should not look like the label. |
| 230° | VACON | `#8a90b8` | Slate-indigo. Infrastructure, deliberately quieter than the apps it routes to. |
| 235° | VOID | `#7c85e8` | Deep indigo. Logistics at night. |
| 240° | Shield | `#8f8fd6` | Steel-lavender. Plumbing, adjacent to VACON. |
| 265° | Vavlt Stvdios | `#9b6ef0` | Electric violet. Broadcast and stage lighting. |
| 280° | VENVM | `#a45ce0` | Violet-purple, one step warmer than Vavlt Stvdios — related, since both are production tools, without being confusable. |
| 295° | Vvltvre Music | `#c45ad4` | Orchid-magenta. |
| 330° | VOKEN / CVLTVRE | `#e0559b` | Magenta-rose. Cvltvre and collecting, rather than the gold every collectibles site reaches for. |
| 345° | Vvltvre Flix | `#b03a52` | Deep wine. Cinema-house dark rather than the streaming-red every competitor uses. |

## Rules

1. **Semantic colours are not the accent.** `--vaco-money`,
   `--vaco-warn`, `--vaco-danger`, and `--vaco-info` mean the same thing
   in every app and must never be re-pointed at a brand hue. An app that
   recolours "money" makes a green number mean something different in
   every app, which is the one thing a shared ledger cannot afford.
   V3 is the single deliberate exception, and only because its accent
   and the money token mean the same thing there.
2. **Check this file before adding an app.** A new accent should sit at
   least ~10° from its neighbours, or differ clearly in lightness.
3. **`accentInk` is a contrast decision, not a taste one.** It is the
   text colour that sits *on* the accent; it must stay readable. Vvltvre
   Flix uses white because its wine is dark enough to need it.
4. **Sub-apps stay in their parent's family.** CHOPZ SHOP sits beside
   CHOPZ; VENVM beside Vavlt Stvdios. Related products should look
   related without being the same.

## What is still open

Per-app identity here is **colour only**, which is the deliberate
resolution above — but the directive also allows "a small amount of
character" per app. None of the apps use a distinct typeface, and the
shared type scale is the same everywhere. That is the conservative
reading and can be revisited once the family look is established rather
than aspirational.
