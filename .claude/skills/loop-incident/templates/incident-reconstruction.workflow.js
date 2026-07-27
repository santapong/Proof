// Template: INCIDENT RECONSTRUCTION — triage → per-source timeline fan-out → MERGE BARRIER →
// reproduce → postmortem draft. A specialization of the loop-engine parallel fan-out pattern
// with loop-incident's material pre-wired: references/incident-command.md (severity axes),
// references/mitigation-playbook.md (the lever catalog), references/reproduction-timeline.md
// (the six telemetry sources and the merge rules), references/postmortem.md (the CoE shape).
//
// SHAPE — why this is a parallel-fan-out-then-sequence and not something else:
//   * Not a bare pipeline() (H1's default): there IS genuine cross-item work at Merge. Six
//     per-source timeline fragments must be reconciled against EACH OTHER — ordered, de-skewed,
//     de-duplicated — which is a real reduce over the full result set, not a flatten.
//   * Not a loop (loop policy L6): the source list is enumerable up front. Logs, traces, metrics,
//     deploys, flags, alerts are known before the run starts; nothing is discovered incrementally,
//     so looping over known work is exactly what L6 forbids.
//   * Triage, Reproduce and Postmortem are single agents with no cross-item merge need, so they
//     simply run in sequence around the one earned barrier.
//
// SIZE GATE (SKILL §7): for a single-service incident with ONE log stream there is nothing to
// reconcile — reconstruct the timeline inline in the session and do not run this script. The
// barrier below is only earned when the timeline is genuinely fragmented across sources.
//
// Invoke with: Workflow({ script, args: { incident, windowStart, windowEnd, declaredAt, ... } })
// input.incident       — the reported symptoms, verbatim from the channel. Used in every prompt.
// input.windowStart    — ISO timestamp string, start of the timeline window. Passed through, never generated (H10).
// input.windowEnd      — ISO timestamp string, end of the window (extend past mitigation).
// input.declaredAt     — ISO timestamp string, when the incident was declared.
// input.mitigations    — optional [{ at, action, outcome }] already applied, from mitigation-playbook §4.
// input.clockOffsetsMs — optional { [sourceKey]: milliseconds } skew corrections; unstated = assumed 0 and logged.
// input.mode           — 'optimize' (default) or 'full'; parsed by loop-engine, passed through as a real JSON value.

export const meta = {
  name: 'incident-reconstruction', // EDIT ME
  description: 'Triage severity, fan out one investigator per telemetry source, merge the fragments into one de-skewed deduplicated timeline, build a reproduction, and draft the blameless postmortem', // EDIT ME
  phases: [
    { title: 'Triage', detail: 'classify severity on both axes and flag candidate mitigations' },
    { title: 'Timeline', detail: 'one investigator per telemetry source, each returning its slice' },
    { title: 'Reproduce', detail: 'build a faithful reproduction from the merged timeline' },
    { title: 'Postmortem', detail: 'draft the blameless shell, root cause left as a pointer' },
  ],
}

// Some harnesses deliver args as a JSON-encoded string — normalize before use.
const input = typeof args === 'string' ? JSON.parse(args) : args

