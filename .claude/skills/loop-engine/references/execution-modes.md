# Execution modes — one dial for the whole fleet

This file governs **which model and how much effort each node gets**. It does not govern **what shape the DAG takes**. Mode is a run-level *routing* dial, not a new orchestration primitive: it moves tiers, effort, verifier width and one loop threshold, and it moves nothing else. Shape stays governed by `harness-policy.md` (H1–H12) and `loop-policy.md` (L1–L8), both of which this file consumes read-only and neither of which it may relax.

There are two modes — **`optimize`**, the default, and **`full`** — plus one orthogonal override, **`--planner opus|fable`**. The invariant the rest of this file elaborates is: **one parser, eighteen skills, zero per-skill branching.** Routing *rationale* — why a task type maps to a tier at all — lives in `../../loop-orchestrate/references/model-routing.md`; the rule for how a script *expresses* a routing decision on an `agent()` call is `harness-policy.md` **H8**.

## The two modes at a glance

| Behavior the dial moves | `--mode optimize` (default) | `--mode full` |
|---|---|---|
| Node routing (§M3) | Per node kind: Haiku 4.5 mechanical, Sonnet 5 implement, inherit for judgment, pinned Opus 5 on gating and planner | Every node kind pinned to `claude-opus-5` |
| Override modifier A — wide fan-out pushes DOWN (§M4) | Active | **Disabled**, and the suppression is logged |
| Override modifier B — error cost pushes UP (§M4) | Active | Active, but already at ceiling on model |
| Verifier width (§M5) | 1 verifier; 3 perspective-diverse when the ask is thorough/audit/comprehensive | Always diverse-lens: **3** for a standard node, **5** for a correctness-critical/gating verify. Two node shapes stay at 1 in both modes — a gating *decision* and a deterministic *measurement* — see §M5 |
| Loop-until-dry threshold K (§M5) | 2 | 3 |
| Pinning discipline (§M3) | Omit and inherit the session model, pin only where the table says pin | Pin `claude-opus-5` on every consumed `agent()` call |
| Pre-flight (§M6) | None | Deterministic estimate + exactly one confirmation, before anything spawns |
| Typical spend vs the optimize baseline | 1× | 2.5×–4× |

A mode is chosen **once per invocation and frozen for that run** — see §M9 on resume.

## M1. What mode does NOT change

`--mode full` is a licence to spend, never a licence to relax an engineering rule. The following are unchanged in both modes, and an implementer who bends one because "we're in full mode" has introduced a defect:

- **H1** — pipeline by default. Full mode does not buy you a barrier.
- **H2** — barriers must be earned by a genuine cross-item reduce. Full mode does not buy you a barrier here either; this is stated twice because it is the rule most likely to be quietly traded for "we can afford it now".
- **H3** — a `schema` on every `agent()` call whose result the script consumes.
- **H5** — `.filter(Boolean)` on every `parallel()` result. A richer model still dies on a terminal error and still resolves to `null`.
- **H7** — `isolation: 'none'` unless agents mutate files concurrently. A richer model does not make worktrees cheaper.
- **H9** — phase discipline: `meta.phases` titles match the `phase()` / `opts.phase` strings exactly.
- **H11** — one workflow per human gate. The full-mode pre-flight (§M6) is an **additional** gate in front of the framework's own; it is never a substitute for one. AIDLC's Inception / Construction / Operation gates still stand.
- **L2, L3, L4, L6, L7, L8** — the budget guard, dedup-against-*seen*, terminal conditions, do-not-loop-over-known-work, judgment-out-of-the-loop-condition, and rounds-vary-agents-don't-remember are all mode-invariant.

The only policy value mode moves is **L1's dry-round threshold K**, and only by the amount stated in §M5. Everything else the dial touches is routing.

If a mode change would fix your workflow's shape, the shape was wrong.

## M2. Flag parsing — one parser, eighteen skills

**Grammar.**

```
--mode <optimize|full>          default: optimize
--planner <opus|fable>          default: opus
```

Both flags are case-insensitive and both accept the `=` form (`--mode=full`, `--planner=fable`). An **absent** `--mode` resolves to `optimize` **silently** — no prompt, no warning, no "did you mean". An **unrecognized** value is never guessed: name the two valid values and ask, exactly as `loop-engine/SKILL.md` already does for an unknown `--framework`. Guessing `--mode fast` means `optimize` is how a user discovers their run was cheapened after they paid for it.

