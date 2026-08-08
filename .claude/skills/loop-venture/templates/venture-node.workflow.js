// Template: VENTURE NODE — realize one node of a venture conduct (P1, P2 or P6),
// or one band node's round when invoked by the band conductor's phases.
// This is an ordinary ../../loop-engine script under the unchanged harness policy.
// The loop-venture additions: the five-step node loop (plan → mandated research →
// perspective discuss → synthesize → refute-verify), disjoint research mandates,
// cite-or-own enforcement in the verify prompts, and the bounded verify loop
// (≤2 rounds, round marker stamped so cached prompts cannot replay stale verdicts).
//
// Invoke with: Workflow({ script, args: { node, checkpoint, conflicts?, mode, planner, fableGate, estimate? } })
// input.node       — { key, name, playbook, questions, mandates: [..], cast: [..], deliverable }
//                    (mandates/cast come verbatim from the phase playbook in loop-venture/references/)
// input.checkpoint — the upstream gate's folded state object (the ONLY upstream thing this node reads)
// input.conflicts  — optional conflicts[] addressed to this node (band Round 2 only)
// input.mode / input.planner / input.fableGate — the §M2 flags, as real JSON values

export const meta = {
  name: 'venture-node',
  description: 'One venture node: plan, mandated research fan-out, perspective panel, synthesis into a typed state slice plus decision document, adversarial refute-verify bounded at two rounds',
  phases: [
    { title: 'Plan', detail: 'one planner scopes the node’s questions from the checkpoint' },
    { title: 'Research', detail: 'disjoint source mandates, cited claims only' },
    { title: 'Discuss', detail: 'three opposed perspectives over the same corpus' },
    { title: 'Synthesize', detail: 'one typed slice + the phase document, cite-or-own' },
    { title: 'Verify', detail: 'refuters then a gating judge, ≤2 rounds' },
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
// This template's verify loop is bounded by round count (≤2), not discovery dryness, so DRY_LIMIT is omitted (§M8).
// ---------------------------------------------------------------------------

const NODE = input.node
const CHECKPOINT = input.checkpoint || {}
const CONFLICTS = input.conflicts || []

const EVIDENCE_SCHEMA = {
  type: 'object',
  properties: {
    mandate: { type: 'string' },
    claims: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          statement: { type: 'string' },
          source: { type: 'string' },
          grade: { type: 'string' },
        },
        required: ['statement', 'source'],
      },
    },
  },
  required: ['mandate', 'claims'],
}
const PANEL_SCHEMA = {
  type: 'object',
  properties: {
    perspective: { type: 'string' },
    arguments: { type: 'array', items: { type: 'string' } },
    disagreements: { type: 'array', items: { type: 'string' } },
  },
  required: ['perspective', 'arguments', 'disagreements'],
}
const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    questions: { type: 'array', items: { type: 'string' } },
    mandateBriefs: { type: 'array', items: { type: 'string' } },
  },
  required: ['questions', 'mandateBriefs'],
}
const SLICE_SCHEMA = {
  type: 'object',
  properties: {
    document: { type: 'string' },
    slice: { type: 'object' },
    assumptions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          owner: { type: 'string' },
          statement: { type: 'string' },
          status: { type: 'string' },
        },
        required: ['id', 'owner', 'statement', 'status'],
      },
    },
    legalConstraints: { type: 'array', items: { type: 'object' } },
    risks: { type: 'array', items: { type: 'object' } },
  },
  required: ['document', 'slice', 'assumptions'],
}
const REFUTE_SCHEMA = {
  type: 'object',
  properties: {
    refutations: {
      type: 'array',
      items: {
        type: 'object',
        properties: { claim: { type: 'string' }, why: { type: 'string' }, demonstrable: { type: 'boolean' } },
        required: ['claim', 'why', 'demonstrable'],
      },
    },
  },
  required: ['refutations'],
}
const JUDGE_SCHEMA = {
  type: 'object',
  properties: { ok: { type: 'boolean' }, upheld: { type: 'array', items: { type: 'string' } }, reason: { type: 'string' } },
  required: ['ok', 'upheld', 'reason'],
}

