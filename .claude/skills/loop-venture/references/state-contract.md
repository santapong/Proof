# The venture state contract

Everything that crosses a node boundary in a venture conduct is one typed state object,
governed by the four clauses of `../../loop-context/references/shared-state.md` — that file
is the law; this one is the venture-specific schema and the two rules the graph adds on
top (the checkpoint fold and the bounded re-plan). Nothing here relaxes the law: nodes
never mutate shared state mid-fan-out; they return typed slices that the conductor folds
at declared joins, where every merge rule is visible in one place.

## The schema

Declared as a comment block at the top of `../templates/venture-band-conductor.workflow.js`
(Clause 1) and normatively here. Writer = the only node whose returned slice may carry the
field; a slice carrying a field it does not own is a contract defect, not extra help.

| Field | Shape | Writer(s) | Merge rule |
|---|---|---|---|
| `pains[]` | `{id, persona, statement, evidence[], severity}` | P1 | append |
| `personas[]` | `{id, name, context, jobs[]}` | P1 | keyed-merge by `id` |
| `vision` | `{statement, objectives[], nonGoals[]}` | P2 | last-write-wins (single writer) |
| `roadmap[]` | `{id, horizon: now\|next\|later, item, rationale}` | P2, P6 (deltas only) | keyed-merge by `id` |
| `positioning` | `{segment, differentiator, competitors[]}` | P3 | last-write-wins |
| `pricing` | `{model, tiers[], assumptions[]}` | P3 | last-write-wins |
| `supportPlan` | `{channels[], slaTargets}` | P3 | last-write-wins |
| `v1Scope` | `{in[], deferred[]}` — loop-build's ten-line rule | P4 | last-write-wins |
| `nfrs[]` | `{name, target, source}` | P4, P5 | keyed-merge by `name`; a target collision is appended to `conflicts[]` for the sweep — the stricter must be *chosen* there, strictness across units is not machine-comparable |
| `deployTarget` | `{platform, costModel, rollout}` | P5 | last-write-wins |
| `constraints.legal[]` | `{jurisdictionOrRule, obligation, source}` | any node | append — losing one is a defect |
| `assumptions[]` | `{id, owner, statement, status: open\|validated\|invalidated, evidence}` | all | keyed-merge by `id`; `status` monotone: open → validated/invalidated, never back |
| `risks[]` | `{id, statement, rating: low\|medium\|high\|critical}` | all | keyed-merge by `id`; rating reduce = the WORST any node gave, never the average |
| `conflicts[]` | `{id, between: [field, field], statement, resolvedBy}` | consistency sweep, gates | append |
| `decisions[]` | `{gate, decision, why, decidedBy, supersedes}` | human gates only | append-only |

Checkpoints are **append-only across phases** (Clause 3): CHECKPOINT-A's object extends
GATE-2's, never rewrites it. A superseded value survives in `decisions[].supersedes`, not
by overwriting history.

## Rule 1 — the checkpoint fold is the only cross-node channel

The parallel band (P3 ∥ P4 ∥ P5) is where "node A adapts to what node B found" happens,
and it happens **only at the fold**:

1. **Round 1** — each band node runs plan → research → discuss and returns its draft
   slice. The nodes share nothing but GATE-2's checkpoint; no node reads another's
   transcript, output file, or partial state. (That would be the implicit blackboard —
   named as an anti-pattern in the law, and non-deterministic under resume.)
2. **CHECKPOINT-A** — the conductor folds the three slices per the merge rules above,
   then one consistency-sweep agent reads the *folded* object and emits `conflicts[]`:
   cross-field incompatibilities no single node could see (pricing assumes self-serve
   but `v1Scope.in` has no billing; `deployTarget.costModel` breaks `pricing.tiers`
   margins; a `constraints.legal[]` entry P5 appended that P3's channel plan violates).
3. **Round 2** — each band node's synthesize → verify steps run with the folded
   checkpoint plus the conflicts addressed to it. This is the adaptation: full knowledge
   of the other nodes' Round-1 findings, delivered as a contract, at a declared point.
4. **CHECKPOINT-B** — the post-Round-2 fold; surviving conflicts go to GATE-3 for the
   human, per Clause 4 (the handoff carries decisions, not tasks).

## Rule 2 — the bounded re-plan

A fold may flip an `assumptions[]` entry to `invalidated` (P4's research shows P2's
milestone infeasible; P5's cost model breaks P3's pricing assumption). Then:

- Re-run **only the owning node's synthesize + verify steps** — never its research; the
  evidence didn't change, the conclusion drawn from it must — with the invalidation in
  the prompt, **at most once per checkpoint**.
- A second invalidation of the same assumption at the same checkpoint, or an invalidation
  the re-run cannot absorb, **escalates to the nearest human gate** with both versions on
  the table. This mirrors loop-build's two-repair-round bound: repair fixes the node;
  the human fixes the plan.
- The P6 → P2 loop-back edge is the same rule at graph scale: P6's roadmap deltas are
  keyed-merged into `roadmap[]` and presented at GATE-4 — they never trigger an
  automatic re-run of P2 inside the same conduct.

## What the transcript is not

The run's journal is evidence for trace invariants, never a channel: no node prompt may
say "see what the GTM node reported earlier in this run". If a downstream node needs
something an upstream node knew, that is a missing field in this schema — fix the
contract, not the prompt (Clause 3's re-derivation rule).