// Canonical ROUTES block — single source of truth: loop-engine/references/execution-modes.md §M8.
// Duplicated verbatim into every template that sets model or effort. H10 gives scripts no module
// access, so duplication is intentional; drift is a defect (see scripts/validate.mjs).
const RAW_MODE = (input && input.mode) || 'balanced'
const MODE_ALIAS = { optimize: 'balanced', full: 'all-out' }          // v1.1 names — still accepted (§M9.6)
const MODE = MODE_ALIAS[RAW_MODE] || (['lite', 'balanced', 'all-out'].indexOf(RAW_MODE) >= 0 ? RAW_MODE : 'balanced')
const PLANNER = (input && input.planner) === 'fable' ? 'claude-fable-5' : null // --planner fable (§M7)
const ROUTES = {
  lite: {
    scout:      { model: 'claude-haiku-4-5', effort: null },   // Haiku has no effort dial — omit, never 'low'
    doc:        { model: 'claude-haiku-4-5', effort: null },
    implement:  { model: 'claude-sonnet-5',  effort: null },
    analyze:    { model: 'claude-sonnet-5',  effort: 'medium' },
    synthesize: { model: 'claude-sonnet-5',  effort: 'medium' },
    verify:     { model: 'claude-sonnet-5',  effort: 'medium' },
    judge:      { model: 'claude-sonnet-5',  effort: 'medium' },
    critic:     { model: 'claude-sonnet-5',  effort: 'medium' },
    gating:     { model: 'claude-opus-5',    effort: 'high' }, // pinned in EVERY mode — error cost
    planner:    { model: 'claude-opus-5',    effort: 'high' }, // pinned in EVERY mode — gates the run
  },
  balanced: {
    scout:      { model: 'claude-haiku-4-5', effort: null },
    doc:        { model: 'claude-haiku-4-5', effort: null },
    implement:  { model: 'claude-sonnet-5',  effort: 'high' },
    analyze:    { model: null,               effort: 'high' }, // null model = omit, inherit session (H8)
    synthesize: { model: null,               effort: 'high' },
    verify:     { model: null,               effort: 'high' },
    judge:      { model: null,               effort: 'high' },
    critic:     { model: null,               effort: 'high' },
    gating:     { model: 'claude-opus-5',    effort: 'max' },
    planner:    { model: 'claude-opus-5',    effort: 'xhigh' },
  },
  'all-out': {
    scout:      { model: 'claude-opus-5', effort: 'xhigh' },
    doc:        { model: 'claude-opus-5', effort: 'xhigh' },
    implement:  { model: 'claude-opus-5', effort: 'xhigh' },
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
const WIDTH = (kind) => (MODE === 'all-out' ? (kind === 'gating' ? 5 : 3) : MODE === 'lite' ? 1 : (kind === 'gating' ? 3 : 1))
function optsFor(node, label) {
  const r = routeFor(node.taskType)
  const opts = { label: label || node.label, phase: node.phase, schema: node.schema }
  if (r.model) opts.model = r.model     // omit → inherit session model (H8)
  if (r.effort) opts.effort = r.effort  // omit → inherit session effort
  if (PLANNER && node.taskType === 'planner') opts.model = PLANNER // §M7 override — planner nodes only
  return opts
}

// The block above is byte-identical to §M8 except for the two lines §M8 explicitly says to drop:
// `DRY_LIMIT` is omitted because this template has no loop stage, and `WIDTH` is omitted because
// it has no verify stage — the merge is a deterministic reduce in plain JS, not an adversarial
// check, so there is no lens count for mode to resolve. Every line that IS here is verbatim;
// drift on any of them is a defect (see scripts/validate.mjs), and §M8 is the source.
// No plannerAgent: no node in this template carries taskType 'planner', so §M8's third
// optional member is dropped too. `PLANNER` and its `optsFor()` line stay — they are invariant
// core, and the flag is simply inert here.

// EDIT ME: the six telemetry sources from references/reproduction-timeline.md §3. Diversity beats
// redundancy (H4): each investigator reads a DIFFERENT system, not the same logs six ways. Drop a
// row the target genuinely does not have (no tracing, no flag service) and log the trim below —
// do not run an empty investigator, and do not let the drop vanish from the record.
const SOURCES = [
  { key: 'logs', prompt: 'Application logs across every involved service. Pull error and warning lines AND the last known-good lines before the first error. Filter by correlation id, not by keyword. Report the raw log timestamp exactly as written.' },
  { key: 'traces', prompt: 'Traces / APM. Pull failing traces, per-span latency, and error rates per service dependency — this is the only source that shows cross-service causality directly. Carry trace_id and span_id onto every event.' },
  { key: 'metrics', prompt: 'Metrics and dashboards. Pull the affected SLI, saturation signals (CPU, memory, connections, queue depth) and the same metrics on neighbouring services. Identify when the deviation ACTUALLY began — it is usually earlier than the first alert.' },
  { key: 'deploys', prompt: 'Deploy history. Every deploy, config push and infrastructure change in the window across ALL services, not just the obviously implicated one. Widen the window generously: the implicated deploy may be hours old and only now meeting the triggering traffic.' },
  { key: 'flags', prompt: 'Feature-flag and dynamic-config changes: every toggle, percentage-rollout change and config edit, with actor and time. This is the most frequently MISSED source — it changes behaviour with no deploy and no commit. If no change history is retained, report that as a gap rather than as an absence of change.' },
  { key: 'alerts', prompt: 'Alerts and the on-call channel: every alert fired and resolved, plus the human action record (who did what, expected effect, observed effect). This is the only source recording what humans did and what they expected.' },
  // EDIT ME: add org-specific sources (status pages of upstream dependencies, CDN/WAF logs,
  // database slow-query logs, a customer-support ticket stream) or drop rows that do not exist.
]

// Triage returns a classification, not prose — its final text is a return value (H3).
const TRIAGE_SCHEMA = {
  type: 'object',
  properties: {
    severityLabel: { type: 'string' }, // e.g. 'Sev-1' — the org's ladder, per incident-command.md §4
    technicalImpactBand: { type: 'string', enum: ['none', 'low', 'medium', 'high', 'critical'] }, // CVSS band, REUSED from loop-review/references/severity-model.md
    blastRadius: { type: 'string' }, // the non-CVSS axis: users affected, functionality lost, SLA, data, revenue, reversibility
    axesDisagree: { type: 'boolean' }, // true when the two axes differ by more than one band — surface it, do not smooth it
    rationale: { type: 'string' }, // why this severity — recorded so the postmortem can review the call
    candidateMitigations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          lever: { type: 'string' }, // a NAMED lever from mitigation-playbook.md §2
          alreadyInPlace: { type: 'boolean' }, // false ⇒ it is a loop-ship action item, NOT a mid-incident option
          whenSafe: { type: 'string' },
          whenNotSafe: { type: 'string' },
        },
        required: ['lever', 'alreadyInPlace', 'whenSafe', 'whenNotSafe'],
      },
    },
    dataIntegrityExceptionApplies: { type: 'boolean' }, // mitigation-playbook.md §1: could mitigating destroy evidence or widen the loss?
  },
  required: ['severityLabel', 'technicalImpactBand', 'blastRadius', 'axesDisagree', 'rationale', 'candidateMitigations', 'dataIntegrityExceptionApplies'],
}

