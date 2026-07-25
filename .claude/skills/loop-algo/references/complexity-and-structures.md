# Complexity and data structures

How to derive and state a cost claim, and how to pick a structure against the access pattern the code actually has rather than the one you are used to. Vocabulary and proof style follow **CLRS 4th edition (2022)** — see `standards.md`.

## 1. State the bound correctly, or do not state it

Three bound *kinds* and three bound *cases* get conflated constantly, and the conflation is almost always in the direction that flatters the claim.

**The three notations** are not synonyms:

| Notation | Means | Say it when |
|---|---|---|
| **O(f)** | upper bound — cost grows *no faster than* f | You can bound the worst case but not tightly. |
| **Ω(f)** | lower bound — cost grows *at least as fast as* f | You are arguing a mechanism cannot beat a floor (comparison sort is Ω(n log n)). |
| **Θ(f)** | tight bound — both, so this *is* the growth rate | You have matched upper and lower bounds. This is the strongest claim, so earn it. |

Writing O when you mean Θ is not pedantry. "Never worse than n log n" and "this costs n log n" support different decisions.

**The three cases** are a separate axis, and this is where the real errors live:

- **Worst case** — the maximum over all inputs of size n. The only case that bounds a latency SLO, because an adversary or an unlucky user *will* find it.
- **Average case** — the expectation over an assumed input distribution. **Useless unless you state the distribution.** "Hash lookup is O(1) average" assumes hash values spread; under adversarial keys it degrades to Θ(n) per lookup, which is a real, exploited attack class.
- **Amortized** — the worst-case average over a *sequence* of operations. Not probabilistic: it is a guarantee about total cost, holding for every sequence.

**The rule.** Write the case in the same breath as the bound: *"Θ(1) amortized, Θ(n) worst-case single operation."* A dynamic-array push is both, and a p99 latency target cares only about the second one. A claim that says "O(1) push" and stops has hidden the exact number the reader needed.

**The compound trap.** Amortized bounds do not survive being nested inside a worst-case requirement. An amortized-O(1) resize inside a hard 5 ms deadline still blows the deadline on the resize operation — the amortization pays for it *over time*, and the deadline is *per operation*. When a real-time or tail-latency constraint exists, quote the worst case and consider an incremental (deamortized) variant instead.

## 2. The three amortized-analysis methods

All three give the same answer. Pick the one that makes the argument shortest; CLRS 4e names all three, and knowing which you used tells a reviewer where to check you.

### Aggregate method — total the sequence, divide by n

The bluntest and often the best. Bound the total cost of any n operations, then divide.

**Worked example — dynamic array doubling.** An array doubles capacity when full; a resize copies every element. Over n pushes starting from capacity 1, resizes happen at sizes 1, 2, 4, 8, …, so the total copy work is `1 + 2 + 4 + … + 2^⌊log₂ n⌋ < 2n`. Add the n individual writes: total `< 3n`. Amortized cost per push is therefore **Θ(1)**, while a single push is **Θ(n) worst case**.

The doubling factor is load-bearing. Growing by a *constant* (+10 slots) makes the total copy work Θ(n²), i.e. Θ(n) amortized per push — the classic "why is my append loop quadratic" bug. Any geometric factor > 1 works; 1.5× trades a little more copying for better allocator reuse.

### Accounting method — overcharge early, bank the credit

Assign each operation an invented *amortized charge*. Operations that cost less than their charge bank the difference; expensive operations spend the bank. Valid as long as **the bank never goes negative**, which is the thing you actually have to prove.

**Worked example — incrementing a binary counter.** `INCREMENT` flips a run of trailing 1s to 0 and one 0 to 1. Charge **2 units** per increment: 1 pays for setting that single bit to 1, and 1 is stored *on that bit* to pay for the future flip back to 0. Every reset is prepaid by the set that created it, so the bank is exactly the number of 1 bits and never goes negative. Amortized cost per increment is **Θ(1)**, though one increment can flip Θ(log n) bits.

For the dynamic array the same argument runs with **3 units** per push: 1 for the write, 1 saved to copy this element at the next resize, 1 saved to copy one already-present element that has no credit left.

### Potential method — a function of the data structure's state

Define Φ(Dᵢ) ≥ 0 with Φ(D₀) = 0. Amortized cost is `ĉᵢ = cᵢ + Φ(Dᵢ) − Φ(Dᵢ₋₁)`. Summing telescopes, so total amortized ≥ total actual. The most mechanical of the three, and the one that generalizes to structures where "which operation pays" is not obvious (splay trees, Fibonacci heaps).

