---
name: loop-integrate
description: "Integrate a third-party, cloud, or SaaS platform: OAuth 2.0 and OIDC flows, token and secret handling, webhook receipt and verification, idempotency keys, rate limits, retry and backoff, contract tests against the provider, and sandbox-to-production promotion. Use when the user asks to integrate, connect, or wire up an external API, provider, or SaaS, implement OAuth or SSO, receive or send webhooks, handle a provider's rate limits or retries, or move an integration from sandbox to live credentials. For choosing which provider or library to adopt, use loop-scout. For designing an API this system exposes to others, use loop-design. For auditing the security of an integration already written, use loop-review."
argument-hint: <integration> [--mode <optimize|full>]
---

# Integrating a Third-Party Platform

You are about to build or harden the boundary between this system and somebody else's. Everything below assumes the defining constraint of that work: **you control one end of the wire and not the other.**

## 1. The predicate: whose API is it?

Ask one question before anything else — **who owns the contract you are coding against?**

- **They own it → this skill.** Their auth flow, their webhook payloads, their rate limits, their sandbox, their versioning cadence. You cannot change any of it; you can only survive it. Every reference in this skill exists because a dependency you do not control fails in ways an in-process call never does.
- **You own it → `loop-design`.** The API *this* system publishes to its own callers is `loop-design/references/api-design.md` — and it deliberately covers the same vocabulary from the other side: §6 idempotency keys you *require*, §9 rate limits you *enforce*, §12 the auth methods you *accept*. Same nouns, opposite side of the wire. If you find yourself deciding what status code to return, you are in the wrong skill.

Three more lines that keep this skill from swallowing its neighbours:

- **The provider is already chosen.** If the user names a provider ("wire up Stripe", "add Okta SSO"), the selection question is closed and this skill does not reopen it. Choosing between candidate providers or libraries is `loop-scout`'s deliverable, and its output is this skill's input. Re-litigating a decision the user already made is the most common way this skill wastes a session.
- **The integration is not yet written, or is being hardened.** If it exists and is *failing at runtime*, root-causing that is `loop-debug`. If it exists and the ask is a security verdict on it, that is `loop-review`.
- **This is build time, not run time.** Designing and tuning the retry, breaker, and idempotency logic is here. Watching a live dependency's error budget and paging on it is `loop-operate`.

## 2. Establish the ground truth before writing code

An integration written from memory of "how OAuth usually works" is how a week disappears. Collect four things first, and say so explicitly if one is missing:

1. **The provider's published contract** — its OpenAPI or AsyncAPI document, or failing that its reference docs and the exact API version string you are pinning to.
2. **Sandbox credentials and a sandbox endpoint**, separate from production. If the provider has no sandbox, that is a risk to name now, not at cutover (`references/contracts-and-promotion.md`).
3. **Its documented limits and SLA** — rate-limit quotas, timeout expectations, retry guidance, webhook retry schedule. These are the tuning inputs for `references/resilience.md`; without them you are guessing thresholds.
4. **How this repo already talks to third parties** — the shared HTTP client, an existing retry wrapper, the secrets manager in use. Match the existing convention; a second bespoke retry policy in the same service is a defect, not an integration.

## 3. Auth and the credentials it produces

Pick the grant, then own the credential for its whole life. Full decision table, the RFC 9700 checklist, and the rotation procedure are in **`references/auth-and-secrets.md`** — read it before choosing a grant, not after.

Defaults it will hold you to: authorization code **plus PKCE on every flow including confidential clients**; client credentials for server-to-server; an OIDC ID token only when you actually need the third party's identity rather than delegated access; Resource Owner Password Credentials and Implicit are banned outright. Credentials live in a secrets manager, never in the repo, with separate app registrations per environment and rotation via a dual-secret overlap window.

## 4. Delivery in both directions — the symmetry principle

Inbound webhooks and outbound calls look like two problems and are one. **At-least-once delivery is symmetric:** the provider retries into you, so your handler must dedup on delivery id; you retry into the provider, so your call must carry an idempotency key. Both are "the same event may arrive twice, make the second one harmless." That is why they share a single reference — **`references/webhooks-and-idempotency.md`** — covering signature verification with timestamp-tolerance replay protection, delivery-id dedup stores and their TTLs, tolerating out-of-order delivery, signing your own payloads when you are the sender, and idempotency-key scoping on outbound mutations.

If you implement one direction and not the other, you have shipped half the discipline.

## 5. Resilience to a dependency you do not control

The provider *will* rate-limit you, time out, and have an outage. Your job is to not amplify it. Read **`references/resilience.md`** for the rate-limit header contract, exponential backoff with **full jitter** as the default, the circuit-breaker state machine, per-dependency timeout budgets and bulkhead isolation, and what "degrade gracefully" concretely means for this integration.

