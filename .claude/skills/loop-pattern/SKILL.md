---
name: loop-pattern
description: "Apply design patterns, refactorings, and language or framework idioms to existing code, and remove the smells that motivate them: GoF patterns, Fowler's Refactoring catalog, SOLID, and the framework's own idiomatic usage. Use when the user asks to refactor, restructure, or clean up code, apply or choose a design pattern, fix a code smell, make code idiomatic or conventional for its language or framework, or improve maintainability by changing the code. Produces a behavior-preserving diff backed by tests. For reporting quality and security defects without changing the code, use loop-review. For choosing which framework or library to adopt in the first place, use loop-scout. For the complexity or correctness of an algorithm rather than the shape of the code around it, use loop-algo."
argument-hint: <target> [--mode <lite|balanced|all-out>]
---

# Applying Patterns and Refactorings

**This skill produces a DIFF; `loop-review` produces a FINDINGS LIST.** That is the whole discriminator between the two, and it is decidable at request time: if the user wants the mess named and the code left untouched, they want `loop-review`; if they want the mess *gone* from the source, they want this skill. A smell that `loop-review` reports in its quality section is exactly this skill's input trigger — the two compose, they do not compete.

The second boundary is decidable from one file. **Run the dependency-manifest test against `loop-scout`: if answering the question adds a line to `package.json` / `requirements.txt` / `go.mod` / `Cargo.toml`, it is `loop-scout`; if the dependency is already there, it is `loop-pattern`.** "What's the best way to do X in React?" is genuinely ambiguous until you check whether React is already a dependency. It is here, so the question is which idiom — this skill. It is not, so the question is which library — that skill.

You are about to change the *shape* of working code without changing what it does. The engine is a named catalog move applied in small steps against a green test suite, not a rewrite you like better. **A refactoring that changes behavior is not a refactoring, it is a bug** — §4 is the constraint every other section serves.

## 1. Trigger discipline: no smell, no refactor

Every application in this skill cites a **named Fowler smell** (`references/refactoring-catalog.md` §1) or a **named SOLID violation** (`references/solid-and-style.md` §1) *before* it proposes a treatment. Write the citation down; if you cannot name one, there is no work here and you say so.

This gate is not ceremony. Pattern-application skills have a famous failure mode — needless indirection, a Factory for one concrete type, an interface with one implementer — and an ungated "apply patterns" skill would run directly against `loop-scout`'s and `loop-design`'s stated anti-over-engineering position. The named-smell requirement is what keeps this skill aligned with its siblings instead of contradicting them. Simplifying *back out* of a speculative abstraction is a legitimate output here; adding one is not.

Route elsewhere when:

| The request is really… | Skill | The test |
|---|---|---|
| Name the smells and defects, leave the code alone | `loop-review` | The deliverable is a report, not a diff. |
| Pick a framework or library that is not yet adopted | `loop-scout` | Answering it adds a line to the dependency manifest. |
| Change the complexity, concurrency semantics, or performance profile | `loop-algo` | The existing tests should *not* pass unchanged after the change. |
| Move a component, deployable, or contract boundary | `loop-design` | The restructuring crosses module boundaries rather than staying inside them. |
| Make broken code work | `loop-debug` | There is an observed failure to reproduce. |

## 2. The safety net comes first

**No refactor begins without a passing test suite over the target.** Behavior preservation is only meaningful relative to something that can detect a violation; without coverage, "it still works" is an assertion, not a result. Establish the net before the first edit:

1. Find the tests that exercise the target and run them. Green before you touch anything, or you cannot attribute a later red to your diff.
2. If coverage over the target is absent or too thin to catch a change, **delegate authoring it to the `loop-test` skill** so the tests match the project's framework and conventions. Do not invent test-writing rules here — this skill owns catalog moves, `loop-test` owns tests, the same way `loop-debug` §6 delegates its regression test.
3. If the target genuinely cannot be put under test before the refactor (welded to I/O, time, or globals), say so and refactor toward the seam in the smallest possible step — characterize the current behavior first, then move.

A red suite before you start is a `loop-debug` job, not a refactoring job. Hand it over.

## 3. The four lenses

Four ways in. Pick the one the smell points at, open its reference, and work from the catalog rather than from memory.

