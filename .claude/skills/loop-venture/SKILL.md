---
name: loop-venture
description: "Conduct a venture idea through the whole product lifecycle as verified decision documents — evidenced discovery, a falsifiable vision and roadmap with a kill/pivot/proceed gate, then go-to-market, build plan and deploy plan as a parallel band synchronized only at checkpoint folds, then an operate-and-improve plan that seeds the next horizon. Use when the user has a product or service idea and asks what to build and why, whether anyone would pay, how to price, position, market or support it, or wants the full pre-engineering lifecycle managed end to end. Produces documents and gated decisions, never code: the build-plan phase ends with a loop-build-ready brief. For conducting an approved brief to a shipped v1, use loop-build. For planning a task DAG for agent work, use loop-orchestrate. For answering one cited question, use loop-research. For a build-vs-buy verdict on one capability, use loop-scout. For routing an unnamed situation, use loop-guide."
argument-hint: <venture-idea> [--mode <lite|balanced|all-out>] [--dry-run]
---

# loop-venture

**The deliverable is a set of verified decision documents across the whole venture — discovery, vision and roadmap, go-to-market, build brief, deploy plan, operate plan — plus the gate decisions that ratified them. Never code.** That is the discriminator; when the request is really something else, route it:

| The request is really… | Skill | The test |
|---|---|---|
| Build an already-decided product to a shipped v1 | `loop-build` | A brief exists (or the product decisions are made) — this skill *produces* that brief; phase 4 here ends where loop-build begins |
| A task DAG with model routing for agent work | `loop-orchestrate` | The decomposition wanted is of *work into agent tasks*, not of a venture into lifecycle decisions |
| One cited question, no lifecycle attached | `loop-research` | The answer is a report, not a gated decision — venture nodes delegate their evidence gathering there |
| A reuse/adapt/build verdict on one named capability | `loop-scout` | One capability, one verdict — not the venture's whole shape |
| The user cannot name the deliverable at all | `loop-guide` | Route first; venture conduct starts once the ask is a product or service idea |

This skill is a **conductor, not a new engine**: every phase runs as `loop-engine` workflows under the unchanged harness, loop and mode policies, on the `frameworks/VENTURE.md` lifecycle (the `loop-engine` framework this skill installs). What it adds is the venture spine — the phase graph with its human gates, the typed state contract that is the only channel between parallel nodes, the five-step node loop, and the cite-or-own evidence rule.

## Execution flow

### 1. Parse the idea

- **venture-idea** — everything that is not a flag. If empty, ask what the venture is and for whom.
- **`--mode` / `--dry-run`** — advertised here; parsed by `loop-engine`. Pass the **raw argument string** through untouched (this skill parses nothing; `loop-engine` and `loop-orchestrate` are the only two parsers). **This skill's default mode is `all-out`** — the inversion of the plugin's lean default is deliberate and stated: venture decisions are cheap to research and ruinous to get wrong, so verification runs at ceiling unless the user narrows it. Say so, and show the §M6 price, before the first phase spawns.
- `--dry-run` ends after the graph is priced: the phase plan, the node casts, and the estimate.

### 2. Conduct the graph — one workflow per human gate

Per `references/lifecycle.md` §1–§2. Sequential head (P1 Discovery → GATE-1 → P2 Vision & Roadmap → GATE-2), then the parallel band (P3 GTM ∥ P4 Build Plan ∥ P5 Deploy Plan) as **one** workflow ending at GATE-3, then P6 Operate & Improve → GATE-4. Single nodes run `templates/venture-node.workflow.js`; the band runs `templates/venture-band-conductor.workflow.js`. The conductor works inline between workflows — gating, folding decisions into `venture/DECISIONS.md`, re-pricing — which is judgment, not fan-out (H11 keeps every gate in this session).

Non-negotiables, in force at every phase:

