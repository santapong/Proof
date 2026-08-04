# Standards — the authorities this skill reasons from

Graded per the plugin convention: **Yes** = ratified and published by a standards body or licensed framework owner · **Draft** = real working-group output nothing has ratified · **No** = real, widely followed, still somebody's opinion. The grade is provenance, not quality.

Codebase comprehension is a practice-heavy domain: one ratified standard (the architecture-description frame), one peer-reviewed taxonomy (the method's shape), and a shelf of graded-No books and formats that are nonetheless where the discipline actually lives.

## The shelf

| Authority | Edition / pin | Grade | What it anchors here |
|---|---|---|---|
| **ISO/IEC/IEEE 42010:2022** — *Software, systems and enterprise — Architecture description* | Edition 2, published November 2022 (supersedes 42010:2011) | **Yes** | The frame `architecture-recovery.md` presents into: an architecture description answers named stakeholders' *concerns* through *viewpoints*; "map the architecture" is underspecified until a concern is chosen. Cite its terms (viewpoint, view, concern) normatively. |
| **Ducasse & Pollet, "Software Architecture Reconstruction: A Process-Oriented Taxonomy"** | IEEE Transactions on Software Engineering, vol. 35, no. 4, pp. 573–591, 2009. DOI 10.1109/TSE.2009.19 | **No** (peer-reviewed survey — evidence, not a requirement) | The extract → abstract → present decomposition this skill's method follows, and the vocabulary for bottom-up vs. top-down (hypothesis-driven) recovery. The field's standing survey of reconstruction approaches. |
| **Peter Naur, "Programming as Theory Building"** | *Microprocessing and Microprogramming* 15 (1985), pp. 253–261 | **No** | Why comprehension is rebuilding a theory, not accumulating notes — the intellectual basis for hypothesis-driven reading (§2 of `architecture-recovery.md`). Deliberately old and deliberately load-bearing. |
| **Michael Feathers, *Working Effectively with Legacy Code*** | 1st edition, Prentice Hall, 2004 | **No** | The characterization move: where static reading goes ambiguous, write a test to *learn* what the code does — the "tests as recorded traces" and runtime-evidence rules in `feature-tracing.md`. |
| **Michael Nygard, "Documenting Architecture Decisions"** | Blog post, November 2011; deliberately unversioned | **No** | The ADR fields (context / decision / consequences) that recovered ADRs are written into. The fleet's `loop-design` pins the same source for forward decisions — when either skill's pin context changes, check the other (do not assert here what its shelf currently records). |
| **MADR — Markdown Architectural (Any) Decision Records** | v4.0.0, released 2024-09-17 (github.com/adr/madr) | **No** (an OSS project's own spec) | The alternative ADR format `decision-recovery.md` targets when the repo already uses MADR. OSS-versioned and moving — treat the pin as a starting point and check the releases page before quoting template fields. |
| **The C4 model** (Simon Brown) | Living document at c4model.com; deliberately unversioned — the honest pin is the name and the date read | **No** | The presentation convention for recovered maps in this fleet's repos, per the fleet's C4 + `.mmd`→`.svg` docs convention. Container + component levels are the recovery deliverable's usual altitude. |
| **Clements et al., *Documenting Software Architectures: Views and Beyond*** | 2nd edition, Addison-Wesley (SEI Series), 2010 | **No** | The view-selection discipline behind "choose an abstraction target before abstracting" — one map per concern, never one map for all. |

## Boundary notes the shelf must carry

- **ADR authority is shared, not duplicated.** Nygard/MADR are pinned here for *recovered* ADRs (decisions already embodied in code); `loop-design` pins ADR practice for *forward* decisions and `loop-docs` for ADR prose discipline. This shelf states its own pins only; propagation obligation — if MADR or the Nygard source materially changes, all three skills' shelves are checked in the same commit. Do not assert here what the other two currently record — read them.
- No source on this shelf makes evidence-anchoring a *requirement* — that rule (`a claim carries a file:line or it is a guess`) is this plugin's own discipline, stated as such, not laundered through a citation.

## Confirmation log — 2026-08-04

**Verified against a primary source this pass:** **ISO/IEC/IEEE 42010:2022** (iso.org catalogue entry 74393 — Edition 2, November 2022); **MADR v4.0.0** (github.com/adr/madr releases — 2024-09-17); **Ducasse & Pollet 2009** (ACM/IEEE DL — TSE 35(4), 573–591, DOI 10.1109/TSE.2009.19).

**Not independently re-confirmed in this pass, and named rather than re-asserted with new precision:** **Naur 1985**, **Feathers 2004 (1st ed.)**, **Clements et al. 2010 (2nd ed.)**, **Nygard 2011** — carried from prior research and stable, dated sources; check the publisher's catalogue before quoting a page or section. **C4** is deliberately unversioned; its pin is the name plus the date read.