**Binary counter.** Let Φ = the number of 1 bits. An increment with t trailing 1s costs `t + 1` actual and changes Φ by `1 − t`. Amortized cost = `(t + 1) + (1 − t)` = **2**, for every t.

**Dynamic array.** Let `Φ = 2·num − size`. Between resizes each push costs 1 actual and raises Φ by 2 → amortized 3. On a resize (`num = size` before, cost `num + 1`), Φ drops from `num` to `2` → amortized 3 again. Same **Θ(1)**, derived without inventing a charge.

## 3. The access-pattern decision table

**Name the access pattern before you name a structure.** This is a trade-off search, not a preference: every row below buys something by giving something up, and the "wrong" answer is only wrong relative to a pattern.

| Access pattern | Candidates | What you give up |
|---|---|---|
| **Point lookup by key**, no ordering needed | Hash table; perfect hash if the key set is fixed | Ordering, range queries, and worst-case (adversarial or degenerate) guarantees |
| **Range scan / "keys between a and b"** | Sorted array, B-tree, LSM-tree, skip list | O(1) point lookup; sorted arrays give up cheap insertion entirely |
| **Ordered iteration, full traversal** | Balanced BST, B-tree, sorted array | Insert throughput relative to a hash table |
| **Insert-heavy, read-rare** (logs, telemetry, event capture) | Append-only log, LSM-tree, unsorted array | Read latency, plus background compaction cost and write amplification |
| **Read-heavy, near-static** | Sorted array with binary search, immutable perfect hash, precomputed index | Cheap mutation; rebuilds get expensive |
| **Min/max repeatedly, priority order** | Binary heap, pairing/Fibonacci heap | Search for an arbitrary element (Θ(n) in a binary heap) |
| **Prefix / autocomplete / longest-match** | Trie, radix tree, ternary search tree | Memory — a naive trie's per-node pointer array is enormous |
| **Membership only, memory-constrained** | Bloom filter, cuckoo filter — see `randomized-structures.md` | Exactness: you accept a false-positive rate you must state |
| **Cardinality only, memory-constrained** | HyperLogLog — see `randomized-structures.md` | Exactness: ~1–2% relative error |
| **FIFO/LIFO with high concurrency** | Ring buffer, lock-free queue — see `concurrency.md` | Simplicity, and often strict fairness |

If two rows both match, you have two candidates and a real trade-off — that is precisely the case `templates/algorithm-bakeoff.workflow.js` exists for.

## 4. Structure profiles

**Array / contiguous vector.** Θ(1) indexed access, Θ(n) insert-in-middle, Θ(1) amortized append (§2). Its real advantage is not asymptotic: **contiguity means the prefetcher works and every cache line you pull holds several elements you will use.** This is why linear scan over a few thousand contiguous items routinely beats a pointer-chasing structure with a better bound.

**Hash table.** Θ(1) expected lookup/insert, Θ(n) worst case. Two collision strategies:

- **Chaining** — buckets hold lists. Tolerates load factor α > 1, degrades gracefully, costs a pointer dereference per probe (a likely cache miss), and allocates per entry.
- **Open addressing** (linear/quadratic probing, Robin Hood, cuckoo) — everything lives in one array. Far better cache behavior; requires α < 1 with real headroom, and deletion needs tombstones or backward-shift. Linear probing collapses sharply as α passes ~0.7–0.8; keep a resize threshold below that.

Iteration order is not defined, and **hash collision behavior is adversarially attackable** when keys are attacker-supplied: use a seeded/keyed hash (SipHash-class) for anything that hashes untrusted input.

**Balanced BST (red-black, AVL) vs. B-tree.** Both give Θ(log n) search/insert/delete and ordered iteration. They differ on the constant that dominates in practice:

- **Red-black** rebalances less on insert (fewer rotations), so it favors write-heavy in-memory workloads; **AVL** is more strictly balanced, so it favors read-heavy ones.
- **B-tree** packs many keys per node, sized to a disk page or a cache line. Its win is the **number of node visits**: a fanout-100 B-tree reaches a billion keys in ~5 levels where a binary tree takes ~30. When each level is a cache miss or an I/O, that is the entire performance story, and it is invisible in the Θ(log n) both structures share.

**Heap / priority queue.** Binary heap: Θ(1) peek-min, Θ(log n) push and pop, Θ(n) build from an array, contiguous storage. Arbitrary search and arbitrary delete are Θ(n) unless you maintain a side index — an extremely common oversight in "priority queue with cancellation" designs.

**Trie / radix tree.** Θ(k) lookup in key *length*, independent of the number of stored keys — the only structure here whose cost does not grow with n. Prefix operations are free. Memory is the cost; a radix (path-compressed) tree or an adaptive-node-size variant is usually the shippable form.

