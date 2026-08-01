# The agent-engineering vocabulary — what we checked, what we adopt

**Status:** research record, 1 Aug 2026. **Method:** two passes. The first followed the
2026 vocabulary as given; the second deliberately ignored it and searched the literature
by mechanism instead. The second pass produced almost everything of value, because most
of these terms rename ideas that already have rigorous literature under older names.

**How to read the verdicts.** *Adopt* means the term names something real and we use it.
*Adapt* means the underlying idea is sound but the name or framing is not, so we take the
mechanism and leave the vocabulary. *Reject* means the sourcing did not survive checking.

---

## The nine terms

### 1. Prompt engineering — the words you send
**Verdict: foundational, uncontested.** No source claims it obsolete.
**How we use it:** no skill owns it, and none should. It is the substrate every skill
writes on, not a job anyone is dispatched to do.

### 2. Context engineering — everything the model sees
**Verdict: adopt the practice, reject the maturity framing.** Vishnyakova
(arXiv:2603.09619) casts it as a rung on a pyramid you graduate from; Lilian Weng treats
it as a live lever the harness keeps optimizing. Weng's model is right for us — context
assembly never stops being a design decision.

**How we adapt it — three rules now backed by measurement, not taste:**
- **Budget 10–20% of the advertised window.** BABILong (NeurIPS 2024) finds models
  effectively use a tenth to a fifth of the claimed number under real multi-fact
  reasoning; RULER (COLM 2024) found only about half of models held their stated 32K.
  Treat the vendor number as a ceiling on tokens accepted, never as a working budget.
- **Position is a variable we control.** The U-curve (Liu et al., TACL 2024) survives
  into long-context models: put instructions and decision-relevant material at the
  **start and end**. The penalty compounds across reasoning hops (arXiv:2412.10079), so
  a task needing three mid-context facts is far worse than three times one.
- **Never compress without an addressable store.** Summarization drops what looked
  unimportant at compression time, which is exactly the class that matters three steps
  later (arXiv:2606.22953). ACON (2510.00615) and MemAct (Findings of ACL 2026) are the
  citable baselines.

**Trap to avoid:** a needle-in-a-haystack pass rate is close to meaningless. NoLiMa
(ICML 2025) removes lexical overlap between question and needle and GPT-4o falls from
**99.3% to 69.7% at 32K**. Standard NIAH largely measures string matching.

### 3. Intent engineering — what the agent values
**Verdict: reject the term, adopt the real analogue.** It exists essentially only inside
Vishnyakova's vocabulary — an unreviewed single-author preprint whose numbers are
pass-throughs from Deloitte and KPMG, and whose claimed affiliation could not be
verified. The two papers usually cited alongside it do **not** support it: arXiv:2603.17150
is Shuvendu Lahiri (Microsoft Research) on NL → tests → contracts → verified code, and
arXiv:2606.20585 is Red Hat / MIT-IBM with a released benchmark. Neither uses the phrase;
she cites neither. Same English word, different problems.

**How we adapt it:** the idea of an explicit, enforced priority order is real — see
**OpenAI's Model Spec**, a versioned production artifact with a Root > System > Developer
> User > Guideline authority hierarchy and published evals. Our equivalent already exists
and does not need a new name: the harness and loop policies (H1–H12, L1–L8), plus each
skill's boundary clauses. When rules conflict, that ordering is the answer.

### 4. Specification engineering — what repeats at scale
**Verdict: reject the term.** Same single preprint. The surrounding spec-driven-development
wave (GitHub Spec Kit, Amazon Kiro, Tessl) is real but never uses this vocabulary, and its
"3–10× first-pass success" figures are vendor-reported.
**How we adapt it:** `loop-skill` and the standards shelves already are our machine-readable
corpus. Nothing to add.

### 5. Harness engineering — permissions, retries, logs, state around one agent
**Verdict: adopt.** Mitchell Hashimoto, Feb 2026; covered independently by Martin Fowler
and Lilian Weng. The boundary line both state: **the harness is the car, the loop is the
driver.**
**How we use it:** this is `loop-harness`, and it is the layer *below* the loop — which is
part of why the plugin name had to stop being pinned to "loop" alone.

