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

- **Verification width scales to the ask** (H4) **and to the mode**. Under `--mode balanced` (the default): one skeptic for "any bugs left?"; 3 perspective-diverse verifiers when the ask is thorough/audit/comprehensive; a judge panel for wide solution spaces. Under **`--mode all-out` the width is a rule, not a range** — always diverse-lens, never a single skeptic: **3** verifiers on a standard `verify`/`judge`/`critic` node and **5** on a correctness-critical/gating one. Majority-refute kills a finding at ⌈N/2⌉ refutes (1 of 1, 2 of 3, 3 of 5), which in code is `Math.ceil(N / 2)` and never a literal `2`. Mode picks *how many* of a node's declared lenses run; it never invents new ones — a node that needs a fifth lens needs a decomposition change here, not a mode change. See `../../loop-engine/references/execution-modes.md` §M5.
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

**This table deliberately carries no tier column.** The tier a `taskType` routes to lives in **exactly one place** — `../../loop-engine/references/execution-modes.md` §M3, the per-node-kind routing table, with its `--mode balanced` and `--mode all-out` columns and its exact model IDs. `./model-routing.md` holds the rationale, the two override modifiers, and the worked example. A second tier table here would be a second source of truth, and a routing table that drifts out of date while still reading as authoritative is precisely the failure this release exists to fix. Phase membership is a decomposition decision; tier is a routing decision; keep them in separate files.

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

**`mode` is not optional.** A ledger row that does not name the mode cannot be read after the fact: `model: 'claude-opus-5'` on a scout node is an expensive mistake under `balanced` and the contract under `all-out`, and the row is the only evidence of which one happened.

**Under `--mode all-out`, every wide fan-out row additionally carries the `modifier-A: suppressed` marker**, emitted where the fan-out is dispatched:

```js
log(`modifier-A: suppressed (mode=full) — ${items.length}-item fan-out running at ceiling by design`)
```

Without it, a reader cannot distinguish a full-mode fan-out that ran at ceiling *by design* from an optimize-mode fan-out where someone forgot to route it down. Modifier A is disabled in all-out mode deliberately (`./model-routing.md`, `../../loop-engine/references/execution-modes.md` §M4), and the log line is what makes that decision auditable rather than invisible.

Constraints (H10): no `Date.now()` / `Math.random()` / argless `new Date()` inside the script — pass any timestamps via `args`, and derive actual token spend post-hoc from `<transcriptDir>/journal.jsonl`, which records each agent's real return value. `estTokens` is a pre-computed input; the journal is ground truth. Under `--mode all-out` the approved figures also enter the script as a pure-literal `ESTIMATE` block stamped at the §M6 pre-flight, so the gate can diff approved-vs-actual instead of taking the estimate on faith.

At each gate, present three things:

