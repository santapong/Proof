# Proof framework review — every skill, documentation, gaps and overlap

Reviewed 23 October 2026. Baseline `0b49797f9d748f17160daa4593cdcc7fb024e4da`
on local `feat/proof-onboarding-review`. This follows the earlier naming review;
it does not rewrite that review's receipts. The candidate uses 26 `proof-*`
skills, without old skill-name aliases. No release, installation or external
account change is part of this review.

## Verdict and coverage

Proof has broad engineering coverage with useful boundaries. Retain the 26
skills for this candidate: the review did not establish a pair with an identical
primary output that requires a merge. It did find duplicate procedures and weak
discriminators that could cause repeated work or a wrong handoff. Those were
corrected in the active instructions rather than adding more skills.

The [complete catalog](../skills.md) gives an input, expected output and boundary
for every skill, linked to its source. All 26 entrypoints and all 39 baseline recorded
pair overlaps were inspected. Six missing pair records were added for venture/build,
build/orchestrate and experiment versus research/algo/debug/docs; the current
registry has 45 overlaps. The baseline contained 217 Markdown files;
198 were active guidance under the review's classification. All tracked
Markdown, contracts and documentation assets were inventoried. Active Markdown
received path/claim-risk scans; implicated references received targeted semantic
review. This is not a line-by-line certification of every specialist reference
or a fresh verification of every external edition.

The [per-file inventory](documentation-inventory-2026-10-23.json) records which
files changed, remained applicable, or are historical. Its review-depth field
makes that distinction explicit. A file retained after a path scan is not
reported as a successfully executed method.

## Corrections applied

| Finding | Source evidence | Correction |
| --- | --- | --- |
| Newer skill pairs lacked explicit overlap records | Experiment and venture/build boundaries were present in entrypoints but absent from the 39-pair registry | Register six source-grounded pair resolutions; retained descriptions and distinct deliverables. |
| Planning claimed “plan only” but repeated the engine's execution/pre-flight procedure | `proof-orchestrate/SKILL.md` steps 9–10 versus the matrix; `model-routing.md` copied route tables/modifiers | Planning stops at its DAG, estimate and handoff. Authorized execution and its approval/result procedure stay in engine. Rationale now links the canonical table. |
| Proposal activity was mislabeled as DORA delivery outcomes; old four-key/pilot framing drifted | `proof-autopilot/references/standards.md`, the ship DORA reference and three other shelves | One definition/collection home in `proof-ship/references/dora.md`; separate proposal-process measures. No shipped collector is claimed. |
| Test workflow prose promised a run stage the template does not implement | `proof-test/SKILL.md` versus `templates/test-generation.workflow.js`, which returns `verifyNext` | Describe design → write accurately; require post-generation execution before claiming verified tests. Unavailable execution stays unverified. |
| “A new manifest line” was an over-narrow scout discriminator | Scout's boundary versus its standard-library/internal-reuse search order | Select on an open reuse/adopt/build decision. Pattern applies the already-selected idiom; integrate wires the selected provider. |
| Unchanged tests were treated as a proof and a discriminator against algorithm optimization | Pattern router/refactoring reference and the matrix pair resolution | The requested artifact decides ownership. Optimizations can keep correctness tests passing; passing tests supports covered behavior, not universal equivalence. |
| Reference-authoring advice mandated bulk and claimed templates never enter context | `proof-skill/references/authoring.md` versus engine authoring and skill anatomy | Remove byte/file minimums. References and templates cost context when read; maintain only useful material. |
| Venture's default contradicted the shared parser/templates | `proof-venture/SKILL.md` versus shared balanced defaults | Use `balanced`; explicit all-out still uses the shared estimate and required answer. |
| Production rollback proposed sandbox credentials | Integrate router and `contracts-and-promotion.md` | Restore a last-known-good production path or explicitly disable/queue the operation. Sandbox stays isolated for testing. |
| Known-runbook routing could cancel an already-declared incident | Operate and incident router predicates | Organizational incident criteria and declaration take precedence. A runbook can mitigate without erasing incident obligations. |
| A literal trace search was presented as proof of no stale influence; a trace row prohibited useful rereads | Context router/trace reference versus the shared-state freshness rule | Bound the claim to recorded inputs; permit documented freshness/hypothesis checks and record superseding deltas. |
| Active guides had stale skill counts, a duplicated full catalog, old milestone references and historical-study replay advice | Design index, overview, anatomy, team guide and contributor mode table | Add the documentation index and one complete catalog; reconcile counts, authority and study-reproduction limits. Resolve file-relative reference pointers. |

The review-confidence score is also now explicitly a rubric score rather than
a calibrated probability. Harness examples are qualified as configuration
scaffolds, not a security sandbox. Inline design's flag prose matches its actual
`<system>` hint. Existing ROUTES bytes, model pins, protocol negotiation and frozen
study criteria remain intact.

