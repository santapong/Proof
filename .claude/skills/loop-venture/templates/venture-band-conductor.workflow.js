// Template: VENTURE BAND CONDUCTOR — realize the parallel band of a venture conduct
// (GTM ∥ Build Plan ∥ Deploy Plan) between GATE-2 and GATE-3, as ONE workflow (H11:
// the band shares a single human gate, so it is a single gated phase).
// This is an ordinary ../../loop-engine script under the unchanged harness policy.
// The loop-venture additions: the two-round band (Round 1 blind from the checkpoint,
// CHECKPOINT-A fold + consistency sweep, Round 2 with the folded state and addressed
// conflicts), per-field merge folds under the venture state contract, and the bounded
// re-plan (one owner re-synthesis per invalidated assumption per checkpoint, then human).
// Cross-node adaptation happens ONLY at the folds — no mid-band peeking; that is the
// implicit-blackboard anti-pattern the loop-context law names.
//
// Invoke with: Workflow({ script, args: { checkpoint, nodes, mode, planner, fableGate, estimate? } })
// input.checkpoint — GATE-2's approved folded state (vision, roadmap, pains, personas, assumptions)
// input.nodes      — the three band nodes, each { key, name, playbook, questions, mandates, cast, deliverable }
//                    keys are canonical: 'gtm', 'build', 'deploy' — the fold maps slices by them
// input.mode / input.planner / input.fableGate — the §M2 flags, as real JSON values

