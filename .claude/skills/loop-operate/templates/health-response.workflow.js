// Template: HEALTH RESPONSE — correlate → EARNED BARRIER → match → remediate → verify →
// escalate-or-close. A specialization of the loop-engine parallel fan-out pattern with
// loop-operate's material pre-wired: references/slo-model.md (burn rate), references/alerting.md
// (the firing rules and the dedup requirement), references/runbooks.md (anatomy, the rung-gated
// eligibility table, the per-target lock), references/on-call-triage.md (severity and the handoff
// contract), references/autonomy-and-rollback.md (the rung mapping and the audit trail).
//
// TRIGGER — read this before deploying it. This script is started by an EXTERNAL monitoring
// system's alert webhook, via an Action or a headless invocation. It is NOT a scheduled poll:
// Cloud Routines have a 1-hour minimum interval and cannot serve sub-minute health response
// (autonomy-and-rollback.md §1). That runner is a documented wiring gap the operator supplies.
//
// SHAPE — why this is a parallel-fan-out-then-pipeline and not something else:
//   * The ONE barrier after Correlate is earned on BOTH of H2's grounds (see its comment).
//   * Everything downstream of the barrier runs as pipeline() under H1's default with NO second
//     barrier: each correlated incident's match → remediate → verify → close chain is independent
//     of every other incident's, so incident B may be remediating while incident A is still
//     matching. A second barrier would serialize the whole fleet behind the slowest incident.
//   * Not a loop (loop policy L6): the firing-signal list is enumerable up front, supplied by the
//     webhook. Nothing is discovered incrementally.
//
// SIZE GATE (SKILL §8): one alert, one service, one obvious runbook → execute it inline in the
// session and do not run this script. The barrier exists to decide "one incident or three" across
// concurrently firing signals; with one signal there is nothing to correlate.
//
// H10: no clock and no randomness in-script. nowMs / nowIso / recheckAtIso arrive via args from
// the webhook-triggered invocation — the same convention
// ../../loop-autopilot/templates/credit-ledger.workflow.js already uses.
//
// Invoke with: Workflow({ script, args: {
//   service, signals, runbooks, rung, execution, nowMs, nowIso, recheckAtIso,
//   recheckAfterSeconds, auditIssueNumber, mode } })
//   service             — the service or journey under operation, verbatim. Used in every prompt.
//   signals             — [{ key, slo, alertRule, window, prompt }] the CURRENTLY FIRING checks.
//   runbooks            — [{ id, trigger, actionClass, target, command, successCheck, escalation }]
//                         the catalog to match against, per runbooks.md §1.
//   rung                — 'observe' | 'verify' | 'sustain' | 'scale'. The autonomy dial. Rung
//                         DEFINITIONS live in ../../loop-autopilot; this script only reads it.
//   execution           — 'dry' (default) or 'live'. This is the RUNBOOK execution mode and is a
//                         DIFFERENT field from `mode` below, deliberately named apart from it.
//   mode                — 'optimize' (default) or 'full'; the loop-engine ROUTING dial, parsed by
//                         loop-engine and passed through as a real JSON value. NOT execution.
//   nowMs / nowIso      — current time, supplied by the invoking runner (H10).
//   recheckAtIso        — when the Verify stage's success check should be evaluated.
//   recheckAfterSeconds — the wait interval that produced recheckAtIso; carried for the record.
//   auditIssueNumber    — the pinned 🔒 Autonomy State issue (autonomy-and-rollback.md §4).

export const meta = {
  name: 'health-response', // EDIT ME
  description: 'Correlate concurrently firing SLO signals into incidents, match a runbook gated by the autonomy rung, remediate serialized per target, verify the breach actually cleared, then close to the audit trail or hand off to loop-incident',
  phases: [
    { title: 'Correlate', detail: 'one check per firing signal, then merge signals sharing a root cause' },
    { title: 'Match', detail: 'find the runbook whose trigger fits, gated by the autonomy rung' },
    { title: 'Remediate', detail: 'execute dry or live, serialized per target resource' },
    { title: 'Verify', detail: 'recheck the SLI after the wait interval supplied in args' },
    { title: 'Escalate', detail: 'close to the audit trail, or package the loop-incident handoff' },
  ],
}

// Some harnesses deliver args as a JSON-encoded string — normalize before use.
const input = typeof args === 'string' ? JSON.parse(args) : args