// Node shells. Rationales name the mode (loop-orchestrate step 6).
const planNode = {
  label: 'plan:' + NODE.key, taskType: 'planner', phase: 'Plan', schema: PLAN_SCHEMA,
  rationale: 'the one decompose everything downstream inherits → planner route: pinned in every mode; the node --planner fable may take (§M7)',
}
const researchNode = {
  label: 'research', taskType: 'analyze', phase: 'Research', schema: EVIDENCE_SCHEMA,
  rationale: 'cited evidence gathering under loop-research law → analyze route per mode column (H8)',
}
const panelNode = {
  label: 'discuss', taskType: 'analyze', phase: 'Discuss', schema: PANEL_SCHEMA,
  rationale: 'opposed-perspective argument over a fixed corpus → analyze route; barrier earned, synthesis needs all three (H2)',
}
const synthNode = {
  label: 'synthesize:' + NODE.key, taskType: 'synthesize', phase: 'Synthesize', schema: SLICE_SCHEMA,
  rationale: 'one fold of corpus + panel into the typed slice and document → synthesize route (H3)',
}
const refuteNode = {
  label: 'refute', taskType: 'verify', phase: 'Verify', schema: REFUTE_SCHEMA,
  rationale: 'adversarial refuters over the document’s claims → verify route; two independent skeptics',
}
const judgeNode = {
  label: 'judge:' + NODE.key, taskType: 'gating', phase: 'Verify', schema: JUDGE_SCHEMA,
  rationale: 'a false all-clear ships an unvalidated venture decision → gating route, pinned in every mode; single judge, sequential by construction (§M5)',
}

for (const n of [planNode, researchNode, panelNode, synthNode, refuteNode, judgeNode]) {
  const r = routeFor(n.taskType)
  const model = (PLANNER && n.taskType === 'planner' ? PLANNER : r.model) || 'inherit'
  log(`cast ${n.label} [${n.taskType}] mode:${MODE} → model:${model} effort:${r.effort || '—'} — ${n.rationale}`)
}
if (MODE === 'all-out') {
  log(`ESTIMATE approved at the §M6 pre-flight: ${ESTIMATE.agents} agents, ${ESTIMATE.tokensLow}–${ESTIMATE.tokensHigh} output tokens`)
}

// ---------------------------------------------------------------------------
// Plan — one planner scopes the node's questions from the checkpoint alone.
// ---------------------------------------------------------------------------
const plan = await plannerAgent(
  `Venture node: ${NODE.name}. Playbook law (obey it): ${NODE.playbook}\nUpstream checkpoint (the ONLY upstream state that exists for you): ${JSON.stringify(CHECKPOINT)}\n${CONFLICTS.length ? 'Conflicts addressed to this node at the fold — your plan must resolve each by name: ' + JSON.stringify(CONFLICTS) + '\n' : ''}Scope this node: the questions it must answer, and one brief per research mandate below, keeping the mandates DISJOINT by construction: ${JSON.stringify(NODE.mandates)}\nReturn raw data only.`,
  planNode,
)
const mandateBriefs = (plan && plan.mandateBriefs && plan.mandateBriefs.length ? plan.mandateBriefs : NODE.mandates).slice()

// ---------------------------------------------------------------------------
// Research — disjoint mandates, width by mode; the cap is logged, never silent (H6).
// ---------------------------------------------------------------------------
const MANDATE_WIDTH = MODE === 'all-out' ? mandateBriefs.length : MODE === 'lite' ? 1 : Math.min(3, mandateBriefs.length)
if (MANDATE_WIDTH < mandateBriefs.length) {
  log(`research width capped at ${MANDATE_WIDTH}/${mandateBriefs.length} mandates by mode=${MODE} — dropped: ${mandateBriefs.slice(MANDATE_WIDTH).join(' | ')}`)
}
const corpus = (await parallel(
  mandateBriefs.slice(0, MANDATE_WIDTH).map((m, i) => () =>
    agent(
      `Venture node: ${NODE.name}. Research mandate (yours ALONE — do not stray into the others: ${JSON.stringify(mandateBriefs)}): ${m}\nQuestions in scope: ${JSON.stringify((plan && plan.questions) || NODE.questions)}\nWork under loop-research law: every claim cited to a named source with a grade; report disconfirming evidence with the same care as confirming. Return raw data only.`,
      optsFor(researchNode, `research:${NODE.key}#${i}`),
    ),
  ),
)).filter(Boolean) // H5
log(`Research [mode=${MODE}]: ${corpus.length}/${MANDATE_WIDTH} mandates live, ${corpus.reduce((a, c) => a + c.claims.length, 0)} claims`)

// ---------------------------------------------------------------------------
// Discuss — three opposed perspectives over the SAME corpus. Barrier earned (H2):
// the synthesizer needs every perspective at once, disagreements included.
// ---------------------------------------------------------------------------
const panel = (await parallel(
  NODE.cast.map((persona) => () =>
    agent(
      `Venture node: ${NODE.name}. You argue ONE perspective: ${persona}\nCorpus (argue from it, not around it): ${JSON.stringify(corpus)}\nUpstream checkpoint: ${JSON.stringify(CHECKPOINT)}\nMake your strongest arguments, then name explicitly what the OTHER perspectives (${JSON.stringify(NODE.cast)}) get wrong — an empty disagreements list means you have not discussed. Return raw data only.`,
      optsFor(panelNode, `discuss:${persona.split(/[—:]/)[0].trim()}`),
    ),
  ),
)).filter(Boolean)
log(`Discuss [mode=${MODE}]: ${panel.length}/${NODE.cast.length} perspectives live, ${panel.reduce((a, p) => a + p.disagreements.length, 0)} disagreements`)