export const meta = {
  name: 'venture-band-conductor',
  description: 'The venture parallel band: three blind Round-1 nodes, a CHECKPOINT-A fold with consistency sweep, Round-2 synthesis and refute-verify under addressed conflicts, bounded re-plan, CHECKPOINT-B for GATE-3',
  phases: [
    { title: 'Round 1', detail: 'plan, mandated research, perspective panel, draft slice — blind, checkpoint only' },
    { title: 'Fold A', detail: 'merge-rule fold + consistency sweep over the folded object' },
    { title: 'Round 2', detail: 'synthesis and refute-verify under addressed conflicts, bounded re-plan; Fold B (plain script code, no agents) closes the band into the GATE-3 handoff' },
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
// This template's re-plan is bounded by the contract (once per checkpoint), not discovery dryness, so DRY_LIMIT is omitted (§M8).
// ---------------------------------------------------------------------------

const CHECKPOINT = input.checkpoint || {}
// EDIT ME: the band is P3 GTM ∥ P4 Build Plan ∥ P5 Deploy Plan (SKILL §2). A caller normally
// passes input.nodes from the GATE-2 fold; this default is the canonical trio so the template is
// runnable standalone, as every other work-list template in the fleet is. A band that collapses to
// an empty list does not fail loudly — it silently runs only its pinned gating nodes, which is how
// this shipped mode-inert in 2.4.0.
const DEFAULT_BAND = [
  {
    key: 'gtm', name: 'P3 Go-To-Market', playbook: 'references/go-to-market.md',
    questions: ['Who is this for, stated as a segment that can be reached?', 'What is the positioning, before any pricing is chosen?', 'What does the pricing model imply about the cost of support?'],
    mandates: ['Segment and reachable-channel evidence', 'Comparable positioning and pricing in the category', 'The legal lens: what regulation or licensing constrains this offer'],
    cast: ['Positioning lead — what the offer IS, against alternatives', 'Pricing analyst — what the model implies at volume', 'Counsel — what constrains the offer legally'],
    deliverable: 'The GTM slice: positioning statement, pricing model with its support-cost implication, ranked channels, and the legal constraints found',
  },
  {
    key: 'build', name: 'P4 Build Plan', playbook: "loop-design's references and loop-build §1 (delegated law, SKILL §2.7)",
    questions: ['What is the ≤10-bullet gate-checkable v1 line?', 'What is deferred, and for what stated reason?', 'What are the NFR targets, as numbers?'],
    mandates: ['Architecture sketch and its load-bearing constraints', 'NFR targets with the numbers behind them', 'Prior art for the risky component'],
    cast: ['Architect — the shape and its constraints', 'Skeptic — what in this v1 line is not gate-checkable', 'Estimator — what the deferrals actually buy'],
    deliverable: 'A valid loop-build brief: the ≤10-bullet v1 line, reasoned deferrals, NFR targets as numbers, and the architecture sketch (SKILL §2.6)',
  },
  {
    key: 'deploy', name: 'P5 Deploy Plan', playbook: "loop-ship's references (delegated law, SKILL §2.7)",
    questions: ['What is the deploy target, and what does it cost at v1 volume?', 'What is the rollback mechanism, and has it been exercised?', 'What gates the release?'],
    mandates: ['Deploy-target options with their cost at stated volume', 'Rollback mechanics for each candidate target', 'The release-gate conditions this venture needs'],
    cast: ['Operator — what this costs to run and page on', 'Release engineer — how it rolls forward and back', 'Skeptic — which failure mode has no rollback'],
    deliverable: 'The deploy slice: target with costed rationale, a tested rollback path, and the release-gate conditions',
  },
]
const NODES = input.nodes || DEFAULT_BAND

const EVIDENCE_SCHEMA = {
  type: 'object',
  properties: {
    mandate: { type: 'string' },
    claims: {
      type: 'array',
      items: {
        type: 'object',
        properties: { statement: { type: 'string' }, source: { type: 'string' }, grade: { type: 'string' } },
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
          evidence: { type: 'string' },
        },
        required: ['id', 'owner', 'statement', 'status'],
      },
    },
    legalConstraints: { type: 'array', items: { type: 'object' } },
    risks: { type: 'array', items: { type: 'object' } },
  },
  required: ['document', 'slice', 'assumptions'],
}
const SWEEP_SCHEMA = {
  type: 'object',
  properties: {
    conflicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          between: { type: 'array', items: { type: 'string' } },
          statement: { type: 'string' },
          addressedTo: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'between', 'statement', 'addressedTo'],
      },
    },
    invalidatedAssumptions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, owner: { type: 'string' }, why: { type: 'string' } },
        required: ['id', 'owner', 'why'],
      },
    },
  },
  required: ['conflicts', 'invalidatedAssumptions'],
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
  label: 'plan', taskType: 'planner', phase: 'Round 1', schema: PLAN_SCHEMA,
  rationale: 'each band node’s decompose gates that node → planner route, pinned in every mode (§M7)',
}
const researchNode = {
  label: 'research', taskType: 'analyze', phase: 'Round 1', schema: EVIDENCE_SCHEMA,
  rationale: 'cited evidence under loop-research law → analyze route per mode column (H8)',
}
const panelNode = {
  label: 'discuss', taskType: 'analyze', phase: 'Round 1', schema: PANEL_SCHEMA,
  rationale: 'opposed perspectives over a fixed corpus → analyze route; barrier earned per node (H2)',
}
const draftNode = {
  label: 'draft', taskType: 'synthesize', phase: 'Round 1', schema: SLICE_SCHEMA,
  rationale: 'Round-1 draft slice, blind to siblings → synthesize route (H3); adaptation is the fold’s job, not this node’s',
}
const sweepNode = {
  label: 'sweep', taskType: 'gating', phase: 'Fold A', schema: SWEEP_SCHEMA,
  rationale: 'the consistency sweep is the band’s cross-node instrument — a missed conflict ships an incoherent trio to GATE-3 → gating route, pinned in every mode',
}
const synthNode = {
  label: 'synthesize', taskType: 'synthesize', phase: 'Round 2', schema: SLICE_SCHEMA,
  rationale: 'Round-2 synthesis consumes the folded state + addressed conflicts → synthesize route (H3)',
}
const refuteNode = {
  label: 'refute', taskType: 'verify', phase: 'Round 2', schema: REFUTE_SCHEMA,
  rationale: 'adversarial refuters per node → verify route',
}
const judgeNode = {
  label: 'judge', taskType: 'gating', phase: 'Round 2', schema: JUDGE_SCHEMA,
  rationale: 'a false all-clear on a band document mis-prices GATE-3 → gating route, pinned; single judge per node, sequential by construction (§M5)',
}

for (const n of [planNode, researchNode, panelNode, draftNode, sweepNode, synthNode, refuteNode, judgeNode]) {
  const r = routeFor(n.taskType)
  const model = (PLANNER && n.taskType === 'planner' ? PLANNER : r.model) || 'inherit'
  log(`cast ${n.label} [${n.taskType}] mode:${MODE} → model:${model} effort:${r.effort || '—'} — ${n.rationale}`)
}
if (MODE === 'all-out') {
  log(`ESTIMATE approved at the §M6 pre-flight: ${ESTIMATE.agents} agents, ${ESTIMATE.tokensLow}–${ESTIMATE.tokensHigh} output tokens`)
}