1. The **phase deliverable** (the gate's artifact).
2. The **ledger slice** for the phase — one row per node, plus running spend vs `--budget`. **Flag any node whose actual spend materially exceeded its estimate** (cross-check the journal).
3. The **re-plan and re-budget** for the next phase, for the user to approve before you author it.

End every comprehensive phase with a **completeness `critic`** node (H12): "what's missing — a node not run, a dependency unverified, a phase skipped?" Its findings become the next round of work or are reported as the run's known gaps.

## 9. Decomposition failures — reviewing the DAG before anyone runs it

`./coverage-planning.md` catches what a plan is **missing**. This section catches what a complete-looking DAG gets **wrong** — failures that parse, type-check against §2, and still poison the run. Every one is detectable at plan-review time: after step 8 of `../SKILL.md` authors the plan and before step 9 spawns anything (`--dry-run` prints exactly the artifacts these checks read). Each entry names its drawback first, because each looks like diligence from the inside.

| Failure | The drawback | Detection at plan review | The fix | Sharpens |
|---|---|---|---|---|
| **The noun decomposition** | Nodes are the architecture's component nouns ("the parser", "the DB layer", "the UI") instead of deliverables. Every deliverable needs a slice of every node, so edges run everywhere and the DAG is a lie — it encodes the shape of the code, not the flow of the work. | Read the `description` column alone: component names with no "returns …" clause. Then the edge set: most nodes depending on most others is the structural tell. | Re-slice **vertically by deliverable** so each node owns one output end to end. The components become the *out-of-scope* lines of neighbouring charters (`./coverage-planning.md` §4), not nodes. | §1's deliverable-not-activity smell. Note `./standards.md`'s WBS "nouns, not verbs" means *deliverable* nouns — a component noun satisfies its letter while failing §1's one-deliverable test. |
| **The false-parallel phase** | Siblings listed as parallel share an unmade **decision** — a format, a naming scheme, an API shape. They serialize on the first conflict, or worse, don't, and diverge until a gate discovers two incompatible halves. | The share-decisions test below, run on every concurrent sibling pair. | Hoist the decision into one upstream `analyze`/`synthesize` node with an edge to **both** siblings. A shared undecided decision is a missing node, always. | §4 — an edge means "needs the output of", and a decision *is* an output. Also §6, whose overlap test checks files only. |
| **The over-decomposed sliver** | Nodes smaller than their own briefing: per-agent orientation (charter, inputs, reading the repo) costs more than the work, and the run's spend is mostly agents getting dressed. | Compare each node's charter to its expected deliverable. A charter longer than the output, or an acceptance criterion that merely restates the description, marks a sliver. | Merge per §1: uniform siblings collapse into one `fanOut` node (one briefing amortized over N items); a lone sliver is absorbed into the neighbour that consumes it. | §1 criterion 4, whose floor ("big enough that an agent's spawn overhead pays off") prices only the spawn. The briefing dwarfs the spawn, so the operative floor is: **a task must be bigger than its briefing.** |
| **The under-specified interface** | Two nodes meet at an artifact **neither brief defines**. Both agents invent it, plausibly and differently, and the reconcile cost lands downstream disguised as "integration". | Walk every edge and name the shape that crosses it. An edge whose upstream node carries `schema: null` yet feeds a machine consumer is the tell (H3). | Define the interface **in the plan**: `schema` on the producer, named again in the consumer charter's Inputs and the producer's "Done means" (`./coverage-planning.md` §4). | H3 and §2's `schema` rule — extended from "machine-consumed output needs a schema" to "every edge needs a named shape". |
| **The phantom dependency** | Edges added from caution ("feels like it should wait") rather than data flow. False edges lengthen the critical path; enough of them serialize the DAG into a pipeline, and the parallelism the plan sold — and the ledger priced — never happens. | For each edge, name the **field** of the upstream output the downstream brief actually reads. No field, no edge. | Delete it. Reluctance to run two nodes concurrently is an isolation question (§6) or a shared-decision question (row above) — never an edge. | §4's "needs the output of — **nothing more**", and `./standards.md`'s CPM row: a false edge inflates the critical path that Amdahl says no fan-out can buy back. |
| **The routing-tier mismatch** | A gating decision routed to the cheap tier, or mechanical extraction routed to the expensive one. The cost ledger looks fine either way — the error cost lands **after** the run, when the cheap gate's false "all clear" ships. | Diff the plan's assignments row-by-row against `../../loop-engine/references/execution-modes.md` §M3: every planner/gating node pinned where the table pins; no mechanical fan-out riding the top tier under `balanced`; every rationale naming its mode (§8). | Re-route. Modifier B answers error cost, modifier A answers width (`./model-routing.md`) — never trade one for the other. | `./model-routing.md`'s pin-the-planner rule, plus the capability-gating caveat below. |
| **The plan that survives contact** | No repair round in the estimate. Every reconciled plan meets reality at its first gate; the only question is whether repair was priced in, or comes out of the next phase's budget as a surprise the ledger then reads as overrun. | The phase estimate equals the bare sum of its nodes — zero allowance for the repair work §7's gates exist to absorb. | Budget a **bounded** repair round per gated phase — `../../loop-build/references/conduct.md` §4 bounds it at two and owns the mechanics (cache-busting round markers included; do not restate them here). A re-plan that grows the approved figures by more than 25% re-fires the §M6 pre-flight (`../SKILL.md` step 9). | §7's re-plan-at-the-gate rule, and §8 — the ledger can only flag overruns against an estimate that was honest about repair. |

### The share-decisions-not-just-files test

For every pair of siblings the plan schedules concurrently, ask **two** questions, not one:

1. *Can their file targets overlap?* — §6's question, answered with `isolation`.
2. *Is there a decision both briefs assume that no upstream node emits?* — a question `isolation` cannot answer. A worktree keeps two diverging agents from clobbering each other **while they diverge**; it isolates the symptom and preserves the failure.

§6 passing is therefore necessary but not sufficient for parallelism. Two implement nodes touching disjoint files that both "pick a sensible error format" are not parallel — they are one unhoisted `analyze` node and two of its dependents.

### Capability gating applies to planners too

The routing-tier row has a sharper edge on the **planner** node than anywhere else, and the evidence lives on the autopilot shelf, not here: `../../loop-autopilot/references/anti-patterns.md` ("Capability gating") records the measured result that a weaker base model's proposals read as reasonable while their execution degrades outcomes. Translated to planning: a downgraded planner produces a DAG that *looks* like this file's output — typed, edged, charted — and is wrong in ways only the run reveals. That is why the planner row pins in **all three modes** (`./model-routing.md`) and why "the plan looked fine" is never evidence the tier was adequate. A cheap planner is unvalidated, not merely cheaper.
