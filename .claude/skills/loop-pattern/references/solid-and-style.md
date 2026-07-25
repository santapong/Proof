# SOLID and language style — the *why* beneath the move

`refactoring-catalog.md` says *which* move; `design-patterns.md` says *which* pattern. This file says **why either is warranted** and what the resulting code should look like in its own language.

Two halves, and the seam between them is §3:

- **§1 SOLID** — the principle-level lens. A principle is never the finding; the smell is. The principle is how you explain *why* the smell costs something and *which* treatment addresses the cause rather than the symptom. **Strategy answers an Open/Closed violation. Constructor injection answers a Dependency Inversion violation.** Reason principle-first and you avoid pattern-for-pattern's-sake, which is exactly the failure mode `design-patterns.md` §4 exists to prevent.
- **§2 Style sources** — the idiom substrate. Naming, layout, and API shape, so an applied pattern reads as native code rather than a transplant.

All sources named here are pinned in `standards.md`. Note the honest split recorded there: **SOLID has no issuing body and no version** — it is a synthesis, cited to explain, never to mandate.

## 1. SOLID, one principle at a time

### S — Single Responsibility Principle

**The principle.** A module should have one reason to change. The useful formulation is about *actors*: gather the things that change for the same reason, separate the things that change for different reasons.

**The smell it answers.** *Divergent Change* (`refactoring-catalog.md` §1) — one class edited for unrelated reasons — and, from the other side, *Large Class*.

**Before / after.** `Invoice` computes tax, formats itself as PDF, and persists itself. A tax-rule change, a layout change, and a schema change all edit one file, and each one re-tests the other two. **After:** `Invoice` (the data and its rules), `TaxCalculator`, `InvoicePdfRenderer`, `InvoiceRepository` — via *Extract Class* plus *Move Function*. A tax change now touches one file.

**The caveat, stated because this is the most abused of the five.** "One responsibility" is not measurable, and two competent engineers will draw the line differently. Do not cite SRP to justify splitting a coherent class into anaemic fragments — over-application produces *Lazy Element* and *Shotgun Surgery*, trading one smell for two. Cite it only when you can name **two concrete, unrelated reasons this file has changed** — reach for the file's history if you need the evidence.

### O — Open/Closed Principle

**The principle.** Open for extension, closed for modification: adding a case should add code, not edit existing code.

**The smell it answers.** *Repeated Switches* — the same conditional on the same type code in several places, where every new case means finding and editing all of them.

**Before / after.** `switch (customer.tier)` in three modules; a new tier is a three-file hunt with one always missed. **After:** a `DiscountPolicy` per tier and a single lookup — adding a tier is one new class and one registration. The full step sequence is `design-patterns.md` §5.

**The caveat.** OCP is bought with indirection, and indirection is not free. It is worth paying when the extension point is *demonstrated* — the cases are already multiplying. Paying it for a switch with two arms that has never changed is the *Speculative Generality* smell, which is the same mistake with a principle attached.

### L — Liskov Substitution Principle

**The principle.** A subtype must be usable anywhere its supertype is, without the caller knowing. Strengthening a precondition, weakening a postcondition, throwing where the base does not, or ignoring inherited state all break it. This is the one principle with a formal grounding outside Martin's writing — Barbara Liskov's work on substitutability.

**The smell it answers.** *Refused Bequest* — a subclass that throws `UnsupportedOperationException`, no-ops an inherited method, or documents "do not call this on the subclass".

**Before / after.** `ReadOnlyAccount extends Account` overriding `withdraw()` to throw. Every caller holding an `Account` is now a potential crash and starts type-checking. **After:** *Replace Subclass with Delegate* — `ReadOnlyAccount` holds an `Account` and exposes only the read surface, so the type system carries the constraint instead of the runtime.

**The tell.** Callers that test the concrete type of a supertype reference (`instanceof`, `isinstance`, a type tag) are usually reporting an LSP violation, not a missing feature.

### I — Interface Segregation Principle

**The principle.** No client should be forced to depend on methods it does not use. Many small, role-shaped interfaces beat one wide one.

