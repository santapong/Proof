# Concurrency mechanisms

Choosing a concurrency mechanism, arguing its correctness against a named memory model, and bounding the speedup it can possibly deliver. Vocabulary follows **The Art of Multiprocessor Programming, 2nd edition (2020)**; the two memory models are the **ISO/IEC 14882:2024** (C++23) `<atomic>` model and **JLS ch. 17** (Java SE 25). See `standards.md`.

**Read §7 before you ship anything on the third or fourth rung of §1.** Concurrency is the one area in this skill where a confident, careful, entirely wrong argument is the normal outcome of reasoning by inspection.

## 1. The ladder — four rungs, and what each one costs

Climb only when the rung you are on is *measurably* the bottleneck. Every step up buys throughput under contention and pays in correctness risk, debugging difficulty, and the size of the argument you owe a reviewer.

| Rung | Mechanism | Buys | Costs |
|---|---|---|---|
| **1. Coarse lock** | One mutex around the whole structure | Correctness you can argue in one sentence; trivially composable multi-step operations | Serializes everything; one slow critical section stalls all threads |
| **2. Fine-grained locks** | Per-bucket, per-node, striped, or hand-over-hand locking | Real concurrency under a spread key distribution | Deadlock (needs a documented lock order), higher per-op overhead, composition across locks is now hard |
| **3. Lock-free (CAS-retry)** | Atomic compare-and-swap loops; no thread blocks another | **Progress guarantee**: some thread always advances, so no priority inversion, no convoying, no stall on preemption | ABA, memory reclamation, memory-ordering reasoning, and a correctness argument that no longer fits in a code review |
| **4. Wait-free** | Every thread completes in a **bounded** number of its own steps | Per-thread latency bound — the only rung that bounds the *tail* | Substantially more complex (helping/announcement mechanisms); often *lower* throughput than lock-free at low contention |

**The progress hierarchy** (AoMP 2e) is the precise vocabulary, and the terms are not interchangeable:

- **Wait-free** — every thread finishes in bounded steps. Strongest.
- **Lock-free** — *some* thread makes progress; an individual thread can starve indefinitely.
- **Obstruction-free** — a thread running *in isolation* (others paused) finishes. Weakest; needs a contention manager to be useful.

Note what "lock-free" does **not** mean: it does not mean fast, and it does not mean starvation-free. A lock-free queue under heavy contention can be *slower* than a well-implemented lock, because every failed CAS is wasted work plus a cache-line invalidation. **Rung 3 is a latency-tail and progress-guarantee decision far more often than a throughput decision** — and if you are choosing it for throughput, that is a claim requiring a benchmark (`benchmarking.md`), not a derivation.

**Rungs 0 and 0.5, which are usually the right answer and get skipped.** Before rung 1: *don't share the state.* Per-thread/shard-local structures merged at a barrier, immutable snapshots with copy-on-write, or a single-writer design with an SPSC queue eliminate the problem instead of solving it. Read-mostly data under `RCU`, a read-write lock, or an atomically swapped immutable snapshot beats every rung above for a 1000:1 read:write ratio.

## 2. Linearizability — the correctness bar

The concurrent analogue of "the structure is correct." **A concurrent object is linearizable if every operation appears to take effect instantaneously at some single instant between its invocation and its response, and the resulting sequential order is consistent with the object's sequential specification.**

Two properties make it the bar worth meeting:

- **It is composable.** A system built from linearizable components is linearizable. Sequential consistency is not composable, which is why it is the weaker, less useful bar for a data structure.
- **It licenses sequential reasoning.** Once an object is linearizable, callers may reason about it as if operations happened one at a time — which is the entire point of building the thing.

**State the linearization point.** This is the concrete deliverable, not the definition. For each operation, name the *single* instruction at which it takes effect:

- Michael–Scott queue `enqueue` — linearizes at the **successful CAS that links the new node into `tail.next`**, not at the subsequent CAS that swings `tail` (which is the helping step any thread may perform).
- Treiber stack `push` — the successful CAS on `top`.
- A `get` on a lock-free map — the atomic load of the value field, *provided* it is ordered against the publishing store; see §4.

Two rules that catch most errors:

1. **The linearization point must lie inside the operation's own invocation-to-response interval.** If you cannot place it there, the operation is not linearizable as written.
2. **An operation's linearization point may depend on other threads' behavior** (a failed CAS that must retry linearizes on the *successful* attempt; a read-only operation may linearize at a point determined by a concurrent writer). This is legitimate and is exactly where hand arguments go wrong — it is a strong signal to escalate to §7.

**Weaker bars, named honestly.** *Sequential consistency* (a legal total order exists, but not necessarily respecting real time), *quiescent consistency*, and *eventual consistency* are all weaker and sometimes correct choices — a metrics counter does not need linearizability. **Say which bar you are claiming.** "Thread-safe" is not a bar; it is a word.

## 3. CAS-retry and the ABA problem

The shape of nearly every lock-free operation:

```
do {
    old = shared.load(acquire)
    new = compute(old)            // pure; may run many times, must be side-effect free
} while (!shared.compare_exchange_weak(old, new, release, acquire))
```

Three things this shape demands: `compute` must be side-effect free (it *will* run repeatedly); `compare_exchange_weak` may fail spuriously, so it belongs in a loop and `_strong` belongs outside one; and the failure-path ordering argument is separate from the success-path one — that is why the exchange takes two orderings.

**ABA.** A thread reads value **A**, is preempted, and while it is descheduled another thread changes the location to **B** and back to **A**. The first thread's CAS *succeeds* — the bits match — but the world it validated no longer exists. On a pointer-based structure this is catastrophic: the node was popped, freed, reallocated, and reinserted, and the CAS just spliced a stale `next` pointer into the live structure.

**ABA is a pointer-reuse problem far more than a value problem.** A monotonically increasing counter cannot suffer it. Three standard fixes:

| Fix | Mechanism | Trade-off |
|---|---|---|
| **Tagged / stamped pointers** | Pack a monotonically increasing version counter alongside the pointer and CAS both together (double-width CAS, or spare alignment bits; `AtomicStampedReference` on the JVM) | Simple and fast. Needs a double-width CAS or spare bits, and the counter can theoretically wrap |
| **Hazard pointers** | Each thread publishes the pointers it is currently dereferencing; a reclaimer frees a node only when no hazard pointer references it | Bounded memory; per-dereference store plus a scan on reclaim. The right default when unbounded deferral is unacceptable |
| **Epoch-based reclamation (EBR)** | Threads announce an epoch on entering a critical region; nodes retired in epoch *e* are freed once every thread has advanced past *e* | Very low read-side cost. **A stalled or preempted thread pins the epoch and memory grows without bound** — a real production failure mode |

**A garbage-collected runtime removes the reclamation half, not the ABA half.** On the JVM a popped node is not freed while a thread holds a reference, so use-after-free cannot happen — but the same node object can legitimately be re-pushed, and then A really is A again. Java's `AtomicStampedReference`/`AtomicMarkableReference` exist precisely for this.

## 4. Memory models made concrete

**The rule this section exists for: a concurrency correctness claim must cite the exact ordering it depends on.** "It's atomic" is not an argument — atomicity and ordering are independent properties, and a relaxed atomic gives you the first with none of the second.

### C++23 — `std::memory_order` (ISO/IEC 14882:2024, `<atomic>`)

| Ordering | Guarantees | Use for |
|---|---|---|
| `relaxed` | Atomicity and per-location modification order only. **No** ordering with respect to any other location | Statistics counters, reference-count *increments*, flags whose ordering is established elsewhere |
| `acquire` (load) / `release` (store) | A release store *synchronizes-with* an acquire load that reads its value; everything sequenced before the release becomes visible to everything sequenced after the acquire | **The default for publication** — building a node then publishing it, and the standard pairing for lock-free structures |
| `acq_rel` | Both, on a single read-modify-write | The success ordering of a CAS that both consumes and publishes |
| `seq_cst` | Acquire/release **plus** a single total order over all `seq_cst` operations | When correctness needs a global order across *multiple* locations (e.g. Dekker-style mutual exclusion). The default, and the most expensive |
| `consume` | Ordering along a data dependency only | **Do not use.** Its specification is discouraged and implementations promote it to `acquire`; write `acquire` and mean it |

