// Template: INTEGRATION READINESS AUDIT — finder-per-category → dedup barrier → adversarial verify.
// A specialization of loop-review/templates/security-review.workflow.js: same shape (finder per
// lens → dedup barrier → skeptic per survivor), with loop-integrate's four readiness categories,
// an "is this already handled elsewhere?" refutation instead of a source→sink refutation, and a
// separate hand-off list for security-flavoured survivors (SKILL.md §8 — loop-review scores those,
// not this workflow).
//
// Invoke with: Workflow({ script, args: { target: "...", provider: "...", scope: "...", mode: "optimize" } })
// input.target   — what to audit: a path, a module, a diff, or a whole service.
// input.provider — the third party being integrated; anchors every finder prompt.
// input.scope    — one-line scope note (e.g. "only the billing adapter and its webhook route").
// input.mode     — 'optimize' (default) | 'full'. Parsed by loop-engine, never by this script.

export const meta = {
  name: 'integration-readiness-audit', // EDIT ME
  description: 'Fan out one finder per integration readiness category, dedup across lenses, then adversarially verify each surviving gap is not already handled elsewhere', // EDIT ME
  phases: [
    { title: 'Find', detail: 'one finder per readiness category from the loop-integrate references' },
    { title: 'Verify', detail: 'skeptics per deduped gap, prompted to prove it is already handled' },
  ],
}

// Some harnesses deliver args as a JSON-encoded string — normalize before use.
const input = typeof args === 'string' ? JSON.parse(args) : args

// Canonical ROUTES block — single source of truth: loop-engine/references/execution-modes.md §M8.
// Duplicated verbatim into every template that sets model or effort. H10 gives scripts no module
// access, so duplication is intentional; drift is a defect (see CONTRIBUTING's ROUTES grep).
const MODE = (input && input.mode) === 'full' ? 'full' : 'optimize'
const PLANNER = (input && input.planner) === 'fable' ? 'claude-fable-5' : null // --planner fable (§M7)
const ROUTES = {
  optimize: {
    scout:      { model: 'claude-haiku-4-5', effort: null },   // Haiku has no effort dial — omit, never 'low'
    doc:        { model: 'claude-haiku-4-5', effort: null },
    implement:  { model: 'claude-sonnet-5',  effort: 'high' },
    analyze:    { model: null,               effort: 'high' }, // null model = omit, inherit session (H8)
    synthesize: { model: null,               effort: 'high' },
    verify:     { model: null,               effort: 'high' },
    judge:      { model: null,               effort: 'high' },
    critic:     { model: null,               effort: 'high' },
    gating:     { model: 'claude-opus-5',    effort: 'max' },  // pinned even in optimize
    planner:    { model: 'claude-opus-5',    effort: 'xhigh' },// pinned even in optimize
  },
  full: {
    scout:      { model: 'claude-opus-5', effort: 'high' },
    doc:        { model: 'claude-opus-5', effort: 'high' },
    implement:  { model: 'claude-opus-5', effort: 'high' },
    analyze:    { model: 'claude-opus-5', effort: 'xhigh' },
    synthesize: { model: 'claude-opus-5', effort: 'xhigh' },
    verify:     { model: 'claude-opus-5', effort: 'xhigh' },
    judge:      { model: 'claude-opus-5', effort: 'xhigh' },
    critic:     { model: 'claude-opus-5', effort: 'xhigh' },
    gating:     { model: 'claude-opus-5', effort: 'max' },
    planner:    { model: 'claude-opus-5', effort: 'max' },
  },
}
const routeFor = (kind) => (ROUTES[MODE] && ROUTES[MODE][kind]) || ROUTES[MODE].analyze
const WIDTH = (kind) => (MODE === 'full' ? (kind === 'gating' ? 5 : 3) : 1)
function optsFor(node, label) {
  const r = routeFor(node.taskType)
  const opts = { label: label || node.label, phase: node.phase, schema: node.schema }
  if (r.model) opts.model = r.model     // omit → inherit session model (H8)
  if (r.effort) opts.effort = r.effort  // omit → inherit session effort
  if (PLANNER && node.taskType === 'planner') opts.model = PLANNER // §M7 override — planner nodes only
  return opts
}
// The block above is byte-identical to §M8 except for the one line §M8 explicitly says to drop:
// `DRY_LIMIT` is omitted because this template has no loop stage. `WIDTH` is kept — the Verify
// stage below resolves its lens count from it. Every line that IS here is verbatim; drift on any
// of them is a defect (see CONTRIBUTING's ROUTES grep), and §M8 is the single source of truth.
// No plannerAgent: no node in this template carries taskType 'planner', so §M8's third
// optional member is dropped too. `PLANNER` and its `optsFor()` line stay — they are invariant
// core, and the flag is simply inert here.