**The smell it answers.** Fat interfaces that force empty implementations, and the *Shotgun Surgery* that follows when adding one method edits every implementer.

**Before / after.** A twelve-method `Repository` interface where the reporting module needs two of them and every new implementation must stub ten. **After:** role interfaces (`OrderReader`, `OrderWriter`) that the concrete repository implements together — clients depend on the role they use, and a new method touches only the implementers of that role.

**The caveat.** Segregating an interface with one implementer and one client produces indirection with no payoff — `design-patterns.md` §4. The principle bites when there are several clients with genuinely different needs.

### D — Dependency Inversion Principle

**The principle.** High-level policy should not depend on low-level detail; both depend on an abstraction. In practice: the direction of the *source dependency* points away from the detail, and construction moves outward to a composition root.

**The smell it answers.** A class that constructs its own collaborators, which is both hard-coded coupling and the reason the class cannot be tested without a database, a network, or a clock.

**Before / after.** Worked in full in §4.

## 2. Language → canonical style source

Every row carries the same escape hatch, restated in §2's closing rule because it outranks everything in the table.

| Language | Canonical source | What it governs here | Note |
|---|---|---|---|
| **Python** | **PEP 8** (living PEP, `peps.python.org/pep-0008`; confirmed current July 2026) | Naming, layout, import order, line-level conventions | Authoritative — Python's own style guide. Where the repo runs a configured formatter, the formatter's output is the answer; do not hand-fight it. |
| **Java** | **Effective Java, 3rd ed. (Jan 2018)** + **Google Java Style** | Bloch: API and idiom shape (composition over inheritance, builders, enum singletons, equals/hashCode contracts). Google: formatting and naming | Neither is authoritative in `standards.md`'s sense. Effective Java 3e covers the language **through Java 9** — for records, sealed types, or pattern matching, apply the modern form and cite the Bloch item as the reason, not the recipe. |
| **Rust** | **Rust API Guidelines** (living checklist, `rust-lang.github.io/api-guidelines`; confirmed live July 2026) | Public API surface: naming (`C-CASE`, `C-CONV`), common trait impls, generic and trait conventions | The guidelines describe themselves as *guidelines, not a mandate*. Strong defaults for a published API; near-irrelevant for a crate-private helper. `rustfmt`/`clippy` defaults settle formatting. |
| **Go** | **Google Go Style Guide** | Naming, package layout, error-handling shape, doc comments | `gofmt` is not negotiable and is not a style question. Where the Go community's own idiom and the guide differ, prefer the community idiom the repo already follows. |
| **C++** | **Google C++ Style Guide** | Naming, headers, ownership conventions | Deeply opinionated and widely *not* followed outside Google. Cite only if the repo already follows it. |
| **TypeScript** | **Google TypeScript Style Guide** | Naming, module structure, type-declaration conventions | Same caution. The repo's `tsconfig` strictness and lint config are the operative constraints. |

**The defer-to-repo-convention rule.** A repo's own established convention **outranks every row above**. Order of precedence:

1. The repo's configured tooling — formatter, linter, `.editorconfig`, pre-commit hooks. Non-negotiable; it is enforced.
2. The repo's observed, consistent practice, even where it contradicts the guide.
3. The canonical source above, for anything the first two do not settle.

If a repo consistently does something one of these guides advises against, **matching the repo is correct**. Changing it repo-wide is churn, not a refactor (`refactoring-catalog.md` §5). Raise a genuine disagreement once, as a note — never as a batch of renames.

## 3. The seam: naming/formatting vs. structural change

This is where the boundary between this file and the other two is stated, because getting it wrong produces either noise or misfiled work.

**Style guides govern the surface**: identifier names, casing, layout, import order, doc-comment form, where braces go, whether a helper is public. These are settled by §2 and, in practice, by the repo's tooling. They are cheap, mechanical, and reviewable at a glance. A *Mysterious Name* fix (`refactoring-catalog.md` §1) lives here — it is the cheapest refactoring there is.

