# Auth and secrets — getting a credential, and keeping it alive

This file covers the whole life of a third-party credential: which grant produces it, what the current security BCP forbids, how long the tokens live, where the long-lived secret is minted, and how it gets rotated without an outage. All standards cited here are pinned in `standards.md` — do not cite an RFC number from memory.

The boundary that matters throughout: **this file owns the credential's lifecycle.** Whether a credential accidentally got committed to source is a *scanning* question and belongs to `../../loop-review/references/standards.md` and its secrets playbook. Both files point at the same OWASP Secrets Management Cheat Sheet; neither restates the other.

## 1. Grant selection

Pick from the provider's *supported* grants, then take the most restrictive one that does the job. Almost every real integration is one of the first two rows.

| Situation | Grant | Why, and what you get |
|---|---|---|
| Acting **on behalf of a user** of the third party — reading their repos, posting to their account, pulling their transactions | **Authorization code + PKCE** | The user consents in the provider's UI; you receive a code, exchange it server-side for an access token scoped to *that user*. The only grant that produces a per-user token with a consent record. PKCE is mandatory — see §2. |
| **Your service to their service**, no end user in the loop — a batch job, a server-side API key exchange, a machine-to-machine sync | **Client credentials** | Your `client_id` + `client_secret` (or a signed JWT assertion) buys an access token representing *your application*. There is no refresh token and there does not need to be: re-request when it expires. Simplest correct choice for backend integrations. |
| An **input-constrained client** — a CLI, a TV app, a device with no browser or keyboard | **Device authorization grant** | Your device shows a short code; the user completes consent on a phone or laptop; your device polls the token endpoint. Reach for this only when a redirect genuinely cannot happen. |
| You need to know **who the user is**, not just act for them — SSO, "sign in with", provisioning a local account from the provider's identity | **Authorization code + PKCE, with OIDC scopes** (`openid`, plus `profile`/`email` as needed) | Adds an **ID token** — a signed JWT asserting the user's identity — alongside the access token. |
| A plain **API key** is all the provider offers | Not an OAuth grant at all | Treat it as a bearer secret: scope it, put it in an `Authorization` header (never in a URL — URLs leak into logs, proxies, and browser history), and give it the same lifecycle discipline as a client secret in §5. |

**Do not request an ID token by reflex.** The ID token is for *authenticating a person*; the access token is for *calling an API*. An integration that only needs to call the API and asks for `openid` scope has widened its consent screen and its data footprint for nothing. Conversely, never derive identity from an access token — access tokens are for the resource server, are frequently opaque, and carry no audience guarantee for you.

**Validating an ID token** (when you took one): verify the signature against the provider's published JWKS, then check `iss` matches the provider's issuer exactly, `aud` contains your client id, `exp`/`iat` are within tolerance, and the `nonce` matches the one you sent. A JWT you decoded but did not verify is a user-controlled string.

## 2. The RFC 9700 checklist, applied

RFC 9700 (Jan 2025) is the current OAuth 2.0 Security Best Current Practice and supersedes the RFC 6819 threat model. Run this list against every flow you write; each item is a checkable yes/no.

- **PKCE on every authorization-code flow — including confidential clients.** This is the item most often skipped, because the folklore is "PKCE is for mobile and SPAs." RFC 9700 extends it to confidential clients too: PKCE binds the authorization code to the client that requested it and defeats code injection and code-interception attacks regardless of whether the client can keep a secret. Use `S256`; never `plain`.
- **Resource Owner Password Credentials grant: banned.** Collecting the user's third-party password in your own UI defeats the entire point of delegated authorization and trains users to phish themselves. If a provider still offers it, that is not permission to use it.
- **Implicit grant: banned.** Tokens in the URL fragment leak through history, referrers, and logs. Authorization code + PKCE replaces it in every case, including browser-only apps.
- **Redirect URIs are exact-match allow-listed** at the provider's app registration. No wildcards, no open-ended subpaths, no `localhost` entries left in a production registration. Open-redirect on a registered URI is how an authorization code is stolen.
- **`state` on every authorization request**, cryptographically random, single-use, bound to the user's session. It is CSRF protection for the callback; PKCE does not replace it.
- **Bind the token to a sender where the provider supports it** — mTLS-bound tokens or DPoP. Not always available; when it is, it converts a stolen bearer token from "fully usable" to "useless without the key."
- **Never accept an access token issued to somebody else.** If you are also *receiving* tokens, check the audience. If you are only sending them, make sure you do not forward a token to a different provider than the one that issued it — token-forwarding across services is how a scope escapes its intended resource server.
- **Scope minimization.** Ask for the narrowest scope set that makes the feature work, and re-check it when the feature shrinks. Scopes granted at integration time tend to outlive the code that needed them.

## 3. Token lifecycle at runtime

