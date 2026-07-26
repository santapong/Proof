# Autonomy and rollback — how this skill actually runs, and how far it may go

**On the name.** This file is deliberately *not* called `deployment.md`. Two files with that name already exist in this plugin and they mean different things — `../../loop-design/references/deployment.md` is the design-time delivery-shape stub, and `../../loop-autopilot/references/deployment.md` covers deploying *the loop itself* plus the autonomy ladder §2 borrows. Meanwhile `../../loop-ship` owns actual deployment mechanics across seven references, **none of them named `deployment.md`**. A third `deployment.md` meaning "the ops autonomy dial" would be the most confusing name available, and the naming symmetry is not worth it.

Read this last. It assumes `slo-model.md` has produced a burn rate, `alerting.md` has produced alerts, `runbooks.md` has produced eligible actions, and `on-call-triage.md` has produced a routing decision. This file says **what triggers a run**, **how much the run may do**, and **what has to be true before it may roll back a deploy without asking.**

## 1. Event-driven, not polling — and the wiring gap

**The trigger for a self-healing action is an external monitoring system's alert webhook.** Your alertmanager, Datadog monitor, CloudWatch alarm, Grafana alert rule, or PagerDuty event rule fires; that webhook invokes a runner; the runner starts a workflow with the firing signals and the current time as arguments. Claude does not poll metrics on a schedule, and any design in which it does is wrong at the level of the trigger, not at the level of the thresholds.

**Why a Cloud Routine cannot be the trigger.** Routines have a **1-hour minimum interval** (`../../loop-autopilot/references/deployment.md`). An SLO whose fast-burn page fires at a 5-minute window is asking for a sub-minute response; an hour of scheduling granularity means the condition is either long over or long past mattering by the time the run starts. Worse, a scheduled poll that finds nothing burns a run against your daily cap for no signal at all. **A Routine alone is not sufficient and this file will not pretend otherwise.**

**What a Routine *is* good for**, and should be used for: the slow, non-urgent passes where an hour of latency is irrelevant. Alert-quality review (§2 SUSTAIN), runbook-success-rate drift, the periodic chaos drill, and the weekly audit-trail digest are all legitimate Routines.

**The correct shape, and the honest gap:**

| Piece | What it is | Who supplies it |
|---|---|---|
| Alert evaluation and firing | Your monitoring backend evaluating the `alerting.md` §4 rules | **You.** This skill designs the rules; it does not evaluate them |
| Webhook delivery | The monitoring system's outbound notification to an HTTP endpoint | **You.** Standard in every backend named above |
| The runner | A webhook-triggered GitHub Action, or a headless `claude -p` invocation behind a small receiver | **You.** This is the gap |
| Argument marshalling | Passing `nowMs`/`nowIso`, the firing signals, the current rung, and the execution mode into the workflow | **You**, in the runner |
| The workflow | `../templates/health-response.workflow.js` | This skill |

**Rows three and four are a documented wiring gap, not a solved problem.** This skill cannot provide them: they live in your monitoring stack and your CI/runner, and the shape differs enough between a GitHub Action, a Lambda, and a self-hosted receiver that a template would be a guess. State the gap when you hand this skill's output to an operator. `../../loop-harness/references/automation-loops.md` catalogues the runner mechanisms and is the right next read for wiring one — that skill configures **what Claude may do**; this one configures **what the service does when unhealthy**, and the composition is deliberate.

**One consequence worth stating up front:** because the run is triggered by an external event, **the workflow can never read the clock** (harness policy H10 forbids it anyway). `nowMs` and `nowIso` arrive via `args` from the invocation, exactly as `../../loop-autopilot/templates/credit-ledger.workflow.js` already does. Bake windows and wait intervals are computed from passed-in values or evaluated by the agent against the monitoring backend — never derived in-script.

## 2. The rung mapping for operations

**The ladder has one definitional home: `../../loop-autopilot/references/deployment.md` § "The autonomy ladder".** OBSERVE → VERIFY → SUSTAIN → SCALE, the rung definitions, and the degradation guarantee that any alarm drops the loop one rung with a safe floor are defined there and are not restated here — read that section first. This section says only what each rung *means when the object is a live service instead of a repository*.

**OBSERVE — the alert fires, a human reads it and acts.**
The loop computes: burn rate, severity, blast radius, which runbook *would* match, and whether it *would* be eligible. It executes nothing. The output is a page with a recommendation attached, which is already worth more than a bare alert because the responder starts from a named action rather than a dashboard. This is the correct rung for any service that fails `observability.md` §5, for any service in its first weeks of operation, and for any service where the runbooks have never been drilled.

