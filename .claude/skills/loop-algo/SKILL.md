---
name: loop-algo
description: "Design and validate the mechanism inside a component: algorithm and data-structure selection, time and space complexity analysis, correctness arguments and invariants, concurrency mechanisms and memory-model reasoning, and benchmark-driven validation of the choice. Use when the user asks which algorithm or data structure to use, for a Big-O or complexity analysis, to make correct code faster or less memory-hungry, to prove an invariant or reason about a race, lock, or lock-free structure, or to benchmark two implementations against each other. For component boundaries, contracts, and topology, use loop-design. For code that is wrong, or that used to be fast and is not any more, use loop-debug — an unexplained regression is a defect, not a mechanism choice. For restructuring code shape without changing its mechanism, use loop-pattern."
argument-hint: <mechanism> [--mode <lite|balanced|all-out>]
---

# Designing and Validating Mechanisms

**This skill's deliverable is a bound, an invariant, a memory-ordering argument, or a benchmark table. `loop-design`'s deliverable is a box-and-arrow diagram, a contract, or a deployable topology.** That is the discriminator, and it is decidable before you read a line of code: ask what the user would paste into the PR description. If it is a diagram, it is not this skill. If it is `O(log n)` amortized, a stated loop invariant, an `acquire`/`release` pair, or a p99 with a variance next to it, it is.

The worked case both skills carry, because it is the one that splits every time: **"shard the queue across N nodes" is `loop-design` — that is topology. "Which lock-free queue structure, and what are its progress guarantees" is `loop-algo` — that is mechanism.** The same feature request produces both, in that order. `loop-design` decides that a queue exists and what crosses its boundary; this skill decides what runs inside it and proves what it costs.

You are about to make a claim about cost or correctness that someone will build on. **The whole value of this skill is that its claims are labeled honestly** — §2 is not a style note, it is the constraint every other section serves.

## 1. Triage first: did this get slower, or was it never fast enough?

Ask this before anything else, and hand off on the first answer.

- **"It got slower."** Something changed — it was fast, and now it is not, and a deploy, a commit, a data-volume shift, or a dependency bump correlates. **That is a regression, and a regression is a defect: go to `loop-debug` and bisect it.** Do not redesign the mechanism. Redesigning around a regression hides the actual cause and ships a bigger diff than the one-line revert that was sitting there.
- **"It was never fast enough."** Known-correct code that has always cost what it costs, and the cost is now unacceptable at the size the system reached. **That is this skill.** There is no bisect to run, because there is no commit where it worked.
- **"I don't know."** Find out before choosing. `git log` on the hot path, a plot of latency against the deploy timeline, or the first version of the code that carried the current algorithm — five minutes here saves a redesign that fixes nothing.

Route elsewhere when:

| The request is really… | Skill | The test |
|---|---|---|
| Where do the components sit and what do they promise each other | `loop-design` | The answer is a diagram or a contract, not a bound. |
| This used to work / used to be fast | `loop-debug` | A commit or a deploy correlates with the change. |
| Reshape this code, same behavior | `loop-pattern` | The existing tests should pass unchanged afterward. |
| Write the tests that ship with this | `loop-test` | The assertion is an expected value, not a measured distribution. |
| Should we write this at all, or adopt something | `loop-scout` | Answering it adds a line to the dependency manifest. |
| Judge this existing code for defects | `loop-review` | The deliverable is a findings list against a severity bar. |

## 2. The two honesty rules

These are stated here, in the router, rather than buried in a reference, because a skill that makes cost and correctness claims is worth exactly as much as the labels on those claims.

**Rule 1 — every cost claim carries a `MEASURED` or `DERIVED-ONLY` label.** A Big-O bound is derived; it says how cost *grows*, never how long anything *takes*. A wall-clock number is measured, and only if a runner actually ran. Write the label into the output next to the number:

- `MEASURED — pytest-benchmark, 5 rounds × 1000 iterations, median 3.1 ms, stddev 0.20 ms`
- `DERIVED-ONLY — O(log n) lookup, no benchmark executed`

**When no runner executed, say so.** Do not produce a plausible-looking millisecond figure, a made-up ops/sec, or a "roughly 3× faster" that no measurement supports. An unmeasured claim honestly labeled is useful; a fabricated measurement is worse than silence, because the reader cannot tell which one they got. Details and the pitfalls that make a *real* benchmark still wrong are in **`references/benchmarking.md`**.

**Rule 2 — "no counterexample in N generated cases" is EVIDENCE, not a proof.** Property-based testing refutes; it does not prove. A proof by induction over a stated loop invariant proves. State which one you have, in those words, and never claim the stronger one:

- `PROVED — invariant holds by induction: initialization, maintenance, termination (see argument below)`
- `EVIDENCE — 10,000 Hypothesis cases, no counterexample; not a proof`

The failure this prevents is the confidently-wrong claim — the same failure the sibling `loop-research` skill exists to prevent in its own domain. Full treatment in **`references/correctness.md`** §5.

## 3. Complexity and structure selection

