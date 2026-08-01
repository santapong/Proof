# Design records

Two machine-readable artifacts that govern the plugin. They are **normative**, not historical notes.

| File | What it is | Authority |
|---|---|---|
| `boundary-audit.json` | The 19-skill scope matrix: one mutually-exclusive scope line per skill, every rated overlap with its resolution, and the approved `description:` text for each skill. | **Outranks the build manifest.** Where a plan and this file disagree, this file wins. |
| `execution-mode-spec.json` | The `--mode optimize\|full` and `--planner opus\|fable` contract as specified before implementation: routing table, flag grammar, pre-flight, back-compat. | Superseded at the point of use by `.claude/skills/loop-engine/references/execution-modes.md`, which is what the skills actually load. Kept as the design record. |

## Research records — informative, not normative

| File | What it is | Authority |
|---|---|---|
| `agent-engineering-terms.md` | The 2026 agent-engineering vocabulary — prompt, context, intent, specification, harness, loop, graph, meta-harness and memory engineering — each graded by source quality, with what we adopt, adapt or reject, and where it lands in the plugin. | **Informative.** Records *why* a policy or shelf entry is shaped as it is. Where it and a normative artifact disagree, the normative artifact wins — but fix one of them. |

Unlike the two files above, this one governs nothing. It exists so a citation in a
standards shelf can be traced back to how it was graded, and so the next person who hears
a new term has the checking already done. Its citation-discipline section names two
circulating figures that must never be reproduced.

## Why these are in the repo

Skill selection happens on the `description:` field alone, before any skill body is read. With nineteen skills, the descriptions have to be mutually exclusive by construction, and the reasoning for *why* a boundary sits where it does has to be as durable as the boundary itself.

During the 1.0.0 build these files lived in a scratch directory. Three of the audit's mandated cross-links were dropped from the build manifest and then verified by nobody — every review checked the work against the manifest, so anything the manifest omitted was structurally invisible. Committing the audit is the fix: the contract is now readable by whoever reviews the next change.

## Using them

- **Changing a skill's `description`** — update `boundary-audit.json` in the same commit, and check the change against every `useInsteadWhen` pointer that names the skill. A description that stops encoding its half of an overlap makes that boundary one-way.
- **Adding a skill** — add its row, then re-check every rated overlap it touches. Nineteen skills is more selection pressure than eighteen, not the same.
- **Resolving a disagreement** — the audit wins over any plan or manifest. If the audit is wrong, change the audit deliberately rather than diverging from it silently.

**On the fixed prose inside these files.** Both were written during the 1.0.0 build and their narrative text says "eighteen skills". That wording is left alone deliberately — a design record states what was specified at the time. The `matrix` and `overlaps` arrays in `boundary-audit.json` are the live parts and **are** kept current; the surrounding prose is history.

`scripts/validate.mjs` enforces what is mechanically checkable (frontmatter validity, `name`/directory agreement, reference paths). The boundary semantics are not mechanically checkable and are reviewed against this file by hand.

> **Note (1 Aug 2026):** the plugin described in ADRs and historical records as *TheLoopSkill* was renamed to **Heimdall**. ADRs are not rewritten; they state what was decided at the time.
