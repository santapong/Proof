---
name: loop-engine
description: "Author and execute a multi-agent Workflow script (pipeline, parallel with an earned barrier, or a guarded loop) governed by the harness and loop engineering policies and a pluggable lifecycle framework (default AIDLC). Use when the user asks to run a task as a workflow, orchestrate with subagents, fan out agents, or execute a phase-structured job (audit, migration, review sweep, feature build) at multi-agent scale. This is the execution engine every other skill's templates target. For decomposing a whole project into a phased DAG with model routing before execution, use loop-orchestrate."
argument-hint: <task> [--mode <optimize|full>] [--planner <opus|fable>] [--framework <name>] [--dry-run]
---

# Workflow Skill

You are about to author and execute a multi-agent Workflow script for the user's task. Invoking this skill is the user's explicit opt-in to multi-agent orchestration via the Workflow tool.

## Execution flow

Follow these steps in order.

### 1. Parse arguments

From the skill args, extract:

- **task** — everything that is not a flag. This is the job to orchestrate. If empty, ask the user what task to run.
- **`--mode <optimize|full>`** — the run-level routing dial. Default: `optimize`, resolved **silently** when the flag is absent. `full` pins every node to `claude-opus-5`, disables the wide-fan-out modifier, widens verifiers, raises the loop-until-dry threshold, and fires the pre-flight in step 6. Full contract in `references/execution-modes.md`.
- **`--planner <opus|fable>`** — routes only the single decompose/planning node. Default: `opus`. Orthogonal to `--mode` and legal in both. `fable` is an opt-in with a stated price — print the §M7 disclosure verbatim before the planner spawns.
- **`--framework <name>`** — which lifecycle framework governs the phases. Default: `AIDLC`.
- **`--dry-run`** — if present, author the script and show it to the user, but do NOT execute it.

Flags are case-insensitive and the `=` form (`--mode=full`) is accepted. **Never guess an unrecognized value** — for a `--mode` or `--planner` value outside the two listed, name the two valid values and ask which to use, exactly as step 2 does for an unknown `--framework`. This skill and `loop-orchestrate` are the only two flag parsers in the plugin; every other skill passes its raw argument string through to here.

### 2. Load governing documents

Read, from this skill's directory:

1. `references/harness-policy.md` — the Harness Engineering Policy (orchestration design rules)
2. `references/loop-policy.md` — the Loop Engineering Policy (iteration rules)
3. `references/standards.md` — prior art the harness/loop policies formalize (fan-out/fan-in, DAG execution)
4. `references/execution-modes.md` — the execution-mode contract: routing table, modifiers, verifier width, the loop-until-dry threshold, the full-mode pre-flight, and the canonical `ROUTES` block
5. `frameworks/<name>.md` — the chosen framework

If `frameworks/<name>.md` does not exist, list the `frameworks/` directory (ignore `README.md` and `_TEMPLATE.md`), show the user the available framework names, and ask which to use.

### 3. Map the task onto the framework

The framework file defines phases, each with: purpose, entry criteria, agent activities, an orchestration hint (pipeline / parallel / loop), and an exit gate.

- Decide which phases apply to this task. Small tasks may need only one phase; do not force every phase onto every task.
- For each applicable phase, decide the concrete fan-out: what items, what each agent does, what schema it returns.
- Note the framework's human-in-the-loop gates: at those points the workflow (or you, between workflows) must stop and return results for user approval before continuing. Prefer one Workflow invocation per gated phase so the user stays in the loop between phases.

### 4. Choose the orchestration shape (per the harness policy)

- Default to `pipeline()` — no barrier between stages.
- Use a `parallel()` barrier between stages only when a stage genuinely needs ALL prior results at once (cross-item dedup/merge, early-exit on zero findings, prompts that reference "the other findings").
- Use a loop (per the loop policy) only for unknown-size discovery. A known work-list is a single `pipeline()`, not a loop.
- Apply the verification rules from the harness policy: schema on every machine-consumed result, adversarial or diverse-lens verification for findings, judge panels for wide solution spaces.

### 5. Author the script

Start from the closest template in `templates/`:

| Template | When |
|---|---|
| `pipeline.workflow.js` | Known items flowing through independent stages (default choice) |
| `parallel.workflow.js` | Fan-out finders whose results must be merged/deduped before the next stage |
| `loop-until-dry.workflow.js` | Unknown-size discovery (find "all" of something) |
| `loop-until-budget.workflow.js` | User gave a token target ("+500k") to scale depth against |

Copy the template's structure and fill the `EDIT ME` slots. Requirements for the finished script:

