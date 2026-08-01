# The refactoring catalog, indexed by smell

The spine of this skill. Fowler's *Refactoring*, 2nd edition (2018) — pinned in `standards.md` — organizes the craft as **smell → named move**, and that ordering is load-bearing: the smell is the *evidence* that a change is warranted, and the move is the *treatment*. Reverse the order and you get a refactor looking for a justification.

**The rule this file enforces: no smell, no refactor.** Name the smell from §1 before you touch anything. If nothing in §1 fits, there is no work here.

**The constraint this file enforces: behavior preservation.** A refactoring changes the structure of code without changing its observable behavior. **A refactor is not complete until it is proven behavior-identical against the safety net** (§3) — same tests, unchanged, green before and green after. Not argued, not "obviously equivalent". Run them.

Move names below are 2nd-edition names; where 2e renamed a move or a smell, the 1st-edition name is in parentheses so a reader working from the older book can follow.

## 1. Code smell → refactoring index

Find the smell first. The right-hand column is the *opening* move, not the whole job — most real cleanups are a short sequence (§2).

### Bloaters — the code has grown past its shape

| Smell | You see… | Opening move |
|---|---|---|
| **Long Function** (1e: Long Method) | A function you must scroll, or read twice to state what it does; comments introducing "sections" | **Extract Function** on each named section; **Replace Temp with Query**, **Introduce Parameter Object**, **Decompose Conditional** to shrink what is left |
| **Long Parameter List** | Five-plus parameters, or parameters that always travel together | **Introduce Parameter Object**, **Preserve Whole Object**, **Replace Parameter with Query**, **Remove Flag Argument** |
| **Large Class** (God Class) | One class holding several unrelated responsibilities, with fields only some methods touch | **Extract Class** along the field/method clusters, then **Move Function** / **Move Field**; **Extract Superclass** when the split is is-a rather than has-a |
| **Primitive Obsession** | Strings and ints carrying domain meaning — a `String currency`, a raw `int` for money, validation of the same format in six places | **Replace Primitive with Object**; **Replace Type Code with Subclasses** when the primitive selects behavior |
| **Data Clumps** | The same three or four values passed together everywhere | **Extract Class** for the clump, then **Introduce Parameter Object** / **Preserve Whole Object** at the call sites |

### Change preventers — one change forces many edits

