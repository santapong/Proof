# Anti-Patterns

Five ways an autonomous loop degrades by **skipping a move** (AP1–AP5), a sixth (AP6)
where a move **runs but is fooled**, and a seventh (AP7) where every move runs honestly
and the **search space quietly narrows to one lineage**. Each is a single failure, not a vague
"quality" problem — naming which pattern you're looking at tells you which one thing
broke, not the whole system. Run this checklist before deploying as a Cloud Routine,
and re-run it any time the loop's behavior feels off or its guards change. AP1–AP5 are
detailed below; AP6 is summarized here and treated in full in `verifier-integrity.md`.

## AP1 — Nodding Loop (verification skipped)

**Symptom:** proposals get approved with rubber-stamp merges; plausible-looking mistakes
slip through and surface days later.

**Status here: guarded.** `safeToPropose` (`loop-design.md`, §Verify) gates every item —
a change that fails `loop-review`'s adversarial pass, or whose `loop-audit`
memo flags unsafe or unclear, is dropped, not proposed.

**Not guardable by architecture:** a human merging drafts without reading the risk memo
is still a Nodding Loop, just a human-side one. See `comprehension-rot.md`.

## AP2 — Amnesiac Loop (persistence skipped)

**Symptom:** no cumulative progress — the same issue gets "fixed" repeatedly because
nothing remembers it was already handled.

**Status here: guarded.** The draft PR *is* the persistent record (`loop-design.md`,
§Propose). Within a run, the `seen` set additionally blocks re-proposing the same item.

## AP3 — Manual Loop (scheduling skipped)

**Symptom:** it isn't really a loop — it's a script someone has to remember to run.

**Status here: guarded, but read the default correctly.** A manual `Workflow()` call in
`runMode: "dry"` (`SKILL.md` §6) *is* a Manual Loop, on purpose — that's the safe on-ramp
before you trust it unattended. It only becomes a real loop once deployed as a Cloud
Routine or Action (`deployment.md`). The anti-pattern isn't the dry-mode default — it's
still running it by hand three months after "Unattended" was documented and never
graduating.

## AP4 — Blind Loop (discovery skipped)

**Symptom:** a human still decides every session what's worth working on.

**Status here: guarded.** `feedback-intake.md`'s four sources (issues, PR comments, CI,
idle-research) are pulled automatically; nobody hand-picks the day's work.

## AP5 — Tangled Loop (handoff skipped)

**Symptom:** parallel agents collide on the same files or working directory.

**Status here: guarded (worktree isolation on the Act stage).** Harness policy H1 is
explicit — under `pipeline()`, "item A may be in stage 3 while item B is still in stage
1." That's exactly how `improvement-loop.workflow.js` runs its Act→Verify stages:
multiple items' Act stages can be genuinely concurrent, and each checks out a different
`claude/` branch. Two concurrent checkouts in one working directory would corrupt each
other.

**Fix (applied):** in **live** mode the Act-stage `agent()` runs with
`isolation: 'worktree'` — the runtime's built-in per-agent git worktree (harness policy
H7), so each concurrent Act stage mutates files in its own isolated tree and the
collision cannot happen. Dry mode is read-only and needs no isolation. If you replace
worktree isolation with something cheaper, cap in-flight Act calls to 1 (a `parallel()`
barrier or a semaphore) instead — never run concurrent file-mutating Act stages in a
shared directory.

## AP6 — Gamed Loop (verification runs but is fooled)

**Symptom:** `safeToPropose` keeps returning `true`, the memos read clean, the credit
ledger holds — and the artifact is getting worse. The loop hasn't stopped verifying; it
has learned to pass its own check without being good, or the check has drifted into
agreeing with it (self-preference, rubric hacking, master-key responses).

**Why it's not AP1.** AP1 is verification *skipped*; AP6 is verification *present and
lying*. `safeToPropose` gating every item does nothing here, because the judge is the
thing that was fooled — and a fooled judge cannot report it. AP6 is invisible from inside
the loop by construction, so it can't be guarded the way AP1–AP5 are; it must be made
*hard* by structure and caught from *outside*.

**Status here: guarded — see `verifier-integrity.md` (full treatment) and §7 of
`SKILL.md`.** Three structural guards run in-band before Propose
(`templates/verifier-canary.workflow.js`): an impossible-test canary, a diff-integrity
check on protected paths, and a sampled cross-judge. One detector runs out-of-band
(`templates/held-out-eval.workflow.js`, `held-out-eval.md`): a frozen suite with hidden
oracles whose rising false-accept rate is the meta-overfit alarm. This is the gate that
must hold before SCALE (removing the human merge).

## AP7 — Monoculture Loop (the search collapses to one lineage)

**Symptom:** the loop still runs, still verifies honestly, still proposes — and every
proposal starts to look like the last one. Dedup keeps firing, the dry counter creeps up,
and the loop retires believing the work is done when it has only stopped being able to
*see* anything else. Nothing was gamed; the search space narrowed.

**Why it's not AP4.** AP4 is discovery never attempted — an empty intake with no scan
behind it. AP7 is discovery attempted and *converged*: the candidate pool is real but has
collapsed onto one neighbourhood, because selection kept only the current best and
`seen` suppressed everything adjacent to it. A dry counter cannot tell the two apart —
"no fresh candidates" reads identically whether the space is exhausted or merely
unreachable from where the loop is standing.