1. **Documents and decisions are the deliverable — never code.** A phase that starts implementing has left this skill's boundary; hand it to `loop-build`.
2. **Every phase ends at its named human gate** (`references/lifecycle.md` §2). GATE-2 is kill/pivot/proceed with all three priced — a venture conduct that cannot be killed there is gate theater, and a kill memo is a success of the method.
3. **State crosses nodes only at checkpoint folds** under `references/state-contract.md`. No mid-band peeking, no transcript-as-channel: adaptation between parallel nodes happens at CHECKPOINT-A/B or it is not deterministic under resume.
4. **Cite or own**: every quantitative claim in every document carries a citation to a graded source or an `assumptions[]` entry with an owner and a validation path. There is no third state; the verify step refutes it.
5. **The re-plan is bounded**: one owner re-synthesis per invalidated assumption per checkpoint, then the human gate decides (`references/state-contract.md` Rule 2).
6. **P4's output must be a valid `loop-build` brief** — the ≤10-bullet gate-checkable v1 line with reasoned deferrals, NFR targets as numbers, the architecture sketch.
7. **Delegated law**: each node's prompts are authored against the owning skill's references per `references/lifecycle.md` §4 — discovery evidence under `loop-research`'s law, the build plan under `loop-design`'s and `loop-build` §1's, the deploy plan under `loop-ship`'s, the operate plan under `loop-operate`'s. What no skill owns — discovery elicitation, vision/roadmap, go-to-market — takes its law from this skill's playbooks.

### 3. Report

Documents land in the target project under `venture/`: `01-discovery.md`, `02-vision-roadmap.md`, `03-go-to-market.md`, `04-build-brief.md`, `05-deploy-plan.md`, `06-operate-improve.md`, plus `DECISIONS.md` (append-only gate records: who decided, what, why, supersedes) and `RESULTS.md` — the ledger: per-node cast rows, refute-round history, the assumption status table (open/validated/invalidated), conflicts found and resolved at each fold, actual-vs-estimate spend per phase.

## Orchestration

Single-node phases are one `templates/venture-node.workflow.js` invocation each; the band is one `templates/venture-band-conductor.workflow.js` invocation realizing Round 1 (blind) → Fold A + consistency sweep → Round 2 (folded state + addressed conflicts) → Fold B, per `references/state-contract.md` Rule 1. Under `--mode all-out` the §M6 pre-flight prices each phase before anything spawns.

## Reference files

| File | What it holds |
|---|---|
| `references/lifecycle.md` | The phase graph, the four gates and what the human decides at each, the five-step node loop, the delegation map, the legal lens and cite-or-own rule; plus the venture-conduct failure catalogue (§6) — the unkillable venture, research theater, the consensus panel, assumption laundering, the band that would not fold, horizon creep |
| `references/state-contract.md` | The typed venture state schema with per-field merge rules, the checkpoint-fold rule (the only cross-node channel), and the bounded re-plan — instantiating `loop-context`'s shared-state law (see its `references/shared-state.md`) |
| `references/discovery.md` | P1 playbook: personas as context-plus-job, disjoint research mandates, the severity argument; plus the discovery-failure catalogue |
| `references/vision-roadmap.md` | P2 playbook: the falsifiable vision, now/next/later horizons, the riskiest assumption and written kill/pivot criteria; plus the vision-failure catalogue |
| `references/go-to-market.md` | P3 playbook: positioning before pricing before channels, the legal lens, support as a cost of the pricing model; plus the GTM-failure catalogue |
| `references/standards.md` | The graded shelf — JTBD, continuous discovery, lean validation, positioning and pricing canon — with the confirmation log |
| `templates/venture-node.workflow.js` | One venture node (P1, P2, P6): plan → mandated research → perspective panel → synthesize → refute-verify, ≤2 rounds; carries the canonical ROUTES block verbatim |
| `templates/venture-band-conductor.workflow.js` | The parallel band (P3∥P4∥P5): blind Round 1, the CHECKPOINT-A fold with merge rules and consistency sweep, Round 2 under addressed conflicts, the bounded re-plan, the GATE-3 handoff; carries the canonical ROUTES block verbatim |

The lifecycle skeleton this skill installs for `loop-engine` lives at `../loop-engine/frameworks/VENTURE.md`.
