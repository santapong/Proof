# Authoritative standards — what this skill cites, and how honestly

This is the shelf a refactor reaches for when it needs an authority beyond "I think this reads better." Every treatment this skill applies is supposed to be *named* — a Fowler move, a GoF pattern, a SOLID principle, a documented framework rule — and a name is only worth citing if the source behind it is real and pinned.

Cite from this file, not from memory. A fabricated ISBN, an invented edition number, or a version pinned to a book that never had one makes the whole diff look careless, and it is the single easiest thing for a reviewer to catch.

## Canonical texts vs. living standards — how to cite each honestly

Two different kinds of source appear below, and blurring them is a real accuracy failure, not a stylistic one.

**`authoritative: true` — the body that owns the thing publishes the rule.** PEP 8 *is* Python's style guide, published through the Python Enhancement Proposal process. React's *Rules of React* *is* React's own statement of the contract your components must satisfy for the framework to work. Django's and Spring's documentation *is* the maintainers describing intended use. Code can be **in violation** of these. When one of them says a component must be pure, an impure component is a defect against a normative source, and the citation carries that weight.

**`authoritative: false` — influential, but nobody's spec.** The Gang of Four book, Fowler's *Refactoring*, Bloch's *Effective Java*, Martin's SOLID essays, and Google's style guides are books and house styles. They are the shared **vocabulary** of this craft — "Extract Function" and "Strategy" mean the same thing to every engineer because of them — and that vocabulary is exactly why this skill leans on them. But code cannot be "in violation" of a book. Cite them as *this is the named move and here is where the name comes from*, never as *this is required*.

**Practical rule:** an `authoritative: true` source can carry a finding on its own. An `authoritative: false` source names and justifies a treatment whose real justification is a concrete cost you can state — a smell, a bug surface, a change that will have to touch four files. If you cannot state that cost, the citation is decoration and the refactor fails §1 of `../SKILL.md`.

## The two catalogs this skill is built on

| Standard | Body | Edition (pinned) | Authoritative | How this skill cites it |
|---|---|---|---|---|
| **Design Patterns: Elements of Reusable Object-Oriented Software** ("Gang of Four") | Gamma, Helm, Johnson, Vlissides — Addison-Wesley | **1994 first edition.** There is no revised edition; the 1994 text is still the referenced one. Do not invent a "2nd ed." | **false** | Supplies the 23-pattern vocabulary (Creational / Structural / Behavioral) in `design-patterns.md`. Cited to name a pattern and its problem shape — never as an obligation to use one. |
| **Refactoring: Improving the Design of Existing Code, 2nd Edition** | Martin Fowler — Addison-Wesley Signature Series | **2nd ed., November 2018**, ISBN **978-0-13-475759-9** | **false** | The spine of `refactoring-catalog.md`: the code-smell taxonomy and the named, small-step, behavior-preserving moves keyed off each smell. Cited per move ("Extract Function", "Replace Conditional with Polymorphism"). |

**Pin the Fowler edition, and mean it.** The 2nd edition **rebased its examples from Java to JavaScript** and **added functional-style refactorings** (the pipeline-oriented moves such as *Split Loop* and *Replace Loop with Pipeline*), alongside renames the catalog inherited — *Long Method* became *Long Function*, and *Introduce Null Object* became *Introduce Special Case*. A reader working from the 1999 first edition and a diff citing the second will disagree about the name of the same move. `refactoring-catalog.md` uses 2e names throughout and notes the 1e name in parentheses where the rename is likely to trip someone.

**Pin the GoF edition too, by stating that there is only one.** The temptation is to write "2nd ed." because everything else has one. It does not exist. Cite "GoF (1994)".

## SOLID — five principles, no issuing body

| Standard | Body | Edition (pinned) | Authoritative | How this skill cites it |
|---|---|---|---|---|
| **SOLID principles** — SRP, OCP, LSP, ISP, DIP | Robert C. Martin | **No formal version.** Consolidated in Martin's 2000 essay *Design Principles and Design Patterns* and elaborated in his 2002 and 2017 books | **false** | The principle-level lens in `solid-and-style.md` for deciding *why* a pattern applies — Strategy answers an Open/Closed violation, constructor injection answers a Dependency Inversion violation — rather than pattern-for-pattern's-sake. |