// Canonical ROUTES block — single source of truth: loop-engine/references/execution-modes.md §M8.
// Duplicated verbatim into every template that sets model or effort. H10 gives scripts no module
// access, so duplication is intentional; drift is a defect (see scripts/validate.mjs).
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
function optsFor(node, label) {
  const r = routeFor(node.taskType)
  const opts = { label: label || node.label, phase: node.phase, schema: node.schema }
  if (r.model) opts.model = r.model     // omit → inherit session model (H8)
  if (r.effort) opts.effort = r.effort  // omit → inherit session effort
  if (PLANNER && node.taskType === 'planner') opts.model = PLANNER // §M7 override — planner nodes only
  return opts
}

// The block above is byte-identical to §M8 except for the members §M8 explicitly says to drop:
// `DRY_LIMIT` is omitted because this template has no loop stage; `plannerAgent` is omitted
// because no node here carries taskType 'planner'; and `WIDTH` is omitted under §M5's
// DETERMINISTIC-MEASUREMENT carve-out — the Verify stage re-queries the SLI against the
// monitoring backend and reports what it reads. It is not a skeptic, no part of it is reduced
// by majority-refute, and three agents asking one backend the same question is the redundancy
// H4 ranks below diversity. It is therefore width 1 in BOTH modes by decision, not by oversight,
// and full mode does not widen it. Every line that IS here is verbatim; drift on any of them is
// a defect, and §M8 is the source.

const SERVICE = (input && input.service) || 'EDIT_ME: the service or user journey under operation'
const RUNG = (input && input.rung) || 'observe' // safest default; never assume a higher rung
const EXECUTION = (input && input.execution) === 'live' ? 'live' : 'dry' // dry by default
const NOW_ISO = (input && input.nowIso) || null
const RECHECK_AT_ISO = (input && input.recheckAtIso) || null
const RECHECK_AFTER_S = (input && input.recheckAfterSeconds) || null
const AUDIT_ISSUE = (input && input.auditIssueNumber) || null
const RUNBOOKS = (input && input.runbooks) || []
const MAX_INCIDENTS = 8 // EDIT ME: cap on incidents remediated in one run; overflow is logged, never silent

// EDIT ME: the currently-firing signals, supplied by the webhook. One entry per firing SLO/alert
// rule. Diversity beats redundancy (H4): each check reads a DIFFERENT signal, not the same SLI
// twice. An empty list is a legitimate outcome — the barrier below early-exits on it.
const SIGNALS = (input && input.signals) || [
  { key: 'availability', slo: 'EDIT_ME checkout-availability', alertRule: 'CheckoutAvailabilityBurn', window: '1h/5m', prompt: 'Availability SLI: successful responses over valid requests, measured at the edge. Report current burn rate on BOTH windows of the firing rule and the budget remaining.' },
  { key: 'latency', slo: 'EDIT_ME search-latency-300ms', alertRule: 'SearchLatencyBurn', window: '6h/30m', prompt: 'Latency SLI: fraction of requests served under the SLO threshold. Report burn rate on both windows; do NOT report an average or a bare percentile.' },
  { key: 'saturation', slo: 'EDIT_ME shared-db-pool', alertRule: 'DbPoolSaturation', window: '30m', prompt: 'USE-method saturation on the constrained resource (pool, queue depth, connections). This is DIAGNOSTIC context, not an SLI — it must not by itself justify an incident (alerting.md §3).' },
]

// The rung-gated eligibility table, runbooks.md §3. Encoded, not argued about at runtime.
const RUNG_INDEX = { observe: 0, verify: 1, sustain: 2, scale: 3 }
const RUNG_IDX = typeof RUNG_INDEX[RUNG] === 'number' ? RUNG_INDEX[RUNG] : 0
const MIN_RUNG_FOR_CLASS = { restart: 1, 'scale-up': 1, failover: 2, 'cache-clear': 2, 'traffic-shift': 2, rollback: 3 }
// Never auto-run at ANY rung, for any severity. Same hard-list shape as loop-autopilot's
// NEVER-auto-merge list, and for the same reason: it cannot be argued down in the moment.
const NEVER_CLASSES = ['migration', 'data-repair', 'secret-rotation', 'infra-config']

