# Architecture — Proof

Proof supplies reusable engineering methods and source-backed authoring tools.
An agent session selects a skill, does scoped work and returns inspectable
evidence. Small tasks stay inline. A host Workflow is an optional execution
path with capability, scope and authorization requirements.

## Architecture at a glance

![Proof: skill library to agent session to evidence, with shared policy, source-backed MCP advice, reduced packs and optional host Workflow.](../assets/proof-architecture.svg)

[Full-size SVG](../assets/proof-architecture.svg) ·
[PNG alternative](../assets/proof-architecture.png) ·
[Explorable HTML](../assets/proof-architecture.html) ·
[Editable JSON](../assets/proof-architecture.architecture.json)

The HTML is a self-contained local viewer. Its source links pin the inspected
local commit; GitHub resolution requires publication of that commit. Artifact,
browser and visual-check evidence is recorded in the [artwork guide](../assets/README.md).
These are documentation checks, not a successful native host task.

## Follow a task

![Scope a goal, do bounded work, verify evidence and choose the authorized next step.](../assets/proof-workflow.svg)

[PNG alternative](../assets/proof-workflow.png).

1. Name a useful deliverable and constraints. Use `proof-guide` when its owner is
   unclear; otherwise start with the specialist.
2. Load the needed references and work within scope. `proof-orchestrate`
   produces a plan; `proof-engine` authors a Workflow when justified.
3. Execute relevant checks and report what actually happened. A generated test,
   authored script or model opinion is not an executed check.
4. Deliver the artifact, evidence and remaining gaps. Continue within existing
   authorization or stop at a required human gate; publication is a separate action.

## Choose a deeper view

| View | Question | Read |
| --- | --- | --- |
| System context | Who uses Proof and which capabilities belong outside it? | [Context](context.md) |
| Content/runtime map | Which parts are artifacts, processes or generated packages? | [C4-inspired map](container.md) |
| Engine authoring | How are scope, script, pre-flight, routes and results related? | [Authoring flow](component.md) |
| Skill atlas | How do all 26 roles compose without repeating work? | [Skill diagrams](skills.md), [task catalog](../skills.md) |
| Development and execution placement | Which checks run, where can work wait, and what placement is known? | [4+1 views](../views/4plus1.md) |
| Decisions | Which contracts are live and which records are historical? | [Design authority](../design/README.md) |

The overview groups details to answer a first-use question. Detailed views keep
their own scope; the map is not a lossless substitute for the skill instructions.

## Boundaries that matter

| Boundary | Source of truth |
| --- | --- |
| Inline / Workflow | [Engine instructions](../../.claude/skills/proof-engine/SKILL.md); host capability must exist |
| Planning / execution | [Orchestrate](../../.claude/skills/proof-orchestrate/SKILL.md) supplies the handoff; engine owns authorized execution |
| MCP / sandbox | [Five MCP tool contracts](../../mcp/tool-contracts.json) assist authoring; they are not a runtime inside the Workflow |
| Knowledge / portable execution | [Pack descriptor](../../scripts/host-targets.json) carries 22 skills and excludes Workflow scripts/four native roles |
| Advice / authority | [Context advisor](../software-team.md) suggests candidates; it does not change permissions, routes or gates |
| Local checks / acceptance | Source, stub, package, browser, native-host and marketplace checks have different scopes |

## Diagram sources and rendering

| Asset family | Editable source | Rendering |
| --- | --- | --- |
| Overview | [Archify JSON](../assets/proof-architecture.architecture.json) | Validate/deliver HTML; native SVG via `node scripts/render-readme-architecture.mjs` |
| Task workflow | [Native SVG](../assets/proof-workflow.svg) | Edit and check both themes |
| All 18 detailed views | [`diagrams/src/*.mmd`](diagrams/src/) | `node scripts/render-diagrams.mjs` uses pinned Mermaid CLI 11.17.0 and deterministic IDs |
| Banner | [Exact prompt](../assets/proof-banner-v4-prompt.md) | Built-in image generation; selected PNG stored unchanged |

Commit editable source and generated output together. The [identity guide](../identity.md)
keeps visual vocabulary consistent. The [artwork guide](../assets/README.md)
records renderer versions, reproduction, source hashes and verification limits.

## Why the structure looks this way

- **Progressive disclosure:** entrypoints select relevant references instead of
  loading the fleet. Content read during authoring still costs context.
- **Shapes follow data dependencies:** use a barrier for a real cross-item reduce;
  use a bounded loop only for unknown-size discovery.
- **Independent evidence:** keep raw checks, refutations and unknowns separate.
  More model votes do not by themselves prove correctness.
- **One policy home:** shared routing, loop and metric definitions have one
  authority. ROUTES copies are the explicit sandbox exception, checked for drift.
- **Qualified autonomy:** dry proposals are the default. External runners,
  telemetry, locking, oracles and authorization are prerequisites, not boxes
  installed by a diagram.

Historical decisions and research citations remain in the [design records](../design/README.md)
and dated shelves. The [framework review](../reviews/framework-review-2026-10-23.md)
records unresolved gaps and avoids turning a polished picture into a performance claim.
