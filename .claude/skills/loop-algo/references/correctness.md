# Correctness — invariants, proofs, and the property-testing oracle

A mechanism you cannot state an invariant for is a mechanism you cannot safely change. This file covers how to state one, how to prove it, what to do when a proof is not affordable, and — §5 — the one claim this skill is never allowed to overstate. Proof shape follows **CLRS 4th edition (2022)**; see `standards.md`.

## 1. The invariant-proof shape

A **loop invariant** is a predicate over program state that is true before the loop starts and true at the top of every iteration. It is not documentation; it is the thing that makes an inductive argument possible. Three obligations, always in this order:

1. **Initialization (base case)** — the invariant holds *before* the first iteration. Usually trivial, and usually where a wrong invariant is caught, because a too-strong invariant fails here immediately.
2. **Maintenance (inductive step)** — if the invariant holds at the top of an iteration, it still holds at the top of the next one. This is the body of the proof and where the real work is.
3. **Termination** — the loop exits, **and** invariant ∧ exit-condition ⇒ the postcondition you actually wanted. Two separate obligations that get merged and should not be: *does it stop* (a decreasing, well-founded measure — a variant) and *is the answer right when it stops*.

**Write the invariant down as a sentence, before the code.** "At the top of each iteration, `A[lo..i]` contains exactly the elements ≤ pivot" is a claim you can attack. "The loop maintains the partition" is not.

**Termination deserves its own line.** Name the decreasing measure and its floor: *"`hi − lo` strictly decreases each iteration and is bounded below by −1, so the loop terminates in at most ⌈log₂ n⌉ + 1 iterations."* Most infinite-loop bugs are a maintenance step that fails to shrink the measure on one branch — an off-by-one that makes `mid` equal `lo` and never advance.

## 2. Worked example — binary search

```
lo = 0; hi = n - 1
while lo <= hi:
    mid = lo + (hi - lo) // 2        # not (lo+hi)//2 — overflow in fixed-width ints
    if A[mid] == target: return mid
    if A[mid] <  target: lo = mid + 1
    else:                hi = mid - 1
return NOT_FOUND
```

**Invariant.** *A is sorted ascending, and if `target` occurs in A, its index lies in `[lo, hi]`.*

- **Initialization.** `lo = 0`, `hi = n − 1`, so `[lo, hi]` is the whole array. If `target` is anywhere, it is in there. Holds vacuously when `n = 0` (`[0, −1]` is empty, and the loop does not run).
- **Maintenance.** Assume the invariant at the top. `mid ∈ [lo, hi]`. If `A[mid] < target`, then because A is sorted every index ≤ `mid` holds a value ≤ `A[mid] < target`, so `target` cannot be at or below `mid`; restricting to `[mid+1, hi]` preserves the invariant. The `A[mid] > target` branch is symmetric. The equality branch returns and leaves the loop, so it has no maintenance obligation.
- **Termination.** `hi − lo` strictly decreases each iteration (both branches move a bound past `mid`, and `mid` is always within the range), and the loop exits once `lo > hi`. At exit `[lo, hi]` is empty; combined with the invariant — *if target occurs, it is in `[lo, hi]`* — the target does not occur, so returning `NOT_FOUND` is correct.

**Note what the proof caught.** Sortedness is a *precondition*, not something the loop establishes; if the caller can pass unsorted input, the invariant's antecedent fails and the whole argument evaporates — that is a contract bug, not a search bug. And the overflow-safe `mid` is required for the maintenance step's "`mid ∈ [lo, hi]`" to hold in fixed-width arithmetic. Both are typical: **the proof's value is largely in the assumptions it forces you to write down.**

## 3. Worked example — the partition step

The Lomuto partition, the inner loop of quicksort and quickselect:

```
x = A[hi]                 # pivot
i = lo - 1
for j in lo .. hi-1:
    if A[j] <= x:
        i = i + 1
        swap(A[i], A[j])
swap(A[i+1], A[hi])
return i + 1
```

