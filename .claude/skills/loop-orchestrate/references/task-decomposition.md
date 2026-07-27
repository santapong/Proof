# Task Decomposition & Dependencies

How to turn a project goal into a **typed task DAG** — the PM's core artifact. Every downstream decision (orchestration shape, model tier, ledger row) keys off a node's fields, so a sloppy decomposition poisons the whole run. This file governs *what work exists and in what order*; `../../loop-engine/references/harness-policy.md` (H-rules) and `../../loop-engine/references/loop-policy.md` (L-rules) govern how a node is realized as `pipeline()` / `parallel()` / loop, and `./model-routing.md` maps `taskType` → model + effort. Consume all three read-only.

The DAG is a set of nodes and the `dependsOn` edges between them. It is a **dependency graph, not a schedule** — the workflow engine extracts parallelism from the edges. Your job is to get the nodes, their types, their edges, and their fan-out right; the harness rules then tell you which edges are barriers and which pipeline.

## 1. Identifying units of work

A **node** is the smallest chunk that has all four of:

1. **One deliverable** — it produces exactly one artifact or answer.
2. **One `taskType`** — if a chunk both gathers facts and decides on them, it is two nodes (a `scout` → an `analyze`), joined by an edge.
3. **A stateable acceptance criterion** — you can write, in one line, what "done and correct" means. If you can't, the node is underspecified: decompose it further or ask the user.
4. **A right size** — big enough that an agent's spawn overhead pays off, small enough that one agent (or one uniform fan-out) finishes it in a single context.

**Splitting.** A chunk that produces intermediate data another part of the same chunk consumes has an internal barrier — split it into two nodes with an edge. Description contains "and then"? Split on the "and then".

**Merging.** N would-be nodes that share a `taskType`, have no edge between them, and differ only by which item they operate on are **one** fan-out node, not N (see §5). "Verify each of the 12 findings" is one node with `fanOut: 12`.

**Smell tests** — the decomposition is wrong when:

- A node has no schema and no one-line acceptance criterion → underspecified.
- Two nodes are identical but for an item → collapse into one `fanOut` node.
- A node's description names an *activity* ("investigate auth") rather than a *deliverable* ("returns the list of auth call-sites and their guards") → rewrite around the output.

## 2. The node schema

Each node is a plain object. Fields, and the rule for each:

| Field | Value | Rule |
|---|---|---|
| `id` | kebab-case string | Unique in the DAG. **Stable across re-plans** — the ledger and `resumeFromRunId` line up on it. |
| `description` | one line | Names the *deliverable* ("returns …"), not the activity. Becomes the agent's charter. |
| `taskType` | see §3 | Drives the model tier (`./model-routing.md`) and the phase cast (§6). |
| `dependsOn` | array of `id`s | The DAG edge set: nodes that must complete first. `[]` = a root, runnable immediately. |
| `fanOut` | `1` \| integer `N` \| `"unknown"` | Sweep width. `1` = one agent; `N` = known work-list of N; `"unknown"` = discovery → loop (§5). |
| `model` | null until step 5 | Then a family/id from `./model-routing.md`. `null` = inherit the session model (H8) — correct for most nodes. |
| `effort` | null until step 5 | Then `low` \| `medium` \| `high` \| `xhigh` \| `max`. |
| `isolation` | `'none'` \| `'worktree'` | `'none'` by default. `'worktree'` **only** for concurrent file mutation (§4, H7). |
| `schema` | JSON schema \| null | Required when the output is machine-consumed (H3); `null` for a terminal prose deliverable. |
| `phase` | framework phase | Must be one of `meta.phases` (H9). Groups the node into a workflow (§6). |

`model`, `effort`, and `isolation` are pass-throughs the plan template hands to each `agent()` call. Leave `model`/`effort` null in step 3 and assign them in step 5.

## 3. Classifying `taskType`

The canonical enum — the same one the node-schema comment in `../SKILL.md` uses:

| `taskType` | Produces | Reads/mutates | Schema? | Typical tier |
|---|---|---|---|---|
| `scout` | Raw facts: files, call-sites, search hits, an enumeration | read-only | yes | cheapest capable |
| `analyze` | A judgment or set of options reasoned over gathered facts | read-only | yes | mid |
| `implement` | A code/artifact mutation satisfying a spec | **mutates** | yes (patch/status) | mid |
| `verify` | A pass/fail on a claim, adversarial or diverse-lens (H4) | read-only | yes | mid → top |
| `judge` | A score/ranking over multiple candidate solutions (H4) | read-only | yes | top |
| `synthesize` | One coherent artifact merged from many inputs | read-only | sometimes | top |
| `critic` | "What's missing" — the completeness pass (H12) | read-only | yes | top |
| `doc` | Deterministic low-reasoning output: docs, notes, boilerplate, renames | read/write | sometimes | cheapest |

**Vocabulary map** (shorthand you may hear → canonical types):

