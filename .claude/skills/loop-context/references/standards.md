# The authorities behind the context & state rules

Every rule in this skill traces to a measured result. This shelf pins each source, grades
it on the plugin's three levels (**Yes** — ratified by a standards body; **Draft** — real
working-group output, unratified; **No** — real and widely used, still somebody's
opinion), and closes with the confirmation log. Nothing on this shelf grades above **No**:
this domain has papers and running systems, not ratified standards — that distribution is
the point, and it is why every rule here is defended by the cost it avoids, not by
appeal to authority.

## Peer-reviewed anchors (grade: No — papers, not specifications)

| Source | Venue | The result this skill uses |
|---|---|---|
| Liu et al., *Lost in the Middle* — arXiv:2307.03172 | **TACL 2024** | Accuracy is U-shaped in the position of relevant information; holds for long-context models. → §2 placement rule. |
| *Lost in the Middle, and In-Between* — arXiv:2412.10079 | preprint | The position penalty **compounds across hops** in multi-hop QA. → §2. |
| **BABILong** — arXiv:2406.10149 | **NeurIPS 2024 D&B** | Models effectively use **~10–20% of claimed context** under multi-fact reasoning. → §2 budget rule. |
| **RULER** — arXiv:2404.06654 | **COLM 2024** | Only ~half of tested models held their claimed 32K on tracing/aggregation. → §2. |
| **NoLiMa** — arXiv:2502.05167 | **ICML 2025** | Remove lexical overlap and GPT-4o falls **99.3% → 69.7% at 32K**; NIAH is a string-matching test. → §2 "test with paraphrase". |
| **LongMemEval** — arXiv:2410.10813 | **ICLR 2025** | ~30% degradation on sustained multi-session memory, concentrated in **temporal reasoning, knowledge updates, abstention** — the hard problem is update, not recall. → §5. |
| **StreamingLLM** — arXiv:2309.17453 | **ICLR 2024** | Attention sinks + rolling window give stable perplexity on unbounded streams. **It does not extend effective context** — the evicted middle is unrecoverable. Cited here mainly against its own misreading. → §3. |
| **MemAct** — arXiv:2510.12635 | **Findings of ACL 2026** | Context management as learned in-place editing actions; ~51% less context at parity with far larger models. The only peer-reviewed entry in the 2026 agent-context wave. → §3. |

## Preprint-grade (grade: No, unreplicated — cite with the caveat)

| Source | The result |
|---|---|
| **ACON** — arXiv:2510.00615 | Compression guidelines derived from *failure analysis*, not generic summarization; no fine-tuning. Best-established compaction baseline. → §3. |
| *Plans Don't Persist* — arXiv:2606.22953 | Summarization compaction is lossy in a task-correlated way: the dropped facts are the ones that matter later. → §3's addressable-store rule. |
| Addressable Recall Compaction — arXiv:2607.25066; Structured Context Eviction — arXiv:2606.11213; Parallel Context Compaction — arXiv:2605.23296 | The 2026 cluster converging on structured/typed/pointer-based context over "just summarize"; also: blocking summarization stalls inference for tens of seconds. → §3. |
| **Zep** — arXiv:2501.13956 | The bi-temporal model: valid time vs transaction time; contradictions set `t_invalid` rather than deleting. → §5's two-timestamp rule. Caveat carried with it: the vendor's later 84% LoCoMo claim was a scoring bug, conceded and revised to 75.14. |
| Stale-fact retrieval — arXiv:2606.26511 | Invalidation metadata existing ≠ ranking respecting it: superseded facts still served **60.5%** of the time, 3.3% flagged. → §5's "retrieval must prefer" rule. |
| **ACE** — arXiv:2510.04618 | Context collapse and brevity bias named; mitigation is **itemized delta updates, never wholesale rewrites**. → §5 delta discipline. |
| **LangGraph** state model (framework docs, no paper) | Typed state, per-field reducers `(Value, Value) -> Value`, last-write-wins default, accumulation opt-in, checkpointer after every node. The engineering source for §4's contract. Framework docs move; re-verify API names before citing a specific call. |
| Cognition, *Don't Build Multi-Agents* (blog, Jun 2025) | Context fragmentation across parallel agents; share full traces, not messages. → §4's fan-out caution, jointly with LangChain's read/write split (blog). |
| **AgentSpec** — arXiv:2503.18666, **ICSE 2026** | Runtime enforcement over agent traces, >90% unsafe-execution prevention at ms overhead — proof that trace-checking is the viable formal direction. → §6. Companion negative result: NL→TLA+ generation reaches only **8.6% semantic correctness** (arXiv:2606.05792) — have tools check traces, never have the model author the spec. |

## Known-bad figures — never reproduce

- **The tidy MAST category split (41.8/36.9/21.3)** — circulates in secondary sources, unconfirmed against the primary text (modes are per-trace and non-exclusive).
- **The ~24.7pp self-preference figure** — misattributed; the defensible number is ~10pp (Zheng et al., NeurIPS 2023).

## What is deliberately left open

- No head-to-head exists between compress, retrieve, and hybrid context strategies on a shared benchmark — the largest evidential hole in the 2026 literature.
- "Effective context length" has no standard definition (BABILong, RULER, and NoLiMa measure three incompatible things).
- Whether learned context policies (MemAct, AdaCoM) beat heuristic ones (ACON) enough to justify training cost — open.
- Property-based invariants over agent traces (§6) have **no literature at all** — this skill's four invariants are homegrown, stated as such, and defended by what they catch.

## Confirmation log — 2026-08-01

Verified via a two-pass literature sweep (term-following, then paper-first term-agnostic;
recorded in `docs/design/agent-engineering-terms.md`): every arXiv ID above resolves to
the claimed paper; venues read from arXiv comments fields or anthology entries. **Numbers
inside papers came from abstracts and search summarization, not full-text reads** — spot-
check any figure before making it load-bearing elsewhere. Unconfirmed and left open:
LongBench v2's specific numbers; peer-review status of ShinkaEvolve and Meta Context
Engineering; all single-figure claims in the 2026 preprint cluster.
