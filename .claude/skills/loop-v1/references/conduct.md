# Conducting a version one

The conductor's job is to keep four disciplines running at once: the scope stays v1-shaped, the plan stays multiply-framed, every task runs under its owning skill's law, and every gate verdict becomes either a fix or a recorded decision. Lose any one and the project drifts into "a big workflow" — which `loop-engine` already does without this skill.

## 1. Scoping the v1

SemVer's definition is the anchor: 1.0.0 is the release at which the public contract becomes a promise. So the scope question is never "what can we build" but **"what is the smallest contract worth promising"**.

- Write the **v1 line**: ≤10 bullet points of what v1 does. Everything else goes to the deferral list with one reason each ("v2: needs real usage data", "cut: contradicts the v1 line").
- Every bullet must be **gate-checkable** — "users can X" not "good X experience".
- The deferral list is a deliverable, not a graveyard: it seeds the v2 backlog in the final report.
- First human gate: the v1 line + deferrals + the priced plan. Nothing builds before it.

## 2. Planning — multiple planners, one reconcile, then the sweep

A single planner produces a plan that is coherent and incomplete, and both failure modes are invisible from the inside. The counter is structural, per `../../loop-orchestrate/references/coverage-planning.md` (read-only law here):

1. **Three framings, independently**: MVP-first (smallest path to the v1 line), risk-first (what kills the project, addressed earliest), user-first (the walkthrough a first user actually takes). Each runs as its own planner node through `plannerAgent()` — this is where `--planner fable` may land, per §M7.
2. **Reconcile** — a fourth planner node merges the framings into one typed task DAG (`../../loop-orchestrate/references/task-decomposition.md` shapes the nodes). Single-framing items are adjudicated by name, never silently dropped.
3. **Roster sweep** — walk every skill in `../../../docs/design/boundary-audit.json` and write in/out per skill *for this project*. The exclusions carry the information: "no loop-integrate — v1 has no third-party surface" is a decision; "probably not needed" is a forgotten phase.
4. Price it. Per-phase agent counts and token bands from `../../loop-engine/references/execution-modes.md` §M6 — the post-2026-07-27 bands, which assume tool-heavy verifiers.

## 3. Phase conduct — the task obeys its owning skill

Map the DAG onto the framework's phases (AIDLC default) and author **one workflow per gated phase** from `templates/v1-conductor.workflow.js`. The conductor's distinctive move is **delegated law**: each task names its owning skill from the roster, and the task's prompt is authored against that skill's references — read them before authoring, the way `loop-frontend` reads its own motion gates.

| Task smell | Owning skill |
|---|---|
| Component boundaries, API shape, NFR targets | loop-design |
| The mechanism inside one component | loop-algo |
| Production code | the implement route, under the owning domain skill's law |
| UI motion, type, perceived performance | loop-frontend (its WCAG gates are non-negotiable) |
| Findings over written code | loop-review |
| Tests | loop-test |
| Third-party surface | loop-integrate |
| Getting it live + rollback | loop-ship |

A task no skill owns is a decomposition smell: either split it until owners appear, or it is out of scope for v1.

## 4. Gates, repair rounds, and the ledger

- **Sequential gating dispatch.** Same-model verify fan-outs of width ≥ 3 dispatch staggered or sequentially (§M5's dispatch rule, learned from three parallel width-5 bursts dying to API 529 while sequential went 6/6). Lens 0 goes through `fableGateAgent()` so `--fable-gate` can land there.
- **Verdict states are three, not two**: PASS, REFUTED (a lens demonstrated a defect), UNVERIFIED (lenses died on infrastructure). UNVERIFIED is never a pass and never a refutation — re-gate it.
- **Repair rounds are bounded at two.** Fix only what a lens *demonstrated in the files*; taste findings go to the report. Then re-gate — with the round number stamped into the verify prompts, because workflow caching replays verdicts keyed on `(prompt, opts)`: an unchanged prompt re-asserts the pre-fix FAIL against files that no longer exist.
- **The ledger is cumulative** across phases and rounds: cast rows (`node, taskType, mode, model, effort, width`, Fable-lens and fallback markers), spend vs the §M6 estimate per phase, verdict history, and every silently-narrowed thing (`log()`ged caps, dropped items) surfaced per H6.
- Phase gates are human (H11). At each gate: deliverable, verdict history, re-plan and re-price of the next phase. The §M6 pre-flight re-fires when the re-plan grows the approved figures by >25%.

## 5. Release and report

The last phase is `loop-ship`'s: rollout strategy sized to the project (a static site canaries differently than a service), the release checklist, a **tested** rollback path, and the v1 tag. `loop-audit` writes the risk memo the go/no-go reads.

Final report, in the project tree:
- `RESULTS.md` — the v1 line as shipped, per-phase verdicts, the full ledger.
- `FINDINGS.md` — every gate refutation and critic finding, each marked fixed / open / deferred-to-v2.
- The deferral list from §1, now the v2 backlog.