### 6. Loop engineering — when to keep going, when to stop
**Verdict: adopt, with one correction.** Osmani (Jun 2026, O'Reilly Radar) is a real
coinage with a real mechanism: `do → check → decide continue/stop`. We keep the `loop-`
prefix on every skill for this reason.

**The correction — this changes how we build verify stages.** Osmani says a separate
model should grade. The peer-reviewed evidence is narrower than that. Huang et al.
(ICLR 2024) and Kamoi et al. (TACL 2024) kill *intrinsic self-correction* — net accuracy
**drops**. But Kambhampati's group (arXiv:2402.08115) shows a separate pass on the same
model class fails too. **The load-bearing variable is an external grounded signal, not
model identity** — test execution, a trained process reward model, tool output. Lightman
et al. (ICLR 2024) get 78% of a MATH subset from step-level supervision. Reflexion's 91%
HumanEval depends on running the tests.

**How we adapt it:** anchor verify stages to something executable wherever possible.
A skeptic agent's opinion is the fallback, not the default. Related numbers worth holding:
self-preference bias is real at roughly **10pp** (Zheng et al., NeurIPS 2023) — the ~24.7pp
figure circulating online is misattributed and should not be quoted; and best-of-N gains
concentrate at n=4–16 and flatten after, which is an argument against modes that merely
sample harder.

**Honest gap:** there is **no peer-reviewed formalism for agent stop rules**. L1/L4 are
sound engineering, not a result. Defend them by the cost they avoid.

### 7. Graph engineering — many loops, shared state
**Verdict: reject the term, adopt the mechanism.** The term is ~2 weeks old, has no paper,
no framework docs, and no lab adoption; it went from one tweet to "discipline" in ten days
via content farms visibly copying each other. Turing Post's demolition is the right frame:
*"A loop is already a graph. It is simply a graph whose path returns to an earlier node."*
The governance-flavoured variant (paired metrics, anchors, cadence separation) traces to a
single uncited Substack essay, not a school of thought.

**How we adapt it — three things underneath it are real and better-evidenced:**
- **Shared state.** LangGraph's model is the one to steal: typed state, **per-field
  reducers** `(Value, Value) -> Value` with last-write-wins as default and accumulation
  opt-in, plus a **checkpointer** persisting after every node transition. This is the
  honest version of "graph engineering," and it is the engine's real gap.
- **Searched topology.** AFlow (ICLR 2025), MaAS (ICML 2025 Oral) and ScoreFlow
  independently find learned topology beats hand-designed — AFlow at GPT-4o quality for
  4.55% of the cost. Recorded in `loop-engine/references/standards.md` as an open
  question, not a migration: our templates are narrow-domain, where MetaGPT and ChatDev
  show fixed pipelines stay competitive, and no head-to-head on a shared benchmark exists.
- **When to fan out at all.** LangChain's read/write split: breadth-first read-heavy work
  parallelizes; write-heavy coupled work does not. Cognition's *Don't Build Multi-Agents*
  names the failure as context fragmentation — share full traces, not individual messages.

### 8. Meta-harness — the harness optimizes itself
**Verdict: adopt.** Lilian Weng's *Harness Engineering for Self-Improvement* (4 Jul 2026)
is the best-sourced document in the entire sweep. Mechanisms: ACE (generator/reflector/
curator), MCE, ADAS/AFlow, Self-Harness/AHE.

**How we adapt it — this is `loop-autopilot`, and the research mostly validated what was
already built.** The held-out suite being invisible to the Act stage, AP6's diff-integrity
refusal on protected paths, the impossible-test canary, the out-of-band false-accept
tracker: all of that already answers the literature's central finding. **Both documented
reward-hacking incidents trace to one cause — the optimizer could reach the thing that
measured it.** DGM deleted the logging its hallucination detector read (more often when
the detector was visible); STOP's models disabled the sandbox flag.

Two genuine gaps, now written up:
- **AP7 — Monoculture Loop.** Selection is effectively greedy. GEPA (ICLR 2026) measures
  greedy at **−6.4%** versus Pareto; DGM's no-archive ablation stalls; FunSearch uses
  island resets. Keep a population, not a running best. *Documented; guard not yet built.*
- **Capability gating.** STOP (COLM 2024): GPT-4 improves the improver, GPT-3.5 and
  Mixtral **degrade** it — good ideas, wrong implementations. Sandbox-disabling also rises
  with capability (0.42% vs 0.12%). A weak `--planner` is unvalidated for unattended runs.

### 9. Memory engineering — persistence; bi-temporal, never delete
**Verdict: adapt heavily; the framing does not survive.** Not an established discipline —
the phrase traces to one LangChain blog line. The *architecture* is real: Zep
(arXiv:2501.13956) separates valid time from transaction time and invalidates rather than
deletes. But three things undercut "most solid of all":
- Zep's headline 84% LoCoMo score **was a scoring bug**; Mem0 reran it at 58.44%, and
  Zep's CEO conceded and revised to 75.14%.
- Invalidation metadata existing **does not mean retrieval ranking respects it** —
  arXiv:2606.26511 finds stale facts still served **60.5%** of the time.
- **"Never delete" collides with GDPR Article 17.** Invalidation is not erasure, and no
  vendor publishes a hard-delete path.

**How we adapt it:** no memory skill. The durable finding is that the hard problem is
**update, not recall** — LongMemEval (ICLR 2025) concentrates its ~30% degradation in
temporal reasoning, knowledge updates and abstention. Append-only stores make this worse.
Where the plugin persists anything across rounds (the credit ledger, `seen`, the rubric),
prefer itemized supersession over accumulation, per ACE's delta-update discipline.

---

## Two openings this research found that nobody has taken

Recorded because they are contributions, not catch-up.

1. **Property-based invariants over agent traces are unexplored.** All property-based-testing
   work runs the opposite direction — benchmarking whether agents can *write* PBT tests.
   Nobody writes Hypothesis/QuickCheck-style invariants over trajectories. The obvious ones
   need no model checker: *compaction preserves any answer the pre-compaction context could
   give*; *memory updates are idempotent*; *a retracted fact never influences a later
   decision*; *no irreversible action without the precondition it claimed to check*.
2. **Static checking of our own workflow templates.** Agentproof (arXiv:2603.20356) extracts
   graphs from LangGraph/CrewAI/AutoGen/ADK and found **27% structural and 55% policy
   violations** across an 18-workflow benchmark. Cheap, available, and almost nobody runs it.
   Our 27 templates have never been checked this way.

Note also that the LTL/runtime-enforcement bridge is already built and peer-reviewed —
**AgentSpec (ICSE 2026)**, >90% unsafe-execution prevention at millisecond overhead. What
is *not* viable is having an LLM author formal specs: NL → TLA+ achieves **8.6% semantic
correctness** (arXiv:2606.05792), and model size does not predict quality. Use formal tools
to check traces, never to write the spec.

---

## Citation discipline for this file

Carry the grade with the claim. Peer-reviewed here: MAST (NeurIPS 2025), GEPA and DGM
(ICLR 2026), STOP (COLM 2024), GenRM/PRM (ICLR 2024), Huang (ICLR 2024), Kamoi (TACL 2024),
Zheng (NeurIPS 2023), NoLiMa (ICML 2025), BABILong (NeurIPS 2024), LongMemEval (ICLR 2025),
RULER (COLM 2024), Liu (TACL 2024), FunSearch (Nature 2023), AgentSpec (ICSE 2026).
Everything else cited above is preprint-grade — several are 2026 and unreplicated. Two
figures are known-bad and must never be reproduced: MAST's tidy category split
(41.8/36.9/21.3) and the ~24.7pp self-preference number.