| Smell | You see… | Opening move |
|---|---|---|
| **Divergent Change** | One module changed for several unrelated reasons — a pricing change and an export-format change both edit the same class | **Split Phase**, then **Extract Class** so each reason for change owns its own module |
| **Shotgun Surgery** | One conceptual change forces small edits across many files | **Move Function** / **Move Field** to pull the scattered behavior together, **Combine Functions into Class** or **Combine Functions into Transform**; **Inline Function**/**Inline Class** when the scatter came from over-splitting |
| **Parallel Inheritance Hierarchies** | Every new subclass on one side forces a matching subclass on the other | **Move Function** / **Move Field** to collapse one side into the other |

Divergent Change and Shotgun Surgery are duals and are constantly confused. **Divergent Change: one module, many reasons to change → split it. Shotgun Surgery: one reason to change, many modules → gather it.** Diagnose by asking which side of that sentence you are on.

### Couplers — the code reaches across boundaries

| Smell | You see… | Opening move |
|---|---|---|
| **Feature Envy** | A function more interested in another object's data than its own | **Move Function** to the data; **Extract Function** first if only part of it is envious |
| **Message Chains** | `a.getB().getC().getD()` | **Hide Delegate**; **Extract Function** + **Move Function** when the chain exists to do a job |
| **Middle Man** | A class that only delegates | **Remove Middle Man**, **Inline Function**, **Replace Superclass with Delegate** |
| **Insider Trading** | Modules trading private data behind their interfaces | **Move Function** / **Move Field**, **Hide Delegate**, or extract the shared concern into its own module |

### Dispensables and OO abusers

| Smell | You see… | Opening move |
|---|---|---|
| **Duplicated Code** | The same expression, function body, or rule in two places | **Extract Function**; **Pull Up Method** for sibling subclasses; **Slide Statements** first to make the duplicates adjacent and identical |
| **Repeated Switches** (1e: Switch Statements) | The same `switch`/`if`-chain on the same type code in several places | **Replace Conditional with Polymorphism** — see `design-patterns.md` §5 for the worked sequence |
| **Speculative Generality** | Abstract classes with one implementer, hooks nobody calls, parameters nobody varies | **Collapse Hierarchy**, **Inline Function**, **Inline Class**, **Remove Dead Code**, **Change Function Declaration** to drop unused parameters |
| **Lazy Element** | A class or function that no longer earns its own existence | **Inline Function**, **Inline Class**, **Collapse Hierarchy** |
| **Temporary Field** | A field set only in some circumstances | **Extract Class** for the field cluster, **Introduce Special Case** for the null-ish path |
| **Data Class** | Fields and accessors only, with the behavior living in callers | **Move Function** to the data; **Encapsulate Record**, **Encapsulate Collection**, **Remove Setting Method** |
| **Refused Bequest** | A subclass that ignores or throws on inherited members | **Replace Subclass with Delegate**, **Replace Superclass with Delegate**, or **Push Down Method**/**Push Down Field** |
| **Alternative Classes with Different Interfaces** | Two classes doing the same job with different signatures | **Change Function Declaration** to align them, **Move Function** to even them out, then **Extract Superclass** |
| **Mysterious Name** (new in 2e) | A name that does not say what the thing is | **Rename Variable**, **Rename Field**, **Change Function Declaration** — the cheapest refactoring there is, and skipped far too often |
| **Comments** | A comment explaining *what* a block does | **Extract Function** named after the comment; the comment usually deletes itself. A comment explaining *why* is not a smell — keep it |
| **Global Data / Mutable Data** (new in 2e) | State reachable and writable from anywhere | **Encapsulate Variable** first, then **Split Variable**, **Remove Setting Method**, **Replace Derived Variable with Query**, **Combine Functions into Class** |
| **Loops** (new in 2e) | A loop doing several things at once | **Split Loop**, then **Replace Loop with Pipeline**; **Extract Function** on each resulting stage |

## 2. Mechanics discipline

The catalog's value is in its **mechanics** — each move's step list — not in its names. The names are how you talk about it; the steps are how you avoid breaking it.

1. **One small step at a time.** A step is small enough that you can say what it changed in one sentence. "Extract this class" is a goal; "add the new class, move one field, update its readers" are steps.
2. **Run the tests after *each* step**, not after the sequence. The point of small steps is that a red suite localizes to the last step you took. Batch five steps and you have thrown that away, which is the entire cost model of refactoring inverted.
3. **Never mix a refactoring step with a behavior change.** Fowler's two-hats rule: you are either refactoring or adding behavior, never both in the same step, and you should be able to say which hat you have on at any moment.
4. **Commit-sized diffs.** Commit at each green point, or at each coherent group of steps. A refactor that cannot be reverted in one command is too big. This also gives the reviewer a diff whose every hunk has one reason.
5. **Automated moves beat hand-edits.** If the IDE or language tooling can perform *Rename*, *Extract Function*, *Move Function*, or *Change Signature*, use it — the tool updates every reference and cannot forget one. Reserve hand-editing for what the tooling cannot do.
6. **Compile/typecheck is a step, not a safety net.** Green types prove references resolve, not that behavior held. Only the tests do that.

## 3. The safety-net precondition

**No refactor begins without a passing test suite over the target.** This is the precondition, not a nice-to-have: "behavior-preserving" is a claim about something that can be observed to break, and without coverage there is nothing to observe.

The sequence:

1. **Locate the tests that actually exercise the target** and run them. They must be **green before you start**. A red suite going in means you cannot attribute a later red to your diff — and a pre-existing failure is a `loop-debug` job, not a refactoring job.
2. **If coverage is absent or too thin**, get it before editing. **Authoring and executing tests is delegated to the `loop-test` skill** — it matches the project's framework, runner, fixtures, and naming, and this file deliberately does not design test cases. That delegation mirrors `loop-debug` §6, which hands its regression test to the same skill for the same reason: one skill owns test conventions, and duplicating that here would produce two competing sets of rules.
3. **If the target cannot be tested as it stands** — logic welded to I/O, the clock, randomness, or globals — say so, and take the smallest step that creates the seam (**Encapsulate Variable**, **Parameterize Function**, an injected dependency). Characterize existing behavior first: a test that pins the current output, even an ugly one, converts an untestable target into a testable one, and `loop-test` writes it.
4. **After each step, the same tests, unchanged.** Editing a test to match new behavior is the tell that you changed behavior. Stop.