**Only two files parse flags:** `loop-engine/SKILL.md` step 1 and `loop-orchestrate/SKILL.md` step 1. Those two are also the only two that advertise `--planner`, because they are the only two that route a planner node.

**Fourteen domain skills advertise `--mode`** in their `argument-hint` frontmatter and pass their **raw argument string** through when they invoke `loop-engine` — that pass-through *is* the inheritance mechanism, and it is precisely why no domain skill needs mode logic of its own.

**Two skills advertise neither, deliberately.** `loop-design` and `loop-harness` ship no workflow template and never invoke `loop-engine`, so they have nothing to route and no argument string to forward. **A skill that cannot honour a flag must not advertise it** — an `argument-hint` is API surface, and at 1.0.0 an accepted-but-ignored flag freezes as a promise the skill never keeps. If either grows a template later, it gains the flag in the same commit.

**Script-side plumbing.** Resolved values travel to the Workflow tool as **real JSON values** on `args` (`{ mode: 'full', planner: 'opus', … }`), never as a JSON-encoded string. Templates still normalize defensively at the top, because some harnesses deliver `args` as a string:

```js
const input = typeof args === 'string' ? JSON.parse(args) : args
```

That line plus the canonical `ROUTES` block (§M8) is the entire surface where mode reaches executing code.

## M3. The per-node-kind routing table

Model IDs are **bare aliases** — `claude-haiku-4-5`, `claude-sonnet-5`, `claude-opus-5`, `claude-fable-5`. Never date-suffixed. `inherit` in the optimize column means *omit `opts.model`*; a spelled-out ID means *pin it*.

| Node kind | optimize model | optimize effort | full model | full effort | Rationale |
|---|---|---|---|---|---|
| scout / doc / mechanical (enumeration, extraction, formatting, renames) | `claude-haiku-4-5` | omit | `claude-opus-5` | `high` | Optimize: per-item judgment is small and multiplied wide, so budget governs (modifier A, H6) and Haiku is the floor. Full: modifier A is disabled, so the same node runs at ceiling — the row where the two modes diverge most, and where full mode's cost is actually incurred. |
| implement (production edit, drafting, most coding) | `claude-sonnet-5` | `high` | `claude-opus-5` | `high` | Optimize pins Sonnet 5 rather than inheriting, because the session runs Opus 5 and inheriting would route real production volume a tier above what the work needs. Full lifts it: implementation is where a cheapened node ships a defect. |
| analyze / synthesize (judgment over gathered facts, merged artifacts) | inherit | `high` | `claude-opus-5` | `xhigh` | Optimize omits `model` — the node's target tier equals the session model today, which is exactly the case H8's omit-by-default rule is for. Full pins the same model *and* lifts effort, because at the ceiling the only remaining headroom is effort and width. |
| verify / judge / critic (adversarial refute, diverse-lens vote, completeness pass) | inherit | `high` | `claude-opus-5` | `xhigh` | Verification is asymmetric — accepting a wrong result costs far more than the check (modifier B). Optimize inherits and scales effort with the ask; full pins, sets `xhigh`, and widens to 3 diverse lenses (§M5), which is where most of full mode's extra agents come from. |
| correctness-critical / gating (a false "all clear" ships the defect or corrupts every downstream node) | `claude-opus-5` | `max` | `claude-opus-5` | `max` | Identical in both modes — this row is already at the ceiling, which is the concrete meaning of "modifier B has no travel left". Pinned even in optimize so the check does not silently degrade when a session runs below Opus 5. Full mode widens it to 5 lenses; model and effort do not move. |
| planner — the single decompose/planning node | `claude-opus-5` | `xhigh` | `claude-opus-5` | `max` | Pinned in both modes. Every later node inherits this node's output, so a silent inherit-downgrade corrupts the whole DAG rather than one result — the highest-error-cost node in any run (modifier B, H4). |
| planner — with the opt-in `--planner fable` override | `claude-fable-5` | `xhigh` | `claude-fable-5` | `max` | Reachable only by explicit flag, never by the table. Overrides the never-on-a-gate-blocking-step rule knowingly, under the §M7 preconditions, with the caveats printed at the point of use and an automatic fallback to `claude-opus-5` at `max`. |

Two rules govern how the table is written into a script.

**1. Optimize omits, full pins.** Full mode writes `model: 'claude-opus-5'` on **every** consumed `agent()` call, even though that is usually just the session model spelled out. The mode is a *guarantee*, not a default: an inherited model silently voids the guarantee the moment a session runs below Opus 5, and the cast ledger must be able to prove what actually ran. This is the one place the noise H8 normally warns about is the point.

