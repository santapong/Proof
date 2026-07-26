# Authoritative standards — what this skill cites, and how honestly

This is the shelf a mechanism claim reaches for when it needs an authority beyond "this is how I'd write it." A Big-O bound, a linearizability claim, an error bound on a sketch, and a memory-ordering argument are all *citable* things, and citing them wrong is the fastest way to make a technically correct analysis look untrustworthy.

Cite from this file, not from memory. An invented edition number, a fabricated ISBN, or a tool version pinned to something that never shipped is the single easiest thing for a reviewer to catch, and it discredits the numbers next to it.

## Formal specs vs. textbooks vs. tools — why the `authoritative` column is marked honestly

Three genuinely different kinds of source appear below, and blurring them is an accuracy failure, not a stylistic one.

**`authoritative: true` — the body that owns the thing publishes the rule.** ISO/IEC 14882 *is* C++; the Java Language Specification *is* Java. When the C++ standard says a relaxed atomic load participates in no ordering relation, code that assumes otherwise is **in violation of a normative source**, and the citation carries that weight on its own. There are exactly two such entries in this file, and both of them govern `concurrency.md`.

**`authoritative: false` — canonical, load-bearing, but nobody's spec.** CLRS, *The Art of Multiprocessor Programming*, Amdahl, Gustafson, and the USL are textbooks and papers. They are the shared **vocabulary** of this craft — "amortized O(1)", "linearizable", "lock-free" mean the same thing to every engineer because of them — and that shared vocabulary is exactly why this skill leans on them. But code cannot be "in violation" of CLRS. Cite them as *this is the name of the thing and here is where the definition comes from*, never as *this is required*.

**`authoritative: false`, and versioned differently — the tools.** Hypothesis, QuickCheck, JMH, and pytest-benchmark are software. Their versions roll on a release cadence, not an edition cadence, and the closing note treats them separately for that reason.

**The third grade, for consistency with the rest of the plugin.** Every standards shelf here uses the same three grades — **yes** (ratified and published by a standards body, government agency, or licensed framework owner), **draft** (real working-group or committee output that nothing has ratified — name the revision and status every time), and **no** (influential, and not a specification). *No entry on this shelf carries the **draft** grade;* a C++ working paper such as N4950 is cited above only as the technical-completion milestone of a since-published ISO standard, never as an authority in its own right.

**Practical rule:** an `authoritative: true` source can carry a correctness claim by itself ("this is a data race under JLS §17.4, therefore undefined behavior"). An `authoritative: false` source names and frames a claim whose real justification is a derivation or a measurement you supply. If you cannot supply that derivation or measurement, the citation is decoration.

## Memory models — the two formal specs

These are the normative sources behind every ordering argument in `concurrency.md`. A lock-free proposal that does not cite one of them precisely is hand-waving.

| Standard | Body | Edition (pinned) | Authoritative | How this skill cites it |
|---|---|---|---|---|
| **ISO/IEC 14882 — Programming languages, C++** ("C++23") | ISO/IEC JTC1 SC22 WG21 | **ISO/IEC 14882:2024**, 7th edition, published **October 2024**. Technically finalized as C++23 (WG21 paper **N4950**) in **February 2023** — the two-year gap between technical completion and ISO publication is normal and is why both dates are recorded here | **true** | Governs the `<atomic>` memory-order model — `relaxed`, `acquire`, `release`, `acq_rel`, `seq_cst`, and the discouraged `consume` — that `concurrency.md` §4 requires a CAS or lock-free argument to name explicitly rather than hand-wave. |
| **The Java Language Specification, Chapter 17 (Threads and Locks)** — the Java Memory Model | Oracle / JCP (JSR 901) | **JLS for Java SE 25** (current LTS, **September 2025**). The underlying model is **unchanged since JSR 133 (2004)** — cite the current JLS for section numbers, but do not imply the semantics moved | **true** | Governs the JVM half of `concurrency.md` §4: happens-before edges, `volatile` and `final`-field semantics, and why a data race in Java is **undefined behavior against a normative spec**, not a benign bug that "usually works." |

**Why both dates on the C++ row matter.** Writing "C++23 (2023)" and writing "ISO/IEC 14882:2024" both look like errors to someone holding the other one. They are the same document at two milestones. Give both, once, the way the row above does.

## The two canonical textbooks

