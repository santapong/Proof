---
name: proof-orchestrate
description: "Plan multi-agent project work: decompose a project into a typed task DAG, choose pipeline or parallel shapes per phase, route the right Claude model and effort tier to each task, and produce a cost ledger. Use when the user asks to plan or orchestrate a project, break a large job into subtasks across agents, decide which model to use for which task, or drive a multi-phase build, audit, or migration at scale. Produces the plan; proof-engine executes it. For a single task that needs one workflow script rather than a multi-phase plan, use proof-engine directly. For a standing scheduled loop over a repository, use proof-autopilot. For deciding which skill a still-unnamed situation even needs, use proof-guide."
argument-hint: <project> [--mode <lite|balanced|all-out>] [--planner <opus|fable>] [--fable-gate] [--budget <tokens>] [--dry-run]
---

# Orchestrating Projects

You are the project manager for a multi-agent job. This skill is a **planning layer on top of the sibling `proof-engine` skill (`../proof-engine`)** — it does not introduce a new execution engine. The Workflow tool, the harness and loop policies, the JS templates, and the AIDLC framework are all **unchanged**; you reuse them exactly as `../proof-engine/SKILL.md` prescribes. Your job is to decide *what work exists, in what order, and who runs it*. A planning-only request stops at the DAG, estimate and authored handoff; it does not execute the project. When execution is also authorized, `proof-engine` owns that run.

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
- **`--mode <lite|balanced|all-out>`** — the run-level routing dial. Default: `balanced`, resolved **silently** when the flag is absent. `lite` pins every node *downward* — Haiku mechanical, Sonnet reasoned at `medium`, width 1 — for a small, well-specified project; note that gating and planner nodes stay on `claude-opus-5` even here, because their wrong answer is inherited by everything downstream. `all-out` pins every node to `claude-opus-5`, disables override modifier A, widens verifiers to 3 (5 on gating nodes), raises the loop-until-dry threshold to 3, and fires the pre-flight in step 9. Full contract in `../proof-engine/references/execution-modes.md`.
- **`--planner <opus|fable>`** — routes only the single decompose/planning node. Default: `opus`. Orthogonal to `--mode` and legal in both. `fable` is an opt-in with a stated price — print the §M7 disclosure verbatim before the planner spawns, and record the choice in the cast ledger and the gate deliverable.
- **`--fable-gate`** — routes one lens of the all-out gating vote to `claude-fable-5`, with a logged fallback to `claude-opus-5` on a refusal or ZDR 400. Legal only under `--mode all-out`; inert and logged elsewhere. Full contract: `../proof-engine/references/execution-modes.md` §M7b.
- **`--budget <tokens>`** — a total token ceiling for the whole project (e.g. `--budget 2000000`). Splits across phases in the ledger. Omit for no ceiling.
- **`--dry-run`** — if present, produce the plan (DAG + ledger + first-phase script) and show it to the user, but do NOT execute.

Flags are case-insensitive and the `=` form (`--mode=all-out`) is accepted. **Never guess an unrecognized value** — for a `--mode` or `--planner` value outside those listed, name the valid values and ask which to use. This skill and `../proof-engine` are the only two flag parsers in the plugin; every other skill passes its raw argument string through to `proof-engine`.

**`--budget` × `--mode all-out`.** When both are set and the engine pre-flight's estimate **high** end exceeds the ceiling, **refuse to spawn** and offer exactly three exits: re-run at `--mode balanced`, raise the budget to a stated figure, or narrow the phase's scope. This is deliberately stricter than harness policy H6, which treats the budget as a runtime ceiling that throws mid-run once `budget.spent()` reaches `budget.total` — burning 80% of a ceiling and then dying is exactly the failure a pre-flight exists to prevent.

### 2. Load the governing documents (unchanged)

Read, and treat as read-only law:

1. `../proof-engine/references/harness-policy.md` — orchestration-shape rules (H1–H12).
2. `../proof-engine/references/loop-policy.md` — iteration rules (L1–L8).
3. `../proof-engine/references/execution-modes.md` — the execution-mode contract: the per-node-kind routing table (§M3), both override modifiers (§M4), verifier width and the loop-until-dry threshold (§M5), the full-mode pre-flight (§M6), and the canonical `ROUTES` block (§M8). This file is the **source of truth for routing**; `references/model-routing.md` below is its rationale.
4. `../proof-engine/frameworks/AIDLC.md` — the default lifecycle framework (Inception → Construction → Operation, with human gates).

Then read this skill's own planning references:

5. `references/task-decomposition.md` — how to build the typed task DAG.
6. `references/model-routing.md` — the routing rationale: the fleet, the two override modifiers under each mode, and the two-column worked example.

If the user named a different framework, load `../proof-engine/frameworks/<name>.md` instead of AIDLC — the PM layer is framework-agnostic.

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
- **Verification scales to the ask** (H4) **and to the mode**: under `balanced`, single-vote for "any bugs" and 3 perspective-diverse for "thorough audit"; under `all-out`, always diverse-lens — 3 on a standard verify node and 5 on a gating one, with majority-refute at ⌈N/2⌉ (`../proof-engine/references/execution-modes.md` §M5). Judge panel for wide solution spaces in both.

### 6. Assign routes from the shared contract

