# Design patterns — the problem-shape index

The 23 patterns of *Design Patterns* (Gang of Four, 1994 — pinned in `standards.md`) are a **vocabulary for recurring problem shapes**, not a menu of good ideas. This file is organized around that: §1 is the catalog for orientation, §2 is the index you actually work from, §3 is how a pattern gets *into* working code, and §4 is how to get one back out.

**The rule this file enforces, stated once and applied throughout: a pattern is applied only when a recognized problem shape is ALREADY present in the code. Never speculatively.** "We might need to swap implementations later" is not a problem shape; three `if (type == …)` chains on the same type code is. If you cannot point at the shape in the existing source, the answer is no pattern — and adding one anyway is the failure mode §4 is about.

## 1. Catalog by family — the problem shape each answers

One line per pattern, naming the *problem*, not defining the *solution*. If none of these sentences describes your code, none of these patterns applies to it.

### Creational — object creation is coupling you to concrete types

| Pattern | The problem shape |
|---|---|
| **Abstract Factory** | Code must create whole *families* of related objects and must not know which family it is in. |
| **Builder** | Construction of one object takes many steps or many optional parameters, and the same steps must yield different representations. |
| **Factory Method** | A class must create a collaborator but cannot know its concrete type; subclasses decide. |
| **Prototype** | New instances are cheaper or clearer to make by copying an existing configured instance than by constructing one. |
| **Singleton** | Exactly one instance must exist and be globally reachable. *Usually a smell in modern code* — it is global mutable state with a nicer name, it fights dependency injection, and it makes tests order-dependent. Prefer a single instance supplied by the container or composition root. |

### Structural — objects need to be composed, wrapped, or hidden

| Pattern | The problem shape |
|---|---|
| **Adapter** | Two interfaces that must work together do not match, and you cannot change either. |
| **Bridge** | An abstraction and its implementation both vary, and inheritance would give you a combinatorial class explosion. |
| **Composite** | Clients must treat individual objects and compositions of objects uniformly (a tree). |
| **Decorator** | Responsibilities must be added to individual objects at runtime without subclassing every combination. |
| **Facade** | A subsystem is correct but its surface is too wide for the common case. |
| **Flyweight** | Very many objects differ only in a little state, and the shared part dominates memory. |
| **Proxy** | Access to an object must be controlled, deferred, or made remote without the client noticing. |

### Behavioral — responsibility and communication need a shape

| Pattern | The problem shape |
|---|---|
| **Chain of Responsibility** | Several handlers might process a request and the sender must not know which one does. |
| **Command** | A request must be turned into an object — to queue it, log it, undo it, or parameterize a caller with it. |
| **Interpreter** | A simple, stable language recurs and its grammar is worth representing as a class hierarchy. Rare; usually a parser generator wins. |
| **Iterator** | Elements of an aggregate must be traversed without exposing its representation. Built into most modern languages — apply the language's construct, not the pattern by hand. |
| **Mediator** | Many objects reference each other directly and the resulting graph is unmaintainable. |
| **Memento** | An object's state must be captured and restored later without breaking encapsulation. |
| **Observer** | State change in one object must notify an unknown, varying set of dependents. |
| **State** | An object's behavior changes with its internal state, and the transitions are scattered across conditionals. |
| **Strategy** | A family of interchangeable algorithms is selected at runtime, currently by a conditional. |
| **Template Method** | Several variants share an algorithm skeleton and differ only in specific steps. |
| **Visitor** | New operations must be added over a stable object structure without editing every class in it. |

## 2. Problem shape → pattern index

**This index, not the catalog, is what you read at work time.** Diagnose from the symptom in the left column.

