# Model Routing — the right model for the right job

Every agent you spawn runs on *some* model at *some* effort. Picking well is the difference between a project that finishes cheap and correct and one that burns top-tier tokens formatting a table or ships a bug because a $0.02 Haiku "verified" a security fix. This file is the router: task type in, model + effort out, with two override modifiers layered on top — and one **mode column** deciding which half of the table you read.

**Do not assert a fleet ceiling — check the session model.** The previous edition of this file opened by stating that the default fleet capped at a named model, and then made real advice depend on that sentence ("omit `model` on judgment nodes, because the session is already at the cap"). The claim expired and took the advice with it. The replacement is a **check, not a constant**:

1. Read the model the orchestrating session is running on.
2. Compare it against the **target tier** the table below assigns this node.
3. **They match → omit `opts.model`** and inherit. Spelling out the session model is noise (harness policy H8).
4. **They differ → decide whether the mismatch is cheap or costly.** Routing *down* on purpose (a wide mechanical fan-out) is cheap and you pin it deliberately. Being routed *down* by accident on a node whose wrong answer is inherited by everything after it is expensive — so **pin the target tier explicitly** and let the ledger prove what ran.

That is a rule shaped like a check, so it cannot rot the way a rule shaped like a fact does. Everything else in this file is an elaboration of it.

**Mode selects the column.** `--mode balanced` (the default) routes each node to the cheapest tier that can do its job; `--mode all-out` pins every node to the top of the fleet. The full contract — flag parsing, verifier width, the loop-until-dry threshold, the pre-flight, and the canonical `ROUTES` block that templates copy — is `../../loop-engine/references/execution-modes.md`. **That file is the source of truth for the routing table and both modifiers; this file is the rationale and the worked example. If the two disagree, this file is the defect.**

## The fleet

| Model | ID | Reach for it when |
|---|---|---|
| Haiku 4.5 | `claude-haiku-4-5` | The work is mechanical and voluminous — cheap and fast is the whole point. Haiku 4.5 has **no effort dial**; omit `effort` entirely. |
| Sonnet 5 | `claude-sonnet-5` | The work is real production output — most coding and drafting. |
| Opus 5 | `claude-opus-5` | The work needs judgment — decompose, synthesize, review, or judge. `xhigh` and `max` effort live here. |
| Fable 5 | `claude-fable-5` | Opt-in only, via `--planner fable`, for the single hardest narrow long-horizon reasoning task — eyes open to the caveats in the last section. |

Model IDs are **bare aliases**. Never date-suffix them (`claude-haiku-4-5`, not `claude-haiku-4-5-20251001`), and update them in lockstep here, in `../../loop-engine/references/execution-modes.md`, and in every `ROUTES` block in the plugin. A partial update is a drift defect, not a partial improvement.

Effort is a separate dial, ordered `low < medium < high < xhigh < max`. Model sets the *class* of reasoning available; effort sets how hard the model works within it. Route both — except on a Haiku node, where there is only one dial to route.

**A note on `claude-opus-4-8`.** The previous generation's ID is still an active model, and a persisted v0.4.0 `*.workflow.js` containing `model: 'claude-opus-4-8'` still executes — it simply runs a generation behind and carries no mode plumbing. It is **off the default routing path entirely**: nothing in the table below reaches it, and no new script should name it. It survives here only so that a reader who finds it in an old script knows it is legacy rather than broken. Migration is a one-line ID substitution plus pasting the `ROUTES` block.

## Routing table (base route)

Match the task to the most demanding row it fits, then apply the modifiers below. This table reproduces `../../loop-engine/references/execution-modes.md` §M3 — `inherit` in the optimize column means *omit `opts.model`*; a spelled-out ID means *pin it*.