// One finder per readiness category, mapped 1:1 onto loop-integrate's references (H4: diversity
// beats redundancy — each finder hunts a DIFFERENT failure class, not the same code four times).
// EDIT ME: drop a category that cannot apply to this target (no inbound webhooks, no OAuth) and
// log the trim below rather than running an empty finder.
const FINDERS = [
  {
    key: 'auth-and-secrets',
    fix: 'references/auth-and-secrets.md',
    prompt:
      'Auth and credential lifecycle. Look for: an authorization-code flow without PKCE (RFC 9700 requires it on ' +
      'confidential clients too); Resource Owner Password Credentials or Implicit grants; missing or wildcard ' +
      'redirect-URI allow-listing; a missing or unvalidated `state`; ID tokens accepted without signature/iss/aud/exp ' +
      'validation; tokens, codes or refresh tokens written to logs; long-lived access tokens; a refresh path that can ' +
      'lose a rotated refresh token on crash; unbounded refresh-retry loops; over-broad scopes; a credential read from ' +
      'a config file or constant rather than a secrets manager; one app registration shared across sandbox and prod; ' +
      'no rotation path for a client secret, API key, or webhook signing secret.',
  },
  {
    key: 'webhooks-and-idempotency',
    fix: 'references/webhooks-and-idempotency.md',
    prompt:
      'At-least-once delivery in both directions. Inbound: a webhook route with no signature verification; ' +
      'verification against a re-serialized body instead of the raw bytes; a non-constant-time signature comparison; ' +
      'no timestamp-tolerance replay window; business logic run inline before the 2xx ack; no delivery-id dedup store, ' +
      'an in-process-only dedup set, a dedup TTL shorter than the provider retry schedule, or a process-then-record ' +
      'ordering that loses the record on crash; handlers that assume event ordering or 4xx an unknown event type. ' +
      'Outbound: a non-idempotent POST/PATCH retried with no idempotency key, or a key generated inside the retry loop ' +
      'rather than once per logical operation.',
  },
  {
    key: 'resilience',
    fix: 'references/resilience.md',
    prompt:
      'Resilience to a dependency we do not control. Look for: an outbound call with no explicit connect and read ' +
      'timeout; retries with no backoff, with fixed backoff, or with only partial jitter rather than full jitter; ' +
      'retries on non-retryable 4xx; `Retry-After` ignored on 429/503; rate-limit headers unread so throttling is ' +
      'purely reactive; nested retry layers multiplying attempts; no global retry budget; no circuit breaker, or one ' +
      'tripping on consecutive-error counts or on 4xx rather than a failure rate over a rolling window; a half-open ' +
      'state that admits all queued traffic instead of a bounded probe; no per-dependency connection-pool or ' +
      'concurrency bulkhead; no defined degradation behaviour when the provider is unavailable.',
  },
  {
    key: 'contracts-and-promotion',
    fix: 'references/contracts-and-promotion.md',
    prompt:
      'Contract trust and environment promotion. Look for: no vendored provider spec, or one pinned to a version the ' +
      'provider no longer serves; a generated client edited in place, or used directly by domain code with no adapter; ' +
      'no drift check against the provider spec or changelog; fixtures recorded from production, unredacted, or never ' +
      're-recorded; a Pact-style consumer contract that no provider CI actually verifies; sandbox and production ' +
      'endpoints or credentials selected by anything other than configuration; a hardcoded sandbox or production ' +
      'endpoint; production credentials reachable from a sandbox code path or vice versa; no feature-flagged cutover; ' +
      'no compensating action documented for side effects a rollback cannot undo.',
  },
]

// Finders return raw candidate gaps — their final text is a return value, not prose (H3).
const GAPS_SCHEMA = {
  type: 'object',
  properties: {
    gaps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          gapType: { type: 'string' }, // stable slug, e.g. "missing-pkce", "unverified-webhook-signature"
          title: { type: 'string' }, // short human name for the gap
          detail: { type: 'string' }, // what is missing here and what breaks in production because of it
          location: { type: 'string' }, // file:line or file:symbol
          citation: { type: 'string' }, // the references/standards.md entry that governs it
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          securityFlavored: { type: 'boolean' }, // true = a security defect for loop-review, not a readiness gap
          confidence: { type: 'number' }, // finder's prior; the verify stage sets the real gate
        },
        required: ['gapType', 'title', 'detail', 'location', 'citation', 'severity', 'securityFlavored', 'confidence'],
      },
    },
  },
  required: ['gaps'],
}

