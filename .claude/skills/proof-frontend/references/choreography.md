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

## 5. Misuse catalogue — easing and duration

The sections above state the rules; this one walks the same ground from the failure side, because most motion work is *repair*, not greenfield. Each entry gives the drawback first — how the mistake reads to a user who will never name it — then the signal that detects it, then the fix. Where a rule above or a sibling file already owns the fix, the entry points there rather than restating it. The smell test below stays the quick screen; come here when a smell needs a diagnosis path.

| Misuse | How it reads | Detection signal | Fix |
|---|---|---|---|
| **Linear easing on spatial movement** | Mechanical — it reads as computed, not physical | A `transition-timing-function` of `linear` on any transition whose property list includes `transform`. Greppable; for JS-driven motion, read the computed `transitionTimingFunction` the way `verifying-motion.md`'s check 2 sweeps computed styles | §2's table. `linear` is reserved for opacity-only cross-fades and progress indicators. Scrubbed timelines are exempt: when scroll is the playhead, `linear` keyframes are deliberate (`scroll-cinema.md`) |
| **Ease-in on entrances** | Sluggish — the element appears to ignore the trigger, hesitate, then rush in at the end. The start of an entrance is the part the user is watching, and an accelerate curve spends its slowest frames exactly there | `ease-in` or an accelerate-shaped `cubic-bezier` (slow start) on an enter state or entrance keyframe. Grep enter/open/mount states for `ease-in`, excluding `ease-in-out` matches — a bare `ease-in\b` matches both | §2: entrances decelerate — arrive fast, settle gently |
| **Uniform duration everywhere** | Flat — a modal, a tooltip and a route change all carry the same weight, so duration stops signalling importance and the interface loses hierarchy | Dedupe every `transition-duration` and `animation-duration` in the codebase. One value covering both micro-interactions and route transitions is the tell (the smell test's "everything is 300 ms") | §1's per-category ranges. See the note on duration *sets* below |
| **Long durations on frequent interactions** | Elegant in the demo, broken in the daily build — the 50th-encounter tax. The user pays the full duration on every trigger, and delight depreciates into friction | The trigger sits in a primary flow (open/close, expand, back) yet its duration sits at or above the top of §1's *entering* range. If you cannot say how many times a session the interaction fires, that is itself the signal | §1: expensive is crisp. Frequent interactions take the micro-interaction budget, not the entrance budget |
| **Stagger delays that sum to seconds** | A queue — the user watches content they already understand arrive item by item, and the page feels slower than a hard cut would | Do the N × interval arithmetic *before* writing the stagger; at runtime, `verifying-motion.md`'s check 7 clocks the whole sequence against its budget | §3: cap the total, shrink the interval, or animate the container |
| **Motion that blocks input** | The UI is ignoring me — a click during the animation lands nowhere, or lands late on a target that has since moved | Click mid-animation and watch what happens to the input. In code: `pointer-events: none` toggled on animation start, handlers gated behind an awaited animation promise, or state updates deferred to `animationend`/`transitionend` | Motion is presentation, never a lock — see the note below |
| **Symmetric enter/exit timing** | The dismissal lingers — the user has moved on and the interface has not. §2 already names this the tell of a default | Enter and exit share a duration token, or one transition shorthand serves both states | §2's asymmetry rule: exits shorter, on the accelerate curve |
| **Spring overshoot on non-playful surfaces** | Tonal mismatch — overshoot says *playful*, and on a finance, admin, data or clinical surface that reads as unserious and erodes trust | Any keyframe or spring config where the animated value passes its final value before settling, on a surface whose brief never says playful. A rung-6 spring library on such a surface doubles the suspicion | Critically damp it (settle without overshoot) or drop to §2's decelerate curve — then re-check the rung was earned at all (`motion-toolkit.md`) |

**Duration sets versus uniform duration.** `typography-and-restraint.md` demands *one duration set, reused* — that is not a defence of a single value. A set is a few values assigned by category (§1's ranges); uniform is one value assigned by default. The first is consistency; the second is the absence of a decision wearing consistency's clothes.

**On input blocking.** CSS transitions already handle mid-flight interruption correctly — a state change retargets the transition from the current computed value — so blocked input is almost always self-inflicted JS: a handler that waits for the animation before applying the state. Apply state immediately and let the motion catch up. The one platform-imposed lock is `startViewTransition()`: while it runs, the `::view-transition` overlay captures pointer events by default. Where the page underneath can still take input mid-swap, restore it with `::view-transition { pointer-events: none; }`; otherwise keep the transition at the short end of §1's route range — a lock is tolerable during a route change only because the targets it blocks are the ones being replaced. If the motion needs to absorb an interruption *with its current velocity*, that is the one legitimate spring case — rung 6, reason 2, in `motion-toolkit.md`.
