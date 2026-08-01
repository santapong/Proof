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

## The violation catalogue

An invariant nobody can picture gets "checked" by skimming, and skimming is the
ungrounded self-review this file exists to replace. Each violation below has a **fixed
trace shape** — knowing it turns "review the trace" (a judgment call) into "run this
detector" (mechanical), which is what lets the audit template's verify stage judge
evidence quality instead of re-litigating rules. Each row carries only the shape and the
detector; the rule stays with the invariant or clause that owns it.

| Violation | What the trace shows | Detector | Violates |
|---|---|---|---|
| **Side-channel phase** | Phase N+1's segment contains reads against raw sources (files, URLs) that phase N already read and checkpointed. | Diff phase N+1's read targets against its entry checkpoint: every read must name a checkpoint field or a pointer the checkpoint carries. Any other read is the violation — even when both reads happened to agree. | Clause 3 (`shared-state.md`) — the trace form of its re-derivation anti-pattern |
| **Keyless append** | A list field holds two entries identical except for timestamp: a resumed run's replayed phase appended its finding again. | Invariant 2's replay. Statically: grep the workflow script for appends into state with no key derivation. | Invariant 2; Clause 2 (the field's declared merge is append) |
| **Summarize-and-destroy** | A compaction step whose output is prose naming no store records — nothing downstream can dereference. The summary *reads* complete; summaries always read complete to whoever compressed them, which is why eyeballing detects nothing here. | Invariant 1's paraphrase probes (`context-rules.md` §Testing). A probe that fails with no pointer to chase is the violation. | Invariant 1; the addressable-store rule |
| **Zombie fact** | A decision rationale dated after a correction cites the retracted value, unlabeled — the store held the correction the whole time; assembly preferred the stale fact. | Invariant 3's grep, scoped to context assemblies and decision rationales. | Invariant 3; the retrieval-preference clause (`supersession.md`) |
| **Unrecorded precondition** | An irreversible act whose phase segment contains no preceding check-with-result — the check usually *did* run, in an earlier phase, so this run's trace cannot prove the act was gated. | For each irreversible act, scan backward within its phase for the recorded check and its result. A check found only in another phase's segment does not count — that is invariant 4's point. | Invariant 4; Clause 3 |
| **Prose relay** | A claim hardens across hops — hedged where it originated, asserted by the agent that consumed it as prose. No single hop looks wrong; the drift is only visible across hops. | Statically: grep the workflow script for `agent()` results consumed by a later prompt without a `schema`. In the trace: diff each hop's restatement of a claim against the hop that originated it. | Clause 1 (`shared-state.md`) |

Two reading rules. **The detector's output is the finding's evidence** — a catalogue
entry cited without the line its detector produced is an opinion, and the audit
template's verify stage will treat it as one. **Absence of a known shape is not a
pass** — the catalogue lists the shapes seen so far; the invariants quantify over the
whole trace, and the checks under "Running them" remain the gate.

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
