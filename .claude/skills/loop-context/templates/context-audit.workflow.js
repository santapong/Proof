// Template: CONTEXT AUDIT — audit a target's context & state handling against loop-context's
// rules (SKILL.md §2–§5) and, where traces exist, check the four trace invariants (§6).
// Target: a repo's agent code, a workflow template, or a session transcript directory.
//
// Shape: inventory (scout) -> per-dimension audit via pipeline() (no barrier — dimensions are
// independent, H1/H2) -> per-finding evidence verify (WITHIN-finding lens vote, not a cross-item
// barrier) -> one synthesize join (earned: the report needs every dimension's findings at once).
// Verification judges EVIDENCE QUALITY only — does the cited line show what the finding claims —
// it never re-litigates the rule; the rules' authority lives in references/standards.md.
//
// Invoke with: Workflow({ script, args: { target: "<path or description>", mode: "optimize"|"full" } })

export const meta = {
  name: 'context-audit-template', // EDIT ME
  description: 'Audit context & state handling: budget, placement, compaction, state contract, supersession; verify findings against trace evidence', // EDIT ME
  phases: [
    { title: 'Inventory', detail: 'map the target’s context surfaces' },
    { title: 'Audit', detail: 'one dimension per agent, pipelined' },
    { title: 'Verify', detail: 'evidence check per finding' },
    { title: 'Report', detail: 'synthesize, ranked by cost' },
  ],
}

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
const TARGET = (input && input.target) || 'the current repository' // EDIT ME

// The five audit dimensions — one agent each, pipelined (H1: no barrier between audit and
// verify; a dimension's findings verify while another dimension is still auditing).
const DIMENSIONS = [
  { key: 'budget', rule: 'Context budgets: is an explicit token budget declared and derived from the 10–20%-of-window band? Flag any context assembly sized to the advertised window.' },
  { key: 'placement', rule: 'Placement: are instructions and decision-relevant material at the start AND end of assembled contexts? Flag decision-critical facts buried mid-context, and multi-hop tasks whose facts are scattered.' },
  { key: 'compaction', rule: 'Compaction: is anything compacted out still recoverable by pointer (addressable store)? Flag summarize-and-discard, whole-history re-summarization, and any compaction with no stated correctness obligation.' },
  { key: 'state', rule: 'State contract: is cross-agent/cross-phase state typed with declared per-field merge rules? Flag prose relays, concurrent writers with no merge rule, and phases that re-read raw inputs instead of the checkpoint.' },
  { key: 'supersession', rule: 'Supersession: do changeable facts carry valid-time and record-time? Do corrections append and point at what they supersede? Flag wholesale rewrites of accumulated config and retrieval that does not prefer the superseding fact.' },
]

const INVENTORY_SCHEMA = {
  type: 'object',
  properties: {
    surfaces: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },   // file/dir/transcript locus
          role: { type: 'string', enum: ['assembly', 'compaction', 'state-handoff', 'accumulator', 'trace'] },
          note: { type: 'string' },
        },
        required: ['path', 'role'],
      },
    },
  },
  required: ['surfaces'],
}
const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          where: { type: 'string' },   // file:line or transcript locus — the evidence pointer
          evidence: { type: 'string' }, // the quoted line(s) the claim rests on
          invariant: { type: 'string' }, // which §6 invariant it would violate, if any
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['title', 'where', 'evidence', 'severity'],
      },
    },
  },
  required: ['findings'],
}
const EVIDENCE_SCHEMA = {
  type: 'object',
  properties: { holds: { type: 'boolean' }, reason: { type: 'string' } },
  required: ['holds'],
}
const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    confirmed: { type: 'array', items: { type: 'object', properties: { dimension: { type: 'string' }, title: { type: 'string' }, where: { type: 'string' }, severity: { type: 'string' }, fix: { type: 'string' } }, required: ['dimension', 'title', 'where'] } },
  },
  required: ['summary', 'confirmed'],
}

phase('Inventory')
const inventory = await agent(
  `Target: ${TARGET}. Map its context surfaces: where contexts are assembled (prompts built, state handed between agents/phases), where anything is compacted/summarized/evicted, where facts or config accumulate across rounds or sessions, and where traces/transcripts live if any. Return paths and roles, not prose (role: assembly | compaction | state-handoff | accumulator | trace).`,
  optsFor({ taskType: 'scout', phase: 'Inventory', label: 'inventory', schema: INVENTORY_SCHEMA }),
)
const inventoryText = JSON.stringify((inventory && inventory.surfaces) || [])

// AUDIT -> VERIFY per dimension, no barrier (H1). Each finding must carry its evidence line;
// the verify stage checks the EVIDENCE (external, greppable) — not an opinion of the design.
const audited = await pipeline(
  DIMENSIONS,
  (d) =>
    agent(
      `Audit ${TARGET} on ONE dimension.\nInventory:\n${inventoryText}\n\nDimension [${d.key}]: ${d.rule}\nEvery finding MUST cite where (file:line or transcript locus) and quote the evidence line the claim rests on. A finding without quotable evidence is not a finding — leave it out. Return [] if the dimension is clean.`,
      optsFor({ taskType: 'analyze', phase: 'Audit', schema: FINDINGS_SCHEMA }, `audit:${d.key}`),
    ),
  (res, d) => {
    const findings = (res && res.findings) || []
    if (!findings.length) { log(`audit ${d.key}: clean`); return { d, confirmed: [] } }
    return parallel(
      findings.map((f) => () =>
        agent(
          `Verify EVIDENCE ONLY — do not re-judge the rule. Finding: ${f.title}\nClaimed locus: ${f.where}\nQuoted evidence: ${f.evidence}\nGo to the locus. Does the quoted line exist there, and does it show what the finding claims? holds=false if the quote is absent, altered, or does not support the claim.`,
          optsFor({ taskType: 'verify', phase: 'Verify', schema: EVIDENCE_SCHEMA }, `verify:${d.key}:${(f.title || '').slice(0, 40)}`),
        ).then((v) => (v && v.holds ? f : null)),
      ),
    ).then((checked) => {
      const confirmed = checked.filter(Boolean) // dead/failed verifiers drop the finding (H5): unverified is not confirmed
      log(`audit ${d.key}: ${findings.length} finding(s), ${confirmed.length} evidence-confirmed`)
      return { d, confirmed }
    })
  },
)

phase('Report')
// Earned barrier (H2): the report genuinely needs every dimension's confirmed findings at once —
// cross-dimension dedup and ranking are cross-item by definition.
const all = audited.filter(Boolean)
const report = await agent(
  `Synthesize the context-audit report for ${TARGET}. Confirmed findings by dimension:\n${JSON.stringify(all.map((a) => ({ dimension: a.d.key, findings: a.confirmed })))}\n\nDedup across dimensions (one defect can surface under two rules — report it once, under the dimension whose fix is cheapest). Rank by severity then by blast radius. For each: the concrete fix, phrased against the rule it violates. In the summary, name the dimensions that came back clean — a clean dimension is a result, not an omission.`,
  optsFor({ taskType: 'synthesize', phase: 'Report', schema: REPORT_SCHEMA }, 'report'),
)

const total = all.reduce((n, a) => n + a.confirmed.length, 0)
log(`done: ${total} evidence-confirmed finding(s) across ${DIMENSIONS.length} dimensions · mode=${MODE}`)
return { target: TARGET, executionMode: MODE, report, byDimension: all.map((a) => ({ dimension: a.d.key, confirmed: a.confirmed })) }
