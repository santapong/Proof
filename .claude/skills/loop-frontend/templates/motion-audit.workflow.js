export const meta = {
  name: 'motion-audit',
  description: 'Audit every animated interaction on a surface: inventory the motion, audit each interaction independently, then reconcile the total budget and the house curve set across all of them.',
  phases: [
    { title: 'Inventory', detail: 'enumerate every animated interaction on the surface' },
    { title: 'Audit', detail: 'one agent per interaction — budget, curve, rung, reduced-motion branch' },
    { title: 'Reconcile', detail: 'total budget and curve consistency — cross-item, so a barrier' },
  ],
}

// Normalize args defensively (H10): some harnesses deliver args as a string.
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
// §M8 omission note: DRY_LIMIT is omitted — this template has no loop. The interaction list is
// enumerated first and is therefore a known work-list, which per loop policy L6 is never a loop.

// EDIT ME — the surface under audit.
const SURFACE = (input && input.surface) || 'the current page'
const ROOT = (input && input.repoPath) || '.'

const HOUSE = 'You are auditing motion on: ' + SURFACE + ' (repo ' + ROOT + '). ' +
  'Read ../references/choreography.md, ../references/accessibility.md and ../references/motion-toolkit.md first. ' +
  'READ-ONLY — report, do not edit. Cite file:line for everything. Your final text IS the return value.'

const INVENTORY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['interactions'],
  properties: {
    interactions: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'what', 'file', 'trigger'],
        properties: {
          id: { type: 'string' },
          what: { type: 'string', description: 'The animated behaviour, in one line.' },
          file: { type: 'string', description: 'file:line where it is defined.' },
          trigger: { type: 'string', enum: ['user-direct', 'system-response', 'scroll', 'auto-start', 'route-change'] },
        },
      },
    },
  },
}

const AUDIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'durationMs', 'easing', 'rung', 'rungJustified', 'compositorSafe', 'reducedMotion', 'findings'],
  properties: {
    id: { type: 'string' },
    durationMs: { type: 'number', description: 'Total perceived duration. For a stagger, N x interval — not the per-item duration.' },
    easing: { type: 'string' },
    rung: { type: 'number', description: '1 transition, 2 keyframes, 3 view-transition, 4 scroll-driven, 5 WAAPI, 6 library.' },
    rungJustified: { type: 'string', description: 'If rung 6, WHICH of the five reasons. If none applies, say so — that is a finding.' },
    compositorSafe: { type: 'boolean', description: 'true only if it animates transform/opacity alone. filter, box-shadow and layout properties are NOT compositor-only.' },
    reducedMotion: { type: 'string', enum: ['substitutes', 'removes', 'absent'] },
    runtimeChecks: {
      type: 'array',
      description: 'Which checks from ../references/verifying-motion.md this interaction needs. Static reading cannot confirm most of them.',
      items: { type: 'string', enum: ['reduced-motion-substitutes', 'no-layout-property-animated', 'focus-follows-view-transition', 'no-focus-trap-in-pin', 'layout-shift-under-scroll', 'flash-threshold', 'sequence-budget', 'visual-checkpoint'] },
    },
    findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['severity', 'claim', 'fix'],
        properties: {
          severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
          claim: { type: 'string' },
          fix: { type: 'string' },
        },
      },
    },
  },
}

const RECONCILE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['curveSet', 'durationSet', 'totalBudgetMs', 'systemicFindings', 'verdict'],
  properties: {
    curveSet: { type: 'array', items: { type: 'string' }, description: 'Every distinct easing curve in use. More than ~3 is a consistency defect.' },
    durationSet: { type: 'array', items: { type: 'number' } },
    totalBudgetMs: { type: 'number', description: 'Worst-case total if a user triggers the entry sequence once.' },
    systemicFindings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['severity', 'claim', 'fix'],
        properties: { severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, claim: { type: 'string' }, fix: { type: 'string' } },
      },
    },
    verdict: { type: 'string' },
  },
}

log('Motion audit on ' + SURFACE + ' in --mode ' + MODE + '.')

// @smoke-allow-single-call — a HARNESS limitation, not a property of this template. smoke.mjs's
// agent() stub returns `interactions: []` from its base object, so the inventory below always
// comes back empty under smoke and the (correct) "nothing to audit" early return fires after one
// call. Real runs reach the per-interaction fan-out and the reconcile step. If the stub is ever
// enriched to return a non-empty inventory, DELETE this opt-out rather than keeping it.
const inv = await agent(
  HOUSE + '\n\nEnumerate EVERY animated interaction on this surface: CSS transitions and keyframes, ' +
  'WAAPI calls, view transitions, scroll-driven animations, and any library-driven motion. Include ambient ' +
  'and auto-starting motion — loops, marquees, carousels, live counters — which are the ones most often missed ' +
  'and the ones SC 2.2.2 bites hardest.',
  optsFor({ taskType: 'scout', phase: 'Inventory', schema: INVENTORY_SCHEMA }, 'inventory')
)