**2. Two node kinds pin even in optimize** — gating and planner — because a silent downgrade there is inherited by everything downstream. Everywhere else in optimize, omit and inherit.

**Haiku rows carry no effort at all.** Haiku 4.5 has no effort dial; the `ROUTES` table records `effort: null` and `optsFor()` omits the key. Writing `effort: 'low'` on a Haiku-routed node is a no-op at best and an error at worst — never do it.

## M4. The override modifiers under each mode

This section and `../../loop-orchestrate/references/model-routing.md` must agree word for word. If they disagree, this file is the source and the other is the defect.

**Modifier A — wide fan-out pushes a tier DOWN.** Active in `optimize`. **Disabled in `full`.**

The honest justification: modifier A exists to protect an **un-negotiated** budget ceiling (H6). In full mode the human has already been shown the bill and said yes at the §M6 pre-flight, so silently cheapening the run behind them is a worse failure than the spend they approved. That is the whole argument — A is not "less useful" in full mode, it is *against the contract*.

Full mode must still `log()` the suppression:

```js
log(`modifier-A: suppressed (mode=full) — ${items.length}-item fan-out running at ceiling by design`)
```

so a reader of the transcript can tell a wide fan-out ran at full tier **by design** and not by oversight.

**Modifier B — high downstream error-cost pushes a tier UP.** Active in both modes, restated as a **three-rung ladder** now that Opus 5 is the ceiling of the default path:

1. **Model** — push the tier up first.
2. **Effort** — then `high` → `xhigh` → `max`.
3. **Verifier width and lens diversity** — then more, and more *different*, checks.

At the ceiling only rungs 2 and 3 have travel. That is exactly what "already at ceiling" means on the gating row of §M3: the model cannot go higher, so error cost is answered with effort and width instead. B is also the only modifier that may reach for `--planner fable`, and only under §M7's preconditions.

**Collision rule.** Both modifiers can apply at once — a wide verify fan-out over correctness-critical items. In **optimize**, keep the *model* high (error cost wins on the tier) and control spend with **fewer, sharper verifiers** at higher effort rather than many cheap ones (H4: diversity beats redundancy). In **full**, both stay at the ceiling and spend is controlled **at the pre-flight, not by the router** — the router has no discretion left to exercise.

## M5. Verification width and the dry threshold

**Width.**

| | `--mode optimize` | `--mode full` |
|---|---|---|
| Standard verify / judge / critic node | 1 verifier for "find any bugs"; 3 perspective-diverse when the ask is thorough / audit / comprehensive (unchanged H4 scaling) | **Always** diverse-lens — **3** |
| Correctness-critical / gating node | 3 perspective-diverse | **5** |

Full mode never runs a single skeptic. That is how the plan's "3–5" band becomes a rule rather than a range.

**Majority-refute kills a finding at ⌈N/2⌉ refutes** — 1 of 1, 2 of 3, 3 of 5. In code that is `Math.ceil(N / 2)`, never a literal `2`, because a literal is silently wrong the moment width becomes 5.

**Lens *sets* are a decomposition decision, not a mode dial.** Mode picks *how many* of a node's declared lenses run; it never invents new ones. A node that declares three lenses and needs five under full mode needs a decomposition change — go and declare two more, deliberately, in the template. The carve-out presupposes a declared set: a node that declares **no** lenses is not exercising this rule, it is pinned at width 1 forever, and citing this paragraph to justify an undeclared set is a defect. If a stage is an adversarial verify, declare its lenses.

**DECIDED — what width applies to.** Width replicates *adversarial checking*, not *deciding* and not *measuring*. It applies to a node whose verdicts are reduced by majority-refute. Two node shapes are therefore **width 1 in both modes**, and a template running one must say so **at the node**, naming which shape it is:

1. **A single gating DECISION node** — one node that consumes already-verified evidence and emits a go/no-go. Replicating it produces N decisions with no defined reduce, and a vote over decisions is a decomposition change, not a mode dial. A gating decision's error cost is answered by the width-5 verify fan-out that *feeds* it, plus the pinned `claude-opus-5` / `max` routing §M3 already guarantees in both modes. So: `taskType: 'gating'` on a **verify** node widens to 5 under full mode; `taskType: 'gating'` on a **decision** node does not. A dead decision node is a no-verdict and must never read as a pass.
2. **A single deterministic measurement** — a node that re-queries a metric, re-runs a check, or reads a system state rather than arguing about one. Three agents asking the same monitoring backend the same question is redundancy, which H4 explicitly ranks below diversity.

