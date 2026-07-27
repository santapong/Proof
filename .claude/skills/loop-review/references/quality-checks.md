# Code-Quality Checks

The non-security half of a review. Security findings are about an attacker; these are about a bug, a leak, or a maintainer six months from now. The bar is the same one the security side holds (`methodology.md` → *The reporting bar*): **report high-signal findings, drop nitpicks.** A quality review that lists every style preference gets muted exactly like a security review that cries wolf.

This checklist is the substance a trustworthy quality pass sweeps. The built-in `code-review` and `simplify` skills mechanize part of it (correctness bugs, reuse/efficiency cleanups) — run them if present, but confirm each hit against the source yourself and hold it to the bar below before reporting. Keep quality findings in a **separate report section** from security ones (`../SKILL.md` §7) so a naming nit never sits next to an injection.

**Detection is this skill's job; remediation is not.** `loop-review` emits a **findings list and touches no code**; `../../loop-pattern` emits the **diff**. That is the whole seam between the two skills, and it is why both exist. Every table below therefore carries a **Remediation** column naming where the fix is owned — for maintainability smells, the exact `loop-pattern` catalogue entry. Cite that entry in the finding's *fix* field so the handoff is one hop; never refactor inside a review, and never re-derive `loop-pattern`'s mechanics here.

## The bar for a quality finding

Report a quality issue only when it clears **both**:

- **Concrete consequence** — you can name what breaks: a wrong output for a stated input, a leaked handle under a stated path, a race with a stated interleaving, a duplicated rule that will drift. "Could be cleaner" is not a consequence.
- **Not a matter of taste** — it survives the project's own conventions (below). If reasonable engineers on this codebase would disagree, it is a preference, not a finding.

Score what survives on severity × confidence per `severity-model.md`. **Defer to project conventions first:** the repo's existing patterns, linter config, and style guide are the baseline. A deviation from how the rest of the codebase does the same thing is signal (same logic as `methodology.md` Phase 2); matching an established repo pattern you personally dislike is not a finding — raise it once, as a note, not per instance.

## Tier 1 — Defects (wrong behavior)

These change what the code does. They rank above everything in Tier 2 and are worth the most scrutiny.

| Category | Flag when… | Confirm / refute before reporting | Remediation — who owns the fix |
|---|---|---|---|
| **Correctness / logic** | off-by-one, inverted condition, wrong operator (`&&`/`\|\|`, `=`/`==`), boundary case (empty, single, max), missing `return`/`break`, wrong default, integer/float or truncation error, timezone/locale assumption | Trace one concrete input to the wrong output. State it as `input → actual vs expected`. No such input → drop. | `../../loop-debug` — reproduce, fix, add the regression test. **Not `loop-pattern`**: its diffs are behavior-preserving by definition, and this one must change behavior. |
| **Null / undefined & types** | dereference of a value that a real path leaves null/undefined/NaN; unchecked optional; type coercion that discards data; unhandled enum/variant | Find the path that produces the empty value. If every caller guarantees non-null, no finding. | `../../loop-debug` for the failing path. When the null-ish case recurs by design, the structural remedy is `../../loop-pattern/references/refactoring-catalog.md` §1 *Temporary Field* / *Primitive Obsession* → **Introduce Special Case**, **Replace Primitive with Object**. |
| **Error handling** | swallowed exception (empty catch, `catch` that only logs and continues in a corrupted state), error path that returns a success value, lost context (re-throw discarding cause), `Promise` rejection unhandled, partial write left on failure | Show the failure that reaches the swallow and the wrong state it leaves. A deliberately-ignored error with a comment saying so is not a finding. | `../../loop-debug` for the swallowed failure. For a *remote* dependency's failure modes — retries, timeouts, backoff — the owner is `../../loop-integrate/references/resilience.md`. |
| **Resource leaks** | file/socket/handle/lock/cursor/subscription acquired without a guaranteed release on **every** exit including the error path; missing `finally`/`defer`/`using`/context-manager; connection not returned to pool | Point to the early-return or throw that skips the release. If the language's construct (RAII, `with`, `defer`) guarantees it, no finding. | `../../loop-debug`. The fix is the language's own construct, not a refactoring — cite it by name in the finding. |
| **Concurrency / races** | shared mutable state touched without synchronization; check-then-act (TOCTOU) on shared data; `await` between a read and its dependent write; non-atomic compound update; lock ordering that can deadlock; assumption of single-threaded execution that the runtime breaks | Name the interleaving: thread/task A does X while B does Y → corrupt result. A race you cannot interleave is not one. | `../../loop-algo/references/concurrency.md` for the memory-ordering and progress argument, then `../../loop-debug` for the fix. Never a `loop-pattern` job — the correct fix changes ordering, fairness, or visibility. |
| **API misuse** | calling a library against its contract — ignored return value that signals failure, wrong argument order, missing required cleanup, misused async (unawaited promise, blocking call on an event loop), off-spec state-machine call order | Cite the API's actual contract (its docs/signature), not a guess. Deviation from documented use with a real consequence → report. | A third-party/network contract → `../../loop-integrate`. A *framework* contract being fought → `../../loop-pattern/references/framework-idioms.md` (§4 "fighting the framework" is that file's own smell category). |

