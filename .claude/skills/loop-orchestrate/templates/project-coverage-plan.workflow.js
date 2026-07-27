export const meta = {
  name: 'project-coverage-plan',
  description: 'Plan a project for COVERAGE, not just coherence: three planners frame it independently, a reconciler adjudicates what only one of them found, a roster sweep forces an include/exclude decision for every skill, gap-hunter rounds run until dry, and every surviving node ships a charter.',
  phases: [
    { title: 'Frame', detail: '3 independent planners — risk-first, user-first, delivery-first' },
    { title: 'Reconcile', detail: 'diff the three; single-planner items are the signal' },
    { title: 'Roster', detail: 'include/exclude every skill, with justification' },
    { title: 'Gaps', detail: 'hunter rounds until K consecutive rounds surface nothing' },
    { title: 'Charter', detail: 'objective, acceptance criterion and out-of-scope per node' },
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
const DRY_LIMIT = MODE === 'all-out' ? 3 : MODE === 'lite' ? 1 : 2
// §M8 omission note: DRY_LIMIT is declared here rather than inside the canonical block so the block
// stays byte-identical across every template; loop policy L1's K is mode-conditional (§M5).

// EDIT ME — the project to plan, and where the skills live.
const PROJECT = (input && input.project) || 'the project described by the caller'
const REPO = (input && input.repoPath) || '.'
const MAX_ROUNDS = 4 // safety backstop; the dry counter is the real terminal condition (L4)

const SKILLS = [
  'loop-engine', 'loop-orchestrate', 'loop-skill',
  'loop-design', 'loop-algo', 'loop-pattern', 'loop-frontend',
  'loop-test', 'loop-review', 'loop-audit', 'loop-debug',
  'loop-integrate', 'loop-ship', 'loop-operate', 'loop-incident',
  'loop-research', 'loop-scout', 'loop-docs', 'loop-harness', 'loop-autopilot',
]

const FRAMINGS = [
  { id: 'risk-first', ask: 'What could go wrong, and what must not break?',
    surfaces: 'security, migration hazards, rollback, blast radius, data loss, compliance' },
  { id: 'user-first', ask: 'What outcome does someone actually need, and how will they know they have it?',
    surfaces: 'acceptance criteria, documentation, UX and accessibility, the real definition of done' },
  { id: 'delivery-first', ask: 'What must ship, in what order, and what blocks what?',
    surfaces: 'dependencies, sequencing, environments, CI, the critical path' },
]

const HOUSE = 'Project to plan: ' + PROJECT + '\nPlugin skills live at ' + REPO + '/.claude/skills/. ' +
  'Read ' + REPO + '/.claude/skills/loop-orchestrate/references/coverage-planning.md and task-decomposition.md first. ' +
  'Name DELIVERABLES, never activities — "returns the list of auth call-sites and their guards", not "investigate auth". ' +
  'Your final text IS the return value: structured data only, no preamble.'

const ITEM = {
  type: 'object', additionalProperties: false,
  required: ['id', 'deliverable', 'why', 'owningSkill'],
  properties: {
    id: { type: 'string' }, deliverable: { type: 'string' }, why: { type: 'string' },
    owningSkill: { type: 'string', description: 'Which loop-* skill owns it, or "none" if no skill fits — a "none" is itself a finding.' },
    dependsOn: { type: 'array', items: { type: 'string' } },
  },
}
const PLAN_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['framing', 'items', 'assumptions'],
  properties: {
    framing: { type: 'string' },
    items: { type: 'array', minItems: 3, items: ITEM },
    assumptions: { type: 'array', items: { type: 'string' }, description: 'What you assumed that nobody has verified.' },
  },
}

log('Coverage planning in --mode ' + MODE + ': 3 framings, reconcile, roster sweep, gaps until dry(' + DRY_LIMIT + '), charters.')

// Stage 1: three framings, INDEPENDENTLY. No planner sees another's output — a planner shown a
// prior plan anchors to it and confirms rather than diverges, which destroys the whole mechanism.
const plans = (await parallel(FRAMINGS.map((f) => () => agent(
  HOUSE + '\n\n=== YOUR FRAMING: ' + f.id + ' ===\nAsk only this question of the project: **' + f.ask + '**\n' +
  'A ' + f.id + ' reading reliably surfaces ' + f.surfaces + ' — but do not restrict yourself to that list, and ' +
  'do not try to write a balanced plan. Plan the project AS IF your framing were the only thing that mattered. ' +
  'Another planner is covering the other angles; your job is depth in yours, not breadth across all of them. ' +
  'A deliberately lopsided plan is more useful here than a diplomatic one.',
  optsFor({ taskType: 'planner', phase: 'Frame', schema: PLAN_SCHEMA }, 'frame:' + f.id)
)))).filter(Boolean)

log('Framings returned: ' + plans.length + '/3' + (plans.length < 3 ? ' — a missing framing is a coverage gap, not a pass.' : ''))
if (!plans.length) { log('FATAL: no planner returned. Nothing to reconcile.'); return { aborted: 'no plans' } }

// EARNED BARRIER (H2): the reconciler's input is the DIFFERENCES between the plans, so it needs all
// three at once. A per-item hand-off cannot express "only one planner found this".
const RECON_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['consensus', 'singlePlanner', 'contradictions', 'merged'],
  properties: {
    consensus: { type: 'array', items: { type: 'string' }, description: 'Item ids/deliverables all framings found. High confidence.' },
    singlePlanner: {
      type: 'array',
      description: 'Found by exactly ONE framing — the highest-value signal here. Adjudicate each; never drop silently.',
      items: {
        type: 'object', additionalProperties: false,
        required: ['deliverable', 'foundBy', 'verdict', 'reasoning'],
        properties: {
          deliverable: { type: 'string' }, foundBy: { type: 'string' },
          verdict: { type: 'string', enum: ['real-gap-others-missed', 'invention-drop', 'needs-human-ruling'] },
          reasoning: { type: 'string' },
        },
      },
    },
    contradictions: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['topic', 'positions', 'likelyCause'], properties: { topic: { type: 'string' }, positions: { type: 'array', items: { type: 'string' } }, likelyCause: { type: 'string' } } } },
    merged: { type: 'array', items: ITEM },
  },
}
const recon = await agent(
  HOUSE + '\n\n=== RECONCILE ===\nThree planners framed this project independently. **Your input is the diff, not the plans.**\n\n' +
  '1. **Consensus** — found by all three. Real scope, high confidence.\n' +
  '2. **Single-planner items** — found by exactly ONE. This is the highest-value signal in the method: it is either a ' +
  'genuine insight the other framings were structurally blind to, or that planner inventing work. Adjudicate EVERY one. ' +
  '**Never drop a single-planner item silently** — doing so discards exactly the coverage the diversity bought. ' +
  'Where you cannot decide, mark it needs-human-ruling rather than guessing.\n' +
  '3. **Contradictions** — where two planners disagree, especially on sequencing. That usually means a real constraint ' +
  'nobody has stated. Surface it; do not average it away.\n\n' +
  '=== THE THREE PLANS ===\n' + JSON.stringify(plans),
  optsFor({ taskType: 'synthesize', phase: 'Reconcile', schema: RECON_SCHEMA }, 'reconcile')
)
if (!recon) { log('FATAL: reconcile returned nothing.'); return { aborted: 'no reconcile', plans } }
log('Reconciled: ' + (recon.consensus || []).length + ' consensus, ' + (recon.singlePlanner || []).length + ' single-planner, ' + (recon.contradictions || []).length + ' contradiction(s).')

