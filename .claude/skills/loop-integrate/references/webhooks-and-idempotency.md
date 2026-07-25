# Webhooks and idempotency — at-least-once, in both directions

These are one discipline, not two, which is why they share a file.

The network gives you **at-least-once delivery** and nothing better. When the third party calls you, its retry means your handler may see the same event twice. When you call the third party, your retry means their endpoint may see the same request twice. The defence is identical in both directions — *attach a stable identifier to the message and make the second arrival a no-op* — and it is only ever implemented in the direction someone happened to think about. Implement both.

| | They call you (inbound webhook) | You call them (outbound request) |
|---|---|---|
| Who retries | The provider, on your non-2xx or timeout | Your client, on their 5xx / 429 / timeout |
| The stable identifier | Their **delivery / event id** in the payload or header | **Your** `Idempotency-Key`, generated once per logical operation |
| Who stores the dedup record | **You** | **They** do — you just have to send the key |
| What integrity check protects it | Signature verification (§1) | TLS plus your own auth credential |

## 1. Verifying an inbound webhook

An unauthenticated webhook endpoint is a public write API into your business logic. Verify before you parse, and **verify before you do anything expensive** — signature check first, deserialization second.

**Verify against the raw bytes.** Every scheme signs the exact body as transmitted. If your framework has already parsed JSON and you re-serialize it to check the signature, key ordering or whitespace will differ and verification will fail — or worse, you will "fix" it by disabling the check. Capture the raw body at the framework layer specifically for this.

**Use a constant-time comparison** for the signature. A byte-by-byte early-exit comparison is a timing oracle; language runtimes ship a constant-time equality helper for exactly this.

**Check the timestamp, not just the signature.** A valid signature is valid forever; without a freshness bound, a captured request can be replayed indefinitely. Reject deliveries whose signed timestamp is outside a tolerance window — **five minutes is the common default** — and include the timestamp in the signed payload so it cannot be edited independently. Do not widen the window to paper over clock skew; fix the clock.

**Which scheme to implement:**

- **The provider dictates one → implement theirs.** Stripe sends `Stripe-Signature` with a timestamp and one or more v1 HMAC-SHA256 signatures over `timestamp.payload`, and expects you to tolerate multiple signatures during their own secret rotation. GitHub sends `X-Hub-Signature-256`, an HMAC-SHA256 of the raw body keyed with your webhook secret. Others differ again. Their signature is the one that verifies; there is no negotiating.
- **The provider dictates nothing, or you are designing the contract → Standard Webhooks.** It specifies HMAC-SHA256 with an id, a timestamp, and a versioned signature header, with the replay window built in. Per `standards.md` it is an **industry initiative, not a standards body** — a good vendor-neutral default, cited as practice.
- **Multiple valid secrets during rotation.** Accept any signature that verifies against *any* currently-valid signing secret, so the dual-secret overlap window in `auth-and-secrets.md` §5 works for webhook secrets too.

**Then ack fast.** Return 2xx as soon as the event is durably enqueued — do not run the business logic inline. Providers time out aggressively (single-digit seconds is typical) and treat a timeout as a failed delivery, so slow handlers manufacture duplicates. Enqueue, ack, process asynchronously. Return a non-2xx only when you genuinely want a retry.

## 2. Dedup on the way in

At-least-once means duplicates are normal traffic, not an error condition.

- **Key on the provider's delivery or event id**, not on a hash of the payload. Two genuinely distinct events can be byte-identical (the same user clicked the same button twice); two deliveries of the same event can differ in metadata.
- **Store `deliveryId → processed`** in something durable and shared across instances — a database table with a unique constraint, or a cache with a real persistence guarantee. An in-process set dedups nothing the moment you run two replicas.
- **Set a TTL longer than the provider's entire retry schedule.** If they retry over 72 hours, a 1-hour dedup TTL means their final retry is processed as new. Look up the provider's documented schedule and add margin; several days is a reasonable default.
- **Insert-then-process, not process-then-insert.** Write the dedup record inside the same transaction as the effect, or claim the id with a unique-constraint insert *before* doing the work and release it on failure. The gap between "did the work" and "recorded that I did the work" is where a crash produces the double-processing you built this to prevent.
- **"Exactly-once delivery" is a trap.** It does not exist over an unreliable network — nothing prevents a message from arriving twice, only from *mattering* twice. What you can build is at-least-once delivery plus idempotent processing, whose observable behaviour is exactly-once *effects*. When a provider advertises exactly-once, read it as at-least-once with dedup already applied on their side, and keep your own.