const SIGNAL_SCHEMA = {
  type: 'object',
  properties: {
    firing: { type: 'boolean' }, // false is legitimate — the alert may have cleared before this run started
    sloName: { type: 'string' },
    burnRateFast: { type: 'number' }, // slo-model.md §3 — normalized, 1.0 = exactly on pace
    burnRateSlow: { type: 'number' },
    bothWindowsAgree: { type: 'boolean' }, // alerting.md §4: a page requires BOTH, not either
    budgetRemainingPct: { type: 'number' },
    minimumSampleMet: { type: 'boolean' }, // below sample, a burn rate is noise and must not drive action
    blastRadius: { type: 'string' }, // measured slice: traffic %, tenants, regions, client versions
    firstDeviationAt: { type: 'string' }, // usually EARLIER than the first alert; the key timestamp
    suspectedRootCauseKey: { type: 'string' }, // the merge key — a shared dependency, deploy id, resource
    recentChangeEvents: { type: 'array', items: { type: 'string' } }, // deploys, config, flags in window
    evidenceGaps: { type: 'array', items: { type: 'string' } }, // un-instrumented or unretained sources
  },
  required: ['firing', 'sloName', 'burnRateFast', 'burnRateSlow', 'bothWindowsAgree', 'budgetRemainingPct', 'minimumSampleMet', 'blastRadius', 'firstDeviationAt', 'suspectedRootCauseKey', 'recentChangeEvents', 'evidenceGaps'],
}

const MATCH_SCHEMA = {
  type: 'object',
  properties: {
    matched: { type: 'boolean' }, // false → no automated path exists → handoff (on-call-triage.md §2)
    runbookId: { type: 'string' },
    actionClass: { type: 'string' }, // MUST be one of the classes in runbooks.md §3
    target: { type: 'string' }, // the lock key for the Remediate stage
    command: { type: 'string' }, // parameterized and deterministic, never prose
    successCheckQuery: { type: 'string' }, // a query on the SLI/burn rate, NOT "did the alert stop"
    reversalHow: { type: 'string' }, // §2 admission bar — empty means ineligible
    reversalTested: { type: 'string' }, // a DATE, or the string 'never' — 'never' fails the bar
    severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }, // burn × blast, §1
    rationale: { type: 'string' },
  },
  required: ['matched', 'runbookId', 'actionClass', 'target', 'command', 'successCheckQuery', 'reversalHow', 'reversalTested', 'severity', 'rationale'],
}

const ACTION_SCHEMA = {
  type: 'object',
  properties: {
    executed: { type: 'boolean' },
    dryRun: { type: 'boolean' },
    actionTaken: { type: 'string' },
    observedImmediateEffect: { type: 'string' },
    errors: { type: 'array', items: { type: 'string' } },
  },
  required: ['executed', 'dryRun', 'actionTaken', 'observedImmediateEffect', 'errors'],
}

const RECHECK_SCHEMA = {
  type: 'object',
  properties: {
    breachCleared: { type: 'boolean' }, // the SLI/burn rate recovered — NOT "the alert went quiet"
    burnRateNow: { type: 'number' },
    alertStillFiring: { type: 'boolean' },
    evidence: { type: 'string' }, // the query run and the value returned
    divergenceNote: { type: 'string' }, // set when the alert quieted but the SLI did NOT recover
  },
  required: ['breachCleared', 'burnRateNow', 'alertStillFiring', 'evidence', 'divergenceNote'],
}

const AUDIT_SCHEMA = {
  type: 'object',
  properties: { appended: { type: 'boolean' }, note: { type: 'string' } },
  required: ['appended', 'note'],
}

// ─── Stage 1 (Correlate) ────────────────────────────────────────────────────────────────────
// No barrier WITHIN this stage: each check reads its own signal and depends on no other check's
// output (H1/H2 — a per-item stage stays a pipeline stage).
log('correlate: ' + SIGNALS.length + ' firing signals for "' + SERVICE + '" [rung=' + RUNG + ' execution=' + EXECUTION + ' mode=' + MODE + ' now=' + NOW_ISO + ']')
if (!NOW_ISO) log('nowIso not supplied — timestamps in the handoff package will be incomplete; the invoking runner must pass it (H10)')
if (RUNG_IDX === 0) log('rung=observe — NOTHING will be executed this run; every match is reported as a recommendation only')