Everything else that refutes, rebuts, fact-checks, or tries to break a result is an adversarial verify and takes the width in the table above. **Full mode never runs a single skeptic** is not softened by these two carve-outs; neither of them is a skeptic.

**Dry threshold.** L1's K goes 2 → 3 in full mode:

```js
const DRY_LIMIT = MODE === 'full' ? 3 : 2
```

`MODE` is defined by the canonical `ROUTES` block in §M8 (`const MODE = (input && input.mode) === 'full' ? 'full' : 'optimize'`), and this line is byte-identical to the one there — copy the whole block, never this snippet alone. Do **not** write `input.mode` here: templates normalize with `const input = typeof args === 'string' ? JSON.parse(args) : args`, which yields `undefined` when `args` is absent, and a bare `input.mode` then throws a `TypeError` before a single agent spawns.

`MAX_ROUNDS` stays at its authored backstop (L4) and finder `ANGLES` stay as authored — widening angles is a decomposition change, not a mode change. Every round still `log()`s its dry counter (L5), and **the log line must include the mode** so a transcript is self-describing:

```js
log(`round ${round + 1} [mode=${MODE}] (${angle}): ${found.length} found, ${fresh.length} fresh, dry=${dry}/${DRY_LIMIT}`)
```

## M6. The full-mode pre-flight

**When it fires.** Once per invocation, only under `--mode full`, **in the orchestrating session, after the phase's script is authored and before the Workflow tool is called** — so that no agent has spawned when the human answers. It does not fire in optimize mode at all.

That placement is not incidental; it is the **H10 answer**. A script may not read a clock, may not roll dice, and may not prompt a human. So anything interactive and anything estimated happens at **authoring time**, in the session, and enters the script only as pure literals.

**What it shows — four parts.**

1. **DAG size** — agents per node and the phase total, with fan-outs and verifier widths shown as their multiplicands (`verify-sweep: 5 items × 3 lenses = 15`) so the number is auditable rather than asserted.
2. **Token range** — a low–high band per node kind and a phase total, alongside **the same DAG priced at `--mode optimize`**, so the human sees the delta (typically 2.5×–4×) and not just an absolute.
3. **What full mode changed** — modifier A suppressed, effort floors lifted per node, verifier width 1→3 (5 on gating nodes), loop-until-dry K 2→3, and every node pinned to `claude-opus-5`.
4. **Risks worth naming before spending** — the run concentrates every node on one model's rate-limit bucket, and concurrency is capped at min(16, cores − 2) per workflow (H6), so a wide full-mode phase **queues rather than parallelizes**.

**Estimation method — pure deterministic arithmetic over the authored DAG.** No sampling, no `Date.now()`, no `Math.random()`, no argless `new Date()`. Every input is a literal already present in the authored script.

```
agents = Σ over nodes of items(n) × width(n)

items(n) = n.fanOut                        for a known work-list
         = MAX_ROUNDS × ANGLES.length      for a fanOut: "unknown" discovery loop

width(n) = 1                               for a non-verify node
         = 1                               for a gating DECISION or a deterministic
                                           measurement, in BOTH modes (§M5 carve-outs)
         = 3                               full mode, standard verify/judge/critic
         = 5                               full mode, correctness-critical/gating VERIFY

tokens(n) = agents(n) × BAND[kind][mode] × SIZE[n.size]   summed componentwise (low, high)
```

`BAND` is indexed by both `kind` and `mode`; both columns are tabulated below, and the pre-flight evaluates the whole expression twice — once at `mode = 'full'` for the headline figure and once at `mode = 'optimize'` for the comparison the human is actually shown. Estimating a full-mode run against the optimize band understates it and is the single easiest way to under-price the bill the human is about to approve.

`MAX_ROUNDS` and `ANGLES` are declared `const`s in the script, so a discovery loop's **upper bound** is known even though its actual length is not. **State the result explicitly as a strict upper bound**: a loop that goes dry early comes in under it, and the pre-flight says so.

`BAND` — per-agent **output** tokens, indexed `BAND[kind][mode]` exactly as the formula above indexes it. Both columns are required: the pre-flight prices the same DAG twice, once at `full` for the headline and once at `optimize` for the delta, and a missing column makes the "2.5×–4×" claim unfalsifiable.

