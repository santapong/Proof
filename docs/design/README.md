# Design records and current authority

The source fleet contains 26 skills. This guide separates live contracts from
records of earlier decisions; a dated plan or ADR does not prove present runtime
behavior. See the [skill catalog](../skills.md) and
[framework review](../reviews/framework-review-2026-10-23.md).

## Live contracts

| Source | Owns | Maintenance rule |
| --- | --- | --- |
| [boundary-audit.json](boundary-audit.json) | The 26-row matrix, 45 recorded pair overlaps and approved descriptions | Change a description and its approved record together; check the affected neighbors |
| [Engine execution modes](../../.claude/skills/proof-engine/references/execution-modes.md) | Current modes, routing, widths, estimates and ROUTES | Outranks the earlier execution-mode specification |
| [Harness policy](../../.claude/skills/proof-engine/references/harness-policy.md) and [loop policy](../../.claude/skills/proof-engine/references/loop-policy.md) | Shared execution and iteration rules | Link these rules rather than creating a second procedure |
| [MCP contracts](../../mcp/tool-contracts.json) | Authoring-time tools and their wire shapes | Source extraction/transport checks are separate from native host acceptance |

Boundary-audit narrative risks include pre-migration observations. They explain
why a split was introduced; they are not all current unresolved defects. The
current review checks the actual sources. A whole-project planning request stops
at `proof-orchestrate`'s plan unless execution is also authorized. Tests passing
unchanged do not alone separate refactoring from an optimization.

Descriptions help discovery; explicit invocation, user context and host metadata
budgets also affect selection. Shortlisting is not proof of correct dispatch.
Broad requests can need several ordered deliverables without making their
specialists duplicates.

## Accepted decision records

ADRs remain as written at the decision date, including historical names and pins.
Use their current implementation and live contracts when applying the decision.

| Record | Decision |
| --- | --- |
| [ADR-0001](../../mcp/ADR-0001-runtime-and-dependency.md) | Zero-dependency runtime and test-time SDK gate |
| [ADR-0002](ADR-0002-dependency-seam-and-boot-contract.md) | Dependency seam and boot contract |
| [ADR-0003](ADR-0003-tool-contracts-and-call-sites.md) | MCP tools and call sites |
| [ADR-0004](ADR-0004-extraction-strategy-and-failure-semantics.md) | Routing extraction and failure semantics |
| [ADR-0005](ADR-0005-correctness-invariant-no-silent-default.md) | No silent default |
| [ADR-0006](ADR-0006-width-shape-band-coverage-and-flag-selected-rows.md) | Verifier width and coverage |
| [ADR-0007](ADR-0007-boundary-lookup-matching-and-speech-act.md) | Boundary matching and speech act |
| [ADR-0008](ADR-0008-host-packaging-seam.md) | Generated host packs and declared degradation |
| [ADR-0011](ADR-0011-software-context-advisor.md) | Local context advisor; optional ML remains experimental |

Numbers 0009 and 0010 are not accepted files in this checkout. References to
prospective orchestrator/discovery decisions in older plans do not imply those
ADRs or a portable runtime were delivered.

## Informative and historical sources

- [execution-mode-spec.json](execution-mode-spec.json) is the earlier design
  specification, superseded at use by the engine reference.
- [Host discovery](host-tier-c-discovery.md) is an August secondary-source
  snapshot, not current installed-host support evidence.
- [Engineering terms](agent-engineering-terms.md) records source grading and
  method choices. Recheck its external claims before making them load-bearing.
- Frozen studies and reports under `docs/examples/` preserve their original
  inputs/results. They cannot be refreshed by replacing old hashes.

## Review a boundary change

Name the requested output and its nearest alternatives. Read both entrypoints,
the affected matrix rows and pair resolution. Check that each side hands over
an artifact rather than repeating the other's job. Keep intentional sandbox
ROUTES copies; consolidate ordinary definitions and policy procedures at one
home. Mechanical validation supports this review but cannot certify meaning,
source currency or model behavior.