// Each investigator returns its SLICE of the timeline. Timestamps are passed through as the raw
// strings the source recorded — an agent never generates a timestamp, and neither does this
// script (H10). Skew is corrected below from args, not invented here.
const SLICE_SCHEMA = {
  type: 'object',
  properties: {
    events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          timestamp: { type: 'string' }, // RAW, exactly as the source recorded it — normalized to UTC below
          event: { type: 'string' }, // stated factually: what happened, never what it means
          detail: { type: 'string' }, // the verbatim line / span / metric reading it came from
          sourceDetail: { type: 'string' }, // which system within the source (e.g. 'api-gateway access log')
          correlationIds: { type: 'array', items: { type: 'string' } }, // trace_id, request_id, release id…
          placementConfidence: { type: 'string', enum: ['exact', 'approximate', 'unresolved'] },
        },
        required: ['timestamp', 'event', 'detail', 'sourceDetail', 'correlationIds', 'placementConfidence'],
      },
    },
    failingSamples: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          trigger: { type: 'string' }, // the exact request/input that failed
          correlationId: { type: 'string' },
          note: { type: 'string' }, // near-miss successes are valuable here too — say which this is
        },
        required: ['trigger', 'correlationId', 'note'],
      },
    },
    gaps: { type: 'array', items: { type: 'string' } }, // unretained history, sampled-out traces, unobserved intervals
  },
  required: ['events', 'failingSamples', 'gaps'],
}