// ---------------------------------------------------------------------------
// Synthesize + Verify — the bounded loop: draft, refute, judge; fix only what a
// refuter demonstrated; round marker busts the prompt cache; ≤2 rounds.
// ---------------------------------------------------------------------------
async function synthesizeOnce(round, refutations) {
  return agent(
    `ROUND ${round} — synthesize against the CURRENT inputs, not a cached impression.\nVenture node: ${NODE.name}. Playbook law: ${NODE.playbook}\nDeliverable: ${NODE.deliverable}\nCorpus: ${JSON.stringify(corpus)}\nPanel (fold the disagreements in — a document citing no disagreement is a consensus-panel failure): ${JSON.stringify(panel)}\nUpstream checkpoint: ${JSON.stringify(CHECKPOINT)}\n${CONFLICTS.length ? 'Resolve these fold conflicts by name in the document: ' + JSON.stringify(CONFLICTS) + '\n' : ''}${refutations && refutations.length ? 'Fix ONLY what these upheld refutations demonstrate — no scope growth: ' + JSON.stringify(refutations) + '\n' : ''}CITE-OR-OWN is law: every quantitative claim carries a citation from the corpus or an assumptions[] entry with owner='${NODE.key}' and status='open'. Emit the typed slice exactly per the venture state contract — only fields this node owns. Return raw data only.`,
    optsFor(synthNode, round > 1 ? `synthesize:${NODE.key}·r${round}` : undefined),
  )
}

async function verifyOnce(draft, round) {
  const refuters = (await parallel(
    ['numbers: attack every quantitative claim — does the cited source actually say that, at that magnitude?',
     'inference: attack the reasoning — which conclusion does not follow from the evidence, which assumption is stated as fact?'].map((lens, li) => () =>
      agent(
        `ROUND ${round} — refute against the CURRENT draft.\nLens: ${lens}\nVenture node: ${NODE.name}. Draft document + slice: ${JSON.stringify(draft)}\nCorpus it cites: ${JSON.stringify(corpus)}\nTry to REFUTE. Mark demonstrable=true only where you can point at the exact claim and the exact evidence gap. Return raw data only.`,
        optsFor(refuteNode, `refute:${NODE.key}#${li}·r${round}`),
      ),
    ),
  )).filter(Boolean)
  const raised = refuters.flatMap((r) => r.refutations.filter((x) => x.demonstrable))
  const judge = await fableGateAgent(
    `ROUND ${round} — judge the disputes on the CURRENT draft.\nVenture node: ${NODE.name}. Draft: ${JSON.stringify(draft)}\nDemonstrable refutations raised: ${JSON.stringify(raised)}\nUphold only refutations that hold against the corpus; ok=true only if nothing upheld survives. UNVERIFIED claims (evidence unreachable) are reported in reason, never passed. Return raw data only.`,
    judgeNode, 0, `judge:${NODE.key}·r${round}`,
  )
  return { refuters: refuters.length, raised, judge }
}

let draft = await synthesizeOnce(1, [])
let verdicts = []
if (draft) {
  const v1 = await verifyOnce(draft, 1)
  verdicts.push(v1)
  if (v1.judge && v1.judge.ok === false && v1.judge.upheld.length) {
    const fixed = await synthesizeOnce(2, v1.judge.upheld)
    if (fixed) {
      draft = fixed
      verdicts.push(await verifyOnce(draft, 2))
    }
  }
}
const last = verdicts[verdicts.length - 1]
const state = !draft ? 'UNBUILT' : !last || !last.judge ? 'UNVERIFIED' : last.judge.ok ? 'PASS' : 'REFUTED'
log(`Verify [mode=${MODE}]: ${state} after ${verdicts.length} round(s)`)

return {
  node: NODE.key,
  mode: MODE,
  state: state,
  document: draft ? draft.document : null,
  slice: draft ? draft.slice : null,
  assumptions: draft ? draft.assumptions : [],
  legalConstraints: (draft && draft.legalConstraints) || [],
  risks: (draft && draft.risks) || [],
  openDisputes: last && last.judge && !last.judge.ok ? last.judge.upheld : [],
  ledger: [planNode, researchNode, panelNode, synthNode, refuteNode, judgeNode].map((n) => ({
    label: n.label,
    taskType: n.taskType,
    mode: MODE,
    model: (PLANNER && n.taskType === 'planner' ? PLANNER : routeFor(n.taskType).model) || 'inherit',
    effort: routeFor(n.taskType).effort || 'default',
    rationale: n.rationale,
  })),
}
