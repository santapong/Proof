# Randomized and approximate structures

Structures that trade exactness for space or time against a **stated, derived error bound**. Formulas below come from the original papers pinned in `standards.md` — Bloom (CACM 13(7), 1970), HyperLogLog (Flajolet et al., AOFA 2007), Count-Min Sketch (Cormode & Muthukrishnan, J. Algorithms 55(1), 2005).

**Carry these formulas exactly. Do not paraphrase them from memory.** An off-by-a-constant error bound is worse than no claim at all: the reader sizes a production system against your number and discovers the real rate in an incident. Every formula here is written so you can recompute it rather than trust it.

## 1. When approximate beats exact

The trigger is always a **budget that the exact structure does not fit**, not a preference for cleverness. Write the budget down first:

- **Memory.** The exact set does not fit in RAM, or fits but evicts something more valuable. 10⁷ 16-byte keys in a hash set at load factor 0.7 need ≈ 230 MB for keys alone, before per-entry overhead. A Bloom filter answering the same membership question at 1% false positives needs ≈ 12 MB.
- **Latency.** The exact answer requires a network round trip or a disk seek that the approximate answer avoids entirely.
- **Cardinality of the state, not the data.** Per-key exact counters over an unbounded key space grow without bound. A sketch is fixed-size by construction.

**Three preconditions before you propose one.** (1) The application must tolerate the error *in the direction the structure makes it* — one-sided error is only useful if the tolerable side matches. (2) You must be able to state the budget numerically, or you cannot size the structure. (3) The exact structure must actually not fit — approximating something that fits is a needless correctness liability, and `loop-scout` may well find a maintained exact index that solves it.

## 2. Bloom filter — membership with one-sided error

A bit array of **m** bits with **k** independent hash functions. Insert: set the k bits. Query: if any of the k bits is 0, the element is **definitely absent**; if all are 1, it is *probably present*.

**No false negatives. False positives at a rate you choose.** That asymmetry is the whole design, and it dictates the use: a Bloom filter is a *filter*, in front of an expensive exact lookup it lets you skip.

**The formulas**, with n elements inserted:

```
p  ≈ (1 − e^(−kn/m))^k                  false-positive rate
k_opt = (m/n) · ln 2  ≈  0.693 · (m/n)  optimal hash count
m/n   = −ln p / (ln 2)²  ≈  −1.44 · log₂ p    bits per element at optimal k
p     = 2^(−k)                          at optimal k
```

The last line is the one to remember as a sanity check: **at the optimal hash count, each additional hash function halves the false-positive rate**, and each element costs about 1.44 · log₂(1/p) bits.

**Sizing worked example.** Target: n = 10⁷ elements, p = 1%.

1. `m/n = −ln(0.01)/(ln 2)² = 4.6052 / 0.4805 = 9.585` bits per element.
2. `m = 9.585 × 10⁷ bits ≈ 95.9 Mbit ≈ 12.0 MB`.
3. `k_opt = 0.693 × 9.585 = 6.64 → 7` (integer; check both neighbours).
4. Verify at k = 7: `p = (1 − e^(−7/9.585))⁷ = (1 − 0.4818)⁷ = 0.5182⁷ = 0.0100` → **1.00%**. At k = 6 it is 1.01%. Either is fine; take 7.

**The honest statement of that result:** *"A 12.0 MB Bloom filter over 10 million keys (m/n = 9.6 bits, k = 7) answers membership with a **1.0% false-positive rate and zero false negatives**, against ≈ 230 MB for an exact hash set — a ~19× space saving paid for by 1 in 100 negative lookups doing an unnecessary exact check."* Space saving and error cost in one sentence; see §6.

**Three practical traps.**