**Invariant.** *At the top of each iteration, for the current `j`: every element of `A[lo..i]` is ≤ x; every element of `A[i+1..j−1]` is > x; and `A[hi] = x`. Elements `A[j..hi−1]` are unexamined.*

- **Initialization.** `j = lo`, `i = lo − 1`. Both `A[lo..i]` and `A[i+1..j−1]` are empty, so the first two clauses hold vacuously; `A[hi] = x` by the assignment.
- **Maintenance.** Two cases. If `A[j] > x`, nothing moves, `j` increments, and `A[j]` joins the "> x" region — invariant holds. If `A[j] ≤ x`, `i` increments and `A[i]` (the leftmost "> x" element, or `A[j]` itself when the regions are adjacent) swaps with `A[j]`; the "≤ x" region grows by one correct element and the "> x" region is shifted right intact.
- **Termination.** `j` reaches `hi`, so `A[lo..i] ≤ x` and `A[i+1..hi−1] > x`. The final swap puts the pivot at `i+1`, which is therefore its sorted position, with everything ≤ x to its left and everything > x to its right. That is exactly the postcondition quicksort's recursion depends on.

**What the invariant tells you about cost, too.** It shows the partition touches each element once — Θ(n) — and it shows why quicksort degrades to Θ(n²) on already-sorted input under this pivot choice: the "≤ x" region absorbs everything and the recursion never splits. **The invariant and the complexity argument are the same reasoning**, which is why `complexity-and-structures.md` and this file are read together.

## 4. When a proof is not affordable — property-based testing as an oracle

Hand proofs do not scale to a 400-line concurrent structure, a parser, or a serializer. The fallback is **property-based testing**: encode the invariant as an executable predicate, generate inputs across the space, and let the tool hunt for a counterexample.

**Encode the invariant as a property.** Four shapes cover most real invariants:

| Property | Shape | Typical target |
|---|---|---|
| **Round-trip** | `decode(encode(x)) == x` for all x | Serializers, parsers, compression, encodings |
| **Idempotence** | `f(f(x)) == f(x)` | Normalizers, sanitizers, migrations, `sort`, set insert |
| **Ordering / invariant preservation** | `isSorted(sort(xs))`, heap property holds after every op | Sorts, trees, heaps, schedulers |
| **Conservation** | `sum(after) == sum(before)`, multiset preserved, no element lost | Partitions, shards, ledgers, redistribution, queues |

Two more that carry a lot of weight: the **model/oracle** property (compare the fast structure against a trivially correct slow one — a hash map against a list of pairs) and the **metamorphic** property (`f(sorted(xs)) == f(xs)` when order should not matter), which works when you cannot state the answer but can state a relation between two answers.

**The `@given` workflow** (Hypothesis 6.161.x — verify the exact patch against PyPI per `standards.md`):

1. **Write a strategy that covers the input space, including the shapes you would not think to write by hand.** Empty, single-element, all-equal, already-sorted, reverse-sorted, duplicates, extreme magnitudes, NaN and −0.0 for floats, surrogate pairs and combining characters for text, and — for anything with a size parameter — sizes that straddle a resize or a chunk boundary. A strategy that only generates well-formed medium-sized input tests nothing you did not already believe.
2. **Assert the invariant, not the implementation.** `assert decode(encode(x)) == x` is a property. `assert encode(x) == b"\x01\x02"` is a unit test with extra steps.
3. **Read the shrunk counterexample as proof-by-refutation.** Both Hypothesis and QuickCheck (2.14.x; the technique originates with Claessen & Hughes, ICFP 2000) shrink a failure to a minimal case. That minimal case is the valuable artifact: `[0, 0]` failing a "distinct elements" property tells you the invariant is wrong about duplicates. **A shrunk counterexample is a disproof of the stated invariant** — a real, complete logical result, unlike a passing run.
4. **Pin the failing case as a regression** — but see below for whose job that is.
5. **Reach for stateful testing** when the invariant is about a *sequence* of operations rather than one call. Hypothesis's rule-based state machines and QuickCheck's model-based testing generate operation sequences and check the invariant after each; that is how you get a concurrent-adjacent structure under property test at all.