## 4. Preparatory vs. opportunistic refactoring — how scope gets decided

Two legitimate reasons to refactor, and they draw the boundary differently. Naming which one you are doing is how a sweep avoids becoming unbounded.

**Preparatory refactoring — "make the change easy, then make the easy change."** You have a feature or fix to land, and the current structure fights it. Restructure *first*, in its own diff, until the intended change becomes small; then make it.

- **Scope test:** does this step make the pending change easier? If yes, in scope. If no — however much it improves the code — it is a separate piece of work.
- Ship the refactor as its **own commit or PR**, before the behavior change. That is what makes both reviewable: the refactor diff is large and behavior-free, the feature diff is small and behavior-carrying. A reviewer can check each cheaply. Merged together, neither can be checked at all.

**Opportunistic / comprehension refactoring — the campsite rule.** You are reading code for some other reason, you had to work out what it does, and you record that understanding in the code — a rename, an extracted function, a clarified conditional.

- **Scope test:** could you have made this change without loading extra context? Comprehension refactoring is cheap precisely because you already understood the code. The moment it needs new context, it is a planned refactor and belongs in its own task.
- **Keep it tiny and keep it separate from the change you came to make.** A rename buried in a bug-fix diff makes the fix harder to review, and this is where "small cleanup while I was in there" turns into an unreviewable change set.

Everything else — a planned, standalone cleanup of a module nobody is currently changing — needs an explicit justification: a named smell *and* a concrete cost (this is where the bugs land, this is what slows every change here). That is the workflow-scale case in `../SKILL.md` §5.

## 5. When NOT to refactor

Saying no is part of the skill. Do not refactor when:

- **No smell reaches the code.** §1 turned up nothing. "Could be cleaner" is not a smell. Report that and stop.
- **The intent is to change behavior.** Fixing a bug, changing an output, or altering a contract is not refactoring — hand it to **`loop-debug`** (broken behavior) or treat it as a feature. And if a refactor *turns up* an unrequested behavior change mid-flight, that is a bug: stop, report it, hand it to `loop-debug`, and never fold the correction silently into the refactor diff (`../SKILL.md` §4).
- **The change is really about the mechanism.** Different complexity class, different data structure, different concurrency semantics — the tests will not pass unchanged, so by definition it is not behavior-preserving. That is **`loop-algo`**.
- **You have no safety net and cannot get one.** See §3. Refactoring untested code by hand is how behavior changes ship unnoticed.
- **The motive is churn.** Reformatting to a personal preference, renaming across a repo to match a style guide the repo does not follow, or restructuring code nobody is going to touch. The repo's own convention outranks the style guides (`standards.md` → defer-to-repo-convention), and a large diff with no reader is a cost with no benefit.
- **The code is scheduled for deletion or replacement.** Refactoring a module that is being removed next sprint is pure waste. Check first.
- **The abstraction is speculative.** "We might need a second implementation" is not a smell; it is the *Speculative Generality* smell arriving from the other direction. Wait for the second implementation.

## 6. Two moves fit — the tie-break table

§1 tells you which smell you have; it does not settle the cases where two treatments both plausibly apply. This table does. Every row is priced against the one cost §1 never states:

**Every extraction adds a name the reader must now resolve.** Indirection is not paid once at write time — it is a toll charged at every future read: one more hop, one more name to trust or verify. The toll is worth paying only when the name carries real meaning — when it lets the reader *skip* the body. If the reader still has to open the body to trust the name, the extraction made the code longer, the read slower, and delivered nothing.

