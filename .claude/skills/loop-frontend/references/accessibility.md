# Motion accessibility — the gates

Motion is an accessibility hazard. A skill whose charter is *more* motion has no business shipping below the criteria written for exactly its output, so these are enforced at authoring time rather than offered as suggestions.

The W3C's own statement of the harm is the justification, and it is worth quoting rather than paraphrasing: vestibular disorder triggers can cause "nausea, migraine headaches, and potentially needing bed rest to recover."

## SC 2.3.1 Three Flashes or Below Threshold — Level A. A refusal.

**This skill declines to author flashing content.** Not a warning, not a toggle — a refusal with an explanation and an offer of the non-flashing equivalent.

The criterion: nothing flashes **more than three times in any one-second period**, unless it is below both the general and red flash thresholds.

| Threshold | Definition |
|---|---|
| **Area** | Combined flashing area ≤ **0.006 steradians** — roughly 25% of any 10° visual field on screen |
| **General flash** | Paired opposing changes in relative luminance of **≥ 10%** of maximum, where the darker image's relative luminance is **below 0.80** |
| **Red flash** | Any pair of opposing transitions involving saturated red — R/(R+G+B) ≥ 0.8 with a chromaticity difference > 0.2 |

**`prefers-reduced-motion` does not satisfy this.** A user having a photosensitive seizure was not asked their preference first. Level A carries no conformance-level opt-out.

Effects that reach it more often than people expect: rapid strobe reveals, fast-cycling colour loops, high-contrast flicker on a hover, and "glitch" aesthetics.

## `prefers-reduced-motion` — substitute, don't delete

Every non-essential animation ships a reduced-motion branch. **The branch substitutes wherever a gentler equivalent exists**, because the spec asks for an interface that "emphasizes safer animations **or** the absence of animation" — removal is the fallback, not the default.

```css
/* Default: the expensive version */
.panel { transition: transform 280ms cubic-bezier(0.2, 0, 0, 1), opacity 200ms linear; }
.panel[data-open] { transform: translateY(0); opacity: 1; }

/* Reduced: still communicates the state change, without the movement */
@media (prefers-reduced-motion: reduce) {
  .panel { transition: opacity 120ms linear; transform: none; }
}
```

**Off by default under reduced motion**, not merely gentler — these are the vestibular triggers: parallax, mouse-move response, scroll-triggered element movement, large-scale zoom, and anything auto-playing that moves across the viewport.

**Honest status:** the feature is defined in **CSS Media Queries L5, a Working Draft dated 19 Feb 2026** — universally shipped (Baseline widely available since January 2020) but **not ratified**. What *is* ratified is the WCAG criterion it satisfies. Technique C39/SCR40 is illustrative guidance (grade **No**), not the criterion itself.

Never gate on reduced motion alone for something essential — if the motion *conveys* information, the reduced branch must convey it another way.

## SC 2.2.2 Pause, Stop, Hide — Level A

Any **auto-starting** moving, blinking or scrolling content that runs **more than five seconds** in parallel with other content ships a pause/stop/hide control.

**And the branch people miss:** *auto-updating* content ships a control **regardless of duration**. There is no five-second exception on that branch.

This bites the luxury vocabulary hardest, which is why it is enforced in the template rather than left to review: hero video loops, marquee and ticker type, auto-advancing carousels, live counters, animated background gradients.

## SC 2.3.3 Animation from Interactions — Level AAA

Interaction-triggered motion is disable-able. AAA is not generally mandated, and this skill holds itself to it anyway: a charter of "make it feel expensive" produces exactly the output this criterion was written about. In practice this is the same reduced-motion branch, applied to scroll- and pointer-driven effects.

## View transitions have mandatory accessibility work

`document.startViewTransition()` is the best native motion primitive available and it ships two hazards, both from the spec's own text: **the transition pseudo-element tree is not exposed to the accessibility tree**, the spec has **no accessibility-considerations section**, and **focus does not move on its own**. MDN names the consequences as loss of reading position, focus confusion, and strange live-region announcement behaviour.

So every `startViewTransition()` this skill authors ships:

1. An explicit **`focus()`** on the new content's heading or landmark.
2. An **`aria-live`** region wherever the content change is masked by the animation.

```js
const t = document.startViewTransition(() => renderRoute(next))
await t.updateCallbackDone
document.querySelector('main h1')?.focus()   // reading position follows the transition
```

Not an aside — a required pairing. A transition that looks seamless and strands a screen-reader user mid-document is worse than a hard cut.

## Checklist before shipping any motion

- [ ] Nothing flashes more than three times per second, or it is below both thresholds
- [ ] Every non-essential animation has a reduced-motion branch that **substitutes** where it can
- [ ] Parallax, pointer-driven and scroll-driven movement are **off** under reduced motion
- [ ] Auto-starting motion > 5s, and **all** auto-updating content, have pause/stop/hide
- [ ] Every view transition moves focus and announces the change
- [ ] Motion that conveys information conveys it another way when reduced
- [ ] Only `transform` and `opacity` animate; layout changes go through FLIP or View Transitions
