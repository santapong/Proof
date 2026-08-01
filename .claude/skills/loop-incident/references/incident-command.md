# Incident Command — declaring, roles, and severity

How to turn a page into a coordinated response. This file owns the first ten minutes: the decision to declare, who holds which role, how bad it is, and where the truth lives. It stops where `mitigation-playbook.md` begins.

Everything here assumes the `SKILL.md` predicate already resolved to *this skill*: no runbook exists for the condition, or its impact exceeds the runbook's scope, or a human must be paged and coordinated. If a runbook exists and running it restores the SLI, close this file and go to `loop-operate`.

## 1. Declaring criteria — err toward declaring early

**Declare when any one of these is true.** They are disjunctive on purpose; requiring two is how organizations end up with a forty-minute unmanaged outage.

- A **user-visible** SLI is outside its objective and no runbook restores it.
- An automated remediation ran and **did not** restore the SLI, or ran and made it worse.
- The condition is **novel** — the symptom does not match any known failure mode you can name.
- Impact has **outgrown** the runbook that covers the symptom (the runbook drains one node; six are affected).
- **Data loss, data corruption, or a confidentiality breach** is plausible — declare on plausible, not on confirmed.
- Anyone with the authority to declare **believes it is an incident.** No veto, no committee.

**Declaring early is cheap and un-declaring is free.** The SRE Book's ch. 14 guidance (attributed doctrine, not a specification — see `standards.md`) is that the cost of a declared incident that turns out minor is one channel and a short debrief, while the cost of an undeclared major one is the entire interval in which nobody was coordinating. Downgrade and close in ten minutes without ceremony; there is no penalty for a fast close and there is no prize for hesitating.

**Declaration is an act, not an observation.** Say the words in the channel — *"I am declaring a Sev-2, I am IC"* — with a timestamp. An incident that everyone is working on but nobody declared has no commander, no severity, and no timeline, which is precisely the failure mode declaring exists to prevent.

## 2. The roles

The formal definitions are **ICS under NIMS** (FEMA/DHS, NIMS 3rd edition 2017 doctrine; ICS-100 IS-0100.c, 2025 revision — authoritative). The software specialization is **IMAG**, the Google SRE Book's ch. 14 model (attributed practitioner doctrine). Cite ICS for the structure; cite IMAG for the software-shaped adaptation. Both pins are in `standards.md`.

**The rule that carries the most weight is an ICS rule: the Incident Commander holds every function that has not been explicitly delegated.** There is never an unowned function — only functions the IC has not handed off yet. Delegation is an announcement (*"Priya is Ops Lead"*), not an assumption.

ICS's full Command/Operations/Planning/Logistics/Finance structure is **not** reproduced for a software incident. It collapses to three roles, and this file says so rather than implying the wider structure applies.

### Incident Commander (IC)

Owns the response, not the fix. The IC **decides and delegates**; the moment the IC is typing commands into production, the incident has no commander.

- Holds severity, scope, and the call to escalate, de-escalate, or close.
- Runs the update cadence (§5) and decides what is communicated, though not necessarily by whom.
- Arbitrates between competing mitigations. Two engineers proposing incompatible actions is an IC decision, made out loud, in the channel.
- **Explicitly does not diagnose.** Root cause is not this incident's question — see `SKILL.md` §4.

### Operations Lead (Ops Lead) — delegated first

The only role that **touches production**. Everyone else proposes; Ops Lead executes.

- Applies mitigations from `mitigation-playbook.md`, one at a time, announcing each before and after.
- Reports back a verified user-visible outcome, not "it's deployed" — the mitigation-verification bar is in `mitigation-playbook.md` §3.
- Is the single writer. Concurrent hands in production during an incident is how a one-cause incident becomes a two-cause one, and it destroys the timeline's attributability.

### Communications Lead (Comms Lead) — delegated second

Owns everyone outside the response: customers, support, leadership, and any status page.

- Publishes on the cadence in §5 **whether or not there is news**. "No change, next update in 30 minutes" is a valid and valuable update.
- Translates: internal states ("we're draining the replica") do not go out verbatim; user-visible impact and expected next update do.
- **Absorbs interruptions** so the IC and Ops Lead are not answering the same question from five directions. This is most of the role's value.

**Two anti-patterns to name.** The **IC who is also Ops Lead** is acceptable only at the lowest severity and only briefly; if it persists past the first mitigation attempt, page for the second role. The **silent Comms Lead** is worse than no Comms Lead, because stakeholders assume the channel is covered and stop asking.

## 3. Severity and priority — two axes, one score

Severity gates staffing, communication cadence, and escalation. It is scored on **two independent axes**, and both are needed because one alone mis-scores half of all incidents.

### Axis 1 — technical impact (CVSS band, reused not reforked)

Use the **CVSS v4.0** qualitative bands **exactly as `../../loop-review/references/severity-model.md` defines them** — None / Low / Medium / High / Critical, with that file's numeric mapping and its judgment-not-vector rule. The vector-string grammar, if you need it, is in `../../loop-review/references/standards.md`.