- **research** = `scout` (gather) + `analyze` (reason over what was gathered) — two nodes, one edge, never one.
- **decompose** = `synthesize` **run in Inception**: the node that merges the readers' maps and emits the unit-of-work sub-DAG. `AIDLC.md` states outright that the Inception synthesis step *is* the decomposition — so it is a `synthesize` node, and it earns the top tier (§6).
- **mechanical** = `doc`: deterministic transforms with no real reasoning, run cheap on the cheapest capable model with `effort` **omitted** — the optimize route for `doc`/`scout` is Haiku 4.5, which has no effort dial at all (`../../loop-engine/references/execution-modes.md` §M3).

A node whose `taskType` is `scout`/`analyze`/`verify`/`judge`/`critic`/`doc` is **read-only** — it never needs `isolation` (§4). Only `implement` (and a `doc` node that writes files) mutates.

## 4. Mapping dependencies — what pipelines vs what barriers

A `dependsOn` edge means **"needs the output of"** — nothing more. It does **not** by itself mean "runs after, behind a barrier." `pipeline()` (H1) extracts the parallelism: item A can be in a downstream node while item B is still upstream. Default every edge to a pipeline hand-off.

A **barrier** (`parallel()` between a node and its dependency) is **earned only** when the node needs its dependency's **entire** result set at once (H2):

- Dedup/merge across the full set before expensive downstream work.
- Zero-count early-exit ("0 findings → skip the whole verify node").
- The node's prompt references "the others" for comparison.

Rule of thumb: **per-item consumption pipelines; whole-set consumption barriers.**

| Dependency shape | Orchestration |
|---|---|
| N `implement` nodes each need the one `design` for their unit | pipeline (per-item hand-off) — no barrier |
| `synthesize` needs **all** `scout` maps to decompose | barrier (whole-set) |
| `verify` each finding independently | fan-out, **no** barrier among findings |
| `verify` needs findings **deduped** first | barrier before the verify node (whole-set) |

**Smell test** (from H2) — this is wrong:

```js
const a = await parallel(...)
const b = transform(a)            // pure per-item transform, no cross-item need
const c = await parallel(b.map(...))
```

The transform belongs inside a pipeline stage. "I need to flatten/map first" is not a barrier.

## 5. Sizing fan-out

`fanOut` decides how a node's width is realized:

- **`fanOut: 1`** — one agent, one deliverable. Most `synthesize`/`analyze`/`critic` nodes.
- **`fanOut: N` (known)** — enumerate the work-list *first* (a cheap inline `scout`: list the diff's files, the package's modules), then one node with `fanOut: N` becomes a `pipeline()`/`parallel()` over N items. **Never loop over a known list** (L6).
- **`fanOut: "unknown"` (discovery)** — the size *is* the unknown (find *all* the bugs/sources). Loop-until-dry (L1), or loop-until-budget with the `budget.total &&` guard (L2) when scaling depth against a `--budget`.

Sizing guidance:

- **Verification width scales to the ask** (H4) **and to the mode**. Under `--mode optimize` (the default): one skeptic for "any bugs left?"; 3 perspective-diverse verifiers when the ask is thorough/audit/comprehensive; a judge panel for wide solution spaces. Under **`--mode full` the width is a rule, not a range** — always diverse-lens, never a single skeptic: **3** verifiers on a standard `verify`/`judge`/`critic` node and **5** on a correctness-critical/gating one. Majority-refute kills a finding at ⌈N/2⌉ refutes (1 of 1, 2 of 3, 3 of 5), which in code is `Math.ceil(N / 2)` and never a literal `2`. Mode picks *how many* of a node's declared lenses run; it never invents new ones — a node that needs a fifth lens needs a decomposition change here, not a mode change. See `../../loop-engine/references/execution-modes.md` §M5.
- **Cap wide fan-outs and `log()` the drops** (H6). Concurrency is capped at `min(16, cores−2)` per workflow and lifetime agents at 1000 — design for queuing, not unlimited parallelism. Silent truncation reads as "covered everything" when it didn't.
- **Don't fan out work you can't reconverge.** A 50-way `scout` with no `synthesize` node downstream is 50 reports nobody reads. Every wide fan-out needs a merge or verify node consuming it.

## 6. Worktree isolation (H7)

`isolation: 'worktree'` costs ~200–500ms setup plus disk **per agent**. It exists for exactly one reason: agents that **mutate files concurrently** and would otherwise clobber each other.

**Decision rule** — set `isolation: 'worktree'` iff **all three** hold:

1. The node's `taskType` mutates files (`implement`, or a file-writing `doc`), **and**
2. It runs concurrently with another mutator (`fanOut > 1`, or overlapping in time with another mutating node), **and**
3. Their file targets can overlap.

Otherwise `'none'`. Concretely:

