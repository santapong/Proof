# Rollback playbook — deciding, drilling, and recording the way back

Two things live here and nothing else: **the decision** (revert or fix forward) and **the discipline** (has this rollback actually been exercised, and when). How each strategy's rollback mechanically works — a second rolling pass, a router flip back to blue, a traffic slice returned to zero — is in `rollout-strategies.md` and is not repeated. If you are reading this to find out *how* blue-green rolls back, you are in the wrong file.

The one sentence that governs everything below: **an untested rollback is not a rollback, it is a hope, and it fails dimension 4 of the pre-deploy checklist.**

**Mechanism here, trigger elsewhere.** This skill *authors* the way back and proves by drill that it works — the button. What presses that button **unattended** — the burn-rate signal wired to it, and the autonomy rung at which it is allowed to fire without a human — is `../../loop-operate/references/autonomy-and-rollback.md`; the SLI those abort criteria are evaluated against is `../../loop-operate/references/slo-model.md`. The temporal seam is the bake: from deploy start until bake completes the rollout is this skill's, and after bake the running service is `loop-operate`'s. Two consequences follow — an automated trigger may only fire into a revert this file records a current drill for, and a drill record with no owning signal is a manual rollback, which is a legitimate answer that must be stated rather than assumed. A design-time RTO/RPO target that *depends* on this drill is set in `../../loop-design/references/nfr.md`.

## 1. Decision factors

Four factors decide it. Work them in this order — the first one that answers stops the analysis.

**Irreversibility already committed.** Has this release already mutated data in a way a revert cannot undo? Destructive DDL, a backfill that overwrote rather than added, a message published to a topic other systems have already consumed, an email sent, a payment captured. If yes, **reverting the code does not revert the effect** — you are choosing between two forward paths, and the question becomes which forward path is smaller. Reverting code while leaving mutated data in place is the worst of both: old code meets new data, and now you have two problems.

**Expand-contract stage.** Locate the release on the sequence in `migrations.md`. Before the contract step, revert freely — that is what the sequence was built for. **After a contract step you cannot roll back past it**: the old shape is gone and the previous build reads a column that no longer exists. A rollback target that predates the contract deploy is not a rollback target, it is an outage. Know which side of the line you are on *before* the incident, because working it out under pressure is how teams revert into a crash loop.

**Blast radius already exposed.** How many users have seen the bad version, and is the number still growing? At canary rung 1 the answer is "1%, and it stops growing the moment we shift the slice" — abort, cheaply, and think afterwards. At 100% post-bake the exposure is total and static, which changes the calculus: the marginal user protected by a fast revert is small, so a slightly slower but correct fix may beat a fast one that reintroduces a different defect.

**Time-to-fix-forward versus time-to-revert.** Compare two *measured* numbers, not two guesses. Time-to-revert is the drill duration from §2 — you have it because you measured it. Time-to-fix-forward is: time to write the fix, plus the full pipeline (`release-gates.md` §3), plus the ramp. **Fix-forward's true cost is almost always the pipeline, not the diff**, which is why a one-line fix can take an hour to ship and a revert takes four minutes. If the numbers are close, revert — a revert returns to a known-good state, a fix-forward goes somewhere nobody has ever been.

## 2. The drill checklist

Each strategy's revert is exercised on a schedule and the exercise is **recorded with a date and an elapsed time**. That record is the evidence dimension 4 consumes; there is no other way to pass it. The mechanics column is deliberately a pointer, because the mechanics belong to `rollout-strategies.md` — everything of value in this table is in the last two columns.

| Strategy | Revert action (mechanics: `rollout-strategies.md`) | Drilled by | Record |
|---|---|---|---|
| **Rolling** | A second rolling pass to the previous artifact | Deploying the previous artifact into a prod-like environment at production fleet size and timing the full pass. Fleet size is the point — a drill on three instances tells you nothing about thirty. | Date · measured full-pass duration · fleet size drilled at |
| **Blue-green** | Router flip back to blue | Flipping the router in production, in a low-traffic window, and flipping back. This is the one revert cheap enough to drill for real, so there is no excuse for a stale record. Confirm blue was still warm and still had capacity. | Date · measured flip duration · whether blue was verified warm |
| **Canary** | Traffic slice returned to zero | Aborting a real canary — either a deliberate no-op release taken to rung 1 and aborted, or an honest count of unplanned aborts in the last quarter, which is better evidence than a synthetic drill. | Date · measured time to zero · whether it was deliberate or a real abort |
| **Flag-only** | Kill switch to the safe value | Toggling the kill switch against the deployed build and confirming behaviour actually changed for a request in flight — not that the console reported success. Confirm cached or long-lived connections also observe the flip, and how long they take to. | Date · measured propagation time · whether in-flight requests observed it |

