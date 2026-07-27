# The template contract — writing for a sandbox

A `*.workflow.js` is the one part of a skill that is **executed rather than read**. It runs where there is no filesystem, no module system, no clock, and no human to prompt. Every rule below follows from that, and [`scripts/validate.mjs`](../../../../scripts/validate.mjs) enforces each one in CI.

## Two execution contexts, and which one you are in

| | Authoring context (the session) | Execution context (the sandbox) |
|---|---|---|
| Read files, search the web | ✅ | ❌ |
| Ask the human a question | ✅ | ❌ |
| Read a clock, roll dice | ✅ | ❌ |
| Spawn agents in parallel | ❌ | ✅ |

Anything interactive or estimated therefore happens at **authoring time** and enters the script **only as pure literals**. This single split explains the pre-flight's placement, the `ESTIMATE` literal, and the duplication rule below. When a rule looks arbitrary, check which context it protects.

## H10 — the hard rules

- **`export const meta = {…}` first, a pure literal.** No variables, calls, spreads, or template interpolation — the host reads it *before* executing anything. Required keys: `name`, `description`. `meta.phases` titles must exactly match the `phase()` / `opts.phase` strings used in the body.
- **Plain JavaScript.** No TypeScript — no annotations, interfaces, or generics.
- **No `Date.now()`, no `Math.random()`, no argless `new Date()`.** Resume replays completed calls from cache and must be deterministic. Pass timestamps in via `args`; vary prompts by index rather than by chance.
- **Normalize `args` defensively.** Some harnesses deliver it as a string:
  ```js
  const input = typeof args === 'string' ? JSON.parse(args) : args
  ```
- **`.filter(Boolean)` on every `parallel()` result.** A skipped or dead agent resolves to `null`; `parallel()` never rejects. Design so one dead agent degrades coverage rather than crashing the run.
- **A `schema` on every consumed `agent()` call.** Validation happens at the tool-call layer, so the agent retries on mismatch and the script never parses prose.
- **`log()` anything a cap drops.** Silent truncation reads as full coverage when it was not.

## The `ROUTES` block

Any template that sets `model` or `effort` carries the canonical block **byte-identically**. It cannot be imported — the sandbox has no module system — so duplication is the only expressible form, and the design makes it a *rule* rather than an apology: `execution-modes.md` §M8 is the single source of truth, and the gate extracts that block at run time and diffs every copy against it.

```js
// Canonical ROUTES block — single source of truth: loop-engine/references/execution-modes.md §M8.
// Duplicated verbatim into every template that sets model or effort. H10 gives scripts no module
// access, so duplication is intentional; drift is a defect (see scripts/validate.mjs).
const MODE = (input && input.mode) === 'full' ? 'full' : 'optimize'
const PLANNER = (input && input.planner) === 'fable' ? 'claude-fable-5' : null // --planner fable (§M7)
const ROUTES = { /* … §M8 … */ }
const routeFor = (kind) => (ROUTES[MODE] && ROUTES[MODE][kind]) || ROUTES[MODE].analyze
const WIDTH = (kind) => (MODE === 'full' ? (kind === 'gating' ? 5 : 3) : (kind === 'gating' ? 3 : 1))
function optsFor(node, label) { /* … §M8 … */ }
```

**Copy it from §M8 or from a conformant sibling template. Never retype it from memory** — a single character of drift is a gate failure, and the whole point of the rule is that the copies stay identical.

Three sanctioned omissions, each requiring a comment right below the block saying which you dropped and why:

| Omit | When |
|---|---|
| `WIDTH` | The template has no verify stage |
| `DRY_LIMIT` | The template has no loop |
| `PLANNER` handling in `optsFor` | The template has no `planner`-kind node |

An omission with no note is indistinguishable from drift.

**No other local variation is permitted.** In particular, never write a bare `model:` or `effort:` literal on an `agent()` call — routing decisions come from `ROUTES` so that policy cannot be quietly overridden per template. The gate rejects them.

## Reserved argument names

`input.mode` and `input.planner` are **reserved fleet-wide**. A template that means something else by `mode` silently mis-routes every node in the run, because `ROUTES[MODE]` falls back to `balanced` for an unrecognized value rather than failing loudly.

This is not hypothetical: `loop-autopilot`'s improvement loop used `input.mode` for its own dry/live switch and had to rename it to `input.runMode` in 1.0.0 — a breaking change to an unattended template, forced by a name collision. Pick a qualified name (`runMode`, `execution`, `reviewDepth`) and say so in a comment. Adding a reservation is a fleet-wide contract change: it goes in `execution-modes.md` §M9 **and** `CONTRIBUTING.md`, in the same commit.

## Choosing the shape

Per [`harness-policy.md`](../../loop-engine/references/harness-policy.md):

| Shape | When | Rule |
|---|---|---|
| **`pipeline()`** | Known work-list flowing through independent stages | **The default.** Item A can be in stage 3 while item B is in stage 1; wall-clock is the slowest *chain*, not sum-of-slowest-per-stage |
| **`parallel()` barrier** | Stage N needs the **whole** prior set | **Earned only** by a cross-item reduce: dedup/merge, zero-count early exit, or a prompt comparing findings against each other |
| **Loop** | Unknown-size discovery ("find *all* the …") | Loop-until-dry with a `seen` set. A known list is a pipeline, **never** a loop |

"I need to flatten/map/filter first" is **not** a barrier — do it inside a pipeline stage. Every barrier carries an inline comment justifying itself under H2; the gate looks for one.

Verification scales to the ask: one skeptic for "any bugs?", 3–5 **perspective-diverse** verifiers for a thorough audit. Diversity beats redundancy — three different lenses cover more failure surface than the same question asked three times. Kill a finding at `Math.ceil(N / 2)` refutes, never a literal `2`, which is silently wrong the moment width becomes 5.

## Before you commit

```
node --check .claude/skills/<name>/templates/<name>.workflow.js
node scripts/validate.mjs
```

The gate checks structure. It cannot tell you whether the *shape* is right — whether that barrier is earned, whether the fan-out reconverges, whether a verify stage actually verifies. Read the diff against the harness policy yourself.