| Node kind | `optimize` | `full` |
|---|---|---|
| scout / doc | 2k–6k | 6k–15k |
| implement | 10k–25k | 14k–32k |
| analyze / synthesize | 12k–30k | 20k–48k |
| verify / judge / critic | 6k–18k | 10k–28k |
| gating | 20k–45k | 20k–45k |
| planner | 18k–45k | 24k–56k |
| planner on Fable | 30k–80k | 36k–92k |

Why the two columns differ at all, given that tokens are not billed per mode: full mode pins a richer model and lifts effort, and both produce **longer** output for the same prompt. The lift is per-kind, not a flat multiplier — a `scout` node moving Haiku 4.5 → Opus 5 at `high` roughly 2.5×s its output, while `gating` is **identical in both columns** because §M3's gating row already runs `claude-opus-5` at `max` in optimize; it has no travel left, so its band must not move either. Most of full mode's cost comes from *agent count* — modifier A suppressed and width 1→3 (5 on a gating verify) — not from the band, and a pre-flight that shows a 3× band lift with no width lift has priced something wrong.

Same discipline as `SIZE` below: these are calibration, not physics (see the closing fleet-discipline note), and the `full` column is the thinner-evidence half because far fewer full-mode runs exist to re-baseline from. Re-baseline both columns at every gate.

`SIZE` — per-node multiplier the planner sets on nodes producing large artifacts: `compact` ×0.4, `standard` ×1, `long-form` ×3. This is what makes a six-way authoring fan-out price honestly instead of looking like six scouts.

**Confirmation contract — one question, three answers, before anything spawns.**

> Full mode: N agents across P phases, est. X–Y output tokens (optimize would be A–B). Modifier A disabled · verifier width 3 (5 on gating nodes) · loop-until-dry K=3 · every node pinned to claude-opus-5. Proceed?

- **yes** → author and call the Workflow tool, stamping the approved figures into the script's pure-literal block so the gate can diff approved-vs-actual against `<transcriptDir>/journal.jsonl`:

  ```js
  const ESTIMATE = { agents: 42, tokensLow: 380000, tokensHigh: 720000, mode: 'full' }
  ```

- **no** → nothing spawns, nothing is written, and the session reports what *would* have run. Never a partial start.
- **optimize** → re-author the same DAG at `--mode optimize`, print the cheaper estimate, and proceed **with no second confirmation** — a cheaper run needs no pre-approval.

**Silence is not consent and a timeout is not a yes.** If no answer arrives, the run does not start.

**Re-firing.** The approval covers the whole invocation, not each phase. It re-fires only when a post-gate re-plan raises the approved agent count or token high-end by **more than 25%**, or when a phase's agent count would exceed the repo's ≤15-agents-per-workflow guideline. Each re-ask shows **the delta** against what was previously approved, not the total restated cold.

**Hard rule: no agent spawns before the answer.** Never spawn first and ask later.

**Under `--dry-run` the estimate still prints; the question does not.** The printed script plus the estimate table together are the deliverable, which makes `--mode full --dry-run` the sanctioned way to price a full-mode run before committing to it.

**DECIDED — full mode versus the ≤15-agents-per-workflow guideline: the guideline wins.** A single verify node at width 5 over 5 items is 25 agents on its own. Split the phase into two gated workflows rather than exceed the guideline, and have the pre-flight surface the split as part of its output.

**DECIDED — `--mode full` + `--budget`: the pre-flight refuses to start.** When `--budget` is set and the estimate's **high** end exceeds the ceiling, nothing spawns, and the pre-flight offers exactly three exits: re-run at `--mode optimize`, raise the budget to a stated figure, or narrow the phase's scope. State this plainly wherever it is documented: **this is stricter than H6.** H6 treats the budget as a runtime ceiling that throws mid-run once `budget.spent()` reaches `budget.total`; the pre-flight refuses before the first agent. It is a genuine behavior change to `--budget`, made deliberately, because burning 80% of a ceiling and then dying is exactly the failure a pre-flight exists to prevent.

## M7. `--planner fable` — the opt-in that states its own price

Name the conflict first, because burying it is how a caveat gets lost: **`model-routing.md` says never place Fable 5 on a gate-blocking interactive step, and planning is gate-blocking.** The decompose node is the barrier every later node waits on, and in AIDLC it sits directly in front of a human gate. This flag does not repeal that rule. It makes overriding it **explicit, bounded, and disclosed.**

**Why the planner is the one sanctioned place.** The failure modes that make Fable dangerous in a fan-out are **silent** — a refused security-audit item reads as a clean bill of health. A refused or stalled **planner** fails **loudly**: one node, no DAG, nothing downstream runs, and a human is already standing at the gate. That asymmetry is the entire bounding argument, and it is stated here rather than implied so nobody concludes the caveats stopped applying.

