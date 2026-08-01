// Template: V1 CONDUCTOR — realize one gated phase of a version-one conduct.
// This is an ordinary ../../loop-engine script under the unchanged harness policy.
// The loop-build additions: three planner FRAMINGS reconciled by the single decompose
// node (multi-planner coverage), delegated-law task prompts (each task authored
// against its owning skill's references), SEQUENTIAL gating dispatch (§M5's
// dispatch rule), one bounded repair round, and the cumulative cast ledger.
//
// Invoke with: Workflow({ script, args: { brief, phase, tasks?, mode, planner, fableGate } })
// input.brief    — the project brief + the v1 line, threaded into every prompt
// input.phase    — which gated phase this run realizes (matches meta.phases usage)
// input.tasks    — optional pre-planned work-list; when absent, Plan produces it
// input.mode / input.planner / input.fableGate — the §M2 flags, as real JSON values

export const meta = {
  name: 'v1-conductor',
  description: 'One gated phase of a version-one conduct: multi-planner plan, delegated-law build, sequential gating verify with a bounded repair round',
  phases: [
    { title: 'Plan', detail: 'three independent framings, one reconcile, roster-checked task DAG' },
    { title: 'Build', detail: 'per-task implement under the owning skill’s law' },
    { title: 'Gate', detail: 'sequential gating lenses, one repair round, completeness critic' },
  ],
}

// Some harnesses deliver args as a JSON-encoded string — normalize before use.
const input = typeof args === 'string' ? JSON.parse(args) : args

// Approved at the §M6 pre-flight for all-out runs; zeros under lite/balanced.
const ESTIMATE = (input && input.estimate) || { agents: 0, tokensLow: 0, tokensHigh: 0 }

// ---------------------------------------------------------------------------
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
// §M7 fallback. A Fable refusal and the HTTP 400 a zero-retention org gets on every Fable request
// both surface the same way — agent() resolves to null — so one `||`-shaped retry covers both.
// Planner nodes dispatch through this; nothing else does. There is no latency trigger: H10 forbids
// a script reading a clock, so elapsed time is not measurable in here (§M7).
async function plannerAgent(prompt, node, label) {
  const opts = optsFor(node, label)
  if (!PLANNER) return agent(prompt, opts)
  log('--planner fable routes the decompose node to claude-fable-5. Tradeoffs: markedly higher latency (a minutes-long turn on a gate-blocking node), a broader class of refusals than the rest of the fleet, and a 30-day data-retention requirement — an organization with zero data retention receives an HTTP 400 rather than a degraded result. On a refusal or a 400, this node falls back to claude-opus-5 at max effort and the fallback is logged.')
  const out = await agent(prompt, opts)
  if (out) {
    log(`cast · node=${label || node.label} kind=planner mode=${MODE} model=claude-fable-5 effort=${routeFor('planner').effort} width=1 · --planner fable`)
    return out
  }
  log('planner fallback: claude-fable-5 returned nothing (refusal, or HTTP 400 under zero data retention) → claude-opus-5 at max (§M7)')
  return agent(prompt, Object.assign({}, opts, { model: 'claude-opus-5', effort: 'max' }))
}
const FABLE_GATE = MODE === 'all-out' && (input && input.fableGate) === true // --fable-gate (§M7b)
// §M7b opt-in. One lens of an all-out gating vote may run Fable; a refusal and the
// ZDR HTTP 400 both surface as null, so the same ||-shaped fallback applies. Only a
// gating verify fan-out dispatches through this, and only for lensIndex 0.
async function fableGateAgent(prompt, node, lensIndex, label) {
  const opts = optsFor(node, label)
  if (!FABLE_GATE || lensIndex !== 0) return agent(prompt, opts)
  log('--fable-gate routes one lens of the gating verify to claude-fable-5. Tradeoffs: markedly higher latency for that lens, a broader class of refusals than the rest of the fleet, and a 30-day data-retention requirement — a zero-data-retention organization receives an HTTP 400 rather than a degraded result. On a refusal or a 400 the lens falls back to claude-opus-5 at max effort; the fallback is logged and the vote proceeds either way.')
  const out = await agent(prompt, Object.assign({}, opts, { model: 'claude-fable-5' }))
  if (out) {
    log(`cast · node=${label || node.label} kind=gating lens=${lensIndex} mode=${MODE} model=claude-fable-5 effort=${opts.effort} · --fable-gate`)
    return out
  }
  log('fable-gate fallback: claude-fable-5 returned nothing (refusal, or HTTP 400 under zero data retention) → claude-opus-5 at max (§M7b)')
  return agent(prompt, Object.assign({}, opts, { model: 'claude-opus-5', effort: 'max' }))
}
// This phase has no loop, so DRY_LIMIT is omitted (§M8). No other local variation is permitted.
// ---------------------------------------------------------------------------

