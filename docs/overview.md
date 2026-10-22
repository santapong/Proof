# Proof — how the parts work together

Proof is a skill framework for developing useful software with a coding agent.
A skill owns an outcome: a plan, a diff, test evidence, a review, a release
checklist or a maintained document. The [26-skill catalog](skills.md) explains
which one to choose and where each stops.

This is the local Proof 4 beta candidate. Follow the matching
[installation guide](../INSTALL.md), [first task](getting-started.md) and
[migration guide](migration-proof-4.md); current source is not evidence of a
published release or a successful installed-host session.

## Start from one useful result

Describe the goal, current state, constraints and observable success. Use
`proof-guide` if the owner is unclear. For an existing defect, review request or
small documentation change, go straight to the relevant specialist. A small
task need not become a project DAG, a new agent team or a whole lifecycle.

A larger brief may need `proof-build` to conduct phases. `proof-orchestrate`
produces the plan; `proof-engine` authors and executes a separately authorized
Workflow. `proof-venture` resolves product/business decisions and produces the
brief rather than implementation. All use the same shared policies.

## Authoring and execution are separate

The session reads a skill entrypoint, selects references and adapts a template
when needed. `proof-mcp` can explain routes, boundaries and standards from source.
The host Workflow tool executes the authored script in its sandbox. A generated
script or source citation is not evidence that execution completed.

- [Harness policy](../.claude/skills/proof-engine/references/harness-policy.md)
  owns shapes, result schemas, isolation and gates.
- [Loop policy](../.claude/skills/proof-engine/references/loop-policy.md) owns
  bounded iteration and convergence.
- [Execution modes](../.claude/skills/proof-engine/references/execution-modes.md)
  owns `lite`, default `balanced`, explicit `all-out`, routing and estimates.
- [Context/state](../.claude/skills/proof-context/SKILL.md) owns information
  crossing the boundaries, versioned facts and scoped trace checks.

ROUTES is intentionally copied into templates because the sandbox cannot import
it. The gate checks byte identity. Policy explanations and metric definitions
do not need the same duplication; link their canonical source instead.

## A result needs the right evidence

A report cites its source and coverage. A changed behavior needs an exercised
check where available. Generated tests remain unverified until executed. A
benchmark needs raw observations and an independent comparison. Missing evidence
stays unknown; it does not become a pass, zero usage or proof of improvement.

[Delivery measurements](../.claude/skills/proof-ship/references/dora.md) use actual
production deployment and incident records. Proposal activity, merge counts and
local gate results are different measurements. None establishes skill quality
or token savings on its own.

## Autonomy is conditional

The [autonomy ladder](../.claude/skills/proof-autopilot/references/deployment.md)
is the definitional source for OBSERVE, VERIFY, SUSTAIN and SCALE. The baseline
maintenance path is dry/propose-only. Operational runners, telemetry, locking,
held-out oracles and human authority are prerequisites; a checked-in template
does not install them or prove unattended safety. SCALE remains a gated design.

A review or documentation request does not enable scheduling, external messages,
remote PRs, credentials, deployment, merging or publication. Apply the actual
user scope and host capabilities at the action boundary.

## Read further

[Documentation index](README.md) · [Team workflow](software-team.md) ·
[C4 architecture](c4/README.md) · [4+1 views](views/4plus1.md) ·
[Branch policy](branch-policy.md) · [Current review](reviews/framework-review-2026-10-23.md).
