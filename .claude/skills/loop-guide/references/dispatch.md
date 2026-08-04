# Dispatch — from verdict to managed execution

The verdict is a claim; the dispatch is where it is either honored or quietly betrayed. This file covers the three verdict shapes, filling the routed skill's arguments, conducting a chain, and the routing note that closes every engagement.

## The verdict, stated to the user

Whatever the shape, the statement has the same three parts, in the user's vocabulary:

1. **The route** — which skill (or ordered chain), named plainly.
2. **The because-line per pick** — the checkable answer that selected it: *"users are affected right now → incident response first."* One sentence each. This is the skill's non-negotiable: a verdict without its because-lines cannot be refuted before work runs, and a user who can refute a misroute in ten seconds is the cheapest verification pass this plugin has.
3. **What happens next** — what the routed skill will produce, so the user can object to the deliverable too, not just the route.

Confirmation policy (SKILL.md §4): unambiguous single skill → dispatch directly, stating the route as you go; chain or escalation → one confirmation, because the user is committing to more than one deliverable.

## Single skill

Invoke it with **arguments filled from the request and the interview** — target path, the failing behavior, the question — so the routed skill starts working instead of re-asking. The interview's facts are the routed skill's intake; making the user repeat them is the most common way a front door loses trust on its first use.

Pass `--mode` / `--planner` through **verbatim** if the user gave them. Never invent one: execution scale is the user's dial and the routed skill's default, in that order — guide adding `--mode all-out` because the problem "seems big" is spending the user's money on a hunch.

## Ordered chain

A chain is 2–4 hops with **genuine handoffs** — each hop's output is the next hop's input, and the boundary each artifact crosses is one the audit already names (recovered ADRs crossing from `loop-comprehend` to `loop-design`; a reproduction crossing from `loop-comprehend` to `loop-debug`; a findings list crossing from `loop-review` to `loop-pattern`).

**Conduct between hops, never during them.** While a hop runs, its skill owns the work entirely — guide does not second-guess mid-flight. At each boundary, three checks:

1. **The artifact arrived** — the hop produced what the next hop needs, concretely (the map exists, the findings list is non-empty). An empty artifact is a decision point, not a pass-through: a review with zero findings ends the chain early, and ending early is a success.
2. **The route still holds** — re-validate the next hop against what the artifact revealed. The route was a hypothesis formed on interview facts; hops generate better facts. A comprehension pass that surfaced a live defect re-routes to `loop-debug`; one that surfaced user impact re-routes to `loop-incident` *immediately*, mid-chain, because that tripwire outranks any plan.
3. **The user is told at re-routes only.** A chain proceeding as announced needs no narration; a changed route needs the new because-line before proceeding.

**The 5-hop tripwire.** A chain that grows to roughly five hops — or sprouts hops during execution — is a project wearing a chain's clothing. Stop conducting and escalate to `loop-build` (or `loop-orchestrate` if the user wants the plan, not the conduct). Guide's conduction has no gates, no repair rounds, no ledger; `loop-build`'s does, and conducting a project without them is how scope creep ships unreviewed (trap #4).

## Escalation

Escalating **is** the verdict — it is not a failure of routing but its correct output for three shapes:

| Signal | Escalate to | Hand over |
|---|---|---|
| "Conduct this to done" · the chain hit the 5-hop tripwire | `loop-build` | The interview facts and any hops already completed, as its brief |
| A named multi-phase job wanting a plan, DAG, and cost ledger | `loop-orchestrate` | The scoped job description |
| No existing skill's boundary contains the ask | `loop-skill` | The gap, stated as a candidate charter — and say plainly that the alternative is doing it skill-less, which is sometimes right for a one-off |

Hand over *everything gathered* — an escalation that discards the interview and lets the target re-ask is the same defect as a single-skill dispatch with empty arguments.

## The routing note

Every engagement closes with one paragraph, whatever the outcome:

> Asked: <the request, one line>. Routed: <skill or chain> because <the because-lines>. Re-routes: <any, with what triggered them>. Outcome: <delivered / escalated / ended early at hop N because …>.

The note is what makes a misroute diagnosable after the fact — without it, a bad outcome cannot be traced to the question that mis-eliminated, and the interview never improves. On a misroute the user catches, the note records the correction too: that pair (wrong because-line → right one) is exactly the material a future boundary-audit pass needs.