// ---------------------------------------------------------------------------
// The venture state fold — merge rules per the state contract
// (loop-venture/references/state-contract.md). Folding happens HERE, at the join,
// where every rule is visible in one place — never inside mapped thunks.
// ---------------------------------------------------------------------------
function foldSlices(base, results) {
  const folded = JSON.parse(JSON.stringify(base))
  const lww = ['positioning', 'pricing', 'supportPlan', 'v1Scope', 'deployTarget', 'vision']
  const keyed = { assumptions: 'id', risks: 'id', nfrs: 'name', roadmap: 'id', personas: 'id' }
  const appendOnly = ['pains', 'conflicts', 'decisions']
  const rank = { low: 0, medium: 1, high: 2, critical: 3 }
  for (const r of results) {
    if (!r || !r.slice) continue
    const s = r.slice
    for (const f of lww) if (s[f] !== undefined) folded[f] = s[f] // single declared writer per contract
    for (const f of appendOnly) if (Array.isArray(s[f])) folded[f] = (folded[f] || []).concat(s[f])
    if (Array.isArray(s.legalConstraints) || Array.isArray(r.legalConstraints)) {
      folded.constraintsLegal = (folded.constraintsLegal || []).concat(s.legalConstraints || [], r.legalConstraints || [])
    }
    for (const f in keyed) {
      const incoming = (f === 'assumptions' || f === 'risks') ? (s[f] || r[f] || []) : (s[f] || [])
      if (!Array.isArray(incoming) || !incoming.length) continue
      const key = keyed[f]
      const map = {}
      for (const item of folded[f] || []) map[item[key]] = item
      for (const item of incoming) {
        const prev = map[item[key]]
        if (!prev) { map[item[key]] = item; continue }
        if (f === 'nfrs' && JSON.stringify(prev.target) !== JSON.stringify(item.target)) {
          // Two writers, two targets: strictness is not machine-comparable across units,
          // so the collision is surfaced to the consistency sweep, never silently last-won.
          folded.conflicts = (folded.conflicts || []).concat([{ id: 'nfr:' + item[key], between: ['nfrs'], statement: `NFR '${item[key]}' has two targets: ${JSON.stringify(prev.target)} vs ${JSON.stringify(item.target)} — the stricter must be chosen, not defaulted`, addressedTo: ['build', 'deploy'] }])
        }
        if (f === 'risks') {
          // reduce: rating = the WORST any node gave, never the average
          map[item[key]] = (rank[item.rating] || 0) >= (rank[prev.rating] || 0) ? item : prev
        } else if (f === 'assumptions') {
          // status monotone: open → validated/invalidated, never back
          map[item[key]] = prev.status !== 'open' && item.status === 'open' ? prev : item
        } else {
          map[item[key]] = item // keyed upsert
        }
      }
      folded[f] = Object.keys(map).map((k) => map[k])
    }
  }
  return folded
}

// ---------------------------------------------------------------------------
// Round 1 — three blind nodes, each: plan → mandated research → panel → draft.
// A genuine parallel: they share nothing but GATE-2's checkpoint. The barrier at
// the fold is earned (H2): the sweep needs ALL slices at once — cross-field
// conflicts are invisible to any single node by construction.
// ---------------------------------------------------------------------------
async function runRound1(node) {
  const plan = await plannerAgent(
    `Venture band node: ${node.name}. Playbook law (obey it): ${node.playbook}\nGATE-2 checkpoint (the ONLY upstream state that exists for you — sibling band nodes do not exist yet): ${JSON.stringify(CHECKPOINT)}\nScope this node: the questions it must answer, and one brief per research mandate, DISJOINT by construction: ${JSON.stringify(node.mandates)}\nReturn raw data only.`,
    planNode, `plan:${node.key}`,
  )
  const briefs = (plan && plan.mandateBriefs && plan.mandateBriefs.length ? plan.mandateBriefs : node.mandates).slice()
  const width = MODE === 'all-out' ? briefs.length : MODE === 'lite' ? 1 : Math.min(3, briefs.length)
  if (width < briefs.length) log(`research width capped at ${width}/${briefs.length} for ${node.key} by mode=${MODE} — dropped: ${briefs.slice(width).join(' | ')}`)
  const corpus = (await parallel(
    briefs.slice(0, width).map((m, i) => () =>
      agent(
        `Venture band node: ${node.name}. Research mandate (yours ALONE): ${m}\nQuestions in scope: ${JSON.stringify((plan && plan.questions) || node.questions)}\nWork under loop-research law: every claim cited to a named source with a grade; report disconfirming evidence with the same care. Return raw data only.`,
        optsFor(researchNode, `research:${node.key}#${i}`),
      ),
    ),
  )).filter(Boolean) // H5
  const panel = (await parallel(
    node.cast.map((persona) => () =>
      agent(
        `Venture band node: ${node.name}. You argue ONE perspective: ${persona}\nCorpus: ${JSON.stringify(corpus)}\nGATE-2 checkpoint: ${JSON.stringify(CHECKPOINT)}\nArgue your lens, then name what the OTHER perspectives (${JSON.stringify(node.cast)}) get wrong — an empty disagreements list means you have not discussed. Return raw data only.`,
        optsFor(panelNode, `discuss:${node.key}:${persona.split(/[—:]/)[0].trim()}`),
      ),
    ),
  )).filter(Boolean)
  const draft = await agent(
    `ROUND 1 draft — blind: sibling band nodes do not exist for you.\nVenture band node: ${node.name}. Playbook law: ${node.playbook}\nDeliverable: ${node.deliverable}\nCorpus: ${JSON.stringify(corpus)}\nPanel (fold the disagreements in): ${JSON.stringify(panel)}\nGATE-2 checkpoint: ${JSON.stringify(CHECKPOINT)}\nCITE-OR-OWN is law: every quantitative claim carries a citation from the corpus or an assumptions[] entry with owner='${node.key}' and status='open'. Emit the typed slice per the venture state contract — ONLY fields this node owns. Return raw data only.`,
    optsFor(draftNode, `draft:${node.key}`),
  )
  return { node: node, corpus: corpus, panel: panel, draft: draft }
}

