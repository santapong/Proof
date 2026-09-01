---
name: loop-guide
description: "Route a request to the right Proof skill when the developer does not know which one fits: a short discriminating interview, classification on the boundary audit's checkable questions, a routing verdict naming the skill or the ordered chain — each pick justified by the one-line answer that selected it — then delegated invocation with managed handoffs. Use when the user asks which skill to use, describes a situation without naming a deliverable, wants Proof to decide and drive, or arrives at the plugin's front door with 'help me with this'. This skill does no domain work; its deliverable is the verdict and the dispatch. For planning an already-named multi-phase job into a task DAG with model routing, use loop-orchestrate. For conducting a whole project brief to a shipped v1, use loop-build. For a capability no existing skill covers, use loop-skill."
argument-hint: <describe your situation in your own words>
---

# Guide — the front door

**If the user can already name the deliverable, this skill is the wrong stop — route them straight to the skill that owns it.** Guide exists for the other case: a situation described in the user's own words, no skill named, the deliverable unclear. Its whole job is to convert that description into a justified routing verdict and then drive the dispatch. It never does the routed skill's work itself — the moment guide starts debugging, designing, or documenting, it has become trap #1 in `references/guide-traps.md`.

**The routing instrument is `../../../docs/design/boundary-audit.json`, and it is normative.** Guide *reads* it; it never restates its questions or scopes in prose here — two copies of the instrument would drift, and the audit is the one that outranks. (Installed standalone without the repo? Fall back to the sibling skills' `description` fields, which carry the same boundaries by construction.)

**No `--mode` and no workflow template.** Interviewing needs a human in the loop, and the workflow sandbox has none — the same reason `loop-harness` ships no template. Execution scale belongs to the *routed* skill; pass any `--mode` the user gave through to it untouched.

## 1. Listen before asking

Read what the user actually provided. Most requests already contain the discriminating facts, and an interview that asks for what was already said is trap #2. Extract, if present: what artifact exists (an idea, code, a diff, an outage, docs, a question), what they want at the end, and whether the thing runs.

## 2. Interview — minimum discriminating questions

`references/interview.md`. Ask **only** the questions whose answers actually change the route — usually one to three, drawn from the audit's checkable questions, phrased in the user's terms rather than skill names. Every question must eliminate at least one candidate skill; a question that eliminates nothing is not asked. Stop the moment one candidate remains per step of the work.

## 3. Classify and decide

Match the interview's facts against the audit's matrix and overlap resolutions. Three verdict shapes:

| Verdict | When | Form |
|---|---|---|
| **Single skill** | One deliverable, one owner | The skill, its invocation with arguments filled in, and the checkable answer that selected it |
| **Ordered chain** | 2–4 deliverables with genuine handoffs (e.g. comprehend → design → pattern) | Each hop justified separately; each handoff named — what artifact crosses, per the audit's boundary |
| **Escalate** | The chain is really a project (≥ roughly 5 hops, or the user wants v1 conducted) → `loop-build`; a named multi-phase job needing a task DAG → `loop-orchestrate`; a capability nothing covers → `loop-skill` | The escalation *is* the verdict — guide never conducts a project itself (trap #4) |

**Every pick carries its because-line** — the one-sentence checkable answer that selected it ("the service is currently down with users affected → `loop-incident`"). The because-line is what lets the user refute a misroute before any work runs (trap #6), and it is this skill's non-negotiable.

## 4. Confirm, then dispatch

State the verdict and the because-lines to the user in plain words. On a chain or an escalation, get one confirmation; on an unambiguous single skill, dispatch directly. Then invoke the skill(s) per `references/dispatch.md`: arguments filled from the interview so the routed skill does not re-ask, flags passed through verbatim.

## 5. Manage the handoffs

On a chain, guide stays the conductor between hops, not during them: when a hop completes, check its output against what the next hop expects, re-validate that the next hop still applies (a comprehension pass that uncovered an outage re-routes to `loop-incident` — the route is a hypothesis, not a contract), and carry the artifact across. Close with a one-paragraph routing note: what was asked, what was routed where, and each because-line — the record that makes a misroute diagnosable afterward.

## Reference files

- `references/interview.md` — extracting facts from the request, the minimum-questions discipline, phrasing checkable questions in user terms
- `references/dispatch.md` — verdict shapes, filling the routed skill's arguments, chain conduction, re-validation between hops, the routing note
- `references/guide-traps.md` — the failure catalogue: how routing work goes wrong while looking helpful
- `references/standards.md` — the pinned authorities, graded, with the confirmation log