**Explicit caveat: there is no standards body here.** SOLID is one engineer's synthesis, popularized by a community, with no versioning, no errata process, and no conformance definition. The acronym itself was coined after the fact. Individual principles are also genuinely contested in practice — the Single Responsibility Principle in particular is stated loosely enough that two competent engineers routinely draw the boundary in different places, and the Liskov Substitution Principle is the only one with a formal grounding outside Martin's writing (Barbara Liskov's substitutability work).

So: use SOLID to *explain* a treatment, never to *mandate* one. "This violates SRP" is not a finding. "This class changes for two unrelated reasons, so every pricing change also forces a re-test of the export path — that is the Divergent Change smell, and SRP is the principle behind it" is.

## Language style-guide shelf

The idiom substrate beneath structural change. These govern naming, layout, and API shape so an applied pattern reads as native code rather than a transplant. Every row carries the same escape hatch, and it is the most important column in the table.

| Standard | Body | Edition (pinned) | Authoritative | How this skill cites it |
|---|---|---|---|---|
| **PEP 8 — Style Guide for Python Code** | Python Software Foundation / Python core developers | **Living PEP**, current text at `peps.python.org/pep-0008`. Confirmed current as of **July 2026** | **true** | The Python idiom layer in `solid-and-style.md` §2: naming, layout, import order. A Python refactor lands in PEP 8 shape unless the repo has its own configured formatter/linter, which wins. |
| **Effective Java, 3rd Edition** | Joshua Bloch — Addison-Wesley | **3rd ed., January 2018**, ISBN **978-0-13-468599-1**. Covers the language **through Java 9** | **false** | Item-numbered JVM idioms (favor composition over inheritance, the builder pattern for many-parameter constructors, enum singletons) cited when a Java target has a canonical Bloch item. |
| **Google style guides** (Java, Python, C++, Go, TypeScript) | Google | **Continuously revised, no version number.** Confirmed live at `google.github.io/styleguide` as of **July 2026** | **false** | An opinionated house style, cited only when the target repo already follows it. Never imposed over a repo's own convention. |
| **Rust API Guidelines** | Rust library team / rust-lang org | **Living document**, checklist at `rust-lang.github.io/api-guidelines`. Confirmed live as of **July 2026** | **false** | `C-*` checklist items (naming, trait and generic conventions, common-trait implementations) applied when refactoring a Rust public API surface. |

**The Effective Java pin has a real edge.** The 3rd edition covers the language through Java 9. Every language feature after that — records, sealed types, pattern matching for `switch`, virtual threads — is outside the book. When a Bloch item has a cleaner modern expression (a record instead of a hand-written value class), apply the modern form and cite the item as the *reason*, not the *recipe*. Do not pretend the book covers something it does not.

**The Rust guidelines say it about themselves:** they are explicitly framed as *guidelines, not a mandate*. Quote them that way. A `C-*` item is a strong default for a public API and close to irrelevant for a crate-private helper.

**The defer-to-repo-convention rule, stated once for all four rows.** A repo's own established convention **outranks every entry in this table**. If the codebase consistently does something one of these guides advises against, matching the codebase is correct and "fixing" it across the repo is churn, not a refactor (see `refactoring-catalog.md` §5). The order of precedence is: the repo's configured tooling (formatter, linter, `.editorconfig`) → the repo's observed, consistent practice → the guide above. Raise a genuine disagreement once, as a note, never as a batch of renames.

## Framework-idiom shelf

These are the `authoritative: true` end of the shelf: the maintainers of the framework describing how the framework is meant to be used. `framework-idioms.md` is built on them.

| Standard | Body | Edition (pinned) | Authoritative | How this skill cites it |
|---|---|---|---|---|
| **Rules of React** | Meta / React core team | Current official page, **`react.dev/reference/rules`**. **Supersedes the legacy "Rules of Hooks" page**, which it consolidates. Confirmed live as of **July 2026** | **true** | Component purity, effects outside render, immutable props and state, hook call order — the framework's own statement of the contract. A violation is a defect against a normative source, not a preference. |
| **Django Design Philosophies** | Django Software Foundation | Official docs, **tracks the current Django release** — `docs.djangoproject.com`, `/misc/design-philosophies/` | **true** | Idiomatic Django: the fat-model/thin-view convention, ORM query idioms, class-based-view intent. **Distinct from Django's contributor coding-style document**, which governs contributions to Django itself, not your application code — do not conflate them. |
| **Spring Framework Reference Documentation — stereotype annotations** | VMware / Spring team (Broadcom) | **Spring Framework 7.0.x**, the current major as of **July 2026** — `docs.spring.io/spring-framework/docs/current` | **true** | `@Component` / `@Service` / `@Repository` / `@Controller` stereotyping, constructor injection over field injection, and bean-lifecycle idiom, applied when refactoring Spring bean wiring. |

**Check the target's actual version before citing the Spring row.** 7.0.x is the pin here; a codebase on 6.x is not wrong, it is on a different version, and DI guidance has shifted across those majors. Cite the version the code is on. The same caution applies to Django: "tracks the current release" means you should confirm against the docs for *that project's* Django version before calling something non-idiomatic.

## Edition discipline

Standards get revised, and a diff whose justification cites a retired edition reads as sloppy in exactly the way that erodes trust in the rest of the change.

- **Cite the edition you actually mapped to**, in the diff or the PR description — "Fowler 2e, *Replace Conditional with Polymorphism*", "Rules of React, component purity", "Effective Java 3e, Item on composition over inheritance" — never a bare "Fowler" or "per Google style."
- **Do not mix editions inside one change set.** If you name 2e moves, keep every companion name on 2e.
- **Never invent a version number to make a row look uniform.** Four entries in this file have no edition number at all — the **Google style guides**, the **Rust API Guidelines**, **Rules of React**, and the **Django docs**. They are continuously revised living documents. The honest pin for these is *"confirmed live as of July 2026, re-check periodically"*, exactly as written above, and that is the discipline that keeps them from silently rotting: there is no edition to diff, so the only protection is a dated confirmation and a habit of re-reading the page.
- **The two catalogs age slowly; the framework shelf does not.** GoF (1994) and Fowler 2e (2018) have been stable for years, and `design-patterns.md` and `refactoring-catalog.md` inherit that stability. `framework-idioms.md` does not: React's *Rules of React* page is itself a consolidation that replaced the older *Rules of Hooks* framing, and Spring's DI and stereotype guidance moves across majors. **Put `framework-idioms.md` on a shorter re-check cycle than the other two references** — that file states the same warning at its head, deliberately, so a reader who opens only one of the two sees it.
- **Re-check cadence.** This shelf: roughly twice a year, and additionally whenever a target repo's framework crosses a major version. The framework rows: whenever you are about to cite one on a codebase you have not touched recently. When a row goes stale, update the row *and* the confirmation date in the same commit — a pinned date left behind is worse than no date, because a reader will trust it.