## Tier 2 — Maintainability (structure & clarity)

These do not (yet) misbehave; they make the code costly to change or hide future bugs. Higher bar to report — only when the cost is concrete, not aesthetic.

Each row is a **smell class**, and each remediation names the `loop-pattern` catalogue entry that fixes it. All of these are behavior-preserving by construction, which is exactly why the remediation is `loop-pattern`'s and not `loop-debug`'s: the test suite must pass unchanged before and after. **Paths in the remediation column are relative to `../../loop-pattern/`** — so `references/refactoring-catalog.md` means `../../loop-pattern/references/refactoring-catalog.md`.

| Smell class | Flag when… (and when not) | Remediation — entry under `../../loop-pattern/` |
|---|---|---|
| **Dead code** | unreachable branches, unused exports/params/vars, feature-flagged code that can never turn on, commented-out blocks. Report when it misleads a reader or hides that a case is unhandled; a single unused import is linter territory, not a finding. | `references/refactoring-catalog.md` §1 *Speculative Generality* / *Lazy Element* → **Remove Dead Code**, **Inline Function**, **Inline Class**, **Collapse Hierarchy**, **Change Function Declaration** to drop unused parameters |
| **Duplication** | the same non-trivial logic or rule copy-pasted such that a future change must touch all copies and *will* miss one. Report the drift risk, not incidental similarity — two lines that happen to look alike are not duplication. Prefer pointing at the existing helper the code should have reused (the `code-review` / `simplify` skills' reuse lens). | `references/refactoring-catalog.md` §1 *Duplicated Code* → **Extract Function**; **Pull Up Method** for sibling subclasses; **Slide Statements** first to make the copies adjacent and identical |
| **Simplification / reuse** | a hand-rolled loop that a standard library call expresses; a branch that collapses to a lookup; redundant state derivable from existing state; an abstraction with one caller that adds indirection without payoff. Report when the simpler form is unambiguously clearer or removes a bug surface — not to relitigate a working design. | `references/refactoring-catalog.md` §1 *Loops* / *Middle Man* / *Mutable Data* → **Split Loop**, **Replace Loop with Pipeline**, **Remove Middle Man**, **Replace Derived Variable with Query** |
| **Complexity hotspots** | a function whose branching/nesting/length makes its behavior hard to verify (deep nesting, many flags, long parameter lists, a god-function doing several jobs). Flag the ones where the complexity is *load-bearing* for a likely bug, not every long function. Tie it to a concrete risk ("this fourth nested condition is why the empty case is mishandled"). | `references/refactoring-catalog.md` §1 *Long Function* / *Long Parameter List* / *Large Class* / *Repeated Switches* → **Extract Function**, **Decompose Conditional**, **Introduce Parameter Object**, **Extract Class**; **Replace Conditional with Polymorphism** with the worked sequence in `references/design-patterns.md` §5 |
| **Naming / readability** | a name that actively misleads (says `count` but holds a list, `isValid` that mutates), or a construct that reads as the opposite of what it does. Report misleading, not merely terse — `i`, `db`, `ctx` are fine. This is the lowest-signal category; report sparingly and never as a batch of renames. | `references/refactoring-catalog.md` §1 *Mysterious Name* → **Rename Variable**, **Rename Field**, **Change Function Declaration**; the naming-vs-structure seam is `references/solid-and-style.md` §3 |

## Testability & coverage gaps

Report a coverage gap only when the untested surface is a place a bug would actually land:

- **New behavior with no test** — a changed code path (branch, error case, boundary) that no test exercises, where a regression would ship silently. Name the specific case, not "coverage is low."
- **Untestable shape** — logic welded to I/O, time, randomness, or globals such that it cannot be tested without the whole world stood up. Flag when it blocks testing a real risk; point at the seam (inject the clock, the dependency) rather than demanding a rewrite.
- **Assertion gaps** — a test that runs the code but asserts nothing meaningful (snapshot of everything, `expect(fn).not.toThrow()` as the only check), giving false confidence. Report the specific behavior left unverified.

Do not manufacture a coverage finding for exhaustively-tested code or for trivial glue. Missing a test for a getter is not a finding; missing the test for the one branch that handles the failure case is.

## Report shape

For each surviving finding give: **what** (the defect in one line), **where** (file:line), **why it matters** (the concrete consequence — the input, path, or interleaving), and **the fix** (the smaller change, or the existing helper to reuse) **named as a handoff, not performed** — quote the remediation cell for that row, so a Tier-2 finding arrives at `../../loop-pattern` with its catalogue entry already chosen. Rank Tier 1 above Tier 2, most-severe first. When in doubt between reporting and dropping, drop — the same discipline as the security side (`methodology.md` → *The reporting bar*, and the verification pass in `../../loop-engine/references/harness-policy.md` H4 for workflow-scale runs).
