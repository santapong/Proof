---
name: loop-autopilot
description: "Run an autonomous engineering loop over this repository: read feedback (GitHub issues, PR comments, CI failures), act on it as draft pull requests with tests, and when there is no feedback, research improvements and propose them. Use when the user wants to automate repository maintenance, set up a self-improving engineering loop, continuously triage issues and PRs, or have Claude propose code improvements on a schedule. The subject is the codebase and the output is a draft PR; it composes the plugin's other skills, proposes only, and never merges. For running and self-healing a live production service rather than improving a repo, use loop-operate. For a single one-off orchestrated job rather than a standing loop, use loop-orchestrate."
argument-hint: <repo> [--mode <lite|balanced|all-out>]
---

# Automating Improvements

You are about to run a project's **autonomous engineering loop**: read what needs doing, do it on a branch, and propose it — on repeat, unattended if configured. The loop is **propose-only**. It opens draft pull requests with a test and a risk memo and comments the result; **it never merges, and never pushes to `main`.** A human always approves.

This is a **composition layer over the `loop-engine` skill, not a new engine** (same pattern as `loop-orchestrate`). Every stage below is an existing skill invoked inside a budget-guarded loop.

**Execution flags.** `--mode <lite|balanced|all-out>` is advertised in this skill's `argument-hint` but **parsed by `loop-engine`, never here** — pass the raw argument string straight through when you invoke it for `templates/improvement-loop.workflow.js` (or any companion template) and carry no mode logic of your own. See `../loop-engine/references/execution-modes.md`.

**Because an unattended runner (a Cloud Routine) has no per-run approval prompt, the guardrails are structural, not interactive: draft-PR-on-a-`claude/`-branch, an explicit never-merge rule, budget/round caps, and dedup against what already exists.** Those are non-negotiable — see §6.

## 1. The loop

Each round: **intake → triage → act → verify → propose**; when intake is empty, **research/scan** for improvements instead. Full design in **`references/loop-design.md`**.

- Guarded like every loop in this plugin: a **budget floor** (loop-policy L2), a **dry counter** (L1: stop after K idle rounds), and a **hard round cap** (L4) — `while (budget.total && budget.remaining() > FLOOR && round < MAX_ROUNDS && dry < K)`.
- **Converges** by deduping every candidate against everything already *seen* **and** against already-open issues/PRs (L3), so it never re-proposes the same thing.

## 2. Intake — read the feedback

Gather actionable items from the four sources, using the GitHub tools listed in **`references/feedback-intake.md`**:

- **Issues** (polled): `search_issues` / `list_issues` for new or updated open issues.
- **PR comments + CI**: `pull_request_read` with `get_comments` / `get_review_comments`, and `subscribe_pr_activity` for CI/comment events.
- **Idle → research**: when nothing is pending, scan market trends and research papers with `loop-research`.
- **Tech-debt scan**: proactively surface candidates with `loop-review`, `loop-audit`, and `loop-scout`.

Dedup intake against open issues/PRs before acting — an item already tracked is not fresh work.

## 3. Act — do the work (compose skills)

Route each item to the skill that owns that job, then run it as an AIDLC Construction pass (design → implement → test):