const round1 = (await parallel(NODES.map((n) => () => runRound1(n)))).filter(Boolean)
log(`Round 1 [mode=${MODE}]: ${round1.length}/${NODES.length} band nodes live`)

// ---------------------------------------------------------------------------
// Fold A — merge-rule fold, then the consistency sweep over the FOLDED object.
// ---------------------------------------------------------------------------
const checkpointA = foldSlices(CHECKPOINT, round1.map((r) => r.draft))
const sweep = await fableGateAgent(
  `You are the consistency sweep of a venture band. Folded state at CHECKPOINT-A: ${JSON.stringify(checkpointA)}\nBand nodes: ${JSON.stringify(NODES.map((n) => n.key))}\nFind CROSS-FIELD conflicts no single node could see — pricing vs v1Scope (a tier the scope cannot deliver, e.g. self-serve pricing with no billing in scope), deployTarget.costModel vs pricing margins, supportPlan.slaTargets vs pricing and cost model, every legal constraint vs every channel and platform choice. Address each conflict to the node(s) that must resolve it. Separately: name any assumptions[] entry the folded evidence now INVALIDATES, with its owner. Return raw data only.`,
  sweepNode, 0, 'sweep:A',
)
const conflicts = (sweep && sweep.conflicts) || []
const invalidated = (sweep && sweep.invalidatedAssumptions) || []
log(`Fold A: ${conflicts.length} conflict(s), ${invalidated.length} invalidated assumption(s)`)

// ---------------------------------------------------------------------------
// Round 2 — per node: synthesis with the folded state + addressed conflicts,
// then refute-verify. pipeline(): nodes are independent again after the fold.
// ---------------------------------------------------------------------------
async function verifyNode(node, doc, corpus, round) {
  const refuters = (await parallel(
    ['numbers: attack every quantitative claim — does the cited source actually say that, at that magnitude?',
     'coherence: attack the fit — does this document contradict the CHECKPOINT-A folded state or leave an addressed conflict unresolved?'].map((lens, li) => () =>
      agent(
        `ROUND ${round} — refute against the CURRENT document.\nLens: ${lens}\nVenture band node: ${node.name}. Document + slice: ${JSON.stringify(doc)}\nCHECKPOINT-A folded state: ${JSON.stringify(checkpointA)}\nCorpus cited: ${JSON.stringify(corpus)}\nTry to REFUTE; demonstrable=true only where you can point at the exact claim and gap. Return raw data only.`,
        optsFor(refuteNode, `refute:${node.key}#${li}·r${round}`),
      ),
    ),
  )).filter(Boolean)
  const raised = refuters.flatMap((r) => r.refutations.filter((x) => x.demonstrable))
  const judge = await agent(
    `ROUND ${round} — judge the disputes on the CURRENT document.\nVenture band node: ${node.name}. Document: ${JSON.stringify(doc)}\nDemonstrable refutations: ${JSON.stringify(raised)}\nUphold only what holds against corpus and folded state; ok=true only if nothing upheld survives. Return raw data only.`,
    optsFor(judgeNode, `judge:${node.key}·r${round}`),
  )
  return { raised: raised, judge: judge }
}

