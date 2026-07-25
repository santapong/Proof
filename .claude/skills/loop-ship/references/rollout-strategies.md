# Rollout strategies — the mechanics you are about to execute

The engine here is one move that dominates every other: **decouple deploy from release, and make every change small, reversible, and observed as it rolls out.** A deploy that flips all traffic to new code at once, with no way back but a redeploy, is the failure mode this file exists to prevent — it turns every ship into a bet. Everything below is the machinery for turning that bet into a controlled, monitored ramp with a rollback that was tested before you needed it.

This file is the **mechanism reference for a rollout in flight**, not a survey of the field. Read it when you have a specific change in hand and need to know how the strategy you picked actually behaves — how its rollback works, what it costs, and how it fails. The *choice* of strategy for this change is made in `release-gates.md` §"Choosing the strategy for this change", which consumes the Risk → strategy table below as its input. The design-time question — does this system need flag infrastructure and backward-compatible schema evolution designed in at all — was settled in `../../loop-design/references/deployment.md` and recorded as an ADR long before you got here.

The tool names below — **Terraform** for IaC, **GitHub Actions** for CI/CD, **LaunchDarkly** for flags — are **illustrations of a principle**, never a mandate. "Terraform" means "declarative, version-controlled infrastructure with a plan/apply loop," which Pulumi, OpenTofu, CloudFormation, and CDK all provide. Match the incumbent tooling first; reach for a named exemplar only when there is no incumbent and you need a sane default.

## The core distinction: deploy vs. release

These are two events, and conflating them is the root cause of risky ships:

- **Deploy** — new code is running in production, receiving little or no user traffic. A technical event.
- **Release** — that code is exposed to users. A business event.

When they are the same event, the only rollout control you have is "all or nothing" and the only rollback is a redeploy under pressure. When they are separate — code deployed dark, released later behind a flag or a traffic ramp — you get to deploy on your schedule and release on your judgment, ramp exposure gradually, and turn a bad release off in seconds without shipping anything. **Decoupling these is the single biggest de-risking move available**, and everything below (canary ramps, feature flags) is a way to buy that decoupling.

At execution time the distinction has a concrete consequence for how you sequence a release: the deploy step and the release step get **separate go/no-go decisions**. A build can clear the pre-deploy checklist in `release-gates.md`, land in production dark, and sit there for a day before anyone decides to expose it. Treating those as one decision is what collapses your control surface back to all-or-nothing.

## The three strategies, plus the baseline they replace

Three strategies, plus the anti-pattern they replace. Each is scored on: mechanics, how rollback works, when it fits, and how it fails. The recreate/"big-bang" strategy — stop the old version, start the new one — is the baseline to avoid: it has downtime by construction and no gradual exposure, acceptable only for a dev environment or a system that is allowed a maintenance window.

### Rolling

**Mechanics.** Replace instances a few at a time — take a slice of the fleet, deploy the new version to it, wait for health checks, move to the next slice — until the whole fleet runs the new version. The default in Kubernetes (`RollingUpdate`) and most orchestrators; needs only one environment.

**Rollback.** Roll *forward* to the previous version the same way you rolled out — another rolling pass. This is the catch: rollback is not instant, it is a second deployment, so recovery time is one full roll. During the roll, old and new versions serve traffic simultaneously, so the new version must be backward-compatible with the old (see `migrations.md`).

**When it fits.** Routine, low-to-moderate-risk changes on a stateless fleet where a few minutes of mixed versions is fine. This is the correct default for the everyday case — cheap, no extra infrastructure, no traffic duplication.

**Failure modes.** A bad version reaches a growing share of traffic before health checks catch a failure that only shows under real load; rollback lag because unwinding is another full roll; forgetting that N and N-1 coexist mid-roll and shipping a breaking schema or API change.

**At execution time.** Your recovery-time budget is *one full roll*, so measure it once and carry the number into the gate — a fleet that takes eleven minutes to roll cannot honour a five-minute recovery commitment, and that is a no-go on the rollback dimension, not a detail to discover mid-incident.

### Blue-green

**Mechanics.** Stand up a complete second environment (green) running the new version alongside the current one (blue). Smoke-test green out of band, then cut the router/load balancer to send **all** traffic to green in one switch. Blue stays warm as the instant fallback.

**Rollback.** Flip the router back to blue — near-instant, and the whole reason to pay for two environments. Because the switch is all-or-nothing, the *release* is still binary; blue-green gives you fast rollback, not gradual exposure.