const assessed = await parallel(
  SIGNALS.map((s) => () =>
    agent(
      'Service / journey: ' + SERVICE + '\n' +
        'Firing alert rule: ' + s.alertRule + ' (SLO: ' + s.slo + ', windows: ' + s.window + ')\n' +
        'Evaluated as of: ' + NOW_ISO + '\n\n' +
        'Your signal: ' + s.prompt + '\n\n' +
        'Read the LIVE metric. Report burn rate normalized so 1.0 means exactly on pace to exhaust ' +
        'the error budget over the compliance window (references/slo-model.md §3), on BOTH the fast ' +
        'and slow window of the firing rule, plus the budget remaining as a percentage.\n' +
        'Set minimumSampleMet=false when the window holds too few requests for a single error to be ' +
        'distinguishable from the threshold — below that sample the burn rate is noise and MUST NOT ' +
        'drive an action (references/alerting.md §4).\n' +
        'firstDeviationAt is when the SLI ACTUALLY deviated, which is almost always earlier than the ' +
        'first alert. Search back for it; do not copy the alert timestamp.\n' +
        'suspectedRootCauseKey is the MERGE KEY: name the shared dependency, deploy id, resource or ' +
        'region you believe is common to this and any other concurrent degradation. Use the same ' +
        'string another signal would use for the same cause — that is what makes correlation work.\n' +
        'Report anything your telemetry could NOT tell you in evidenceGaps. State facts, not ' +
        'interpretation, and do NOT name a root cause: this skill never root-causes ' +
        '(references/on-call-triage.md §4). Return raw data conforming to the schema.',
      optsFor({ taskType: 'scout', phase: 'Correlate', schema: SIGNAL_SCHEMA }, 'signal:' + s.key),
    ).then((r) => (r ? { key: s.key, signal: r } : null)),
  ),
)

// .filter(Boolean): a skipped or dead check resolves to null (harness policy H5).
const returned = assessed.filter(Boolean)
const returnedKeys = returned.map((r) => r.key)
for (const s of SIGNALS) {
  if (returnedKeys.indexOf(s.key) === -1) log('signal ' + s.key + ' returned NOTHING — treat as UNOBSERVED, not as healthy (H5/H6)')
}

// ─── CORRELATION BARRIER (harness policy H2) ────────────────────────────────────────────────
// The one earned barrier in this script, earned on BOTH of H2's grounds — and it needs EVERY
// concurrently-firing check to have reported before either can be applied:
//
//   1. DEDUP / MERGE ACROSS THE FULL RESULT SET. A single root outage routinely trips several
//      SLOs at once — latency, error rate and saturation all moving from one exhausted connection
//      pool. The loop cannot decide "one incident or three" until every firing check has reported
//      its suspectedRootCauseKey, and getting that decision wrong is expensive in both directions:
//      three incidents means three concurrent remediations racing on one target (runbooks.md §4),
//      and one incident wrongly merged means a second, unrelated degradation goes unremediated.
//   2. ZERO-RESULT EARLY-EXIT. A mostly-healthy round — every signal below its minimum sample, or
//      every alert already cleared before this run started — should skip the Match → Remediate →
//      Verify → Escalate pipeline entirely rather than spin it up for nothing.
//
// This is the identical justification and shape ../../loop-review/templates/security-review.workflow.js
// already uses for its finder-fan-out → dedup barrier, applied to firing alerts instead of
// vulnerability candidates. It is NOT "I need to flatten first", which H2 explicitly refuses.
//
// Done in plain JS: never spend an agent on grouping (loop policy L3).
const actionable = []
for (const r of returned) {
  const sig = r.signal
  if (!sig.firing) { log('signal ' + r.key + ' no longer firing — dropped from this round (cleared before the run started)'); continue }
  if (!sig.minimumSampleMet) { log('signal ' + r.key + ' below minimum sample — burn rate ' + sig.burnRateFast + ' is NOT actionable (alerting.md §4); reported, not acted on'); continue }
  if (!sig.bothWindowsAgree) { log('signal ' + r.key + ' fast/slow windows disagree — recorded as context, not as a page (alerting.md §4)'); continue }
  actionable.push(r)
}

const byCause = new Map()
for (const r of actionable) {
  const key = String(r.signal.suspectedRootCauseKey || ('uncorrelated:' + r.key)).toLowerCase().trim()
  const prior = byCause.get(key)
  if (!prior) {
    byCause.set(key, { causeKey: key, signals: [r], symptoms: [r.key] })
  } else {
    prior.signals.push(r)
    prior.symptoms.push(r.key)
    log('merged signal ' + r.key + ' into incident "' + key + '" — one root cause, ' + prior.symptoms.length + ' symptoms (alerting.md §5 dedup)')
  }
}

let incidents = [...byCause.values()].map((inc) => {
  // Worst-case projection across the merged signals: severity follows the fastest burn and the
  // broadest radius, per on-call-triage.md §1. Computed here so the Match agent argues with a
  // number rather than producing one.
  let fastest = 0
  let lowestBudget = 100
  for (const s of inc.signals) {
    if (s.signal.burnRateFast > fastest) fastest = s.signal.burnRateFast
    if (s.signal.budgetRemainingPct < lowestBudget) lowestBudget = s.signal.budgetRemainingPct
  }
  return { causeKey: inc.causeKey, signals: inc.signals, symptoms: inc.symptoms, peakBurnRate: fastest, budgetRemainingPct: lowestBudget }
}).sort((a, b) => b.peakBurnRate - a.peakBurnRate)

