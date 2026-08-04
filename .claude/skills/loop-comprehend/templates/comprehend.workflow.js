// Template: COMPREHEND — recover an evidence-anchored map of an existing codebase
// (loop-comprehend SKILL.md §2–§5): as-built architecture, runtime flow, data model,
// dependency surface, and recovered decision sites, every claim carrying a file:line.
//
// Shape: inventory (scout) -> per-dimension mapping via pipeline() (no barrier — dimensions are
// independent, H1/H2) -> per-claim evidence verify (WITHIN-dimension lens vote, not a cross-item
// barrier) -> one synthesize join (earned: the dossier must reconcile every dimension's confirmed
// claims at once — cross-dimension contradictions ARE the drift findings). Verification judges
// EVIDENCE QUALITY only — does the cited line show what the claim states — it never re-litigates
// the map; recovery method and authority live in the skill's references.
//
// Invoke with: Workflow({ script, args: { target: "<repo or subsystem path>", concern: "<optional
// stakeholder concern, e.g. 'deployment topology'>", asOf: "<commit-hash YYYY-MM-DD>", mode: "balanced" } })
// asOf is passed in because the sandbox has no clock (H10) — stamp it at authoring time.

export const meta = {
  name: 'comprehend-template', // EDIT ME
  description: 'Map an existing codebase: structure, flow, data, dependencies, recovered decisions — every claim evidence-verified into a dated dossier', // EDIT ME
  phases: [
    { title: 'Inventory', detail: 'load-bearing artifacts and entry points' },
    { title: 'Map', detail: 'one dimension per agent, pipelined' },
    { title: 'Verify', detail: 'evidence check per claim' },
    { title: 'Dossier', detail: 'synthesize, drift and coverage stated' },
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
// Sanctioned omission (template-contract): DRY_LIMIT is dropped — this template has no loop.

const TARGET = (input && input.target) || 'the current repository' // EDIT ME
const CONCERN = (input && input.concern) || 'module structure and runtime behavior'
const AS_OF = (input && input.asOf) || 'UNSTAMPED — pass asOf: "<commit> <date>" (sandbox has no clock)'

// The five mapping dimensions — one agent each, pipelined (H1: no barrier between map and
// verify; one dimension's claims verify while another dimension is still mapping).
const DIMENSIONS = [
  { key: 'structure', brief: 'As-built structure: components and their boundaries, recovered from the import/dependency graph — not from directory names. For every boundary claim, run the one-step check (who imports whose internals?) and cite it. Mark directory-vs-import drift explicitly.' },
  { key: 'flow', brief: 'Runtime flow: the entry points (routes, CLI commands, event subscriptions, scheduled jobs) and the primary path from the most central entry point to its observable effect, hop by hop. At every indirection (DI, dispatch table, config-selected impl) record how it was resolved and which selector value was assumed.' },
  { key: 'data', brief: 'Data model as enforced: schemas, migrations, message contracts. Which component writes each store; whether any ownership claim fails its check (a second writer exists). Cite the schema/migration file, not documentation about it.' },
  { key: 'dependencies', brief: 'External dependency surface: manifests, pinned versions, held-back pins, and services reached over the network (clients constructed, URLs/queues configured). A held-back or unusual pin is also a decision-site lead — note it for the decisions dimension.' },
  { key: 'decisions', brief: 'Decision sites: dependencies chosen, schema shapes, seams, repo-wide patterns, tuned constants, conspicuous absences. For each: what the code shows (cited), what git history states (commit/PR quoted if found), and a confidence grade — evidenced | inferred | speculative. Never state inferred rationale as fact.' },
]

const INVENTORY_SCHEMA = {
  type: 'object',
  properties: {
    artifacts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          role: { type: 'string', enum: ['build', 'entrypoint', 'schema', 'ci', 'registry', 'docs', 'test-root'] },
          note: { type: 'string' },
        },
        required: ['path', 'role'],
      },
    },
  },
  required: ['artifacts'],
}
const CLAIMS_SCHEMA = {
  type: 'object',
  properties: {
    claims: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          statement: { type: 'string' },  // one factual claim about the system
          where: { type: 'string' },      // file:line (or commit hash) — the evidence pointer
          evidence: { type: 'string' },   // the quoted line(s) the claim rests on
          evidenceClass: { type: 'string', enum: ['static', 'runtime', 'test', 'history', 'inferred'] },
          confidence: { type: 'string', enum: ['evidenced', 'inferred', 'speculative'] },
        },
        required: ['statement', 'where', 'evidence', 'evidenceClass', 'confidence'],
      },
    },
    coverage: { type: 'string' },         // what this dimension read in full / sampled / skipped
  },
  required: ['claims', 'coverage'],
}
const EVIDENCE_SCHEMA = {
  type: 'object',
  properties: { holds: { type: 'boolean' }, reason: { type: 'string' } },
  required: ['holds'],
}
const DOSSIER_SCHEMA = {
  type: 'object',
  properties: {
    theory: { type: 'string' },           // the one-paragraph theory of the system
    map: { type: 'string' },              // C4-shaped description (mermaid source welcome), every element citing evidence
    drift: { type: 'array', items: { type: 'string' } },   // as-built vs as-documented disagreements
    recoveredDecisions: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, confidence: { type: 'string' }, summary: { type: 'string' }, evidence: { type: 'string' } }, required: ['title', 'confidence', 'summary'] } },
    handoffs: { type: 'array', items: { type: 'string' } }, // findings that belong to loop-design / loop-debug / loop-docs
    coverage: { type: 'string' },          // the merged coverage statement — non-negotiable (SKILL.md §6)
  },
  required: ['theory', 'map', 'drift', 'recoveredDecisions', 'handoffs', 'coverage'],
}

