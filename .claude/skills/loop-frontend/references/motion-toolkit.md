# The escalation ladder — and when a library is actually earned

The single most consequential decision in this skill, and the one most often got wrong in the expensive direction. **Start at rung 1. Climb only for a named reason. Most luxury motion never leaves rung 3.**

The reason to be strict: rungs 1–5 cost **zero bytes** on a critical path that `loop-design` budgets at roughly 130–170 KB. anime.js's full default import is **40.3 KB gzipped** — a quarter of that budget, spent on motion a CSS transition would have delivered.

## The ladder

### Rung 1 — CSS `transition`

Hover, focus, open/close, most state change. If the "before" and "after" are both expressible as CSS, this is the answer.

```css
.card { transition: transform 200ms cubic-bezier(0.2, 0, 0, 1), opacity 200ms linear; }
.card:hover { transform: translateY(-4px); }
```

### Rung 2 — CSS `@keyframes`

Enter/exit sequences and ambient looping motion — anything with intermediate states. Pair with `animation-fill-mode: both` so the element does not snap at either end.

### Rung 3 — `document.startViewTransition()`

**Route and state changes with shared-element continuity.** This is the rung people skip straight past to a library, and it is usually the right answer for the effect they actually wanted: an element that visually *persists* across a state change rather than cross-fading.

```js
if (!document.startViewTransition) { update(); }        // progressive enhancement
else { document.startViewTransition(() => update()); }
```

Give the persisting element a `view-transition-name` and the browser does the tweening. **Ships with mandatory accessibility work** — see `accessibility.md`; the transition pseudo-element tree is not exposed to the accessibility tree and focus does not move on its own.

### Rung 4 — `animation-timeline: view()`

Scroll-linked reveals and progress indicators, driven by the compositor rather than a scroll listener. Feature-detect and fall back — support is not universal.

```css
@supports (animation-timeline: view()) {
  .reveal { animation: fade-up linear both; animation-timeline: view(); animation-range: entry 20% cover 40%; }
}
```

### Rung 5 — `Element.animate()` (WAAPI)

A one-off programmatic tween whose values only exist at runtime — a measured distance, a computed colour. Returns an `Animation` you can pause, reverse and await. This is the engine most JS libraries sit on; reaching for it directly skips their bytes.

### Rung 6 — a library

**Only for one of these five.** Name which one in the report, or you have not earned the rung:

1. **An orchestrated multi-element timeline with mid-flight seeking** — a sequence you scrub, reverse or jump into. Expressible in CSS only as an unmaintainable knot of delays.
2. **Genuine interruptible spring physics.** There is **no `spring()` in CSS Easing L1 or L2** as of 2026-07. A cubic-bezier approximation is not a spring: it cannot absorb a mid-flight interruption with correct velocity.
3. **SVG path morphing** between different point counts.
4. **A scroll-scrubbed scene with pinning** — element held while the scene advances.
5. **Gesture- or drag-driven motion** with velocity hand-off into an inertial settle.

Everything else — fades, slides, staggers, reveals, hovers, page transitions — is rungs 1 to 5.

## Rung-6 routing

By stack and need, not preference. **Re-read the version and licence from the registry before recommending** — see the discipline note in `standards.md`; this table's pins are dated, not eternal.

| Library | Pin | Licence | Reach for it when | Watch out |
|---|---|---|---|---|
| **anime.js** | **v4.5.0** (2026-06-22) | **MIT** | Framework-agnostic or vanilla, and one of the five reasons applies. The default at this rung | **40.3 KB gzipped** on the full default import — import the modules you use; it is ESM-native and genuinely tree-shakeable. v4 was a from-scratch rewrite, so v3 syntax found online will not work |
| **GSAP** | **3.15.0** | **Webflow "Standard No Charge"** — free for commercial use, **proprietary, not OSI-approved** | Large orchestrated timelines, SVG morphing, ScrollTrigger scenes with pinning | The licence is the catch, not the price. It **bars use in no-code visual animation tools that compete with Webflow**, and bars reverse-engineering for competitive products. Free ≠ open source. Confirm the team accepts it |
| **Motion** | **12.42.2** | **MIT** | The app is already React-shaped and wants real spring physics | Adds a React dependency to motion; not the choice for vanilla |

**Two stale claims to avoid**, both of which were true recently and are not now:

- *"GSAP costs money / needs a Club membership."* Stale since **April 2025**, following Webflow's October 2024 acquisition of GreenSock. Core plus all former Club plugins are free for commercial use.
- *"GSAP is open source."* Also wrong. It is free-of-charge and proprietary. Say the accurate thing: **free to use commercially, under a licence with competitive-use restrictions.**

## Why the ladder rather than a pinned default

This space moves fast enough to break a pin. GSAP's licence changed materially inside fifteen months; anime.js shipped a breaking rewrite in roughly the same window, with further breaking changes inside its 4.x minors.

A skill whose body says *"use anime.js"* ages into a skill that pastes v3 syntax at a v4 API. A skill whose body says *"climb the ladder, and here is the rung-6 table re-verified on this date"* stays correct as the table is re-verified. **The ladder is the durable part; the table is the perishable part**, which is why they live in different files.

## Handing off to `loop-scout`

If the question is *"which animation library should this project adopt"* — a genuine build-vs-buy with adoption criteria, a named winner and a runner-up — that is **`loop-scout`**, not this skill. `loop-frontend` only walks its own ladder and answers *"does this specific motion need a library at all, and which rung is it?"* Its most common correct answer is **no library**.