**Four preconditions, all required:**

1. **Single node only** — never a fan-out.
2. **Never inside a loop.**
3. **The caller has accepted the minutes-long turn** — Fable 5 is markedly slower per call.
4. **The org meets the 30-day data-retention requirement.** Under zero data retention every Fable request returns **HTTP 400** — the flag is *unavailable*, not merely inadvisable.

**Mandatory disclosure, printed verbatim at the point of use, before the planner spawns:**

> `--planner fable` routes the decompose node to claude-fable-5. Tradeoffs: markedly higher latency (a minutes-long turn on a gate-blocking node), a broader class of refusals than the rest of the fleet, and a 30-day data-retention requirement — an organization with zero data retention receives an HTTP 400 rather than a degraded result. On a refusal or a 400, this node falls back to claude-opus-5 at max effort and the fallback is logged.

**Automatic fallback — two triggers, both implementable.** On a refusal, or on an **HTTP 400 from a zero-retention org** → fall back to `claude-opus-5` at `max`, `log()` the fallback, and carry it into the cast ledger and the gate report. Both surface identically to a script — `agent()` resolves to `null` — so one `||`-shaped retry covers both, which is exactly how §M8's `plannerAgent()` implements it. The 400 is absorbed exactly as a refusal is; the design does not depend on being able to inspect the org's retention posture ahead of time, at the cost of one wasted round-trip in the ZDR case.

**There is no latency trigger, and this is deliberate.** Latency is disclosed above as a *tradeoff the caller accepts up front* (precondition 3), never as a runtime fallback condition. **H10 forbids a script reading a clock** — no `Date.now()`, no argless `new Date()` — so a script cannot measure elapsed time and therefore cannot detect a latency-budget overrun. A contract that promised fallback-on-slow would be promising behaviour the runtime cannot deliver, and a caller would reasonably rely on it. A run that is merely slow completes slowly; if the caller is unwilling to wait, the remedy is to not pass the flag, not to expect the script to notice.

**Ledger requirement.** A run whose planner was Fable **says so** in its cast row and in its gate deliverable. A reader must never have to guess which model produced the DAG they are being asked to approve. In code that is the `cast · … kind=planner … model=claude-fable-5 · --planner fable` row `plannerAgent()` logs on success, plus the explicit fallback line when it drops to Opus 5.

**How a template implements it.** Not with a local branch: the override lives inside the canonical `ROUTES` block (§M8), so every copy stays byte-identical and the drift check keeps working. `PLANNER` resolves the flag once, `optsFor()` applies it to `taskType: 'planner'` nodes and to nothing else, and a template that declares a planner node dispatches it through `plannerAgent()` instead of `agent()`. A template with no planner node carries `PLANNER` and the `optsFor()` line anyway — they are part of the invariant block — and the flag is simply inert there.

**DECIDED — `--planner fable` is orthogonal to `--mode` and legal in both.** The counter-argument (the most expensive, slowest node inside the cheapest mode is incoherent) is real but loses to the simpler contract: one flag, one meaning, no mode-dependent legality table.

## M8. Mapping mode to `agent()` opts — the canonical `ROUTES` block