log('correlate: ' + returned.length + '/' + SIGNALS.length + ' checks returned, ' + actionable.length + ' actionable → ' + incidents.length + ' correlated incident(s)')

if (incidents.length === 0) {
  // Early-exit: the second legitimate use of the barrier (H2). Nothing survived correlation.
  log('nothing actionable survived correlation — closing the round without entering the pipeline')
  return {
    service: SERVICE, rung: RUNG, execution: EXECUTION, at: NOW_ISO,
    incidents: [], handoffToLoopIncident: [],
    note: 'no actionable incident: every firing signal either cleared, fell below minimum sample, or failed the both-windows rule (alerting.md §4)',
  }
}

if (incidents.length > MAX_INCIDENTS) {
  // No silent caps (H6). An overflow here is itself a finding — it usually means the correlation
  // key is too fine-grained, or a platform-level failure is being seen as N service failures.
  for (const dropped of incidents.slice(MAX_INCIDENTS)) log('OVER CAP — incident "' + dropped.causeKey + '" (peak burn ' + dropped.peakBurnRate + ') NOT remediated this round; it is in the handoff package')
  log('cap ' + MAX_INCIDENTS + '/' + incidents.length + ' exceeded — this many distinct causes at once usually means a platform-level failure, which is loop-incident territory by the SKILL.md predicate')
}
const overflow = incidents.slice(MAX_INCIDENTS)
incidents = incidents.slice(0, MAX_INCIDENTS)

// Per-target serialization (runbooks.md §4). This is the infra analog of AP5 worktree isolation,
// and the analogy does NOT carry the mechanism with it: H7's isolation:'worktree' covers concurrent
// FILE mutation, and there is no git worktree to isolate against when the mutated object is a
// running deployment. This lock covers remediations issued by THIS run only. A second concurrent
// webhook-triggered run, a human executing the same runbook by hand, or an autoscaler acting on the
// same target are all outside it — the durable cross-run lock must come from the operator's runbook
// executor (a lease, a resource annotation, a deploy-system in-progress guard). Deploying above the
// VERIFY rung without one is deploying a known race, and autonomy-and-rollback.md §4 says so.
const targetLocks = new Map()
function withTargetLock(target, thunk) {
  const key = String(target || 'unknown-target')
  const prev = targetLocks.get(key)
  if (prev) log('serializing remediation behind another action already in flight on target "' + key + '" (runbooks.md §4)')
  const chain = (prev || Promise.resolve()).then(thunk, thunk)
  targetLocks.set(key, chain.then(() => null, () => null))
  return chain
}