const round2 = await pipeline(
  round1,
  (r1) =>
    agent(
      `ROUND 2 synthesis — you now see the whole band, through the fold and only the fold.\nVenture band node: ${r1.node.name}. Playbook law: ${r1.node.playbook}\nDeliverable: ${r1.node.deliverable}\nYour Round-1 draft: ${JSON.stringify(r1.draft)}\nCHECKPOINT-A folded state (what every band node found, merged under the contract): ${JSON.stringify(checkpointA)}\nConflicts addressed to '${r1.node.key}' — resolve each BY NAME in the document, or state explicitly why it must go to GATE-3: ${JSON.stringify(conflicts.filter((c) => c.addressedTo.indexOf(r1.node.key) >= 0))}\nAssumptions of yours now invalidated — your conclusions must absorb them (evidence stands, conclusions move): ${JSON.stringify(invalidated.filter((a) => a.owner === r1.node.key))}\nYour corpus and panel are unchanged: ${JSON.stringify(r1.corpus)} ${JSON.stringify(r1.panel)}\nCITE-OR-OWN is law. Emit the typed slice — ONLY fields this node owns. Return raw data only.`,
      optsFor(synthNode, `synthesize:${r1.node.key}`),
    ),
  async (doc, r1) => {
    if (!doc) return { node: r1.node.key, state: 'UNBUILT', doc: r1.draft, verdicts: [] }
    const v = await verifyNode(r1.node, doc, r1.corpus, 2)
    // The bounded re-plan: ONE owner re-synthesis per checkpoint when the judge
    // upholds refutations; a second failure escalates to GATE-3, never loops.
    if (v.judge && v.judge.ok === false && v.judge.upheld.length) {
      const fixed = await agent(
        `ROUND 3 (bounded re-plan — the ONE re-synthesis this checkpoint permits; anything still standing goes to GATE-3).\nVenture band node: ${r1.node.name}. Fix ONLY what these upheld refutations demonstrate — no scope growth: ${JSON.stringify(v.judge.upheld)}\nDocument to fix: ${JSON.stringify(doc)}\nCHECKPOINT-A folded state: ${JSON.stringify(checkpointA)}\nReturn raw data only.`,
        optsFor(synthNode, `synthesize:${r1.node.key}·r3`),
      )
      if (fixed) {
        const v2 = await verifyNode(r1.node, fixed, r1.corpus, 3)
        return { node: r1.node.key, state: v2.judge ? (v2.judge.ok ? 'PASS' : 'REFUTED') : 'UNVERIFIED', doc: fixed, verdicts: [v, v2] }
      }
    }
    return { node: r1.node.key, state: v.judge ? (v.judge.ok ? 'PASS' : 'REFUTED') : 'UNVERIFIED', doc: doc, verdicts: [v] }
  },
)

// ---------------------------------------------------------------------------
// Fold B — the GATE-3 handoff: folded state, surviving conflicts, the trio.
// ---------------------------------------------------------------------------
const rows = round2.filter(Boolean)
const checkpointB = foldSlices(checkpointA, rows.map((r) => r.doc))
checkpointB.conflicts = conflicts
const surviving = rows.flatMap((r) => (r.state === 'REFUTED' && r.verdicts.length ? r.verdicts[r.verdicts.length - 1].judge.upheld : []))
log(`Fold B: ${rows.filter((r) => r.state === 'PASS').length}/${NODES.length} PASS; ${surviving.length} dispute(s) travel to GATE-3`)

return {
  mode: MODE,
  planner: (input && input.planner) === 'fable' ? 'fable' : 'opus',
  fableGate: FABLE_GATE,
  estimate: ESTIMATE,
  checkpointB: checkpointB,
  documents: rows.map((r) => ({ node: r.node, state: r.state, document: r.doc ? r.doc.document : null })),
  conflictsFound: conflicts,
  invalidatedAssumptions: invalidated,
  survivingDisputes: surviving,
  gate3: 'The human decides: pricing, v1Scope and deployTarget must be mutually consistent; every surviving conflict and dispute above is on the table.',
  ledger: [planNode, researchNode, panelNode, draftNode, sweepNode, synthNode, refuteNode, judgeNode].map((n) => ({
    label: n.label,
    taskType: n.taskType,
    mode: MODE,
    model: (PLANNER && n.taskType === 'planner' ? PLANNER : routeFor(n.taskType).model) || 'inherit',
    effort: routeFor(n.taskType).effort || 'default',
    rationale: n.rationale,
  })),
}
