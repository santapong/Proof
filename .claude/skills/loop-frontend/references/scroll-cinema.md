# Scroll cinema — designing a scroll-driven narrative

The genre: a landing page where **scrolling is a transport control**, not just navigation. Scenes assemble, elements pin while content advances, a product rotates as you descend. Done well it reads as expensive; done badly it is the single most hostile pattern on the web.

This is the highest-risk material in the skill. Read `accessibility.md` alongside it — a cinematic scroll page is the exact shape that triggers vestibular disorders, and the reduced-motion branch here is not a courtesy, it is the difference between a site someone can use and one that makes them ill.

## The distinction everything else rests on: trigger vs scrub

Almost every mistake in this genre comes from confusing these two.

| | **Trigger** | **Scrub** |
|---|---|---|
| Scroll's role | A **switch** — element enters view, animation plays on its own clock | A **scrubber** — scroll position *is* the animation's playhead |
| Reversible | No. It plays forward and finishes | Yes. Scroll up and it runs backward, exactly |
| Duration owned by | The animation (`400ms`) | The **scroll distance** you allocate (`600px`) |
| Cost | Cheap. Native, rung 4 | Expensive. Recomputes every frame of scroll |
| Use for | Reveals, staggered entrances, "fade up as it appears" | A story beat where the user controls the pace |

**Reveals are triggers.** The most common over-engineering in this genre is scrubbing something that should have been a trigger — paying per-frame cost for an effect the user perceives as "it faded in".

Scrub only when the user genuinely controls the pacing and reversal is meaningful: a product rotating, a diagram assembling step by step, a number counting to a figure that matters.

## Scene decomposition

A cinematic page is **N scenes**, not one long animation. Compose each as three parts and the whole thing stays debuggable:

| Part | What it does | Typical scroll cost |
|---|---|---|
| **Entry** | The scene arrives — usually a trigger | 0 (plays on its own clock) |
| **Hold** | The scene is pinned while its content advances — the scrubbed part | **This is your budget** |
| **Exit** | The scene leaves, next one arrives | 0–small |

Write the **scroll budget per scene in pixels or viewport heights before building anything.** A pinned scene consumes scroll distance during which the page appears not to move — that is the currency you are spending, and users have a low tolerance for it.

Rules of thumb:

- **A pinned hold over ~2–3 viewport heights feels broken** on a laptop. The user starts to think scroll is stuck.
- **Total page scroll should stay under ~8–10 viewport heights.** Past that, people bail before the payoff.
- **Every pinned scene needs an escape.** If someone doesn't want the show, they must be able to get past it — never remove the scrollbar, never capture the wheel.

## What never to do: scroll-jacking

**Do not hijack the scroll event to move the viewport somewhere the user did not ask for.** Not smooth-snap between full-screen panels that fights the wheel, not `preventDefault()` on wheel to run your own inertia, not "one scroll gesture = one full section" regardless of how far they scrolled.

It breaks the one interaction every user already knows how to do, and it breaks with it: keyboard scrolling, `Home`/`End`, find-in-page, screen-reader navigation, trackpad momentum, and the browser's own scroll restoration.

Pinning is **not** scroll-jacking. Pinning holds an element in place while scroll continues at its normal rate — the page still responds to the wheel exactly as expected. Snapping and wheel-capture replace the user's input with yours. `scroll-snap-type: y proximity` is the honest version if you want alignment; `mandatory` is already pushing it.

## Native first — the ladder still applies

Per `motion-toolkit.md`, climb only for a named reason.

**Rung 4 handles more than people expect.** Scroll-driven animations cover triggers and simple scrubs natively, on the compositor, with no library and no scroll listener:

```css
@supports (animation-timeline: view()) {
  .reveal {                          /* trigger-style reveal, native */
    animation: fade-up linear both;
    animation-timeline: view();
    animation-range: entry 20% cover 40%;
  }
  .progress {                        /* scrub against document scroll */
    animation: grow linear both;
    animation-timeline: scroll(root block);
  }
}
```

