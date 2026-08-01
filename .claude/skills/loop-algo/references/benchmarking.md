# Benchmarking — turning a claim into a measurement

This skill's charter is benchmark-driven, not vibes-driven. A complexity bound says how cost *grows*; only a benchmark says what anything *costs*. This file covers what makes a benchmark wrong, the two runners this skill names, the statistical bar a number must clear before it is reportable, and — §5 — the labeling rule the whole skill rests on. Tool versions are pinned in `standards.md`; **re-verify them against the live registry before you print one.**

## 1. Six ways a naive benchmark lies

Every one of these produces a *confident number* rather than an obvious failure, which is what makes them dangerous.

**1. Warmup not excluded.** On a JIT runtime the first thousand invocations run interpreted, then get compiled, deoptimized on a class load, and recompiled. Measuring from invocation one measures the compiler. Python, JavaScript and the JVM all have variants of this; so do CPU frequency scaling and turbo residency on the hardware itself. **Fix:** discard warmup iterations explicitly, and check that steady state was actually reached rather than assuming a fixed count sufficed.

**2. Dead-code elimination.** The optimizer proves your result is unused and deletes the work. The benchmark then reports the cost of an empty loop, which looks like a spectacular improvement.

```java
// WRONG — result unused; the JIT may remove the whole call
for (int i = 0; i < N; i++) { hash(data); }
```

**Fix:** consume the result — `Blackhole.consume(...)` in JMH, returning it from the benchmarked function in pytest-benchmark. Also watch for **constant folding** (a loop-invariant input computed once) and **loop unrolling across iterations**, which change what you are timing without deleting it.

**3. A single run presented as truth.** One number has no spread, so it cannot be compared to another number. Run-to-run variance on a shared machine routinely reaches 10–30%; a "12% improvement" from two single runs is indistinguishable from noise. **Fix:** never report a number without a variance or an interval beside it (§4).

**4. Coordinated omission.** A load generator on a fixed schedule stops sending while the system is stalled, so the requests that *would* have arrived during the stall are never issued and never measured. The result systematically deletes exactly the worst latencies — the ones a p99 exists to capture — and a p99.9 can be understated by an order of magnitude. **Fix:** measure latency from each request's *intended* send time, not its actual one, and use a generator that corrects for it (a constant-throughput mode, HdrHistogram-style correction). This one only bites load tests, and it bites them hard.

**5. Comparing across different conditions.** Different machine, different core count, different CPU governor, different JVM or Python version, different dataset, a noisy neighbour, thermal throttling on run two. **Fix:** measure A and B on the same machine in the same session, ideally interleaved, and state the environment with the numbers. A cross-machine comparison is not a comparison.

**6. Benchmarking the wrong thing.** An input that fits entirely in L1, a cache pre-warmed by the previous iteration, a mock where production has a network hop, a uniform key distribution where production is Zipfian. The measurement is real and the conclusion does not transfer — see §6.

Two more worth naming: **`System.nanoTime`/`time.time` around a loop** invites all six above; and **allocation-driven GC pressure** shows up as unattributed pauses in the tail, so report allocation rate alongside time on a managed runtime.

## 2. JMH — the JVM workflow

**JMH 1.37** (`org.openjdk.jmh:jmh-core`) exists because hand-timing on the JVM is close to hopeless. It forks fresh JVMs, runs warmup iterations it discards, and gives you `Blackhole` to defeat the optimizer.

```java
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.NANOSECONDS)
@Fork(value = 3)                                    // separate JVMs: profile pollution is real
@Warmup(iterations = 5, time = 1, timeUnit = TimeUnit.SECONDS)
@Measurement(iterations = 10, time = 1, timeUnit = TimeUnit.SECONDS)
@State(Scope.Benchmark)
public class LookupBenchmark {
    private Map<String, Integer> map;
    private String[] keys;

    @Setup(Level.Trial)
    public void setup() { /* build the structure and the key set */ }

    @Benchmark
    public void hashLookup(Blackhole bh) {
        for (String k : keys) bh.consume(map.get(k));   // consume: no dead-code elimination
    }
}
```

**The four dials, and why each is there:**

- **`@Fork(3)`** — each fork is a fresh JVM. One JVM's profile pollution (a megamorphic call site poisoned by an earlier benchmark) makes results non-reproducible, and forking is the only fix. **Never `@Fork(0)`** outside debugging.
- **`@Warmup(5)`** — discarded iterations that let the JIT reach steady state. Check the per-iteration output actually flattens; if iteration 5 is still 30% off iteration 4, raise the count.
- **`@Measurement(10)`** — the iterations that count. This is your sample size, and JMH reports the distribution across them.
- **`@State`** — where mutable benchmark state lives, with the scope declaring whether it is shared across threads. `Scope.Thread` for per-thread state, `Scope.Benchmark` for shared — and for a *concurrency* benchmark the scope choice is the experiment, so get it deliberately right.

