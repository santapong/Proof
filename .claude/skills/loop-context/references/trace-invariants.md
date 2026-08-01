# Trace invariants — proving context handling instead of asserting it

Verification here anchors to the **trace** — the run's actual sequence of contexts,
returns, and state objects — because a trace is an external, executable signal, and the
peer-reviewed record is blunt that ungrounded model opinion is not a check: intrinsic
self-correction measurably *lowers* accuracy, and the fix is an external grounded signal,
not a second opinion (see `standards.md`). Trace-checking is also the formally viable
direction — runtime enforcement over traces is peer-reviewed and cheap (AgentSpec, ICSE
2026), while having a model *author* formal specs is not (8.6% semantic correctness).

**Honesty first:** property-based invariants over agent traces have no literature — this
is homegrown machinery in territory nobody has claimed. The four invariants below are
defended by what they catch, and they are deliberately checkable with grep, replay, and a
probe set: no model checker, no spec language.

## The four invariants

### 1. Compaction preserves answers
For a fixed probe set of questions answerable from the pre-compaction context, every
probe is answerable from the post-compaction context (directly, or via the addressable
store its pointers name). **Probes must paraphrase** — a probe sharing the stored text's
wording tests string matching, not preservation (NoLiMa). *Catches:* the summarize-and-
destroy defect; a pointer that names a record the store no longer serves.

### 2. State updates are idempotent
Replaying a checkpoint — re-running a phase from its entry state — yields the same exit
state: no double-counted increments, no duplicated appends. Mechanically: every `append`
carries a dedup key; every `increment` is keyed to an event id, not to "this code ran".
*Catches:* resume bugs, which otherwise surface only in the rare run that actually
resumes — the worst possible discovery schedule.

### 3. A superseded fact never influences a later decision
After a correction lands, the retracted value appears in no subsequent context assembly
or decision rationale. Mechanically: grep the trace for the retracted value after the
correction's timestamp; anything found is either labeled-as-superseded (audit inclusion —
allowed) or a violation. *Catches:* the 60.5% ranking failure (`supersession.md`) at the
point where it matters — action, not storage. After a purge, run this with the purged
value: it must appear **nowhere**, labeled or not.

### 4. No irreversible action without its recorded precondition
Every irreversible act in the trace (push, publish, delete, external call with side
effects) is preceded by the check it claims to depend on, *in the trace*, with its
result. An action whose precondition was checked in a different phase and never
re-recorded fails — the state contract (Clause 3) says the checkpoint is what a phase
knows. *Catches:* the gap between "the design says we check" and "this run checked".

## Stating a new invariant

Keep to the same grammar — a quantified statement over trace elements, checkable by
grep/replay/probe: "for every X in the trace, Y holds at or before it". If checking needs
a judgment call, it is a review lens, not an invariant — route it to a verify stage
instead. Good candidates: budget conformance (no assembled context exceeds the declared
budget), placement conformance (instructions present in the head and tail segments).

## What invariants cannot prove

They are necessary, not sufficient: a run can satisfy all four and still be wrong in ways
only a grounded functional check catches (tests, oracles). They also verify **runs, not
designs** — a green trace proves this run held, not that all runs will. Pair them with
the held-out oracle machinery for outcome truth (`loop-autopilot`'s held-out eval), and
treat a violation as AP-class evidence: invariant 2 failing is an AP2-adjacent
persistence defect; invariant 3 failing in accumulated config is the drift AP6's
detectors watch for from outside.

## Running them

`templates/context-audit.workflow.js` runs the audit: inventory the target's context
surfaces, audit each dimension (budget, placement, compaction, state contract,
supersession) against the rules, then check whatever traces are available against the
four invariants, reporting each violation with the evidence line that proves it. The
verify stage judges only *evidence quality* — whether the cited line shows what the
finding claims — never re-litigating the rule.
