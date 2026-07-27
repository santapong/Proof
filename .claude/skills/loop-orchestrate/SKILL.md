---
name: loop-orchestrate
description: "Plan multi-agent project work: decompose a project into a typed task DAG, choose pipeline or parallel shapes per phase, route the right Claude model and effort tier to each task, and produce a cost ledger. Use when the user asks to plan or orchestrate a project, break a large job into subtasks across agents, decide which model to use for which task, or drive a multi-phase build, audit, or migration at scale. Produces the plan; loop-engine executes it. For a single task that needs one workflow script rather than a multi-phase plan, use loop-engine directly. For a standing scheduled loop over a repository, use loop-autopilot."
argument-hint: <project> [--mode <lite|balanced|all-out>] [--planner <opus|fable>] [--budget <tokens>] [--dry-run]
---

# Orchestrating Projects

You are the project manager for a multi-agent job. This skill is a **planning layer on top of the sibling `loop-engine` skill (`../loop-engine`)** — it does not introduce a new execution engine. The Workflow tool, the harness and loop policies, the JS templates, and the AIDLC framework are all **unchanged**; you reuse them exactly as `../loop-engine/SKILL.md` prescribes. Your job is to decide *what work exists, in what order, and who runs it* — then hand each phase to the workflow engine to execute.

The PM adds four things on top of a raw workflow run:

1. A typed **task DAG** — the project decomposed into dependency-ordered nodes.
2. A per-node **orchestration-shape** decision, made under the unchanged harness/loop rules.
3. A per-node **model + effort tier** assignment — the right model for the right job.
4. A **cast + cost ledger** and a completeness critic layered onto the normal workflow reporting.

## Execution flow

Follow these steps in order.

### 1. Parse the project

From the skill args, extract:

- **project** — everything that is not a flag: the goal to orchestrate. If empty, ask the user what project to run.
- **`--mode <lite|balanced|all-out>`** — the run-level routing dial. Default: `balanced`, resolved **silently** when the flag is absent. `lite` pins every node *downward* — Haiku mechanical, Sonnet reasoned at `medium`, width 1 — for a small, well-specified project; note that gating and planner nodes stay on `claude-opus-5` even here, because their wrong answer is inherited by everything downstream. `all-out` pins every node to `claude-opus-5`, disables override modifier A, widens verifiers to 3 (5 on gating nodes), raises the loop-until-dry threshold to 3, and fires the pre-flight in step 8. Full contract in `../loop-engine/references/execution-modes.md`.
- **`--planner <opus|fable>`** — routes only the single decompose/planning node. Default: `opus`. Orthogonal to `--mode` and legal in both. `fable` is an opt-in with a stated price — print the §M7 disclosure verbatim before the planner spawns, and record the choice in the cast ledger and the gate deliverable.
- **`--budget <tokens>`** — a total token ceiling for the whole project (e.g. `--budget 2000000`). Splits across phases in the ledger (step 9). Omit for no ceiling.
- **`--dry-run`** — if present, produce the plan (DAG + ledger + first-phase script) and show it to the user, but do NOT execute.

Flags are case-insensitive and the `=` form (`--mode=all-out`) is accepted. **Never guess an unrecognized value** — for a `--mode` or `--planner` value outside those listed, name the valid values and ask which to use. This skill and `../loop-engine` are the only two flag parsers in the plugin; every other skill passes its raw argument string through to `loop-engine`.

**`--budget` × `--mode all-out`.** When both are set and the step-8 pre-flight's estimate **high** end exceeds the ceiling, **refuse to spawn** and offer exactly three exits: re-run at `--mode balanced`, raise the budget to a stated figure, or narrow the phase's scope. This is deliberately stricter than harness policy H6, which treats the budget as a runtime ceiling that throws mid-run once `budget.spent()` reaches `budget.total` — burning 80% of a ceiling and then dying is exactly the failure a pre-flight exists to prevent.