**When it fits.** Changes where you want a fully pre-warmed, independently tested environment and an instant, clean rollback, and can afford to run two production-sized environments during the cutover — releases that must not show mixed versions, or where you want to validate the full stack before any user sees it.

**Failure modes.** Double the infrastructure cost during the window; stateful concerns don't switch cleanly (in-flight sessions, and especially the database — both environments usually share one DB, so schema changes must be backward-compatible exactly as with rolling); the cutover still exposes 100% of users at once, so a defect that passed smoke tests hits everyone.

**At execution time.** Name the moment blue is torn down, and make it a decision rather than a cleanup job. Blue is your rollback; a green environment running alone is a release with no rollback path, and every hour you keep blue warm is billed. The gate should record how long blue is retained.

### Canary

**Mechanics.** Deploy the new version alongside the old, then route a **small, growing slice** of real traffic to it — 1% → 5% → 25% → 100% — while watching SLO signals (error rate, latency, saturation) at each step. Automate the ramp and the abort: promote to the next step only if the canary's metrics stay within budget; **auto-roll-back the instant they regress.** This is the strategy that most fully realizes "deploy ≠ release."

**Rollback.** Shift the traffic slice back to zero — fast, and it only ever exposed a fraction of users to the bad version. The blast radius of a bad deploy is bounded by the canary percentage at the moment it's caught, not by your whole user base.

**When it fits.** High-risk or hard-to-fully-test-in-staging changes where production traffic is the only honest test: a risky algorithm change, a new hot path, anything whose failure is expensive. Pair it with feature flags for maximum control (ramp *code* with the canary, ramp *behavior* with the flag).

**Failure modes.** It needs real observability to work — an automated rollback is only as good as the SLO signal driving it (see `../../loop-operate/references/slo-model.md` for SLOs and error budgets); without good metrics a canary is just a slow rolling deploy. Low-traffic services take too long to accumulate a statistically meaningful signal at 1%. And, as always, canary runs old and new together, so backward compatibility is mandatory.

**At execution time.** The ramp schedule and the abort criteria are yours to define — per-rung burn-rate thresholds live in `release-gates.md` §"SLO-gated promotion". A canary that has been parked at one rung for days is no longer a rollout; it is a running two-version service, and ownership has drifted to `../../loop-operate/references/slo-model.md` whether or not anyone said so. Set a maximum bake duration per rung and force a promote-or-abort decision when it expires.

## Risk → strategy

Pick by the blast radius of being wrong, not by fashion. This is the table `release-gates.md`'s decision tree reads:

| Change risk | Default strategy | Why |
|---|---|---|
| Routine, low-risk, stateless (most changes) | **Rolling** | Cheapest, no extra infra; mixed-version window is acceptable. |
| Needs instant, clean rollback; validate full stack pre-traffic | **Blue-green** | Warm standby, one-switch cutover, flip-back rollback. |
| High-risk / hard to test in staging / expensive to get wrong | **Canary + feature flags** | Bounded blast radius, real-traffic validation, auto-rollback on SLO regression. |
| Genuinely irreversible or data-destructive step | Canary **behind a flag**, + expand-contract migration, + tested restore | Reversibility must be engineered in; never rely on the deploy alone. |
| Dev/internal tool, maintenance window allowed | Recreate | Simplicity wins when downtime is free. |

**The house default:** canary + feature flags for high-risk changes, rolling for the routine ones. Reach past rolling only when a named risk justifies the extra machinery — canary and blue-green earn their complexity at scale and on the dangerous change, not on every commit.

## Feature flags: the decoupling mechanism

A feature flag is a runtime switch that gates behavior, so **code ships dark and turns on independently of the deploy.** This is what makes "deploy ≠ release" real at the code level: merge and deploy incomplete or risky work behind an off flag, then release it — to everyone, to 5%, to internal users, to one customer — without another deploy, and kill it in seconds if it misbehaves.

Know the four kinds, because they have different lifespans and owners:

- **Release flags** — hide in-progress work so trunk stays deployable; the enabler for trunk-based development. Short-lived: remove once the feature is fully rolled out.
- **Ops / kill switches** — let operators disable an expensive or fragile subsystem under load without a deploy. Long-lived by design; the emergency brake.
- **Experiment flags** — split traffic for A/B tests and measure. Live only as long as the experiment.
- **Permission / entitlement flags** — expose features to specific plans, cohorts, or beta users. Long-lived, part of the product.