**When a property test finds nothing, look at the generator before you believe it.** A property that passes because the strategy never produced an input that could break it is the most common false comfort in this file. Check coverage of the interesting shapes explicitly, and use the tool's own reporting (Hypothesis's statistics output, `target()` for guided generation) to confirm the hard cases were actually reached.

## 5. THE HONESTY RULE — evidence is not proof

**"No counterexample in N generated cases" is EVIDENCE. It is not a proof. State which one you have, and never claim the stronger one.**

The asymmetry is total and it is worth being precise about, because the temptation runs one way:

- **A counterexample is conclusive.** One failing case disproves the invariant, permanently. Property testing's real power is on this side.
- **The absence of a counterexample is not.** 10,000 cases sampled from an effectively infinite space bound nothing. The tool searched where the strategy pointed it. Everywhere else is untested, and the bugs that survive to production are disproportionately in the "everywhere else."

Write the label in the output, in these words:

- `PROVED — invariant "…" holds by induction (initialization / maintenance / termination), under stated precondition "…"`
- `EVIDENCE — invariant "…" survived 10,000 Hypothesis cases over strategy "…", no counterexample. Not a proof.`
- `DISPROVED — invariant "…" fails on the minimal case […]; here is why.`

**Why this rule is stated three times across this skill.** Conflating evidence with proof is exactly the confidently-wrong claim the sibling `loop-research` skill exists to prevent in its own domain, and a mechanism proposal is *more* dangerous when wrong, because a downstream engineer builds on the guarantee. A "proved" label the reader trusts and you cannot support is the single worst output this skill can produce — worse than no analysis, because no analysis prompts scrutiny.

**The corollary about N.** Do not let the number do rhetorical work. "One million cases" is not closer to a proof than ten thousand; it is the same kind of claim with a bigger number. What raises confidence is **strategy coverage of the adversarial shapes**, not sample count. Report the strategy alongside N, or N means nothing.

## 6. Whose test is it — the delegation

**Property-based testing here is instrumental.** It is this skill's oracle for its own invariant, inside its own validation loop. It deliberately does **not** match the repo's test-framework conventions, does not chase coverage, and does not commit a test file.

- **The tests that ship belong to `loop-test`.** Once a mechanism is chosen, hand over the invariant and any shrunk counterexamples; `loop-test` authors them in the project's framework and conventions. This is the same delegation `loop-debug` already makes for its regression test.
- **A surprising counterexample is a bug report.** If a property test refutes an invariant in *existing* code, that is a defect with a ready-made minimal reproduction. Diagnosing why the code does that belongs to **`loop-debug`**; redesigning the mechanism so the invariant holds belongs here. Hand the shrunk case over — it is the reproduction step `loop-debug` would otherwise have to construct.

## 7. When neither proof nor property testing is enough — model checking

Some invariants are beyond both. A lock-free structure's correctness depends on interleavings a test harness will not schedule and a hand proof will not enumerate; the bug appears once per 10⁹ runs on one machine and never in CI. Property testing samples *inputs*, not *schedules*, so it gives you almost nothing here.

**Escalate to model checking.** **TLA+** (with the TLC model checker, or TLAPS for machine-checked proofs) specifies the algorithm and exhaustively explores every interleaving up to a bounded state space. It is the honest answer for: a lock-free or wait-free structure's linearizability, a distributed protocol's safety and liveness, a cache-coherence or reclamation scheme, or any invariant whose violation requires a specific thread interleaving.

**State the escalation explicitly rather than papering over it.** If a concurrency invariant matters and has not been model-checked, the honest label is:

`NOT PROVEN — invariant depends on thread interleaving; neither induction nor property testing covers the schedule space. Model checking (TLA+) recommended before relying on this.`

That is a legitimate, useful output. **"It looks right to me" is not** — see `concurrency.md` §7, which names the same escape hatch from the other side, because proof-by-inspection of concurrent code is the highest-confidence-lowest-accuracy claim in this entire skill.