// Adversarial verdict: the skeptic hunts for an EXISTING mitigation and defaults to not-a-gap (H4).
const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    isGap: { type: 'boolean' }, // true only if no existing mitigation was found anywhere
    confidence: { type: 'number' }, // 0..1 — how sure the skeptic is in isGap
    evidence: { type: 'string' }, // the mitigation found, or why the search came up empty
  },
  required: ['isGap', 'confidence', 'evidence'],
}

// Refutation lenses — the places an integration concern is usually already handled centrally.
const LENSES = [
  'a shared HTTP client, interceptor, or middleware layer applied to every outbound call',
  'an existing retry / circuit-breaker / auth wrapper, decorator, or SDK default around this call site',
  'a platform-level control outside the application: API gateway, service mesh, sidecar, or provider dashboard setting',
]

// A survivor must clear this bar; an "inconclusive" verdict counts as not-a-gap by design.
const MIN_CONFIDENCE = 0.8

const target = (input && input.target) || 'the integration in this repository'
const provider = (input && input.provider) || 'the third-party provider'
const scope = (input && input.scope) || 'as given by the target'

// BARRIER (harness policy H2). The four category finders are NOT independent partitions of the
// codebase: one underlying defect surfaces from several lenses at once. "No idempotency key on this
// outbound POST" is reported by the webhooks-and-idempotency finder (safe-retry semantics) AND by
// the resilience finder (which is inspecting retry safety on the same call site); a hardcoded
// production endpoint is reported by both contracts-and-promotion and auth-and-secrets. Stage 2
// therefore needs the FULL candidate set from every finder at once to collapse duplicates on
// location+gapType BEFORE the expensive verify stage runs skeptics per survivor — verifying one gap
// twice under two names wastes agents and can return a contradictory verdict pair with no tiebreak.
// The barrier also buys the H2-blessed early exit: zero survivors means skip Verify entirely.
// Same shape and same justification as loop-review/templates/security-review.workflow.js.
log(`[mode=${MODE}] scanning ${target} against ${provider} across ${FINDERS.length} readiness categories`)
const sweeps = await parallel(
  FINDERS.map((f) => () =>
    agent(
      `Integration readiness audit.\nTarget: ${target}\nProvider: ${provider}\nScope: ${scope}\n\n` +
        `${f.prompt}\n\n` +
        `Report ONLY gaps you can point at a concrete location for. A pattern you dislike is not a gap. ` +
        `Set securityFlavored=true when the finding is really a security defect (a credential hardcoded in ` +
        `source, a missing authorization check) rather than an integration-readiness gap — those are handed to ` +
        `loop-review and are NOT scored here. Cite the governing entry from references/standards.md, naming any ` +
        `draft or expired status honestly. Return raw data conforming to the schema.`,
      optsFor(
        { taskType: 'analyze', phase: 'Find', schema: GAPS_SCHEMA },
        `find:${f.key}`,
      ),
    ),
  ),
)

// .filter(Boolean): a skipped or dead finder resolves to null (harness policy H5).
const returned = sweeps.filter(Boolean)
if (returned.length < FINDERS.length) {
  log(`WARNING: ${FINDERS.length - returned.length} finder(s) returned nothing — their categories are UNAUDITED`) // no silent gaps (H6)
}
const fixFor = new Map(FINDERS.map((f) => [f.key, f.fix]))
// Tag each gap with its finder's category by the ORIGINAL index — `returned` is compacted, so
// indexing it against FINDERS would mislabel every category after a dead finder.
const all = sweeps.flatMap((s, i) => (s && s.gaps ? s.gaps.map((g) => ({ ...g, category: FINDERS[i].key })) : []))

// Dedup in plain JS — never spend an agent on it (loop policy L3). Key on location+gapType so the
// same underlying gap seen through two category lenses collapses before the expensive verify.
const key = (g) => `${g.location}::${g.gapType}`
const byKey = new Map()
for (const g of all) {
  const seen = byKey.get(key(g))
  if (!seen) {
    byKey.set(key(g), { ...g, alsoSeenBy: [] })
  } else {
    // Keep the FIRST reporter as the owner. FINDERS is ordered to match the reference files, so
    // the first category to see a gap is the one whose reference carries its fix pattern; letting
    // a later lens overwrite it would point the report at the wrong remediation.
    seen.alsoSeenBy.push(g.category)
    log(`merged duplicate: ${g.gapType} @ ${g.location} — also reported by ${g.category}, owner stays ${seen.category}`) // H6
  }
}
const deduped = [...byKey.values()]
log(`${all.length} raw candidates from ${returned.length} finders → ${deduped.length} after dedup on location+gapType`)

