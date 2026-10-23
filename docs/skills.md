# Choose a Proof skill by its result

Reviewed 23 October 2026 against all 26 source entrypoints and the live
[boundary matrix](design/boundary-audit.json). This catalog is a reader's map;
the entrypoint and shared policies own the detailed instructions. Source review
and local template checks are distinct from a real agent completing the task.

For the candidate plugin, invoke `/proof:proof-<role>`. Project/personal copies
use `/proof-<role>`; reduced Codex packs use `$proof-<role>`. Read
[installation](../INSTALL.md) and [your first task](getting-started.md) first.
No old skill-name aliases are installed.

## Every skill at a glance

| Skill / source | Bring it | Expect | Boundary / handoff |
| --- | --- | --- | --- |
| [proof-guide](../.claude/skills/proof-guide/SKILL.md) | A situation with no clear deliverable | A justified owner or short skill chain | Routes work; does not perform the specialist job |
| [proof-venture](../.claude/skills/proof-venture/SKILL.md) | An idea with unresolved product/business decisions | Evidence-backed decision documents and a build brief | No implementation; approved brief goes to build |
| [proof-scout](../.claude/skills/proof-scout/SKILL.md) | An open reuse/adopt/build decision | A recommendation, trade-offs and runner-up | Research gathers evidence; integrate wires the chosen provider |
| [proof-research](../.claude/skills/proof-research/SKILL.md) | A question answerable from existing sources | A cited answer with disagreement and gaps | A new empirical result belongs to experiment |
| [proof-comprehend](../.claude/skills/proof-comprehend/SKILL.md) | Existing unfamiliar code | A source-anchored map, trace or recovered rationale | Design makes new decisions; docs maintains the resulting guide |
| [proof-design](../.claude/skills/proof-design/SKILL.md) | Requirements and system constraints | Architecture, contracts, targets and decision records | Algo selects an internal mechanism; ship owns rollout execution |
| [proof-algo](../.claude/skills/proof-algo/SKILL.md) | A component mechanism or performance question | A bound, invariant or measured comparison | Debug diagnoses a regression; test owns suite files |
| [proof-frontend](../.claude/skills/proof-frontend/SKILL.md) | An interface that renders but needs motion/type polish | A bounded craft change and runtime-check specification | Design owns rendering architecture; this is not a full WCAG audit |
| [proof-pattern](../.claude/skills/proof-pattern/SKILL.md) | Working code with a structural smell | A behavior-preserving refactor and check evidence | Review reports defects; algo owns mechanism/performance claims |
| [proof-context](../.claude/skills/proof-context/SKILL.md) | Agent context, state or stale-information trouble | A context/state contract and scoped trace checks | Harness configures permissions/tools; a trace scan cannot prove hidden influence |
| [proof-orchestrate](../.claude/skills/proof-orchestrate/SKILL.md) | A named multi-phase job needing a plan | Typed task DAG, estimated ledger and authored handoff | Planning alone does not execute the project; engine owns execution |
| [proof-engine](../.claude/skills/proof-engine/SKILL.md) | A scoped, authorized workflow | An authored run and its evidence | Requires the actual host Workflow capability; no product brief conduction |
| [proof-build](../.claude/skills/proof-build/SKILL.md) | An agreed software brief to conduct end to end | Working v1, phase evidence and delivery checklist | Release actions stay within authorization; plan-only work goes to orchestrate |
| [proof-debug](../.claude/skills/proof-debug/SKILL.md) | An observed defect and reproducible trigger | Diagnosis, minimal fix and regression evidence | Incident restores live user impact first |
| [proof-test](../.claude/skills/proof-test/SKILL.md) | A behavior contract or regression to lock in | Tests in the existing stack and actual execution results | The generator alone leaves files unverified; algo owns benchmark methodology |
| [proof-review](../.claude/skills/proof-review/SKILL.md) | A pinned diff or explicit repository scope | Supported security/quality findings without edits | Audit assesses impact/risk; remediation is a separate requested change |
| [proof-audit](../.claude/skills/proof-audit/SKILL.md) | A pinned change set | Classification, blast radius, coverage and risk memo | Consumes review findings instead of running a second defect hunt |
| [proof-experiment](../.claude/skills/proof-experiment/SKILL.md) | A hypothesis requiring generated evidence | Harness, raw artifacts, re-derived results and study report | Research answers from sources; passing a local gate is not comparative benefit |
| [proof-integrate](../.claude/skills/proof-integrate/SKILL.md) | A chosen external provider and its contract | Adapter/auth/webhook/resilience work and readiness evidence | Test authors suite files; ship supplies rollout mechanics; sandbox is not production rollback |
| [proof-ship](../.claude/skills/proof-ship/SKILL.md) | An existing change to deliver | Rollout/readiness/rollback plan and authorized delivery evidence | Operate owns steady state; incident owns declared live impact |
| [proof-operate](../.claude/skills/proof-operate/SKILL.md) | A live service and telemetry/runbook inputs | SLIs, alerts, runbooks and scoped operational evidence | External runner, locks and ground truth are required; incident policy takes precedence |
| [proof-incident](../.claude/skills/proof-incident/SKILL.md) | A declared or escalating user-impacting failure | Mitigation evidence, timeline, reproduction and postmortem | Debug diagnoses after stabilization; ship delivers the correction |
| [proof-docs](../.claude/skills/proof-docs/SKILL.md) | A reader task and source of truth | Maintained reference, guide, tutorial or explanation | Operate owns executable runbooks; incident owns postmortem facts |
| [proof-harness](../.claude/skills/proof-harness/SKILL.md) | A project's Claude configuration needs | Reviewed settings, hooks and MCP/automation scaffolds | Configuration is not a security sandbox or proof of host enforcement |
| [proof-skill](../.claude/skills/proof-skill/SKILL.md) | A justified missing capability or skill defect | A bounded skill source and validation evidence | Do not create a new skill for a job a reference already covers |
| [proof-autopilot](../.claude/skills/proof-autopilot/SKILL.md) | Authorized repository-maintenance scope | Local proposals by default; remote proposals only when authorized | Propose-only baseline; monitoring a live service belongs to operate |

