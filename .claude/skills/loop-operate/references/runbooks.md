# Runbooks — bounded, reversible, executable remediation

**A runbook is an operational artifact that happens to be markdown, not documentation.** That is the whole boundary against `loop-docs`: `loop-docs` writes for a **human reader seeking understanding** (Diátaxis how-to guides, prose, worked context); these steps are **executed**, possibly with nobody watching, and must therefore be deterministic, idempotent, and testable. If a step needs a paragraph of judgement to interpret, it is not yet a runbook step — it is a diagnostic note that belongs in the escalation section.

This file assumes `alerting.md` has produced alerts that link to runbooks, and `observability.md` §5 has confirmed the success checks are queryable. It produces the actions that `../templates/health-response.workflow.js`'s Match and Remediate stages execute, and the eligibility rules that gate them.

## 1. Anatomy — four parts, all required

A runbook with three of these is a wiki page, and a wiki page cannot be executed.

| Part | What it specifies | The bar it must clear |
|---|---|---|
| **Trigger condition** | The precise, machine-evaluable condition this runbook answers — the alert name plus any qualifying labels | Two runbooks must never match the same firing condition. If they do, the Match stage has to guess, and it will guess wrong under load. |
| **Automated action** | The exact command, API call, or sequence — **parameterized, not templated prose** | Deterministic: identical inputs produce identical actions. No "restart the affected pods" without a selector that resolves the same way twice. |
| **Success check** | A query whose result decides whether the action worked, plus the **wait interval** before evaluating it | Must be a query against an already-emitted signal, and must measure the **SLI or burn rate**, not the proxy. Confirming the alert stopped firing is not confirming the breach cleared. |
| **Escalation path** | What happens on failure: which runbook next, or hand off to `loop-incident` with the `on-call-triage.md` payload | Never "escalate to the team." Name the next concrete step, or name the handoff. |

**Two fields that are optional but pay for themselves**: a **blast-radius bound** (this action may affect at most N instances / one region / one shard — the executor refuses beyond it) and a **maximum attempts** count, because a runbook that will retry forever is a runbook that will turn a degradation into an outage.

**A worked shape**, kept deliberately small:

```yaml
id: checkout-availability-pool-exhaustion
trigger:
  alert: CheckoutAvailabilityBurn        # from alerting.md §3
  when:  saturation.db_pool_in_use / saturation.db_pool_size > 0.95
action:
  kind: restart                          # eligibility class — see §3
  target: "deployment/checkout-api"      # the lock key for §4
  command: "kubectl rollout restart deployment/checkout-api -n prod"
  blastRadiusMax: 1                      # one deployment, this cluster
  maxAttempts: 1
successCheck:
  waitSeconds: 300                       # passed to the workflow as args, never computed in-script
  query: 'burn_rate(slo="checkout-availability", window=30m) < 1'
  requires: "burn rate below 1 AND pool utilisation below 0.7"
escalation:
  onFailure: handoff:loop-incident       # with the on-call-triage.md payload
  onIneligible: page                     # rung too low, or class not cleared
reversal:
  how: "rollout undo restores the prior ReplicaSet; no state is mutated"
  tested: "2026-07-14 chaos drill #12"
```

**The `reversal` block is not documentation.** §2 makes it the admission bar, and a runbook whose `reversal.tested` is empty has not earned automation.

## 2. The admission bar: idempotency and reversibility

**If it cannot be cleanly reverted, it is ineligible for automation.** Not "risky" — ineligible, at every rung, regardless of how confident anyone is. This is the same principle `loop-autopilot` applies at its SCALE rung ("if a change cannot be cleanly reverted, it is ineligible by definition — the whole safety model is cheap rollback"), and it holds here for the same reason: the safety model of automated remediation is not that the action is always right, it is that a wrong action costs one revert.

**Two properties, and they are different.**

- **Idempotent** — running it twice produces the same end state as running it once. This matters because the executor *will* run it twice: retries, duplicate webhooks, a concurrent alert on the same target, a resumed workflow. "Scale to 12 replicas" is idempotent; "add 4 replicas" is not, and the difference is a service at 12 versus a service at 20 after a duplicate delivery. **Prefer declarative target states over relative adjustments, always.**
- **Reversible** — there is a known, tested action that returns the system to its prior state, and it costs less than the original action did. A rollout restart is reversible. A cache flush is *technically* reversible only in the sense that the cache refills, which is why its reversibility argument is about *cost* (a thundering herd against the origin), not about state.

**Test both, and record the test.** An untested reversal is an assumption, and the `reversal.tested` field exists so the assumption has a date on it. The chaos-drill oracle in `autonomy-and-rollback.md` §2 is how that date gets refreshed without waiting for a real incident to refresh it for you.

## 3. The rung-gated eligibility table

Which actions may run unattended is a function of **the action class** and **the current autonomy rung**, and never of confidence in the moment. The rungs themselves — OBSERVE, VERIFY, SUSTAIN, SCALE — are defined once in `../../loop-autopilot`; this table only says what each means for a remediation.