Source paths in this table are under `.claude/skills/` unless otherwise named.
They are inspectable through the [catalog's source links](../skills.md).

## Duplicate work versus intentional composition

| Area | Decision |
| --- | --- |
| Orchestrate / engine | Remove duplicate routing tables and pre-flight procedure; retain planning versus execution ownership. |
| DORA across audit, build, autopilot, design, operate and ship | Keep one definition/collection reference; each consumer states its own use. |
| Research / scout | Retain: cited evidence versus a reuse/adopt/build decision. Scout consumes research instead of running another independent report. |
| Review / audit | Retain: defects versus impact/risk. The audit cites supported review findings. |
| Design / frontend / pattern / algo | Retain: architecture, interface craft, structural diff and mechanism/performance argument. A request can need more than one output. |
| Build / venture / guide / orchestrate | Retain with a smaller entry path: routing, product decisions, implementation conduction and a task plan are different results. Do not require all layers for every task. |
| Operate / incident / ship / debug | Retain lifecycle and impact boundaries; declaration policy outranks the runbook shortcut. |
| Shared ROUTES in templates | Keep: the sandbox cannot import a module, and byte-identity validation is the drift control. These are intentional executable copies. |
| Small authority legends / reciprocal boundary examples | Retain where useful to a standalone reader. Repeated terminology alone is not duplicate task ownership. |

No new routing-accuracy or task-quality result was measured. The changed
boundaries need later real-use evidence; this source review cannot show that
misrouting or token use improved.

## Remaining gaps, prioritized

| ID | Priority / gap | Small next outcome | Evidence needed |
| --- | --- | --- | --- |
| G1 | Launch: native installed-host completion is unqualified | One bounded end-to-end task in the selected supported host | Actual discovery, invocation, checks, output and failure handling; repeat before claiming consistency |
| G2 | Launch: no qualified standalone Agensi package | Select the first offer and build its complete distribution | Carried dependencies, archive identity, clean install and actual listing/submission outcome |
| G3 | Product: no general accessibility/UX audit owner | A scoped charter covering existing-app journeys and WCAG checks | Representative browser/manual checks; frontend currently owns craft and motion only |
| G4 | Runtime: operations and autonomy need external machinery | A target runner, monitoring/alert inputs, per-resource locking and rollback/permission controls | Authorized dry-run comparison with ground truth before unattended action |
| G5 | Compatibility: live automation examples assume `claude/` branches | Reconcile the host's allowed prefix with the target repo policy | This repo permits named `feat/`, `fix/`, etc.; do not enable a conflicting live scaffold or bypass either policy |
| G6 | Evaluation: full-fleet quality, user comprehension and resource benefit unknown | Real tasks with independent correctness, repeats and actual input/cache/output/retry accounting | No task pass, smaller file, PR count or stored lesson substitutes for the comparison |
| G7 | Maintenance: external pins and providers remain selective dated checks | Recheck the relevant primary source when it becomes load-bearing | Source/check date, affected shelf, compatibility test and unresolved claims; do not blanket-redate shelves |
| G8 | Release qualification: broader protocol/host gates remain distinct | Execute the specified SDK golden queries and each claimed host flow | Local stdio/template smoke alone does not satisfy those gates |

G3 is a candidate capability, not authorization to add another skill immediately.
G4/G5 are stated scaffold limits, not proof that an unattended deployment exists.
A small first listing can stay focused while the broader roadmap remains open.

## Current primary-source checks

- [DORA metric guide](https://dora.dev/guides/dora-metrics/) and
  [official history](https://dora.dev/insights/dora-metrics-history/): corrected
  measurement scope, evolution and duplicated definitions.
- [Claude Code skills](https://code.claude.com/docs/en/skills): bundled `/verify`
  is documented, but can depend on host/session configuration. The instructions
  now describe an explicit fallback and do not assume every portable host has it.
- [Stripe API keys](https://docs.stripe.com/keys): live and sandbox objects and
  credentials are separate. The revised rollback recommendation is an engineering
  consequence of that boundary, not a tested Stripe integration in this task.
- [W3C SC 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html):
  the motion shelf's named flash criterion exists; this selective check does not
  establish full accessibility conformance.

Other shelves retain their original check dates and explicit unknowns. Newer
provider model names alone do not qualify a routing migration.

## Verification record

Raw baseline, scans, failed/corrected checks and final results live under ignored
`dist/framework-review-20261023/`. The final receipt records source identities,
executed repository/package gates, document targets, preserved records and local
Git state. Historical ADRs, studies, released changelog sections and the earlier
launch receipts are preserved. Local template checks use stubs; no paid model,
live service, native host task or marketplace submission was run.
