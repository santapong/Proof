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

## 6. Conduct failures — the catalogue

Every failure below leaves green artifacts behind — that is what makes them conduct failures rather than task failures. §§1–4 define the instruments (the v1 line, the verdict states, the ledger, the human gates); each row is what those instruments show when the conductor has stopped reading them. Mechanics stay where they live: verdict semantics, the repair bound and the ledger's contents are §4's, the v1 line and deferral list are §1's. This section adds only the failure signature, the intervention, and the condition under which the right move is stopping the whole conduct — not repairing the phase.

| Failure — drawback first | Signal in the conductor's artifacts | Intervention | Stop the conduct when |
|---|---|---|---|
| **Gate theater.** A phase gate that has never failed is a ceremony — a gate that cannot fail has a green that means nothing. Every gate must have a stated failable condition. | Verdict history shows PASS at every gate across every phase and round, zero REFUTED anywhere; the plan's gate criteria name no observation that would flunk them. | Write the failable condition for the current gate — the specific observation that fails it — and re-gate against it under §4's verdict states. A gate without one is not a gate yet. | No failable condition can be written for the remaining phases: the v1 bullets were never gate-checkable (§1's rule), so the plan is wrong, not the gate — halt and re-plan. |
| **Scope creep via repair.** Repair rounds that add features instead of fixing verdicts — repair is convergence toward the gate, not a second construction phase. | Repair-round diffs touch files no REFUTED verdict named; new capabilities appear inside a round; §4's bound of two is spent without the refutation set shrinking. | Revert what no refutation demanded; anything worth keeping goes through the deferral list (§1) as an explicit rescope decision at the next human gate. | The second repair round grows the diff again — the phase deliverable was mis-scoped; stop and re-plan the phase rather than repairing it a third way. |
| **The UNVERIFIED pile-up.** An UNVERIFIED verdict is a lens dead on infrastructure — deferred work, not a pass — and it persists only while re-gating goes unpaid; the pile is a debt ledger. | UNVERIFIED entries persist across rounds instead of converting to PASS or REFUTED; the ledger's verify rows sit under the §M6 bands, or widths were silently narrowed (§4 surfaces the `log()`ged caps per H6). | Re-gate every UNVERIFIED before the phase gate closes — §4 already forbids passing them — and restore the mode's verify width where it was shaved: a narrowed width is an H6 silent cap, not a saving. | Re-gating keeps dying on infrastructure: the environment cannot sustain the widths the plan priced. Building the next phase on unverified ones compounds the debt — halt until the environment is fixed. |
| **Ledger blindness.** The cast-and-cost ledger recorded but never read. Mid-project, the ledger is the only instrument showing whether the remaining budget matches the remaining plan. | Gate records carry no actual-vs-estimate line; the §M6 >25% re-price never fires across a multi-phase conduct even as spend rows drift from the estimate. | Read the ledger into every gate record: §4's re-plan and re-price of the next phase, priced from actual spend against the §M6 estimate — and state what that leaves, remaining budget against remaining plan. The mandate is §4's; the failure is skipping it. | The ledger shows the remaining plan is unaffordable at observed burn: descope at the gate or halt — conducting on means spending a budget the plan has already exceeded. |
| **The v1 that grew.** Smallest-shippable scoped at kickoff, then silently re-inflated by every phase's "while we are here". The v1 line moves only by recorded descope and rescope decisions — never by drift. | The feature set at any gate exceeds the v1 line's bullets; deferral-list items reappear in a phase DAG with no gate decision recorded; `RESULTS.md`'s "v1 line as shipped" would not diff clean against §1's line except through recorded gate decisions. | Diff scope against the v1 line at every gate; each addition is either ratified as a recorded rescope or cut back to the deferral list — there is no third state. | The human will not ratify the drifted scope: the project being conducted is no longer the one approved at the first gate. Halt, re-scope per §1, and restart planning from the new line. |
| **The human gate rubber-stamped.** Multi-phase momentum turns approval into a formality, and a formality carries no information. The gate question must require information only the human has. | Gate records that read "approved" with none of §4's required contents — no deliverable inspected, no verdict history, no re-plan or re-price; an entire conduct with zero descopes, deferrals, or re-prices taken at any gate. | Rewrite the gate question so the artifacts cannot answer it: *is this still what you want built?* Put a real decision on the table — a descope option, a deferral to ratify, the ledger's budget line. | The human is absent or delegates the gate back to the conductor. Phase gates are human (H11); a conduct whose gates answer themselves has no authority to proceed — park at the gate until a human holds it. |

The rows share one shape: an unread instrument under a green light. And the repair-vs-stop line is the same in every row — **repair fixes the phase; stopping fixes the project.** Repair while the plan is still the right plan and the instrument disagrees only with the phase's deliverable; stop when the instrument disagrees with the plan itself — its scope, its budget, or its authority. A stop is always taken *at a human gate*, never silently mid-phase: the gate is where the decision to halt gets a decider — which is exactly what H11's one-workflow-per-human-gate exists to protect, keeping the orchestrating session in the loop between phases.
