// Template: PROJECT PLAN — realize one phase's typed task DAG with per-node model +
// effort routing. This is an ordinary ../../loop-engine script: it obeys every rule in
// ../../loop-engine/SKILL.md step 5 and the harness policy. The PM additions are the TASKS
// DAG, the cast+cost ledger log(), and the mode-resolved routing pass-through.
//
// This file is the REFERENCE IMPLEMENTATION of the execution-mode contract. Whatever it
// does here, other templates copy: the canonical ROUTES block is carried verbatim from
// ../../loop-engine/references/execution-modes.md §M8, every agent() call resolves its
// opts through optsFor(), and no node carries a hardcoded model/effort of its own.
//
// The DAG here is intentionally small and concrete so the two shapes are visible:
//   Scout (parallel fan-out of INDEPENDENT nodes) ─┐
//                                                  ├─▶ Plan (synthesis, needs ALL scouts)
//                                                  ┘        │
//                                          Build (per-item PIPELINE: draft ─▶ verify)
// Edges are dependencies, not a schedule: the parallel()/pipeline() shapes extract the
// parallelism. See ../references/model-routing.md for the routing rationale and the two
// override modifiers, and ../../loop-engine/references/harness-policy.md for H1/H2/H6/H8.
//
// Invoke with: Workflow({ script, args: { task: "...", items: [...], mode: "optimize" } })
// input.task   — one-line description threaded into every agent prompt
// input.items  — the known Build work-list (discover it BEFORE authoring; loop policy L6)
// input.mode   — 'optimize' (default) | 'full' — the run-level routing dial (§M2)
// input.planner— 'opus' (default) | 'fable' — planner-node override only (§M7)

export const meta = {
  name: 'project-plan-construction', // EDIT ME: kebab-case name for this phase's run
  description: 'Scout in parallel, synthesize a batch plan, then draft+verify each item with mode-resolved model routing', // EDIT ME
  phases: [
    // EDIT ME: titles MUST match the opts.phase strings below and mirror the framework phases (H9).
    { title: 'Scout', detail: 'independent inventory + analysis, fanned out' },
    { title: 'Plan', detail: 'one synthesis over the full scout set' },
    { title: 'Build', detail: 'per-item draft then gating verify' },
  ],
}

// Some harnesses deliver args as a JSON-encoded string — normalize before use.
const input = typeof args === 'string' ? JSON.parse(args) : args

// ---------------------------------------------------------------------------
// EDIT ME — the figures the user APPROVED at the full-mode pre-flight
// (../../loop-engine/references/execution-modes.md §M6). The orchestrating session
// computes them at authoring time and stamps them here as a PURE LITERAL, because a
// script may not read a clock, roll dice, or prompt a human (harness policy H10).
// Leave the zeros under --mode balanced: no pre-flight fires and nothing was approved.
// They are echoed into the return value so the gate can diff approved-vs-actual against
// <transcriptDir>/journal.jsonl instead of taking the estimate on faith.
// ---------------------------------------------------------------------------
const ESTIMATE = { agents: 0, tokensLow: 0, tokensHigh: 0, mode: 'optimize' }

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
// This phase has no loop, so DRY_LIMIT is omitted (§M8). No other local variation is permitted.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Schemas — every machine-consumed agent() result carries one (harness policy H3).
// ---------------------------------------------------------------------------
const INVENTORY_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, location: { type: 'string' }, note: { type: 'string' } },
        required: ['name'],
      },
    },
  },
  required: ['items'],
}

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    batches: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, items: { type: 'array', items: { type: 'string' } } },
        required: ['name', 'items'],
      },
    },
  },
  required: ['batches'],
}