| Node kind | balanced model | optimize effort | all-out model | full effort | Rationale |
|---|---|---|---|---|---|
| scout / doc / mechanical (enumeration, extraction, formatting, renames) | `claude-haiku-4-5` | omit | `claude-opus-5` | `high` | Optimize: per-item judgment is small and multiplied wide, so budget governs (modifier A, H6) and Haiku is the floor. Full: modifier A is disabled, so the same node runs at ceiling — the row where the two modes diverge most, and where all-out mode's cost is actually incurred. |
| implement (production edit, drafting, most coding) | `claude-sonnet-5` | `high` | `claude-opus-5` | `high` | Optimize pins Sonnet 5 rather than inheriting, because the session runs Opus 5 and inheriting would route real production volume a tier above what the work needs. Full lifts it: implementation is where a cheapened node ships a defect. |
| analyze / synthesize (judgment over gathered facts, merged artifacts) | inherit | `high` | `claude-opus-5` | `xhigh` | Optimize omits `model` — the node's target tier equals the session model today, which is exactly the case H8's omit-by-default rule is for. Full pins the same model *and* lifts effort, because at the ceiling the only remaining headroom is effort and width. |
| verify / judge / critic (adversarial refute, diverse-lens vote, completeness pass) | inherit | `high` | `claude-opus-5` | `xhigh` | Verification is asymmetric — accepting a wrong result costs far more than the check (modifier B). Optimize inherits and scales effort with the ask; full pins, sets `xhigh`, and widens to 3 diverse lenses (§M5), which is where most of all-out mode's extra agents come from. |
| correctness-critical / gating (a false "all clear" ships the defect or corrupts every downstream node) | `claude-opus-5` | `max` | `claude-opus-5` | `max` | Identical in all three modes — this row is already at the ceiling, which is the concrete meaning of "modifier B has no travel left". Pinned even in balanced so the check does not silently degrade when a session runs below Opus 5. All-out mode widens it to 5 lenses; model and effort do not move. |
| planner — the single decompose/planning node | `claude-opus-5` | `xhigh` | `claude-opus-5` | `max` | Pinned in all three modes. Every later node inherits this node's output, so a silent inherit-downgrade corrupts the whole DAG rather than one result — the highest-error-cost node in any run (modifier B, H4). |
| planner — with the opt-in `--planner fable` override | `claude-fable-5` | `xhigh` | `claude-fable-5` | `max` | Reachable only by explicit flag, never by the table. Overrides the never-on-a-gate-blocking-step rule knowingly, under the §M7 preconditions, with the caveats printed at the point of use and an automatic fallback to `claude-opus-5` at `max`. |

Read the rows top-down and stop at the first that genuinely describes the task. "Rewrite this call site to the new API" is implement, not scout, even though it touches one line. "Does this auth change leak a session across tenants?" is a verify whose *wrong answer ships a breach* — so it is really the correctness-critical row.

Within a band, pick the higher effort when the input is ambiguous, the output is long-horizon, or a mistake is expensive to catch later; pick the lower effort when the task is well-specified and self-checking. In `all-out` mode there is no "within a band" to exercise — the column is the floor and the ceiling at once.

**Two node kinds pin even in balanced** — gating and planner — because a silent downgrade there is inherited by everything downstream. Everywhere else in balanced, omit and inherit. In `all-out`, pin everything: the mode is a *guarantee*, not a default, and an inherited model silently voids the guarantee the moment a session runs below Opus 5.

## Override modifier A — wide fan-out pushes a tier DOWN (optimize only)

**Modifier A — wide fan-out pushes a tier DOWN.** Active in `balanced`. **Disabled in `all-out`.**

The honest justification: modifier A exists to protect an **un-negotiated** budget ceiling (H6). In all-out mode the human has already been shown the bill and said yes at the §M6 pre-flight, so silently cheapening the run behind them is a worse failure than the spend they approved. That is the whole argument — A is not "less useful" in all-out mode, it is *against the contract*.