### 2. Load the governing documents (unchanged)

Read, and treat as read-only law:

1. `../loop-engine/references/harness-policy.md` — orchestration-shape rules (H1–H12).
2. `../loop-engine/references/loop-policy.md` — iteration rules (L1–L8).
3. `../loop-engine/references/execution-modes.md` — the execution-mode contract: the per-node-kind routing table (§M3), both override modifiers (§M4), verifier width and the loop-until-dry threshold (§M5), the full-mode pre-flight (§M6), and the canonical `ROUTES` block (§M8). This file is the **source of truth for routing**; `references/model-routing.md` below is its rationale.
4. `../loop-engine/frameworks/AIDLC.md` — the default lifecycle framework (Inception → Construction → Operation, with human gates).

Then read this skill's own planning references:

5. `references/task-decomposition.md` — how to build the typed task DAG.
6. `references/model-routing.md` — the routing rationale: the fleet, the two override modifiers under each mode, and the two-column worked example.

If the user named a different framework, load `../loop-engine/frameworks/<name>.md` instead of AIDLC — the PM layer is framework-agnostic.

### 3. Decide how much coverage the planning itself needs

A single planner produces a plan that is **coherent and incomplete**, and both failure modes are invisible from the inside: it frames the problem once and everything outside that frame is *absent* rather than rejected, and a forgotten phase leaves no trace — a plan with no test nodes reads exactly like a plan that deliberately skipped them.

| Project | Planning approach |
|---|---|
| Small, well-specified, one obvious shape | Plan it yourself, then run the **roster sweep** by hand — it is the cheapest thing here and catches the forgot-a-whole-phase class |
| Multi-phase, unclear scope, or a cost of missing something | **`templates/project-coverage-plan.workflow.js`** — three independent framings, reconcile, roster sweep, gap rounds until dry, charters |

Per `references/coverage-planning.md`. The method attacks coverage from three directions because each catches what the others structurally cannot: **diverse planners** catch a wrong frame, the **roster sweep** catches a forgotten phase, **loop-until-dry** catches the long tail.

Two rules carry over into whatever you do here:

- **An item found by exactly one framing is the highest-value signal.** Adjudicate it; never drop it silently. Dropping single-planner items discards precisely the coverage the diversity bought.
- **The roster sweep's exclusions matter more than its inclusions.** An unjustified exclusion is a forgotten phase wearing a checkmark. "Probably not needed" is not a justification.

### 4. Decompose the project into a typed task DAG

Per `references/task-decomposition.md`, break the project into **nodes**. Each node is a plain object:

```
{
  id,          // stable kebab-case identifier, unique in the DAG
  description, // one line: what this task produces
  taskType,    // scout | analyze | implement | verify | judge | synthesize | critic | doc
  dependsOn,   // [] of node ids that must complete first — this is the DAG edge set
  fanOut,      // 1 for a single agent, or the item-count / "unknown" for a sweep
  model,       // resolved in step 5 from the mode's routing column (leave null here)
  effort,      // resolved in step 5 from the mode's routing column (leave null here)
  isolation,   // 'none' by default; 'worktree' only for concurrent file mutation (H7)
  schema,      // JSON schema for machine-consumed output (H3), or null for terminal prose
  phase        // the framework phase this node belongs to (must match meta.phases)
}
```

Rules:

- **Edges are dependencies, not schedule.** `dependsOn` records what must finish first; the workflow engine (via `pipeline()`) extracts the parallelism. Don't serialize nodes that don't actually depend on each other.
- **A fan-out is one node, not N.** A "verify each finding" sweep is a single node with `fanOut` = the finding count (or `"unknown"` for discovery); it becomes one `parallel()`/loop inside a stage.
- **Group nodes by `phase`.** Every node carries the framework phase it belongs to; the phase set becomes `meta.phases` (H9).

### 5. Choose the orchestration shape per node (unchanged rules)