const REPRO_SCHEMA = {
  type: 'object',
  properties: {
    reproduced: { type: 'boolean' }, // false is a legitimate, honest outcome — say so rather than faking one
    trigger: { type: 'string' }, // exact command/call/request — loop-debug §1's bar
    inputs: { type: 'string' },
    environment: { type: 'string' }, // version, config, FLAG STATE, topology
    expectedVsActual: { type: 'string' },
    failureRate: { type: 'string' }, // e.g. '3 of 10' — intermittency is evidence about the fault class
    fidelityGaps: { type: 'array', items: { type: 'string' } }, // which of version/config/data-shape/load was approximated
    suspectedFaultRegion: { type: 'string' }, // head start on loop-debug §3 — NOT a root cause (loop-debug §5)
  },
  required: ['reproduced', 'trigger', 'inputs', 'environment', 'expectedVsActual', 'failureRate', 'fidelityGaps', 'suspectedFaultRegion'],
}

const POSTMORTEM_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    impact: { type: 'string' }, // quantified — numbers, not adjectives
    rootCausePointer: { type: 'string' }, // MUST remain a pointer to loop-debug; never a hypothesis
    contributingFactors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          spine: { type: 'string' }, // code/config/data/dependencies/capacity/observability/process/coordination
          factor: { type: 'string' },
          whyChainTerminatesSystemically: { type: 'string' }, // must NOT terminate at a person
        },
        required: ['spine', 'factor', 'whyChainTerminatesSystemically'],
      },
    },
    whatWentWell: { type: 'array', items: { type: 'string' } },
    whatWentPoorly: { type: 'array', items: { type: 'string' } },
    actionItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: { type: 'string' },
          owner: { type: 'string' },
          dueDate: { type: 'string' },
          completionCriterion: { type: 'string' },
          routeToSkill: { type: 'string' }, // loop-operate / loop-ship / loop-review / loop-test / loop-design
        },
        required: ['item', 'owner', 'dueDate', 'completionCriterion', 'routeToSkill'],
      },
    },
    recurrenceCheck: { type: 'string' },
  },
  required: ['summary', 'impact', 'rootCausePointer', 'contributingFactors', 'whatWentWell', 'whatWentPoorly', 'actionItems', 'recurrenceCheck'],
}

// ─── Stage 1 (Triage) ───────────────────────────────────────────────────────────────────────
// One agent. Judgment over the reported symptoms — the §M3 analyze row.
log(`triage: ${SOURCES.length} telemetry sources queued, window ${input.windowStart} → ${input.windowEnd} [mode=${MODE}]`)

const triage = await agent(
  `Reported incident: ${input.incident}\n` +
    `Declared at: ${input.declaredAt}\nWindow: ${input.windowStart} → ${input.windowEnd}\n\n` +
    `Classify severity on BOTH axes (references/incident-command.md §3): the CVSS technical-impact ` +
    `band REUSED from loop-review's severity model, AND a non-CVSS operational blast-radius axis ` +
    `(users affected, functionality lost, SLA exposure, data, revenue, reversibility). Many production ` +
    `incidents have no CWE at all — do not force one. The higher axis wins; if the axes disagree by ` +
    `more than one band, set axesDisagree=true and say so rather than smoothing it.\n\n` +
    `Then flag candidate mitigations from the references/mitigation-playbook.md §2 catalog. HARD RULE: ` +
    `only levers ALREADY IN PLACE count — set alreadyInPlace=false for anything that would have to be ` +
    `built, which makes it a loop-ship postmortem action item, never a mid-incident option.\n\n` +
    `Finally, apply the §1 exception test: could mitigating first destroy state needed to bound the ` +
    `damage, or spread it further (active data corruption, in-flight partial writes, exfiltration in ` +
    `progress, a retry storm)? Set dataIntegrityExceptionApplies accordingly.\n\n` +
    `Do NOT diagnose. Do NOT name a root cause. Return raw data conforming to the schema.`,
  optsFor({ taskType: 'analyze', phase: 'Triage', schema: TRIAGE_SCHEMA }, 'triage'),
)

