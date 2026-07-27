# Authoritative standards — the motion and typography shelf

Pins current as of **2026-07**. Confirmation log at the foot.

**Read this first: the ratified ground here is very thin.** Exactly **two** entries on this shelf are W3C Recommendations, and both are accessibility criteria. Every *mechanism* this skill actually types — easing curves, view transitions, scroll-driven animation, `will-change`, reduced motion itself — is a Working Draft or a Candidate Recommendation Draft. Ship them anyway; browser support is what makes them usable, and it is excellent. But **never describe them as ratified**, and never let a reader infer that "it's in the spec" means "it's a standard".

**The three grades**, identical on every shelf in this plugin:

- **Yes** — a standards body ratified and published it. Cite as a requirement.
- **Draft** — real spec-track output that nothing has ratified. Name the status every time.
- **No** — real, widely followed, still somebody's opinion. Evidence or vocabulary, never a requirement.

## Yes — the two ratified anchors

| Standard | Body | Edition | Governs |
|---|---|---|---|
| **WCAG 2.2** | W3C | **W3C Recommendation, 12 December 2024** (first published as REC 5 October 2023) | The three motion criteria this skill enforces: **2.3.1 Three Flashes or Below Threshold (A)** — the refusal; **2.2.2 Pause, Stop, Hide (A)**; **2.3.3 Animation from Interactions (AAA)** |
| **WAI-ARIA 1.2** | W3C | **W3C Recommendation, 6 June 2023** | `aria-live` regions where a view transition masks a content change, and the roles a motion-heavy component still owes assistive tech |

**2.3.1 is the one with no escape hatch.** Level A, seizure risk, and `prefers-reduced-motion` does not satisfy it — a user having a photosensitive seizure was not consulted about their motion preference.

## Draft — every mechanism, without exception

| Spec | Status (confirmed 2026-07-27) | Governs |
|---|---|---|
| **CSS Media Queries L5** | Working Draft, **19 Feb 2026** | `prefers-reduced-motion`. Baseline widely available since Jan 2020 — universally shipped, still a draft |
| **CSS Easing Functions L1** | Candidate Recommendation Draft, **13 Feb 2023** | `cubic-bezier()`, `steps()`, `linear()` |
| **CSS Easing Functions L2** | First Public Working Draft, **29 Aug 2024** | Extended easing. **No `spring()` in either level** — that absence is the whole reason rung 6 exists |
| **Web Animations L1** | Working Draft, **5 Jun 2023** | `Element.animate()`, the engine under most JS libraries |
| **CSS View Transitions L1** | Candidate Recommendation Draft, **28 Mar 2024** | `document.startViewTransition()`. The most support-mature native motion primitive |
| **CSS View Transitions L2** | Working Draft, **13 Nov 2024** | Cross-document transitions |
| **CSS Scroll-driven Animations L1** | Working Draft, **6 Jun 2023** | `animation-timeline: view()` / `scroll()` |
| **CSS Will Change L1** | Candidate Recommendation Draft, **5 May 2022** | `will-change`. Whether it has advanced since is **unconfirmed as of 2026-07-27** |
| **CSS Fonts L4** | Working Draft, **22 Apr 2026** | `font-optical-sizing`, `font-variation-settings` |
| **Long Animation Frames** | W3C **Editor's Draft**, 16 Apr 2026 | LoAF attribution — the lowest-maturity item here; an Editor's Draft is not even a WD |
| **WCAG 3.0** | Working Draft, **3 Mar 2026** | Nothing yet. Do **not** cite it as a requirement — it is years from REC and its conformance model is unsettled |

## No — the tools, the research, and the taste

| Source | Pin | Licence | Why it is a No |
|---|---|---|---|
| **anime.js** | **v4.5.0**, published **2026-06-22** | **MIT** | An OSS project's own library. Full default import **40.3 KB gzipped**; ESM-native and tree-shakeable |
| **GSAP** | **3.15.0** | **Webflow "Standard No Charge" licence** — free for commercial use, **proprietary, not OSI-approved**. Bars use in no-code visual animation tools competing with Webflow, and bars reverse-engineering for competitive products | A vendor product. **The pre-April-2025 "GSAP costs money" claim is stale**; so is calling it open source |
| **Motion** (formerly Framer Motion) | **12.42.2** | **MIT** | An OSS library |
| **FLIP** | Paul Lewis, aerotwist.com, **11 Feb 2015** | — | A technique, not a spec |
| **Nielsen response thresholds** | 0.1 s / 1.0 s / 10 s — NN/g, from Nielsen *Usability Engineering* (1993), grounded in Miller (1968) and Card et al. (1991) | — | Research-backed guidance, not a standard. Cite as evidence |
| **Doherty threshold** | ~400 ms — Doherty & Thadani, *IBM Systems Journal*, 1982 | — | Real empirical work, but the **primary paper is unconfirmed as of 2026-07-27**; the figure was read from a secondary restatement |
| **Material Design 3 motion tokens** | Duration tiers and easing curves | — | Google's design-system opinion. **The exact millisecond table is unconfirmed** — the token page renders client-side and could not be read directly. Do not quote specific values as authoritative |
| **Core Web Vitals thresholds** | INP, LCP, CLS | — | Google's measurement programme. Owned by `../../loop-design/references/frontend.md` — cross-reference it, do not re-derive it |

## Discipline

- **Licences in this space move.** GSAP's changed materially within about fifteen months, and anime.js shipped a breaking from-scratch v4 rewrite in roughly the same window with further breaking changes inside the 4.x minors. **Re-read the licence and the major version from the registry before recommending anything** — do not restate from this file if the date below is stale.
- **Never call a draft ratified.** "Baseline widely available" is a support claim; "W3C Recommendation" is a status claim. They are not the same and only two rows here have the second.
- **If you cannot confirm an edition, write "unconfirmed as of \<date\>"** rather than asserting one.

**Confirmation log — 2026-07-27.** Verified against the primary source: **anime.js v4.5.0 / MIT / 2026-06-22**, read live from `registry.npmjs.org`; **CSS Easing L1** (CRD, 13 Feb 2023), **CSS Easing L2** (FPWD, 29 Aug 2024), **Media Queries L5** (WD, 19 Feb 2026), **Web Animations L1** (WD, 5 Jun 2023), **View Transitions L1** (CRD, 28 Mar 2024) and **L2** (WD, 13 Nov 2024), **Scroll-driven Animations L1** (WD, 6 Jun 2023) — each status line read from its own `w3.org/TR/` document; **GSAP's licence text**, read live from the Webflow/GreenSock terms. **Not independently re-confirmed in this pass, and named rather than re-asserted with new precision:** the **WCAG 2.2 REC date** and **WAI-ARIA 1.2 REC date**, both long-established but taken from search results rather than an independent fetch of the REC documents; **CSS Will Change L1**, whose status may have advanced since May 2022; the **Doherty & Thadani 1982** paper, cited at one remove; **Material Design 3's** millisecond tokens, which the live page would not render; and **Core Web Vitals** thresholds, which belong to `loop-design`'s shelf and should be read there rather than duplicated here.