In `balanced`, when a stage fans out across many items the governing constraint is no longer "which model reasons best" but **budget** — the token target is a hard ceiling, and once it is spent further `agent()` calls throw (H6). Protect that ceiling by **dropping to the cheapest tier that can still do the per-item work**:

- A 300-endpoint inventory that "should" be Sonnet becomes Haiku — the per-item judgment is small and multiplied 300×, the aggregate bill is not. **From an Opus 5 session that drop is two steps, not one**, which is why the rule is phrased as "the cheapest tier that can do the work" rather than "one tier down": one step would leave a mechanical fan-out on Sonnet and pay a Sonnet bill for Haiku work.
- If per-item work is genuinely mechanical, this bottoms out at **Haiku with `effort` omitted**; Haiku is the floor, not a starting point you drop below, and it has no effort dial to turn down further.
- **Split when a fan-out is bimodal**: route the trivially mechanical items to Haiku and let only the ambiguous minority ride up a tier, rather than paying the top tier for the whole set. Log the split so the coverage is legible.

Whatever you cap, `log()` it — a silently narrowed fan-out reads as full coverage when it was not (H6, no silent caps).

All-out mode must still `log()` the suppression:

```js
log(`modifier-A: suppressed (mode=full) — ${items.length}-item fan-out running at ceiling by design`)
```

so a reader of the transcript can tell a wide fan-out ran at full tier **by design** and not by oversight. A full-mode ledger row that is silent about modifier A is indistinguishable from an optimize run that forgot to apply it.

## Override modifier B — high downstream error-cost pushes a tier UP (all three modes)

Verification is asymmetric: the cost of *accepting a wrong result* dwarfs the cost of the check. When an agent's output gates everything after it — a verify that decides "ship it", a decomposition every later task inherits, a judge that picks the winner — push **up**, even if the task looks cheap:

- "Confirm the migration dropped no log lines" is nominally a search (Haiku), but a false "all clear" corrupts 40 services silently → the correctness-critical row.
- A one-line release-notes edit is formatting (Haiku), but if downstream auditors treat it as the compliance record, lift it to a real implement-and-review pass.

**Modifier B — high downstream error-cost pushes a tier UP.** Active in all three modes, restated as a **three-rung ladder** now that Opus 5 is the ceiling of the default path:

1. **Model** — push the tier up first.
2. **Effort** — then `high` → `xhigh` → `max`.
3. **Verifier width and lens diversity** — then more, and more *different*, checks.

At the ceiling only rungs 2 and 3 have travel. That is exactly what "already at ceiling" means on the gating row of the table above: the model cannot go higher, so error cost is answered with effort and width instead. B is also the only modifier that may reach for `--planner fable`, and only under §M7's preconditions.

**Collision rule.** Both modifiers can apply at once — a wide verify fan-out over correctness-critical items. In **optimize**, keep the *model* high (error cost wins on the tier) and control spend with **fewer, sharper verifiers** at higher effort rather than many cheap ones (H4: diversity beats redundancy). In **full**, both stay at the ceiling and spend is controlled **at the pre-flight, not by the router** — the router has no discretion left to exercise.

The old framing of this paragraph — "the two modifiers pull opposite ways, resolve the tension" — is only half true now, and only in one mode. In `all-out` there is no tension to resolve, because **modifier A does not exist**: every node is already pinned at the ceiling, so B's first rung has no travel and A has nothing to pull against. The collision is an `balanced`-mode problem with an `balanced`-mode answer.

## Mapping to `agent()` opts

Routing decisions become two options on the Workflow `agent()` call — `opts.model` and `opts.effort` (harness policy H8):

```js
agent(prompt, { label: 'verify:concurrency', phase: 'Verify',
                model: 'claude-opus-5', effort: 'max', schema })
```

