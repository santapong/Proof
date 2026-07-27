# Deployment

How to run the improvement loop unattended, and the safety scopes that keep "autonomous" from becoming "unsupervised writes to main." This builds on the mechanisms catalogued in the `loop-harness` skill's `references/automation-loops.md` — read that for the full menu; this file is the recommended setup for *this* loop.

It is also the **single definitional home of the autonomy ladder** — the four rungs below are defined here and nowhere else under `.claude/skills/`. `loop-operate` wires a live service to the same ladder and cites this section rather than restating it, so that the two skills cannot drift apart after 1.0.0. The repository `README.md` carries a reader-facing summary of the same ladder; where the two differ, **this section is the source of truth** and the README is the thing to correct.

## The autonomy ladder

Four rungs, in order. Each is a statement of **what the loop does and what the human does** — not a maturity score, and not something you set once. A deployment sits at exactly one rung per change kind, climbs only by earning the next rung's preconditions, and can be dropped back automatically.

| Rung | The loop does | The human does | Implemented by | Status |
|---|---|---|---|---|
| **OBSERVE** | Reports findings; takes no action on the repository | Reads the report and decides what to act on | `loop-audit`, `loop-review` | shipped |
| **VERIFY** | Acts on a `claude/` branch, verifies its own work adversarially, opens a **draft PR** | Approves and merges | `loop-autopilot` in its default mode | shipped |
| **SUSTAIN** | Detects when its own verifier is being gamed or the loop is meta-overfitting | Reads the alarms and freezes config on a trip | `verifier-integrity.md` + `held-out-eval.md` | shipped |
| **SCALE** | Merges behind a canary and rolls **itself** back on a bad signal | Handles the exceptions a rollback raises | §Advanced below + `../templates/canary-merge.workflow.js` | off by default |

**OBSERVE — report only.** The loop reads and reports; it writes nothing to the repository. The output is a findings list a human acts on. This is the correct rung for a loop whose verifier has never been measured, and it is where every deployment starts.

**VERIFY — propose, a human merges.** The loop does the work on a `claude/`-prefixed branch, subjects the result to adversarial verification, and opens a draft PR. It never merges. This is the default rung for `loop-autopilot` and the rung nearly every deployment should stay at indefinitely; the value is real work done autonomously with the merge decision still human.

**SUSTAIN — keep the loop honest.** SUSTAIN adds no new authority. It adds *self-measurement*: held-out evaluation of the loop's own false-accept rate, structural guards against verifier gaming, and drift detection on both. A rung that notices the machinery has gone quietly wrong is a precondition for granting any authority above VERIFY, because every rung above it rests on the verifier being trustworthy.

**SCALE — autonomous delivery, off by default.** The loop merges eligible changes without a human, behind a canary, and reverts autonomously on a bad signal. It is granted **per change kind and per blast radius**, never blanket, and only while every SUSTAIN signal is green. §Advanced below is its full specification.

**The degradation guarantee — the property that makes the ladder safe to climb.** *Any alarm drops the loop one rung, automatically and logged; re-enabling requires a human.* A SUSTAIN alarm freezes config; a SCALE trip drops to VERIFY; and VERIFY's floor — propose-only, a human merges — is always there to catch it. The worst case is therefore never a runaway loop, it is a loop that quietly goes back to asking permission. Two consequences follow, and both are load-bearing:

- **The floor is safe by construction.** Degradation terminates at a rung that opens draft PRs and nothing more, so the failure mode of the whole design is *less* autonomy, never uncontrolled autonomy.
- **Trips are recorded where a human reads them**, not merely counted. An automatic drop that nobody notices is how a loop sits at a degraded rung for a month while everyone assumes it is working.

## Primary: a Cloud Routine

Cloud Routines run on Anthropic infrastructure with **your machine off** and **no per-run approval prompt** — the strongest autonomy, so the guardrails below are load-bearing.