- `export const meta = {...}` first, as a **pure literal** (no variables, calls, spreads, or template strings). `meta.phases` titles must exactly match the `phase()` / `opts.phase` strings used in the body, and should mirror the framework phase names.
- Plain JavaScript, NOT TypeScript — no type annotations, interfaces, or generics.
- No `Date.now()`, `Math.random()`, or argless `new Date()` — pass timestamps in via `args`; stamp results after the workflow returns.
- Parameterize with `args` (pass real JSON values in the Workflow call, never a JSON-encoded string) — and still normalize defensively at the top of the script, since some harnesses deliver `args` as a string: `const input = typeof args === 'string' ? JSON.parse(args) : args`.
- `.filter(Boolean)` on every `parallel()` result before use; skipped/dead agents resolve to `null`.
- Pass a `schema` to every `agent()` whose output the script consumes.
- `log()` progress each round/stage, and `log()` anything dropped by a cap — no silent truncation.
- Carry the canonical `ROUTES` block from `references/execution-modes.md` §M8 **verbatim** in any script that sets `model` or `effort`, and route every `agent()` call through `optsFor()`. Scripts have no module access (H10), so the block is duplicated by design — drift between copies is a defect.
- Pass `args.mode` / `args.planner` through as **real JSON values** on the Workflow `args` object, never a JSON-encoded string. `DRY_LIMIT` and verifier `WIDTH` derive from `input.mode` inside the block; no other mode branching belongs in a script.

### 6. Execute

**If `--mode full`, run the pre-flight first** — in this session, after the script is authored and **before** the Workflow tool is called (a script cannot prompt a human or read a clock, so the gate lives here per H10). Follow `references/execution-modes.md` §M6:

1. Print the four-part estimate table — DAG size with fan-outs shown as their multiplicands, the low–high token band alongside the same DAG priced at `optimize`, what full mode changed, and the rate-limit/concurrency risks.
2. Ask **exactly one** question: `Full mode: N agents across P phases, est. X–Y output tokens (optimize would be A–B). Modifier A disabled · verifier width 3 (5 on gating nodes) · loop-until-dry K=3 · every node pinned to claude-opus-5. Proceed?` — accepting **yes** (proceed, stamping the approved figures into the script's pure-literal `ESTIMATE` block), **no** (nothing spawns, report what would have run), or **optimize** (re-author at `optimize`, print the cheaper estimate, proceed with no second confirmation).
3. **Spawn nothing before the answer.** Silence is not consent and a timeout is not a yes.
4. If `--budget` is set and the estimate's **high** end exceeds the ceiling, refuse to start and offer exactly three exits: re-run at `optimize`, raise the budget to a stated figure, or narrow the scope. This is deliberately stricter than H6's mid-run throw.
5. If the phase would exceed the ≤15-agents-per-workflow guideline, the guideline wins: split into two gated workflows and surface the split in the estimate.

Then:

- **If `--dry-run`**: print the full script in a fenced code block, explain the phase structure in a sentence or two, and stop. Do not call Workflow. Under `--mode full` the estimate table still prints; the question does not.
- **Otherwise**: call the Workflow tool with the script inline (`script`) and the task parameters as `args` — including `mode` and `planner` as real JSON values. Note the returned `scriptPath` and `runId` — to iterate, edit the persisted script file and re-invoke with `{scriptPath, resumeFromRunId}` rather than resending the script. Mode is frozen at first author: a resume reuses the persisted script and its original `args.mode`.

### 7. Report

- Relay the workflow's structured result to the user in plain prose: what ran, what was found/produced, and anything dropped or skipped. State the mode the run used, and in full mode note that modifier A was suppressed by design.
- **In full mode, diff approved-vs-actual.** Read `<transcriptDir>/journal.jsonl`, count the agents that actually ran and the output tokens they actually spent, and report both against the script's `ESTIMATE` literal — approved N agents / X–Y tokens versus actual. A run that lands outside its band is the signal to re-baseline the `BAND` / `SIZE` constants in `references/execution-modes.md` §M6, not to widen the band silently.
- If the result is empty or looks wrong, read `<transcriptDir>/journal.jsonl` from the run before diagnosing — it records each agent's actual return value.
- If a framework gate was reached, present the gate's deliverable and ask the user to approve before authoring the next phase's workflow.

## Adding frameworks

Frameworks are pluggable: drop a new `<Name>.md` into `frameworks/` following `frameworks/_TEMPLATE.md`. See `frameworks/README.md`. No changes to this file are needed.

## Reference files

- `references/harness-policy.md` — the Harness Engineering Policy: H1–H12, the orchestration-shape and verification rules every script obeys
- `references/loop-policy.md` — the Loop Engineering Policy: L1–L8, the iteration, budget-guard and convergence rules
- `references/execution-modes.md` — the execution-mode contract: the routing table (§M3), both override modifiers (§M4), verifier width and the loop-until-dry threshold (§M5), the full-mode pre-flight (§M6), the `--planner fable` opt-in (§M7), and the canonical `ROUTES` block (§M8)
- `references/standards.md` — the authoritative standards this skill applies — named, version-pinned, and mapped to its workflow
- `templates/pipeline.workflow.js` — known items flowing through independent stages; the default shape
- `templates/parallel.workflow.js` — fan-out finders whose results are merged and deduped at an earned barrier
- `templates/loop-until-dry.workflow.js` — unknown-size discovery, guarded by the dry counter
- `templates/loop-until-budget.workflow.js` — depth scaled against a user-supplied token target
- `frameworks/AIDLC.md` — the default lifecycle framework (Inception → Construction → Operation, with human gates)
- `frameworks/README.md` — how framework files are structured, selected, and contributed
- `frameworks/_TEMPLATE.md` — the skeleton for a new framework file