| Standard | Body | Edition (pinned) | Authoritative | How this skill cites it |
|---|---|---|---|---|
| **Introduction to Algorithms** ("CLRS") | Cormen, Leiserson, Rivest, Stein — MIT Press | **4th edition, 2022**, ISBN **978-0-262-04630-5** | **false** | The vocabulary and proof style for `complexity-and-structures.md`: the Big-O / Θ / Ω definitions, the **aggregate, accounting, and potential-function** methods for amortized analysis, the loop-invariant proof shape reused in `correctness.md`, and the reference structures (heaps, red-black trees, hash tables, B-trees) every trade-off is compared against. |
| **The Art of Multiprocessor Programming** | Herlihy, Shavit, Luchangco, Spear — Morgan Kaufmann (Elsevier) | **2nd edition, 2020**, ISBN **978-0-12-415950-1** | **false** | The correctness vocabulary for `concurrency.md`: **linearizability** and the linearization point, the **wait-free / lock-free / obstruction-free** progress hierarchy, and the CAS-retry-loop pattern every lock-free proposal is checked against. |

**Θ and O are not synonyms, and CLRS is the reason you can say so precisely.** `complexity-and-structures.md` §1 uses the CLRS definitions verbatim in spirit: O is an upper bound, Ω a lower bound, Θ a tight bound. Writing O when you mean Θ is not pedantry — it is the difference between "never worse than" and "this is the cost."

## Scalability limits

| Standard | Body | Edition (pinned) | Authoritative | How this skill cites it |
|---|---|---|---|---|
| **Amdahl's Law** | Gene Amdahl — **AFIPS Spring Joint Computer Conference, 1967** | Original paper, unrevised. Cite the **year**, not an edition | **false** | The fixed-serial-fraction speedup ceiling in `concurrency.md` §5: `S(N) = 1 / ((1 − p) + p/N)`, bounded above by `1/(1 − p)`. Used to bound a parallelization claim *before* a benchmark exists. |
| **Gustafson's Law** | John Gustafson — **CACM 31(5), 1988** | Original paper, unrevised. Cite the **year** | **false** | The scaled-workload counterpart in the same section: when the problem grows with the resources, `S(N) = (1 − p) + p·N`. Names *which question* is being asked — fixed problem, or fixed time. |
| **Universal Scalability Law (USL)** | Neil J. Gunther — **"Guerrilla Capacity Planning"** (2007), Springer | **2007 edition**, the book that presents the law in its standard form | **false** | The contention (**σ**) and coherency (**κ**) terms in `concurrency.md` §5: `C(N) = N / (1 + σ(N − 1) + κN(N − 1))`. Reach for it specifically when a throughput curve is expected to **turn over and decline**, which Amdahl's model structurally cannot produce. |

## Foundational randomized-structure papers

These are **unrevised original papers**. There is no second edition to look for, and inventing one is the specific mistake to avoid here — cite the year.

| Paper | Venue and year | Authoritative | How this skill cites it |
|---|---|---|---|
| **Space/Time Trade-offs in Hash Coding with Allowable Errors** (the Bloom filter) | Burton H. Bloom — **CACM 13(7), 1970** | **false** | The false-positive-rate derivation in `randomized-structures.md` §2: `p ≈ (1 − e^(−kn/m))^k`, optimal `k = (m/n) ln 2`, and the no-false-negatives guarantee. |
| **HyperLogLog: the analysis of a near-optimal cardinality estimation algorithm** | Flajolet, Fusy, Gandouet, Meunier — **AOFA 2007** (Analysis of Algorithms conference; proceedings published via DMTCS) | **false** | The **≈1.04/√m relative** standard error and the register-count/accuracy trade-off in `randomized-structures.md` §3. The word *relative* is load-bearing; see that section's named failure mode. |
| **An Improved Data Stream Summary: The Count-Min Sketch and its Applications** | Cormode & Muthukrishnan — **Journal of Algorithms 55(1), 2005** | **false** | The `(ε, δ)` width/depth sizing (`w = ⌈e/ε⌉`, `d = ⌈ln(1/δ)⌉`) and the **one-sided overestimate** guarantee in `randomized-structures.md` §4. |

## Tools — property testing and benchmarking

Named in `correctness.md` and `benchmarking.md` as the concrete answer to "how would you actually check that." Versions below are the lines current as of **July 2026**; see the closing note before you print any of these numbers into a report.

