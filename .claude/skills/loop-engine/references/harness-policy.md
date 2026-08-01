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

- The token target from a user's "+500k"-style directive is a **hard ceiling** exposed as `budget`: once `budget.spent()` reaches `budget.total`, further `agent()` calls throw. Guard budget-scaled loops with `budget.total &&` (see loop policy L2). That is the *runtime* ceiling, and in `--mode balanced` it is the whole rule.
- **`--mode all-out` makes `--budget` stricter than the bullet above, and this is the exception the mode contract names by name — do not read H6's runtime ceiling as the whole story.** When both flags are present, the full-mode pre-flight (`execution-modes.md` §M6) compares the estimate's **high** end against the ceiling **before the first agent spawns** and **refuses to start** if it exceeds it, offering exactly three exits: re-run at `--mode balanced`, raise the budget to a stated figure, or narrow the phase's scope. Nothing partially starts. This is a deliberate behaviour change to `--budget` in all-out mode — burning 80% of a ceiling and then throwing mid-run is precisely the failure a pre-flight exists to prevent — so a full-mode run never reaches the mid-run throw described above by way of an estimate it could have refused.
- Concurrency is capped (min(16, cores − 2) per workflow); excess calls queue. Total lifetime agents are capped at 1000. Design fan-outs assuming queuing, not unlimited parallelism.
- **No silent caps**: if the script bounds coverage (top-N, sampling, no-retry), `log()` what was dropped. Silent truncation reads as "covered everything" when it didn't.

## H7. Isolation is expensive — use it only for parallel mutation

`isolation: 'worktree'` costs ~200–500ms setup plus disk per agent. Use it **only** when agents mutate files concurrently and would otherwise conflict. Read-only agents never need it.

## H8. Model and effort selection is mode-governed

The run's `--mode` decides the route; this rule decides how a script expresses it.

- **`--mode balanced` (the default)** — omit `model` and inherit the session model for judgment work. Set `opts.model` only when the router has a reason to leave the session tier: routing *down* to Haiku/Sonnet for a cheap or wide stage, or pinning the top tier on a node whose wrong answer is inherited by everything after it (a gating verify, the decomposition). Set `effort` per node: `low` or omitted for mechanical stages, the higher tiers for the hardest verify/judge stages.
- **`--mode all-out`** — pin `model: 'claude-opus-5'` on **every** consumed `agent()` call and lift each node to its full-mode effort floor. Pinning here is not the noise H8 usually warns about; it is the mode's enforcement mechanism. An inherited model silently voids the guarantee the moment a session runs below Opus 5, and the cast ledger must be able to prove what actually ran.

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

## The waste catalogue — shapes that pass every rule above

H1–H12 make certain shapes illegal. These six pass — each survives every rule above as it is actually checked and still wastes the run, because the check reads a shape, a schema, or an authoring-time justification while the waste lives in the data flow, the prompt's premises, or the run *series* no single script can see. Drawback first: read the cost column before the shape column. The empirical base for why these recur is `standards.md`'s MAST section (step repetition, reasoning–action mismatch, and the two measured interventions — role-specification +9.4%, verification +15.6%); the read/write split and the verification evidence are graded on `../../../../docs/design/agent-engineering-terms.md`.

