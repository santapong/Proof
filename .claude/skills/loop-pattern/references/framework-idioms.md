# Framework idioms — using an already-chosen framework the way it intends

**Charter line: this file is about the idiomatic use of a framework that is ALREADY in the project. It never evaluates whether to adopt one.** React, Django, and Spring appear below strictly as *targets of idiomatic-usage checks* — never as candidates being compared. Choosing among frameworks before adoption is **`loop-scout`**, and the split is decidable from one file: if answering the question adds a line to `package.json` / `requirements.txt` / `pom.xml` / `build.gradle`, it is `loop-scout`; if the dependency is already there, it is this skill (`../SKILL.md` opening).

That distinction matters because this is the one axis of this skill that cites **authoritative** sources. The GoF and Fowler catalogs are books (`standards.md`), and code cannot be "in violation" of a book. **Rules of React, Django's design philosophies, and the Spring reference are the maintainers describing the contract their own framework requires** — a violation there is a defect against a normative source, and often a real bug rather than a matter of taste.

> **Freshness warning — read before citing anything here.** This file ages faster than `design-patterns.md` and `refactoring-catalog.md`. Those rest on GoF (1994) and Fowler 2e (2018), which have been stable for years. The sources below have **no edition numbers at all**: React's *Rules of React* page is itself a consolidation that replaced the older *Rules of Hooks* framing, Django's docs track the current release, and Spring's DI and stereotype guidance moves across majors (6.x → 7.x). **Confirm against the docs for the version the target project is actually on before calling something non-idiomatic**, and put this file on a shorter re-check cycle than the other two references. It is a pointer to living documentation, not a frozen snapshot of it.

## React — Rules of React

Source: **Rules of React**, `react.dev/reference/rules` (supersedes the legacy *Rules of Hooks* page; confirmed live July 2026). Authoritative.

React's rules are not stylistic. The framework's correctness — memoization, re-render skipping, concurrent rendering, Strict Mode's double-invocation, and the compiler's ability to optimize — depends on components obeying them. Breaking one buys a bug that shows up as a hard-to-reproduce rendering artifact, which is why these are the highest-value checks in this file.

| Rule | The violation looks like | Treatment |
|---|---|---|
| **Components and hooks must be pure** | Rendering mutates a module-level variable, writes to a ref, mutates a prop or a value from state, or reads something that changes without being state | Move the effect out of render; derive rather than mutate; make the changing input a piece of state or a prop |
| **Props and state are immutable** | `props.items.push(...)`, `state.user.name = …` before `setState` | Copy-then-set, or a state updater that returns a new value |
| **Never mutate values after they are passed to JSX** | An array built during render, passed as a prop, then sorted in place | Build the final value before it is handed over |
| **Side effects run outside render** | A fetch, a subscription, a DOM write, or logging in the component body | Move to an event handler when it is caused by an interaction; to an effect only when it is genuinely a synchronization with an external system |
| **Hooks are called at the top level, unconditionally, in the same order** | A hook inside `if`, a loop, or after an early `return`; a hook called from a plain function | Hoist the call; make the *value* conditional, not the call; extract a custom hook |
| **Hooks are called only from components or other hooks** | `useState` in a helper function or a class method | Extract a custom hook (`useX`) or move the logic to the component |

**Two conventions beyond the rules page**, treated here as strong idioms rather than normative rules:

- **Composition over inheritance.** React has no idiomatic component inheritance. Variation is expressed with `children`, render props, and composition. A class-hierarchy-shaped component tree is fighting the framework (§4).
- **Colocated state, lifted only as far as needed.** State lives in the lowest component that needs it, and is lifted to the nearest common ancestor only when two siblings genuinely share it. The smell in both directions: everything in a top-level store (props drilled through six layers that do not care), or duplicated state in two siblings that must be kept in sync by hand.

**A note on effects, because it is the most common misuse:** an effect that only computes a value from props and state should not exist — compute during render. An effect that responds to a user action belongs in the event handler. Effects are for synchronizing with something outside React.

## Django — design philosophies and ORM idiom

Source: **Django Design Philosophies**, `docs.djangoproject.com`, `/misc/design-philosophies/`, tracking the current release. Authoritative. **Not to be confused with Django's contributor coding-style document**, which governs contributions to Django itself, not your application.

| Idiom | The violation looks like | Treatment |
|---|---|---|
| **Fat model, thin view** | Business rules living in views: a 120-line view computing eligibility, totals, and side effects | *Move Function* onto the model or a manager/queryset method; the view resolves input, delegates, and renders |
| **Custom managers and querysets for reusable queries** | The same `.filter(status='active', deleted_at__isnull=True)` in eight views | A queryset method (`Order.objects.active()`); the rule then has one home |
| **`select_related` / `prefetch_related` are the intended access pattern** | The N+1: a template or loop touching `order.customer.name` per row with no join | `select_related` for forward FK/one-to-one, `prefetch_related` for reverse and many-to-many. This is the framework's own answer to a problem it deliberately exposes — hand-rolling a cache instead is fighting it |
| **Class-based-view intent** | A `ListView` subclass overriding `get()` wholesale to do everything by hand — a CBV in name only | Use the extension points (`get_queryset`, `get_context_data`, mixins) — or use a function view honestly, which is a legitimate choice, not a fallback |
| **Forms and validators own validation** | Hand-parsing `request.POST` and validating with ad-hoc `if`s | A `Form`/`ModelForm` or DRF serializer; model-level validators for invariants |
| **Migrations are the schema's source of truth** | Hand-edited SQL, or model changes without a migration | Generate and review migrations; treat them as reviewable artifacts |
| **Loose coupling, "explicit is better than implicit"** (from the philosophies page) | A template reaching into the ORM, or a model importing view code | Keep the layer boundary; pass prepared data into the template |