// ─── Stages 2-5 (Match → Remediate → Verify → Escalate) ─────────────────────────────────────
// pipeline() per H1, with NO second barrier: each incident's chain is independent of every other
// incident's, so incident B may already be remediating while incident A is still matching. A
// barrier here would serialize the fleet behind the slowest incident for no cross-item benefit.
const results = await pipeline(
  incidents,

  // ── Match: find the runbook whose trigger fits. The RUNG GATE is applied below in plain JS,
  //    deterministically — the eligibility table is not something an agent gets to reinterpret.
  async (_prev, inc) => {
    const catalog = RUNBOOKS.length
      ? RUNBOOKS.map((r) => '- ' + r.id + ' | class=' + r.actionClass + ' | target=' + r.target + ' | trigger=' + r.trigger).join('\n')
      : '(no runbook catalog supplied in args — report matched=false)'
    const evidence = inc.signals.map((s) => s.key + ': burn ' + s.signal.burnRateFast + '/' + s.signal.burnRateSlow + ', budget ' + s.signal.budgetRemainingPct + '%, radius ' + s.signal.blastRadius + ', deviated ' + s.signal.firstDeviationAt).join('\n')
    const changes = inc.signals.flatMap((s) => s.signal.recentChangeEvents).join('; ')
    return agent(
      'Service / journey: ' + SERVICE + '\n' +
        'Correlated incident (one root cause, ' + inc.symptoms.length + ' symptom(s)): ' + inc.causeKey + '\n' +
        'Symptoms: ' + inc.symptoms.join(', ') + '\n\n' +
        'Evidence:\n' + evidence + '\n' +
        (changes ? 'Change events in window: ' + changes + '\n' : '') + '\n' +
        'Runbook catalog:\n' + catalog + '\n\n' +
        'Find the ONE runbook whose trigger condition fits. If two fit, that is a catalog defect — ' +
        'pick neither and set matched=false with the collision named in rationale ' +
        '(references/runbooks.md §1: two runbooks must never match the same condition).\n' +
        'Score severity from BURN RATE crossed with BLAST RADIUS (references/on-call-triage.md §1), ' +
        'never from gut feel. Escalate upward — never downward — when the budget is already nearly ' +
        'exhausted, when data integrity is in question, or when two or more independent journeys are ' +
        'affected.\n' +
        'actionClass MUST be one of: restart, scale-up, failover, cache-clear, traffic-shift, ' +
        'rollback, migration, data-repair, secret-rotation, infra-config. The last four NEVER run ' +
        'automatically at any rung; report them honestly rather than relabelling them to something ' +
        'eligible.\n' +
        'successCheckQuery MUST measure the SLI or burn rate. "The alert stopped firing" is NOT a ' +
        'success check and will be rejected downstream.\n' +
        'reversalTested is a DATE from a recorded drill, or the literal string "never". Do not guess ' +
        'a date: an unreversible or undrilled action fails the admission bar (runbooks.md §2).\n' +
        'Do NOT name a root cause and do NOT write a postmortem — neither is this skill\'s ' +
        '(on-call-triage.md §4). Return raw data conforming to the schema.',
      optsFor({ taskType: 'analyze', phase: 'Match', schema: MATCH_SCHEMA }, 'match:' + inc.causeKey),
    ).then((m) => {
      if (!m) { log('match agent died for incident "' + inc.causeKey + '" — routed to handoff unmatched (H5)'); return { incident: inc, match: null, gate: 'agent-died' } }
      // The rung gate, in plain JS. runbooks.md §3.
      let gate
      if (!m.matched) gate = 'no-runbook'
      else if (NEVER_CLASSES.indexOf(m.actionClass) !== -1) gate = 'blocked-never'
      else if (!m.reversalHow || m.reversalTested === 'never') gate = 'blocked-unreversible'
      else if (RUNG_IDX === 0) gate = 'observe-only'
      else if (RUNG_IDX < (MIN_RUNG_FOR_CLASS[m.actionClass] || 99)) gate = 'needs-approval'
      else gate = 'eligible'
      log('match [' + inc.causeKey + '] runbook=' + (m.matched ? m.runbookId : 'NONE') + ' class=' + m.actionClass + ' severity=' + m.severity + ' → gate=' + gate)
      if (gate === 'no-runbook') log('SKIPPED — no matching runbook for "' + inc.causeKey + '". This names the runbook that should exist and is a loop-incident postmortem action item (runbooks.md §5)')
      if (gate === 'blocked-never') log('SKIPPED — class "' + m.actionClass + '" is on the NEVER list; the gate held. Paging instead (runbooks.md §3)')
      if (gate === 'blocked-unreversible') log('SKIPPED — reversal untested or absent; fails the admission bar at every rung (runbooks.md §2)')
      if (gate === 'needs-approval') log('SKIPPED — class "' + m.actionClass + '" needs rung ' + MIN_RUNG_FOR_CLASS[m.actionClass] + ', current rung is ' + RUNG + '. Paging with the runbook attached as a recommendation')
      if (gate === 'observe-only') log('SKIPPED — rung=observe reports only; the recommendation is attached to the page')
      return { incident: inc, match: m, gate: gate }
    })
  },

  // ── Remediate: execute the matched action, serialized per target resource.
  async (prev) => {
    if (!prev) return null
    if (prev.gate !== 'eligible') return Object.assign({}, prev, { action: null, skipped: prev.gate })
    const m = prev.match
    return withTargetLock(m.target, () =>
      agent(
        'Service / journey: ' + SERVICE + '\n' +
          'Runbook: ' + m.runbookId + ' (class ' + m.actionClass + ', target ' + m.target + ')\n' +
          'Autonomy rung: ' + RUNG + ' — this class is cleared to run at this rung.\n' +
          'Execution mode: ' + EXECUTION + '\n\n' +
          'Action: ' + m.command + '\n' +
          'Reversal if needed: ' + m.reversalHow + ' (last drilled: ' + m.reversalTested + ')\n\n' +
          (EXECUTION === 'live'
            ? 'EXECUTE the action exactly as written. Do not improvise, do not widen its scope, and do ' +
              'not take an additional action that the runbook does not specify — a lever that would ' +
              'have to be invented is a loop-ship action item, never a step to take now.'
            : 'DRY RUN. Do NOT execute. Report precisely what WOULD be run, against which resolved ' +
              'targets, and what the observable immediate effect would be. This is the mode to ' +
              'compare against what the on-call actually did before trusting the loop.') + '\n\n' +
          'Prefer the declarative target state over a relative adjustment: the executor may deliver ' +
          'this twice (references/runbooks.md §2, idempotency).\n' +
          'Report every error verbatim in errors[]; a partially applied action reported as success is ' +
          'the worst outcome available here. Return raw data conforming to the schema.',
        optsFor({ taskType: 'implement', phase: 'Remediate', schema: ACTION_SCHEMA }, 'remediate:' + m.runbookId),
      ).then((a) => {
        if (!a) { log('remediation agent died for ' + m.runbookId + ' — treated as NOT executed (H5)'); return Object.assign({}, prev, { action: null, skipped: 'agent-died' }) }
        log('remediate [' + prev.incident.causeKey + '] ' + m.runbookId + ' executed=' + a.executed + ' dryRun=' + a.dryRun + (a.errors.length ? ' errors=' + a.errors.length : ''))
        for (const e of a.errors) log('remediation error (' + m.runbookId + '): ' + e)
        return Object.assign({}, prev, { action: a, skipped: null })
      }),
    )
  },

  // ── Verify: recheck the SLI after the wait interval SUPPLIED IN ARGS. The wait is not computed
  //    here — H10 forbids reading the clock, and recheckAtIso comes from the invoking runner.
  async (prev) => {
    if (!prev) return null
    if (!prev.action || !prev.action.executed) return prev
    const m = prev.match
    const recheck = await agent(
      'Service / journey: ' + SERVICE + '\n' +
        'Action taken: ' + prev.action.actionTaken + ' (runbook ' + m.runbookId + ')\n' +
        'Action time: ' + NOW_ISO + '\n' +
        'Evaluate the success check at: ' + RECHECK_AT_ISO + (RECHECK_AFTER_S ? ' (wait interval: ' + RECHECK_AFTER_S + 's)' : '') + '\n\n' +
        'Success check: ' + m.successCheckQuery + '\n\n' +
        'Wait until the evaluation time above using your monitoring tooling, then run the query. ' +
        'Do not evaluate early: an SLI read immediately after an action reflects the pre-action ' +
        'window and will read as cleared when nothing has changed.\n' +
        'breachCleared is TRUE only when the SLI or burn rate has actually recovered. An alert that ' +
        'went quiet while the SLI is unchanged is NOT cleared — set breachCleared=false and describe ' +
        'the divergence in divergenceNote. That divergence is the single most important thing this ' +
        'stage can find: it means the action suppressed the symptom rather than the condition.\n' +
        'Return raw data conforming to the schema.',
      optsFor({ taskType: 'verify', phase: 'Verify', schema: RECHECK_SCHEMA }, 'verify:' + m.runbookId),
    )
    if (!recheck) { log('verify agent died for ' + m.runbookId + ' — treated as NOT cleared and escalated (H5)'); return Object.assign({}, prev, { recheck: null }) }
    log('verify [' + prev.incident.causeKey + '] cleared=' + recheck.breachCleared + ' burnNow=' + recheck.burnRateNow + (recheck.divergenceNote ? ' DIVERGENCE: ' + recheck.divergenceNote : ''))
    return Object.assign({}, prev, { recheck: recheck })
  },

  // ── Escalate-or-close: cleared → audit trail; otherwise → the loop-incident handoff payload.
  async (prev) => {
    if (!prev) return null
    const cleared = !!(prev.recheck && prev.recheck.breachCleared)
    if (cleared && AUDIT_ISSUE) {
      const appended = await agent(
        'Append one entry to the pinned 🔒 Autonomy State audit issue #' + AUDIT_ISSUE + ' for ' + SERVICE + '.\n' +
          'Do not edit or reformat any existing entry; append only.\n\n' +
          'Entry: at=' + NOW_ISO + ' incident=' + prev.incident.causeKey + ' symptoms=' + prev.incident.symptoms.join('+') +
          ' rung=' + RUNG + ' execution=' + EXECUTION + ' runbook=' + prev.match.runbookId +
          ' class=' + prev.match.actionClass + ' target=' + prev.match.target +
          ' peakBurn=' + prev.incident.peakBurnRate + ' budgetRemaining=' + prev.incident.budgetRemainingPct + '%' +
          ' outcome=cleared burnAfter=' + prev.recheck.burnRateNow + '\n\n' +
          'This is the audit trail autonomy-and-rollback.md §4 requires; it is the same record shape ' +
          'loop-autopilot uses for its SCALE decisions. Return raw data conforming to the schema.',
        optsFor({ taskType: 'doc', phase: 'Escalate', schema: AUDIT_SCHEMA }, 'audit:' + prev.match.runbookId),
      )
      if (!appended || !appended.appended) log('AUDIT APPEND FAILED for incident "' + prev.incident.causeKey + '" — the action happened and the record did not (H6). Reconcile by hand')
      return Object.assign({}, prev, { outcome: 'cleared' })
    }
    if (cleared && !AUDIT_ISSUE) {
      log('incident "' + prev.incident.causeKey + '" cleared but no auditIssueNumber supplied — no durable record was written (autonomy-and-rollback.md §4)')
      return Object.assign({}, prev, { outcome: 'cleared-unaudited' })
    }
    log('ESCALATING incident "' + prev.incident.causeKey + '" to loop-incident — ' + (prev.skipped ? 'gate: ' + prev.skipped : 'runbook did not clear the breach'))
    return Object.assign({}, prev, { outcome: 'escalate' })
  },
)