Open **`references/complexity-and-structures.md`**. It carries: stating a bound correctly (worst-case vs average-case vs amortized, and why conflating them silently is the most common error in this skill's domain); the three amortized-analysis methods with a worked example each; the **access-pattern decision table** that turns "which data structure" into a trade-off search over point lookup / range scan / ordered iteration / insert-heavy / read-heavy / memory-constrained; per-structure profiles; and the space-time framing that explains when a *worse* asymptotic bound wins on real hardware.

Do not pick a structure from familiarity. Name the access pattern first, then read the table.

## 4. Correctness: state the invariant before you optimize it

Open **`references/correctness.md`**. A mechanism you cannot state an invariant for is a mechanism you cannot safely change. The reference carries the initialization → maintenance → termination proof shape with two worked examples, the property-based-testing fallback when a hand proof is infeasible, the `@given` workflow and how to read a shrunk counterexample, §2 Rule 2 in full, and the escalation path to model checking (TLA+) when a concurrency invariant is too subtle to trust either way.

## 5. Concurrency mechanisms

Open **`references/concurrency.md`** whenever the mechanism involves more than one thread. It carries the four-rung ladder (coarse lock → fine-grained lock → lock-free CAS-retry → wait-free) and what each rung actually buys, linearizability and how to state a linearization point, the CAS-retry pattern with ABA and its three fixes, the concrete memory models (C++23 `memory_order` and the Java Memory Model's happens-before edges), the scalability ceilings that bound a speedup claim before any benchmark runs, and the decision table for when a plain lock is the right answer.

**The rule that matters most: a concurrency correctness claim must cite the exact ordering it depends on.** "It's atomic" is not an argument. "The release store on `tail` publishes the node's fields to the acquire load in the consumer" is.

## 6. Approximate and randomized structures

Open **`references/randomized-structures.md`** when the exact structure does not fit the memory or latency budget. It carries the exact formulas — Bloom-filter false-positive rate as a function of bits-per-element and hash count, HyperLogLog's ≈1.04/√m **relative** standard error, Count-Min Sketch's (ε, δ) width/depth trade-off and its one-sided overestimate — with sizing examples worked through.

Carry the formulas from that file, not from memory: an off-by-a-constant error bound is worse than no claim at all, and **the error bound and its confidence level go in the same sentence as the space saving**, never after it.

## 7. Cite from the shelf

Every standard, textbook, paper, and tool this skill names is pinned in **`references/standards.md`**, which keeps three kinds of source honestly separate: formal specs you can be *in violation of* (`authoritative: true`), canonical-but-opinionated textbooks that supply the vocabulary (`authoritative: false`), and OSS tools whose versions roll continuously and need re-verifying against the live registry before you print a number.

## 8. What this skill hands off

Delegating is not a gap here; each of these is a sibling's core competence and doing it inline produces a worse artifact.

- **Property-based testing is used instrumentally.** Hypothesis and QuickCheck are this skill's *correctness oracle* for its own stated invariant, inside its own validation loop. This skill does **not** match the repo's test-framework conventions, does not chase coverage, and does not commit a test file. The regression and unit tests that ship with the code are **`loop-test`**'s, delegated explicitly the way `loop-debug` already delegates its regression test.
- **A surprising counterexample is a bug report.** When a property test or a benchmark turns up behavior nobody predicted, redesigning the mechanism is this skill's job, but diagnosing *why the existing code does that* is **`loop-debug`**'s. Hand it over with the shrunk counterexample attached — that is a reproduction, ready to use.
- **Whether to hand-roll the structure at all is upstream.** "Write us a Bloom filter" should pass through **`loop-scout`** first; a maintained library may already exist and be the correct answer. This skill picks up once building (or reading a specific library's internals) is in scope, and then sizes it, derives its error bound, and benchmarks it.

## 9. Orchestration: size-gate, then bake off

**One candidate mechanism, one file, one bound to derive — do it inline in this session.** Read the code, state the bound, state the invariant, and if a runner is available, measure. Agents cost more than the analysis.

Run **`templates/algorithm-bakeoff.workflow.js`** when there are **genuinely competing candidates** — two or more structures, algorithms, or concurrency mechanisms whose costs must be ranked against each other, or a mechanism whose correctness argument needs adversarial pressure. Four stages:

1. **Candidate generation** — one agent per candidate mechanism (parallel), each proposing the approach, deriving its Big-O/amortized cost, stating its invariant, and proposing the concrete benchmark that would validate the cost claim. Structured return, with a `measured` boolean per cost claim.
2. **Barrier** — merge all candidates. Earned under H2 because the synthesis prompt must hold every candidate's cost *at once* to rank them against each other; it doubles as the early-exit when only one viable candidate came back and there is nothing to bake off.
3. **Adversarial stress-test** — one skeptic per surviving candidate, at mode-resolved width, tasked to construct a concrete input that violates the claimed invariant **and** to attack the benchmark methodology itself rather than trusting the reported number. Default to "not proven" when the skeptic cannot re-derive the claim independently.
4. **Synthesis** — pick the winner, state its cost profile with every part labeled per §2 Rule 1, name the runner-up and why it lost, and flag every candidate whose invariant or benchmark did not survive.

This is the parallel finder → barrier → adversarial-verify pattern from the **`loop-engine`** skill (see its `templates/parallel.workflow.js` and harness policies H2, H4, H5). Invoke `loop-engine` to author and execute the run; pass your raw argument string straight through — `--mode` and `--planner` are parsed there, never here.

## Reference files

- `references/complexity-and-structures.md` — stating bounds correctly, the three amortized methods, the access-pattern decision table, and per-structure profiles
- `references/correctness.md` — the invariant-proof shape, worked proofs, property-based testing as an oracle, and the evidence-vs-proof rule
- `references/concurrency.md` — the lock → lock-free → wait-free ladder, linearizability, ABA, C++23 and Java memory models, and the scalability ceilings
- `references/randomized-structures.md` — Bloom, HyperLogLog, Count-Min, reservoir sampling and skip lists, with the exact error bounds and sizing examples
- `references/benchmarking.md` — benchmark pitfalls, the JMH and pytest-benchmark workflows, the statistical bar, and the measured-vs-derived rule
- `references/standards.md` — the authoritative standards this skill applies — named, version-pinned, and mapped to its workflow
- `templates/algorithm-bakeoff.workflow.js` — candidate fan-out → barrier → adversarial stress-test → synthesis workflow script
