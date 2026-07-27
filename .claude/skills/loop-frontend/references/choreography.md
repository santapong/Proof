# Choreography — easing, duration, stagger, continuity

What separates motion that reads as expensive from motion that reads as a jQuery plugin. Four ideas, in the order you apply them.

## 1. Budget first

Motion without a stated budget is decoration. Write the number before choosing a curve.

| The user… | Budget | Source |
|---|---|---|
| directly caused it (tap, hover, drag) | **~100 ms** — "instantaneous" | Nielsen threshold 1 |
| is waiting on a system response | **~400 ms** ceiling | Doherty |
| is waiting on something genuinely slow | **< 1 s** keeps the flow of thought unbroken; **10 s** is the attention limit | Nielsen thresholds 2 and 3 |

Both figures are **research-backed but not standards** (grade `No` — see `standards.md`). Cite them as evidence, never as equivalent to a W3C criterion, and never as equivalent to a vendor's token table.

Practical ranges that fall out of it: micro-interactions **100–200 ms**; entering elements **200–320 ms**; exiting elements **150–250 ms** (see asymmetry, below); a full page or route transition **300–500 ms** total.

**The most common luxury mistake is slowness.** Designers reach for 600 ms because it looks languid in isolation, and it feels broken the fiftieth time a user triggers it. Expensive is *crisp*, not *slow*.

## 2. Easing — the asymmetry rule

Linear reads mechanical because nothing in the physical world moves at a constant velocity between rest states.

| Curve | Use |
|---|---|
| **Decelerate** — `cubic-bezier(0, 0, 0.2, 1)` | Things **entering**. Arrive fast, settle gently. The single most useful curve |
| **Accelerate** — `cubic-bezier(0.4, 0, 1, 1)` | Things **leaving**. Depart gently, exit fast — the user stops caring once it is going |
| **Standard / emphasized** — `cubic-bezier(0.2, 0, 0, 1)` | Things **moving within** the viewport, both ends visible |
| `linear` | Only opacity-only cross-fades, and progress indicators |

**Entry and exit should not share a curve or a duration.** Exits run shorter than entries — typically 150–250 ms against 200–320 ms — because a user who dismissed something has already moved on. Symmetric motion is the tell of a default.

`cubic-bezier()` and `linear()` are defined in **CSS Easing L1 (Candidate Recommendation Draft)**. There is **no `spring()`** in L1 or L2 — that absence is precisely why rung 6 exists for genuine spring physics.

## 3. Stagger — an interval is a budget

**N items × interval is what the user perceives.** Twelve list items at 80 ms is nearly a second of waiting before the last one lands, no matter how crisp each individual animation is.

- Keep the **total** under ~500 ms. Twelve items → **30–40 ms** interval, not 80.
- Stagger in **reading order**, or radially from the element the user just touched. Staggering in DOM order when DOM order is not visual order looks like a bug.
- Above ~15 items, stop staggering per item and animate the container, or cap the stagger and let the tail arrive together. `log()`-style honesty applies to design too: a stagger nobody waits to finish is wasted.

## 4. Continuity beats cross-fade

The strongest single upgrade available. **Where the same object persists across two states, move it — do not fade one out and another in.**

A product thumbnail that becomes the detail hero. A list row that expands into a card. A nav item that becomes a page title. Cross-fading these throws away the relationship the user is tracking, and their eye has to re-acquire the object on the other side.

Native mechanism: **View Transitions** (rung 3) with a shared `view-transition-name`. Fallback where unsupported, and for layout-driven moves: **FLIP** — measure First, apply Last, Invert the delta as a transform, then Play it to zero. FLIP is the reason a "layout" animation can still be compositor-only: you animate `transform`, never `width` or `top`.

## The frame-cost rule that constrains all of the above

**Animate `transform` and `opacity` only.** They are the two confirmed compositor-only properties — the compositor can move an already-painted layer without re-running style, layout or paint.

`filter` is **not** compositor-only. Neither is `box-shadow`, `background-position`, `width`, `height`, `top`, `left`, `margin`, or `flex-basis`. Animating any of them re-runs layout or paint every frame, which is what "janky" actually is.

Anything that *looks* like a layout change goes through FLIP or View Transitions. This is simultaneously the frame-cost rule and the CLS-safety rule — a direct layout animation is a layout shift by construction.

`will-change` goes on shortly before the animation and comes off when it ends. Never standing, never on many elements: every promoted layer costs GPU memory and texture-upload bandwidth, and the spec warns misuse "can cause the page to slow down or even crash".

## Smell test

- Everything is 300 ms → nobody set a budget.
- Entry and exit are identical → a default, not a decision.
- A stagger you can count → interval too long, or too many items.
- Cross-fade where the object persists → a continuity opportunity thrown away.
- Motion that survives `prefers-reduced-motion` unchanged → an accessibility defect, see `accessibility.md`.