**In a real template you do not write those literals by hand.** Every `*.workflow.js` that sets `model` or `effort` carries the canonical `ROUTES` block verbatim from `../../loop-engine/references/execution-modes.md` §M8 and resolves each node through `optsFor(node, label)`, which reads `input.mode`, looks up the node's `taskType`, and **omits `model`/`effort` when the route says `null`**. Scripts have no filesystem and no module access (H10), so the block is duplicated by design — and drift between copies is a defect, caught by the `ROUTES` grep in `CONTRIBUTING.md`'s validation block. The literal above is what `optsFor()` produces for a gating node; it is not something a template should hand-write.

**Omit `model` when the route says `inherit`.** In `balanced`, a judgment or verify stage whose target tier equals the session model needs *no* `model` override at all — you just set `effort`. Set `opts.model` only when the router has a clear reason to leave the session tier: routing **down** to Haiku/Sonnet for a cheap or wide stage (modifier A), or pinning the top tier on a node whose wrong answer is inherited by everything after it (a gating verify, the decomposition). In `all-out`, every consumed `agent()` call is pinned — that is the mode's enforcement mechanism, not the noise H8 normally warns about.

## Worked example — routing a 5-task project, all three modes

Project: *migrate 40 services off a deprecated logging library.* **Session model is Opus 5, mode is the default `balanced`** — the `all-out` column prices the same DAG under `--mode all-out`.

| # | Task | Base node kind | `--mode balanced` (default) | `--mode all-out` |
|---|---|---|---|---|
| 1 | Scan each repo, list every call site of the old lib | scout | modifier A: wide fan-out (40 repos), already at the floor → `model:'claude-haiku-4-5'`, `effort` omitted | modifier A suppressed → `model:'claude-opus-5'`, `effort:'high'` |
| 2 | Rewrite each call site to the new API | implement | modifier A: wide fan-out (≈2k sites) → **split bimodally**; trivial sites `model:'claude-haiku-4-5'` (no effort), ambiguous sites `model:'claude-sonnet-5'`, `effort:'high'` | modifier A suppressed, **no split** → `model:'claude-opus-5'`, `effort:'high'` for every site |
| 3 | Decompose the rollout into dependency-safe batches | planner | **pin** `model:'claude-opus-5'`, `effort:'xhigh'` | `model:'claude-opus-5'`, `effort:'max'` |
| 4 | Confirm no service silently drops log lines post-migration | correctness-critical / gating | `model:'claude-opus-5'`, `effort:'max'`, width 3 | `model:'claude-opus-5'`, `effort:'max'`, **width 5** |
| 5 | Regenerate the migration changelog table | doc | `model:'claude-haiku-4-5'`, `effort` omitted | `model:'claude-opus-5'`, `effort:'high'` |

Notes on the routing:

- **Task 3's conclusion changed, not just its model string.** The previous edition let the decompose *inherit* the session model on the grounds that the session was already at the fleet cap. That reasoning is retired: the planner is now **pinned in all three modes**, because every later node inherits its output, so a silent inherit-downgrade corrupts the whole DAG rather than one result. If you are migrating an old plan, this is the row where the *decision* moved — do not just swap the ID.
- **Task 4 is the concrete illustration of "already at ceiling".** It is pinned at `claude-opus-5`, `max` in *both* columns. Modifier B still applies to it — B just has no travel left on rungs 1 and 2, so the only thing all-out mode can add is rung 3, and it does: width goes 3 → 5. That is what a maxed-out node looks like.
- **Tasks 1, 2 and 5 carry an explicit `model` in balanced because they route *down*** from the session tier to protect budget, which is exactly when `opts.model` earns its place. In `all-out` they carry an explicit `model` for the opposite reason — the mode pins everything so the ledger can prove what ran.
- **Task 2's bimodal split exists only in balanced.** It is a modifier-A artifact: the mechanical majority drops to Haiku, the ambiguous minority stays on Sonnet. With modifier A disabled, the split has no reason to exist and disappears — every site runs at ceiling. A full-mode script that still splits its fan-out has copied the wrong column.
- **Nothing here reaches Fable 5**, and the table cannot route to it. Fable is reachable only by an explicit `--planner fable`, and only for task 3.
- **Pricing the full column.** Across the five tasks, all-out mode replaces two Haiku fan-outs and one bimodal Sonnet fan-out with Opus 5, lifts the planner from `xhigh` to `max`, and widens task 4 from 3 lenses to 5 — typically **2.5×–4×** the optimize spend on a DAG shaped like this one, with the multiple driven almost entirely by rows 1, 2 and 5 rather than by the two nodes that were already pinned. That is not a number to guess at: under `--mode all-out` the pre-flight in `../../loop-engine/references/execution-modes.md` §M6 computes it deterministically from the authored DAG, prints it beside the optimize price, and asks one question **before any agent spawns**.