**`refactoring-catalog.md` and `design-patterns.md` govern the shape**: what is a function, what is a class, who owns which data, which module depends on which, how dispatch happens. These change the dependency graph, need the safety net, and are reviewed hunk by hunk.

**Rules at the seam:**

- **Do not ship them in the same diff.** A rename sweep mixed with an *Extract Class* makes both unreviewable: the reviewer cannot tell which hunks are mechanical and which carry risk. Style first or structure first, but separately.
- **A style-only change still needs a reason.** Reformatting a file the repo's tooling does not touch is churn. Prefer to fix style *inside* files you are already restructuring, and let the formatter own the rest.
- **A structural change adopts the local style as it lands.** New classes and functions from a refactor are named and laid out per §2 and per the repo — the pattern should be invisible as a transplant.
- **Do not escalate style into structure.** "This name is bad" does not license an *Extract Class*. The rename is the fix.

## 4. Worked example — a Dependency Inversion violation in constructor wiring

**Smell first.** `OrderService` constructs `new PostgresOrderRepository(connStr)` and `new SmtpEmailer(host, port)` in its constructor. The evidence, in order: the class cannot be instantiated in a test without a live database and an SMTP host; the connection string and mail host have leaked into a business-policy class; and swapping either implementation means editing `OrderService`. That is hard-coded coupling with a concrete cost, and the principle behind it is **Dependency Inversion** — high-level policy depending directly on low-level detail.

**Before:**

```
class OrderService:
    def __init__(self, conn_str, smtp_host, smtp_port):
        self._repo = PostgresOrderRepository(conn_str)
        self._emailer = SmtpEmailer(smtp_host, smtp_port)

    def place(self, order):
        self._repo.save(order)
        self._emailer.send(order.customer_email, render_confirmation(order))
```

**The steps** (each behavior-preserving, tests green after each — `refactoring-catalog.md` §2):

1. **Safety net.** Whatever tests exist over `OrderService` must be green first. If they only run against a live database, that itself is the untestable-shape case in `refactoring-catalog.md` §3 — `loop-test` writes the seam tests once step 3 makes them possible.
2. ***Extract Variable*** on the two constructions so each collaborator is built in one place and named.
3. ***Change Function Declaration*** — the constructor now takes `repo` and `emailer` and assigns them. Construction moves **out**, to the call sites. Behavior is identical: the same objects are built, one frame higher.
4. **Move construction to the composition root** — the application entry point, DI container, or factory that already knows about configuration. `conn_str`, `smtp_host`, and `smtp_port` leave `OrderService`'s signature entirely and stop being business-policy concerns.
5. **Depend on the abstraction, not the class.** Declare `OrderRepository` and `Emailer` (a protocol/interface/trait, per language) and type the parameters against them. `PostgresOrderRepository` and `SmtpEmailer` implement them. *Nothing about the running program changes* — this step is types only.

**After:**

```
class OrderService:
    def __init__(self, repo: OrderRepository, emailer: Emailer):
        self._repo = repo
        self._emailer = emailer

    def place(self, order):
        self._repo.save(order)
        self._emailer.send(order.customer_email, render_confirmation(order))
```

**What was bought.** `OrderService` names *what* it needs, not *what it is wired to*; a test supplies an in-memory repository and a recording emailer with no infrastructure; swapping Postgres for another store edits the composition root only. **What was paid.** Two interface declarations and a wiring site that must now be maintained.

**The framework note.** In Spring, step 5 *is* the framework's own idiom — constructor injection over field injection, with the concrete beans stereotyped `@Repository` / `@Component`; see `framework-idioms.md`. In that case the treatment is not merely a SOLID improvement, it is bringing the code in line with a documented, authoritative framework rule, which is a stronger citation.

**The stopping point.** If `OrderService` has exactly one collaborator with exactly one implementation and it is already testable, step 5 is `design-patterns.md` §4's one-implementer interface and you stop at step 4. The injection is the win; the abstraction is only worth it when something actually varies — including a test double, which counts, but only when the seam is genuinely needed.