**Mode changes the question.** `Mode.Throughput` (ops/sec) for aggregate capacity; `Mode.AverageTime` for per-op cost; `Mode.SampleTime` when you need the **percentile distribution**, which is the only mode that answers a tail-latency question. `Mode.SingleShotTime` for cold-start cost, deliberately un-warmed.

**Read JMH's own warnings.** It prints them — non-forked runs, a benchmark shorter than timer granularity, an unstable iteration profile. They are not noise.

For concurrency correctness rather than speed, its sibling **jcstress** (same OpenJDK project) is the right tool; see `concurrency.md` §7.

## 3. pytest-benchmark — the Python workflow

**pytest-benchmark 5.2.3** plays JMH's role on CPython: it calibrates, runs rounds, and reports a distribution instead of one number.

```python
def test_hash_lookup(benchmark):
    index, keys = build_index()
    result = benchmark(lambda: [index[k] for k in keys])   # return it — keeps the work alive
    assert len(result) == len(keys)                         # correctness assertion is loop-test's job;
                                                            # here it only prevents a vacuous benchmark
```

**Calibration.** pytest-benchmark first times the function to decide how many **iterations** to run per **round**, so that a round is long enough to dominate timer granularity. Rounds are then the independent samples it computes statistics over. When you need explicit control — a fixed iteration count, a per-round setup that must not be timed — use `benchmark.pedantic(fn, rounds=..., iterations=..., warmup_rounds=...)`.

**Reading the report.** The table gives min, max, mean, stddev, median, IQR, outliers, OPS and rounds. Read it in this order:

1. **Median and IQR first.** They are robust to the outliers a shared machine produces. Mean and stddev are not.
2. **Outliers column** (`n (m)` = n beyond 1 IQR, m beyond 3 IQR). A large count means the machine was busy and the run should be repeated, not interpreted.
3. **stddev relative to median.** Above ~5% and A-vs-B differences below that threshold are unreadable.
4. **min** is the least-noise-contaminated estimate of best-case cost, and is *not* a typical cost. Never report min alone.

**Compare distributions, not single numbers.** Use `--benchmark-autosave` / `--benchmark-compare` so before-and-after are compared as distributions with their spreads visible. Two medians differing by less than the combined spread are not different.

**CPython-specific traps:** the GC can fire mid-round (`--benchmark-disable-gc` for a cleaner but less realistic number — say which you used); the interpreter has no JIT, so warmup matters less but attribute caching and CPU frequency scaling still do; and `timeit`-style micro-loops are dominated by interpreter dispatch, which can be most of what you measure on a small function.

## 4. The statistical rigor bar

Before a number is reportable:

- **Minimum samples.** At least **10 measurement iterations** after warmup (JMH `@Measurement(10)`, pytest-benchmark's default rounds or more), and at least **3 forks/sessions** on a JIT runtime. Fewer is a smoke test — call it one.
- **Always report spread.** A number without a variance, an IQR, or a confidence interval is not a result. Preferred form: **median ± IQR, n = samples**, plus the environment.
- **Interleave A and B.** Run them in the same session, alternating if possible. Sequential blocks alias with thermal drift and background load in exactly the direction that flatters whichever ran first.
- **Declare the threshold before you look.** If run-to-run spread is 5%, then a 5% difference is not a difference. Say so instead of reporting it as an improvement.
- **State the environment with the number** — machine, core count, runtime version, dataset and its distribution, concurrency level, whether the machine was otherwise idle. A number without its environment cannot be reproduced or compared.

A reportable line looks like:

> `MEASURED — hash index vs. B-tree, 10⁷ keys, 90/10 read/write, uniform keys. JMH 1.37, 3 forks × 10 iterations. Hash: 142 ns/op (median), IQR 8 ns. B-tree: 310 ns/op, IQR 14 ns. 2.2× on point lookup. Same host, 16 cores idle, JDK 21.`

## 5. THE HONESTY RULE — measured vs. derived, and never fabricated

**Every cost claim carries an explicit `MEASURED` or `DERIVED-ONLY` label. When no runner actually executed, the skill says so instead of producing a number.**

**A Big-O bound is never a measurement.** It is a statement about growth with a discarded constant; it cannot become a wall-clock figure by being written more confidently. "O(1) lookup" and "142 ns lookup" are different kinds of claim from different kinds of work, and presenting the first in the register of the second is the specific dishonesty this rule prohibits.

Correct labels:

- `MEASURED — JMH 1.37, 3 forks × 10 iterations, median 142 ns/op, IQR 8 ns, JDK 21, 16-core host idle`
- `DERIVED-ONLY — Θ(1) expected lookup, ~1–2 cache misses per probe. No benchmark executed.`
- `DERIVED-ONLY — Amdahl ceiling 20× at p = 0.95. Analytical bound, not a measurement.`
- `MEASURED (partial) — lookup path benchmarked; the compaction path is DERIVED-ONLY.`

**Never fabricate a plausible number.** When there is no execution environment, no runner, or no time to run one, the honest output is:

> *"No benchmark was executed in this session. The derived comparison predicts the hash index wins the 90% point-lookup case by roughly a small constant factor; **this is unverified**. The measurement that would settle it is: JMH `Mode.AverageTime`, 3 forks × 10 iterations, both structures at n = 10⁷, same host, interleaved."*

That paragraph is *more* useful than an invented "2.2× faster": it states the prediction, marks it unverified, and hands over the exact experiment. A fabricated measurement is unfalsifiable to the reader, gets quoted downstream, and cannot be distinguished from a real one — which is why it is worse than silence.

**The same discipline runs the other way.** Do not present a measurement as a general law. A measured 2.2× at n = 10⁷ on one machine with uniform keys is a fact about that configuration, not about the two structures. Report the configuration with the ratio, always.

**Related rule, stated once here and once in `correctness.md` §5:** an empirical result never upgrades to a proof. "Benchmarked, no regression across 10,000 runs" is evidence about performance the same way "no counterexample in 10,000 cases" is evidence about correctness. Same discipline, same wording, same refusal to overstate.

## 6. Micro vs. macro — when the number does not transfer

A microbenchmark isolates one operation. That isolation is its value and its limit, and the gap between the two is where most benchmark-driven mistakes live.

**A microbenchmark result stops transferring when:**

- **The cache picture differs.** In isolation your structure owns L1/L2. In production it shares the cache with everything else, so the "hot" structure is cold on most accesses and pointer-chasing costs full memory latency. This routinely reverses a microbenchmark's conclusion — and it is exactly the effect that makes a worse-Big-O contiguous structure win in practice (`complexity-and-structures.md` §5).
- **Contention differs.** A single-threaded microbenchmark of a lock-free structure measures the *uncontended* path, which is the one case where lock-free has the least advantage — and it entirely misses the cache-line ping-pong and CAS-retry storms that dominate under real concurrency (`concurrency.md` §1).
- **The distribution differs.** Uniform synthetic keys hide the hot-key skew, adversarial collisions, and long-tail sizes real traffic carries. Benchmark on production-shaped data or say plainly that you did not.
- **The operation is not the bottleneck.** A 3× win on 2% of the request budget is a 1.3% end-to-end win. **Compute the Amdahl bound on the whole request before optimizing the part** (`concurrency.md` §5) — this single check retires a large fraction of proposed optimizations before any work is done.
- **Steady state differs.** Microbenchmarks measure the warm path. Production includes cold start, cache fill, compaction, GC, and rebalancing, none of which appear in a JMH iteration.

**When the microbenchmark cannot answer the question, say so and name the next step — a load test.** An end-to-end test at realistic concurrency, on production-shaped data, reporting **percentiles rather than means** and corrected for coordinated omission (§1). That is a different instrument, and pretending a microbenchmark substitutes for it is the honest failure this section exists to prevent.

**The strongest form of the claim** is both, labeled separately: *"`MEASURED` — 2.2× on the isolated lookup (JMH, 3×10). `MEASURED` — 4% p99 improvement end-to-end under a 500 rps load test, because lookup is ~6% of the request budget. The isolated number is real and mostly does not reach the user."* That is what benchmark-driven means in this skill.

## 7. The pitfalls catalogue — detection before fix

§1 names the lies and their fixes. What it does not give is the **detection signal** — the property of the output that tells you which lie you are looking at — and a fix applied without detection is applied on faith. This catalogue adds that column. Where §1 already names the pitfall, the lie and fix cells are pointers, not restatements; the detection cell is the contribution. Four pitfalls (4, 7, 8, 9) are new here.

| # | Pitfall | How it lies | Detection signal | Fix |
|---|---|---|---|---|
| 1 | Dead-code elimination | §1.2 | Per-op cost at or below timer granularity; time does not grow when you double the work | §1.2, plus: re-run at 2× work and demand ~2× time |
| 2 | JIT warmup — and OSR | §1.1, plus a second layer: a single long hot loop gets **on-stack-replacement** code, which is not the code steady-state callers run | `-XX:+PrintCompilation` shows compiles inside the measurement window; OSR compiles are flagged `%` | §1.1 and §2, plus: benchmark at method granularity, not one giant loop — see below |
| 3 | Coordinated omission | §1.4 | Max latency sits orders above p99.9 while p99 looks clean; the generator's achieved rate dips below its intended rate mid-run | §1.4 |
| 4 | Averages where percentiles were the question | The mean is dominated by the bulk; the user experience is dominated by the tail | The report says "avg" and no histogram exists | Report the distribution — p50 / p99 / p99.9 / max — never a lone mean; see below for why the tail is what users meet |
| 5 | Cache-warm run answering a cache-cold question | §1.6 and §6 | Working set fits inside the LLC; cache-miss counters near zero (`perf stat`) | Size the working set past the LLC; or measure warm *and* cold, labeled as such |
| 6 | Frequency scaling, turbo, thermal throttling | §1.1 / §1.5 — whichever variant ran first wins | Monotonic drift across a session; effective clock (`turbostat`) falls during the run | Performance governor, turbo disabled or frequency pinned, thermal settle time, interleaved A/B (§4) |
| 7 | Allocator and heap state | A fresh process has a pristine heap; a long-lived one is fragmented with different GC ergonomics — same code, different cost | Fresh-fork results diverge from long-session results; per-iteration time drifts in allocation-heavy code | Fork per trial (§2) makes the fresh-heap experiment reproducible; decide *deliberately* which heap age is production-shaped |
| 8 | Throughput measured, tail latency asked | Batching and pipelining raise ops/sec *by adding* per-request latency; the two metrics can move in opposite directions | The question said "p99"; the report says "ops/sec" | A latency-distribution instrument (§2 `Mode.SampleTime`, a latency-mode load test) at the production arrival rate, not at saturation |
| 9 | n too small for the asymptote to matter | At small n the constants win and the "worse" Big-O is faster; the conclusion inverts at scale | The A/B ratio changes when n changes — you measured a point, not a curve | Benchmark at production n; run doubling sizes; report the crossover, not one point |

Four entries need more than a row.

**OSR (2).** The JVM reaches compiled code two ways: compile a method for its next call, or **on-stack replacement** — compile a loop that is already running and swap execution into the compiled body mid-flight. A benchmark written as one long hot loop is OSR-compiled, and OSR code can be optimized differently from what a normally-warmed call site runs (the optimization scope is cut at the replacement seam). So the naive fix for warmup — "just make the loop very long" — trades the warmup lie for a subtler one: a steady, reproducible number for code production never executes. This is a reason JMH exists, not an argument for a longer loop.

**Coordinated omission and the tail (3, 4).** Coordinated omission is **Gil Tene's** term ("How NOT to Measure Latency"), and his companion observation is why pitfall 4 is its own entry: a session issues many requests, so the user meets the tail with near-certainty — across 100 independent requests, the probability of hitting at least one p99-or-worse latency is 1 − 0.99¹⁰⁰ ≈ 63%. (Real latencies correlate in time, so treat that as the shape of the argument rather than an exact figure — the conclusion survives.) A mean answers "what does a request cost in aggregate"; the real question is almost always "what does the slowest thing a user waits on cost", and the mean cannot contain that answer. The two pitfalls compound viciously: omission deletes the tail, then averaging hides what is left, and the report reads *better* the worse the system behaved.

**Allocator and heap state (7).** This is the pitfall people who dodge all the others still hit, because it hides in the harness rather than the benchmark body. A just-started process has a contiguous heap, fresh allocator arenas, and — on a managed runtime — GC ergonomics sized to a tiny live set. A process up for a week has fragmentation, warm thread caches, and a GC shaped by its heap history. Neither is wrong; they are *different experiments*. Forking per trial makes the fresh-heap experiment reproducible — it does not make it the right experiment. State which heap age you measured; if the production process is long-lived, the aged-heap run is the one that transfers.

**n too small (9).** The crossover is textbook: production library sorts fall back to insertion sort below a small cutoff precisely because the O(n²) algorithm wins there — the asymptote has not started paying yet. A benchmark at small n that anoints the asymptotically better structure, or refutes it, has measured a constant-factor contest and mislabeled it. Detection is cheap and decisive: run at n, 2n, 4n, 8n; if the A/B ratio moves, one point cannot carry the conclusion. The honest output is the crossover — "B wins below roughly n₀, A above" — with production's n placed on that curve. Per §5, a single-n result is a fact about that n and must be labeled with it.