**Reach rung 6 when you need pinning or a multi-element scrubbed timeline.** Pinning an element while a scene advances, sequencing several elements against one scroll range, or scrubbing with mid-flight seeking is where the native primitives run out. That is the fourth of the five reasons in `motion-toolkit.md`, and it is the most legitimate one in practice.

At that rung: **anime.js** ships a Scroll Observer with synchronisation modes and thresholds — confirmed in its v4 docs — and is the framework-agnostic default. **GSAP's ScrollTrigger** is the most capable for pinned multi-scene work, at the cost of a proprietary-though-free licence; check `standards.md` before committing to it.

## Performance — where these pages actually die

A scroll scene runs its work on **every frame of scroll**, which is the harshest budget in frontend. The compositor rule from `choreography.md` is not advisory here:

- **`transform` and `opacity` only.** A scrubbed `filter: blur()` or `box-shadow` will drop frames on a mid-range laptop, guaranteed.
- **`will-change` churn is the specific trap of this genre.** A page with twelve scenes that all declare `will-change: transform` promotes twelve layers simultaneously and exhausts GPU memory. Apply it per-scene on entry, remove it on exit.
- **Never read layout in a scroll handler.** `getBoundingClientRect()` per frame forces synchronous layout — the classic scroll-jank cause. Measure once, cache, recompute on resize.
- **Long pages need `content-visibility: auto`** on off-screen scenes, or you pay layout for the whole document on every reflow.
- **Test on a throttled mid-tier device, not your laptop.** This genre looks fine on the machine that built it and unusable on a three-year-old phone.

## Mobile and touch

Different enough to plan separately, not adapt afterwards:

- **Momentum scrolling** means scroll position arrives in bursts, not smoothly. Scrubbed animation looks stuttery unless you interpolate.
- **The address bar resizes the viewport** mid-scroll on iOS and Android. Anything keyed to `100vh` jumps. Use `100dvh`, or key to a measured value.
- **Pinning fights the browser's own scroll behaviour** on touch far more than on desktop.
- **The honest default is to reduce.** Many cinematic pages should ship a simpler linear document on small screens rather than a degraded version of the desktop show.

## Accessibility — the non-negotiable half

This genre concentrates every motion hazard in the skill. `accessibility.md` has the full rules; these are the ones scroll cinema specifically breaks:

- **Under `prefers-reduced-motion: reduce`, the cinema collapses to a document.** Not "slower" — **off**. Unpin everything, show every scene's final state, let the page scroll normally. Someone with a vestibular disorder needs your content, not a gentler version of the thing making them sick.

  ```css
  @media (prefers-reduced-motion: reduce) {
    .scene { position: static; height: auto; }
    .scene > * { transform: none !important; opacity: 1 !important; }
  }
  ```

- **Content must exist without the animation.** If a scene reveals text only at scroll progress 0.6, that text is invisible to a reduced-motion user, to a search crawler, and to anyone whose JS failed. Render it; animate its *presentation*.
- **Never trap focus in a pinned scene.** Tabbing must move through the document in order, and a focused element scrolled into a pinned region must still be reachable and visible.
- **Auto-advancing scenes need pause/stop/hide** (SC 2.2.2) — if a scene progresses on a timer rather than on scroll, it is auto-updating content.
- **Parallax is the single worst offender.** Different layers at different rates is the textbook vestibular trigger. If you ship it, it is off by default under reduced motion, no exceptions.

## Smell test

- Scrubbing something the user perceives as "it faded in" → that was a trigger.
- A pinned hold longer than ~2–3 viewport heights → users think scroll is broken.
- The wheel event is `preventDefault()`ed → scroll-jacking; remove it.
- `getBoundingClientRect()` inside a scroll handler → synchronous layout every frame.
- Twelve scenes all declaring `will-change` → GPU memory exhausted.
- Reduced-motion branch only *slows* the scenes → it must collapse them.
- Content that does not exist until a scroll progress threshold → not content, decoration.
- Page total over ~10 viewport heights → most users never reach the payoff.
