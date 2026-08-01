# Budget, placement, compaction

The three rules of §2–§3, with their mechanics and the traps that ship most often.
Citations and grades live in `standards.md`; this file is the how.

## Budget: plan for 10–20% of the advertised window

The advertised context length is the number of tokens the model *accepts*, not the number
it *uses well*. Under genuine multi-fact reasoning, effective use measures at roughly a
tenth to a fifth of the claim (BABILong), and about half of tested models degrade before
their claimed 32K on tracing/aggregation tasks (RULER).

Practical consequences:

- **Set an explicit token budget per assembled context**, derived from the 10–20% band,
  and treat exceeding it as a design smell, not a scaling opportunity.
- When a task genuinely needs more material than the budget allows, the answer is
  **retrieval or phase-splitting**, not a bigger stuffing. A second phase with a fresh,
  purpose-assembled context beats one overloaded window.
- Reasoning substitutes for window: on LongBench v2, a reasoning-augmented model beat
  direct-answer models and the human baseline. If quality at length is the problem, more
  inference-time reasoning is a lever before more context is.

## Placement: start and end, and mind the hops

Accuracy is a U-shaped function of where the relevant information sits — highest at the
start and end of the context, materially worse in the middle, *including* in models
marketed for long context. The penalty **compounds across reasoning hops**: a task
needing three mid-context facts is far worse off than three times one mid-context fact.

- Task instruction and decision-relevant material go **first and last**. Bulk reference
  material goes in the middle — it is the least-read real estate.
- For multi-hop work, co-locate the facts a single inference step needs, or split the
  hops across phases so each phase's context is shallow.

## Testing: paraphrase, never keywords

A needle-in-a-haystack pass rate is close to meaningless: remove lexical overlap between
the question and the needle and a 99.3% score becomes 69.7% at 32K (NoLiMa). Standard
NIAH measures string matching. Real agent retrieval is paraphrastic and inferential, so
production behaviour sits near the NoLiMa number, not the NIAH number.

- Any probe set used to validate context handling (including §6's compaction probes)
  must ask its questions **in different words** than the stored material uses.

## Compaction: the addressable-store rule

Summarization compaction is lossy in a **task-correlated** way: the facts dropped are the
ones that looked unimportant at compression time, which is exactly the class that turns
out to matter three steps later. The 2026 systems literature converges away from "just
summarize" toward structured, typed, *addressable* context.

The rule: **anything compacted out of the window must remain recoverable by pointer.**
Compaction changes where a fact lives, never whether it exists.

- Prefer **structured eviction**: drop whole resolved episodes and keep a one-line
  outcome with a pointer to the full record, rather than re-summarizing everything into
  progressively blurrier prose.
- Derive what to keep from **failure analysis** (what did past truncations break?), not
  from generic importance heuristics (ACON's method).
- Summarization is also a **latency** cost: a blocking summarize call stalls the loop for
  tens of seconds. Compact at phase boundaries, not mid-flight.
- State the compaction's **correctness obligation** explicitly — the set of questions the
  compacted context must still answer — and check it with a paraphrase probe set
  (`trace-invariants.md`, invariant 1).

## Two traps that ship constantly

**The StreamingLLM misread.** Attention-sink retention plus a rolling window buys stable
perplexity on unbounded streams and a large speedup. It buys **zero long-range recall** —
the evicted middle is gone. It is an inference-efficiency technique; citing it as
"infinite context" designs a system that silently forgets. Corollary: naive KV eviction
that drops the first few tokens collapses output quality (the sink went with them).

**The bigger-window reflex.** When answers degrade, the reflex is to raise the window or
the budget. The measured causes are usually placement (the U-curve), compaction loss, or
staleness (`supersession.md`) — none of which a bigger window fixes, and the last of
which it actively worsens by keeping more stale material retrievable.