const items = (inv && inv.interactions) || []
if (!items.length) {
  log('No animated interactions found — nothing to audit.')
  return { surface: SURFACE, mode: MODE, interactions: [], note: 'inventory returned no motion' }
}
log('Found ' + items.length + ' animated interaction(s).')

const audits = await parallel(items.map((it) => () => agent(
  HOUSE + '\n\nAudit ONE interaction: ' + it.what + '  (' + it.file + ', trigger: ' + it.trigger + ')\n\n' +
  'Check, in this order:\n' +
  '1. BUDGET — is the total perceived duration right for its trigger? user-direct ~100ms, system-response ~400ms ceiling. ' +
  'For a stagger, the budget is N x interval, not the per-item duration.\n' +
  '2. EASING — is it asymmetric (decelerate in, accelerate out), or is it one curve for both, or linear?\n' +
  '3. RUNG — the lowest rung that delivers this effect. If it uses a library, which of the five reasons justifies it? ' +
  'If none does, that is a major finding: the effect belongs on a lower rung.\n' +
  '4. COMPOSITOR — does it animate transform/opacity ONLY? filter, box-shadow, background-position, width, height, ' +
  'top, left, margin and flex-basis are NOT compositor-only and cause per-frame layout or paint.\n' +
  '5. REDUCED MOTION — is there a branch, and does it SUBSTITUTE a gentler equivalent rather than just deleting? ' +
  'Absent is a blocker. For scroll-, pointer- or parallax-driven motion, the branch must disable it by default.\n' +
  '6. FLASH — anything flashing more than three times per second is a BLOCKER under WCAG 2.2 SC 2.3.1 Level A.\n' +
  '7. AUTO-START — if it auto-starts and runs over 5s alongside other content, or auto-updates at all, ' +
  'it needs a pause/stop/hide control (SC 2.2.2 Level A).\n' +
  '8. RUNTIME CHECKS — list which checks from ../references/verifying-motion.md this interaction needs. ' +
  'You are reading SOURCE; most of the rules above cannot be confirmed that way, so say what a browser would ' +
  'have to assert. Be honest where your own verdict above is a static guess rather than an observation.',
  optsFor({ taskType: 'analyze', phase: 'Audit', schema: AUDIT_SCHEMA }, 'audit:' + it.id)
)))

// EARNED BARRIER (H2): the total motion budget and the house curve set are CROSS-ITEM properties.
// No per-interaction pass can see that eleven interactions use nine different easing curves, or that
// the entry sequence sums to 1.4s. That reduce is the whole point of this stage.
const got = audits.filter(Boolean)
log('Audited ' + got.length + '/' + items.length + (got.length < items.length ? ' — unaudited interactions are a coverage gap, not a pass.' : ''))

const reconcile = await agent(
  HOUSE + '\n\nReconcile the whole surface. Per-interaction audits are below; your job is what NONE of them could see:\n' +
  '1. CURVE SET — how many distinct easing curves are in use across the surface? More than about three reads as ' +
  'several developers rather than one design. Name the house set it should collapse to.\n' +
  '2. TOTAL BUDGET — if a user triggers the entry sequence once, what is the worst-case total? Individually crisp ' +
  'animations routinely sum to something sluggish.\n' +
  '3. FOCAL POINT — do several things animate on entry? If so, none of them is the point.\n' +
  '4. CONSISTENCY — do equivalent interactions animate equivalently? Two modals with different curves is a defect.\n\n' +
  '=== PER-INTERACTION AUDITS ===\n' + JSON.stringify(got),
  optsFor({ taskType: 'synthesize', phase: 'Reconcile', schema: RECONCILE_SCHEMA }, 'reconcile')
)

const blockers = got.flatMap((a) => (a.findings || []).filter((f) => f.severity === 'blocker'))
  .concat(((reconcile && reconcile.systemicFindings) || []).filter((f) => f.severity === 'blocker'))
log('Audit complete: ' + blockers.length + ' blocker(s) — accessibility gates, not preferences.')

return {
  surface: SURFACE,
  mode: MODE,
  interactions: got,
  reconcile,
  blockers,
  unaudited: items.length - got.length,
  // The check spec hands off to loop-test, which authors the files in the project's own stack.
  runtimeCheckSpec: got.map((a) => ({ id: a.id, checks: a.runtimeChecks || [] })).filter((c) => c.checks.length),
  caveat: 'Every verdict above is read from SOURCE. Reduced-motion substitution, focus behaviour, flash thresholds, ' +
          'CLS and sequence budgets are only confirmable in a browser — see ../references/verifying-motion.md.',
}
