# Typography, space, and restraint

Motion is the loud half of this skill. Typography and space are the half that does most of the work, and restraint is the part that separates expensive from busy.

**Most interfaces that read as cheap are over-decorated, not under-decorated.** Adding is the reflex; the craft is in subtraction.

## The modular scale

Ad-hoc sizes are the most reliable tell of an unconsidered interface: 14, 15, 16, 18, 21, 24, 32, 33. Pick a ratio and derive every size from it.

| Ratio | Feel | Use |
|---|---|---|
| **1.200** minor third | Tight, dense | Data-heavy UI, dashboards |
| **1.250** major third | Balanced | Most product UI. The safe default |
| **1.333** perfect fourth | Airy, editorial | Marketing, long-form |
| **1.618** golden | Dramatic | Display and hero only — too coarse for a whole UI |

From a 16 px base at 1.250: 16 → 20 → 25 → 31 → 39 → 49. Round to whole pixels and stop. **Six sizes is a full scale**; if you need a seventh, the problem is hierarchy, not typography.

Express it as CSS custom properties so the ratio is a single point of change, and use `clamp()` for fluid scaling rather than a stack of breakpoints.

## Optical sizing and variable fonts

At display sizes, type designed for body text looks flabby — the letterforms carry spacing and contrast tuned for 16 px. A variable font with an optical-size axis fixes this automatically:

```css
h1 { font-optical-sizing: auto; }                    /* honours the opsz axis */
.display { font-variation-settings: "opsz" 48, "wght" 300; }
```

**Lighter weights read as more expensive at large sizes** — and only at large sizes. A 300 weight at 14 px is unreadable, especially on low-density displays and for low-vision users. Weight down as size goes up, never uniformly.

Controlled by **CSS Fonts L4, a Working Draft** (22 Apr 2026). The font binary format has an ISO anchor — **ISO/IEC 14496-22 Open Font Format** — where a newer edition was in FDIS ballot as of March 2026 and is **unconfirmed as ratified**.

## The details that actually register

Small, cheap, and disproportionately effective:

- **Line height scales inversely with size.** Body ~1.5–1.6; headings 1.1–1.25. A heading at 1.5 looks unset.
- **Measure: 45–75 characters.** Use `max-width: 65ch`. Full-width body text at 1400 px is the most common reason a page feels unpolished.
- **Tighten tracking on large type** (`letter-spacing: -0.02em` on display sizes), loosen it slightly on small caps and all-caps.
- **Tabular numerals** for anything that changes in place — prices, counters, timers. `font-variant-numeric: tabular-nums` stops the digit jitter that makes a live number look broken.
- **Real punctuation.** Curly quotes, en dashes in ranges, a proper ellipsis. Straight quotes read as unfinished.

## Space as a system

Space, like type, comes off a scale — usually a 4 px or 8 px base. The rule that matters more than the scale itself:

**Related things are closer than unrelated things.** Most "cluttered" interfaces have uniform spacing everywhere, so nothing groups. A label sitting 4 px from its input and 24 px from the next field is doing more for legibility than any border.

**Negative space is a positive decision.** The instinct under a deadline is to fill it. Resist: the whitespace *is* the luxury signal, in the same way an expensive shop floor is mostly empty.

## Restraint — the actual differentiator

Every effect competes with every other effect for the user's attention. Spending it everywhere means nothing reads as important.

- **One focal point per view.** If three things animate on entry, none of them is the point.
- **Motion earns its place or is cut.** "It looked cool" is not a reason; "it shows where this came from" is.
- **Consistency over novelty.** One easing set and one duration set, reused. Five different curves reads as five different developers.
- **The fiftieth encounter, not the first.** Every effect gets judged on how it feels once it is familiar. Delight that becomes friction is a defect.

## Smell test

- More than six type sizes → no scale.
- Uniform spacing everywhere → no grouping.
- Body text wider than ~75 characters → no measure.
- Digits jumping in a live counter → no tabular numerals.
- A light weight at body size → weight chosen globally, not optically.
- Three things animating on entry → no focal point.
