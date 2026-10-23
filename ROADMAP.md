# Proof roadmap

Updated 23 October 2026. This is a plan, not completed delivery. Released changes
are in CHANGELOG.md; this branch is a Proof 4 beta candidate. Public main is v3.0.0.

## Product direction

Proof is a skill framework people can use with a coding agent to build useful,
well-checked software. Accept a plain-language goal, constraints and success
criteria, then expose a bounded result with evidence. A newcomer should not
need to understand internal orchestration before starting.

Start with developers and people bringing a small software idea to a compatible
coding agent. Broader use is a direction to test, not evidence of support for
every person, host or non-software task.

## Near-term release work

| Outcome | Current state | Required evidence |
| --- | --- | --- |
| Proof-only public names | Implemented in this candidate; no aliases | Directory/frontmatter/reference checks, old-name rejection and explicit migration |
| Understandable first task | Candidate guide, prompts and intentional-defect walkthrough | Native installed-host run and actual user feedback remain separate |
| Portable knowledge packs | Three generated packs; Codex paths/frontmatter updated | Determinism and references; qualify discovery/MCP in each claimed host |
| Agensi first listing | Invitation read; submission/approval not observed | A focused standalone offer, verified carried dependencies/archive and installed-host example, then recorded listing outcome |
| Release candidate | Local beta metadata and review branch | Relevant gates, reviewed diff and the requested publication scope |

Agensi outreach invites individual skills; it does not establish approval,
compatibility, demand, commercial terms or payout settlement. The full framework
and an independently usable skill are different offers. Do not represent a full
plugin archive as a standalone skill without checking its dependencies/behavior.

## Framework-wide review follow-up

The [23 October framework review](docs/reviews/framework-review-2026-10-23.md)
records each skill, corrected duplication and the remaining gaps. The source
catalog is complete; native task quality is not established for all 26 skills.

| Priority | Next outcome | Acceptance evidence |
| --- | --- | --- |
| Launch | One selected skill works in the claimed installed host and upload package | Actual bounded task, carried dependencies, artifact identity and observed outcome |
| Product | Full accessibility/UX coverage has a clearly scoped owner | Capability charter and representative checks before adding another skill |
| Runtime | Operations/automation scaffolds have an actual target runner, locking and telemetry | Dry-run/live-service qualification within authorized scope |
| Evaluation | Quality and resource claims use real comparative tasks | Independent correctness, repeats, actual usage/cache/retry records and honest uncertainty |
| Maintenance | External pins are rechecked when used | Primary source, date, affected shelf and unresolved fields |

These are proposed follow-ups, not newly implemented systems or automatic work.

## Follow-up directions

| Direction | Small next result | Boundary |
| --- | --- | --- |
| Loop Engineering | One plan → implement → test → review iteration | A named process is not a measured improvement |
| Graph Engineering | One dependency/state/artifact graph compared with a bounded loop | No runtime or parallel-execution claim before execution |
| Reusable knowledge | One source/version-scoped entry reused later | Stored text/provenance alone does not prove usefulness |
| Controlled improvement | A versioned proposal compared with a fixed baseline and unseen cases | Adoption decision, rollback and full cost; no automatic promotion |
| Business validation | Target user, problem, offer value, support assumptions and a bounded demand check | Visits, invitation and stars are not customer-value evidence |

These directions need not block a small, truthful first listing. Select one
observed gap and acceptance condition before expanding scope.

## Host and technology status

Claude Code is the full source target. Current documentation describes dynamic
workflows; actual availability, permissions and installed execution still need
checking. Other packs exclude that executor. Package tests are not host acceptance.

The source checks are in [the launch review](docs/reviews/developer-launch-2026-10-23.md).
Routing pins and supported MCP versions are not upgraded merely to the newest
name/date; adopt new behavior with the relevant tests.

The earlier H0–H5 plan remains in Git and the
[packaging ADR](docs/design/ADR-0008-host-packaging-seam.md). Its old counts,
identifiers and discovery dates are historical, not current support claims.