// Stage 3: roster sweep — force a decision for every skill. Catches the forgot-a-whole-phase class.
const ROSTER_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['rows'],
  properties: {
    rows: {
      type: 'array', minItems: 20,
      items: {
        type: 'object', additionalProperties: false,
        required: ['skill', 'decision', 'justification'],
        properties: {
          skill: { type: 'string' },
          decision: { type: 'string', enum: ['include', 'exclude'] },
          justification: { type: 'string', description: 'An include names its DELIVERABLE. An exclude says why the project has no surface for it. "Probably not needed" is not a justification.' },
        },
      },
    },
  },
}
const roster = await agent(
  HOUSE + '\n\n=== ROSTER SWEEP ===\nWalk ALL TWENTY skills and return a row for each — no skipping, no shortening.\n' +
  'Read each skill\'s `description` frontmatter before deciding; do not judge from the name.\n\n' +
  '**The exclusions matter more than the inclusions.** An unjustified exclusion is the "we forgot testing entirely" ' +
  'gap wearing a checkmark. An exclude must say why the project has no SURFACE for that skill — "probably not needed" ' +
  'is not a justification, and if you cannot say why, the answer is include-and-scope-later.\n' +
  '**An include must name its deliverable**, not just the skill.\n\n' +
  'SKILLS: ' + SKILLS.join(', ') + '\n\n=== PLAN SO FAR ===\n' + JSON.stringify(recon.merged || []),
  optsFor({ taskType: 'analyze', phase: 'Roster', schema: ROSTER_SCHEMA }, 'roster')
)
const included = ((roster && roster.rows) || []).filter((r) => r.decision === 'include')
log('Roster: ' + included.length + ' included / ' + (((roster && roster.rows) || []).length) + ' skills decided.')