| What the code looks like | Pattern to consider | Watch out for |
|---|---|---|
| `new ConcreteThing()` scattered through code that should not know the concrete type | **Factory Method**; **Abstract Factory** when related objects must vary together | A factory for exactly one concrete type is indirection with no payoff (§4). |
| A conditional on a **type code** or enum selecting *which algorithm to run*, repeated in several places | **Strategy** | If the conditional runs once and never repeats, a function parameter beats a class hierarchy. |
| A conditional on the object's own **lifecycle state**, with transitions scattered | **State** | State and Strategy have the same shape; State's objects change *which* one is current, Strategy's are chosen by the caller. |
| Two interfaces that must interoperate and neither can change | **Adapter** | If you *can* change one, changing it is simpler than adding a class. |
| Optional behavior added in varying combinations; a subclass per combination is looming | **Decorator** | Two decorators whose order matters and is undocumented is a bug factory. |
| A wide subsystem where callers repeat the same five-call sequence | **Facade** | A facade that grows a method per caller has become the subsystem again. |
| Objects and groups of objects handled by near-identical code paths | **Composite** | Only when the recursion is real; a two-level structure does not need it. |
| One change must notify a set of listeners the source should not know about | **Observer** (or the platform's event/stream primitive) | Language and framework mechanisms usually beat hand-rolling it. |
| Construction with many optional parameters, or telescoping constructors | **Builder** | In languages with named/default parameters this is often unnecessary. |
| An algorithm skeleton duplicated across siblings, differing in a few steps | **Template Method**, or **Strategy** for composition over inheritance | Inheritance couples the variants to the skeleton forever; prefer Strategy when the steps vary independently. |
| A new operation must be added over a stable, closed set of node types | **Visitor** | Only when the *type set* is stable and *operations* vary. If types vary more, Visitor is exactly backwards. |
| Objects wired into a dense many-to-many mesh | **Mediator** | A mediator that knows everything is a God Class with a pattern name (`refactoring-catalog.md` §1). |
| An operation must be undoable, queueable, or replayable | **Command** | Only if you actually need one of those three. |
| Cross-cutting access control, laziness, caching, or remoting around an existing object | **Proxy** | Often better served by the framework's interception or middleware. |

Two patterns worth naming as a pair, because they are the ones most often mixed up: **Strategy is chosen by the client; State changes itself.** If the object decides which behavior comes next, it is State.

## 3. Refactoring to patterns — how a pattern gets into working code

**Never as a big-bang rewrite.** A pattern is introduced through a sequence of small, individually behavior-preserving moves from `refactoring-catalog.md`, each with the tests green after it. That way the change is reversible at any step, and a red suite localizes to the last move rather than to "the rewrite".

The generic sequence:

1. **Name the smell first**, from `refactoring-catalog.md` §1 — usually *Repeated Switches*, *Large Class*, *Duplicated Code*, or *Divergent Change*. This is the §1 gate of `../SKILL.md`; without it, stop.
2. **Confirm the safety net** is green over the target (`refactoring-catalog.md` §3; tests delegated to `loop-test`).
3. **Isolate the varying part.** *Extract Function* on each branch or each varying step, so the thing that differs has a name and a boundary. Usually the largest single step, and often enough on its own — many "we need a pattern here" situations dissolve at this point, which is why it comes before introducing any type.
4. **Normalize the signatures.** *Change Function Declaration* until every extracted piece has the same shape. A pattern is only possible once the variants are interchangeable.
5. **Introduce the type.** Add the interface/abstract class and one implementation. Do not move anything yet.
6. **Move one variant at a time.** *Move Function* one branch into its implementation, run the tests, repeat. This is the step that must not be batched.
7. **Replace the dispatch.** Once every variant has moved, swap the conditional for the polymorphic call (*Replace Conditional with Polymorphism*) — a small step, because everything else already moved.
8. **Remove the scaffolding.** *Remove Dead Code*, *Inline Function* on anything the pattern made redundant, and delete the old type code if nothing reads it.

Steps 3–7 are each a green commit. If you cannot get to green between two of them, the step was too large — split it.

## 4. The anti-pattern: pattern-happy code

Applying patterns has a well-known failure mode, and it runs directly against the anti-over-engineering position `loop-scout` and `loop-design` take. This skill does not get to contradict its siblings, so the guardrail is explicit: **every pattern application cites the problem shape it answers, in the code, today.**

Recognize pattern-happy code by these tells:

- **A Factory (or Abstract Factory) for one concrete type**, with no second type in the codebase and none required.
- **An interface with exactly one implementer**, created "for testability" where the language's test tooling can already substitute the concrete type — or worse, mirrored one-to-one with its single implementation so every signature change edits two files.
- **A Strategy hierarchy over a conditional that never repeats and never varies.**
- **Indirection you cannot trace**: reading a value takes four hops through classes that only forward.
- **Configuration or registration ceremony** whose only job is to wire an abstraction with one option.
- **Pattern names in class names** (`OrderProcessingStrategyFactoryImpl`) doing the work that domain names should do.
- **Speculative hooks** — an abstract method nobody overrides, a parameter nobody varies. This is *Speculative Generality* (`refactoring-catalog.md` §1) and it is a smell in its own right.

**Simplifying back out is a legitimate output of this skill, and often the better one.** The moves are the same catalog, run in reverse: *Inline Class*, *Inline Function*, *Collapse Hierarchy*, *Remove Dead Code*, *Change Function Declaration* to drop unused parameters, *Replace Subclass with Delegate* where a hierarchy exists for one variant. Same discipline: small steps, tests green after each, behavior identical.

The honest test before adding any pattern: **name the second case.** If you cannot point at a real, existing second algorithm, second family, or second implementation, you are describing a future you do not have, and the pattern is a cost you pay now for a benefit that may never arrive.

## 5. Worked example — Strategy replacing a growing conditional

**Smell first (this is not optional).** In `PricingService`, a `switch (customer.tier)` selects the discount calculation. The same switch on `customer.tier` also appears in `InvoiceRenderer` and in `QuoteBuilder`. That is **Repeated Switches** (`refactoring-catalog.md` §1). The principle behind it: adding a tier means editing three files that have nothing to do with each other — an **Open/Closed** violation (`solid-and-style.md` §1). Two independent citations, so the gate is passed.

Starting point, roughly:

```
discountFor(customer, amount):
    switch customer.tier:
      case STANDARD: return 0
      case GOLD:     return amount * 0.05
      case PARTNER:  return amount * 0.10 + partnerBonus(customer)
```

**Step 1 — safety net.** Run the pricing tests. Green, and they cover all three tiers. (If they did not, `loop-test` writes the missing cases first — `refactoring-catalog.md` §3.)

**Step 2 — Extract Function per branch.** `standardDiscount(customer, amount)`, `goldDiscount(customer, amount)`, `partnerDiscount(customer, amount)`. The switch now has one call per arm. Tests green. Commit.

*This is the step that most often ends the job.* If the three functions are trivial and the switch exists in exactly one place, stop here — you have removed the duplication and a Strategy hierarchy would be the §4 failure mode.

**Step 3 — Change Function Declaration to align them.** All three now take `(customer, amount)` and return a decimal, even where a parameter is unused. Interchangeable signatures are a precondition for the pattern. Tests green. Commit.

**Step 4 — Introduce the type.** Add a `DiscountPolicy` interface with `discount(customer, amount)` and one implementation, `StandardDiscountPolicy`, delegating to the extracted function. Nothing calls it yet. Tests green. Commit.

**Step 5 — Move one variant at a time.** *Move Function* `goldDiscount` into `GoldDiscountPolicy`. Tests green. Commit. Repeat for `partnerDiscount`. **Do not batch these** — one move, one run, one commit.

**Step 6 — Replace Conditional with Polymorphism.** Introduce the lookup from tier to policy (a map in the composition root, or a field on the tier enum — the map keeps the tier type free of pricing knowledge). `discountFor` becomes `policyFor(customer.tier).discount(customer, amount)`. Tests green — *the same tests, unchanged*, which is the proof that behavior held. Commit.

**Step 7 — Propagate and clean up.** `InvoiceRenderer` and `QuoteBuilder` now call through the same lookup; their switches disappear. *Remove Dead Code* on the original per-tier branches. Tests green. Commit.

**What was bought.** Adding a tier is now one new class plus one map entry, in one place — the Open/Closed violation is gone and the Repeated Switches smell with it. **What was paid.** Three classes, one interface, and one lookup where there used to be one switch. That trade is only worth it because the switch was repeated *three times* and tiers demonstrably get added. With one switch and a stable tier set, step 2 was the correct stopping point — and knowing where to stop is the substance of §4.