**Do not reproduce or re-derive the band table here.** One severity ladder, one home. `standards.md` records the coupling and the obligation to propagate a future CVSS bump across both skills together.

### Axis 2 — operational blast radius (no CVSS equivalent)

**A production incident frequently has no CWE at all.** A bad deploy, capacity exhaustion, an expired certificate, or an upstream dependency outage is not a vulnerability, and scoring it purely on a vulnerability scale produces a number the channel will argue with. Score blast radius independently:

| Dimension | What to record |
|---|---|
| **Users affected** | Percentage and absolute count. "3% of users" and "3% of users, all of them enterprise tenants" are different incidents. |
| **Functionality lost** | Total outage, degraded (slow but working), or a single feature. |
| **SLA / contractual exposure** | Is a written commitment being breached right now, and is a credit or penalty accruing? |
| **Data** | Loss, corruption, or exposure — any of these is its own escalation regardless of user count. |
| **Revenue / transactions** | Failing payments, dropped orders, unbilled usage. |
| **Reversibility** | Can the damage be undone after mitigation, or is it accumulating permanently? |

### Combining them

**The higher axis wins, and reversibility escalates.** A Critical technical impact confined to an internal admin tool is not a Sev-1; a Medium technical impact silently corrupting customer data is. When the two axes disagree by more than one band, say so out loud in the channel and let the IC set the number — a disagreement between axes is information about the incident, not a scoring error to be smoothed over.

Record **both axes and the resulting severity** in the timeline. A severity with no recorded reasoning cannot be reviewed in the postmortem, which is where the org actually calibrates its ladder.

## 4. Staffing thresholds

Severity decides who is paged. Adapt the ladder to the org's own names — PagerDuty's Incident Response Documentation (current; vendor practitioner material, cite with a retrieval note) has usable templates — but keep the shape: **roles are added as severity rises, never removed to save people.**

| Severity | Roles required | Communication |
|---|---|---|
| **Sev-3 / low** | IC only (may also act as Ops Lead) | Internal channel; no external comms |
| **Sev-2 / medium** | IC **+** Ops Lead | Internal channel + support notified; status page if user-visible |
| **Sev-1 / high** | IC **+** Ops Lead **+** Comms Lead | Status page, support brief, leadership informed on cadence |
| **Sev-0 / critical** | All three **+** named executive stakeholder **+** a scribe if the channel is moving faster than one person can record | Continuous external comms; the IC is doing nothing else |

**A scribe is not optional above the point where the channel outruns memory.** The timeline in `reproduction-timeline.md` is reconstructed from what was recorded; anything not recorded during the incident is reconstructed afterwards from recollection, which is the single largest source of postmortem error.

## 5. Single source of truth, cadence, and handoff

**One channel.** Name it in the declaration. Every decision, every action, every timestamp goes there. Side conversations are fine for thinking; **decisions and actions are not decisions and actions until they are in the channel.** A response spread across three DMs and a video call has no timeline, and the incident's most valuable artifact is destroyed while it is still being written.

**Cadence, set by severity and stated up front.** Sev-0/1: every 15–30 minutes. Sev-2: every 30–60. Sev-3: at state changes. **Publish on the cadence even with nothing to report** — silence is read as either resolution or collapse, and both readings are expensive.

**Shift handoff is an explicit transfer, never a drift.** Long incidents outlast attention; a tired IC makes worse calls than a fresh one. The outgoing IC hands over, in the channel, with an acknowledgement:

1. Current severity, both axes, and what changed it since declaration.
2. Every mitigation attempted, with timestamps and outcomes.
3. What is running right now and what it is expected to do.
4. Open decisions the incoming IC now owns.
5. Who is currently in which role, and who has been awake how long.
6. **An explicit acknowledgement from the incoming IC** — *"I have command as of 03:14 UTC."* Without it, the incident has two ICs or none.

## 6. Re-escalating mid-incident

**Severity is provisional.** It was scored on the symptoms visible in the first minutes, which are systematically the least informative ones. Re-score when:

- The blast radius turns out to be wider than first reported (a second region, a second tenant class).
- The first mitigation fails, or makes it worse — a condition that resists mitigation is a more severe condition.
- Data loss or exposure becomes plausible where it previously was not.
- Duration itself crosses a threshold; a Sev-2 running for four hours is a Sev-1 by accumulated impact, regardless of instantaneous severity.
- A dependent system starts failing — blast radius includes what your failure is doing to others.

**Announce every change with its reason and its timestamp**, and re-check the §4 staffing table immediately: escalating severity without paging the roles that severity requires is a number change, not a response change. **De-escalation follows the same discipline** — announced, timestamped, reasoned. Quietly letting a Sev-1 fade into a Sev-3 leaves a timeline nobody can reconstruct and a postmortem nobody can review.

A severity that never moves during a long incident almost always means nobody re-scored it.

## 7. The anti-pattern catalog — six ways a response defeats itself