const FRAMING_SCHEMA = {
  type: 'object',
  properties: {
    framing: { type: 'string' },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          description: { type: 'string' },
          owner: { type: 'string' },
          kind: { type: 'string' },
        },
        required: ['id', 'description', 'owner'],
      },
    },
    risks: { type: 'array', items: { type: 'string' } },
  },
  required: ['framing', 'tasks'],
}
const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    tasks: FRAMING_SCHEMA.properties.tasks,
    adjudications: { type: 'array', items: { type: 'string' } },
    rosterExclusions: { type: 'array', items: { type: 'string' } },
  },
  required: ['tasks', 'adjudications', 'rosterExclusions'],
}
const DRAFT_SCHEMA = {
  type: 'object',
  properties: { files: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
  required: ['files', 'summary'],
}
const VERDICT_SCHEMA = {
  type: 'object',
  properties: { ok: { type: 'boolean' }, reason: { type: 'string' } },
  required: ['ok', 'reason'],
}
const CRITIC_SCHEMA = {
  type: 'object',
  properties: { gaps: { type: 'array', items: { type: 'string' } } },
  required: ['gaps'],
}

const BRIEF = input.brief
const PHASE = input.phase || 'Construction'
const SKILLS = '/the plugin’s .claude/skills' // owners resolve against the installed fleet

// Node shells. Rationales name the mode (loop-orchestrate step 6).
const framingNode = {
  label: 'plan:framing', taskType: 'analyze', phase: 'Plan', schema: FRAMING_SCHEMA,
  rationale: 'candidate framings are analyses; only the reconcile is THE decompose node everything downstream inherits, so it alone takes the planner route (§M3/§M7)',
}
const reconcileNode = {
  label: 'plan:reconcile', taskType: 'planner', phase: 'Plan', schema: PLAN_SCHEMA,
  rationale: 'single decompose over all framings → planner route: pinned claude-opus-5 in every mode; the one node --planner fable may take (§M7)',
}
const buildNode = {
  label: 'build', taskType: 'implement', phase: 'Build', schema: DRAFT_SCHEMA,
  rationale: 'production work → implement route per mode column (H8)',
}
const gateNode = {
  label: 'gate', taskType: 'gating', phase: 'Gate', schema: VERDICT_SCHEMA,
  rationale: 'a false all-clear ships the defect → gating route, pinned claude-opus-5 in every mode; width 1/3/5 by mode (§M5), dispatched sequentially per §M5’s dispatch rule',
  lenses: [
    'correctness: does the work do exactly what the task and the v1 line ask?',
    'law: does it obey the owning skill’s non-negotiables (cite the reference it violates)?',
    'regression: what previously-working behavior or sibling task does this break?',
    'completeness: what part of the task was silently skipped or narrowed?',
    'contract: does it change a promise another task or the v1 line depends on?',
  ],
}
const criticNode = {
  label: 'critic', taskType: 'critic', phase: 'Gate', schema: CRITIC_SCHEMA,
  rationale: 'completeness pass (H12) → critic route; width 1/1/3 by mode over the declared lenses',
  lenses: [
    'broad: anything missing versus the v1 line — tasks, tests, docs, release readiness',
    'coverage: which roster exclusion now looks wrong, which framing item was lost?',
    'next: what belongs on the v2 backlog rather than in this phase?',
  ],
}

for (const n of [framingNode, reconcileNode, buildNode, gateNode, criticNode]) {
  const r = routeFor(n.taskType)
  const model = (PLANNER && n.taskType === 'planner' ? PLANNER : r.model) || 'inherit'
  log(`cast ${n.label} [${n.taskType}] mode:${MODE} → model:${model} effort:${r.effort || '—'} width:${WIDTH(n.taskType)} — ${n.rationale}`)
}
if (MODE === 'all-out') {
  log(`ESTIMATE approved at the §M6 pre-flight: ${ESTIMATE.agents} agents, ${ESTIMATE.tokensLow}–${ESTIMATE.tokensHigh} output tokens`)
}

// ---------------------------------------------------------------------------
// Plan — three independent framings (a genuine parallel: they must not see each
// other), then ONE reconcile that consumes the full set. Barrier earned (H2).
// Skipped when the phase arrives with a pre-planned work-list (loop policy L6).
// ---------------------------------------------------------------------------
let tasks = (input.tasks || []).slice()
let adjudications = []
let rosterExclusions = []
if (!tasks.length) {
  const FRAMINGS = ['MVP-first: the smallest path to the v1 line', 'risk-first: what kills the project, addressed earliest', 'user-first: the walkthrough a first user actually takes']
  if (MODE === 'all-out') {
    log(`modifier-A: suppressed (mode=all-out) — ${FRAMINGS.length}-framing fan-out running at ceiling by design`)
  }
  const framings = await parallel(
    FRAMINGS.map((f) => () =>
      agent(
        `Project brief and v1 line: ${BRIEF}\nFrame the version-one plan strictly from this angle: ${f}. Decompose into tasks; every task names its owning skill (the fleet lives under ${SKILLS}; consult docs/design/boundary-audit.json for ownership). Return raw data only.`,
        optsFor(framingNode, `plan:${f.split(':')[0]}`),
      ),
    ),
  )
  const liveFramings = framings.filter(Boolean) // H5
  log(`Plan [mode=${MODE}]: ${liveFramings.length}/${FRAMINGS.length} framings live`)

  const plan = await plannerAgent(
    `Project brief and v1 line: ${BRIEF}\nReconcile these independent framings into ONE typed task DAG for the ${PHASE} phase. An item found by exactly one framing is the highest-value signal — adjudicate it by name, never drop it silently. Then run the roster sweep: for every skill in docs/design/boundary-audit.json, justify inclusion or exclusion for this project. Framings: ${JSON.stringify(liveFramings)}\nReturn raw data only.`,
    reconcileNode,
  )
  if (plan) {
    tasks = plan.tasks || []
    adjudications = plan.adjudications || []
    rosterExclusions = plan.rosterExclusions || []
  }
  log(`Plan [mode=${MODE}]: ${tasks.length} task(s), ${adjudications.length} adjudication(s), ${rosterExclusions.length} roster exclusion(s)`)
}

// ---------------------------------------------------------------------------
// Build + Gate — per-task pipeline (H1): implement under the owning skill's
// law, then the sequential gating vote, then ONE bounded repair round.
// ---------------------------------------------------------------------------
const gateLenses = gateNode.lenses.slice(0, Math.min(WIDTH(gateNode.taskType), gateNode.lenses.length))
const killAt = Math.ceil(gateLenses.length / 2)
log(`Gate [mode=${MODE}]: width ${gateLenses.length}, majority-refute kills at ${killAt}, sequential dispatch, lens 0 Fable-eligible (${FABLE_GATE ? 'ON' : 'off'})`)

async function gateOnce(task, draft, round) {
  const votes = []
  // Sequential on purpose — §M5's dispatch rule: a width-N same-model burst
  // concentrates on one rate-limit bucket and dies whole; the vote is over
  // verdicts, not wall-clock.
  for (let li = 0; li < gateLenses.length; li++) {
    const prompt = `FIX-ROUND ${round} — verify against the CURRENT files, not a cached impression.\nLens: ${gateLenses[li]}\nTask: ${JSON.stringify(task)}\nDraft: ${JSON.stringify(draft)}\nProject brief and v1 line: ${BRIEF}\nTry to REFUTE. Read the actual files; run the checks the owning skill's references demand; where a check truly needs a runtime the sandbox lacks, say so explicitly instead of refuting on it. Default to ok=false only on a defect you can demonstrate. Return raw data only.`
    const label = `gate:${task.id}#${gateLenses[li].split(':')[0]}${round > 1 ? '·r' + round : ''}`
    votes.push(await fableGateAgent(prompt, gateNode, li, label))
  }
  const live = votes.filter(Boolean) // H5 — dead lenses shrink the vote, never fake it
  const refutes = live.filter((v) => v.ok === false).length
  return {
    state: live.length === 0 ? 'UNVERIFIED' : refutes >= killAt ? 'REFUTED' : 'PASS',
    refutes: refutes,
    live: live.length,
    reasons: live.filter((v) => v.ok === false).map((v) => v.reason),
  }
}

const built = await pipeline(
  tasks,
  (task) =>
    agent(
      `Project brief and v1 line: ${BRIEF}\nExecute this ${PHASE} task under its owning skill's law — read that skill's references first and obey its non-negotiables: ${JSON.stringify(task)}\nReturn the file list and a one-line summary as raw data.`,
      optsFor(buildNode, `build:${task.id}`),
    ),
  async (draft, task) => {
    if (!draft) return { task: task, state: 'UNBUILT', verdicts: [] }
    const v1 = await gateOnce(task, draft, 1)
    if (v1.state !== 'REFUTED') return { task: task, draft: draft, state: v1.state, verdicts: [v1] }
    // One bounded repair round: fix ONLY what a lens demonstrated, then re-gate
    // with the round number stamped in — cached prompts replay stale verdicts.
    const fix = await agent(
      `Project brief and v1 line: ${BRIEF}\nThis task's work was REFUTED. Fix ONLY what the refutations demonstrate in the files — no scope growth. Task: ${JSON.stringify(task)}\nRefutations: ${JSON.stringify(v1.reasons)}\nReturn the file list and a one-line summary as raw data.`,
      optsFor(buildNode, `fix:${task.id}`),
    )
    const v2 = fix ? await gateOnce(task, fix, 2) : { state: 'UNBUILT', refutes: 0, live: 0, reasons: [] }
    return { task: task, draft: fix || draft, state: v2.state, verdicts: [v1, v2] }
  },
)

const rows = built.filter(Boolean)
const passed = rows.filter((r) => r.state === 'PASS')
log(`Gate [mode=${MODE}]: ${passed.length}/${tasks.length} task(s) PASS; ${rows.filter((r) => r.state === 'REFUTED').length} refuted after repair; ${rows.filter((r) => r.state === 'UNVERIFIED').length} unverified`)

// Completeness critic (H12) — mode-resolved width over the declared lenses.
const criticLenses = criticNode.lenses.slice(0, Math.min(WIDTH(criticNode.taskType), criticNode.lenses.length))
const criticRuns = await parallel(
  criticLenses.map((lens) => () =>
    agent(
      `Lens: ${lens}\nProject brief and v1 line: ${BRIEF}\nPhase: ${PHASE}. Task outcomes: ${JSON.stringify(rows.map((r) => ({ id: r.task.id, state: r.state })))}\nRoster exclusions asserted at planning: ${JSON.stringify(rosterExclusions)}\nWhat is missing? Default to reporting a gap when uncertain. Return raw data only.`,
      optsFor(criticNode, `critic:${lens.split(':')[0]}`),
    ),
  ),
)
const gaps = []
for (const c of criticRuns.filter(Boolean)) for (const g of c.gaps) if (gaps.indexOf(g) < 0) gaps.push(g)

return {
  phase: PHASE,
  mode: MODE,
  planner: (input && input.planner) === 'fable' ? 'fable' : 'opus',
  fableGate: FABLE_GATE,
  estimate: ESTIMATE,
  plan: { tasks: tasks.map((t) => t.id), adjudications: adjudications, rosterExclusions: rosterExclusions },
  outcomes: rows.map((r) => ({ id: r.task.id, state: r.state, rounds: r.verdicts.length, reasons: (r.verdicts[r.verdicts.length - 1] || {}).reasons || [] })),
  gaps: gaps,
  ledger: [framingNode, reconcileNode, buildNode, gateNode, criticNode].map((n) => ({
    label: n.label,
    taskType: n.taskType,
    mode: MODE,
    model: (PLANNER && n.taskType === 'planner' ? PLANNER : routeFor(n.taskType).model) || 'inherit',
    effort: routeFor(n.taskType).effort || 'default',
    width: WIDTH(n.taskType),
    modifierA: MODE === 'all-out' ? 'suppressed' : 'active',
    rationale: n.rationale,
  })),
}