- A bug / failing test / red CI → **`loop-debug`** (reproduce → root-cause → fix + regression test).
- A feature or change → **`loop-design`** (minimal design + ADR) → implement.
- Before building anything non-trivial → **`loop-scout`** (don't reinvent a solved problem).
- Every change ships a test via **`loop-test`** (fails before, passes after) and doc updates via **`loop-docs`**.

Work on a `claude/`-prefixed branch only.

## 4. Verify — prove it before proposing

- Adversarially self-review the diff with **`loop-review`** (fix confirmed findings; feed anything larger back as a new item).
- Produce the impact/risk memo with **`loop-audit`** — this becomes the PR body.
- If verification says the change isn't safe or clear, **don't propose it** — drop it or open an issue describing the blocker instead.

## 5. Propose — the human gate

- Open a **draft** PR from the `claude/` branch with the `loop-audit` risk memo as the body, then post a **comment** summarizing what changed and why (this is also how the human is notified — GitHub emails subscribers automatically; see `references/deployment.md`).
- **Label the PR** `automated` and `kind:<kind>` (the item's intake kind), or embed a `<!-- credit-kind: <kind> -->` marker in the body. The credit ledger keys off these to learn which kinds get merged (`references/credit-horizon.md`); the comprehension digest filters on `automated`.
- Stop there. **Never** call merge, never push to `main`, never mark ready-for-review without a human. This is harness policy H11 (one workflow per human gate).

## 6. Run it — supervised or unattended

- **A single supervised pass**: run **`templates/improvement-loop.workflow.js`** (defaults to `runMode: "dry"` — produces proposal objects, opens nothing). Flip to live only when you want it to actually open draft PRs.
- **Before deploying unattended, run every row of `references/anti-patterns.md` against the current design** — it's the pre-flight checklist for the seven ways an autonomous loop degrades, and it carries the **capability-gating check**: a weak `--planner` or downgraded routing tier is unvalidated for unattended running (STOP, COLM 2024, measured self-improvement *degrading* with weaker base models).
- **Unattended**: deploy as a **Cloud Routine** using **`templates/routine-prompt.md`**, on a schedule plus a `pull_request` trigger. Full setup, safety scopes, and the issue-polling caveat (Routines don't trigger on issues) are in **`references/deployment.md`**, which builds on the `loop-harness` skill's `automation-loops.md`.
- **Two companion Routines** run separately (both in `references/deployment.md`): the **credit-ledger reconcile** (`templates/credit-ledger.workflow.js`, daily) so the loop learns which proposal kinds get merged, and the **comprehension digest** (`templates/comprehension-digest.routine.md`, weekly) so a human actually reads what shipped.

### Non-negotiable safety rules

1. **Never merge and never push to `main`.** Propose via draft PR only.
2. **Push only to `claude/`-prefixed branches** (leave "unrestricted branch pushes" off in Routines).
3. **Cap the loop**: budget floor + dry counter + `MAX_ROUNDS`. No unbounded runs.
4. **Dedup** against open issues/PRs so it never spams duplicate proposals.
5. **Keep the network Trusted** and connectors minimal — the runner has no approval prompt.
6. **The held-out suite is never visible to the Act stage.** It and its oracles are a protected path (§7); the moment the loop can read them, they measure nothing.

## 7. Keep the loop honest over time (SUSTAIN)

§1–6 build a loop that proposes safely and never *skips* a move — the five guards in `references/anti-patterns.md` (AP1–AP5). This section addresses the failure those guards can't see: the loop runs its verification and is **fooled**. Over many rounds a generator can learn to produce diffs that pass `safeToPropose` without being good, or the accumulated config (rubric + credit ledger) can drift into agreeing with them. That is **AP6 — the Gamed Loop** (`references/verifier-integrity.md`), and it is invisible from inside the loop by construction: the judge cannot report that it was gamed. Two mechanisms catch and constrain it.

- **In-band hard gate — `templates/verifier-canary.workflow.js`.** Run it as a pre-flight on the candidates the loop marked `safeToPropose`, *before* the Propose gate. Three structural guards (`references/verifier-integrity.md`): an **impossible-test canary** (a must-fail test; if it passes, the runner was tampered with), a **diff-integrity** check (refuse any diff touching tests, rubric, held-out suite, canary, or CI gates), and a **sampled cross-judge** check for self-preference. Guards 1–2 are hard stops — a violation is dropped and escalated, never proposed and never argued down to a lower score.

- **Out-of-band detector — `templates/held-out-eval.workflow.js`.** The one measurement taken entirely outside the loop, against ground truth the loop never sees. Deploy it as a **third companion Routine** (alongside credit-ledger and comprehension-digest) on a weekly / every-N-proposals schedule. It runs a **frozen suite** of tasks with **hidden deterministic oracles** through the loop's *current* verify config, and tracks the **false-accept rate** (loop said safe, oracle says wrong) against a persisted baseline. A false-accept rate **rising across runs** is the self-improvement-reversal signal — the loop pleasing its own judge while diverging from truth (`references/held-out-eval.md`). Meta-overfit here is not weight drift (the model is fixed); it is the accumulated **config** overfitting its own recent history.

**Why this gates SCALE.** Removing the human merge step promotes `safeToPropose` into the merge decision itself. Every reason a human still merges today is a reason to trust that verdict less than the promotion requires. AP6's guards plus a standing held-out measurement of how often the verdict is wrong are the evidence that promotion would need — and even with them, the safe path to autonomous delivery is **merge-behind-canary + agent-driven rollback** (the SCALE mechanism — drafted in `references/deployment.md` §"Advanced: autonomous delivery" and `templates/canary-merge.workflow.js`, **off by default**; the base skill still stops at propose-only), with held-out eval as the tripwire that yanks autonomy back to propose-only the moment divergence rises. A perfect pre-merge gate is not the goal, because no gate catches everything.

**This skill is the autonomy ladder's single definitional home in 1.0.0, and the definitions live in `references/deployment.md` §"The autonomy ladder":** that section defines OBSERVE, VERIFY, SUSTAIN and SCALE rung by rung, states who does what at each, and states the degradation guarantee. `loop-operate` reuses the same four rungs for a different object — a live service instead of a repository — and cites that section rather than redefining them, so the two skills cannot drift apart while extraction into a shared reference file stays deferred to v1.1. Neither skill treats the repo README as a content dependency: the README's ladder table is a summary of that section, not its source.

## Reference files

- `references/loop-design.md` — the intake→act→verify→propose loop, guards, and convergence
- `references/feedback-intake.md` — the four sources and the exact GitHub tools; dedup
- `references/deployment.md` — running it unattended (Cloud Routine / Action), safety scopes, notification, and the two companion Routines
- `references/anti-patterns.md` — the seven ways an autonomous loop degrades (AP1–AP7), mapped to this loop's guards; the pre-deploy checklist and the capability-gating caveat
- `references/verifier-integrity.md` — AP6 (verification runs but is fooled) and its three structural guards; the SUSTAIN hardening that gates SCALE
- `references/held-out-eval.md` — the external detector for AP6 / meta-overfit: a frozen suite with hidden oracles, and the rising-false-accept alarm
- `references/comprehension-rot.md` — the one cost with no structural guard, and the forced random-sample digest that makes it visible — plus the six distribution-drift trends only the digest reader can see (D1–D6) and what each adjusts
- `references/credit-horizon.md` — closing the outcome-feedback gap: the trust ledger design and the three-knob mapping
- `references/standards.md` — the authoritative standards this skill applies — named, version-pinned, and mapped to its workflow
- `templates/improvement-loop.workflow.js` — the budget-guarded loop skeleton (dry by default)
- `templates/routine-prompt.md` — copy-paste prompt for a Cloud Routine / `.claude/loop.md`
- `templates/credit-ledger.workflow.js` — the ledger reconcile pass (deploy as its own daily Routine)
- `templates/comprehension-digest.routine.md` — the weekly comprehension-check digest prompt
- `templates/verifier-canary.workflow.js` — the in-band AP6 gate: impossible-test canary + diff-integrity (hard) and sampled cross-judge (advisory), run before Propose
- `templates/held-out-eval.workflow.js` — the out-of-band detector: frozen suite vs hidden oracles, false-accept trend + meta-overfit alarm (deploy as its own Routine)
- `templates/canary-merge.workflow.js` — **SCALE (off by default):** the autonomous-delivery gate — eligibility-check a `safeToPropose` candidate, merge behind a canary, bake, promote or auto-rollback, trip to propose-only on alarm (`references/deployment.md` §Advanced)
