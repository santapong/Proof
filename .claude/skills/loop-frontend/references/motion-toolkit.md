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

## Mechanism selection — situation first, drawback first

The ladder says how far to climb; this table says which rung a given situation lands on — and why the neighbouring rungs are wrong for it. Read the third column before the second: every mechanism here is chosen by the drawbacks of its alternatives, not its own appeal.

| Situation | Mechanism | Why not the alternatives |
|---|---|---|
| Hover, focus, toggle, drawer — anything the user can reverse mid-flight | CSS `transition` (rung 1) | `@keyframes` cannot retarget — an interrupted keyframe animation snaps or restarts (see below). WAAPI is runtime JS, and a library is bytes, spent on two endpoints CSS already expresses |
| Enter/exit sequence or ambient loop with intermediate states | CSS `@keyframes` (rung 2) | A transition only knows two endpoints. WAAPI adds runtime JS for values that were known at authoring time |
| An element that persists across a route or state change | View Transitions (rung 3) | Hand-rolled FLIP in a library rebuilds what the browser tweens for free; keyframes cannot tween between two different DOM states at all. The cost you do accept: mandatory a11y work — see `accessibility.md` |
| Scroll-linked reveal or progress scrub, no pinning | Scroll-driven CSS (rung 4) | A JS scroll listener runs on the main thread on every frame of scroll — `scroll-cinema.md` calls that the harshest budget in frontend, and owns the fallback pattern. A library scrub only earns its bytes once pinning enters (rung 6, reason 4) |
| One-off tween of runtime-measured values | WAAPI `Element.animate()` (rung 5) | Stylesheets cannot see a measured distance without custom-property plumbing; a library at this point is a paid wrapper around the engine you already have |
| Spring physics, scrubbed multi-element timeline, path morphing, pinning, gesture hand-off | Library (rung 6) | The only row where the platform genuinely cannot. The admission criteria are the five reasons in the ladder above — nothing softer |

If a situation matches two rows, take the row nearer the top — the table is ordered by cost, and the ladder's rule is to climb only for a named reason.

## The property decides before the mechanism does

The hard default, stated once here and owned in full by `choreography.md`: **animate `transform` and `opacity` only.** Everything below assumes it.

What that rule means *for selection*: no mechanism in the table rescues a layout-triggering property. A CSS transition on `width` re-runs layout every frame and is worse than a library tweening `transform`. If the motion looks like layout, restructure it (FLIP, View Transitions — see `choreography.md`) before touching the mechanism question.

Within compositor-only properties the mechanisms are still not equal, and the difference is *which thread does the per-frame work*. A CSS or WAAPI animation of `transform`/`opacity` can run on the compositor thread and keeps moving while the main thread is busy. A rAF-driven library computes the value in JS and writes a style every frame — no layout, no paint, but every frame is hostage to main-thread availability, which is exactly when frames drop.

So the two decisions come in this order:

1. **Property** — compositor-only, or restructure the motion first. Non-negotiable.
2. **Mechanism** — the table above, knowing that the platform rungs also buy off-main-thread execution, while a library additionally spends main-thread time parsing and executing its bytes before any motion exists — the ladder's founding argument, not a new one.

## Interruptibility — the tie-breaker between rungs 1 and 2

The most common wrong choice inside CSS itself: keyframes where a transition belonged. The difference shows the moment a user changes their mind mid-flight.

| Mechanism | Interrupted mid-flight |
|---|---|
| CSS `transition` | **Retargets cleanly.** Change the target and a new transition starts from the current computed value — no snap, no restart |
| CSS `@keyframes` | **Does not retarget.** Remove or swap the animation mid-run and the element snaps to its underlying value; re-trigger it and it restarts from frame zero |
| WAAPI | Retargets like a transition when the replacement tween leaves its start keyframe implicit, plus direct control that CSS-declared motion only exposes indirectly through `getAnimations()`: `pause()`, `reverse()`, `playbackRate`, a `finished` promise |
| Library | As WAAPI, plus velocity-aware hand-off if it implements real springs — reason 2 in the ladder |

**The rule: anything the user can flip while it moves — hover, accordion, drawer, toggle — is a transition or WAAPI, never keyframes.** Keyframes are for sequences that run to completion: entrances, exits, ambient loops. A hover effect built on `@keyframes` is a bug you can feel — mouse out mid-animation and watch it snap.

## SSR and hydration — where JS motion pays twice

The pure-CSS rungs — 1, 2 and 4 — ship in the stylesheet: they exist before any JavaScript runs and cost the bundle nothing. JS mechanisms (rungs 5–6) wait for hydration, and in a server-rendered app that opens two traps:

- **The entrance flash.** A JS-driven entrance animation means the element server-renders in its final state, then jumps to its hidden state at hydration, then animates in. The user sees the content, loses it, and gets it back.
- **The invisible-content failure.** The usual fix — hide the initial state in CSS so JS can reveal it — inverts the failure: if hydration is slow or JS never arrives, server-rendered content stays invisible forever. Content the server rendered must be visible without JavaScript — the SSR twin of `scroll-cinema.md`'s rule that content exists without the animation.

Rung 3 sits between the two groups: `document.startViewTransition()` is JS, but it fires on a navigation the user initiates after load, so neither trap applies. A rung-6 library also typically needs client-only loading in SSR frameworks (dynamic imports, client directives), which is integration surface the CSS rungs simply do not have.

**The rule: entrance and above-the-fold motion is CSS. JS-driven motion is confined to states that only exist after hydration anyway — gestures, drags, post-interaction sequences.** Four of the ladder's five rung-6 reasons are interaction-shaped for exactly this reason: the motion a library legitimately owns is mostly motion that could not have happened before the JS arrived. Path morphing is the exception — and the rung-6 case to watch for the entrance flash.

## Why the ladder rather than a pinned default

This space moves fast enough to break a pin. GSAP's licence changed materially inside fifteen months; anime.js shipped a breaking rewrite in roughly the same window, with further breaking changes inside its 4.x minors.

A skill whose body says *"use anime.js"* ages into a skill that pastes v3 syntax at a v4 API. A skill whose body says *"climb the ladder, and here is the rung-6 table re-verified on this date"* stays correct as the table is re-verified. **The ladder is the durable part; the table is the perishable part**, which is why they live in different files.

## Handing off to `loop-scout`

If the question is *"which animation library should this project adopt"* — a genuine build-vs-buy with adoption criteria, a named winner and a runner-up — that is **`loop-scout`**, not this skill. `loop-frontend` only walks its own ladder and answers *"does this specific motion need a library at all, and which rung is it?"* Its most common correct answer is **no library**.