phase('Inventory')
const inventory = await agent(
  `Target: ${TARGET}. Concern: ${CONCERN}. Inventory the LOAD-BEARING artifacts only — build/manifest files, entry points (main, route tables, CLI parsers, event subscriptions, scheduled jobs), schema/migration roots, CI config, handler/plugin registries, test roots, and the docs that claim to describe architecture. Return paths and roles, not prose. Do not read code bodies yet.`,
  optsFor({ taskType: 'scout', phase: 'Inventory', label: 'inventory', schema: INVENTORY_SCHEMA }),
)
const inventoryText = JSON.stringify((inventory && inventory.artifacts) || [])

// MAP -> VERIFY per dimension, no barrier (H1). Every claim must carry quoted evidence;
// the verify stage checks the EVIDENCE (external, greppable) — not an opinion of the map.
const mapped = await pipeline(
  DIMENSIONS,
  (d) =>
    agent(
      `Map ${TARGET} on ONE dimension, for the concern: ${CONCERN}.\nLoad-bearing artifacts:\n${inventoryText}\n\nDimension [${d.key}]: ${d.brief}\nWork hypothesis-first: form the model from the artifacts, then read to confirm or refute — do not read the repo front to back. Every claim MUST cite where (file:line or commit) and quote the evidence line it rests on; a claim without quotable evidence is not a claim — leave it out or grade it speculative with an empty-quote reason. Close with this dimension's coverage: read in full / sampled / skipped.`,
      optsFor({ taskType: 'analyze', phase: 'Map', schema: CLAIMS_SCHEMA }, `map:${d.key}`),
    ),
  (res, d) => {
    const claims = (res && res.claims) || []
    const coverage = (res && res.coverage) || 'coverage not stated'
    if (!claims.length) { log(`map ${d.key}: no claims`); return { d, confirmed: [], coverage } }
    return parallel(
      claims.map((c) => () =>
        agent(
          `Verify EVIDENCE ONLY — do not re-judge the map. Claim: ${c.statement}\nClaimed locus: ${c.where}\nQuoted evidence: ${c.evidence}\nGo to the locus. Does the quoted line exist there, and does it show what the claim states? For confidence '${c.confidence}': holds=false if a claim graded 'evidenced' rests on inference rather than a quotable source. holds=false if the quote is absent, altered, or does not support the claim.`,
          optsFor({ taskType: 'verify', phase: 'Verify', schema: EVIDENCE_SCHEMA }, `verify:${d.key}:${(c.statement || '').slice(0, 40)}`),
        ).then((v) => (v && v.holds ? c : null)),
      ),
    ).then((checked) => {
      const confirmed = checked.filter(Boolean) // dead/failed verifiers drop the claim (H5): unverified is not confirmed
      log(`map ${d.key}: ${claims.length} claim(s), ${confirmed.length} evidence-confirmed`)
      return { d, confirmed, coverage }
    })
  },
)

phase('Dossier')
// Earned barrier (H2): the dossier genuinely needs every dimension's confirmed claims at once —
// cross-dimension reconciliation (a structure claim contradicting a flow claim IS a drift finding)
// is cross-item by definition.
const all = mapped.filter(Boolean)
const dossier = await agent(
  `Synthesize the comprehension dossier for ${TARGET} (concern: ${CONCERN}), as of ${AS_OF}. Evidence-confirmed claims by dimension, each with its coverage statement:\n${JSON.stringify(all.map((a) => ({ dimension: a.d.key, coverage: a.coverage, claims: a.confirmed })))}\n\nReconcile across dimensions: where two dimensions' claims disagree, report the disagreement as drift — do not silently pick one. Write the one-paragraph theory, then the map (C4 altitude: containers, then components for the concern), every element citing its evidence. Recovered decisions keep their confidence grades verbatim — never promote a grade to read better. Route out-of-scope findings to handoffs (re-decisions → loop-design, defects → loop-debug, doc rot → loop-docs); the dossier itself stays descriptive. Merge the per-dimension coverage statements into one honest coverage section, including which claims are runtime- vs static- vs history-anchored.`,
  optsFor({ taskType: 'synthesize', phase: 'Dossier', schema: DOSSIER_SCHEMA }, 'dossier'),
)

const total = all.reduce((n, a) => n + a.confirmed.length, 0)
log(`done: ${total} evidence-confirmed claim(s) across ${DIMENSIONS.length} dimensions · as of ${AS_OF} · mode=${MODE}`)
return { target: TARGET, concern: CONCERN, asOf: AS_OF, executionMode: MODE, dossier, byDimension: all.map((a) => ({ dimension: a.d.key, coverage: a.coverage, confirmed: a.confirmed })) }
