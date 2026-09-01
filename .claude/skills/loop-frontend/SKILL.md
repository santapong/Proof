---
name: loop-frontend
description: "Craft how an interface feels frame by frame: motion choreography, easing and duration budgets, stagger and shared-element continuity, typographic scale and optical sizing, restraint, and perceived-performance patterns. Use when the user asks to make a UI feel premium, expensive, polished or high-end, to add, tune or slow down animation and transitions, to choose an easing curve, to decide between CSS and an animation library (anime.js, GSAP, Motion), to set a type scale, or to fix motion that reads as cheap, janky or nauseating. Enforces prefers-reduced-motion and the WCAG flash limits as gates rather than advice, and operates on pixels and milliseconds in a UI that already renders. For rendering strategy, Core Web Vitals budgets or bundle size, use loop-design. For component structure or framework idioms, use loop-pattern. For a build-vs-buy evaluation of candidate libraries, use loop-scout. For an algorithm's complexity, use loop-algo."
argument-hint: <surface> [--mode <lite|balanced|all-out>]
---

# loop-frontend

**Delete every animation and every font and spacing choice from the page. If the user's complaint disappears, it is this skill. If it survives, it is not.** That is the field test, and it splits the three skills that all touch a frontend:

- *"This product page should be server-rendered under a 170 KB budget"* → **`loop-design`**. Architecture.
- *"The price should cross-fade in over 240 ms on a decelerating curve, and hold still under reduced motion"* → **`loop-frontend`**. Craft.
- *"The price cell should be a memoized presentational component behind a container"* → **`loop-pattern`**. Structure.

All three can come from one request, in that order.

## Two rules this skill will not negotiate

These are in the body, not a reference, because a reader must not be able to miss them.

**1. Flashing is a refusal, not a warning.** This skill will not author an effect that flashes more than three times in any one second, or that breaches the general or red flash thresholds of **WCAG 2.2 SC 2.3.1 (Level A)**. Level A has no conformance opt-out and `prefers-reduced-motion` does not satisfy it — this is seizure risk. If asked for one, decline, say why, and offer the non-flashing equivalent.

**2. Every non-essential animation ships a reduced-motion branch — and that branch substitutes, it does not delete.** Where a gentler equivalent exists, swap it: an opacity cross-fade in place of a scale, translate or parallax. The spec asks for "safer animations **or** the absence of animation", so removal is the fallback, not the default. Interaction-triggered motion — parallax, mouse-move response, scroll-driven movement — is **off by default** under reduced motion.

```css
@media (prefers-reduced-motion: reduce) {
  .card { transition: opacity 120ms linear; transform: none; }
}
```

`references/accessibility.md` carries the rest: SC 2.2.2 pause/stop/hide, focus management across view transitions, and the honest note that Media Queries L5 is still a Working Draft even though support is universal.

## Execution flow

### 1. Parse arguments

- **surface** — the page, component or interaction to work on. If empty, ask which surface and what it should feel like.
- **`--mode`** — advertised here, parsed by `loop-engine`; pass the raw argument string through.

### 2. Source and deconstruct the references

Most of this work starts as "make it feel like *that* site". Per `references/sourcing-ideas.md`, convert that into a **mechanism you can specify** rather than an appearance you copy — five questions per reference: what actually moves (name the properties), what triggers it, how long and on what curve, what rung it needs, and what it is *for*.

Hand the actual searching to `loop-research`, and a library-adoption decision to `loop-scout`. Come back here with references; the deconstruction and the evaluation happen in this skill.

**Check every reference against this skill's own gates before adopting it.** Most gallery work has no reduced-motion branch at all — emulate it in DevTools and look. A reference that fails is not a reference, it is a warning: take the mechanism, leave the negligence.

### 3. Establish the budget before choosing anything

Motion without a stated budget is decoration. Per `references/choreography.md`:

- Anything the user **directly caused** should complete within ~**100 ms** — Nielsen's threshold for "feels instantaneous".
- A **system response** that must still feel responsive has ~**400 ms** as its ceiling (Doherty).
- **A stagger interval is a budget, not a per-item duration.** N items × interval is what the user actually perceives; 12 items at 80 ms is a second of waiting.

Write the numbers down before picking a curve. Both figures are research-backed but **not standards** — cite them as such, and never as equivalent to a W3C criterion.

### 4. Climb the escalation ladder — stop at the first rung that works

This is the skill's central discipline and the answer to "should I use anime.js?". Per `references/motion-toolkit.md` — which also carries the situation→mechanism selection table, the interruptibility tie-breaker (transitions retarget cleanly; keyframes snap), and the SSR/hydration cost split:

| Rung | Mechanism | Use it for |
|---|---|---|
| 1 | CSS `transition` | Hover, focus, open/close — most state change |
| 2 | CSS `@keyframes` | Enter/exit, looping ambient motion |
| 3 | `document.startViewTransition()` | Route and state changes with shared-element continuity |
| 4 | `animation-timeline: view()` | Scroll-linked reveals |
| 5 | `Element.animate()` (WAAPI) | One-off programmatic tweens needing JS values |
| 6 | **A library** | Only for a named reason below |

**Climb to rung 6 only for one of these five**, and say which in the report:

1. An orchestrated multi-element timeline needing mid-flight seeking.
2. Genuine interruptible spring physics — there is no `spring()` in any CSS Easing spec as of 2026-07.
3. SVG path morphing.
4. A scroll-scrubbed scene with pinning.
5. Gesture- or drag-driven motion.

