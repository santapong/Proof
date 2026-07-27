# Resilience — surviving a dependency you do not control

The provider will throttle you, time out, return a 503, and one day be down for an hour. None of that is preventable from your side. What *is* under your control is whether their bad ten minutes becomes your bad afternoon — and the default behaviour of an unguarded HTTP client is to make it worse, because naive retries add load to a system that is already failing.

Everything here is **build-time design**: does the retry, backoff, breaker, timeout, and fallback logic exist, and is it tuned to this provider's documented limits. Watching a live dependency's error budget and paging a human is `loop-operate`'s job, not this file's.

## 1. Read the rate-limit headers before you guess

Providers tell you their limits in response headers. Honouring them is cheaper than discovering them by getting blocked.

**Reactive — `Retry-After`.** On a **429 Too Many Requests** or a **503 Service Unavailable**, `Retry-After` carries either a delay in seconds or an HTTP-date. **When it is present, it wins over your computed backoff, always** — it is the server telling you when it will be ready, and racing it just burns quota. Clamp it defensively (a 24-hour `Retry-After` should fail the operation over to a queue rather than parking a thread for a day) and add a small jitter on top so a fleet told "retry in 30s" does not stampede in the same millisecond.

**Proactive — `RateLimit` and `RateLimit-Policy`.** These are specified in **`draft-ietf-httpapi-ratelimit-headers-11` (23 May 2026), an active IETF Internet-Draft — not an RFC** (see `standards.md`). `RateLimit-Policy` advertises the quota and window; `RateLimit` reports what remains in the current window and when it resets. Used properly they let you slow down *before* being throttled: when remaining quota drops below a threshold, throttle non-urgent work, shed batch traffic, and let interactive requests through. Two cautions — the field syntax has changed across draft revisions, so parse defensively and treat a malformed header as absent; and many providers still ship the older `X-RateLimit-*` conventions or bespoke names, so read the provider's docs and normalize into one internal shape at the HTTP-client layer.

> **Never cite RFC 9331 for any of this.** RFC 9331 is the ECN protocol for L4S — transport-layer congestion control, unrelated to HTTP. `standards.md` records why this warning exists.

**Client-side throttling.** A token bucket in front of the client, sized just under the provider's published quota, converts "we get 429s under load" into "we queue under load" — a far better failure mode, and one that keeps the breaker in §3 from tripping on self-inflicted throttling.

## 2. Retry, with full jitter

**Retry only what is safe to retry.** In order of precedence:

1. **Never auto-retry a non-idempotent call without an idempotency key.** That is not resilience, it is a double charge. `webhooks-and-idempotency.md` §5 covers the key.
2. **Retry** on connection failures, request timeouts, `429`, and `5xx` **except** those the provider documents as permanent.
3. **Do not retry other `4xx`.** A 400, 401, 403, or 422 will fail identically on the next attempt; retrying converts a clear error into a slow, expensive, identical error. (A single retry after a token refresh on a 401 is the one exception — `auth-and-secrets.md` §3.)

**Backoff with full jitter is the default.** The formula, from the AWS "Exponential Backoff and Jitter" post (Marc Brooker, 2015; `authoritative: false` per `standards.md`):

```
delay = random_uniform(0, min(cap, base * 2 ** attempt))
```

with `base` around 100–200 ms, `cap` a couple of seconds, and a bounded attempt count — typically 3 to 5 for an interactive path.

**Why full jitter and not "exponential backoff" alone:** unjittered backoff *synchronizes* clients. A provider blip fails a thousand in-flight calls at roughly the same instant; every one of them sleeps exactly 200 ms, then exactly 400 ms, and the provider — which is trying to recover — is hit by a thousand simultaneous requests at each step. The retries themselves keep it down. Drawing the delay uniformly from `[0, backoff)` spreads that same load across the interval and lets the dependency recover. The common half-measure of "exponential backoff plus a few percent of jitter" preserves most of the synchronization; **draw from the full interval.**

**Bound retries globally, not just per call.** A per-call cap of 3 still means a fleet-wide 3× amplification exactly when the provider can least afford it. A **retry budget** — allow retries only while they are under a small fraction, on the order of 10%, of successful request volume in a rolling window — caps total amplification regardless of how many calls are failing at once. Without it, retry policy is a load multiplier with no ceiling.

**Never retry inside a retry.** A retrying HTTP client called by a retrying service method called by a retrying job produces 125 attempts from three innocuous-looking "3 attempts" settings. Decide the one layer that owns retries for this dependency and make every other layer pass failures through.