## 3. Ordering is not guaranteed either

Webhooks arrive out of order routinely — parallel delivery workers, one delivery retried while the next succeeds, or genuinely concurrent events. Design handlers that do not care:

- **Fetch current state instead of applying a delta.** On `subscription.updated`, re-read the subscription from the provider's API rather than applying the payload as a patch. The payload becomes a *hint that something changed*; the API is the source of truth. This makes ordering irrelevant and is the single highest-leverage habit in webhook handling.
- **When you must apply the payload directly, carry a version.** Most providers include a sequence number, a version field, or an event timestamp — store it with the record and drop any event older than what you have already applied.
- **Never infer a state machine from arrival order.** `payment.succeeded` arriving before `payment.created` is not a provider bug you should assert against; it is Tuesday.
- **Tolerate the unknown event type.** Providers add event types without asking. Log and ignore anything unrecognized; never 4xx it, or you will drive an infinite retry against your own endpoint.

## 4. When you are the sender

If this system emits webhooks to *its* consumers, you owe them what you expect from your providers. (Designing that public contract in full — payload shape, versioning, subscriber management — is `../../loop-design/references/api-design.md`; this is the delivery mechanics.)

- **Sign every payload**, HMAC-SHA256 over a timestamp-prefixed raw body, with a per-subscriber secret and a signature header that carries a scheme version so you can migrate later.
- **Retry on an exponential, jittered schedule** and publish it, so consumers can size their dedup TTL (§2). Give up after a bounded number of attempts and mark the endpoint unhealthy rather than retrying forever.
- **Keep a delivery log** — event id, endpoint, attempt count, response status, next attempt — and expose it. "Did you send it?" is the first question every consumer asks, and a log answers it without a support ticket.
- **Offer manual replay** from that log. It is the escape hatch that turns a consumer-side outage from an incident into a chore.
- **Emit a stable, unique event id** and never reuse it across retries — that id *is* your consumers' dedup key.

## 5. Idempotency keys on the way out

The mirror image: your retry (§ `resilience.md`) must not create two charges, two orders, or two provisioned accounts.

- **Send an idempotency key on every non-idempotent outbound mutation** — POST creates, action endpoints, anything that costs money or side-effects. `PUT` and `DELETE` are idempotent by definition; `GET` and `HEAD` are safe. `PATCH` usually is *not* idempotent — key it.
- **Generate the key once per logical operation, not per attempt.** A UUID minted inside the retry loop is worthless: each retry gets a fresh key and the provider sees distinct requests. Mint it where the operation is decided, persist it with the operation record, and reuse it across every attempt — including attempts in a later process after a crash.
- **Use the provider's header name.** Most large platforms use `Idempotency-Key`; some differ. The vendor-neutral description of the pattern is `draft-ietf-httpapi-idempotency-key-header-07`, which per `standards.md` is an **expired Internet-Draft**: cite it as a lapsed proposal that formalized existing Stripe/PayPal-style practice, never as a ratified requirement. The practice is real and widely deployed; the document is stale.
- **Understand what the provider does with it.** They store `key → (status, response)` scoped to the endpoint and your credential, and replay the stored response on a retry with the same key. Two consequences: a retry returns the *original* status (a replayed create returns 201, not 409), and sending the same key with a *different* body is a caller error the provider will reject — typically 409 or 422 — not a way to amend a request.
- **Scope and TTL.** Keys are scoped per endpoint and per credential, and providers expire them (24 hours is typical). A retry attempted after the key expires is a *new* request and will duplicate. Bound your total retry window inside the provider's key lifetime, and for anything longer, reconcile by querying the provider for the resource instead of retrying blind.
- **When the provider offers no idempotency mechanism at all**, do not retry non-idempotent calls automatically. Either make the call safe by querying-then-creating with a natural unique key of your own, or surface the failure for a human. Silent retries against a non-idempotent endpoint are the double-charge bug.

## Boundary note

This file owns the **mechanics** — verification, dedup, ordering, keys. Whether the signing secret used here leaked into source control is a scanning question and belongs to `loop-review`; the secret's *lifecycle* — where it is minted, stored, and rotated — is `auth-and-secrets.md` §5. The retry policy that *sends* these keyed requests is `resilience.md`.