**The pairing is the argument.** Release and acquire are useless alone; the guarantee exists only between a matching pair on the same variable. Write it as a sentence a reviewer can check:

> *"The producer's `release` store to `head` publishes the node's `value` and `next` writes; the consumer's `acquire` load of `head` establishes synchronizes-with, so the fields it then reads are the ones the producer wrote. The counter uses `relaxed` because nothing depends on its ordering."*

**A data race in C++ is undefined behavior** — not a stale read. Two unsynchronized accesses to the same non-atomic object with at least one write license the compiler to do anything, including optimizations that make the code nonsensical. "It's just a torn read" is not a description of the semantics.

### Java — the JMM (JLS ch. 17, Java SE 25; model unchanged since JSR 133, 2004)

The JMM is stated in terms of **happens-before**, a partial order. The edges you cite:

- **Program order** within a thread.
- **Monitor lock** — an unlock happens-before every subsequent lock of the same monitor.
- **`volatile`** — a write happens-before every subsequent read of that field. This is Java's acquire/release, and it is total across all volatile accesses (closer to `seq_cst` than to plain acquire/release).
- **Thread start/join** — `Thread.start()` happens-before anything in the started thread; everything in a thread happens-before another thread's successful `join()`.
- **`final` fields** — after a constructor completes without leaking `this`, other threads see correctly initialized finals **without** synchronization. The escape clause is real: publishing `this` from a constructor voids the guarantee.
- **`java.util.concurrent`** — actions before placing an object into a concurrent collection happen-before its retrieval; `VarHandle` (and the legacy `Atomic*` classes) expose explicit `getAcquire`/`setRelease`/`compareAndExchange` modes when full volatile ordering is more than you need.

**A data race in Java is also undefined behavior in the sense that matters**: the JMM permits any value allowed by the happens-before order, so a racy read may observe a value no sequentially consistent execution could produce. It will not crash the VM, and it will absolutely return a value your code does not handle. Double-checked locking without `volatile` is the canonical instance and remains broken.

**Cite the edge.** *"`state` is `volatile`; the write in `publish()` happens-before the read in `consume()`, which is what makes the non-volatile `payload` write visible."* That sentence is falsifiable. "It's synchronized somewhere" is not.

## 5. Scalability ceilings — bound the claim before you benchmark it

Three models, in increasing fidelity. All three are `authoritative: false` (see `standards.md`) and all three produce **derived** numbers — `benchmarking.md` §5 governs the label.

**Amdahl's Law (1967) — fixed problem, more cores.** With serial fraction `1 − p`:

`S(N) = 1 / ((1 − p) + p/N)`, bounded above by `1 / (1 − p)`

The ceiling is the point. At p = 0.95, infinite cores buy **20×**, and 32 cores already buy 15.4× — so the 33rd core is nearly worthless. Compute this before proposing a parallelization: if the serial fraction caps you at 4×, a lock-free rewrite that costs three weeks and a class of bugs is answering the wrong question.

**Gustafson's Law (1988) — fixed time, bigger problem.** When the workload grows with the resources (larger batches, more shards, higher request volume):

`S(N) = (1 − p) + p·N`

Linear, not asymptotic. Amdahl and Gustafson do not contradict each other; **they answer different questions**, and stating which one you are asking is half the analysis. "Will this request get faster on a bigger box" is Amdahl. "Can we serve 10× the traffic on 10× the boxes" is Gustafson.

**Universal Scalability Law (Gunther, 2007) — when throughput turns over.** Amdahl's curve plateaus; it can never decline. Real systems routinely get *slower* past a peak concurrency, and Amdahl structurally cannot express that. USL adds a second term:

`C(N) = N / (1 + σ(N − 1) + κN(N − 1))`

- **σ (contention)** — the serialized fraction, Amdahl's term. Produces the plateau.
- **κ (coherency)** — pairwise cross-talk: cache-line invalidation, lock-state propagation, distributed consensus chatter. Grows as N², which is what produces the **retrograde** region.