| Action class | OBSERVE | VERIFY | SUSTAIN | SCALE | Why |
|---|---|---|---|---|---|
| **Restart** a process/pod/deployment | log + page | pre-approved: run | run, with drift tracking | run | Idempotent, self-reverting, blast radius bounded by the selector |
| **Scale** replicas up (declarative target) | log + page | pre-approved: run | run | run | Idempotent; reverses by setting the prior target. Scaling *down* is a different class — it can shed in-flight work |
| **Failover** to a healthy replica/region | log + page | approval required | pre-approved: run | run | Reversible but expensive to reverse; can cascade if the target is also degraded |
| **Cache clear / flush** | log + page | approval required | pre-approved: run | run | Reversible only in the cost sense; risks a thundering herd. Bound the blast radius hard |
| **Traffic shift / shed load** | log + page | approval required | pre-approved: run | run | Reversible; this is `loop-ship`'s lever being pulled by this skill's signal |
| **Roll back a deploy** | log + page | approval required | approval required | run — **only** under the `autonomy-and-rollback.md` §3 gate | The SCALE mechanism. Invokes the mechanism `loop-ship` authored; never designs one |
| **Schema or data migration** | **never** | **never** | **never** | **never** | Not cleanly reversible. Fails §2 outright |
| **Data mutation / repair** | **never** | **never** | **never** | **never** | Not reversible. The one class where a wrong automated action is unrecoverable |
| **Secret or credential rotation** | **never** | **never** | **never** | **never** | Reversible in principle, catastrophic in the window; needs coordinated distribution |
| **Infrastructure / IaC config change** | **never** | **never** | **never** | **never** | Blast radius unbounded by construction; belongs in a reviewed change, not a remediation |

**The four NEVER rows are a hard list, not a default.** They mirror the shape of `loop-autopilot`'s NEVER-auto-merge list, and they exist for the same reason: the gate cannot be argued down in the moment by a confident agent or a tired human. An action on a NEVER row that genuinely needs to happen becomes a page, and — because a novel condition now requires human coordination — the predicate in `SKILL.md` sends it to `loop-incident`.

**"Pre-approved" means approved in advance, per runbook, in writing, by a named owner** — not approved in the moment by whoever is awake. The approval is a property of the runbook, recorded with the runbook, and it is revoked the same way it was granted.

## 4. Concurrency — an open gap, stated as one

Two remediations must never mutate the same target resource at once. The failure is concrete: a saturation alert triggers a scale-up while an availability alert triggers a rollout restart against the same deployment, and the two interleave into a state neither runbook anticipated — commonly a partially-rolled deployment at an unintended replica count, which then trips a third alert.

The fix is a **per-target lock**: serialize remediations keyed by the `action.target` field, so one target is being acted on by at most one runbook at a time, and a second remediation for the same target either waits or is dropped with a logged reason.

**This is where the honest part goes.** This is the infrastructure analog of AP5 worktree isolation in `loop-autopilot`, and **the analogy does not carry the mechanism with it.** Harness policy H7 covers concurrent *file* mutation with `isolation: 'worktree'`; there is no git worktree to isolate against when the mutated object is a running deployment, and no harness primitive substitutes. `../templates/health-response.workflow.js` implements an in-run lock keyed by target — which is real and worth having, and which **only covers remediations issued by that single workflow run.** It does not and cannot cover:

- a second, concurrent workflow run triggered by a second webhook;
- a human executing the same runbook by hand;
- another automation system (an autoscaler, a Kubernetes operator, a scheduled job) acting on the same target.

**The durable lock has to come from your runbook executor** — a lease in your coordination store, a mutual-exclusion annotation on the resource, or your deployment system's own in-progress guard. This skill states the requirement and provides the in-run half; **the cross-run half is unwired, and deploying above the VERIFY rung without it is deploying a known race.**

## 5. Log every attempted and every skipped action

Harness policy H6 forbids silent caps, and this is the operational form of it. **Every runbook evaluation produces a record**, including the ones where nothing happened:

| Outcome | Log it because… |
|---|---|
| **Executed** | It is the audit trail. `autonomy-and-rollback.md` §4 reconstructs autonomy state from these records |
| **Skipped — no matching runbook** | This is the highest-value signal in the whole file: it names the runbook that should exist. It is also the exact condition that routes to `loop-incident` |
| **Skipped — rung too low** | Distinguishes "we chose not to" from "nothing fired." Without it, a service at OBSERVE looks identical to a healthy one |
| **Skipped — class ineligible (NEVER row)** | Proves the gate held. A NEVER-row skip that is never logged is a gate nobody can audit |
| **Skipped — target locked** | The §4 race, observed. A high rate here means alerts are correlating badly, or the lock is too coarse |
| **Executed, success check failed** | The most important failure record: the action ran and did not work. Drives the runbook-success-rate metric the SUSTAIN rung watches |

A skipped action that leaves no trace reads, later, as a condition that never occurred. That misreading is how a runbook that has silently been failing its eligibility gate for six weeks gets discovered during the incident it was written for.

**Record enough to reconstruct the decision, not just the outcome**: the trigger that matched, the rung at the time, the eligibility verdict and its reason, the action (or the reason for none), the success-check query and its result, and the target lock state. That record is the input to the SUSTAIN rung's runbook-success-rate tracking and to `on-call-triage.md`'s handoff payload — both of which are downstream consumers that cannot ask for information nobody wrote down.