These are conduct failures, not knowledge failures — every one is committed by responders who know the rule, because under adrenaline each substitutes something that *feels* like progress for something that is. The two role-shaped anti-patterns are already named in §2 (the IC who is also Ops Lead, the silent Comms Lead) and are not repeated here. These six are priced rather than preached: the rules they violate live where they live — `mitigation-playbook.md` owns mitigate-first, `postmortem.md` owns action-item hygiene — and each entry states only what the violation costs and which discipline replaces it. Enforcement is the IC's, and every entry is stopped by one sentence said out loud in the channel.

| Anti-pattern | Why adrenaline produces it | What it costs | The discipline that replaces it |
|---|---|---|---|
| **Diagnosing before mitigating** | The root cause is the fascinating problem, and investigating is the skill engineers rehearse daily; reaching for a lever without understanding feels like giving up. | Mitigate-first is already this skill's law (`mitigation-playbook.md` §1), so price the violation: every minute spent understanding while an existing lever sits unpulled is user impact purchased voluntarily. The diagnosis keeps — the evidence is being captured for `loop-debug` (`reproduction-timeline.md`) — the users' minutes are not refunded. | The IC asks for mitigation options, not theories, and redirects curiosity to the `SKILL.md` §4 handoff. The one sanctioned delay is `mitigation-playbook.md` §1's exception path, taken out loud with its reason — nothing else qualifies. |
| **The hero debugger** | One person is visibly fastest, and letting them run feels efficient; making them stop to narrate feels like overhead the outage cannot afford. | The response's entire state lives in one head. Nobody can relieve them, a §5 handoff transfers nothing, and when they fatigue the incident restarts from zero — the borrowed efficiency comes due at exactly the moment it cannot be repaid. | The scribe and channel discipline (§4, §5): the fast hands narrate into the channel as they work, and if they cannot narrate and work at once, the IC assigns a scribe. What is not in the channel does not exist, including the hero's model of the failure. |
| **ETA promises in status updates** | "When will it be fixed?" is the question every stakeholder asks, and answering it feels like service; "unknown" feels like an admission of failure. | An ETA is a prediction about a system nobody understands yet — that is what being in an incident *means*. Every missed ETA burns trust, and after the second miss stakeholders route around the Comms Lead to the IC directly, re-creating the interruption load the role exists to absorb (§2). | Updates state what is known, what is being done, and when the next update comes (§5's cadence) — never when it will be fixed. "Next update at HH:MM" is a promise the responder controls; "fixed by HH:MM" is a promise the failure controls. |
| **Root-cause-singular thinking** | A satisfying explanation discharges the channel's tension, and the grammar of "the root cause" implies exactly one exists — so the search stops at the first answer that fits. | Investigation ends at the first satisfying story while the contributing factors that made the failure possible, long, and undetected survive unexamined. Worse, a cause named in the channel becomes the accepted account the moment it is said — the same capture `postmortem.md` §3 guards its root-cause section against. | Say "a contributing factor," never "the root cause," in the channel. Naming the causal chain is `loop-debug`'s verdict; the postmortem sweeps breadth before depth (`postmortem.md` §4) and expects the account in which each action was reasonable given what was visible (`postmortem.md` §1) — which is where the systemic cause hides. |
| **Thrash-switching** | Watching an observation window feels like inaction; under adrenaline a new action reads as progress and waiting reads as stalling. | No mitigation gets long enough to work, and the outcome becomes unattributable: overlapping half-mitigations produce a recovery — or a worsening — that belongs to none of them, destroying exactly the attributability `mitigation-playbook.md` §§2–3 exist to protect and handing `loop-debug` a timeline it cannot read. | Timebox and commit: before the lever is pulled, state in the channel how long it needs to show effect (the `mitigation-playbook.md` §3 observation window), then hold until the box expires or the metric moves. Abandoning a mitigation early is an IC decision, announced with a reason — never a drift. |
| **The postmortem action-item graveyard** | By postmortem time the adrenaline is spent, filing items feels like completion, and attaching names feels like the blame the document just forswore. | An unowned action item is a wish, and counting wishes is theater. The failure mode recurs, the recurrence check finds the prior item unclosed, and the organization discovers it has been paying for postmortems and receiving archaeology. | Every item carries `postmortem.md` §5's four attributes — owner, due date, verifiable completion criterion, priority — filed where work is actually scheduled, and looked up again by §6's recurrence check. Blameless relocates accountability onto item owners (`postmortem.md` §1); it never abolishes it. |

The six share one shape: each swaps an external record for an internal state — understanding for mitigation, one head for a channel, reassurance for cadence, narrative closure for breadth, motion for measurement, relief for ownership. That is why the fix in every row is the same mechanism wearing different clothes: **say it in the channel, with a timestamp.** A discipline that must survive adrenaline cannot live in anyone's head, because heads are what adrenaline degrades first; §5's single source of truth is not bookkeeping, it is the only place a discipline can stand while its holder is impaired.