For each node, pick the shape using the **unchanged** harness/loop policy — do not invent new rules:

- **Default to `pipeline()`** (H1). A chain of dependent nodes with a known work-list is one pipeline, no barriers.
- **Earn every barrier** (H2). Use a `parallel()` barrier before a node only when it needs cross-item context from all of its dependencies (dedup/merge, zero-count early-exit, "compare against the other findings"). "Cleaner code" or "I need to flatten first" is not a barrier.
- **Loop only for unknown size** (L1/L6). A node whose `fanOut` is `"unknown"` (find *all* of something) is loop-until-dry; a `--budget`-scaled depth sweep is loop-until-budget with the `budget.total &&` guard (L2). A known work-list is a pipeline, never a loop.
- **Verification scales to the ask** (H4) **and to the mode**: under `balanced`, single-vote for "any bugs" and 3 perspective-diverse for "thorough audit"; under `all-out`, always diverse-lens — 3 on a standard verify node and 5 on a gating one, with majority-refute at ⌈N/2⌉ (`../loop-engine/references/execution-modes.md` §M5). Judge panel for wide solution spaces in both.

### 6. Assign a model + effort tier per node

This is the PM's signature move: **the right model for the right job** — and since v1.0.0 the routing table has **two columns**, one per `--mode`. Read the column the run's mode selected, from `../loop-engine/references/execution-modes.md` §M3, with the rationale and the worked example in `references/model-routing.md`.

- **Do not assert a fleet ceiling — check the session model.** Read the model the session is running on, compare it against the tier the table assigns this node, **omit `opts.model` on a match**, and **pin when a silent mismatch would be costly**. "The fleet caps at model X" is a fact with an expiry date; a check is not.
- **Under `--mode balanced` (the default):** omit `model` and inherit for judgment work (H8) — still the correct choice for the majority of nodes. Pin only where the table pins: **down** to `claude-haiku-4-5` for mechanical/scout/doc fan-outs (`effort` **omitted** — Haiku 4.5 has no effort dial), **down** to `claude-sonnet-5` for `implement`, and **up** to `claude-opus-5` on the two node kinds that pin even in balanced — the **gating** verify (`max`) and the **planner** (`xhigh`) — because a silent downgrade there is inherited by everything downstream.
- **Under `--mode all-out`:** pin `claude-opus-5` on **every** node and lift each to its full-mode effort floor. Modifier A (wide fan-out pushes down) is **disabled** — do not apply it, and `log()` `modifier-A: suppressed` where a fan-out is dispatched. Modifier B still applies, but only on its second and third rungs (effort, then verifier width), because the model is already at the ceiling.
- **`--planner fable`** overrides the planner node's model only. Never a fan-out, never inside a loop; print the §M7 disclosure verbatim before it spawns and record the fallback if it refuses.
- Record a one-line **rationale** per node for the ledger (step 9) — why this tier, not a cheaper one — and **the rationale must name the mode**, because the same assignment means opposite things in the two columns. `claude-opus-5` on a scout node is an expensive mistake under `balanced` and the contract under `all-out`; a rationale that does not say which is unreadable after the fact.

### 7. Compose with AIDLC — default cast + human gates

Map the DAG onto the framework's phases and give each phase a **default cast** — the set of `taskType`s that phase expects (per `AIDLC.md`): Inception is scouts + a synthesizer; Construction is implement → verify chains plus an adversarial review sweep; Operation is a verification loop + doc/critic nodes. A node whose `taskType` doesn't fit its phase's cast is a decomposition smell — revisit step 3.

**Honor the human gates.** AIDLC ends each phase at a gate (H11). At each gate the PM stops, presents the phase deliverable, and **re-plans and re-budgets the next phase** against what actually happened — the DAG downstream of a gate is provisional until the gate is passed. Author one workflow per gated phase (step 7), not one monolith for the whole project.