1. **Smell → refactoring.** A named smell (Long Function, Feature Envy, Primitive Obsession, Shotgun Surgery, Divergent Change…) maps to a named catalog move. The index and the mechanics discipline are in **`references/refactoring-catalog.md`** — this is the default lens and the one most requests land on.
2. **Problem shape → pattern.** A recurring structural problem (conditional-on-type, object-creation coupling, incompatible interfaces) maps to a GoF pattern, introduced incrementally through catalog moves. Index, refactoring-to-patterns sequence, and the pattern-happy anti-pattern are in **`references/design-patterns.md`**.
3. **SOLID violation → principle fix.** When the *why* matters more than the *what* — Strategy answers an Open/Closed violation, constructor injection answers a Dependency Inversion violation — reason at principle level first. Per-letter treatment in **`references/solid-and-style.md`**, which also carries the language → style-source table (PEP 8, Effective Java, Google style guides, Rust API Guidelines) and the defer-to-repo-convention rule.
4. **Framework idiom.** The code uses an already-chosen framework against its own documented intent. React, Django, and Spring idioms, plus "fighting the framework" as its own smell category, are in **`references/framework-idioms.md`**.

Every standard these four cite is named, version-pinned, and mapped to this skill in **`references/standards.md`**. Cite from that file, not from memory.

## 4. Behavior preservation is the hard constraint

A refactor is **not complete until it is proven behavior-identical** against the §2 safety net: same tests, unchanged, green before and green after. Not "should be equivalent" — run them.

**The handoff rule:** if applying a treatment turns up a behavior change the user did not ask for, that is a bug, and it goes to **`loop-debug`**. Never fix it silently as a side effect of the refactor. A diff that both restructures code and quietly corrects a defect is unreviewable — the reviewer cannot tell which change caused which effect, and the correction ships without a regression test proving it. Stop, report the behavior difference, and let `loop-debug` own it with its own reproduction and its own test. If the user then wants both, they are two diffs.

The same rule runs the other way for `loop-algo`: if the change is *supposed* to alter the performance profile, ordering, fairness, or memory visibility, the tests will not pass unchanged and it is not this skill's work.

## 5. Orchestration: scale past one file

**For a single-file, single-smell change, apply it inline in this session — do not spin up agents.** Read the code, name the smell, make the catalog move in small steps, run the tests. Agents cost more than the change.

For a **multi-module sweep** — "clean up this package", "make this service idiomatic", a codebase-wide smell hunt — run **`templates/refactor-sweep.workflow.js`**, a three-stage specialization of the parallel fan-out pattern:

1. **Scan** — one finder per file/module (parallel), each carrying a *different* lens from §3, returning structured candidates (smell tag, location, one suggested treatment, rationale). Diversity beats redundancy: one finder per module beats N finders re-reading the same file (harness policy H4).
2. **Dedup + prioritize barrier** — merge and dedup keyed on **location**, because the same region routinely gets nominated for two different treatments by two different lenses, and the apply stage is expensive and behavior-risking. This barrier is earned under H2's "dedup/merge across the full result set before expensive downstream work" clause, and it is also where the run early-exits when the scan surfaced nothing. Cap to a reviewable batch and `log()` every drop (H6).
3. **Apply + verify** — one agent per surviving candidate: run the target's existing tests, apply the **one** named treatment, re-run the same tests, then let independent lenses try to refute behavior preservation. An agent that cannot get a green run before or after **reverts and flags** rather than leaving a red diff.

This is the parallel finder → dedup → verify pattern from the **`loop-engine`** skill (see its `templates/parallel.workflow.js` and harness policies H2, H4, H5, H7). Invoke `loop-engine` to author and execute the run; pass your raw argument string straight through — `--mode` and `--planner` are parsed there, never here.

## Reference files

- `references/refactoring-catalog.md` — Fowler's catalog indexed by code smell, the mechanics discipline, the safety-net precondition, and when *not* to refactor; plus the tie-break table and the inverse-pairs section (refactoring has a reverse gear — reflex in one direction is a style tic)
- `references/design-patterns.md` — the GoF catalog as a problem-shape index, refactoring-to-patterns, and the pattern-happy anti-pattern; plus the misuse-cost catalog (what each popular pattern costs when it ships wrong, the wrapper line-up disambiguation, and the pattern → modern-language replacement table)
- `references/solid-and-style.md` — SOLID per principle with the smell each answers, and the language → canonical style-source table; plus the over-application table — one entry per letter, detection signal and walk-back, principles as pressure gauges, not laws
- `references/framework-idioms.md` — idiomatic use of an already-chosen framework (React, Django, Spring) and "fighting the framework" as a smell
- `references/standards.md` — the authoritative standards this skill applies — named, version-pinned, and mapped to its workflow
- `templates/refactor-sweep.workflow.js` — scan fan-out → dedup barrier → apply-and-verify workflow script