| Shape | The waste | The rule that should catch it — and why it doesn't | The discipline |
|---|---|---|---|
| **The unearned barrier** — `parallel()` where `pipeline()` belonged | Wall-clock becomes the slowest item *per stage, summed*, instead of the slowest single-item chain — the exact difference H1 names, paid on every stage's straggler (the priced comparison is `standards.md`'s barrier-vs-stream table) | **H2** — but H2's justifications are asserted at authoring, never tested: a stage that *receives* the full result array and reads only its own item looks like "needs cross-item context" to anyone skimming shape instead of data flow | For every barrier, point to the line or prompt sentence where stage N reads *another item's* result. If none exists, the barrier is unearned — apply H2's smell-test rewrite |
| **The redundant-lens vote** — N verifiers with identical prompts on a finding that can fail in more than one way | The vote costs N× and yields roughly one draw: identical skeptics re-sample the same failure mode, and H4's diverse-lens variant exists precisely because diversity samples *different* modes | **H4** legalizes plain adversarial verify (N identical refuters), which is correct when there is one way to fail; §M5 (`execution-modes.md`) fixes verifier *width*, and nothing checks lens *mix* | Before widening, answer "what does verifier 3 see that verifier 2 cannot?" No answer means width 3 is width 1 at three times the price. Vary the lens, or at minimum the starting corner — L8's per-index variation, applied to verifiers |
| **The starved fan-out** — write-heavy, coupled work decomposed across agents | Each agent holds a fragment of the design and none holds the whole; the merge inherits N partial understandings — context fragmentation, per the read/write split on the terms shelf — plus H7's per-agent worktree cost, paid to enable a decomposition that should not exist | **None** — H1–H12 govern whether a shape is legal, not whether the work decomposes; a coupled-write fan-out with worktree isolation is fully compliant, and H7 even blesses the isolation | Fan out read-heavy breadth (audits, searches, review sweeps); keep write-heavy coupled work in one agent and hand decision-carrying state between phases instead (`loop-context`). The evidence: `../../../../docs/design/agent-engineering-terms.md` §7 |
| **The verifier-payload wiring bug** — a value computed for or by a verify stage that no line consumes or that never arrives | Verification's cost is paid and its information discarded. This repo shipped the class twice: the shared `WIDTH` function returned 1 while the policy table said 3, so gating verifies silently ran at a third of their stated width (CHANGELOG 1.0.0), and the Verify-category deepening run's verify prompt carried its placement payload as a literal, uninterpolated template string — flagged in that run's commit record as the known defect for the next run | **H3** checks that consumed results carry schemas, not that every computed field has a consumer. The gate precedent is CHANGELOG 1.3.0: four templates parsed green and were silently mode-inert — static checks over behaviour nothing ever ran | **Prefer the revision whenever present**: when a verifier returns `{ok, revision}`, the landing step consumes `revision ?? draft` — a revision field nothing reads is H3-green and pure waste. For every field a verify stage computes or receives, name the line that reads it before the run starts |
| **The guessed-target brief** — a fan-out whose per-agent briefs name files or paths the author never checked | The agent's first spend goes to discovering the premise is false — or worse, it complies and writes the phantom file. Multiply by width. The Operate-category deepening run briefed two writers at `methodology.md` targets that did not exist; both were re-routed to the real siblings, `alerting.md` and `incident-command.md`, the file inventory stated alongside in the run's record | **None reads a brief's factual premises** — H3 validates the return, not the prompt; MAST's role-specification finding (+9.4%, `standards.md`) prices precise briefs without any rule enforcing them | The fallback-instruction pattern: check the named path before authoring, and where you genuinely cannot, write the fallback into the brief itself — "if the file does not exist, list the directory, pick by subject, name your choice." A brief that survives its own wrong guess costs one sentence; one that cannot costs an agent |
| **The trend-blind series** — N sequential workflows, each individually green, while a cross-run defect repeats | The same defect priced once per run. No in-run guard can see it: every H and L rule, and `journal.jsonl`, are scoped to a single run | **None in this file, deliberately** — a script cannot hold a trend. The deepening series proves the counter-rule works both ways: passes 5–8 flagged the literal-interpolation defect as "known workflow defect for next run" in the commit record, and the very next run's record shows the fix applied (the stated file inventory) | The run-over-run review: before authoring run N+1 of a series, read run N's report and commit record for flagged defects, and carry a known-defects note out of every series run. For standing loops, the distribution-level version is owned by the weekly digest — `../../loop-autopilot/references/comprehension-rot.md`, D1–D6 |

**Reading the record.** Rows four to six cite the repo's record as it actually reads, per the convention `../../loop-skill/references/authoring.md` sets for its own catalogue: the CHANGELOG's deepening entries record drafts landing *verifier-revised* — the payload consumed, the discipline working — while the wiring defect, the guessed `methodology.md` filenames, and the next-run fix live in the series' commit messages, not the CHANGELOG text. A catalogue that upgrades a commit-log note into a changelog citation is committing the unverified-shelf-pin defect its sibling catalogue already names.