| Tool | Body | Version (pinned, July 2026) | Authoritative | How this skill cites it |
|---|---|---|---|---|
| **Hypothesis** (Python property-based testing) | HypothesisWorks — open source | **6.161.x** line (PyPI reported **6.161.5** on 2026-07-26) | **false** | The default correctness oracle in `correctness.md` §4 — `@given` strategies hunting a counterexample to a stated invariant, with automatic shrinking to a minimal failing case. |
| **QuickCheck** (Haskell property-based testing) | Hackage — open source | **2.18.x** line (Hackage reported **2.18.0.0**, uploaded 26 Feb 2026, on 2026-07-26). **This row was pinned to a stale 2.14.x line and is corrected.** Originating paper: **Claessen & Hughes, ICFP 2000** | **false** | The originating citation for the technique itself. Every other property-testing library, Hypothesis included, inherits shrinking-to-a-minimal-counterexample from it — cite the paper when explaining *why* shrinking is the valuable part, and the library when writing Haskell. |
| **JMH — Java Microbenchmark Harness** | OpenJDK project — open source | **1.37** (`org.openjdk.jmh:jmh-core`, Maven Central — confirmed latest on 2026-07-26) | **false** | The JVM benchmark runner in `benchmarking.md` §2. Its fork/warmup/measurement model plus `Blackhole` is the concrete answer to "how do you measure this on a JIT-compiled runtime" instead of hand-timing with `System.nanoTime`. |
| **pytest-benchmark** | ionelmc — open source (PyPI) | **5.2.3** (confirmed latest on PyPI 2026-07-26) | **false** | The Python benchmark runner in `benchmarking.md` §3 — calibration rounds and the min/mean/median/stddev/outliers report, filling the same role JMH fills on the JVM. |

## Edition discipline — and the asymmetry that makes it awkward

Standards get revised, and an analysis that cites a retired edition reads as careless in exactly the way that erodes trust in the numbers beside it. But the rows in this file **do not age at the same rate**, and pretending they do is the failure mode this note exists to prevent.

- **Specs and textbooks age on an edition cadence, slowly.** ISO/IEC 14882 revises roughly every three years; the JLS tracks the Java release train but its chapter-17 model has not moved since 2004; CLRS 4e is from 2022 and AoMP 2e from 2020. A yearly-ish re-check is enough for all of these.
- **The original papers do not age at all.** Bloom 1970, Count-Min 2005, HyperLogLog 2007, Amdahl 1967, Gustafson 1988 are fixed points. **Never invent an edition for them** to make the table look uniform — cite the year, and stop.
- **Tool versions roll continuously, and this is the asymmetry.** Hypothesis, QuickCheck, JMH, and pytest-benchmark ship on their own cadence, with no edition to diff. The four tool pins above are stale within *months*, not years — **QuickCheck proved it**: this file shipped a 2.14.x pin while Hackage was on 2.18.0.0, four minor lines behind. **Re-verify the exact patch against the live registry — PyPI, Hackage, Maven Central — at time of use, rather than trusting the cached number in this file.** If you cannot check, name the tool without a version rather than printing one you did not confirm. This is the same stale-pin failure mode `../../loop-review/references/standards.md` warns about on its own shelf; the difference here is that a fast-moving OSS row can go stale between two runs of the same skill, so the honest pin is a *dated confirmation plus a habit of re-reading the registry*, not a number treated as durable.
- **Cite the edition you actually mapped to**, in the analysis — "CLRS 4e, potential method", "AoMP 2e, linearization point", "ISO/IEC 14882:2024 `memory_order_acquire`" — never a bare "CLRS" or "the C++ standard."
- **Re-check cadence.** This shelf roughly **twice a year**, the two memory-model rows on any language major, and the four tool rows **every time you are about to print a version number**. When a row goes stale, update the row *and* the confirmation date in the same commit — a pinned date left behind is worse than none, because a reader will trust it.
- **Confirmation log — 2026-07-26.** All four tool rows checked against their live registries: Hypothesis **6.161.5** (PyPI), QuickCheck **2.18.0.0** (Hackage — corrected from a stale 2.14.x), JMH **1.37** (Maven Central), pytest-benchmark **5.2.3** (PyPI). **Not re-confirmed in this pass, and deliberately left as they stand:** the two memory-model rows (ISO/IEC 14882:2024 and JLS for Java SE 25) and the four fixed papers, which do not move. If you are about to quote a JLS section number, check it against the JLS for the Java release the code actually targets — this shelf pins the current LTS, not the reader's runtime.