### 8. Author the plan

Start from `templates/project-plan.workflow.js` and fill its `EDIT ME` slots for the **current phase's** sub-DAG. The template is an ordinary `../loop-engine` script — it obeys every rule in `../loop-engine/SKILL.md` step 5 (pure-literal `meta` first, plain JS, no `Date.now()`/`Math.random()`, `args`-parameterized, `.filter(Boolean)` on fan-outs, `schema` on every consumed `agent()`, `log()` progress). The PM additions the template carries:

- The canonical `ROUTES` block from `../loop-engine/references/execution-modes.md` §M8, carried **verbatim**, with every `agent()` call routed through `optsFor(node, label)`. Each node keeps its `taskType`, `phase` and `rationale` (plus `isolation`, where it mutates files concurrently); it does **not** carry a hardcoded `model`/`effort` — `routeFor(node.taskType)` resolves those against `input.mode`. Scripts have no module access (H10), so the block is duplicated by design and drift between copies is a defect.
- A `log()` line per node emitting its ledger row (mode, model, effort, est tokens, running spend vs budget), plus the `modifier-A: suppressed` line under all-out mode.
- The pure-literal `ESTIMATE` block, stamped with the figures the user approved at the step-8 pre-flight (zeros under `balanced`, where no pre-flight fires).
- `meta.phases` mirroring the framework phase names for the nodes in this workflow.

If `--dry-run`, print this script plus the DAG and ledger, and stop. Under `--mode all-out --dry-run` the pre-flight's estimate table still prints; its question does not.

### 9. Pre-flight (all-out mode only), then execute — hand to the workflow engine

**If `--mode all-out`, run the pre-flight first** — in this PM session, after the phase's script is authored and **before** the Workflow tool is called, so that no agent has spawned when the user answers. A script cannot prompt a human or read a clock (H10), which is why the gate lives here and the approved figures enter the script as pure literals. Follow `../loop-engine/references/execution-modes.md` §M6:

