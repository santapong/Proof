# The Blameless Postmortem / Correction of Error

The deliverable this skill alone produces. `loop-operate` runs steady state, `loop-debug` finds root causes, `loop-ship` changes how things deploy — **only this skill writes the postmortem**, and it writes one for every declared incident.

The structure below is Amazon's **Correction of Error (CoE)** shape (unversioned vendor practice — see `standards.md`); the culture rules are the Google SRE Book's ch. 15 (attributed practitioner doctrine, not a specification). Both are pinned with their authority grades in `standards.md`; cite them accordingly.

**A postmortem is written to change the system, not to record the event.** An incident record that produces no closed action item is an expensive piece of archaeology. Every section below exists to make one specific action item more likely to be right.

## 1. Blameless language, and why it is a mechanism

**Blameless does not mean consequence-free or vague. It means the analysis targets the system, not the person.**

The rationale is mechanical, not moral. The only complete account of what happened is held by the people who were in it. If contributing to that account can be used against them, the account gets sanitized — not by dishonesty, but by ordinary self-protection: hedged wording, actions omitted, the confusing forty minutes compressed into a sentence. **A blameless postmortem is how you keep the timeline true.** An organization that assigns fault gets worse incident data forever, and it does not find out.

Rules that make it concrete:

- **Replace the actor with the affordance.** Not *"Dana deployed without running the canary."* Instead: *"the deploy pipeline allowed a production release with no canary stage; the operator had no signal that one was expected."* Same event, and the second version has an action item in it.
- **Ban counterfactuals about people.** *"Should have noticed"*, *"failed to check"*, *"was careless"* describe an outcome that was obvious afterwards and invisible at the time. Hindsight bias is not analysis.
- **Prefer the passive or the systemic voice for actions, and the active voice for facts.** *"The flag was toggled at 14:02"* is the entry. Who toggled it belongs in the record for correlation, never in the causal narrative as an explanation.
- **Treat every human action as reasonable given what was visible then.** If an action looks obviously wrong in retrospect, the finding is that the system made the wrong action look right — that is the systemic cause, and it is where the fix goes.
- **"Human error" is never a contributing factor.** It is a prompt to keep asking. §4's forced 5-whys exists exactly to convert it into something actionable.

Blameless language does not preclude accountability. It relocates it: **the org is accountable for the system, and named owners are accountable for the action items** (§5).

## 2. Structure

Nine sections. Fill them in this order; the earlier ones constrain the later ones.

1. **Summary** — three or four sentences. What broke, who was affected, how long, how it was mitigated. Assume most readers stop here, and write it so that stopping here is still informative.
2. **Impact** — quantified, from `incident-command.md` §3's blast-radius axis. Users affected (percent and count), functionality lost, duration, SLA exposure, data loss or exposure, revenue or transactions. **Numbers, not adjectives.** "Significant customer impact" cannot be compared against another incident; "4.2% of API requests failed for 63 minutes" can.
3. **Timeline** — the merged artifact from `reproduction-timeline.md`, with its derived intervals: **time to detect**, **time to declare**, **time to mitigate**, **time to recover**. Those four intervals are usually where the improvement is, and they are why the timeline is worth building.
4. **Root cause** — **a pointer. See §3.**
5. **Contributing factors** — §4.
6. **What went well** — genuinely, not as a courtesy. Which alert fired correctly, which runbook worked, which rollback was clean. **Practices that are not named erode**, because nobody knows they are load-bearing.
7. **What went poorly** — where time was lost: detection gaps, missing telemetry, an ambiguous ownership boundary, a runbook that was stale, a dashboard that lied.
8. **Action items** — §5.
9. **Recurrence check** — §6.

## 3. The root-cause section is a POINTER

Write, literally:

> **Root cause:** see `loop-debug` diagnosis, attached once complete. *(Status: in progress / linked / not yet started.)*

**This is deliberate and it is not a gap.** Naming the root cause is `loop-debug` §5's job, and it happens on a slower clock than the postmortem: a real diagnosis can take days, while the postmortem's value decays within them. Memory fades, participants move on, and the same failure recurs while a document waits on an investigation.

So the postmortem is **drafted and reviewed without blocking on the debug session finishing**. Impact, timeline, contributing factors, what went well and poorly, and most action items are all knowable from the incident itself. The root-cause section is filled in later, from `loop-debug`'s output, and the document is re-circulated when it lands.

Two rules protect this:

- **Do not fill the pointer in with a guess.** A plausible cause written into the root-cause section becomes the accepted explanation the moment the document is shared, and it will not be revisited when the real diagnosis arrives. **A suspected fault region — which `reproduction-timeline.md` §6 permits — belongs in contributing factors, clearly labelled as suspected, never here.**
- **Do not close the postmortem with the pointer unresolved.** Draft and review without it; **final** requires it. An indefinitely open pointer means the diagnosis was never done, which is itself the finding, and it is an action item with an owner.

## 4. Contributing factors — breadth first, then depth

**Incidents are rarely mono-causal.** A single 5-whys chain assumes exactly one linear cause and commits to it at the first "why", which is where confirmation bias enters. So: **breadth first, depth second.**

**Breadth — sweep the categories.** Use fishbone-style spines as a coverage check (the same discipline `../../loop-debug/references/standards.md` applies to bug classes, applied here at system scale). For each spine, ask what contributed *at all*:

| Spine | Ask |
|---|---|
| **Code / change** | What was deployed, reverted, or toggled in the window? |
| **Configuration** | What config, flag, limit, or quota was different from what anyone believed? |
| **Data** | Volume, shape, cardinality, or a poison record outside expectations? |
| **Dependencies** | Upstream degradation, version drift, contract change, an expired credential or certificate? |
| **Capacity** | Saturation, a leak, an unexpected traffic pattern, an unscaled singleton? |
| **Observability** | Why did detection take as long as it did? What was not measured? |
| **Process** | Was there a runbook? Was it findable, current, correct? Was ownership clear? |
| **Coordination** | Where did the response lose time to unclear roles, missing context, or a slow escalation? |

**A factor that made the incident longer is a contributing factor**, not a separate concern. Slow detection and slow mitigation are causes of impact, and they are frequently the cheapest things to fix.

**Depth — the forced 5-whys, with a hard termination rule.** Once the breadth sweep is done, drill the two or three factors that carry the most impact:

> **The chain MUST terminate at a systemic, process, or infrastructure cause. It must NEVER terminate at "someone made a mistake."**

If a chain reaches a human action, that is not the bottom — it is the signal to keep going: *why did the system permit it? why was the mistake easy to make and hard to notice? why was there no guard?* Worked shape:

1. The API returned 5xx for 63 minutes. **Why?** A schema migration removed a column still read by the previous version.
2. **Why was it removed while still in use?** The migration and the code change shipped in one deploy.
3. **Why did that pass review?** Nothing in the pipeline detects a destructive migration coupled to a code change.
4. **Why is there no check?** Expand-contract is documented convention but is not enforced anywhere.
5. **Why is convention unenforced?** No pipeline stage inspects migrations for destructive operations against the currently deployed version.

**Terminating at step 5 gives you a buildable action item.** Terminating at step 2 with "the engineer combined them" gives you nothing, and it costs you the next person's honesty.

**Note the "five" is a rule of thumb, not a quota** — stop when you reach a cause the organization can act on, and keep going past five if you have not.

## 5. Action items

An action item that is not tracked did not happen. Each one carries **all four** of:

- **Owner** — one named person. Not a team; teams do not get paged by a due date.
- **Due date** — a real one. "Next quarter" is a decline written politely.
- **Verifiable completion criterion** — how a third party confirms it is done. *"Pipeline rejects a destructive migration when the previous version is still deployed; verified by a test PR"*, not *"improve migration safety."*
- **Priority tied to impact** — items that prevent recurrence outrank items that shorten the next occurrence, which outrank items that improve the write-up.

**Track to closure in the same system as normal engineering work.** A backlog only postmortems can see is a backlog nothing gets scheduled from. **Reference each item by id from the postmortem** so §6's recurrence check can actually look them up.

**Most action items hand work OUT of this skill.** That is expected and it is the boundary working:

| Item shape | Goes to |
|---|---|
| New alert, new burn-rate threshold, new or corrected runbook, an SLO that was wrong | **`loop-operate`** |
| A canary stage, a staged rollout, an automated rollback gate, expand-contract migration discipline | **`loop-ship`** |
| A code-level security audit of the implicated path | **`loop-review`** |
| A regression test locking in the failure mode | **`loop-test`**, normally reached through `loop-debug` §6 |
| Missing instrumentation, absent correlation ids, unretained flag history (`reproduction-timeline.md` §7's gaps) | **`loop-operate`** |
| Architectural change — a boundary, a dependency, a failure-isolation domain | **`loop-design`** |

**This skill performs none of them.** It names the item, assigns the owner, and routes it. An incident-response skill that starts writing alert rules has merged itself into `loop-operate`, which is exactly the failure the two skills are separated to prevent.

## 6. The recurrence check

The highest-yield section, and the most frequently skipped.

**Ask: has this failure mode happened before?** Search prior postmortems by symptom, by component, and by contributing-factor category — not by title, which is written after the fact and rarely matches.

**If it has, the postmortem's primary finding changes.** The interesting question is no longer *what broke* but **why the previous action item did not prevent it**. Answer honestly against these:

- **Was it completed?** If not — why did it slip, and what makes this time different? Re-filing the same item with a new date is not an answer.
- **Was it completed but ineffective?** The fix addressed a symptom, or a narrower case than the real class. That is a design finding, and it outranks everything else in this document.
- **Was it effective but eroded?** Correct when built, then bypassed, disabled during a later incident and never re-enabled, or silently broken by a refactor. **This is common and it is invisible without this check.** The action item is a durability mechanism — a test, a monitor, a pipeline gate — not a repeat of the original fix.
- **Was it filed against the wrong scope?** Fixed in one service while the same pattern exists in six.

**Record the answer even when there is no recurrence.** *"No prior incident with this failure mode; searched by symptom, component, and category"* is a real finding: it tells the next reader the check was run rather than skipped, and it is the only way the check stays trustworthy.

## 7. The review gate

**A human reviews and approves before the postmortem is final.** This is a gate, not a formality, and it is the point at which the document stops being one person's account.

The review checks:

1. **Facts against the timeline** — every claim traceable to a `reproduction-timeline.md` entry. Anything not in the timeline is recollection and must be marked as such.
2. **Blameless language** — §1's rules applied, especially counterfactuals about people, which slip in most often through the "what went poorly" section.
3. **The forced 5-whys terminated systemically** — no chain ending at a person.
4. **Every action item has all four attributes** from §5, and is filed where work is actually scheduled.
5. **The root-cause pointer is honest** — unresolved and marked, or resolved and attached. Not quietly filled in with a hypothesis.
6. **Participants had a chance to correct the record**, particularly anyone whose actions appear in the timeline.

**Include the incident participants and at least one person who was not in the response.** Participants supply accuracy; the outsider supplies the reading everyone else will have — and catches the assumed context that makes an incident record useless to the person who needs it in eighteen months.

**Publish it where people will find it**, and treat the recurrence check in §6 as the reason: a postmortem nobody can search is a postmortem that will be written again.