Read `../proof-engine/references/execution-modes.md` §M3–§M5. Resolve each node's
route from its task type, selected mode and error cost; record the rationale.
`references/model-routing.md` explains the decision and supplies a worked case,
not a second routing table. Do not infer account availability from a model pin.
Use `proof-mcp`'s `route_node` for source-backed authoring advice when connected;
the canonical ROUTES block still governs execution.

### 7. Compose with AIDLC — default cast + human gates

Map the DAG onto the framework's phases and give each phase a **default cast** — the set of `taskType`s that phase expects (per `AIDLC.md`): Inception is scouts + a synthesizer; Construction is implement → verify chains plus an adversarial review sweep; Operation is a verification loop + doc/critic nodes. A node whose `taskType` doesn't fit its phase's cast is a decomposition smell — revisit step 3.

**Honor the human gates.** AIDLC ends each phase at a gate (H11). At each gate the PM stops, presents the phase deliverable, and **re-plans and re-budgets the next phase** against what actually happened — the DAG downstream of a gate is provisional until the gate is passed. Author one workflow per gated phase (step 7), not one monolith for the whole project.

### 8. Author the plan

Start from `templates/project-plan.workflow.js` and fill its `EDIT ME` slots for the **current phase's** sub-DAG. The template is an ordinary `../proof-engine` script — it obeys every rule in `../proof-engine/SKILL.md` step 5 (pure-literal `meta` first, plain JS, no `Date.now()`/`Math.random()`, `args`-parameterized, `.filter(Boolean)` on fan-outs, `schema` on every consumed `agent()`, `log()` progress). The PM additions the template carries:

- The canonical `ROUTES` block from `../proof-engine/references/execution-modes.md` §M8, carried **verbatim**, with every `agent()` call routed through `optsFor(node, label)`. Each node keeps its `taskType`, `phase` and `rationale` (plus `isolation`, where it mutates files concurrently); it does **not** carry a hardcoded `model`/`effort` — `routeFor(node.taskType)` resolves those against `input.mode`. Scripts have no module access (H10), so the block is duplicated by design and drift between copies is a defect.
- A `log()` line per node emitting its ledger row (mode, model, effort, est tokens, running spend vs budget), plus the `modifier-A: suppressed` line under all-out mode.
- The pure-literal `ESTIMATE` block, stamped with the figures the user approved at the engine pre-flight (zeros under `balanced`, where no pre-flight fires).
- `meta.phases` mirroring the framework phase names for the nodes in this workflow.

If `--dry-run`, print this script plus the DAG and ledger, and stop. Under `--mode all-out --dry-run` the pre-flight's estimate table still prints; its question does not.

### 9. Handoff for authorized execution

Deliver the typed DAG, current-phase script, assumptions, budget allocation and
estimate to `proof-engine`. A planning-only request ends here. Do not call the
Workflow tool merely because a plan is complete.

If the user requested execution too, the engine performs its capability checks,
§M6 pre-flight and required human gate before running. Cite that shared procedure
instead of asking a second copy of its approval question here. A planning
workflow from step 3 is distinct from executing the domain tasks it proposes.

### 10. Report the plan and its evidence

Report the requested deliverables, ordered nodes, dependencies, per-node route
rationale, expected artifacts, named gates, estimated cost and unresolved gaps.
Mark every unexecuted node `planned`. Estimates are forecasts, not billed usage.
If a separately authorized engine run occurred, link its result and actual
usage evidence; unavailable usage remains unknown. Journal interpretation and
approved-versus-actual reporting belong to `proof-engine`, not a second PM
implementation of that procedure.

## What this layer does NOT change

- It does **not** modify or fork `../proof-engine` — the harness policy, loop policy, JS templates, and AIDLC framework are consumed read-only.
- It does **not** add orchestration primitives. Every node still becomes a `pipeline()`, `parallel()`, or loop from the unchanged templates.
- It does **not** override the human gates. AIDLC's gates are the PM's phase boundaries.
- The DAG, model routing, and ledger are **planning and reporting artifacts** layered around an otherwise-standard workflow run.

## Files in this skill

- `references/coverage-planning.md` — why one planner is not enough: three framings, the roster sweep, loop-until-dry, and the per-node charter.
- `references/task-decomposition.md` — building the typed task DAG (node schema, edge rules, fan-out vs loop, phase grouping).; plus the decomposition-failure catalogue (§9) — noun splits, false parallels, phantom edges, tier mismatch, the unpriced repair round
- `references/model-routing.md` — the routing rationale: the fleet, the session-model check, both override modifiers under each mode, and the two-column worked example.
- `references/standards.md` — the authoritative standards this skill applies — named, version-pinned, and mapped to its workflow
- `templates/project-coverage-plan.workflow.js` — the coverage-first planning run: 3 framings → reconcile → roster sweep → gap rounds until dry → charters.
- `templates/project-plan.workflow.js` — a `../proof-engine` script template that realizes one phase's sub-DAG through the canonical `ROUTES` block, with per-node `taskType`/`isolation` and the ledger `log()` lines.

One file this skill depends on lives **in the sibling engine, not here**: `../proof-engine/references/execution-modes.md` is the execution-mode contract and the single source of truth for the routing table (§M3), the override modifiers (§M4), verifier width and the dry threshold (§M5), the full-mode pre-flight (§M6), the `--planner fable` opt-in (§M7), and the canonical `ROUTES` block (§M8). It is consumed read-only alongside the harness and loop policies (step 2) and is never forked into this skill — a second copy of a routing table is the drift this release exists to remove.