Three rules about drills, which are the whole reason this table exists:

- **A drill record expires.** Ninety days is a reasonable default, shorter if the deploy topology changed. A revert path that worked in March and has not been exercised since is an untested revert path in September, and infrastructure moves faster than memory.
- **Drill the strategy this release is using**, not the one you use most. A team that rolls every day and blue-greens quarterly has a stale blue-green record exactly when it matters.
- **Measure it, do not assert it.** "Rollback takes a couple of minutes" is not a number the gate can compare against an SLO commitment. The drill's output is a duration, and that duration is what dimension 4 checks against the recovery time you have promised.

## 3. When roll-forward wins

Reverting is the default and the right answer most of the time. These are the narrow cases where it is not — narrow enough that each one should feel like a deliberate exception rather than a preference:

- **The schema is already contracted.** The old shape is gone. There is no build to go back to that works. Fix forward; this is not a choice.
- **The revert is itself the risky move.** The previous artifact is old enough that reverting also unships several other changes — including, often, a fix for the last incident. A revert that unwinds four releases to undo one is a bigger change than the fix, and it deserves the same scrutiny you would give any bigger change.
- **A tiny, well-understood fix with a proven pipeline.** A misconfigured constant, a wrong feature-flag default, an off-by-one in a limit. The change is small, the failure mode is fully understood, and the pipeline is fast and green. Fix forward — but only when *both* halves hold; "we understand it" plus a twenty-minute pipeline is still a revert.
- **The failure is data-dependent and the revert does not stop it.** Old code hitting the same poisoned rows fails the same way. Reverting buys nothing and costs a deploy cycle; fix the data or fix the handling.

In every other case — a real behavioural regression, an unclear cause, anything at all under time pressure — **revert first and diagnose from a healthy system.** Diagnosing on a burning production is how a ten-minute outage becomes an hour, and `loop-debug` does better root-cause work against a stable reproduction than against a live incident.

## 4. Recording the outcome

Whichever path was taken, the release record closes with:

- **`outcome`** — `rolled-back`, `rolled-forward`, or `completed`. Per `dora.md`'s counting rule, a canary aborted at 1% still counts as a change failure: it reached production and needed remediation. Only a release stopped *inside the gate*, never promoted, is `aborted-in-gate` and outside the count.
- **`remediationStartedAt` and `restoredAt`** — the two timestamps that produce **failed deployment recovery time**. Start the clock when remediation began, not when someone first suspected a problem; detection latency is a separate measurement and conflating them makes both useless.
- **Which decision factor from §1 decided it**, in one line. Over a few releases this is the most useful thing in the record: a team that keeps choosing fix-forward because reverts are slow has a rollback-automation problem, and only the pattern reveals it.
- **A drill-record update if this was a real revert.** A live abort is better evidence than any synthetic drill — fold it into §2's record rather than logging it only as an incident.

Those fields feed `dora.md`'s per-release instrumentation and, through it, `loop-audit`'s change-failure-rate framing — which this skill instruments and does not re-derive.

**The handoff.** Everything above assumes the trigger was a **deploy caught failing its own gate** — a rung aborted, a burn-rate threshold crossed, a canary pulled before most users noticed. The moment a shipped change causes live, user-facing harm, this stops being a release decision: **declare an incident and hand to `loop-incident`**, which owns mitigate-before-diagnose, comms, and the postmortem. Do not run a rollback deliberation in parallel with an unmanaged outage. Once mitigation is owned there, this playbook's role narrows to supplying the revert mechanism and its measured duration, and the release record simply points at the incident record rather than maintaining a second timeline of the same event.