if (!triage) {
  // H5: a dead agent resolves to null. Triage gates staffing, so this is worth surfacing loudly
  // rather than continuing with an unclassified incident.
  log('triage agent died — continuing to timeline reconstruction with severity UNCLASSIFIED (H5)')
} else {
  log(`triage: ${triage.severityLabel} (technical=${triage.technicalImpactBand}, axesDisagree=${triage.axesDisagree}) — ${triage.blastRadius}`)
  const usable = triage.candidateMitigations.filter((m) => m.alreadyInPlace)
  for (const m of triage.candidateMitigations.filter((m) => !m.alreadyInPlace)) {
    log(`mitigation NOT available (would have to be built → loop-ship action item): ${m.lever}`) // no silent drops (H6)
  }
  log(`${usable.length}/${triage.candidateMitigations.length} candidate levers already in place; dataIntegrityException=${triage.dataIntegrityExceptionApplies}`)
}

// ─── Stage 2 (Timeline fan-out) ─────────────────────────────────────────────────────────────
// No barrier WITHIN this stage: each investigator reads its own system and depends on no other
// investigator's output (H1/H2 — a per-item stage stays a pipeline stage).
const priorActions = (input.mitigations || [])
  .map((m) => `${m.at} · ${m.action} · outcome: ${m.outcome}`)
  .join('\n')

const slices = await parallel(
  SOURCES.map((s) => () =>
    agent(
      `Incident: ${input.incident}\nDeclared at: ${input.declaredAt}\n` +
        `Timeline window: ${input.windowStart} → ${input.windowEnd} (set generously; the deviation ` +
        `almost always predates the first alert, and mitigation effects are themselves timeline events)\n` +
        (priorActions ? `Actions already taken:\n${priorActions}\n` : '') +
        `\nYour source: ${s.prompt}\n\n` +
        `Return ONLY events from YOUR source. Report every timestamp as the RAW string your source ` +
        `recorded — do not convert it, do not round it, and never generate one. Carry every correlation ` +
        `id you find (trace_id, request_id, session_id, release id): the merge joins on identifiers, ` +
        `not on temporal proximity. State events FACTUALLY — what happened, never what it means; ` +
        `interpretation is loop-debug's, not this artifact's.\n` +
        `Report anything your source could NOT tell you in gaps[] — unretained history, sampled-out ` +
        `traces, an unobserved interval. A gap left silent reads later as a period in which nothing ` +
        `happened. Return raw data conforming to the schema.`,
      optsFor({ taskType: 'scout', phase: 'Timeline', schema: SLICE_SCHEMA }, `timeline:${s.key}`),
    ).then((r) => (r ? { key: s.key, slice: r } : null)),
  ),
)

// .filter(Boolean): a skipped or dead investigator resolves to null (harness policy H5).
const returned = slices.filter(Boolean)
const returnedKeys = returned.map((r) => r.key)
for (const s of SOURCES) {
  if (returnedKeys.indexOf(s.key) === -1) log(`source ${s.key} returned NOTHING — treat as an unobserved source, not as an absence of events (H6)`)
}
for (const r of returned) {
  if (r.slice.events.length === 0) log(`source ${r.key} returned 0 events${r.slice.gaps.length ? ` — gaps: ${r.slice.gaps.join('; ')}` : ''}`)
}