**Flag hygiene is not optional.** Every flag is a live branch in production: N flags mean up to 2^N code paths, and a stale flag is untested dead weight that eventually causes an outage when someone toggles it. Give release flags an owner and an expiry, track them, and **make removing a fully-rolled-out flag part of finishing the feature.** Flag debt is real debt — treat a long list of forgotten flags as a bug backlog.

**At execution time**, flags are the three levers the promotion gate actually pulls — **flip** (expose to a cohort), **ramp** (raise the exposed percentage), **kill** (return to zero without a deploy). The gate's flag-wiring dimension checks that all three work for *this* change before the deploy starts: a flag whose kill path has never been exercised is a kill switch on paper. When a release both ramps a canary and ramps a flag, decide which one you will move first and write it down; moving both at once means an abort cannot tell you which lever caused the regression.

## Infrastructure as Code

**Principle: no console-clicked production.** Every piece of infrastructure — networks, clusters, databases, DNS, IAM — is declared in version-controlled code and applied by automation, so an environment is reproducible from the repo and every change is reviewed, diffed, and audited like application code. This is the substrate every rollout above runs on: a canary you cannot reproduce from the repo is a canary you cannot reliably abort. Terraform is the exemplar because it makes the loop explicit:

- **Declarative + a plan/apply loop** — you describe the desired end state; the tool computes and shows the diff (`plan`) before it mutates anything (`apply`). Review the plan the way you review a PR.
- **State** — the tool tracks what it created in a state file. This is the one piece with real operational weight: store it remotely, lock it against concurrent applies, and never hand-edit it. Its integrity is the integrity of your infra.
- **Modules** — factor repeated topology into reusable, versioned modules so environments are the same code with different variables, not lookalike copies that drift.
- **Drift** — a change made by hand in the console diverges reality from code; the next `plan` reveals the drift. The discipline is to make the change in code and re-apply, not to click. Console access to prod is for reading, not writing.

Pair IaC with **immutable infrastructure**: don't patch running servers in place — build a new image/version and replace instances (this is exactly what rolling/blue-green/canary do at the infra layer). A server you never mutate after boot has no configuration drift and a trivial rollback: redeploy the prior image.

**At execution time**, an infrastructure change that ships alongside an application change is a second rollout with its own blast radius, and `plan` output is gate evidence: an apply whose plan was never read is an unreviewed change to production. If the release includes both, sequence them and gate them separately.

## Environment topology

Keep environments **as alike as possible** — the value of staging is entirely in how faithfully it predicts prod, and every divergence (different data shape, different scale, mocked dependency) is a class of bug staging cannot catch. A typical ladder is dev → staging (prod-like, the last gate) → production, all provisioned from the *same* IaC modules with different variables so they can't drift apart by hand. Because staging is never a perfect mirror, treat **production as the final test environment** and instrument it accordingly — which is the whole argument for canaries and flags: they make testing-in-prod safe rather than reckless.

**At execution time**, the ladder is the promotion path in `release-gates.md`: one artifact, promoted unchanged from staging to production. A divergence you know about (staging has a tenth of the data, staging mocks the payment provider) belongs in the release record as a named gap in what staging proved — it tells the promotion gate which failures it should expect to see *first* in the canary rather than treating them as surprises.

## Exemplars (illustrations only)

Named to make a choice concrete, **not** as targets to copy — each fits a specific operational profile that may not be yours:

- **Terraform** — the IaC exemplar for the declarative plan/apply loop with explicit state. Read it as the *pattern* (version-controlled, reviewed, reproducible infra); OpenTofu, Pulumi, CloudFormation, and CDK deliver the same principle. Overkill for a single hand-run box — but the moment you have more than one environment, hand-clicking is the more expensive path.
- **GitHub Actions** — the CI/CD exemplar for build-once-promote-many pipelines triggered from the repo. GitLab CI, CircleCI, Jenkins, and Argo/Flux (GitOps) are the equivalents; the principle is "the pipeline is the only path to prod," not the vendor.
- **LaunchDarkly** — the managed feature-flag exemplar for release/ops/experiment/permission flags with targeting and instant kill switches. A config-driven flag table in your own DB is a fine starting point; reach for a platform when flag targeting, auditing, and hygiene outgrow a hand-rolled table.

Read each as "here is where this tool's operational profile was genuinely present," then check whether *yours* matches. A three-person internal tool and a high-traffic platform want very different points on every axis in this file.