## Fable 5 — opt-in only, via `--planner fable`

Fable 5 (`claude-fable-5`) is reserved for the **single hardest narrow long-horizon reasoning task** in a project — a deep proof-style derivation, a gnarly multi-step planning problem, one the-whole-project-hinges-on-it analysis. It is never the default and never selected by the routing table on its own. **The one sanctioned entry point is the `--planner fable` flag**, which routes only the single decompose/planning node. There is no other supported way to reach Fable 5 from this skill: no task type resolves to it, and no modifier promotes into it.

Weigh the caveats first — they are unchanged, and the flag does not repeal any of them:

- **Latency.** It is markedly slower per call. Never place it on a gate-blocking interactive step where a human or the pipeline is waiting on it — the run stalls.
- **Retention.** Its usage carries a 30-day data-retention consideration distinct from the rest of the fleet; confirm that is acceptable for the data in play before routing anything sensitive to it. Under **zero data retention** every request returns HTTP 400, so the flag is *unavailable*, not merely inadvisable.
- **Refusal risk.** It refuses a broader class of prompts. Do not put it anywhere a refusal silently drops an item — and specifically **never use it for security-audit fan-out**, where a refused finding reads as a clean bill of health.

**Name the conflict at the point of use, rather than quietly dropping the rule.** The first caveat says never place Fable 5 on a gate-blocking interactive step — and **planning is gate-blocking**. The decompose node is the barrier every later node waits on, and in AIDLC it sits directly in front of a human gate. `--planner fable` therefore *overrides a rule this file states*, and it does so knowingly.

The bounding argument, stated plainly: the failure modes that make Fable dangerous in a fan-out are **silent** — a refused security-audit item reads as a clean bill of health. A refused or stalled **planner** fails **loudly**: one node, no DAG, nothing downstream runs, and a human is already standing at the gate. That asymmetry is the entire reason the planner is the one place the override is sanctioned. It bounds the override; it does not repeal the rule, and it does not generalize to any other node.

The preconditions, the verbatim disclosure the skill must print before the planner spawns, and the automatic fallback — on a refusal or on an HTTP 400 from a zero-retention org, fall back to `claude-opus-5` at `max`, `log()` the fallback, and carry it into the cast ledger and the gate report — are specified in `../../loop-engine/references/execution-modes.md` §M7. Do not restate them here; read them there before using the flag.

**There is no latency-budget fallback, by construction.** A script cannot measure elapsed time: H10 bans `Date.now()` and argless `new Date()` precisely so that a run resumes deterministically. Both implementable triggers surface the same way — a refusal and an HTTP 400 each land as `agent()` returning `null` — which is why the fallback is expressible at all. If Fable is slow, the run is slow; the mitigation is the precondition that the caller accepted a minutes-long turn before setting the flag, not a timeout the runtime cannot enforce.

If a task tempts you toward Fable 5 but is *wide* (a fan-out) or *blocking without a human already at the gate*, that temptation is the signal to route it to `claude-opus-5` at `max` effort instead. Fable is a scalpel for one deep cut, not a tier you spread across a phase.
