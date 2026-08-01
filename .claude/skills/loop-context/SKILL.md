---
name: loop-context
description: "Engineer what an agent carries at runtime: context budgets and placement, compaction paired with an addressable store, typed shared state with per-field merge rules and checkpoints handed between workflow phases, supersession of stale facts, and property-based invariants over agent traces. Use when the user asks to manage or debug agent context or agent memory, decide what to keep, compact, or evict, design the state passed between agents or phases, fix an agent that forgets, repeats itself, or acts on a stale fact, or verify that compaction lost nothing that mattered. The subject is the information an agent carries while it runs. For Claude's own configuration — permissions, hooks, MCP servers, schedules — use loop-harness. For the orchestration shapes that execute (pipeline, parallel, guarded loops), use loop-engine. For a product's database schema or data model, use loop-design. For prose a human reads, use loop-docs."
argument-hint: <target> [--mode <lite|balanced|all-out>]
---

# Context & State

**If the defect or design question lives in the information an agent carries while it runs — what enters its window, what survives compaction, what state crosses a phase boundary, which version of a fact wins — it is this skill.** If it lives in what the agent is *permitted* to do, that is `loop-harness`; in the shape of the run (pipeline, barrier, loop guard), that is `loop-engine`; in a product's persistent data model, that is `loop-design`.

Three findings govern everything here, all measured, none folklore: models effectively use **10–20% of their advertised window** under real multi-fact reasoning; **naive summarization compaction destroys** exactly the facts that matter later; and the hard problem in long-running agents is **update, not recall** — stale facts retrieve as strongly as current ones. Full citations and grades: `references/standards.md`.

**Execution flags.** `--mode <lite|balanced|all-out>` is parsed by `loop-engine`, never here — pass the raw argument string through. See `../loop-engine/references/execution-modes.md`.

## 1. Name the target and the failure

Establish which of the four jobs this is, then follow its section:

| Symptom / ask | Job | Section |
|---|---|---|
| Window pressure, truncation, "lost in the middle", degraded long-context answers | **Budget & placement** | §2 |
| History too big; summaries losing things; agent re-asks what it was told | **Compaction** | §3 |
| Agents or phases hand results by prose; parallel writers clobber; resume impossible | **Shared state** | §4 |
| Agent acts on a fact that was corrected; accumulating config drifts | **Supersession** | §5 |

For any job, if the fix must be *proven* rather than asserted, finish at §6 (trace invariants).

## 2. Budget & placement — `references/context-rules.md`

- **Budget 10–20% of the advertised window**, never 100%. The vendor number is a ceiling on tokens accepted, not a working budget.
- **Position is a design variable**: instructions and decision-relevant material at the **start and end**; the U-curve penalty is real, survives long-context models, and **compounds across reasoning hops**.
- A needle-in-a-haystack pass proves lexical matching, not usable context. Test with paraphrase, not keywords.

## 3. Compaction — `references/context-rules.md` §Compaction

- **Never compress without an addressable store.** Summarization drops what looked unimportant at compression time — exactly the class of fact that matters three steps later. Anything compacted out must remain *recoverable by pointer*, not destroyed.
- Prefer **structured/typed eviction** (drop whole resolved episodes, keep their outcome line) over prose re-summarization of everything.
- Compaction has a correctness obligation, not just a size target: state what the compacted context must still be able to answer, then check it (§6).

## 4. Shared state across agents and phases — `references/shared-state.md`

- State that crosses a boundary is **typed and schema'd** — a named object with declared fields, never prose for a downstream agent to re-parse (harness policy H3 is the same rule at the single-result scale).
- Every field declares its **merge rule** when writers can be concurrent: last-write-wins is the default and must be *chosen*, accumulation (`append`) is opt-in, and a field with neither declared is a latent race.
- **Checkpoint at phase boundaries** — persist the state object after each phase so a run can resume from the last boundary instead of the beginning. The engine's `resumeFromRunId` replays agent results; the state contract makes what they *meant* replayable too.
- Fan out on **read-heavy** work; keep **write-heavy, tightly-coupled** work in one context. Context handed to parallel workers is fragmented by construction — share the decision record, not just the task line.

## 5. Supersession — `references/supersession.md`

- The failure mode is **acting on a stale fact**, and invalidation metadata alone does not prevent it — retrieval must *prefer* the superseding fact, not merely store the correction.
- Accumulating config (ledgers, rubrics, `seen`/coverage records) updates by **itemized delta — add / increment / deprecate — never wholesale rewrite**; rewriting is how detail silently vanishes.
- Every fact that can change carries **when it was true** and **when it was recorded** — two timestamps, not one. Corrections append and point at what they supersede.
- Where a deletion mandate applies (secrets, personal data), supersession is not enough: there must be a real purge path. Do not claim "invalidated" satisfies "deleted".

## 6. Prove it — `references/trace-invariants.md`

Assertions over the agent's *trace*, checkable without a model checker:

1. **Compaction preserves answers** — questions answerable before compaction are answerable after (spot-check with a fixed probe set).
2. **State updates are idempotent** — replaying a checkpoint does not double-count.
3. **A superseded fact never influences a later decision** — grep the trace for the retracted value after its correction.
4. **No irreversible action without its recorded precondition check.**

Run these via `templates/context-audit.workflow.js`, which audits a target (a repo's agent code, a workflow template, or a session transcript) against §2–§5 and reports violations with evidence lines. Verification anchors to the trace — an executable, external signal — not to another agent's opinion of the design.

## Reference files

- `references/context-rules.md` — budget, placement, compaction: the measured rules and the traps (NIAH, StreamingLLM misread)
- `references/shared-state.md` — the typed-state contract: fields, merge rules, checkpoints, handoff, when not to fan out
- `references/supersession.md` — update-over-recall: two-timestamp facts, delta discipline, retrieval preference, the purge caveat
- `references/trace-invariants.md` — the four invariants, how to state new ones, and what they cannot prove — plus the violation catalogue: each invariant's concrete failure shape in a real trace
- `references/standards.md` — the pinned authorities behind every rule above, graded, with the confirmation log
- `templates/context-audit.workflow.js` — fan-out audit of a target against §2–§5, verified against trace evidence