Two rules worth stating in the router because they get skipped: **never retry without jitter** (synchronized retries are how a provider's brief blip becomes your outage), and **never retry a non-idempotent call that lacks an idempotency key** — that is not resilience, it is double-charging.

## 6. Contract validation and sandbox → production promotion

Read **`references/contracts-and-promotion.md`**. Its load-bearing distinction is the **Pact boundary**: consumer-driven contract testing assumes the provider will verify your pact in *their* CI. The dividing question is *"can we get the provider to run our pact?"* **Yes → `loop-test`. No → `loop-integrate`** — and for almost every third-party platform the answer is no, which is why this file substitutes provider-spec validation, recorded sandbox fixtures, and spec-drift diffing on version bumps.

The same file carries the promotion checklist: separate app registration and webhook endpoint per environment, feature-flagged cutover, one smoke-test transaction in production, rollback by reverting to the sandbox credential pair.

## 7. Cite the standard, pinned

Every claim this skill makes about OAuth, rate-limit headers, idempotency keys, webhook signatures, or contract formats has a named source with a pinned version in **`references/standards.md`**. Cite from that file, never from memory — several of the sources here are *drafts*, one is *expired*, and one is an industry initiative rather than a standards body. Presenting any of them with RFC-level authority is a reporting defect, and the file says exactly how to phrase each one.

## 8. What this skill hands off

Delegate rather than re-derive. Each of these produces a *pointer*, not a second opinion:

| When the finding is… | Hand it to | Why |
|---|---|---|
| A genuine security defect — a secret hardcoded in source, a missing authorization check | **`loop-review`** | It owns OWASP/CWE tagging, severity, and the false-positive bar. Re-scoring it here would produce a second, weaker verdict — the same delegation `loop-audit` already makes for its security dimension. |
| A contract **test file** that must exist in the repo's own stack | **`loop-test`** | This skill *specifies* the contract (which calls, which fixtures, which drift checks). Authoring the test in the project's framework and conventions is `loop-test`'s job. |
| The integration is broken at runtime and nobody knows why | **`loop-debug`** | Readiness gaps are not diagnoses. Root-cause first, then come back and author the missing pattern from these references. |
| A general risk/impact memo about a PR that happens to touch integration code | **`loop-audit`** | It owns the memo and folds this skill's confirmed gaps in, exactly as it folds in `loop-review`'s findings. |
| The general rollout mechanism the promotion rides on | **`loop-ship`** | This skill's promotion is one credential-and-endpoint cutover; canary, flags, and rollback mechanics are `loop-ship/references/rollout-strategies.md`. |

## 9. Orchestration: scale past a single call site

**A single endpoint, a single webhook handler, or one auth flow you can hold in context — do it inline.** Do not spin up agents to check three functions.

For **anything larger — an integration spanning many call sites, an inherited integration you are auditing for production readiness, or several providers at once — run `templates/integration-readiness-audit.workflow.js`**:

1. **Finder per readiness category** (parallel) — one finder each for auth-and-secrets, webhooks-and-idempotency, resilience, and contracts-and-promotion, returning structured candidate gaps.
2. **Dedup barrier** — the four lenses are *not* disjoint (a missing idempotency key is visible to both the webhook finder and the resilience finder inspecting retry safety on the same call), so dedup on location + gap type before spending verify budget, and early-exit clean at zero survivors.
3. **Adversarial verify** — one skeptic per survivor, prompted to prove the gap is *already handled* by shared middleware, an existing wrapper, or a platform gateway, defaulting to "not a gap" when the evidence is inconclusive.
4. **Report** — confirmed gaps only, each mapped to its `references/standards.md` citation and the reference file carrying the fix; security-flavoured survivors go out in a separate hand-off list for `loop-review` (§8).

This is a specialization of `loop-review/templates/security-review.workflow.js` — the same finder → dedup barrier → adversarial-verify shape, with the readiness categories, the already-handled-elsewhere refutation, and the review hand-off pre-wired. Invoke the **`loop-engine`** skill to author and execute the run.

**Execution flags.** `--mode <optimize|full>` is advertised here and **parsed by `loop-engine`, never by this skill** — pass the raw argument string through when you invoke it. See `../loop-engine/references/execution-modes.md`.

## Reference files

- `references/auth-and-secrets.md` — grant selection, the RFC 9700 checklist, and the third-party credential lifecycle
- `references/webhooks-and-idempotency.md` — both directions of at-least-once delivery: verification, dedup, and idempotency keys
- `references/resilience.md` — rate-limit headers, backoff with full jitter, circuit breakers, timeouts, bulkheads, degradation
- `references/contracts-and-promotion.md` — provider-spec validation, the Pact boundary, and the sandbox → production cutover
- `references/standards.md` — the authoritative standards this skill applies — named, version-pinned, and mapped to its workflow
- `templates/integration-readiness-audit.workflow.js` — finder-per-category → dedup barrier → adversarial-verify readiness audit