- **Read-only node** (`scout`/`analyze`/`verify`/`judge`/`critic`, read-only `doc`) → always `'none'`. Reading never conflicts.
- **Sequential mutation** — a `pipeline(units, design, implement, test)` where only one `implement` touches a given file at a time → `'none'`.
- **Parallel `implement` across units touching disjoint files** → still `'none'`; no conflict to isolate.
- **Parallel `implement` across units touching overlapping files** → `'worktree'`, each merged back at a barrier.

When in doubt, default `'none'` and let a downstream merge/verify catch conflicts — isolation is a cost you justify, not a safety blanket you reach for.

## 7. Mapping the DAG onto AIDLC phases — the default cast

Every node carries a `phase`; the phase set becomes `meta.phases`. Group the DAG by `phase` and check each phase against its **default cast** — the `taskType`s that phase expects (per `../../loop-engine/frameworks/AIDLC.md`). A node whose `taskType` isn't in its phase's cast is a decomposition smell — revisit §1.

| Phase | Default cast (`taskType`) | Shape (hint) | Human gate |
|---|---|---|---|
| **Inception** | `scout` readers → `synthesize` (the decompose) | `parallel()` readers + barrier synth | unit-of-work plan |
| **Construction** | `implement` → `verify` chain; adversarial review sweep (`verify`, diverse-lens; `judge` for wide spaces) | `pipeline(units, design, implement, test)` + `parallel()` review with dedup barrier | diff + tests + confirmed findings |
| **Operation** | `verify`-loop finders; `synthesize`; `critic`; `doc` | loop-until-dry hunt + small `pipeline()` for docs | verification evidence + docs + known gaps |

**This table deliberately carries no tier column.** The tier a `taskType` routes to lives in **exactly one place** — `../../loop-engine/references/execution-modes.md` §M3, the per-node-kind routing table, with its `--mode optimize` and `--mode full` columns and its exact model IDs. `./model-routing.md` holds the rationale, the two override modifiers, and the worked example. A second tier table here would be a second source of truth, and a routing table that drifts out of date while still reading as authoritative is precisely the failure this release exists to fix. Phase membership is a decomposition decision; tier is a routing decision; keep them in separate files.

`analyze` slots into Inception (reasoning over the maps before synthesis); `judge` appears wherever a wide solution space needs scoring.

**Gates are your phase boundaries** (H11). The DAG downstream of a gate is **provisional**: at each gate, stop, present the deliverable, and **re-plan and re-budget** the next phase against what actually happened. Author **one workflow per gated phase** — never a monolith spanning gates.

## 8. Progress + gate reporting — the cast + cost ledger

Reporting reuses the normal workflow machinery (`meta.phases`, `log()`, the run journal) and adds the PM's accountability layer: a **per-node cast + cost ledger**.

Every executed node emits one ledger row via `log()`:

```js
log({
  id,            // node id
  taskType,      // from §3
  mode,          // 'optimize' | 'full' — the run's --mode, from input.mode
  model,         // assigned tier/id, or 'inherit' when opts.model was omitted
  effort,        // low | medium | high | xhigh | max, or null (omitted)
  estTokens,     // pre-computed estimate for this node
  rationale,     // one line: why this tier, not a cheaper one — and under which mode
  spentSoFar,    // running total across executed nodes
  budgetTotal,   // the --budget ceiling, or null
})
```

**`mode` is not optional.** A ledger row that does not name the mode cannot be read after the fact: `model: 'claude-opus-5'` on a scout node is an expensive mistake under `optimize` and the contract under `full`, and the row is the only evidence of which one happened.

**Under `--mode full`, every wide fan-out row additionally carries the `modifier-A: suppressed` marker**, emitted where the fan-out is dispatched:

```js
log(`modifier-A: suppressed (mode=full) — ${items.length}-item fan-out running at ceiling by design`)
```

Without it, a reader cannot distinguish a full-mode fan-out that ran at ceiling *by design* from an optimize-mode fan-out where someone forgot to route it down. Modifier A is disabled in full mode deliberately (`./model-routing.md`, `../../loop-engine/references/execution-modes.md` §M4), and the log line is what makes that decision auditable rather than invisible.

Constraints (H10): no `Date.now()` / `Math.random()` / argless `new Date()` inside the script — pass any timestamps via `args`, and derive actual token spend post-hoc from `<transcriptDir>/journal.jsonl`, which records each agent's real return value. `estTokens` is a pre-computed input; the journal is ground truth. Under `--mode full` the approved figures also enter the script as a pure-literal `ESTIMATE` block stamped at the §M6 pre-flight, so the gate can diff approved-vs-actual instead of taking the estimate on faith.

At each gate, present three things:

1. The **phase deliverable** (the gate's artifact).
2. The **ledger slice** for the phase — one row per node, plus running spend vs `--budget`. **Flag any node whose actual spend materially exceeded its estimate** (cross-check the journal).
3. The **re-plan and re-budget** for the next phase, for the user to approve before you author it.

End every comprehensive phase with a **completeness `critic`** node (H12): "what's missing — a node not run, a dependency unverified, a phase skipped?" Its findings become the next round of work or are reported as the run's known gaps.