- **Access tokens are short-lived and disposable.** Minutes to an hour is normal. Cache them in memory keyed by (provider, principal, scope set) with an expiry margin — refresh at ~80% of lifetime rather than waiting for the first 401, so a token expiry never becomes a user-visible error.
- **Handle the 401 anyway.** Clock skew and provider-side revocation both produce an unexpected 401. The correct handler is: refresh once, retry the call once, and if it fails again, surface it — **not** an unbounded refresh loop. A refresh storm against an auth endpoint looks exactly like an attack and will get you rate-limited (see `resilience.md`).
- **Refresh-token rotation.** Where the provider rotates refresh tokens on use, you must persist the new one atomically with the exchange; a crash between "used the old token" and "stored the new token" locks the integration out permanently and requires a human to re-consent. Write the new token before you acknowledge the request that triggered the refresh, and serialize refreshes per principal so two concurrent requests do not race and burn each other's token.
- **Revocation is a feature you owe the user.** Support disconnecting the integration: call the provider's revocation endpoint, then delete the local tokens. Deleting your copy without revoking leaves a live grant with nobody watching it.
- **Never log a token, a code, or a refresh token** — not at debug level, not in a request dump, not in an error report to a third-party monitoring service. Redact at the HTTP-client layer so it cannot be reintroduced by a new call site.

## 4. Where the long-lived secret comes from

Access tokens are minted by code; the credentials that mint them are minted by a *human clicking around a provider dashboard*, and that step is where sandbox/production hygiene is won or lost.

- **One app registration per environment, always.** A separate registration for sandbox and for production, each with its own client id, client secret, redirect URIs, webhook endpoint, and signing secret. Sharing a registration across environments means a staging bug can act on production data and a leaked staging secret is a production incident.
- **Registrations are configuration, not code.** Record for each environment: client id, secret's location in the secrets manager (not the secret), registered redirect URIs, granted scopes, webhook endpoint URL, webhook signing-secret location, and the provider's API version pin. This inventory is what `contracts-and-promotion.md`'s promotion checklist walks.
- **Name the owner.** Provider dashboards issue credentials against an *account* — frequently an individual's. A client secret tied to a departed employee's personal account is a scheduled outage. Register through a shared organizational account or the provider's team/org construct.
- **Sandbox credentials are still secrets.** They are lower blast radius, not zero: sandbox environments often mirror production schemas and sometimes contain real data copied in by a well-meaning engineer.

## 5. Storage, rotation, and blast radius

**Storage.** Long-lived secrets live in a secrets manager (the one this repo already uses — match, do not introduce a second), injected at runtime as environment variables or fetched by a workload identity. Never in the repo, never in a `.env` committed by accident, never in a container image layer, never in CI logs. If a secret ever *did* reach source control, rotating it is necessary and not sufficient — the git history still holds it, and that cleanup path is `loop-review`'s.

**Rotation without downtime — the dual-secret overlap window.** The failure mode to design against is that you cannot atomically swap a credential across every running process. The overlap window solves it:

1. **Add** a second credential at the provider while the first is still valid. Most providers support two live secrets or keys precisely for this; if yours does not, that limitation is a risk to record now, because rotation then requires a brief coordinated cutover.
2. **Deploy** the new secret to the secrets manager and roll the fleet so every instance can use it. Both credentials work; traffic is mixed.
3. **Verify** the new credential is actually in use — a successful call attributable to the new key, not merely a green deploy.
4. **Revoke** the old credential at the provider, then delete it from the secrets manager. Revoke first: a deleted-but-not-revoked secret is a live credential nobody is tracking.

Rotate on a schedule derived from the credential's cryptoperiod (NIST SP 800-57 Part 1 Rev. 5) and **immediately, out of band, on any suspected exposure** — a departed employee with dashboard access, a secret in a log, a compromised CI runner.

**Blast radius by credential type** — this is what sets rotation urgency and how loudly a finding gets reported:

| Credential | If leaked, an attacker can… | Rotation urgency |
|---|---|---|
| **OAuth client secret** | Impersonate your *application* — mint client-credentials tokens, and, combined with an open redirect, exchange stolen authorization codes for user tokens. The widest radius: it reaches every user who ever consented. | Immediate. Treat as a full incident. |
| **API key** | Act as your account, at your account's scopes, until revoked. Usually bounded by whatever scoping the provider allows and by spend limits — often none. | Immediate. |
| **Webhook signing secret** | **Forge inbound events** your system will accept as genuine — fake payment confirmations, fake user-provisioning events. Easy to underrate because it grants no *outbound* access; it grants write access to your business logic. | Immediate, and re-verify that handlers are idempotent (`webhooks-and-idempotency.md`), because forged replays are the natural follow-up. |
| **User access / refresh token** | Act as one specific user until expiry or revocation. Narrowest radius, but the most sensitive data per token. | Revoke the affected grants; re-consent that user. |
| **Sandbox credential of any kind** | Reach sandbox data and any production data mistakenly mirrored there. | Same procedure, lower priority — unless the sandbox holds real data, in which case it is not a sandbox. |