- **n is the count you sized for.** Insert 2n elements into that filter and p rises to ≈ 8.5%, not 2%. Bloom filters do not degrade gracefully past their design point — size for the maximum, or use a scalable/partitioned variant.
- **You cannot delete.** Clearing bits would create false negatives, since bits are shared. Use a **counting Bloom filter** (counters instead of bits, ~4× the space) or a **cuckoo filter** (supports deletion, and is often smaller below ~3% target error).
- **k independent hashes are not k hash computations.** Use double hashing — `g_i(x) = h₁(x) + i·h₂(x)` — from two independent hashes. This is standard, and its effect on p is negligible.

## 3. HyperLogLog — cardinality in kilobytes

Estimates the number of **distinct** elements in a stream using fixed space, in a single pass, with mergeable state. Hash each element; use the first `log₂ m` bits to pick one of **m** registers; record in that register the maximum count of leading zeros seen in the remaining bits. Many leading zeros is rare, so a large maximum implies a large cardinality; averaging across m registers (harmonically, with a bias correction) turns that into an estimate.

**The formula, and the word that matters:**

```
relative standard error  ≈  1.04 / √m
```

**It is RELATIVE, not absolute.** Misremembering this as an absolute count is the named failure mode of this section. At m = 16384 the error is **0.81% of the cardinality** — on a true cardinality of 10 million that is ±81,000, and on a true cardinality of 1,000 it is ±8. An absolute reading would have you expecting ±0.0081 of *something*, which is meaningless. Say "relative" out loud in the claim.

It is also a **standard error**, i.e. one σ: roughly 68% of estimates land within ±1.04/√m, and ~95% within ±2.08/√m. Quote the confidence with the number.

**Register count vs. accuracy vs. space** (6-bit registers, the standard choice for 64-bit hashes):

| Registers m | Relative std. error | State size |
|---|---|---|
| 1,024 (2¹⁰) | 3.25% | 768 B |
| 4,096 (2¹²) | 1.63% | 3 KB |
| 16,384 (2¹⁴) | **0.81%** | **12 KB** |
| 65,536 (2¹⁶) | 0.41% | 48 KB |

**Why kilobytes.** Each register stores a small integer — a count of leading zeros, so 6 bits covers cardinalities past 2⁶⁴. The state is `m × 6` bits **regardless of how many elements passed through it**: the 12 KB row estimates a billion distinct items exactly as well as a million. Accuracy improves only as √m, so buying a decimal place costs 100× the space — which is precisely why 12 KB is the near-universal production choice.

**The property that sells it in practice: HLL sketches merge.** The union of two sketches is the register-wise maximum, so per-shard or per-hour sketches combine into a global distinct count with no re-scan and no double counting. Exact `COUNT(DISTINCT)` has no such operation. Intersections, however, must go through inclusion–exclusion and **the relative errors compound badly on small intersections** — do not build an intersection-heavy design on HLL.

## 4. Count-Min Sketch — frequency with one-sided overestimation

A `d × w` counter matrix with d pairwise-independent hash functions. Increment: add to one counter per row. Query item i: take the **minimum** across its d counters.

**The guarantee**, with `‖a‖₁` = the total mass of the stream (sum of all counts):

```
w = ⌈e / ε⌉        d = ⌈ln(1 / δ)⌉

â(i) ≥ a(i)                                    always — never underestimates
â(i) ≤ a(i) + ε·‖a‖₁     with probability ≥ 1 − δ
```

**The error is a fraction of the whole stream, not of the item.** This is the trap. Sizing example: ε = 0.001, δ = 0.01 → `w = ⌈e/0.001⌉ = 2719`, `d = ⌈ln 100⌉ = 5`, so 13,595 counters ≈ **54 KB at 4-byte counters**, giving *"with 99% probability, every count is overestimated by at most 0.1% of total stream mass."* Over a 10⁹-event stream that additive slack is **10⁶**. An item whose true count is 500 may legitimately be reported as 1,000,500.

So: **Count-Min is accurate for heavy hitters and worthless for the tail**, by construction. Errors are one-sided (always ≥ truth), which is the right direction for "is this over the threshold" and the wrong direction for "is this below it."