// ─── MERGE BARRIER (harness policy H2) ──────────────────────────────────────────────────────
// This is the one earned barrier in this script, and it is earned on H2's FIRST bullet —
// "dedup/merge across the full result set before expensive downstream work" — for two independent
// reasons, both of which require EVERY source to have reported:
//
//   1. ORDERING. An event from the trace source only sorts correctly against the deploy-history
//      and alert sources once every source is in hand. Clock-skew correction is derived from an
//      anchor event that several sources recorded independently, so the anchor itself cannot be
//      identified from a partial set — a streamed merge would emit an ordering it then has to
//      retract, and downstream (Reproduce, Postmortem) reads that ordering as causal structure.
//   2. DEDUPLICATION. The same event is routinely recorded twice by two systems (an error in the
//      application log and the same error in the tracer). Near-duplicates can only be collapsed
//      once the full set is present, and the surviving entry must carry BOTH attributions —
//      corroboration is signal and must not be discarded.
//
// Same shape as security-review.workflow.js's finder→dedup barrier and bug-diagnosis.workflow.js's
// hypothesis→verdict barrier, applied to timeline fragments instead of vulnerability findings or
// hypothesis verdicts. It is NOT "I need to flatten first", which H2 explicitly refuses.
//
// Done in plain JS: never spend an agent on ordering and dedup (loop policy L3).
const OFFSETS = (input && input.clockOffsetsMs) || {}
for (const r of returned) {
  if (typeof OFFSETS[r.key] !== 'number') log(`clock offset for ${r.key} not supplied — assuming 0ms; sub-second ordering against other sources is APPROXIMATE (reproduction-timeline.md §4)`)
}

const flat = []
const unparsed = []
for (const r of returned) {
  const offset = typeof OFFSETS[r.key] === 'number' ? OFFSETS[r.key] : 0
  for (const e of r.slice.events) {
    const parsed = Date.parse(e.timestamp) // deterministic: derived from the passed-through string, never from a clock
    if (isNaN(parsed)) {
      unparsed.push({ source: r.key, event: e })
      continue
    }
    flat.push({
      at: parsed + offset,
      rawTimestamp: e.timestamp,
      offsetApplied: offset,
      sources: [r.key + (e.sourceDetail ? ` (${e.sourceDetail})` : '')],
      event: e.event,
      detail: e.detail,
      correlationIds: e.correlationIds || [],
      placementConfidence: offset === 0 && typeof OFFSETS[r.key] !== 'number' ? 'approximate' : e.placementConfidence,
    })
  }
}
for (const u of unparsed) {
  // Never silently drop: an unparseable timestamp is an event that happened (H6).
  log(`UNPLACED event from ${u.source} — timestamp "${u.event.timestamp}" not parseable; appended unordered: ${u.event.event}`)
}

// Dedup on identity, not on text proximity. Prefer the correlation id when one exists; fall back
// to a coarse time bucket so two systems logging the same error a few hundred ms apart collapse.
const BUCKET_MS = 1000 // EDIT ME if the incident's interesting interval is finer than a second
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
const identity = (ev) => (ev.correlationIds.length ? `cid:${norm(ev.correlationIds[0])}::${norm(ev.event)}` : `t:${Math.round(ev.at / BUCKET_MS)}::${norm(ev.event)}`)

const merged = new Map()
let collapsed = 0
for (const ev of flat) {
  const k = identity(ev)
  const prior = merged.get(k)
  if (!prior) {
    merged.set(k, ev)
  } else {
    // Corroboration: keep the earliest placement and UNION the attributions. Two sources agreeing
    // is evidence and must remain visible after the merge.
    collapsed++
    if (ev.at < prior.at) prior.at = ev.at
    for (const src of ev.sources) if (prior.sources.indexOf(src) === -1) prior.sources.push(src)
    for (const cid of ev.correlationIds) if (prior.correlationIds.indexOf(cid) === -1) prior.correlationIds.push(cid)
    log(`corroborated @ ${prior.rawTimestamp}: "${prior.event}" now attributed to ${prior.sources.join(' + ')}`)
  }
}

const timeline = [...merged.values()].sort((a, b) => a.at - b.at)
const gaps = returned.flatMap((r) => r.slice.gaps.map((g) => `${r.key}: ${g}`))
log(`merge: ${flat.length} placed events from ${returned.length}/${SOURCES.length} sources → ${timeline.length} after dedup (${collapsed} corroborated, ${unparsed.length} unplaced)`)
for (const g of gaps) log(`timeline gap — ${g}`) // gaps are findings, and they become loop-operate action items

