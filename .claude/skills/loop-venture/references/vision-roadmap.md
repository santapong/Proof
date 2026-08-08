# P2 — Vision & Roadmap playbook

The deliverable is `venture/02-vision-roadmap.md`: a vision statement with an objective
tree, a now/next/later roadmap, the riskiest-assumption verdict, and explicit kill/pivot
criteria — the document GATE-2 uses to decide whether the venture proceeds at all. The
node runs the standard five-step loop (`lifecycle.md` §3); the input is GATE-1's approved
checkpoint, nothing else.

## 1. Vision as a falsifiable bet

A vision is one sentence naming who is served, what changes for them, and why now — plus
`nonGoals[]`, which carry as much information as the statement (loop-build's deferral
discipline, applied before any scope exists). The objective tree hangs 3–5 objectives off
the statement; each objective must trace to a ranked pain from P1. An objective tracing
to no pain is ambition, not vision — cut it or send discovery back for evidence.

## 2. The roadmap — now / next / later

- **now** — the smallest horizon that validates the riskiest assumption (see §3). Not
  the MVP feature list; that is P4's job. This horizon states *what must become true*.
- **next** — what the validated bet unlocks; **later** — direction, deliberately vague.
  Precision in "later" is fiction wearing a milestone (the catalogue's roadmap theater).
- Every `roadmap[]` entry carries its rationale: which objective it serves and which
  assumption it validates or depends on. P6's deltas keyed-merge in here at GATE-4.

## 3. The riskiest assumption and the kill/pivot criteria

Walk `assumptions[]` from P1 plus the new ones this phase mints. The riskiest is the one
that, if false, makes every other one irrelevant — usually demand ("they will pay") or
channel ("we can reach them at survivable cost"), rarely technical. The document must
state, before GATE-2:

- **The riskiest assumption**, its owner, and its cheapest honest validation (a test
  measured in days, not a build measured in months).
- **Kill criteria** — the observation that ends the venture. Written *now*, while nobody
  is invested; a kill criterion written after the band starts is negotiable, which is to
  say it is not one.
- **Pivot options** — which elements (persona, pain, channel, model) could be swapped
  while the vision survives; a pivot that changes all four is a kill wearing optimism.

GATE-2 then holds all three verdicts priced side by side. Kill is a success of the
method: a two-page memo now beats five confident documents on air.

## 4. Discuss cast

- **The founder** — argues the largest coherent ambition the evidence supports.
- **The skeptical investor** — attacks the bet's economics and timing: why does this
  fail, and why is now wrong?
- **The veteran operator** — argues sequencing and capacity: what does this horizon
  actually take to execute, and what breaks first?

## 5. Vision & roadmap failures — the catalogue

| Failure — drawback first | Signal | Intervention |
|---|---|---|
| **Vision by thesaurus.** A statement generic enough to head any venture in the sector — it constrains nothing, so every later decision re-litigates direction from scratch. | Swap-test fails: replace the product name with a competitor's and the statement still holds; `nonGoals[]` is empty or restates the statement negatively. | Rewrite until the statement excludes something desirable; the non-goals are where the vision proves it has edges. |
| **Roadmap theater.** Quarter-precise milestones eighteen months out, projecting certainty that discovery never produced — later phases inherit the fiction as constraints. | `later` entries carry dates or feature lists; `now` entries validate nothing (no assumption named in the rationale). | Strip precision to the horizon each entry has earned; re-anchor `now` on the riskiest assumption. |
| **The unfalsifiable bet.** Kill criteria written as tautologies ("if there is truly no demand") that no observation can trigger — GATE-2 becomes gate theater by construction. | The kill criterion names no measurable observation, threshold, or deadline; the pivot list is empty because "the vision is the pivot". | Rewrite the criterion as observation + threshold + date; if none can be written, the riskiest assumption is not yet identified — loop the node once. |
| **Objective orphans.** Objectives that trace to no evidenced pain, smuggled in because the founder persona argued well — vision drifting from discovery inside a single phase. | An `objectives[]` entry whose trace to `pains[]` is missing or cites an `evidence[]`-free pain. | Cut it or return it to P1 as a research question; the objective tree is downstream of evidence, never beside it. |
