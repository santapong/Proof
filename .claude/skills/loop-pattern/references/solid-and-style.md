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

## 5. Over-application — when the principle is the smell

§1 states its caveats prospectively — advice for the hand about to cut. This section is the retrospective: the codebase where the cutting already happened, every cut passed review, and the principle's name now defends the damage. `design-patterns.md` §4 catalogs this failure at the pattern level; this section is the principle-level index into the same disease, filed under the justification that shipped it. That is what makes over-application expensive to reverse — each individual split, interface, and injection was locally defensible, so no single diff introduced the defect and no single diff is blamed for it. Only the aggregate is wrong, and the aggregate has a shared tell: **the indirection count grew while the reasons-to-change count did not.**

One entry per letter. Each names the legitimate core — so the walk-back does not overshoot into the opposite failure — the over-applied form that actually ships, the signal that detects it, and the move that walks it back. The named moves are all from `refactoring-catalog.md`; walking back is a refactoring, not a demolition.

| Principle | Legitimate core | The over-applied form that ships | Detection signal | Walk-back |
|---|---|---|---|---|
| **SRP** | One *reason to change* per module (§1) | **Shotgun fragmentation** — one class per method, each "responsibility" a single verb, the behavior of one feature smeared across forty files | Tracing one user action opens a dozen files, none longer than a screen; every real change is a multi-file sweep — *Shotgun Surgery* installed on purpose and called architecture | *Inline Class* and *Inline Function* until each file changes for one reason again. Recombine along reasons-to-change, never along file size — a 400-line class with one reason to change is compliant; forty 10-line classes that always change together are not |
| **OCP** | An extension point where the cases are demonstrably multiplying (§1) | **Speculative plugin architecture** — registries, hook systems, strategy slots, `config`-driven class lookup that nobody has ever plugged a second thing into | An extension point with exactly one registered extension; a lookup that always resolves to the same class; history shows the point was added long ago and no second case ever arrived | Delete the mechanism and inline the one case (*Inline Class*, *Collapse Hierarchy* — this is *Speculative Generality*, removed). Re-adding the point when the second case actually arrives is cheap; carrying it for years while nothing arrives is not |
| **LSP** | Substitutability as a contract the caller can rely on (§1) | Two forms. **Inheritance-for-code-reuse**: subclassing to steal methods, the base contract never honored — the violation hides until a caller holds the supertype. **The composition escape**: fleeing the LSP critique into a mechanical forwarding wrapper that delegates every method, reproducing the coupling with more lines | Overrides that throw or no-op (*Refused Bequest*, §1); callers type-checking a supertype reference. For the escape: a wrapper whose surface is identical to its delegate's, all one-line forwards | For the real violation, *Replace Subclass with Delegate* (§1). For the forwarding shell, *Remove Middle Man*. The discriminator: a pure-forwarding wrapper earns its keep only when its surface is **narrower** than the delegate's — an equal-width forwarder that adds no behavior is inheritance with extra steps. Equal width *with* added behavior is Decorator or Proxy territory (`design-patterns.md` §1), a different diagnosis |
| **ISP** | Role interfaces for several clients with genuinely different needs (§1) | **Interface-per-method explosion** — `OrderSaver`, `OrderLoader`, `OrderDeleter`, `OrderCounter`; every class implements five one-method interfaces and every caller imports three handles to the same object | More interfaces than concrete classes; interface names that are the verb+noun of exactly one method; call sites that receive the same object under multiple types and cast between them | Merge back to role interfaces — one per *client need*, not one per method. A role is defined by who consumes it: if no two clients need different subsets, the role is the whole class and the interface count is zero or one |
| **DIP** | Depend on an abstraction where something actually varies — including a genuinely needed test seam (§4) | **The indirection tax** — an interface for every class, exactly one implementation each, bound in a container by config or reflection. Go-to-definition lands on the interface; what actually runs is discoverable only by reading wiring. Navigable by nobody | Interface-to-implementation ratio near 1:1 across the repo; the only "second implementation" anywhere is a mock a mocking library could have produced from the concrete class; new engineers ask where things are constructed and nobody answers from memory | Inline the one-implementation interfaces and **keep the constructor injection** — §4's stopping point already ruled that injection is the win and the abstraction is the optional part. Retain abstractions only at genuine seams: I/O, vendors, anything a test must fake and cannot fake concretely |

**The walk-back discipline.** A walk-back is a refactoring like any other: safety net first, behavior-preserving steps, tests green after each, landed separately from feature work (`refactoring-catalog.md` §2–§4). And it walks back to the legitimate core, not past it — the cure for ten interfaces is two role interfaces, not zero; the cure for forty fragments is four classes, not one. Overshooting the walk-back just schedules the next swing of the pendulum.

**The rule: principles are pressure gauges, not laws.** A gauge is read against a cost — it tells you where pressure is building: a class changing for two unrelated reasons, a switch edited in three places, a test that cannot run without a database. The reading is actionable only when the cost it predicts is one you would actually pay. A law is complied with regardless of cost, and compliance can always be increased — more splits, more interfaces, more indirection — which is exactly why every form in the table ships: each one is what *more compliance* looks like when nobody is reading the gauge. This file's opening already states the operating mode: **the principle is never the finding; the smell is.** When the code exhibits no smell and the principle is the only justification on offer, the principle is being read as a law — and the correct gauge reading is zero.