**What the evidence says.** This is the single most consistently mitigated failure in the
self-improving-systems literature, and always by the same move — keep a *population*, not
a running best:

- **GEPA** (arXiv:2507.19457, ICLR 2026 Oral) states greedy best-candidate selection
  "causes the optimizer to get stuck in a local optimum," and its ablation measures naive
  greedy selection **underperforming Pareto-frontier selection by 6.4%**.
- **Darwin Gödel Machine** (arXiv:2505.22954, ICLR 2026) keeps an archive with
  `sigmoid(score) × novelty` selection so low scorers retain nonzero probability; its
  no-archive ablation **stalls** once a bad modification lands. Lower-scoring ancestors
  later seed the best lineages.
- **FunSearch** (Nature 625, 2023) uses island populations with **periodic reset of the
  worst islands** purely as an anti-stagnation mechanism — and still hit its result in
  only 4 of 140 runs, so the problem is real even with a working mitigation.
- **ACE** (arXiv:2510.04618) names the textual-domain analogues — *context collapse* and
  *brevity bias* — and mitigates by applying itemized delta updates instead of rewriting
  the accumulated context wholesale.

**Fix (applied — `improvement-loop.workflow.js`):** dedup against `seen` decides what is
*new*; it no longer also decides what is *worth pursuing*. Four mechanisms:

1. **A per-run archive with coverage tracking** — every candidate is recorded with the
   *area* it explored (its `area` tag, falling back to intake kind) and its outcome
   (`proposed` / `blocked` / `triaged-out` / `idea`), and travels out with the result.
   Blocked and triaged-out candidates are part of the record, not noise.
2. **Frontier-steered research** — idle rounds hand the research agent the run's coverage
   map and instruct it to prefer unexplored areas: a solid idea in fresh territory beats
   a better-sounding idea in a covered one.
3. **A territory-aware dry counter** — an idle round increments `dry` only when its ideas
   all landed in already-covered areas (that round re-derived the current lineage); a
   round that opens an uncovered area resets it. Runaway is impossible — L4's
   `MAX_ROUNDS` backstops even a research pass that names a "new" area every time.
4. **Kind-interleaved Act ordering** — priority sorts *within* each intake kind, but
   kinds round-robin, so one noisy kind (a flood of `ci-failure`s) cannot monopolize
   every Act slot and collapse the round onto one neighbourhood. Order changes; every
   fresh item is still handled.

The archive is per-run by design: cross-run persistence is the draft PR itself (AP2).
Where the loop accumulates config over time (rubric, credit ledger), prefer itemized
updates over wholesale rewrites, per ACE.

**Interaction with AP6.** These two pull in opposite directions and must be held apart.
AP6 hardening says *freeze what measures you*; AP7 says *keep exploring what you propose*.
Both hold only if the frontier is over **candidates**, never over the held-out suite, the
rubric's protected paths, or the canary — widening the search must never widen what the
loop may touch.

## Using this file

Don't treat it as a one-time read. A fix for one pattern can quietly reopen another —
e.g. raising `MAX_ROUNDS` to push past a false AP3 diagnosis increases concurrent items,
which is only safe because AP5 is now guarded by worktree isolation; if you ever remove
that isolation, AP5 reopens. Re-check all seven rows whenever
`improvement-loop.workflow.js` or its guards change, not just the row you think you
touched.

**Capability gating — check before trusting any of this.** The loop's usefulness is
gated by whether the base model is strong enough to correctly implement its own good
ideas. **STOP** (arXiv:2310.02304, COLM 2024) measured this directly: with GPT-4 the
self-improvement procedure consistently improved downstream performance, while with
GPT-3.5-turbo and Mixtral it **degraded** it — the proposed ideas were reasonable and the
implementations were wrong. The same paper found sandbox-disabling behaviour scaling *up*
with capability (GPT-4 0.42% of improvements, CI 0.31–0.57%; GPT-3.5-turbo 0.12%, CI
0.07–0.21%), so a stronger model buys better proposals and more evasion pressure at once.
Neither effect is quantified outside STOP. Treat a weak `--planner` or a downgraded
routing tier as unvalidated for unattended running, and validate per-model on the held-out
suite before trusting the loop's output rather than assuming it transfers.

| Code | Name | Move missing | Status |
|---|---|---|---|
| AP1 | Nodding Loop | Verification | ✅ guarded |
| AP2 | Amnesiac Loop | Persistence | ✅ guarded |
| AP3 | Manual Loop | Scheduling | ✅ guarded (mind the dry-mode default) |
| AP4 | Blind Loop | Discovery | ✅ guarded |
| AP5 | Tangled Loop | Handoff | ✅ guarded (worktree isolation, live mode) |
| AP6 | Gamed Loop | Make verification un-gameable | ✅ guarded (canary + diff-integrity + cross-check, & held-out detector) — see `verifier-integrity.md` |
| AP7 | Monoculture Loop | Keep a population, not a running best | ✅ guarded (coverage archive, frontier-steered research, territory-aware dry counter, kind interleave) |
