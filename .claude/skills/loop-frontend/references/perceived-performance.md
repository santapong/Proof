# Perceived performance — making the wait feel shorter

**Perceived duration and actual duration are different numbers, and only one of them is the user's experience.** This file is about the gap. Actual load performance — rendering strategy, bundle size, LCP and INP budgets, caching — belongs to `../../loop-design/references/frontend.md`; cross-reference it, do not re-derive it.

The split, stated in both files because it is the fuzziest boundary this skill has: *"the page takes 4 seconds to appear"* is `loop-design`. *"the drawer stutters when it opens"* is `loop-frontend`.

## Skeletons beat spinners

A spinner communicates one thing: *something is happening*. A skeleton communicates *what* is happening, *how much* of it there is, and *where it will land* — so the eye pre-positions and the arrival feels like completion rather than replacement.

Rules that make a skeleton work rather than merely exist:

- **Match the final layout.** Same box dimensions, same positions. A skeleton whose shapes move on load is worse than no skeleton — you have manufactured a layout shift.
- **Match the count where you know it.** Three rows for three rows. Ten placeholder rows for two real ones reads as a bug.
- **Keep the shimmer subtle and slow**, or drop it. A fast high-contrast shimmer is visual noise, and at the wrong contrast it is a flash-threshold question — see `accessibility.md`.
- **Do not skeleton very fast content.** Under ~200 ms it flashes and makes things feel *slower*. Delay showing it by ~150–200 ms; if the data arrives first, it never appears.

## Optimistic UI — where the failure path is cheap

Render the success state immediately, reconcile when the server answers. A "like" should register instantly; the request is bookkeeping.

**Only where the failure path is cheap and reversible.** The test is what a rollback costs the user:

| Cheap — go optimistic | Expensive — wait for the server |
|---|---|
| Like, favourite, follow | Payment, checkout |
| Reorder a list, toggle a setting | Deletion of anything not trivially undone |
| Add a comment, rename an item | Anything with legal, financial or third-party effect |

When it does fail, **revert visibly and say what happened**. A silent revert is worse than a spinner — the user believes their action landed and it did not.

## Progressive disclosure of the wait

Long operations should report structure, not just elapsed time: *Uploading → Processing → Finalising*. Three named stages feel shorter than one bar, because each transition is progress the user can see.

Where you have real progress, show it. Where you do not, **do not fake it** — a bar that hits 90% and sits there is worse than an indeterminate one.

## The rules this shares with the rest of the skill

- **Never animate a layout property to fake progress.** A width transition on a progress bar is animating layout every frame. Use `transform: scaleX()` on a full-width element and give it `transform-origin: left`.
- **Everything here still ships a reduced-motion branch** — shimmer especially, which is a moving gradient.
- **Budgets from `choreography.md` still apply.** A skeleton that fades in over 400 ms has spent the budget it was supposed to disguise.

## Instrument, then decide

The lever is often not where it feels like it is. Before tuning motion to mask a wait, check whether the wait is real:

- **DevTools Performance panel** — is the stutter layout, paint, or script?
- **Long Animation Frames** attributes a slow frame to the script that caused it. Very useful and the least mature thing this skill cites — a **W3C Editor's Draft**, below even Working Draft status. Treat it as a debugging aid, never as a stable contract.
- **The compositor rule from `choreography.md` is the first thing to check.** A large share of "we need a fancier loading state" turns out to be a `box-shadow` or `filter` animating every frame.

## Smell test

- Spinner where a skeleton would fit → tell the user *what* is coming.
- Skeleton that shifts on load → you built a layout shift.
- Skeleton on sub-200 ms content → it flashes; delay it.
- Optimistic UI on a payment → revert cost is not cheap.
- Progress bar parked at 90% → indeterminate would be more honest.
- Progress bar animating `width` → animate `transform: scaleX()`.
