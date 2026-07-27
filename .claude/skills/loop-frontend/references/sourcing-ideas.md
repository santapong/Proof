# Sourcing ideas — finding references without copying them

"Make it feel like *that* site" is the most common way this work starts, and copying the surface is the most common way it fails. You reproduce the look, miss the mechanism, and ship a worse version of something that already existed.

The method here converts a reference from **an appearance you admire** into **a mechanism you can specify**. That is the whole discipline: a mood board is not a spec, and a screenshot cannot tell you what to build.

## Where to look, and what each source is biased toward

Every source has a bias. Knowing it is what stops you inheriting it.

| Source | Good for | Biased toward |
|---|---|---|
| **Awards galleries** (Awwwards, FWA, Godly) | Seeing the current ceiling of the genre | **Novelty over usability.** These are judged partly on surprise. Many winners are hostile to actually use, and almost none are audited for reduced motion |
| **A library's own showcase** (anime.js, GSAP, Motion) | Seeing what a specific mechanism can do | The library. Every example is a reason to use it, including where the platform would do |
| **Design-system docs** (Material, Apple HIG, Fluent) | Duration and easing guidance grounded in research; interaction conventions | Their own product's constraints and brand |
| **The product you actually admire** | Restraint, and what survives daily use | Survivorship — you are seeing the version that shipped, not the ideas cut to get there |
| **Spec and browser demos** (MDN, Chrome DevRel) | The native mechanism, correctly used | Feature promotion; often no fallback shown |

**The strongest reference is a product you have used more than once.** Awards sites show you what impresses on first encounter. Something you have used fifty times shows you what survives — and per `typography-and-restraint.md`, the fiftieth encounter is the one that matters.

## Deconstruct into mechanisms, not appearance

For each reference, answer these five. If you cannot, you do not yet have a spec — you have a screenshot.

1. **What actually moves?** Name the properties. "The card lifts" → `transform: translateY(-4px)` plus a shadow change. Be this literal.
2. **What triggers it?** Hover, scroll entry, scroll *position*, route change, a timer, a data arrival. This decides your rung (`motion-toolkit.md`) and, for scroll work, trigger vs scrub (`scroll-cinema.md`).
3. **How long, and on what curve?** Estimate in milliseconds. If you can, open DevTools on the real site and read the computed `transition` or `animation` — that turns a guess into a number.
4. **What does it cost?** Which rung does it need, and is a library actually required? Most admired effects are rungs 1–4. If your answer is "a library", name which of the five reasons applies.
5. **What is it *for*?** Does the motion carry meaning — continuity, causality, hierarchy, state — or is it decoration? This is the question that decides whether to copy it at all.

Write the answers down. Five lines per reference is a specification; a folder of screenshots is not.

## The evaluation questions

Before adopting anything, three filters. They kill most of what looks good in a gallery:

**Does it serve the content or replace it?** An effect that delays information the user came for is a tax they pay every visit. A hero animation that must finish before the headline is readable has inverted the priority.

**Does it survive the fiftieth encounter?** First-visit delight is what galleries reward and what daily users come to resent. Anything the user triggers repeatedly — a nav, a modal, a card hover — should be fast and unobtrusive. Save the expensive moment for something encountered once.

**Would it pass this skill's own gates?** Most gallery work would not. Check the reference for a reduced-motion branch (open DevTools, emulate it — most sites have none), for flashing, and for whether it traps focus or hijacks scroll. **A reference that fails these is not a reference; it is a warning.** Take the mechanism, leave the negligence.

## Delegating the search

`loop-frontend` supplies the *method*; it is not a search engine.

- **Finding and comparing references** → hand off to `loop-research`, which does multi-source gathering with adversarial fact-checking. Give it the mechanism you are looking for, not a vibe: *"scroll-scrubbed product rotation with pinning, native vs library implementations, 2026"* returns something useful; *"cool landing pages"* does not.
- **Choosing a dependency** → `loop-scout`. "Which animation library should this project adopt" is a build-vs-buy with a named winner, and that is its job, not this one's. `loop-frontend` only decides which *rung* a specific motion sits on.

Come back here with the references; the deconstruction and the evaluation happen in this skill.

## From references to a spec

The deliverable of this phase is not a mood board. It is:

- A **motion inventory** — every animated element, its trigger, its budget in ms, its curve, and its rung.
- A **house curve set** — two or three easing curves total, reused. `choreography.md` explains why more than about three reads as several developers rather than one design.
- A **scroll budget**, if this is a cinematic page — total viewport heights, and pixels per pinned scene, before any code (`scroll-cinema.md`).
- A **reduced-motion plan** per effect, decided now rather than retrofitted. Retrofitting is how it gets skipped.

## Smell test

- References collected as screenshots with no mechanism written down → not a spec.
- Every reference from one awards gallery → you have inherited that gallery's bias toward novelty.
- "Like *that* site" with no named property, trigger or duration → nobody can build it, and nobody can tell you it is done.
- A reference adopted without checking its reduced-motion behaviour → you are about to copy an accessibility defect along with the effect.
- The spec calls for a library and cannot name which of the five reasons applies → it is rungs 1–4 work.