```js
// Canonical ROUTES block — single source of truth: loop-engine/references/execution-modes.md §M8.
// Duplicated verbatim into every template that sets model or effort. H10 gives scripts no module
// access, so duplication is intentional; drift is a defect (see scripts/validate.mjs).
const MODE = (input && input.mode) === 'full' ? 'full' : 'optimize'
const PLANNER = (input && input.planner) === 'fable' ? 'claude-fable-5' : null // --planner fable (§M7)
const ROUTES = {
  optimize: {
    scout:      { model: 'claude-haiku-4-5', effort: null },   // Haiku has no effort dial — omit, never 'low'
    doc:        { model: 'claude-haiku-4-5', effort: null },
    implement:  { model: 'claude-sonnet-5',  effort: 'high' },
    analyze:    { model: null,               effort: 'high' }, // null model = omit, inherit session (H8)
    synthesize: { model: null,               effort: 'high' },
    verify:     { model: null,               effort: 'high' },
    judge:      { model: null,               effort: 'high' },
    critic:     { model: null,               effort: 'high' },
    gating:     { model: 'claude-opus-5',    effort: 'max' },  // pinned even in optimize
    planner:    { model: 'claude-opus-5',    effort: 'xhigh' },// pinned even in optimize
  },
  full: {
    scout:      { model: 'claude-opus-5', effort: 'high' },
    doc:        { model: 'claude-opus-5', effort: 'high' },
    implement:  { model: 'claude-opus-5', effort: 'high' },
    analyze:    { model: 'claude-opus-5', effort: 'xhigh' },
    synthesize: { model: 'claude-opus-5', effort: 'xhigh' },
    verify:     { model: 'claude-opus-5', effort: 'xhigh' },
    judge:      { model: 'claude-opus-5', effort: 'xhigh' },
    critic:     { model: 'claude-opus-5', effort: 'xhigh' },
    gating:     { model: 'claude-opus-5', effort: 'max' },
    planner:    { model: 'claude-opus-5', effort: 'max' },
  },
}
const routeFor = (kind) => (ROUTES[MODE] && ROUTES[MODE][kind]) || ROUTES[MODE].analyze
const WIDTH = (kind) => (MODE === 'full' ? (kind === 'gating' ? 5 : 3) : 1)
const DRY_LIMIT = MODE === 'full' ? 3 : 2
function optsFor(node, label) {
  const r = routeFor(node.taskType)
  const opts = { label: label || node.label, phase: node.phase, schema: node.schema }
  if (r.model) opts.model = r.model     // omit → inherit session model (H8)
  if (r.effort) opts.effort = r.effort  // omit → inherit session effort
  if (PLANNER && node.taskType === 'planner') opts.model = PLANNER // §M7 override — planner nodes only
  return opts
}
// §M7 fallback. A Fable refusal and the HTTP 400 a zero-retention org gets on every Fable request
// both surface the same way — agent() resolves to null — so one `||`-shaped retry covers both.
// Planner nodes dispatch through this; nothing else does. There is no latency trigger: H10 forbids
// a script reading a clock, so elapsed time is not measurable in here (§M7).
async function plannerAgent(prompt, node, label) {
  const opts = optsFor(node, label)
  if (!PLANNER) return agent(prompt, opts)
  log('--planner fable routes the decompose node to claude-fable-5. Tradeoffs: markedly higher latency (a minutes-long turn on a gate-blocking node), a broader class of refusals than the rest of the fleet, and a 30-day data-retention requirement — an organization with zero data retention receives an HTTP 400 rather than a degraded result. On a refusal or a 400, this node falls back to claude-opus-5 at max effort and the fallback is logged.')
  const out = await agent(prompt, opts)
  if (out) {
    log(`cast · node=${label || node.label} kind=planner mode=${MODE} model=claude-fable-5 effort=${routeFor('planner').effort} width=1 · --planner fable`)
    return out
  }
  log('planner fallback: claude-fable-5 returned nothing (refusal, or HTTP 400 under zero data retention) → claude-opus-5 at max (§M7)')
  return agent(prompt, Object.assign({}, opts, { model: 'claude-opus-5', effort: 'max' }))
}
```

**Three members are omitted when unused, and nothing else varies.** A template that does not loop omits `DRY_LIMIT`; one with no adversarial verify stage omits `WIDTH` (see §M5 on which node shapes count); one with no `taskType: 'planner'` node omits `plannerAgent`. Say which you dropped, and why, in a comment right below the block — an omission with no note is indistinguishable from drift.

`MODE`, `PLANNER`, `ROUTES`, `routeFor` and `optsFor` — including the `PLANNER` line inside `optsFor` — are the **invariant core** and appear in every copy, whether or not the template declares a planner node. `optsFor` references `PLANNER`, so dropping the const breaks the block; and keeping the override central is precisely what stops eighteen skills from each inventing a local `--planner` branch. **No other local variation is permitted.**

**The duplication is a rule, not an apology.** Scripts have no filesystem and no module access (H10), so this block **cannot** be factored into a shared import. It is duplicated verbatim into every `*.workflow.js` that sets `model` or `effort`, and this file is its single source of truth. Duplication is therefore *correct here*, and **drift is a defect**: a verify lens diffs the blocks byte-for-byte across templates, and `scripts/validate.mjs` fails on any bare `model:` / `effort:` literal outside `ROUTES`. When this block changes, it changes in every copy in the same commit.

**Ledger line format.** Every routed node records what actually ran, so mode is provable after the fact rather than assumed:

```
cast · node=verify-sweep kind=verify mode=full model=claude-opus-5 effort=xhigh width=3 · modifier-A: suppressed
cast · node=inventory    kind=scout  mode=optimize model=claude-haiku-4-5 effort=— width=1
cast · node=synthesize   kind=synthesize mode=optimize model=inherit effort=high width=1
```

