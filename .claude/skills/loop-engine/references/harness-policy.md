# Harness Engineering Policy

Rules for designing multi-agent orchestration. These govern the *shape* of a workflow script: how work fans out, where barriers are allowed, how results are verified, and how resources are spent. The Loop Engineering Policy (`loop-policy.md`) governs iteration; this policy governs everything else.

## H1. Default to `pipeline()`

Multi-stage work flows through `pipeline(items, stage1, stage2, ...)` with **no barrier between stages**: item A may be in stage 3 while item B is still in stage 1. Wall-clock cost is the slowest single-item chain, not the sum of the slowest item per stage.

Every stage callback receives `(prevResult, originalItem, index)` — use `originalItem`/`index` in later stages instead of threading context through earlier return values. A stage that throws drops that item to `null` and skips its remaining stages.

## H2. Barriers must be earned

A `parallel()` barrier between stages is allowed **only** when stage N needs cross-item context from all of stage N−1:

- Dedup/merge across the full result set before expensive downstream work
- Early-exit when the total count is zero ("0 findings → skip verification entirely")
- Stage N's prompt references "the other findings" for comparison

A barrier is NOT justified by "I need to flatten/map/filter first" (do it inside a pipeline stage), "the stages are conceptually separate", or "it's cleaner code".

**Smell test** — this shape is wrong:

```js
const a = await parallel(...)
const b = transform(a)              // pure per-item transform, no cross-item dependency
const c = await parallel(b.map(...))
```

Rewrite it as a pipeline with the transform inside a stage.

## H3. Structured output everywhere

Pass a JSON `schema` to every `agent()` call whose result the script consumes. Validation happens at the tool-call layer, so the agent retries on mismatch and the script never parses prose. Agents should be prompted to return raw data — their final text is a return value, not a human-facing message.

## H4. Verification is adversarial, and diversity beats redundancy

Findings that will be reported as true must survive verification:

- **Adversarial verify**: N independent skeptics per finding, each prompted to REFUTE it ("default to refuted if uncertain"). Kill the finding if a majority refute.
- **Perspective-diverse verify**: when a finding can fail in more than one way, give each verifier a distinct lens (correctness, security, performance, does-it-reproduce) instead of N identical refuters.
- **Judge panel**: for wide solution spaces, generate N independent attempts from different angles, score with parallel judges, synthesize from the winner and graft the best ideas from runners-up.

Scale verification to the ask: "find any bugs" → few finders, single-vote verify; "thoroughly audit" → larger pool, 3–5 vote adversarial pass, synthesis stage.

## H5. Handle nulls

`parallel()` never rejects: a thunk that throws resolves to `null`. An `agent()` call returns `null` if the user skips it or it dies on a terminal error. **Always** `.filter(Boolean)` before consuming fan-out results, and design so one dead agent degrades coverage rather than crashing the run.

## H6. Budget and concurrency

- The token target from a user's "+500k"-style directive is a **hard ceiling** exposed as `budget`: once `budget.spent()` reaches `budget.total`, further `agent()` calls throw. Guard budget-scaled loops with `budget.total &&` (see loop policy L2). That is the *runtime* ceiling, and in `--mode optimize` it is the whole rule.
- **`--mode full` makes `--budget` stricter than the bullet above, and this is the exception the mode contract names by name — do not read H6's runtime ceiling as the whole story.** When both flags are present, the full-mode pre-flight (`execution-modes.md` §M6) compares the estimate's **high** end against the ceiling **before the first agent spawns** and **refuses to start** if it exceeds it, offering exactly three exits: re-run at `--mode optimize`, raise the budget to a stated figure, or narrow the phase's scope. Nothing partially starts. This is a deliberate behaviour change to `--budget` in full mode — burning 80% of a ceiling and then throwing mid-run is precisely the failure a pre-flight exists to prevent — so a full-mode run never reaches the mid-run throw described above by way of an estimate it could have refused.
- Concurrency is capped (min(16, cores − 2) per workflow); excess calls queue. Total lifetime agents are capped at 1000. Design fan-outs assuming queuing, not unlimited parallelism.
- **No silent caps**: if the script bounds coverage (top-N, sampling, no-retry), `log()` what was dropped. Silent truncation reads as "covered everything" when it didn't.

## H7. Isolation is expensive — use it only for parallel mutation

`isolation: 'worktree'` costs ~200–500ms setup plus disk per agent. Use it **only** when agents mutate files concurrently and would otherwise conflict. Read-only agents never need it.

## H8. Model and effort selection is mode-governed

The run's `--mode` decides the route; this rule decides how a script expresses it.

- **`--mode optimize` (the default)** — omit `model` and inherit the session model for judgment work. Set `opts.model` only when the router has a reason to leave the session tier: routing *down* to Haiku/Sonnet for a cheap or wide stage, or pinning the top tier on a node whose wrong answer is inherited by everything after it (a gating verify, the decomposition). Set `effort` per node: `low` or omitted for mechanical stages, the higher tiers for the hardest verify/judge stages.
- **`--mode full`** — pin `model: 'claude-opus-5'` on **every** consumed `agent()` call and lift each node to its full-mode effort floor. Pinning here is not the noise H8 usually warns about; it is the mode's enforcement mechanism. An inherited model silently voids the guarantee the moment a session runs below Opus 5, and the cast ledger must be able to prove what actually ran.

Never hardcode a fleet ceiling into a script, a policy, or a piece of advice — the session model is a fact to read, not a constant to assert. A claim like "the fleet caps at model X" expires, and any rule resting on it expires with it; compare the node's target tier against the session model instead, and pin whenever a silent mismatch would be expensive.

The per-node-kind routing table, both override modifiers, verifier width, the loop-until-dry threshold, the `--planner fable` opt-in, and the full-mode pre-flight are specified in `execution-modes.md`. The routing rationale and the worked example live in `../../loop-orchestrate/references/model-routing.md`.

## H9. Phase discipline

- `meta.phases` titles must exactly match the `phase()` / `opts.phase` strings used in the body — titles are matched exactly.
- Inside `pipeline()` / `parallel()` stages, assign groups with `opts.phase` per agent call, not the global `phase()`, to avoid races on shared phase state.

## H10. Script constraints (hard rules)

- `export const meta = {...}` comes first and is a **pure literal** — no variables, calls, spreads, or template interpolation. Required: `name`, `description`.
- Plain JavaScript, not TypeScript.
- `Date.now()`, `Math.random()`, and argless `new Date()` throw (they would break resume). Pass timestamps via `args`; vary prompts by index for diversity.
- No filesystem or Node.js API access inside scripts.

## H11. One workflow per human gate

When the governing framework defines a human approval gate between phases, end the workflow at the gate and return the gate's deliverable. Author the next phase as a fresh Workflow invocation after approval — the orchestrating session stays in the loop between phases.

## H12. Completeness critic

For comprehensive sweeps (audits, research, migrations), end with a critic agent that asks "what's missing — modality not run, claim unverified, source unread?" Its findings become the next round of work, or are reported as known gaps.
