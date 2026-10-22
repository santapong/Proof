# Proof documentation

Use the document for the result you need. This index describes the Proof 4 beta
candidate; [migration](migration-proof-4.md) distinguishes it from published v3.

| Need | Read |
| --- | --- |
| Try one bounded task | [Your first task](getting-started.md) |
| Choose among every skill | [All 26 skills](skills.md) |
| Use Proof’s visual identity | [Identity](identity.md), [artwork sources and checks](assets/README.md) |
| Understand how the parts fit | [Overview](overview.md) |
| Install or migrate a host | [Installation](../INSTALL.md), [Proof 4 migration](migration-proof-4.md) |
| Work with a software team | [Team guide](software-team.md) |
| Review responsibilities, gaps and duplicate work | [Framework review](reviews/framework-review-2026-10-23.md) |
| Inspect documentation coverage | [Framework-review file inventory](reviews/documentation-inventory-2026-10-23.json), [later artwork verification](assets/proof-architecture-verification-2026-10-23.json) |
| Understand architecture | [C4](c4/README.md), [skill anatomy](c4/skill-anatomy.md), [4+1 views](views/4plus1.md) |
| Contribute a skill or change | [Contributing](../CONTRIBUTING.md), [branch policy](branch-policy.md), [design authority](design/README.md) |
| See plans versus released work | [Roadmap](../ROADMAP.md), [changelog](../CHANGELOG.md) |
| Reproduce the small review input | [Discount fixture](examples/first-review/README.md) |
| Inspect earlier review evidence | [Review index](reviews/README.md) |

## Authority and maintenance

Skill entrypoints define their task; `boundary-audit.json` owns selection
boundaries. The engine's harness, loop and execution-mode references own shared
execution policy. The skill catalog summarizes these sources rather than
introducing a competing contract.

ADRs, frozen studies, old verification receipts and released changelog sections
record what was decided or measured at a date. Preserve them; add a current
correction or superseding decision instead of rewriting their evidence.
Standards shelves keep their original source/check dates unless actually
rechecked. A documentation update does not refresh every external edition.

Before changing a shared fact, find all active copies and dependent references.
Update the authority and affected summaries together, run the relevant source,
path and package checks, and record untested host/provider behavior explicitly.