const DRAFT_SCHEMA = {
  type: 'object',
  properties: { summary: { type: 'string' }, diff: { type: 'string' } },
  required: ['summary'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: { ok: { type: 'boolean' }, reason: { type: 'string' } },
  required: ['ok', 'reason'],
}

// ---------------------------------------------------------------------------
// TASKS — the typed DAG for THIS phase. Each node: { id, label, taskType, phase,
// rationale, prompt, schema }. A node carries NO model/effort of its own: routeFor(taskType)
// resolves both against input.mode, so the same DAG prices itself under either mode.
//
// Routing rules of thumb (../references/model-routing.md, harness policy H8):
//   • Mode selects the COLUMN. Under 'optimize' each node runs at the cheapest tier that can
//     do its job; under 'full' every node is pinned to claude-opus-5 at its full-mode floor.
//   • Do NOT assert a fleet ceiling — check. Read the session model, compare it to the node's
//     target tier, OMIT opts.model on a match (route model:null), pin when a silent mismatch
//     would be costly. That is what routeFor()/optsFor() encode.
//   • Two kinds pin even in 'optimize' — 'gating' (a false "all clear" ships the bug) and
//     'planner' (every later node inherits its output). Mechanical/high-fan-out kinds route
//     DOWN to Haiku with effort OMITTED (modifier A, H6); implement routes down to Sonnet.
// ---------------------------------------------------------------------------
const TASKS = [
  // --- Scout phase: three INDEPENDENT nodes → run concurrently in a parallel() fan-out.
  {
    id: 'scout-inventory',
    label: 'scout:inventory',
    taskType: 'scout',
    phase: 'Scout',
    // EDIT ME: mechanical enumeration multiplied across the codebase. taskType 'scout' routes
    // it DOWN to Haiku with effort omitted under 'optimize' (modifier A / H6), and UP to the
    // ceiling under 'full', where modifier A is disabled by contract.
    rationale: 'mechanical inventory, budget-bound fan-out → scout route (Haiku, effort omitted) in balanced; ceiling in full (modifier A / H6)',
    prompt: 'Enumerate every call site / config touchpoint relevant to the task. Return raw data only.',
    schema: INVENTORY_SCHEMA,
  },
  {
    id: 'analyze-risk',
    label: 'analyze:risk',
    taskType: 'analyze',
    phase: 'Scout',
    // EDIT ME: real judgment → the 'analyze' route omits model in balanced so the agent
    // inherits the session tier (H8), and pins + lifts effort in full.
    rationale: 'risk analysis is judgment work → analyze route: inherit session model at high in balanced, pinned xhigh in full (H8)',
    prompt: 'Identify the highest-risk areas the change will touch and why. Return raw data only.',
    schema: INVENTORY_SCHEMA,
  },
  {
    id: 'analyze-arch',
    label: 'analyze:arch',
    taskType: 'analyze',
    phase: 'Scout',
    rationale: 'architecture read is judgment work → analyze route: inherit in balanced, pinned xhigh in full (H8)',
    prompt: 'Map the structural constraints (boundaries, invariants) the change must respect. Return raw data only.',
    schema: INVENTORY_SCHEMA,
  },

  // --- Plan phase: ONE decompose node. It consumes the FULL scout set, which is what
  // earns the barrier below (harness policy H2).
  // NOTE ON taskType: this is the phase's SINGLE decompose/planning node — the one node whose
  // output every later node is authored against — so it takes the 'planner' kind, which §M3
  // PINS in all three modes (claude-opus-5 at xhigh in balanced, max in full). It is also the one
  // place `--planner fable` may land (§M7): a single node, never a fan-out, never inside a
  // loop, so preconditions 1 and 2 hold structurally. It dispatches through plannerAgent()
  // below, which prints the §M7 disclosure and falls back to claude-opus-5 at max on a refusal
  // or an HTTP 400. If you retarget this node to plain within-phase summarizing that nothing
  // downstream depends on, change taskType back to 'synthesize' and dispatch with agent().
  {
    id: 'plan-batches',
    label: 'plan:batches',
    taskType: 'planner',
    phase: 'Plan',
    rationale: 'single decompose over the full scout set; every Build node is authored against it → planner route: pinned claude-opus-5 at xhigh in balanced, max in full, and the only node --planner fable may override (§M3/§M7)',
    prompt: 'Group the inventory into dependency-safe batches for the Build phase. Return raw data only.',
    schema: PLAN_SCHEMA,
  },

  // --- Build phase: a per-item PIPELINE (draft → verify), no barrier between stages (H1).
  {
    id: 'draft',
    label: 'draft', // per-item label is set at dispatch (draft:<item>)
    taskType: 'implement',
    phase: 'Build',
    // EDIT ME: production edit. The 'implement' route pins claude-sonnet-5 in balanced —
    // deliberately, not by inheritance: the session runs a tier above what this work needs,
    // so inheriting would pay the top tier for production volume. In full it runs at ceiling.
    rationale: 'production implementation → implement route: Sonnet 5 at high in balanced, pinned Opus 5 at high in full (H8)',
    prompt: 'Implement the change for this item. Return the diff and a one-line summary as raw data.',
    schema: DRAFT_SCHEMA,
  },
  {
    id: 'verify',
    label: 'verify', // per-item label set at dispatch (verify:<item>)
    taskType: 'gating',
    phase: 'Build',
    // EDIT ME: a false "all clear" here ships a broken change to every downstream item, so
    // this is correctness-critical → the 'gating' route, PINNED at claude-opus-5 / 'max' in
    // BOTH modes. It is pinned even in balanced so the check does not silently degrade when a
    // session runs below the top tier — modifier B has no travel left on model or effort here,
    // which is exactly why all-out mode answers it with WIDTH instead (§M4 rung 3, §M5, H4).
    rationale: 'false "all clear" ships the bug → gating route: pinned claude-opus-5 at max in all three modes, widened to 5 lenses in full (modifier B / H4)',
    prompt: 'Try to REFUTE that the draft is correct and complete. Default to ok=false if uncertain. Return raw data only.',
    schema: VERDICT_SCHEMA,
    // Declared lens set. Mode picks HOW MANY of these run — it never invents new ones (§M5).
    // EDIT ME: replace with the lenses that actually matter for this phase's verify.
    lenses: [
      'correctness: does the diff do what the item asked, exactly?',
      'regression: what previously-working behavior could this break?',
      'completeness: what part of the item did the draft silently skip?',
      'interface: does this change a contract another item depends on?',
      'failure modes: what input or ordering makes this diff wrong?',
    ],
  },
]

const byId = (id) => TASKS.find((t) => t.id === id)

// Cast + cost ledger — one line per node BEFORE dispatch, so the routing is legible and no
// coverage is silently narrowed (harness policy H6, no silent caps). 'inherit' = model omitted.
// The mode is on every row: the same model value means opposite things in the two columns,
// and this row is the only evidence of which one happened.
// A planner node under `--planner fable` reports claude-fable-5 here, not the table's default:
// §M7's ledger requirement is that a reader never has to guess which model produced the DAG.
for (const n of TASKS) {
  const r = routeFor(n.taskType)
  const model = (PLANNER && n.taskType === 'planner' ? PLANNER : r.model) || 'inherit'
  log(`cast ${n.id} [${n.taskType}] @${n.phase} mode:${MODE} → model:${model} effort:${r.effort || '—'} width:${WIDTH(n.taskType)} — ${n.rationale}`)
}
if (MODE === 'full') {
  log(`ESTIMATE approved at the §M6 pre-flight: ${ESTIMATE.agents} agents, ${ESTIMATE.tokensLow}–${ESTIMATE.tokensHigh} output tokens`)
}

// ---------------------------------------------------------------------------
// Scout phase — PARALLEL fan-out of the independent scout/analyze nodes.
// BARRIER earned per harness policy H2: plan-batches (next) needs the FULL scout set to
// decompose. This is NOT "cleaner code" — it is a genuine cross-item dependency.
// ---------------------------------------------------------------------------
const scoutNodes = TASKS.filter((t) => t.phase === 'Scout')
if (MODE === 'full') {
  // Modifier A (wide fan-out pushes a tier DOWN) is DISABLED in all-out mode: the human already
  // approved the bill at the pre-flight, so cheapening behind them is worse than the spend
  // (§M4). Log the suppression so a wide fan-out at ceiling reads as design, not oversight.
  log(`modifier-A: suppressed (mode=full) — ${scoutNodes.length}-item fan-out running at ceiling by design`)
}
const scoutRuns = await parallel(
  scoutNodes.map((n) => () => agent(`Task: ${input.task}\n${n.prompt}`, optsFor(n))),
)
// A skipped/dead agent resolves to null — filter before consuming (harness policy H5).
const liveScouts = scoutRuns.filter(Boolean)
const inventory = liveScouts.flatMap((s) => s.items || [])
log(`Scout [mode=${MODE}]: ${liveScouts.length}/${scoutNodes.length} nodes live, ${inventory.length} inventory items`)

// ---------------------------------------------------------------------------
// Plan phase — single decompose over the full scout set (consumes the barrier above).
// Dispatched through plannerAgent() so `--planner fable` reaches this node and only this node:
// the §M7 disclosure prints before it spawns, and a refusal or an HTTP 400 falls back to
// claude-opus-5 at max instead of losing the DAG. Under the default `--planner opus` this is
// exactly `agent(prompt, optsFor(planNode))`.
// ---------------------------------------------------------------------------
const planNode = byId('plan-batches')
const plan = await plannerAgent(
  `Task: ${input.task}\n${planNode.prompt}\nInventory: ${JSON.stringify(inventory)}`,
  planNode,
)
const batches = plan ? plan.batches : []
log(`Plan [mode=${MODE}]: ${batches.length} dependency-safe batch(es) over ${inventory.length} items`)

// ---------------------------------------------------------------------------
// Build phase — per-item PIPELINE: draft, then verify as soon as ITS draft lands (no barrier,
// harness policy H1). Stage callbacks receive (prevResult, originalItem, index).
// EDIT ME: this runs over the known work-list input.items (loop policy L6). If you instead
// cap or sample it, log() what was dropped — no silent caps (harness policy H6).
// ---------------------------------------------------------------------------
const draftNode = byId('draft')
const verifyNode = byId('verify')

// Verifier width is mode-resolved (§M5): 1 skeptic under optimize, 5 diverse lenses on a
// gating node under full. Mode picks how many of the node's DECLARED lenses run; it never
// invents new ones, so the slice is capped by the declared set and the cap is logged.
const lensCount = Math.min(WIDTH(verifyNode.taskType), verifyNode.lenses.length)
const activeLenses = verifyNode.lenses.slice(0, lensCount)
const killThreshold = Math.ceil(lensCount / 2) // majority-refute: 1 of 1, 2 of 3, 3 of 5
if (lensCount < WIDTH(verifyNode.taskType)) {
  log(`verify width capped at ${lensCount} — the node declares only ${verifyNode.lenses.length} lenses; declare more to widen (§M5)`)
}
log(`Build [mode=${MODE}]: verify width ${lensCount}, majority-refute kills at ${killThreshold}`)

const items = input.items || []
if (MODE === 'full' && items.length > 1) {
  log(`modifier-A: suppressed (mode=full) — ${items.length}-item fan-out running at ceiling by design`)
}

const built = await pipeline(
  items,
  // Stage 1: draft the change for each item.
  (item) =>
    agent(
      `Task: ${input.task}\n${draftNode.prompt}\nItem: ${JSON.stringify(item)}`,
      optsFor(draftNode, `draft:${item}`),
    ),
  // Stage 2: adversarially verify each draft at the gating route. The parallel() here is a
  // WITHIN-ITEM lens vote, not a cross-stage barrier — it fans one draft out to N independent
  // skeptics and reduces their votes for that draft alone, so H2's earned-barrier test does
  // not apply and no item waits on any other item's drafts.
  async (draft, item) => {
    const votes = await parallel(
      activeLenses.map((lens) => () =>
        agent(
          `Task: ${input.task}\n${verifyNode.prompt}\nLens: ${lens}\nItem: ${JSON.stringify(item)}\nDraft: ${JSON.stringify(draft)}`,
          optsFor(verifyNode, `verify:${item}#${lens.split(':')[0]}`),
        ),
      ),
    )
    // Dead verifiers resolve to null — filter before counting (harness policy H5).
    const live = votes.filter(Boolean)
    const refutes = live.filter((v) => v.ok === false).length
    const ok = live.length > 0 && refutes < killThreshold
    if (live.length < activeLenses.length) {
      log(`verify:${item} — ${activeLenses.length - live.length}/${activeLenses.length} lens(es) died; judging on ${live.length}`)
    }
    return {
      item,
      draft,
      verdict: {
        ok,
        reason: ok
          ? `${refutes}/${live.length} refutes, below the ${killThreshold} majority threshold`
          : live.map((v) => v.reason).filter(Boolean).join(' | ') || 'no live verifier returned a verdict',
      },
    }
  },
)

// Dead items resolve to null (H5); keep only drafts that survived verification.
const rows = built.filter(Boolean)
const shipped = rows.filter((r) => r.verdict && r.verdict.ok)
log(`Build [mode=${MODE}]: ${shipped.length}/${items.length} items passed the gating verify at width ${lensCount}`)

// Structured summary — the phase deliverable plus the routing ledger for the PM report.
return {
  phase: 'Construction',
  mode: MODE,
  planner: (input && input.planner) === 'fable' ? 'fable' : 'opus',
  estimate: ESTIMATE, // approved at the §M6 pre-flight; diff against journal.jsonl at the gate
  scouts: { live: liveScouts.length, total: scoutNodes.length, inventory: inventory.length },
  batches,
  shipped: shipped.map((r) => r.item),
  rejected: rows.filter((r) => !(r.verdict && r.verdict.ok)).map((r) => r.item),
  ledger: TASKS.map((n) => ({
    id: n.id,
    taskType: n.taskType,
    phase: n.phase,
    mode: MODE,
    // §M7 ledger requirement: a run whose planner was Fable says so in its cast row.
    model: (PLANNER && n.taskType === 'planner' ? PLANNER : routeFor(n.taskType).model) || 'inherit',
    effort: routeFor(n.taskType).effort || 'default',
    width: WIDTH(n.taskType),
    modifierA: MODE === 'full' ? 'suppressed' : 'active',
    rationale: n.rationale,
  })),
}