**Where the ORM idiom stops.** Django's docs are explicit that the ORM is not meant to cover every query. A genuinely complex analytical query written as raw SQL behind a manager method is *idiomatic*; twelve chained `annotate`/`Subquery` calls nobody can read to avoid writing SQL is not. Wrapping raw SQL in a manager method keeps the layer boundary intact, which is the philosophy the escape hatch has to respect (§5).

## Spring — stereotypes, injection, and bean lifecycle

Source: **Spring Framework Reference Documentation**, `docs.spring.io/spring-framework/docs/current`, pinned in `standards.md` at **7.0.x** (current major as of July 2026). Authoritative — **but confirm the target's actual version**, since DI guidance has shifted across 6.x and 7.x.

| Idiom | The violation looks like | Treatment |
|---|---|---|
| **Stereotype the bean by its role** | Everything annotated `@Component`, so the layer a class belongs to is invisible | `@Service` for application logic, `@Repository` for persistence (it also brings exception translation), `@Controller` / `@RestController` for the web layer, `@Configuration` for wiring. The stereotype is documentation the container also reads |
| **Constructor injection over field injection** | `@Autowired` on private fields | Move dependencies to the constructor: the object is valid on construction, the fields become `final`, and it can be instantiated in a plain unit test with no container. This is the framework's own documented recommendation, and it is the same treatment as the Dependency Inversion example in `solid-and-style.md` §4 — here it carries an authoritative citation on top of the principle |
| **A single constructor needs no `@Autowired`** | Ceremonial annotation on the only constructor | Delete it; Spring infers the injection point |
| **Bean lifecycle via the container** | A `@Component` calling `new` on its collaborators, or a static holder returning a singleton | Let the container construct and inject; the composition root is the configuration, not the class |
| **`@Transactional` at the service boundary, understood** | `@Transactional` on a private or self-invoked method, expecting it to apply | Proxy-based advice does not intercept self-invocation. Put the boundary on the public entry point, or split the collaborator out |
| **Configuration through the property/profile mechanism** | Environment-sniffing `if`s inside beans | `@ConfigurationProperties`, profiles, conditional beans |
| **Field injection defended as "needed for tests"** | Reflection-based test setup poking private fields | Constructor injection makes the test simpler, not harder — this defence usually indicates the class has too many dependencies (a *Large Class* smell, `refactoring-catalog.md` §1) |

## 4. "Fighting the framework" as its own smell category

This is a smell class in the sense of `refactoring-catalog.md` §1 — evidence that a treatment is warranted — and it is the most valuable diagnostic in this file, because it catches problems the language-level smells miss entirely. Code can be perfectly clean by Fowler's taxonomy and still be working against the framework in every file.

Tells:

- **Reimplementing framework-provided machinery** — a hand-rolled DI container inside a Spring app; a bespoke query cache instead of `select_related`; a custom state-sync layer instead of React state; hand-written form validation next to an unused form class.
- **Working around a documented convention rather than using it** — bypassing the ORM because "the query builder is limiting", overriding a lifecycle method wholesale to defeat its intended sequence, or defeating a framework's change detection with a manual refresh.
- **Reaching for reflection, monkey-patching, or private APIs** to make the framework do something it exposes a public way to do.
- **Ceremony with no payoff** — an inheritance layer over the framework's own base classes that adds nothing but a name.
- **The upgrade tell**: minor-version upgrades of the framework routinely break the code. That is the signature of depending on internals rather than the public contract, and it is the most expensive form of this smell.

**The cost is concrete, which is what makes it a finding rather than a preference:** framework-fighting code loses the framework's optimizations, breaks on upgrade, and cannot be maintained by anyone who knows the framework but not your workaround. State the cost that way, not as "this isn't idiomatic".

**Treatment** is the ordinary discipline: name the smell, confirm the safety net (`refactoring-catalog.md` §3, tests delegated to `loop-test`), replace the workaround with the framework's mechanism in small steps, and prove behavior held. **Deleting a hand-rolled mechanism in favour of the framework's own is usually the single highest-value refactor available in a framework codebase** — it removes code rather than adding it, and it is the opposite of the pattern-happy failure mode in `design-patterns.md` §4.

## 5. The escape hatch — deliberate deviation, named and justified

These are idioms, not mandates — the same stance `loop-design` takes on principles. A framework's documented convention is a strong default that carries the maintainers' authority, and there are real reasons to depart from it. Departing *silently* is what is forbidden.

**A deliberate deviation must:**

1. **Name the idiom it departs from**, with the source and the framework version (`standards.md`).
2. **State the concrete reason** — a measured performance requirement, a platform constraint, an interoperability need, a documented framework limitation. "We prefer it this way" is not a reason; neither is unfamiliarity with the idiom.
3. **Be recorded where the next reader will find it** — a comment at the deviation, and an ADR (`loop-design`) when it is architectural.
4. **Be bounded** — one module, one seam, not a house style that quietly replaces the framework's conventions everywhere.
5. **Be revisited** when the framework version moves. Deviations justified by a limitation outlive the limitation; that is how a workaround becomes folklore.

**A recorded deviation is not a smell and this skill leaves it alone.** If you find one that is undocumented, the highest-value output may be to document it rather than to "fix" it — the reason may be real and simply unwritten. Ask before deleting a workaround whose justification you cannot reconstruct: an undocumented workaround that turns out to be load-bearing is exactly the behavior change that must go to `loop-debug` rather than be absorbed into a refactor (`../SKILL.md` §4).