## Keep adjacent jobs separate without repeating the work

| Ambiguous request | Checkable split |
| --- | --- |
| “Help me build a small stock tracker” | Guide if the deliverable is unclear; venture for unresolved product decisions; build for an agreed implementation brief. Do not force every layer. |
| “Research, design and review this integration” | Research supplies cited evidence; design/integrate supplies the agreed artifact; review inspects that artifact. Carry the source packet forward instead of repeating the search. |
| “Clean this up and make it faster” | Pattern owns structure; algo owns the mechanism/performance result. Both can keep the same correctness tests passing. |
| “Check this PR” | Review for defects, audit for impact/risk. If both are requested, the audit cites the review rather than repeating it. |
| “Production is unhealthy” | Honor declaration policy first. A permitted runbook may handle an undeclared known condition; incident coordinates declared or escalating impact. |

A handoff carries the input revision, artifact, actual checks, unresolved facts
and authorized next action. A skill handoff does not require a new agent or an
extra approval when the user already authorized that work. Host/user limits
still apply to workflow size and execution.

## Host and evidence limits

The full source targets Claude Code. Reduced packs contain 22 knowledge skills;
`proof-engine`, `proof-harness`, `proof-skill` and `proof-autopilot` are held back
as native skills. Carried appendices are not extra discoverable skills. Workflow
templates are excluded from reduced packs, which describe a sequential path.

Local smoke checks exercise templates under stubs. They do not establish native
model discovery, end-to-end completion, usefulness to newcomers, better quality
or token savings for all 26 skills. Remaining gaps and corrected duplication are
recorded in the [framework review](reviews/framework-review-2026-10-23.md).
