---
name: loop-build
description: "Conduct a project brief all the way to a shipped version one: scope the smallest shippable v1, plan it with multiple independent planners reconciled into one task DAG, then drive every phase through whichever domain skills the tasks need — design, build, verify, ship — with human gates, repair rounds, and a full cast-and-cost ledger. Use when the user asks to build a project end to end, take an idea to v1, finish version one, or wants one command that composes the fleet for a whole project. Produces a working, gate-passed v1 plus its release checklist. For producing only the plan and routing without conducting the build, use loop-orchestrate. For authoring and running a single already-scoped workflow, use loop-engine. For a standing scheduled loop that maintains an existing repository, use loop-autopilot. For releasing an existing codebase rather than building one, use loop-ship."
argument-hint: <project-brief> [--mode <lite|balanced|all-out>] [--dry-run]
---

# loop-build

**The deliverable is a shipped version one — working tree, passing gates, release checklist, ledger — conducted end to end from a brief.** That is the discriminator: if the ask stops at a plan, it is `loop-orchestrate`; if it is one workflow for one scoped task, it is `loop-engine`; if it recurs on a schedule over an existing repo, it is `loop-autopilot`; if the code already exists and only the release remains, it is `loop-ship`.

This skill is a **conductor, not a new engine**: it composes the fleet through `loop-engine`, under the unchanged harness, loop and mode policies. What it adds is the project spine — v1 scoping, multi-planner coverage, phase-to-skill routing, gates with repair rounds, and one ledger across the whole conduct.

## Execution flow

### 1. Parse the brief

- **project-brief** — everything that is not a flag. If empty, ask what version one should be.
- **`--mode` / `--dry-run`** — advertised here; parsed by `loop-engine`. Pass the **raw argument string** through untouched — `--planner` and `--fable-gate` travel the same way (this skill parses nothing; `loop-engine` and `loop-orchestrate` are the only two parsers).
- `--dry-run` ends after step 3 with the plan, the roster, and the priced estimate.

### 2. Scope version one — the cut is the deliverable

Per `references/conduct.md` §1. A v1 in the SemVer sense (`references/standards.md`) is the first **public-contract** release: the smallest set of promises worth keeping. Draft the v1 line — every feature is *in* or *deferred*, each deferral with one reason — and show it at the first gate. A v1 that cannot be stated in ten lines is not scoped yet.

### 3. Plan with multiple planners — never trust one framing

Per `references/conduct.md` §2 and `../loop-orchestrate/references/coverage-planning.md` (consumed read-only): **three independent planner framings** (MVP-first, risk-first, user-first) run through `plannerAgent()`, then one reconcile planner merges them into a typed task DAG. An item found by exactly one framing is the highest-value signal — adjudicate it, never drop it silently. Then the **roster sweep**: walk `../../../docs/design/boundary-audit.json` and justify, per skill, why it is in or out of this project's roster — an unjustified exclusion is a forgotten phase wearing a checkmark.

### 4. Conduct the phases — one workflow per gate

Per `references/conduct.md` §3. Map the DAG onto the framework phases (AIDLC by default) and author **one `loop-engine` workflow per gated phase** from `templates/v1-conductor.workflow.js`, whose ROUTES block is carried verbatim. For each task, the prompt is authored **against the owning domain skill's references** — a frontend task obeys `loop-frontend`'s non-negotiables, a review task emits `loop-review`-shaped findings, a test task follows `loop-test`'s fail-for-the-right-reason rule. The boundary matrix decides ownership; a task with no owning skill is a decomposition smell.

### 5. Gate, repair, re-gate — a FAIL is work, not a verdict to report

Per `references/conduct.md` §4. Every phase ends at a gating verify at the mode's width, dispatched **sequentially** (§M5's dispatch rule). Then the loop this plugin learned the hard way: fix every demonstrable refutation, **bust the verify prompts with a fix-round marker** (cached prompts replay stale verdicts), and re-gate — bounded at two repair rounds before the human decides. Report `UNVERIFIED` (dead lenses) as distinct from `REFUTED`; neither is a pass.

### 6. Release

The final phase runs `loop-ship`'s method: rollout choice, release checklist, tested rollback, and the v1 tag. `loop-audit`'s risk memo is the go/no-go input at the last gate.

### 7. Report

One ledger across the whole conduct: per-node cast rows (mode, model, effort, width — `fableGateAgent` rows name their lens), per-phase actual-vs-estimate spend, verdict history including repair rounds, the deferral list from step 2 as the seeded v2 backlog, and the critic findings that stay open. Files land in the project: `RESULTS.md` and `FINDINGS.md`.

## Orchestration

The conductor itself works inline between workflows — planning, gating and re-planning are judgment, not fan-out. Each phase's execution is one `templates/v1-conductor.workflow.js` invocation through the Workflow tool; under `--mode all-out` the §M6 pre-flight prices each phase before anything spawns.

## Reference files

| File | What it holds |
|---|---|
| `references/conduct.md` | The method: v1 scoping, multi-planner reconcile + roster sweep, phase-to-skill routing, sequential gating, repair rounds, cache-busting, the ledger |
| `references/standards.md` | The pinned authorities — SemVer 2.0.0 for what "version one" promises, lifecycle and delivery-metrics shelves, with the confirmation log |