1. Print the four-part estimate table — DAG size with fan-outs and verifier widths shown as their multiplicands (`verify-sweep: 5 items × 3 lenses = 15`), the low–high token band **alongside the same DAG priced at `balanced`**, what all-out mode changed, and the rate-limit/concurrency risks.
2. Ask **exactly one** question: `All-out mode: N agents across P phases, est. X–Y output tokens (optimize would be A–B). Modifier A disabled · verifier width 3 (5 on gating nodes) · loop-until-dry K=3 · every node pinned to claude-opus-5. Proceed?` — accepting **yes** (proceed, stamping the approved figures into the script's `ESTIMATE` block), **no** (nothing spawns, nothing is written, report what *would* have run — never a partial start), or **optimize** (re-author the same DAG at `balanced`, print the cheaper estimate, proceed with no second confirmation).
3. **Spawn nothing before the answer.** Silence is not consent and a timeout is not a yes.
4. If `--budget` is set and the estimate's **high** end exceeds the ceiling, refuse to start and offer the three exits from step 1.
5. If the phase would exceed the ≤15-agents-per-workflow guideline, **the guideline wins**: split it into two gated workflows and surface the split in the estimate.

The pre-flight is an **additional** gate, never a substitute for a framework gate (H11) — AIDLC's own gates still stand, and this one sits in front of the first of them. It re-fires only when a post-gate re-plan raises the approved agent count or token high-end by more than 25%, and each re-ask shows the delta rather than restating the total cold.

Then call the **Workflow tool** with the current phase's script inline and the DAG parameters as `args` — real JSON values, never a JSON-encoded string, including `mode` and `planner`. Note the returned `scriptPath` and `runId`; to iterate a phase, edit the persisted file and re-invoke with `{scriptPath, resumeFromRunId}`. **Mode is frozen at first author**: a resume reuses the persisted script and its original `args.mode`, and a mode change requires a fresh run plus, in all-out mode, a fresh pre-flight. Between gated phases, author the next phase as a fresh Workflow invocation after the user approves — the PM session stays in the loop.

### 10. Report — journal + cast/cost ledger + completeness critic

Reuse the normal workflow reporting and add the PM layer on top:

- **Reuse `meta.phases` + `log()` + the run journal.** Relay the structured result in prose; if a result looks wrong, read `<transcriptDir>/journal.jsonl` before diagnosing (it records each agent's actual return value).
- **Emit the cast + cost ledger.** One row per executed node: `id`, `taskType`, **`mode`**, `model` (`inherit` when `opts.model` was omitted, otherwise the pinned ID), `effort`, estimated tokens, **rationale**, and **running spend vs `--budget`**. This is the PM's accountability artifact — it shows where the token budget went and why each node ran at its tier. `mode` is not optional: the same `model` value means opposite things in the two columns, and the row is the only evidence of which one happened. **Under `--mode all-out`, every wide fan-out row additionally carries the `modifier-A: suppressed` marker**, so a reader can tell a fan-out ran at ceiling by design rather than by oversight. Flag any node whose actual spend materially exceeded its estimate, and in all-out mode diff the run against the script's approved `ESTIMATE` literal using `<transcriptDir>/journal.jsonl` — a run outside its band is the signal to re-baseline the `BAND`/`SIZE` constants in `../loop-engine/references/execution-modes.md` §M6, not to widen the band silently.
- **Name the planner.** If `--planner fable` was used, say so in the cast row and in the gate deliverable — including any fallback to `claude-opus-5` at `max`. A reader must never have to guess which model produced the DAG they are being asked to approve.
- **Run a completeness critic** (H12). End the project (or each comprehensive phase) with a critic node asking "what's missing — a node not run, a dependency unverified, a phase skipped?" Its findings become the next round of work or are reported as known gaps.
- **Present the gate deliverable.** If a framework gate was reached, show the phase's deliverable and the re-plan/re-budget for the next phase, and ask the user to approve before authoring it.

## What this layer does NOT change

- It does **not** modify or fork `../loop-engine` — the harness policy, loop policy, JS templates, and AIDLC framework are consumed read-only.
- It does **not** add orchestration primitives. Every node still becomes a `pipeline()`, `parallel()`, or loop from the unchanged templates.
- It does **not** override the human gates. AIDLC's gates are the PM's phase boundaries.
- The DAG, model routing, and ledger are **planning and reporting artifacts** layered around an otherwise-standard workflow run.

## Files in this skill

- `references/coverage-planning.md` — why one planner is not enough: three framings, the roster sweep, loop-until-dry, and the per-node charter.
- `references/task-decomposition.md` — building the typed task DAG (node schema, edge rules, fan-out vs loop, phase grouping).
- `references/model-routing.md` — the routing rationale: the fleet, the session-model check, both override modifiers under each mode, and the two-column worked example.
- `references/standards.md` — the authoritative standards this skill applies — named, version-pinned, and mapped to its workflow
- `templates/project-coverage-plan.workflow.js` — the coverage-first planning run: 3 framings → reconcile → roster sweep → gap rounds until dry → charters.
- `templates/project-plan.workflow.js` — a `../loop-engine` script template that realizes one phase's sub-DAG through the canonical `ROUTES` block, with per-node `taskType`/`isolation` and the ledger `log()` lines.

One file this skill depends on lives **in the sibling engine, not here**: `../loop-engine/references/execution-modes.md` is the execution-mode contract and the single source of truth for the routing table (§M3), the override modifiers (§M4), verifier width and the dry threshold (§M5), the full-mode pre-flight (§M6), the `--planner fable` opt-in (§M7), and the canonical `ROUTES` block (§M8). It is consumed read-only alongside the harness and loop policies (step 2) and is never forked into this skill — a second copy of a routing table is the drift this release exists to remove.