**If the actual question is "which items are the heavy hitters," say so and take the variant.** Plain Count-Min answers *point queries*; finding the top-k requires pairing it with a heap of candidates, or using **Count-Min with conservative update** (increment only the minimum counters — reduces overestimation, at the cost of no longer supporting deletions), or **Space-Saving**, which is designed for top-k directly and is usually the better fit. Choosing plain Count-Min when the ask was top-k is the most common misapplication in this section.

## 5. Reservoir sampling and skip lists — probabilistic guarantees, exact answers

Two structures whose *randomness buys a complexity guarantee* rather than an approximate answer. The distinction matters when you state the bound.

**Reservoir sampling (Algorithm R).** A uniform sample of k items from a stream of unknown length, in one pass, in O(k) space: keep the first k; for each subsequent item i (1-indexed), draw j uniformly from [1, i] and if j ≤ k, replace `reservoir[j]`. **Every item ends with probability exactly k/n of being in the sample** — the sample is exactly uniform, not approximately so. The randomness is in *which* items, not in the correctness of the distribution. O(n) time, O(k) space, no prior knowledge of n.

**Skip list.** A sorted linked list with probabilistic express lanes: each node is promoted to the next level with probability p (typically ½ or ¼), giving expected `log_{1/p} n` levels. Search, insert and delete are **expected Θ(log n)**; the worst case is Θ(n), with probability vanishing rapidly in n. Lookups return the exact element — the probability is over the *cost*, not the answer.

**State the bound honestly.** "Expected Θ(log n)" and "worst-case Θ(log n)" are different guarantees, and a balanced tree offers the second. Under a hard tail-latency SLO, an expected bound is the weaker claim and you must say so. What buys skip lists their place in real systems is not the bound but the engineering: **concurrent and lock-free skip lists are dramatically easier to implement correctly than concurrent balanced trees** (see `concurrency.md` §1), because insertion is local and needs no rotation.

## 6. THE HONESTY RULE — the error bound travels with the space saving

**State the derived error bound and its confidence level in the SAME SENTENCE as the space saving. Never claim the space win alone.**

The failure mode is not lying; it is a true sentence that omits the price. "We replaced the 230 MB set with a 12 MB Bloom filter" is true, will be repeated, and will reach someone who does not know a false positive is possible. Say it whole:

> ✅ *"12 MB Bloom filter (m/n = 9.6, k = 7) over 10 million keys: **1.0% false positives, zero false negatives**, versus ≈ 230 MB exact — a ~19× saving, paid for by 1 in 100 negative lookups performing an unnecessary exact check."*
>
> ✅ *"12 KB HyperLogLog (m = 16384): distinct-count with **0.81% relative standard error (one σ; ~95% of estimates within 1.6%)**, versus an exact set proportional to cardinality."*
>
> ✅ *"54 KB Count-Min (w = 2719, d = 5): **never underestimates; overestimates by at most 0.1% of total stream mass with 99% probability** — on a 10⁹-event stream that is up to 10⁶ absolute, so this is valid for heavy hitters only."*
>
> ❌ *"Bloom filters cut memory by 19×."* — true, and it omits the entire cost.

Four rules that follow:

1. **Name the direction of the error.** One-sided error is only safe when the tolerable side matches: Bloom over-admits, Count-Min over-counts, HyperLogLog errs in both directions.
2. **Name the confidence level.** "0.81% error" without "standard error, one σ" reads as a hard bound. It is not one.
3. **Cite the parameters you sized with** (m, n, k, w, d, m/n) so a reader can recompute. A rate without its parameters cannot be checked, and cannot be re-derived when n changes.
4. **Label it per `benchmarking.md` §5.** Every number in this file is `DERIVED-ONLY` — these are analytical bounds, not measurements. The measured false-positive rate of a real filter on real keys with a real hash function is a benchmark, and it is worth running when the rate is load-bearing: hash quality on skewed real-world keys is the usual reason a filter underperforms its formula.