**If the page is a scroll-driven narrative**, read `references/scroll-cinema.md` before choosing a rung. It carries the distinction the rest of this genre turns on — **trigger** (scroll as a switch, cheap, native, rung 4) versus **scrub** (scroll as the animation's playhead, expensive, usually rung 6) — plus scene decomposition, the scroll budget, and the rule that pinning is legitimate while scroll-jacking never is.

Absent one of the five, **recommending a library is over-engineering**, and `loop-scout` exists to prevent exactly that. Rungs 1–5 cost zero bytes on a critical path where anime.js's full default import measures **40.3 KB gzipped** — budget that belongs to `loop-design`.

At rung 6, route by stack, not preference — the pinned table with versions and licences is in `references/motion-toolkit.md`. In short: **anime.js** (MIT) is the default for framework-agnostic work; **GSAP** for large orchestrated timelines and SVG morphing *if the team accepts a free-but-proprietary licence*; **Motion** (MIT) when the app is already React-shaped and wants springs.

### 5. Choose the curve, then the choreography

Per `references/choreography.md` (its §5 misuse catalogue diagnoses the failures from the symptom side, detection signal before fix). Linear reads mechanical; the expensive feel comes from **asymmetry** — decelerate on entry, accelerate on exit — and from motion that respects where an element came from. Shared-element continuity beats a cross-fade wherever the same object persists across states.

### 6. Set type and space

Per `references/typography-and-restraint.md`: a modular scale rather than ad-hoc sizes, optical sizing where a variable font offers it, and restraint as an active choice. Most "cheap" interfaces are over-decorated, not under-decorated.

### 7. Make the wait feel shorter

Per `references/perceived-performance.md`: skeletons that match final layout (a spinner tells the user nothing), optimistic UI where the failure path is cheap, and never animating a layout property to fake progress.

### 8. Verify against the frame budget

Animate **`transform` and `opacity` only** — the two confirmed compositor-only properties. `filter` is not one, nor is `box-shadow` or `background-position`. Anything that looks like a layout change (list reorder, card expand, hero move) goes through **FLIP** or View Transitions, never a direct animation of `width`, `height`, `top`, `left`, `margin` or `flex-basis`. This is simultaneously the frame-cost rule and the CLS-safety rule.

`will-change` goes on shortly before the animation and comes off when it ends. Never leave it standing across many elements — every promoted layer costs GPU memory, and the spec's own warning is that misuse "can cause the page to slow down or even crash".

### 9. Specify the runtime checks

Reading the source cannot confirm most of what this skill asserts. Six of the seven rules in `references/verifying-motion.md` need a browser: whether the reduced-motion branch **substitutes** rather than deletes, whether focus lands after a view transition, whether a pinned scene traps focus, whether anything breaches the flash thresholds, whether motion wrecks CLS, whether the sequence lands inside its budget.

Emit the check list — **this skill specifies, `loop-test` authors** the files in whatever stack the project already runs. Put the three accessibility checks in CI; they have a named WCAG criterion behind them and no legitimate reason to fail.

Adding no dependency to the plugin is deliberate: these run against the user's project, not against Proof, which is stdlib-only by design.

### 10. Report

State the budget you set, the rung you stopped at and why, the reduced-motion branch for every animation, **which runtime checks you specified and which are in CI**, and any pin you could not confirm. Be explicit that a green suite proves the motion is not broken or harmful — it does not prove it is good, and nothing here checks whether it feels expensive. If you declined a flashing effect, say so and name the criterion.

## Orchestration

Inline for a single interaction. For a whole surface, `templates/motion-audit.workflow.js` fans out one auditor per interaction and reconverges at a barrier — earned, because the **total** motion budget and the house curve set are cross-item properties that no per-item pass can see.

## A gap this skill does not fill

`loop-frontend` enforces the WCAG motion criteria **at authoring time, on code it is writing**. It is not a general accessibility auditor. No skill in this plugin currently owns "audit this existing app for WCAG conformance" — that is a real fleet gap, stated here rather than quietly annexed.

## Reference files

| File | What it holds |
|---|---|
| `references/sourcing-ideas.md` | Turning "make it feel like that site" into a mechanism: where to look and each source's bias, the five deconstruction questions, the evaluation filters |
| `references/scroll-cinema.md` | Scroll-driven narrative: trigger vs scrub, scene decomposition, the scroll budget, pinning vs scroll-jacking, the per-frame performance traps, and why reduced motion must collapse the cinema entirely |
| `references/verifying-motion.md` | The runtime check catalogue — what only a browser can confirm, how to assert each one, and what automation still cannot tell you |
| `references/standards.md` | The pinned authority shelf — and the honest note that only two entries in this whole domain are ratified |
| `references/motion-toolkit.md` | The escalation ladder, the rung-6 routing table, pinned versions and licences |
| `references/choreography.md` | Easing, duration budgets, stagger, shared-element continuity, the asymmetry rule |
| `references/typography-and-restraint.md` | Modular scale, optical sizing, negative space, restraint as a decision |
| `references/perceived-performance.md` | Skeletons, optimistic UI, and what actually shortens a perceived wait |
| `references/accessibility.md` | The flash thresholds, pause/stop/hide, focus across view transitions, reduced-motion patterns |