`model=inherit` means `opts.model` was omitted; a spelled-out ID means it was pinned. `effort=—` means the key was omitted (a Haiku node). The `modifier-A: suppressed` marker appears on full-mode rows only.

## M9. Back-compat, inheritance, and resume

1. **No flag behaves exactly like v0.4.0, minus the rebaseline.** An unflagged v1.0.0 invocation runs the same DAG, the same barriers, the same loops and the same verifier widths a v0.4.0 invocation would have. The only delta is that judgment nodes now inherit Opus 5 and pinned nodes now name `claude-opus-5`.

2. **v0.4.0 scripts still run.** A persisted script containing a literal `model: 'claude-opus-4-8'` keeps executing — that ID is still an active model. It simply runs a generation behind and carries no mode plumbing, so `--mode full` will not reach it. Migration is a one-line ID substitution plus pasting the `ROUTES` block. Nothing about this is a silent upgrade, and the CHANGELOG says so.

3. **Eighteen skills, no per-skill logic.** The fourteen domain skills that carry a template advertise `--mode` in `argument-hint`, pass their argument string through to `loop-engine`, and author through these templates; `loop-design` and `loop-harness` advertise nothing because they route nothing (§M2). A skill that grows its own mode branch is a defect, not a feature. The one shared edit every skill does take is pasting the identical `ROUTES` block into any template that sets `model` or `effort` — boilerplate from a single source of truth, not per-skill behavior.

4. **Mode is frozen at first author.** A resumed run (`{scriptPath, resumeFromRunId}`) reuses the persisted script and the `args.mode` it was authored against; passing a different `--mode` on resume would desynchronize the script from its arguments. A mode change requires a fresh run and, in full mode, a fresh pre-flight. **Caveat:** this rule is written from how the Workflow tool re-invokes a persisted script, and it has not been verified against the tool's actual resume semantics. Re-verify it before treating a resume-with-different-mode failure as expected behavior rather than a bug.

5. **`input.mode` and `input.planner` are reserved fleet-wide.** Every template that carries the `ROUTES` block reads `input.mode`, and a planner-routed template reads `input.planner`. **A template must never take either name for a local purpose** — a workflow that means something else by `mode` will silently mis-route every node in the run, because `ROUTES[MODE]` falls back to `optimize` for any unrecognized value rather than failing loudly.

   This is not hypothetical: `loop-autopilot/templates/improvement-loop.workflow.js` already used `input.mode` for its own dry/live safety switch and had to rename it to `input.runMode` in this release — a breaking change to an unattended template, forced by a name collision. Pick a qualified name (`runMode`, `execution`, `reviewDepth`) and say so in a comment.

   **Adding a reservation is a fleet-wide contract change.** It belongs here *and* in `CONTRIBUTING.md`'s reserved-argument table, in the same commit. After 1.0.0, renaming a template argument is a breaking change, so a name taken carelessly stays taken.

## Fleet discipline — calibration and edition note

1. **Never hardcode a fleet ceiling.** v0.4.0 asserted "the default fleet caps at Opus 4.8" and then made real advice depend on it — *omit `model` on judgment nodes, because the session is already at the cap*. The claim expired and took the advice with it. The replacement is a **check, not a constant**: read the session model, compare it against the node's target tier, **omit on a match**, and **pin when a silent mismatch would be costly**. A rule shaped like a check cannot rot the way a rule shaped like a fact does. This retirement is a breaking documentation change and is a large part of why this release is 1.0.0.

2. **Model IDs are pinned here as of 2026-07 and are bare aliases** — `claude-haiku-4-5`, `claude-sonnet-5`, `claude-opus-5`, `claude-fable-5` — never date-suffixed. They are updated in lockstep across this file, `../../loop-orchestrate/references/model-routing.md`, and every `ROUTES` block in the plugin. A partial update is a drift defect, not a partial improvement.

3. **The `BAND` and `SIZE` constants in §M6 are calibration, not physics.** They are the only tunable numbers in this file. Re-baseline them from `<transcriptDir>/journal.jsonl` at every gate; when a node's actual spend lands outside its band, update the constant **and** the revision note in the same commit. Because nothing is sampled, the same DAG under the same mode yields byte-identical numbers on every run — which is exactly what makes an approved estimate diffable against actual spend.

Re-check this file roughly **twice a year, or on any fleet change** — whichever comes first.
