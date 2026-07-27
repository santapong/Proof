# Mitigation Playbook — stop the bleeding

How to restore service before you understand why it broke. This file owns the interval between "an incident is declared" (`incident-command.md`) and "the SLI is back inside its objective" (`reproduction-timeline.md`, then the handoff in `SKILL.md` §4).

**Hard constraint, stated before anything else: this playbook uses only levers that are ALREADY IN PLACE.** Revert to a last-known-good artifact that already exists. Flip a feature flag that already exists. Fail over to a standby that already exists. **Designing a new deployment or rollback strategy — blue-green, canary, expand-contract, a new flag system — is `loop-ship`'s work, and it is triggered as a postmortem action item, never performed mid-incident.** Building a mechanism during an outage means debugging a new mechanism during an outage, on top of the failure you already have. If no lever exists, say so, escalate, and record it as the highest-value action item the postmortem will produce.

## 1. Mitigate first — and the one exception

**The principle.** Restore service before diagnosing. Users do not experience your understanding; they experience availability. A correct root cause found in ninety minutes is worth less than an imperfect workaround applied in nine. Root cause is `loop-debug`'s job and this skill hands it the evidence to do it — see `SKILL.md` §4.

This is also the formal boundary: ITIL's incident-versus-problem split (PeopleCert; authoritative, with the Version 5 caveat in `standards.md`) puts *restore service now* and *eliminate the underlying error* in two different practices on purpose. Mitigating first is not a shortcut around diagnosis, it is a different job with a different clock.

**The one exception: when mitigating first is itself unsafe.** Some actions destroy the evidence needed to bound the damage, or widen the loss they were meant to stop. The test is a single question:

> **Could this mitigation destroy state that is needed to determine what was already damaged — or could it cause the damage to spread further than it already has?**

If yes, **stop and bound the damage before restoring service**. The canonical case is **active data corruption**: restarting the writers clears the memory state that would have told you which records were written wrong, and rolling back a schema can make corrupted rows unreadable rather than repairable. Other cases with the same shape:

- A **partial write or dual-write** in flight, where failing over completes the split rather than halting it.
- **Data exfiltration in progress**, where killing the process loses the connection record that identifies what left.
- A **cascading retry storm**, where restarting one service points the full retry volume at whatever is still alive.

In the exception path, the ordering becomes: **isolate (stop new damage) → snapshot (preserve evidence) → then mitigate.** Isolation is not the same as restart — take the component out of rotation, revoke the credential, pause the queue consumer. And say out loud in the channel that you are taking the exception path and why, because it makes the incident visibly longer and the channel deserves to know it is deliberate.

**Everywhere else, the default holds and the burden of proof is on delaying.** "We should understand it first" is the most common way a fifteen-minute incident becomes a two-hour one.

## 2. The pattern catalog

Each entry: what it does, when it is safe, when it is not. Choose the **most reversible** lever that plausibly addresses the symptom, and change **one thing at a time** — two simultaneous mitigations produce an unattributable outcome and a timeline nobody can read.

### Rollback / revert to last-known-good

Return the deployed artifact to the previous known-good version.

- **Safe when** the incident began at or shortly after a deploy, the previous artifact is still available, and the change was backward-compatible in both directions.
- **Not safe when** the deploy included a **forward-only migration** — reverting the code against a migrated schema is a second incident. Not safe when the previous version has a known worse defect, or when enough time has passed that data written by the new version cannot be read by the old one.
- **First choice when applicable.** It is the most reversible lever there is, and deploy correlation is the highest-base-rate cause in the timeline.

### Feature-flag kill switch

Turn off the code path without shipping anything.

- **Safe when** the flag already exists, is genuinely wired around the failing path, and its off-state is exercised — not merely assumed to work.
- **Not safe when** the flag has never been switched off in production, or when partial state was written while it was on and the off-path does not tolerate it.
- **Faster than a rollback and narrower in scope.** Prefer it when both are available and the flag's off-path is trusted.

### Traffic failover

Shift traffic to another region, cluster, replica, or provider.

- **Safe when** the standby is genuinely warm, its capacity has been verified recently, and the failure is **localized** to the primary.
- **Not safe when** the failure is in shared state that both sides use — you will move the incident, not fix it — or when the standby has never taken full production load. **A standby that has never been failed over to is a hypothesis, not a standby.**

### Load shedding

Reject a fraction of requests deliberately to keep the rest healthy.

- **Safe when** the system is saturated rather than broken, and you can shed by a **meaningful priority** — background before interactive, free tier before paid, retries before first attempts.
- **Not safe when** shedding is indiscriminate (you have converted a slow system into a randomly broken one), or when the shed requests silently lose data rather than failing cleanly.
- **Underused.** Degrading deliberately is almost always better than collapsing arbitrarily.

### Circuit breaker

Stop calling a failing dependency and serve a fallback or a fast error.

