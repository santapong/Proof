# Coverage planning — why one planner is not enough

A single planner produces a plan that is **coherent and incomplete**, and the two failure modes look identical from the inside:

1. **It framed the problem once.** Every node it emits inherits that framing. If it read the project as a delivery problem, the security work is missing — not disputed, *absent*. Nothing in the plan points at the hole, because the hole is outside the frame that generated the plan.
2. **It forgot a whole phase.** Not because it decided against testing, but because testing never came up. An omission leaves no trace: a plan with no test nodes reads exactly like a plan that deliberately skipped them.

Neither is fixed by a better planner or a longer prompt. A single pass cannot audit its own frame, and it cannot notice what it never considered. So coverage is attacked from three directions at once, each catching what the others structurally cannot.

| Mechanism | The failure it catches | What it cannot catch |
|---|---|---|
| **Diverse planners** | Wrong or narrow framing | A gap all three framings share |
| **Roster sweep** | A whole phase forgotten | Depth *within* a phase that is present but thin |
| **Loop until dry** | The long tail after the obvious | Anything nobody thinks to look for after K quiet rounds |

Use all three. Each is cheap relative to discovering the gap during Construction.

## 1. Diverse planners — three framings, independently

Three planners plan the **same project**, in parallel, with **no knowledge of each other**. Independence is the whole mechanism: a second planner shown the first's output anchors to it and confirms rather than diverges.

| Framing | The question it asks | What it reliably surfaces |
|---|---|---|
| **Risk-first** | What could go wrong, and what must not break? | Security, migration hazards, rollback, blast radius, compliance |
| **User-first** | What outcome does someone actually need, and how will they know they have it? | Acceptance criteria, docs, UX and accessibility, the real definition of done |
| **Delivery-first** | What must ship, in what order, and what blocks what? | Dependencies, sequencing, environments, CI, the critical path |

**Reading the diff is the point, not the plans.** At the reconcile barrier:

- **Found by all three** → high confidence. It is real scope.
- **Found by exactly one** → **the highest-value signal in the whole method.** It is either a genuine insight the other two framings were blind to, or one planner's invention. It must be *adjudicated*, never averaged away. Dropping single-planner items silently discards precisely the coverage the diversity bought.
- **Contradiction** → surface it to the human. Two planners disagreeing about sequencing usually means a real constraint nobody has stated.

This barrier is **earned** under H2: the reconciler needs all three plans at once, because its input is the *differences between them*. No per-item hand-off can express that.

Three is the floor. A fourth framing (cost-first, operations-first) is worth adding when the project has a dominant axis the three above under-weight.

## 2. The roster sweep — force an answer for every skill

Walk **all twenty skills**. For each, record **include** or **exclude**, and a one-line justification.

The exclusions matter more than the inclusions. An unjustified exclusion is exactly the "we forgot testing" gap wearing a checkmark, and the sweep converts a silent omission into a written decision someone can disagree with. Cheap to run, and it catches the single most embarrassing class of planning failure.

```
loop-review     INCLUDE  — auth changes touch session handling
loop-test       INCLUDE  — no coverage on the new path
loop-ship       EXCLUDE  — library change, no deploy surface
loop-operate    EXCLUDE  — nothing runs in production yet
loop-incident   EXCLUDE  — no live service
loop-frontend   EXCLUDE  — API only, no UI in scope
...
```

Two rules that keep it honest:

- **"Probably not needed" is not a justification.** Say *why* the project has no surface for that skill. If you cannot, the answer is include-and-scope-later, not exclude.
- **An include must name its deliverable**, not just the skill. "loop-test INCLUDE" is a gesture; "loop-test INCLUDE — regression test for the session-fixation path" is a node.

## 3. Loop until dry — the tail

After reconcile and sweep, run gap-hunter rounds against the accumulated plan until **K consecutive rounds surface nothing new** (K from the mode: 1 in `lite`, 2 in `balanced`, 3 in `all-out`).

Each round asks a different question, because a repeated question returns a repeated answer:

- What does this plan assume that nobody has verified?
- What breaks if the largest assumption is wrong?
- What does the plan produce that no node consumes? What does a node consume that nothing produces?
- Who is accountable for the parts nobody named?
- What would make this plan look naive in hindsight?

**Dedup against everything seen, not against what survived** (loop policy L3). Deduping against the accepted set makes rejected items reappear every round and the loop never converges — a real failure this plugin has already hit.

## 4. Charter every node — precision is a deliverable

A plan that names *tasks* produces agents that improvise. Every node ships a **charter**, and an agent that cannot restate its charter in one line has not been given one:

| Field | Rule |
|---|---|
| **Objective** | One line naming the **deliverable**, not the activity. "Returns the list of auth call-sites and their guards", not "investigate auth" |
| **Acceptance criterion** | Checkable, in one line. If you cannot write it, the node is underspecified — decompose it or ask |
| **Out of scope** | Explicit. The single highest-leverage field, because it is what stops an agent helpfully expanding into a neighbour's work |
| **Inputs** | What it receives, and from which upstream node |
| **Owning skill** | Which of the twenty, so the agent inherits that skill's standards rather than improvising them |
| **Done means** | What the *next* node needs from this one to start |

The out-of-scope field is worth its own sentence. Agents fail far more often by doing adjacent work badly than by doing their own work badly, and an unbounded objective invites exactly that.

## 5. What this deliberately does not do

**It does not replace the human gate.** The output is a plan for a person to approve, and the reconcile diff is *for them* — single-planner items and contradictions are surfaced, not silently resolved. A method that quietly averaged three plans would hide the very disagreement that makes it worth running three.

**It does not guarantee completeness.** Three framings, twenty roster rows and K quiet rounds substantially reduce the gap surface. They do not eliminate it. Say so in the gate deliverable, and list what the method itself could not check — an unstated residual is worse than a stated one.

**It is not free.** Roughly 3–5× a single-planner phase. That is cheap against discovering during Construction that the plan had no security work in it, and expensive for a two-file change. Match it to the project: for small work, one planner plus the roster sweep catches most of the value.