## 3. Circuit breaker

Retries handle a *transient* failure. A circuit breaker handles a *sustained* one, by failing fast instead of queueing work against a dependency that is down. The state machine and vocabulary are Nygard's, from *Release It!* 2nd ed. (2018).

| State | Behaviour | Leaves when |
|---|---|---|
| **Closed** | Calls pass through; failures are counted | The failure rate over a rolling window crosses the threshold → **Open** |
| **Open** | Calls fail immediately without touching the network, returning the fallback from §5 | The cooldown elapses → **Half-open** |
| **Half-open** | A small number of probe calls are admitted | A probe succeeds → **Closed** (counters reset); a probe fails → **Open** (cooldown restarts, often lengthened) |

**Tune the thresholds to the provider's documented SLA, not to round numbers.** A provider that publishes 99.9% availability has an expected background error rate; a breaker that trips at "5 consecutive errors" will flap against normal noise. Prefer a **failure *rate* over a rolling window with a minimum request volume** ("≥20 requests in the window and >50% failing") so a quiet endpoint cannot trip the breaker on two unlucky calls. Cooldown should be at least the provider's typical recovery time — start around 30 seconds and calibrate from real incidents.

**Half-open must be strictly limited.** Admit **one** probe, or a small fixed number, and hold every other caller in the open state until the probe resolves. A half-open state that lets all queued traffic through is not a probe, it is the thundering herd again — and it will re-trip the breaker on a dependency that was one request away from recovering.

**One breaker per dependency, and usually per operation class.** A single breaker across a provider's whole API means a failing report-generation endpoint blocks the healthy payment endpoint. Split by endpoint group where their failure modes and latency profiles genuinely differ.

**Count only dependency failures.** Timeouts, connection errors, and 5xx trip the breaker. A 400 or a 404 is *your* bug or a normal negative result and must not — otherwise a burst of validation errors takes the integration offline.

## 4. Timeout budgets and bulkheads

**Every outbound call has an explicit timeout.** Language and library defaults are frequently *no timeout at all*, which converts a provider hang into an exhausted connection pool, then an exhausted thread pool, then an outage in a service that was only tangentially involved. Set connect and read timeouts separately; a connect timeout should be short (a second or two), a read timeout sized from the provider's real p99 latency plus margin — not from optimism.

**Budget downward through the call chain.** If an inbound request has a 3-second budget, and you have already spent 1.2 seconds, the remaining call gets 1.8 seconds *minus* what you need to render a response — not its own independent 3-second timeout. Propagate the remaining budget explicitly (a deadline in the request context) so a downstream call cannot outlive the caller that is waiting for it. **The retry budget lives inside the time budget**: three attempts at 2 seconds each inside a 3-second deadline means attempts two and three are wasted work whose result nobody will read.

**Bulkhead each dependency.** Give every external provider its own connection pool and its own concurrency limit, sized so that provider going slow cannot consume all available capacity. This is what stops "the analytics vendor is slow" from taking down checkout. Where the platform allows it, isolate the thread or task pool too. The concurrency cap is also your last line of defence against a runaway retry loop.

## 5. Degrade on purpose

Decide, *per call site and in advance*, what happens when the dependency is unavailable. Undecided means "throw a 500 at the user", which is a decision made by omission.

- **Serve stale.** Cache the last good response with a generous stale-while-error window. For reference data — pricing, catalogues, feature entitlements — a five-minute-old answer beats an error every time.
- **Queue and reconcile.** For writes that need not be synchronous, durably enqueue the operation (with its idempotency key already minted) and drain it when the breaker closes. This is the standard answer for anything the user has already been told succeeded.
- **Fall back to a reduced feature.** Skip enrichment, hide a panel, use a default. Make it visible in the UI rather than silently wrong.
- **Fail fast and say so.** For a payment, failing fast with a clear message is correct; queueing a charge the user does not know about is not.
- **Never let a non-critical dependency fail a critical path.** If the fraud-scoring vendor is down and your policy is "score-on-best-effort", the checkout must complete. Write that policy down next to the call site — it is exactly the sort of decision that gets reversed by a well-meaning refactor.

## Boundary note

This file is **build-time resilience design** — whether the patterns exist and whether their thresholds match the provider's documented behaviour. The steady-state side — SLIs and SLOs over the dependency, burn-rate alerting, paging, and the on-call response when the breaker is open in production — belongs to `loop-operate`. When an integration is failing right now and nobody knows why, that is `loop-debug`. And the general reliability targets this integration must fit inside are `../../loop-design/references/nfr.md`.