- **Safe when** a downstream is the confirmed source of the failure and a degraded-but-correct fallback exists.
- **Not safe when** the fallback returns **stale or wrong** data that the caller treats as authoritative — that trades an outage for silent incorrectness, which is worse and much harder to detect.

### Scale-out

Add capacity.

- **Safe when** the metrics show genuine resource exhaustion and the bottleneck actually scales horizontally.
- **Not safe when** the bottleneck is a shared singleton — the database, a lock, a rate-limited third party — where adding instances **increases** pressure on the real constraint. Not safe when the underlying cause is a leak: scaling out buys time proportional to the leak rate and no more, and it must be recorded as a timer, not a fix.

### Restart

Restart the process, pod, or node.

- **Safe when** the failure mode is known to be state-accumulating (leak, wedged connection pool, exhausted file descriptors) and the restart is rolling rather than simultaneous.
- **Not safe when** it discards evidence you have not captured — **take the heap dump, the thread dump, and the current metrics first** — or when the process will simply re-enter the bad state in minutes. A restart that must be repeated is not a mitigation; it is a metronome, and it must be escalated rather than repeated quietly.

### Rate limit

Cap request volume from a source, tenant, or endpoint.

- **Safe when** a specific identifiable source is driving the load and limiting it preserves service for everyone else.
- **Not safe when** the "abusive" source is your own retry logic — limiting the symptom while the retry storm continues just moves the queue — or when the limit is applied so broadly it becomes indiscriminate shedding under another name.

### Database failover

Promote a replica to primary.

- **Safe when** replication lag is small and known, the promotion path has been exercised, and the failure is in the primary instance rather than in the data.
- **Not safe when** lag is unknown (you are choosing an unmeasured amount of data loss), when the corruption is in the *data* and has already replicated, or when applications cache the primary endpoint and will not follow the promotion. **Among the least reversible actions in this catalog — treat it as a late option, not an early one.**

## 3. Verifying the mitigation actually worked

**The bar is user-visible impact, not "something changed."** These are not the same claim and conflating them is how incidents get closed twice.

Verify in this order:

1. **The user-facing SLI recovered** — the metric that represents actual user experience, not a component health check. A green pod is not a served request.
2. **It recovered for the affected population**, not just in aggregate. An aggregate that recovers while one tenant, one region, or one client version stays broken is a partial mitigation being read as a full one. Break the metric down the same way you broke down blast radius in `incident-command.md` §3.
3. **It stayed recovered** across an observation window appropriate to the traffic pattern — at least one full cycle of whatever periodicity the system has. Mitigations that "work" for ninety seconds are common.
4. **Nothing else got worse.** Check the neighbors: latency after a shed, error rate after a failover, queue depth after a rate limit. A mitigation that trades one broken SLI for another has not mitigated anything.
5. **Independent confirmation where it exists** — a support signal, a synthetic probe, a customer report going quiet. Your dashboard is one witness.

**If verification fails, say so and pick a different lever.** Do not stack a second mitigation on top of an unverified first one: from that point on, no outcome in the timeline is attributable to any action, and you have destroyed the evidence `loop-debug` needs.

**The SLI thresholds and error-budget arithmetic you are verifying against are `loop-operate`'s** — this file consumes those definitions, it does not author them.

## 4. Record every action, with a timestamp

Every action goes into the channel **as it happens**, in this shape:

```
HH:MM:SS UTC · <who> · <action taken> · <expected effect> · <observed effect>
```

Both before and after. The *expected* effect recorded beforehand is what makes a surprising outcome legible later — an action whose effect you predicted wrongly is one of the strongest signals in the whole timeline, and it is invisible if you only record what happened.

Include the actions that **did nothing** and the ones you **considered and rejected**, with the reason. A rejected mitigation is a decision, and the postmortem's most useful question is often why the obvious lever was not pulled.

These records feed straight into `reproduction-timeline.md` as a first-class source, alongside logs, traces, and deploy history. Written during the incident they are evidence; reconstructed afterwards they are recollection, and the gap between the two is where postmortems go wrong.

## 5. The explicit non-goal

**A mitigation may be a workaround. It is NEVER `loop-debug` §6's minimal fix.**

The two have different success criteria. A mitigation succeeds when user-visible impact stops — a flag off, a version reverted, a region drained. A fix succeeds when a confirmed root cause can no longer produce the failure, proven by a regression test that failed before it and passes after. Applying a mitigation tells you **nothing** about root cause: reverting a deploy that exposed a latent race stops the bleeding while leaving the race exactly where it was.

Three consequences to hold onto:

- **Do not close the incident because the mitigation held.** De-escalate, then hand off per `SKILL.md` §4. Closing at mitigation is how the same incident happens twice.
- **Label the mitigation as a workaround in the handoff package**, explicitly, so `loop-debug` does not read a reverted deploy as a diagnosis.
- **Every mitigation carries an unwind cost** — a flag left off, a region left drained, capacity left over-provisioned, a replica left promoted. Each one is a **postmortem action item with an owner**, or it becomes permanent by accident and the next incident starts from a configuration nobody chose.