if (timeline.length === 0) {
  // Early-exit: the other legitimate use of the barrier (H2). Nothing to reproduce from.
  log('no placeable events from any source — take the SKILL §7 escape hatch and reconstruct inline')
  return { triage: triage || null, timeline: [], gaps, note: 'no placeable timeline events; sources unobserved or un-instrumented (reproduction-timeline.md §7)' }
}

// Render once, for the two downstream prompts. Cap explicitly and log the cap — no silent
// truncation (H6); the full merged timeline is returned to the caller regardless.
const RENDER_CAP = 200 // EDIT ME
const rendered = timeline.slice(0, RENDER_CAP).map((e) => `${e.rawTimestamp} [${e.sources.join(' + ')}] ${e.event}${e.correlationIds.length ? ` {${e.correlationIds.join(',')}}` : ''}`).join('\n')
if (timeline.length > RENDER_CAP) log(`prompt render capped at ${RENDER_CAP}/${timeline.length} events — the FULL merged timeline is still returned to the caller`)

const samples = returned.flatMap((r) => r.slice.failingSamples.map((f) => `${r.key}: ${f.trigger} {${f.correlationId}} — ${f.note}`)).join('\n')

// ─── Stage 4 (Reproduce) ────────────────────────────────────────────────────────────────────
// One agent. Building a harness is drafting/production work — the §M3 implement row.
const repro = await agent(
  `Build a faithful reproduction of this incident's failure, sourced FROM PRODUCTION.\n\n` +
    `Incident: ${input.incident}\nSeverity: ${triage ? triage.severityLabel : 'unclassified'}\n\n` +
    `Merged timeline:\n${rendered}\n\n` +
    (samples ? `Failing samples pulled from telemetry:\n${samples}\n\n` : '') +
    (gaps.length ? `Known gaps in the evidence:\n${gaps.join('\n')}\n\n` : '') +
    `Rules (references/reproduction-timeline.md §1-§2): REPLAY the real failing request from the ` +
    `telemetry above — do not synthesize a guess. Faithful means matching FOUR dimensions: exact ` +
    `deployed version, configuration INCLUDING feature-flag state at the moment of failure, data ` +
    `shape (sizes, encodings, null-vs-absent, cardinality), and load/concurrency pattern. Record ` +
    `which of the four you matched and which you approximated in fidelityGaps — a reproduction ` +
    `presented as faithful when load was not reproduced sends the diagnosis after hypotheses it ` +
    `structurally cannot test. Record the failure rate; intermittency is evidence, not a defect.\n\n` +
    `Redact production data: keep shape, length, encoding and type — those are frequently the trigger.\n\n` +
    `reproduced=false is a legitimate, honest result. Say so rather than producing a reproduction ` +
    `that fails for a DIFFERENT reason than the incident.\n\n` +
    `You may state a suspected fault region from timeline correlation — a head start on loop-debug ` +
    `§3 Localize. You must NOT name a root cause, state a causal chain, or write a test: those are ` +
    `loop-debug §4/§5/§6 and loop-test. Return raw data conforming to the schema.`,
  optsFor({ taskType: 'implement', phase: 'Reproduce', schema: REPRO_SCHEMA }, 'reproduce'),
)

if (!repro) log('reproduction agent died — handoff package will carry the timeline without a repro harness (H5)')
else log(`reproduce: reproduced=${repro.reproduced}, failureRate=${repro.failureRate}, fidelityGaps=${repro.fidelityGaps.length}`)

