# loop-venture — recorded experiment: P1 Discovery, lite mode

**Date**: 2026-08-08 · **Template**: `venture-node.workflow.js` (as shipped in 2.4.0) ·
**Mode**: `lite` · **Cost**: 13 agents, 714,739 output tokens, 115 tool calls, ~36 min wall clock.

A live run of the P1 Discovery node on a deliberately ordinary toy idea, kept as evidence
of how the node loop behaves — including the parts designed to fail honestly. Nothing
below was hand-edited; verdicts and quotes come from the run's journal.

## The input

> A CLI tool that summarizes a developer's recent git history into a ready-to-read
> standup update (what I did yesterday, what's in flight, blockers inferred from stuck
> branches).

Node config: the three research mandates from `discovery.md` §2 that lite affords
(complaint mining, adjacent-tool autopsy, the disconfirming sweep), the sufferer /
anthropologist / economist cast, the playbook law inlined.

## What the run did

| Step | What happened |
|---|---|
| Plan | Opus planner turned the brief into persona-as-context-plus-job questions and three disjoint mandate briefs |
| Research | One researcher (lite width; the cap logged, not silent) built a 25-entry verbatim quote ledger from HN, dev.to, TeamBlind, Substack — each entry with author, venue, and an unprompted/prompted marker, plus its own theme-independence cross-check and a coverage-shortfall disclosure ("no statement anywhere touching willingness-to-pay") |
| Discuss | The three perspectives genuinely diverged: the sufferer called it "a 5-minute morning annoyance, not a burning fire"; the anthropologist showed the two observationally strongest pains are *not* the one the brief targets; the economist noted 25 quotes and zero mentions of money |
| Synthesize (r1) | Draft document with personas, ranked pains, assumption ledger |
| Verify (r1) | **Both refuters independently caught a fabrication**: the draft claimed "zero of 25 corpus entries name git as a recall source" — ledger entry 7 says verbatim "I keep a daily log tracked in git… Here is what I did yesterday". The Opus judge (23 tool calls, re-read the corpus) upheld it: `ok=false` |
| Synthesize (r2) | Fix-only pass: the "zero" claim corrected to the nuance the record supports, the mis-attributed 15-min/day figure moved to the pain it actually prices, every unpriced number pushed into the assumption ledger |
| Verify (r2) | Still `ok=false` — 4 finer-grained disputes upheld (an evidence grade borrowed from a broader theme than the ranked claim; one ledger entry cited on both sides of two contradictory claims). **The bound held**: no third round; the disputes returned as `openDisputes[]` for the human gate |

Final state: **REFUTED, escalated** — which is the contract working, not failing:
`state-contract.md` Rule 2 says a second failed round goes to the human, never loops.

## What the output says about the idea

The discovery document's own GATE-1 question, compressed: the two best-evidenced pains
are (a) already solved for free by an end-of-day habit shift and (b) social/status
anxiety a git summarizer plausibly doesn't touch; the theme closest to the brief's
mechanism is graded THIN by the corpus's own check (2 authors, 1 venue); and zero of 25
entries state any willingness to pay (A1, open). The disconfirming mandate — the one
`discovery.md` says exists to lose gracefully — won on points. A GATE-1 human reading
this should be reaching for "redirect research" or steeling themselves for a GATE-2 kill.

## What this evidences about the skill

- **Cite-or-own is enforceable**: five open assumptions (A1–A5) each carry an owner and
  the reason no citation exists; the round-2 pass demoted unpriced numbers into them.
- **The refute panel earns its cost**: a confident, plausible, false "zero entries"
  claim survived synthesis and died in verify — twice-independently, then judge-confirmed
  against the primary corpus.
- **The bounded loop terminates honestly**: REFUTED-with-open-disputes is a first-class
  outcome; the failure catalogue's "assumption laundering" row was exercised live (the
  judge refused an evidence grade borrowed from a broader theme).
- **Lite is the floor**: one researcher means one venue-set; the corpus itself disclosed
  Reddit as its largest access gap. All-out's five disjoint mandates exist for exactly
  this reason.

Reproduce with the same args via `Workflow({scriptPath: '.claude/skills/loop-venture/templates/venture-node.workflow.js', args: {…}})`,
or in anger: `/loop-venture <idea> --mode lite`.