**VERIFY — the runbook executes on an approval path; a human approves the risky ones.**
Pre-approved classes (`runbooks.md` §3) run unattended; everything else opens an approval and stops. This is the rung most services should live at indefinitely, and it is where the value is: restart and scale actions that a human would have taken anyway, taken in seconds instead of in the time it takes to wake someone up, with everything else still gated.

**SUSTAIN — the loop detects its own degradation.**
This rung is not about acting more; it is about noticing that the machinery has gone quietly wrong. Two drift signals matter:

- **Alert quality drift** — the fraction of pages whose only response was "acknowledge and close," trending over time. Rising means `alerting.md` §5's bar has eroded and pages are being ignored, which invalidates every rung above OBSERVE.
- **Runbook success-rate drift** — per runbook kind, the fraction of executions whose success check actually cleared the breach (`runbooks.md` §5's records). A falling rate means the runbook no longer matches the system it was written for. **Track it per kind**, never in aggregate; one degraded runbook averaged against nine healthy ones is invisible.

**Reuse `loop-autopilot`'s machinery rather than authoring a duplicate.** The structure of "measure the loop's verdict against ground truth the loop cannot see, alarm on a *rising* divergence rather than a fixed threshold" is exactly `../../loop-autopilot/references/held-out-eval.md`, and the structural-guard discipline is `../../loop-autopilot/references/verifier-integrity.md`. What changes is the oracle: there is no frozen task suite for a live service, so the oracle is a **periodic chaos drill** — deliberately inject a condition whose correct remediation is known in advance, in a controlled window, and measure whether the loop matched the right runbook, executed it, and whether the success check agreed with the known ground truth.

The drill's framing comes from the **Principles of Chaos Engineering**: define a **steady-state hypothesis** in terms of the SLI (not internal attributes), introduce a real-world event, and look for a difference between the control and the experimental group. That is precisely the ground truth this rung lacks and cannot otherwise obtain, and it is the only mechanism in this file that produces a measured — rather than assumed — runbook trust number. Run drills in a staging environment first; run them in production only with an abort path, a bounded blast radius, and a human watching.

**SCALE — autonomous rollback. Off by default.** §3.

## 3. SLO-gated automatic rollback (SCALE)

The one action at the top of this ladder: a deploy has landed, the SLI degrades, and the loop reverts it **without a human**. It is off unless every §4 precondition holds, and it is the operational twin of `loop-autopilot`'s canary-merge — same control flow, different object.

**This skill invokes the mechanism; it does not design one.** `../../loop-ship/references/rollback-playbook.md` designs the rollback and proves it works with a recorded drill, and `../../loop-ship/references/release-gates.md` §4 owns the ramp schedule and abort thresholds while a rollout is in flight. This skill owns the **wire from burn rate to the button** and the **autonomy level at which the button may be pressed without asking**. If no tested rollback mechanism exists, SCALE is not available — not "risky," unavailable, because there is nothing to trigger.

**Control flow**, modeled directly on `../../loop-autopilot/templates/canary-merge.workflow.js`:

```
read autonomy state  →  deploy marker  →  burn-rate query  →  bake window
                                                                  │
                                            healthy through window│
                                                                  ├─→ promote, append to audit trail
                                            breach ───────────────┴─→ auto-revert → page → append → check tripwire
```

1. **Read the autonomy state** from the pinned audit issue (§4). Mode off, tripped, or this service not in the enabled set → do nothing but page. This is checked *first*, every time, and re-checked immediately before the revert.
2. **Deploy marker.** A revert is only meaningful against a known change. The marker — deploy id, timestamp, and the revert command `loop-ship` recorded — arrives via `args`; without one, there is no SCALE decision to make, only a normal remediation.
3. **Burn-rate query** against the SLI the deploy's journey is measured by, on both windows of the relevant `alerting.md` §4 row. **Both must agree**, exactly as in steady-state alerting, and the minimum-sample rule applies: a burn rate computed on a handful of post-deploy requests is noise, and reverting on noise is a self-inflicted outage.
4. **Bake window.** A fixed interval, **passed in via `args`**, during which the query is re-evaluated. Healthy throughout → promote. Breach at any evaluation → revert.
5. **Promote or auto-revert.** Reverting invokes `loop-ship`'s recorded rollback command. It is not a failure of SCALE — **a revert is SCALE working**; the asymmetry that justifies the whole design is that a revert is cheap and near-instant while a bad deploy left live is not.
6. **Tripwire.** Three operational alarms arm it: rollback rate over a window above threshold, a SUSTAIN drift alarm (§2), or any runbook-success-rate collapse. What each one *does* is the degradation guarantee, unmodified, from `../../loop-autopilot/references/deployment.md` § "The autonomy ladder" — naming this skill's triggers is the only part specific to operations.

**Never auto-revert into an untested rollback.** `loop-ship`'s release gates state this for canary aborts and it holds identically here: if the revert path has no current drill record, or the revert is itself risky (mid-migration, dual-write in flight, a rollback that would strand data), **page instead of reverting**. Turning one failure into two is the specific harm.

## 4. Preconditions checklist

Enable SCALE only while **every** box holds, and keep checking — these are sustained conditions, not a one-time gate. This mirrors `loop-autopilot`'s SCALE checklist deliberately; where a row differs it is because the object is a service rather than a repository.

- [ ] **The chaos-drill oracle is green and flat** over several consecutive drills — the loop matched the right runbook and its success checks agreed with known ground truth, and the agreement rate is not falling (§2).
- [ ] **Runbook trust is above threshold, per kind.** A kind whose measured success rate has not cleared the bar over a meaningful sample stays at VERIFY. Never blanket-enable; SCALE is granted per action class and per service, exactly as `loop-autopilot` grants it per proposal kind.
- [ ] **Rollback is verified to actually work** — a recorded, dated drill per `../../loop-ship/references/rollback-playbook.md` §2, not an assumption that the command exists.
- [ ] **A pinned autonomy-state audit issue exists** (`🔒 Autonomy State (automated, do not edit)`) holding current rung, enabled services and action classes, trip history, and an appended record of **every** automated action and every rollback. Reusing `loop-autopilot`'s SCALE audit-trail pattern is deliberate: one shape of autonomy record across both skills is worth more than two bespoke ones.
- [ ] **`observability.md` §5 passes in full.** Unattended action on an un-instrumented service is not autonomy, it is an unobserved actuator.
- [ ] **The error budget is healthy.** A service already at 0% budget does not get more autonomy; the error-budget policy in `slo-model.md` §4 is in force and a freeze is not the moment to widen the blast radius of automation.
- [ ] **A named human owns re-enabling** after any trip, and the trip history is reviewed rather than merely recorded.
- [ ] **The §1 concurrency gap is closed** by a real cross-run lock in your executor — not only the in-run lock the workflow provides (`runbooks.md` §4).

If you cannot stand up all of them, stay at VERIFY. VERIFY is safe, useful, and where nearly every deployment should live.

## 5. Honest status — what is still unsolved

**These are gated scaffolds, not proven recipes.** Without a live service and a real monitoring backend, nothing in this file has been measured against ground truth. Every threshold here — bake duration, burn-rate trip points, rollback-rate tripwire, runbook trust bar — is a default derived from published practice and must be re-derived from your own service's history before it is trusted unattended. Run in dry mode against a real alert stream first, compare what the loop *would* have done against what the on-call actually did, and only then let it act.

**And the borrowed mechanism does not arrive settled.** `../../loop-autopilot/references/deployment.md`'s own "Honest status" section admits two genuinely open problems in canary-merge: choosing bake time and health thresholds **without a ground-truth oracle** for "did this regress in a way the gate missed," and preventing a loop from learning to produce changes that *look* canary-healthy while being subtly wrong. Both are **equally unsolved for live-traffic rollback**, and reusing the control flow does not import a solution that does not exist:

- **The oracle problem is, if anything, harder here.** For a code merge, the held-out suite is a real if imperfect external measurement. For a live service, the only external measurement is a chaos drill, which tests the conditions you thought to inject — and the regressions that matter most are the ones nobody thought to inject. A burn rate that stays flat during the bake window is evidence, not proof, and a change that degrades a slice too narrow to move the aggregate SLI will bake clean and ship (`alerting.md` §4's stated trap).
- **The bake-window choice has no principled answer.** Too short and slow-manifesting regressions promote; too long and the rollback that was supposed to be cheap has already cost you the outage. The honest position is that this is tuned empirically per service, from your own history of how quickly your regressions have historically shown up, and that a copied default is a starting point for that tuning rather than a substitute for it.

**What makes it defensible anyway** is the degradation guarantee, applied unchanged from its definitional home (`../../loop-autopilot/references/deployment.md` § "The autonomy ladder") rather than re-derived here. The operational consequence, and the only part specific to this skill, is where the record lands: **every trip and every automated action is appended to the pinned autonomy-state issue (§4), which is a place a human is expected to read.** That is not a claim that the automation is right. It is a claim that being wrong is cheap and visible — and the visibility half is this file's obligation, not `loop-autopilot`'s.