// .filter(Boolean): a stage that throws drops that item to null (H1/H5).
const settled = results.filter(Boolean)
for (const inc of incidents) {
  if (!settled.some((s) => s.incident.causeKey === inc.causeKey)) log('incident "' + inc.causeKey + '" fell out of the pipeline entirely — escalating it unhandled rather than dropping it (H6)')
}

// The handoff payload is built in plain JS from data already gathered — on-call-triage.md §3 is a
// CONTRACT, and loop-incident's §1/§3 consume exactly these fields. Never spend an agent on it.
function handoffFor(entry) {
  const inc = entry.incident
  return {
    burnState: {
      slosInBreach: inc.signals.map((s) => s.signal.sloName),
      peakBurnRate: inc.peakBurnRate,
      perSignal: inc.signals.map((s) => ({ key: s.key, fast: s.signal.burnRateFast, slow: s.signal.burnRateSlow })),
      budgetRemainingPct: inc.budgetRemainingPct,
      firstDeviationAt: inc.signals.map((s) => s.signal.firstDeviationAt).sort()[0] || null,
      blastRadius: inc.signals.map((s) => s.signal.blastRadius).join(' | '),
      severity: entry.match ? entry.match.severity : 'unscored',
    },
    runbooksAttempted: entry.match
      ? [{
          runbookId: entry.match.runbookId,
          actionClass: entry.match.actionClass,
          target: entry.match.target,
          gate: entry.gate,
          skippedReason: entry.skipped || null,
          at: NOW_ISO,
          actionTaken: entry.action ? entry.action.actionTaken : null,
          successCheck: entry.match.successCheckQuery,
          successCheckResult: entry.recheck ? entry.recheck.evidence : null,
          cleared: entry.recheck ? entry.recheck.breachCleared : false,
          divergenceNote: entry.recheck ? entry.recheck.divergenceNote : null,
        }]
      : [],
    // Stated so nothing in this package can be mistaken for a diagnosis — the same flag
    // loop-incident carries forward into loop-debug.
    allActionsAreMitigationsNotFixes: true,
    timeline: {
      changeEventsInWindow: inc.signals.flatMap((s) => s.signal.recentChangeEvents),
      symptoms: inc.symptoms,
      correlationKey: inc.causeKey,
    },
    evidenceGaps: inc.signals.flatMap((s) => s.signal.evidenceGaps),
  }
}

const escalations = settled.filter((s) => s.outcome === 'escalate').map(handoffFor)
for (const o of overflow) escalations.push(handoffFor({ incident: o, match: null, gate: 'over-cap', skipped: 'over-cap', action: null, recheck: null }))

log('health response [rung=' + RUNG + ' execution=' + EXECUTION + ' mode=' + MODE + ']: ' + incidents.length + ' incident(s), ' +
  settled.filter((s) => s.outcome === 'cleared' || s.outcome === 'cleared-unaudited').length + ' cleared, ' + escalations.length + ' escalated to loop-incident')

return {
  service: SERVICE,
  rung: RUNG,
  execution: EXECUTION,
  at: NOW_ISO,
  incidents: settled.map((s) => ({
    causeKey: s.incident.causeKey,
    symptoms: s.incident.symptoms,
    peakBurnRate: s.incident.peakBurnRate,
    runbookId: s.match ? s.match.runbookId : null,
    gate: s.gate,
    outcome: s.outcome || 'escalate',
  })),
  // Root cause, postmortem and comms are deliberately absent — they are loop-incident's, and
  // producing them here would collapse the boundary this skill exists on (on-call-triage.md §4).
  handoffToLoopIncident: escalations,
}
