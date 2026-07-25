# Contracts and promotion — trusting a contract you cannot control

Two problems, one root cause. The provider can change their API without asking you, and you cannot run tests in their pipeline — so you need a verification loop that works from the outside. Then, when you are satisfied, you have to swap a set of credentials and endpoints from sandbox to live without breaking anything, in a system where "roll back the code" does not undo a real charge.

## 1. Start from the provider's published spec

If the provider publishes an **OpenAPI** document (REST) or an **AsyncAPI** document (events and webhook payloads), that file is the most valuable artifact in the integration. Pin the exact version and treat it as a checked-in dependency.

- **Vendor the spec into your repo**, at the exact revision you built against, and record the provider's API version string alongside it. A spec fetched live at build time makes your build non-reproducible and lets a provider edit break you at 3am with no diff to look at.
- **Validate against the version the provider actually publishes.** Per `standards.md`, **OpenAPI 3.1.0** is what most providers still ship even though **3.2.0** (19 Sep 2025) is the current release, and **AsyncAPI 3.0.0** is the common baseline against a current **3.1.0** (31 Jan 2026). Generating a client against a newer spec version than the provider serves produces a client that matches nothing. Note the gap as a drift risk; do not close it unilaterally.
- **Generate, then wrap.** A generated client is fine for transport and types; do not let generated code spread through your domain. Put it behind a small hand-written adapter that speaks your types, and hang the retry, breaker, and idempotency logic from `resilience.md` and `webhooks-and-idempotency.md` on that adapter — generated clients almost never bring an acceptable retry policy of their own, and regenerating one silently reverts anything you edited inside it.
- **Validate responses in non-production.** Assert incoming payloads against the schema in test and staging so a provider's shape change surfaces as a specific validation error rather than a `TypeError` three layers away. In production, prefer tolerant reading — ignore unknown fields, never fail a request because the provider added a property.
- **No spec published?** Write the subset you depend on yourself, as an OpenAPI or AsyncAPI fragment covering only the endpoints and fields you actually use. It is a day of work and it turns §3's drift detection from impossible into mechanical.

## 2. The Pact boundary

This is the load-bearing distinction in this file, because the wrong answer costs a sprint.

**Consumer-driven contract testing works by having the *provider* verify your contract in the *provider's* CI.** You publish a pact describing what you expect; their pipeline replays it against their real implementation and fails their build when they would break you. Every guarantee Pact offers comes from that verification step. A pact nobody verifies is a mock with extra ceremony.

**The dividing question is: *"can we get the provider to run our pact?"***

- **Yes → `loop-test`.** Internal services where you control both sides, a sibling team on the same CI platform, a partner with a genuine contract-testing agreement. The full Pact workflow — broker, `can-i-deploy`, provider states, versioning — is `loop-test`'s, and `../../loop-test/references/standards.md` already pins the specification (**Pact v4**).
- **No → this skill.** Stripe, GitHub, Okta, Twilio, your cloud provider, and essentially every commercial SaaS. They will not run your pact and it is not reasonable to ask. Adopting Pact here buys you a well-structured stub and the *illusion* of a verified contract — the failure mode being that your suite stays green while the provider ships a breaking change, which is precisely the failure contract testing was supposed to prevent.

Answer the question explicitly and write the answer down. "We use Pact for our third-party integrations" is, nine times out of ten, an unexamined assumption that a real provider-verification step exists somewhere.

## 3. The substitute verification loop

When the answer is *no*, replace provider-side verification with three outside-in mechanisms. Together they cover roughly what a verified pact would have.

**a. Recorded sandbox fixtures.** Capture real request/response pairs from the provider's sandbox and replay them in your test suite. Real fixtures beat hand-written stubs for the same reason a pact does: hand-written stubs encode what you *believe* the provider returns.

- Record from the sandbox, never from production — captures contain live tokens and customer data.
- **Redact on capture**, not later: strip `Authorization`, cookies, signing secrets, and PII at the moment of recording.
- Commit fixtures with the provider API version they were captured under, so a version bump invalidates them visibly.
- **Re-record on a schedule, not on failure.** Fixtures that are only refreshed when a test breaks converge on a snapshot of a provider that no longer exists.

**b. Contract-diff on every provider spec bump.** Fetch the provider's current spec on a schedule and diff it against your vendored copy. Classify each change:

| Change | Severity | Action |
|---|---|---|
| Field or endpoint you use is **removed**, or its type changed | Breaking | Block; fix before the provider's deprecation deadline |
| Field you use becomes **optional**, or an enum gains a value | Breaking in practice | Your parser must tolerate it — verify, do not assume |
| Required **request** field added | Breaking | Block |
| New endpoint or field you do not use | Informational | Note and move on |
| Wording, examples, description changes | Noise | Suppress, or the signal drowns |

Wire this into CI so a provider change opens a ticket instead of causing an incident. Subscribe to the provider's changelog and deprecation announcements as a second channel — spec files sometimes lag the announcement.

**c. A canary call against the real sandbox.** Fixtures cannot detect a change the provider has not yet reflected in their spec, and a diff cannot detect a behavioural change with no schema change (a field that stops being populated, a new rate limit, an error that changes category). So run a **small, scheduled suite of real calls against the sandbox** — the handful of operations the integration cannot live without — outside the main test suite so its flakiness never blocks a deploy, and alert on failure. This is also your pre-flight before trusting a new provider API version: point the canary at the new version first, and promote only when it is clean.

**Who writes the files.** This skill *specifies* the contract — which operations matter, which fixtures to record, what the drift check must catch, what the canary asserts. Authoring those tests in the repo's own framework and conventions is `loop-test`'s job. Hand it the specification rather than writing a test file in a stack you have not checked.

## 4. Sandbox → production promotion

Promotion here is narrow and specific: **cutting one external dependency over from sandbox credentials and endpoints to live ones.** It is not a deployment strategy (§5). Its distinguishing risk is that production side effects are real — a duplicate charge is not rolled back by reverting a commit.

**Before the cutover**

1. **A separate production app registration exists** — its own client id, secret, redirect URIs, scopes, and webhook signing secret, per `auth-and-secrets.md` §4. Never promote by re-pointing the sandbox registration.
2. **Production secrets are in the secrets manager**, injected at runtime, and confirmed loadable by the target environment. A missing production secret discovered at cutover is the most common failure of this step and the most avoidable.
3. **Scopes are the minimum the production feature needs** — not whatever the sandbox registration accumulated during development.
4. **The production webhook endpoint is registered, reachable, and verifying signatures against the production signing secret.** Prove it with the provider's own "send test event" tool before you depend on it.
5. **Rate limits and quotas are the production ones.** Sandbox quotas are usually more generous *and* sometimes tighter; either way the numbers in your throttle and breaker config (`resilience.md`) must be re-checked against the production tier.
6. **The canary suite is green against the sandbox** on the API version you are promoting.
7. **Money, messaging, and destructive operations are enumerated.** Know exactly which calls in this integration spend money, contact a customer, or delete something, and confirm each carries an idempotency key.

**The cutover**

8. **Feature-flag the switch.** The flag selects the credential set and endpoint, not a code path — same code, different configuration — so flipping back is a config change and not a deploy.
9. **One smoke-test transaction in production**, executed by a human, end to end, against a real account you control: make the call, confirm the provider's dashboard shows it, confirm the resulting webhook arrives and verifies, confirm your side recorded it exactly once. A green health check is not this test.
10. **Watch the first real traffic deliberately** — 401/403 (wrong credential), 429 (production quota lower than sandbox), and webhook signature failures (wrong signing secret) are the three that show up in the first minutes.

**Rollback**

11. **Rollback is flipping the flag back to the sandbox credential pair.** Fast, config-only, no deploy.
12. **Rollback does not undo side effects.** Anything already sent to production — a charge, an email, a provisioned account — needs an explicit compensating action. Write that compensation down *before* the cutover; it is the part nobody plans and everybody needs.
13. **Leave the sandbox registration intact and working** after promotion. Deleting it removes your rollback target and your canary's home.

## 5. Boundary note

This is the **integration-specific slice** of promotion — one dependency, one credential-and-endpoint cutover, one compensating-action plan. It rides on top of whatever general rollout mechanism the project already uses: canary and progressive delivery, feature-flag hygiene, blue-green or rolling deploys, and the release gates around them are `../../loop-ship/references/rollout-strategies.md`. Use its mechanics; do not restate them here. What this file adds on top is the part `loop-ship` cannot know — that the artifact being promoted is a *credential*, that the rollback target is a *sandbox registration*, and that production side effects at a third party are not covered by a code rollback.