// Early exit: the other legitimate use of the barrier (H2). Nothing to verify.
if (deduped.length === 0) {
  return { confirmed: [], handoffToReview: [], note: `no candidate readiness gaps in ${target} from any category` }
}

// Adversarial verify (H4): skeptics prompted to REFUTE by finding an existing mitigation. Width is
// mode-resolved (§M5): 1 in optimize, 3 diverse lenses in full. A gap dies at ⌈W/2⌉ kill votes —
// computed, never a literal, because a literal is silently wrong the moment width becomes 5.
const W = WIDTH('verify')
const KILL_AT = Math.ceil(W / 2)
log(`verifying ${deduped.length} candidates × ${W} lens(es) — a gap dies at ${KILL_AT} kill vote(s)`)
const verdicts = await parallel(
  deduped.flatMap((g, gi) =>
    Array.from({ length: W }, (unused, li) => () =>
      agent(
        `You are a skeptical reviewer trying to REFUTE a reported integration-readiness gap by showing it is ` +
          `ALREADY HANDLED. Search the codebase yourself; do not trust the finder.\n\n` +
          `Gap: ${g.title} [${g.gapType}, category=${g.category}, severity=${g.severity}]\n` +
          `Location: ${g.location}\n` +
          `Claimed problem: ${g.detail}\n` +
          `Provider: ${provider}\n\n` +
          `Look specifically at ${LENSES[li % LENSES.length]}.\n\n` +
          `Set isGap=true ONLY if you searched and found no mitigation covering this call site. If a mitigation ` +
          `exists, or you are unsure, set isGap=false — an inconclusive search means NOT A GAP. Report your ` +
          `confidence in isGap as 0..1 and name the mitigation you found, or what you searched and did not find.`,
        optsFor(
          { taskType: 'verify', phase: 'Verify', schema: VERDICT_SCHEMA },
          `verify:${g.gapType}@${g.location}#${li + 1}`,
        ),
      ).then((v) => ({ gapIndex: gi, lens: li, verdict: v })),
    ),
  ),
)

// .filter(Boolean) again (H5) — then tally kill votes per candidate.
const votes = verdicts.filter(Boolean)
if (votes.length < deduped.length * W) {
  log(`WARNING: ${deduped.length * W - votes.length} verify agent(s) returned nothing — those lenses cast no vote`)
}
const tally = deduped.map(() => ({ kills: 0, cast: 0, reasons: [] }))
for (const v of votes) {
  const t = tally[v.gapIndex]
  t.cast += 1
  // "Inconclusive counts as not-a-gap": a low-confidence isGap=true is a kill vote, by design.
  if (!v.verdict.isGap || v.verdict.confidence < MIN_CONFIDENCE) {
    t.kills += 1
    t.reasons.push(`lens ${v.lens + 1}: ${v.verdict.evidence}`)
  }
}

const survivors = deduped.filter((g, i) => tally[i].cast > 0 && tally[i].kills < KILL_AT)
const dropped = deduped.filter((g, i) => !(tally[i].cast > 0 && tally[i].kills < KILL_AT))
log(`${survivors.length}/${deduped.length} gaps survived adversarial verification at confidence ≥ ${MIN_CONFIDENCE}`)
for (const g of dropped) {
  const t = tally[deduped.indexOf(g)]
  log(`dropped ${g.gapType} @ ${g.location} — ${t.kills}/${t.cast} kill votes: ${t.reasons.join(' | ') || 'no verdict cast'}`) // H6
}

// Report split (SKILL.md §8): security defects are handed to loop-review, never re-scored here.
const withFix = (g) => ({ ...g, fixReference: fixFor.get(g.category) || 'references/standards.md' })
const confirmed = survivors.filter((g) => !g.securityFlavored).map(withFix)
const handoffToReview = survivors.filter((g) => g.securityFlavored).map(withFix)
log(`report: ${confirmed.length} readiness gap(s), ${handoffToReview.length} security finding(s) handed to loop-review`)

return {
  confirmed,
  handoffToReview,
  note: `${target} audited against ${provider} across ${returned.length}/${FINDERS.length} categories in ${MODE} mode`,
}