| Situation | Reach for | Not the alternative, because |
|---|---|---|
| Same statements in two sibling subclasses | **Pull Up Method** | Not **Extract Function** into a shared helper — the helper is a third home both siblings must now depend on; the superclass already is the shared home |
| A block needs a comment to say *what* it does | **Extract Function**, named after the comment | Not a better comment — the comment rots silently the next time the block changes; the name travels to every call site and is read every time |
| One opaque expression in an otherwise clear function | **Extract Variable** | Not **Extract Function** — a function is visible module-wide and invites calls the logic has not earned; a variable scopes the name to exactly the read that needs it |
| One switch over a type code, in one place | Keep the switch | Not **Replace Conditional with Polymorphism** — one readable conditional beats a class hierarchy the reader must reassemble across files; the hierarchy pays only for *Repeated Switches* (§1), and `design-patterns.md` §5 works the stopping point in full |
| Callers walking `a.getB().getC()` | **Hide Delegate** | Not **Extract Function** around the chain at one call site — that hides the chain from one caller and leaves every other caller coupled to the structure |
| A pending feature the current shape fights | Preparatory refactoring, own diff (§4) | Not refactoring while implementing — the mixed diff breaks the two-hats rule (§2) and gives the reviewer a change set where neither claim can be checked |
| A wrapper whose body is one call and whose name adds nothing | **Inline Function** | Not leaving it because it is "harmless" — the hop is charged at every read forever; harmless-per-instance is the tax Middle Man (§1) is made of |

**The preparatory shape.** §4 names the rule — "make the change easy, then make the easy change" (Kent Beck's line, and he warns the first half may be hard). Here is its executable shape:

1. State the pending change in one sentence, before touching anything.
2. Refactor only what shrinks that change's diff — §4's scope test, applied per step.
3. Land the refactor as its own green, behavior-free commit.
4. Make the now-easy change as a small, behavior-carrying diff.

Abort signal: the preparatory diff has grown larger than the change it prepares. You are no longer preparing, you are renovating — stop, land only what shrinks the change, and book the rest as separate work with its own §4 justification.

## 7. Inverse pairs — refactoring has a reverse gear

The catalog pairs many of its moves with a legitimate inverse, and both directions are real refactorings with real occasions. Direction is a decision, not a default.

| Pair | Forward, when | Inverse, when |
|---|---|---|
| **Extract Function** ↔ **Inline Function** | The name says something the body doesn't, or the body is needed in a second place | The name merely restates the body, and the hop costs more than reading the code would |
| **Extract Variable** ↔ **Inline Variable** | The expression is opaque and the name explains it | The variable's name adds nothing over the expression it holds |
| **Extract Class** ↔ **Inline Class** | A field/method cluster has its own reason to change | The class no longer earns its existence (Lazy Element) — fold it into its one user |
| **Pull Up Method/Field** ↔ **Push Down Method/Field** | The behavior is genuinely shared by every subclass | Only some subclasses want it — pushing down is the treatment for Refused Bequest |
| **Hide Delegate** ↔ **Remove Middle Man** | Callers are coupled to the delegate's internal structure | The class does nothing but forward — Middle Man |
| **Replace Parameter with Query** ↔ **Replace Query with Parameter** | The callee can derive the value itself and every call site simplifies | The query buries a dependency you want visible and swappable — pass it in |

§1 already prescribes the inverse moves as treatments — for Speculative Generality, Lazy Element, and Middle Man. That is the point: over-abstraction is a smell like any other, and un-extracting is its cure, with the same evidence bar as extracting — the same call `design-patterns.md` §4 makes for simplifying a pattern back out.

**The honesty rule.** A refactoring applied by reflex in one direction is a style tic, not a design decision. A history of a hundred extractions and zero inlines is not evidence of consistently good judgment — it is evidence that no judgment is occurring, because the same reflex would have fired on code that needed the opposite move. Two tests keep the direction honest:

- **State the reversal condition.** When proposing an extraction, say what observation would make you inline it back — the name stopped meaning anything, the second caller never arrived. If no observation could ever send you the other way, you are enforcing an aesthetic, not treating a smell.
- **The inverse must have been a live candidate.** For any pair above, the alternative to the forward move is not "do nothing" — it is the inverse move. If the inverse was never considered, the smell diagnosis (§1) was skipped, and this file's rule — no smell, no refactor — was violated in spirit.

Both directions end the same way: the same tests, unchanged and green (§3). Inverse moves are not exempt from the safety net because they "only delete indirection" — inlining past a subtle override or a shadowed variable changes behavior exactly as quietly as extraction does.