1. **Create a scheduled Routine** (Claude Code on the web → Routines, or `/schedule`). Minimum interval is **1 hour**; hourly or nightly is plenty for a self-improving loop.
2. **Add a `pull_request` trigger** for reactivity (Routines fire on `pull_request` and `release` events). Each event starts a fresh session.
3. **Set the prompt** to `templates/routine-prompt.md`.
4. **Poll issues in the prompt** — Routines do **not** trigger on issues or issue-comments, so the prompt must list open issues each run (see `feedback-intake.md`). If you need instant issue-comment reactivity, add a **GitHub Action** on `issue_comment` (Actions support that event; Routines don't).

### Safety scopes (all of them)

- **Leave "unrestricted branch pushes" OFF** — Claude can then push only to `claude/`-prefixed branches. This alone prevents writes to `main`.
- **Keep network on Trusted** (the default). The loop needs only GitHub, which is allowlisted; don't widen it unless a step truly requires another host.
- **Minimize connectors** — include only the GitHub connector (and `alphaXiv` if you want paper research). Every connector is a capability the unattended run can use without asking.
- **The daily run cap** is a natural throttle; the budget floor and `MAX_ROUNDS` in the workflow are the per-run throttle.
- The prompt's **never-merge / propose-only** rule is the last line — because there is no approval prompt, it must be explicit and absolute.

Actions appear under **your** GitHub identity (commits, PRs, comments are yours).

## Alternatives

- **GitHub Action** driving Claude Code — the way to react to `issue_comment` / `issues` events (which Routines can't), and for team-wide, repo-native automation. Gate with the App's permissions and `--max-turns`.
- **Headless `claude -p`** on your own scheduler (cron/CI/systemd) — full control, but you host and schedule it.
- **Interactive `/loop`** with `templates/routine-prompt.md` copied to `.claude/loop.md` — for a **supervised** burst while you watch a session; not truly unattended (fires only while the session is running and idle).

Prefer the lightest mechanism that meets the need: a supervised `/loop` to try it out, a Cloud Routine once you trust it.

## Notification (this is your "email")

There is **no native email** in Claude Code. The loop notifies by **posting a GitHub comment** on the draft PR (or the source issue): GitHub's own notification system then emails you and any subscribers — zero infrastructure, works unattended. If you want real email in the message body, add an **MCP email connector** (e.g. Resend) in your Claude settings — connector traffic is Anthropic-routed, so it works even under the Trusted network policy — and have the propose step call it. Avoid `curl`-ing an email API from Bash: that needs a Custom/Full network policy plus an API key in a (web-visible) env var.

## Companion Routines

Two lighter Routines run *alongside* the main improvement loop, on their own schedules. Both are read-mostly and never touch code. Run `references/anti-patterns.md` before deploying any of the three.

### Credit-ledger reconcile — `templates/credit-ledger.workflow.js` (daily)

Learns which proposal *kinds* actually get merged and records it in a trust ledger (`references/credit-horizon.md`).

- **One-time setup**: open an issue titled `🤖 Credit Ledger (automated, do not edit)`, label it `credit-ledger`, and paste the empty-ledger JSON from `credit-horizon.md` as the body. Note its issue number.
- **Deploy**: a Routine (or headless run) that invokes the template with `args: { repo, ledgerIssueNumber, nowMs, nowIso }`. The main loop must already be labeling PRs `automated` + `kind:<kind>` (see `routine-prompt.md`) for the ledger to attribute outcomes.
- **The `nowMs` / `nowIso` args are required**: workflow scripts can't read the clock (harness policy H10), so the deploying Routine supplies the current time (epoch ms + ISO string). The reconcile uses them only to age-out stale PRs and stamp `lastRecalc`.
- **Cadence**: daily is fine; **every few days is also fine** — the `BATCH_SIZE=10` gate means trust weights only recompute once enough new outcomes have accrued, so a slower cadence loses nothing and spends fewer routine-runs against your daily cap.

### Comprehension digest — `templates/comprehension-digest.routine.md` (weekly)

Random-samples merged PRs and opens a `comprehension-check` issue so a human actually reads what shipped (`references/comprehension-rot.md`). It's a **Routine prompt** (a live session samples randomly — a script can't, per H10), deployed weekly.

## First-run checklist

- [ ] Repo has the Claude GitHub App installed (not just web-setup).
- [ ] "Unrestricted branch pushes" is **off**; pushes go to `claude/*`.
- [ ] Network is **Trusted**; only GitHub (+ optional alphaXiv) connectors are enabled.
- [ ] Routine prompt is `routine-prompt.md`, with the never-merge rule intact.
- [ ] You've run `templates/improvement-loop.workflow.js` in `runMode:"dry"` once and reviewed the proposals it would make.
- [ ] An opt-in label convention limits which issues the loop will act on.
- [ ] (If using the credit ledger) the pinned `🤖 Credit Ledger` issue exists and its number is wired into the reconcile Routine's `args`.
- [ ] You ran `references/anti-patterns.md` against the current design (AP5 in particular) before raising concurrency.

---

## Advanced: autonomous delivery (SCALE) — off by default

Everything above keeps the loop **propose-only**: it opens draft PRs and a human merges. This section documents the one deliberate exception — letting the loop **merge without a human** — and it inverts the core rule this file is built around ("unrestricted branch pushes off; never write to `main`"). Treat it accordingly.

**Reality check first.** No production system removes the human from the merge step for *general* code (the ones that auto-ship do it only for narrow classes — dependency bumps, lint fixes — where CI is a complete spec). What follows is the **safest known shape**, not a proven recipe. Propose-only remains the correct default for almost every deployment; SCALE is a supervised experiment you graduate into and can lose automatically. If you are unsure whether to enable it, don't.

### The principle: you don't earn autonomy with a better gate

You cannot make a pre-merge check that catches everything — that is exactly the AP6 lesson (`verifier-integrity.md`). So SCALE's safety does not come from trusting `safeToPropose` more. It comes from **after** the merge: ship the change small and reversible, behind a canary, watch it, and revert fast on a bad signal. This is how human CD already works. SCALE just moves the human from *before* the merge to *the exception handler after it* — the merge is automatic; a human is still who you page when a rollback fires.

### Preconditions — all of them, sustained (not passed once)

Enable SCALE only while **every** SUSTAIN signal is healthy, and keep checking:

- **Held-out green** — the false-accept rate is at/below baseline and **not rising**, over several consecutive runs (`held-out-eval.md`). An active meta-overfit alarm forbids auto-merge outright.
- **AP6 guards clean** — zero canary/diff-integrity violations over a window, and cross-judge agreement flat, not falling (`verifier-integrity.md`).
- **Credit-ledger maturity** — only *kinds* whose `trustWeight` is above a **high** threshold (≥ ~0.9) over a meaningful sample are eligible (`credit-horizon.md`). A kind that hasn't earned it stays propose-only.
- **Comprehension debt clear** — open `comprehension-check` issues at/below threshold (`comprehension-rot.md`). If humans already stopped reading what the loop merges, you do not get to remove them further.

### Eligibility — narrow the change class, hard

Auto-merge is decided **per kind and per blast radius**, never blanket. The dividing line is whether the test suite is a *complete* spec for that change.

- **Eligible** (only if the gates above hold): dependency bumps that pass full CI, lint/format-only, doc-only, and bug fixes that ship a failing→passing regression test *and* leave held-out green.
- **NEVER auto-merge — always fall back to propose-only regardless of every gate**: schema/data migrations, anything touching secrets or credentials, infra/CI config, public-API breaks, deletions beyond a small line threshold, any diff hitting a protected path (`verifier-integrity.md`, Guard 2), and anything whose `loop-audit` memo rates `high`. **If a change cannot be cleanly reverted, it is ineligible by definition** — the whole safety model is cheap rollback.

### The mechanism — merge behind a canary, watch, promote or revert

1. **Eligibility gate** (above). Any miss → propose-only draft PR, done.
2. **Merge to `main`, behind a guard** — a feature flag defaulting off, a canary slice, or a staged rollout. **Never 100% immediately.** This step is infra-specific; it is the part you must supply.
3. **Bake window** — for a fixed time the loop watches health: CI on `main` green, canary error rate / latency within SLO, no newly-failing held-out task, no human revert request.
4. **Promote or roll back** — healthy through the window → widen the flag / full rollout. Any breach → roll back.

### Agent-driven rollback — the exception handler

On a breach the loop **reverts autonomously** (`git revert` the merge commit, flip the flag off / redeploy), fast, then opens a loud issue and records it. The asymmetry is the entire justification for canary-over-perfect-gate: a revert is cheap and near-instant; a bad merge left live is not. Rollback is not a failure of SCALE — it is SCALE working.

### The tripwire — autonomy is revocable, automatically

Autonomy is a privilege the loop loses without asking:

- Any **held-out alarm** (false-accept rising) → drop **all** kinds back to propose-only.
- **Rollback rate** over a window exceeds threshold → drop back to propose-only.
- **Cross-judge disagreement** trend rising → drop back.

These are the SCALE-specific triggers of the degradation guarantee defined in § "The autonomy ladder" above — the same rule, with this rung's alarms named. Dropping back is automatic and logged; **re-enabling requires a human** to review the trip and flip it on. This is the safety net's safety net: SCALE degrades to VERIFY, which is already safe. The worst case is not "runaway loop" — it is "loop quietly returns to opening draft PRs."

### Autonomy state + audit

A pinned issue (`🔒 Autonomy State (automated, do not edit)`) holds current mode, the enabled kinds, and the trip history; **every auto-merge and every auto-rollback is appended** as the audit trail. The improvement loop's Propose stage reads this issue to decide, per candidate, whether to merge-behind-canary or fall back to a draft PR. This is the single integration point between SCALE and the existing loop.

### Safety scopes that change for SCALE

This is the one place the branch-push lockout no longer holds — the loop must push/merge to `main` for eligible kinds. The guardrail **moves**, it doesn't vanish:

- A **merge-gate** that re-checks eligibility + all preconditions immediately before any merge (`templates/canary-merge.workflow.js`).
- **Branch protection on `main`** requiring that merge-gate's status check to pass — so even the automated path cannot merge an ineligible change.
- The **tripwire** above, wired to both the held-out alarm and the rollback rate.

Be honest that this is a larger trusted surface than propose-only. The gates are what compensate; if you can't stand up all of them, stay propose-only.

### SCALE checklist

- [ ] SUSTAIN is deployed and has run **clean for several cycles** (held-out green and flat, AP6 zero violations).
- [ ] The credit ledger shows ≥ threshold trust for the **specific kinds** you're enabling; every other kind stays propose-only.
- [ ] The NEVER-list is encoded (migrations, secrets, infra, API breaks, large deletes, `high`-risk memos, protected paths).
- [ ] A canary / flag / staged-rollout mechanism exists in the target — **auto-merge without a canary is not SCALE, it's just deleting the safety net.**
- [ ] Rollback is one command and **verified to actually work** (revert + redeploy / flag-off).
- [ ] Tripwire wired: held-out alarm **and** rollback-rate both auto-drop to propose-only.
- [ ] The `🔒 Autonomy State` issue exists; auto-merges and rollbacks are appended to it.
- [ ] A human owns re-enabling after any trip.

### Honest status (what's still unsolved)

Two parts of this are genuinely open, not just unimplemented. **(1)** Choosing the bake-time and health-signal thresholds without a ground-truth oracle for "did this regress in a way CI missed" — you are approximating that oracle with canary metrics, which is exactly where subtle regressions hide. **(2)** Preventing the loop from learning to produce changes that *look* canary-healthy while being subtly wrong — the post-merge analogue of AP6. Held-out eval is the current best defense against both, which is why it is a hard precondition and a live tripwire rather than a one-time check. Run SCALE as an experiment you supervise, with the trip history as your primary instrument — never fire-and-forget.