// ─── Stage 5 (Postmortem draft) ─────────────────────────────────────────────────────────────
// One agent. Judgment over a merged artifact — the §M3 synthesize row.
const postmortem = await agent(
  `Draft the blameless postmortem SHELL for this incident (references/postmortem.md).\n\n` +
    `Incident: ${input.incident}\nDeclared at: ${input.declaredAt}\n` +
    `Severity: ${triage ? `${triage.severityLabel} — ${triage.rationale}` : 'unclassified (triage agent did not return)'}\n` +
    `Impact axis: ${triage ? triage.blastRadius : 'unknown'}\n\n` +
    `Merged timeline:\n${rendered}\n\n` +
    (priorActions ? `Mitigations applied:\n${priorActions}\n\n` : '') +
    (gaps.length ? `Evidence gaps (each of these is an action item for loop-operate):\n${gaps.join('\n')}\n\n` : '') +
    (repro ? `Reproduction: reproduced=${repro.reproduced}; suspected fault region: ${repro.suspectedFaultRegion}\n\n` : '') +
    `HARD RULES:\n` +
    `1. rootCausePointer MUST remain a pointer — literally "see loop-debug diagnosis, attached once ` +
    `complete" with a status. Do NOT fill it with a hypothesis: a plausible cause written here ` +
    `becomes the accepted explanation and will not be revisited when the real diagnosis lands. A ` +
    `suspected fault region goes in contributingFactors, labelled as suspected.\n` +
    `2. BLAMELESS: replace the actor with the affordance. No counterfactuals about people ` +
    `("should have noticed", "failed to check"). "Human error" is never a contributing factor.\n` +
    `3. Contributing factors get CATEGORY BREADTH first — sweep the spines (code/change, ` +
    `configuration, data, dependencies, capacity, observability, process, coordination) — then ` +
    `depth. Every why-chain MUST terminate at a systemic, process, or infrastructure cause, never ` +
    `at a person; if a chain reaches a human action, keep going and ask why the system permitted it.\n` +
    `4. Every action item carries owner, due date, and a VERIFIABLE completion criterion, and names ` +
    `the skill it routes to: alert/runbook/SLO/instrumentation work → loop-operate; canary, staged ` +
    `rollout, rollback gate, migration discipline → loop-ship; code-level security audit → ` +
    `loop-review; regression test → loop-test; architectural change → loop-design. Do NOT perform ` +
    `any of them here.\n` +
    `5. Impact in NUMBERS, not adjectives.\n` +
    `6. recurrenceCheck: has this failure mode happened before, and why did the prior action item ` +
    `not prevent it (never completed / completed but ineffective / effective but eroded / wrong ` +
    `scope)? Record "no prior occurrence; searched by symptom, component and category" when there ` +
    `is none — that is a finding too.\n\n` +
    `This is a DRAFT. A human reviews and approves before it is final (references/postmortem.md §7). ` +
    `Return raw data conforming to the schema.`,
  optsFor({ taskType: 'synthesize', phase: 'Postmortem', schema: POSTMORTEM_SCHEMA }, 'postmortem-draft'),
)

if (!postmortem) log('postmortem agent died — timeline and reproduction are still returned; draft the shell manually (H5)')

log(`incident reconstruction [mode=${MODE}]: ${timeline.length} timeline events, repro=${repro ? repro.reproduced : 'none'}, postmortem=${postmortem ? 'drafted' : 'not drafted'}, ${gaps.length} evidence gaps`)

// The return value IS the SKILL §4 handoff package to loop-debug, plus the postmortem draft.
// Root cause, causal chain, minimal fix and regression test are deliberately absent — they are
// loop-debug §4/§5/§6, and producing them here would collapse the boundary this skill exists on.
return {
  handoffToLoopDebug: {
    severity: triage ? { label: triage.severityLabel, technicalImpactBand: triage.technicalImpactBand, blastRadius: triage.blastRadius, axesDisagree: triage.axesDisagree } : null,
    mitigationsApplied: input.mitigations || [],
    mitigationIsWorkaroundNotFix: true, // mitigation-playbook.md §5 — stated so loop-debug cannot misread a revert as a diagnosis
    reproduction: repro || null,
    timeline,
    evidenceGaps: gaps,
    unplacedEvents: unparsed.length,
  },
  postmortemDraft: postmortem || null,
  reviewGatePending: true, // references/postmortem.md §7 — a human approves before this is final
}