**Skip list.** Expected Θ(log n) search/insert with a probabilistic guarantee rather than a worst-case one (see `randomized-structures.md` §5), ordered iteration, and — the reason it appears in real systems — **lock-free and fine-grained-locking variants that are far simpler to get right than a concurrent balanced tree.**

**LSM-tree.** Writes land in an in-memory table plus a write-ahead log (Θ(1) amortized, sequential I/O); reads may consult the memtable plus several immutable on-disk runs, so a read is Θ(log n) *per run* and typically fronted by a per-run Bloom filter to skip runs that cannot contain the key. The costs: **read amplification** (multiple runs), **write amplification** (compaction rewrites data repeatedly), and background compaction competing with foreground traffic. Leveled compaction lowers read amplification and raises write amplification; size-tiered does the reverse. Choose by the read:write ratio, and say which compaction strategy you assumed.

## 5. Space, time, and when a worse Big-O wins

Asymptotic analysis deliberately discards constants, and on real hardware the constants routinely span two orders of magnitude. **Big-O tells you where the curves cross, not which side of the crossing you are on.**

- **Cache locality beats pointer chasing.** An L1 hit is ~1 ns; a main-memory miss is ~100 ns. A Θ(n) scan of a contiguous array can beat a Θ(log n) tree walk well past the size where the asymptotics say it should not, because the scan costs n/8 cache misses (many elements per line, prefetched) and the walk costs log n *unpredictable* misses.
- **Small-n dominance.** Every production sort switches to insertion sort under a threshold (typically 16–32 elements) because Θ(n²) with a tiny constant beats Θ(n log n) with recursion and partitioning overhead down there.
- **Allocation is a hidden constant.** A structure that allocates per element pays the allocator and the GC on every operation. Arena-allocated or flat variants often win purely on this.
- **Space-time is a dial, not a fixed point.** Precompute an index (more space, less time), or recompute on demand (less space, more time). Compress (less space, more CPU). Cache (more space, less repeated time). Approximate (see `randomized-structures.md`) — the most aggressive move on this dial, and the only one that changes the *answer*.

**The discipline:** derive the bound, then say where you believe the crossover is, then measure at the sizes the system actually sees. A derived crossover you did not measure is `DERIVED-ONLY` — see `benchmarking.md` §5.

## 6. Worked example — hash index vs. sorted structure at a stated read:write ratio

**The ask.** An in-memory index over ~10 million entries. Workload: **90% point lookups by exact key, 10% inserts, no deletes**, plus a reporting job needing keys in a range. Which structure?

**Step 1 — split the access patterns.** Two rows of the §3 table both match: *point lookup* (hash) and *range scan* (B-tree/sorted). This is a real trade-off, not a preference; write both candidates down.

**Step 2 — derived cost table.** n = 10⁷, so log₂ n ≈ 23. B-tree fanout 100 → depth ⌈log₁₀₀ 10⁷⌉ = 4.

| Operation | Hash table (open addressing) | B-tree (fanout 100) |
|---|---|---|
| Point lookup | Θ(1) expected, ~1–2 probes, **~1–2 cache misses** | Θ(log n), **4 node visits ≈ 4 cache misses** |
| Insert | Θ(1) amortized; Θ(n) on rehash | Θ(log n); Θ(1) node splits amortized |
| Range scan `[a, b]` | **Θ(n) — full scan plus a sort.** Not supported | Θ(log n + k) for k results, in order |
| Memory | ~1.4× entries at α ≈ 0.7 | ~1.05–1.3× entries, denser nodes |
| Worst case | Θ(n) under adversarial or degenerate keys | Θ(log n), guaranteed |

**Step 3 — weight by the stated mix.** 90% of operations are ~2–4× cheaper on the hash table (measured in cache misses, which is what actually dominates here). The 10% inserts are close to a wash. **The whole decision therefore rests on the range scan**, which the hash table does not support at all and which the ratio never told us the frequency of.

**Step 4 — the answer, and the honest caveat.** If the reporting job is rare and offline, take the **hash table** and serve the report by sorting a snapshot (Θ(n log n), once, off the hot path). If range queries are on the request path at any meaningful rate, take the **B-tree**: it is within a small constant on the 90% case and asymptotically better on the case the hash table cannot do.

**Label it.** Everything above is `DERIVED-ONLY` — a cost model in cache misses, not a measurement. The crossover claim ("within a small constant on lookups") is exactly the kind of statement that should be measured before it is relied on; `benchmarking.md` §2–3 is how, and §5 is why the label stays attached until then.