Peak concurrency sits at `N* = √((1 − σ)/κ)`. **Reach for USL specifically when a throughput curve is expected to turn over rather than merely plateau** — a shared cache line touched by every core, a lock whose state must propagate, a replica set that gossips. If κ > 0, adding capacity past N\* *reduces* throughput, and no amount of Amdahl reasoning will predict it.

Fitting σ and κ requires measured throughput at several concurrency levels. **A USL fit is a measurement, not a derivation**, and it must be labeled `MEASURED` with the concurrency points it was fitted over — an unfitted USL is just two unknown parameters.

## 6. Decision table — when the simple lock is the right answer

Default to the lowest rung that meets the requirement. The burden of proof is on climbing, and it is a **measurement**, not an intuition.

| Situation | Take | Why |
|---|---|---|
| Contention is low (threads rarely collide) | **Coarse lock** | An uncontended mutex is tens of nanoseconds. The correctness risk of a lock-free rewrite buys nothing measurable |
| Critical section is long, or does I/O | **Coarse or fine-grained lock** | Lock-free requires short, retryable, side-effect-free sections. I/O cannot be retried idempotently — a CAS loop is not applicable |
| Multi-step operations must be atomic together | **Lock** | Lock-free structures compose poorly: two linearizable operations back to back are not one atomic operation. A lock gives you this for free |
| The operation is a single word update | **Atomic (rung 3-lite)** | A counter or flag needs `fetch_add`/`compare_exchange`, not a mutex. This is the cheapest real win on the ladder |
| Read:write ratio is extreme (≫100:1) | **RW lock, RCU, or an immutable snapshot swap** | Beats every rung above without any lock-free reasoning |
| Measured lock contention is the bottleneck **and** the section is short and retryable | **Fine-grained, then lock-free** | Sharding or striping the lock usually captures most of the win at a fraction of the risk. Try it before rung 3 |
| Hard per-operation latency bound (real-time, priority inversion is unacceptable) | **Lock-free or wait-free** | The one case where the progress guarantee itself is the requirement, and the complexity is justified on correctness grounds rather than throughput |
| You are about to hand-write a lock-free structure | **Check `loop-scout` first** | A correct, tested, maintained implementation (`java.util.concurrent`, a vetted C++ library) almost always exists and beats a bespoke one on every axis including performance |

**The strongest argument for the lock is that its correctness argument fits in a code review.** A lock-free structure's argument does not — which is why the next section is not optional.

## 7. The escape hatch — model checking, named explicitly

**Proof by inspection is not sufficient for subtle concurrent code, and this file will not pretend otherwise.** A lock-free algorithm that "looks right" to a careful reader can still carry an ABA bug, a missing acquire on one branch, a linearization point that escapes its own interval, or a reclamation race that appears once in 10⁹ executions on one microarchitecture. Reviews do not find these. Unit tests do not find these. Property-based testing samples *inputs*, not *schedules*, so it barely helps (`correctness.md` §4).

**Escalate to formal methods when any of these hold:**

- The structure is lock-free or wait-free and will carry production traffic.
- Correctness depends on a specific interleaving of three or more threads.
- The mechanism involves memory reclamation (hazard pointers, EBR) — reclamation races are the hardest class here.
- The argument requires a linearization point that depends on another thread's actions (§2, rule 2).

**The tools.** **TLA+** with the **TLC** model checker exhaustively explores interleavings up to a bounded state space and reports a concrete counterexample trace; **TLAPS** provides machine-checked proofs when the state space is unbounded. Complementary empirical tools tighten the loop before that: ThreadSanitizer (TSan), the Java Concurrency Stress tests (**jcstress**, from the same OpenJDK project as JMH), C++ `relacy`-style race checkers, and stress runs under an artificially perturbed scheduler.

**When you have not done it, say so.** The honest output is:

`NOT PROVEN — lock-free enqueue's linearization point argued informally; interleaving space not explored. Model checking (TLA+/TLC) or a jcstress harness recommended before this carries production traffic.`

That is a useful, actionable result. **"I reviewed it carefully and it looks correct" is not** — it is the highest-confidence, lowest-accuracy claim available in this skill, and `correctness.md` §7 names the same escape hatch from the other side for exactly that reason.