// Stage 4: gap hunt until dry. Each round asks a DIFFERENT question — a repeated question returns
// a repeated answer. Dedup against everything SEEN, not against what survived (L3).
const GAP_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['gaps'],
  properties: { gaps: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['deliverable', 'why', 'owningSkill'], properties: { deliverable: { type: 'string' }, why: { type: 'string' }, owningSkill: { type: 'string' } } } } },
}
const ANGLES = [
  'What does this plan ASSUME that nobody has verified? Name the assumption and the node that would verify it.',
  'What BREAKS if the single largest assumption is wrong? What node would catch that before it is expensive?',
  'What does the plan PRODUCE that no node consumes, and what does a node CONSUME that nothing produces?',
  'Who is ACCOUNTABLE for the parts nobody named? Find the work that falls between two nodes.',
  'What would make this plan look NAIVE in hindsight, to someone reviewing it after it failed?',
]
const seen = new Set((recon.merged || []).map((i) => String(i.deliverable).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50)))
const extra = []
let dry = 0
for (let round = 0; round < MAX_ROUNDS && dry < DRY_LIMIT; round++) {
  const angle = ANGLES[round % ANGLES.length]
  const found = await agent(
    HOUSE + '\n\n=== GAP HUNT, round ' + (round + 1) + ' ===\n' + angle + '\n\n' +
    'Return only gaps NOT already in the plan below. An empty array is a valid and useful answer — do not invent ' +
    'work to seem thorough, because a padded plan costs the same as a real one.\n\n' +
    '=== PLAN ===\n' + JSON.stringify((recon.merged || []).concat(extra)) +
    '\n\n=== SKILLS INCLUDED ===\n' + JSON.stringify(included.map((r) => r.skill)),
    optsFor({ taskType: 'critic', phase: 'Gaps', schema: GAP_SCHEMA }, 'gaps:r' + (round + 1))
  )
  const fresh = ((found && found.gaps) || []).filter((g) => {
    const k = String(g.deliverable).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50)
    if (seen.has(k)) return false
    seen.add(k)   // dedup against SEEN, never against what survived (L3) — else rejects reappear forever
    return true
  })
  extra.push(...fresh)
  dry = fresh.length ? 0 : dry + 1
  log(`gap round ${round + 1} [mode=${MODE}]: ${fresh.length} fresh, dry=${dry}/${DRY_LIMIT}`)
}
if (dry < DRY_LIMIT) log(`NOTE: stopped at the ${MAX_ROUNDS}-round safety cap without going dry — the tail is NOT exhausted. Treat coverage as partial.`)

// Stage 5: charter every node. A plan that names tasks produces agents that improvise.
const CHARTER_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['nodes', 'residualRisk'],
  properties: {
    nodes: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'objective', 'acceptanceCriterion', 'outOfScope', 'inputs', 'owningSkill', 'doneMeans', 'taskType', 'dependsOn'],
        properties: {
          id: { type: 'string' },
          objective: { type: 'string', description: 'One line naming the DELIVERABLE, not the activity.' },
          acceptanceCriterion: { type: 'string', description: 'Checkable in one line. If you cannot write it, the node is underspecified.' },
          outOfScope: { type: 'string', description: 'Explicit. This is what stops an agent helpfully expanding into a neighbour node.' },
          inputs: { type: 'string' },
          owningSkill: { type: 'string' },
          doneMeans: { type: 'string', description: 'What the NEXT node needs from this one to start.' },
          taskType: { type: 'string', enum: ['scout', 'analyze', 'implement', 'verify', 'judge', 'synthesize', 'critic', 'doc'] },
          dependsOn: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    residualRisk: { type: 'string', description: 'What this method could NOT check. An unstated residual is worse than a stated one.' },
  },
}
const charters = await agent(
  HOUSE + '\n\n=== CHARTER EVERY NODE ===\nTurn the accumulated scope into a charter per node. An agent that cannot ' +
  'restate its charter in one line has not been given one.\n\n' +
  '**outOfScope is the highest-leverage field.** Agents fail far more often by doing adjacent work badly than by ' +
  'doing their own work badly, and an unbounded objective invites exactly that. Fill it for every node.\n' +
  '**acceptanceCriterion must be checkable.** If you cannot write one, the node is underspecified — decompose it.\n\n' +
  'Close with residualRisk: what this method could not check. Be concrete; "some gaps may remain" is not useful.\n\n' +
  '=== CONSENSUS + MERGED ===\n' + JSON.stringify(recon.merged || []) +
  '\n\n=== SINGLE-PLANNER ADJUDICATIONS ===\n' + JSON.stringify(recon.singlePlanner || []) +
  '\n\n=== ROSTER INCLUDES ===\n' + JSON.stringify(included) +
  '\n\n=== GAPS FOUND ===\n' + JSON.stringify(extra),
  optsFor({ taskType: 'planner', phase: 'Charter', schema: CHARTER_SCHEMA }, 'charter')
)

const nodes = (charters && charters.nodes) || []
log('Charters: ' + nodes.length + ' nodes. Unresolved for the human: ' +
    ((recon.singlePlanner || []).filter((s) => s.verdict === 'needs-human-ruling').length + (recon.contradictions || []).length))

return {
  mode: MODE,
  project: PROJECT,
  framings: plans.map((p) => p.framing),
  reconcile: recon,
  roster: (roster && roster.rows) || [],
  gapsFound: extra,
  wentDry: dry >= DRY_LIMIT,
  nodes,
  residualRisk: charters && charters.residualRisk,
  forHuman: {
    needsRuling: (recon.singlePlanner || []).filter((s) => s.verdict === 'needs-human-ruling'),
    contradictions: recon.contradictions || [],
  },
}
