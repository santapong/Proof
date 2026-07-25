# Deployment & Delivery — the design-time decision

Only one part of delivery is architecture, and it is the distinction between **deploy** (new code is running in production, taking little or no user traffic — a technical event) and **release** (that code is exposed to users — a business event). A system that must ship dark needs feature-flag infrastructure and backward-compatible schema evolution designed in from the start, because neither can be retrofitted onto a service that assumes one version of the code and one shape of the data at a time. That is the design-time constraint, and it is the only part of delivery that changes a box on the diagram.

At **step 6**, pick the coarse delivery shape and record it as an ADR via `../templates/adr-template.md`. The ADR names the strategy, the risk that justified escalating past rolling, and the rollback path committed to. That is the whole of this step's output — the machinery that executes the decision belongs to the `loop-ship` skill, which owns everything from deploy start to bake complete.

## Where the execution machinery lives

Everything below moved to `loop-ship` in v1.0.0. Follow the pointer rather than re-deriving it here; two copies of a rollout procedure is how they drift.

| What you are looking for | Now lives in |
|---|---|
| Rolling / blue-green / canary mechanics, failure modes, the recreate baseline, the **Risk → strategy table**, feature-flag kinds and hygiene, IaC, environment topology, exemplars | `../../loop-ship/references/rollout-strategies.md` |
| Expand-contract (parallel change) migrations and their release sequencing | `../../loop-ship/references/migrations.md` |
| DORA metrics — the four keys and per-release instrumentation | `../../loop-ship/references/dora.md` |
| CI/CD pipeline gates, the pre-deploy checklist and go/no-go, SLO-gated promotion | `../../loop-ship/references/release-gates.md` |
| Rollback drills and the rollback-vs-roll-forward decision | `../../loop-ship/references/rollback-playbook.md` |

SLO and error-budget **targets** are step 7's job — see `nfr.md`.
