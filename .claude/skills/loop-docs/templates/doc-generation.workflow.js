// Template: DOC-GENERATION — document many modules/areas at once.
// Built on the workflow skill's pipeline pattern (harness policy H1, pipeline-default):
// each area flows through extract -> draft -> verify-accuracy with NO barrier between
// stages — area A can be in Verify while area B is still being read. The verify stage
// embodies the loop-docs ACCURACY rule (SKILL.md §5): a drafted doc that cannot be
// stood up against the source is aspirational, and this stage is what stops the fan-out
// from shipping it.
//
// Model/effort and verifier width come from the canonical ROUTES block — source of truth:
// ../../loop-engine/references/execution-modes.md §M8. Never inline a bare model:/effort: literal.
// The Draft stage is tagged `doc`, so in optimize mode it routes to claude-haiku-4-5 with effort
// OMITTED — Haiku 4.5 has no effort dial, and writing effort:'low' on it is a no-op at best.
// Under full mode every node moves to claude-opus-5 (§M3) and the accuracy check widens from one
// checker to three diverse lenses (§M5), reduced by majority refute.
//
// Invoke with: Workflow({ script, args: { areas: [...], docType: "reference", mode: "optimize" } })
// input.areas   — modules/paths to document (discover the work-list BEFORE authoring; see loop policy L6)
// input.docType — Diataxis/artifact type hint the drafters target (reference | how-to | readme | ...)
// input.mode    — 'optimize' (default) or 'full' (execution-modes.md §M2)
// input.planner — 'opus' (default) | 'fable' — planner-node override only (§M7); this template
//                 declares no planner node, so the flag is inert here and passes through harmlessly

export const meta = {
  name: 'doc-generation-template', // EDIT ME: kebab-case name for this run
  description: 'Extract intent per module, draft docs in repo conventions, verify every claim against the source', // EDIT ME
  phases: [
    { title: 'Extract', detail: 'read code, pull public surface per area' },
    { title: 'Draft', detail: 'write the doc per area in repo conventions' },
    { title: 'Verify', detail: 'adversarial accuracy check per drafted doc' },
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
const WIDTH = (kind) => (MODE === 'full' ? (kind === 'gating' ? 5 : 3) : 1)
function optsFor(node, label) {
  const r = routeFor(node.taskType)
  const opts = { label: label || node.label, phase: node.phase, schema: node.schema }
  if (r.model) opts.model = r.model     // omit → inherit session model (H8)
  if (r.effort) opts.effort = r.effort  // omit → inherit session effort
  if (PLANNER && node.taskType === 'planner') opts.model = PLANNER // §M7 override — planner nodes only
  return opts
}
// No DRY_LIMIT: this template has no loop stage (§M8 — omit what you do not use). WIDTH is kept:
// the Verify stage is a genuine adversarial accuracy check ("try to REFUTE this doc"), and §M5
// forbids full mode ever running a single skeptic on one. The lens set is declared below, so the
// §M5 rule that mode picks HOW MANY declared lenses run — never which exist — actually applies.
// No plannerAgent: no node in this template carries taskType 'planner', so §M8's third
// optional member is dropped too. `PLANNER` and its `optsFor()` line stay — they are invariant
// core, and the flag is simply inert here.

// EDIT ME: doc type the drafters target — see loop-docs SKILL.md §1 (Diataxis + artifact types).
const DOC_TYPE = (input && input.docType) || 'reference'

// EDIT ME: the Verify node's DECLARED accuracy lenses. Each re-checks the drafted doc against the
// source a DIFFERENT way (H4: diversity beats redundancy). Mode picks how MANY run (§M5); it never
// invents new ones. ORDER MATTERS — in optimize mode only lens[0] runs, so lens[0] must be the
// broadest check. Five are declared so a gating doc review can reach width 5 without inventing one.
const ACCURACY_LENSES = [
  { key: 'signatures', prompt: 'Check every stated signature, parameter name, default, return type, and error condition against the actual definition in the source. A name or comment is a hint to verify, never a fact to copy.' },
  { key: 'examples', prompt: 'Attack the examples: would each snippet or command actually run as written against this code, with these imports, this argument order, and this environment? An example that cannot run is an inaccurate claim.' },
  { key: 'omission', prompt: 'Hunt for what the doc leaves out that changes how it reads: an exported symbol never mentioned, a failure mode the caller must handle, a required setup step, a deprecation. Silence that misleads is an accuracy defect.' },
  { key: 'staleness', prompt: 'Assume the doc describes an older revision. Look for anything that describes intended or historical behavior rather than what the code in the tree does right now.' },
  { key: 'scope', prompt: 'Check the doc is about THIS area: no claims borrowed from a sibling module, no behavior attributed here that lives elsewhere, and no path, flag, or config key that belongs to another component.' },
]

// Verifier width is mode-resolved (§M5): 1 in optimize, 3 in full, 5 on a gating node. Capped by
// the declared lens set, and any cap is logged — no silent narrowing (H6).
const VERIFY_WIDTH = Math.min(WIDTH('verify'), ACCURACY_LENSES.length)
if (VERIFY_WIDTH < WIDTH('verify')) {
  log(`verifier width capped at ${VERIFY_WIDTH}: only ${ACCURACY_LENSES.length} lenses declared (§M5)`)
}
const ACTIVE_LENSES = ACCURACY_LENSES.slice(0, VERIFY_WIDTH)
// A doc is judged inaccurate on a MAJORITY refute at ⌈N/2⌉ — 1 of 1, 2 of 3, 3 of 5. Computed,
// never a literal, because a literal is silently wrong the moment width becomes 5. The reduce
// below recomputes it over the LIVE votes, so a dead checker narrows the vote, never the bar.
log(`verify [mode=${MODE}]: width ${VERIFY_WIDTH} (${ACTIVE_LENSES.map((l) => l.key).join(', ')}); a doc is inaccurate at ${Math.ceil(VERIFY_WIDTH / 2)} refute(s)`)

// EDIT ME: schema for the verified contract the Extract stage pulls from the source (harness policy H3).
// Names/comments are hints to verify, not facts to copy (SKILL.md §5) — extract from the definitions.
const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    purpose: { type: 'string' }, // what the module is for, in one or two sentences
    publicApi: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' }, // exported name
          signature: { type: 'string' }, // params + return type, read off the definition
          summary: { type: 'string' }, // what it does
          errors: { type: 'string' }, // thrown/returned error conditions
        },
        required: ['symbol', 'signature'],
      },
    },
    examples: { type: 'array', items: { type: 'string' } }, // runnable usage snippets
  },
  required: ['purpose', 'publicApi'],
}

// EDIT ME: the Draft stage writes the doc file itself and returns only where it landed.
const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    path: { type: 'string' }, // absolute path of the doc the agent wrote
    doc: { type: 'string' }, // title/type it produced, for the run log
  },
  required: ['path'],
}

const ACCURACY_SCHEMA = {
  type: 'object',
  properties: {
    accurate: { type: 'boolean' },
    corrections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string' }, // the drafted sentence that is wrong or unconfirmed
          fix: { type: 'string' }, // what the source actually says
        },
        required: ['claim', 'fix'],
      },
    },
  },
  required: ['accurate'],
}

if (!input || !Array.isArray(input.areas) || input.areas.length === 0) {
  return { documented: [], note: 'No areas supplied — pass input.areas as a non-empty array of modules/paths.' }
}

// Pipeline per area, NO barrier (harness policy H1). Stage callbacks receive
// (prevResult, originalArea, index); thread data forward by carrying it in the return value.
const results = await pipeline(
  input.areas,
  // Stage 1 — Extract: read the source and pull the verified public surface (SKILL.md §5).
  (area) =>
    agent(
      // EDIT ME: the per-area extraction prompt.
      `Read the code for this area and extract its intent as raw data. Read the actual definitions — treat names and comments as hints to verify, not facts to copy. Return the purpose, the public API (each exported symbol's real signature, summary, and error conditions), and runnable usage examples.\nArea: ${JSON.stringify(area)}`,
      optsFor({ taskType: 'analyze', phase: 'Extract', schema: INTENT_SCHEMA }, `extract:${area}`),
    ).then((intent) => ({ area, intent })),
  // Stage 2 — Draft: turn extracted intent into prose of the chosen type, in repo conventions.
  // The agent uses Write to create the doc file and returns only its path.
  (prev) =>
    agent(
      // EDIT ME: point the drafter at where docs live and the repo's format/tone/tooling (SKILL.md §3).
      `Write a "${DOC_TYPE}" doc for this area, matching the repo's existing doc conventions (location, format, heading depth, voice). Lead with a working example, use active voice, and do NOT hand-copy facts the code already states. Use the Write tool to create the file, then return its absolute path.\nArea: ${JSON.stringify(prev.area)}\nExtracted intent (JSON): ${JSON.stringify(prev.intent)}`,
      optsFor({ taskType: 'doc', phase: 'Draft', schema: DRAFT_SCHEMA }, `draft:${prev.area}`),
    ).then((draft) => ({ ...prev, draft })),
  // Stage 3 — Verify: adversarial accuracy check (harness policy H4). This stage IS the
  // SKILL.md §5 accuracy rule — the checkers re-read the SOURCE and the drafted doc and
  // default to accurate=false on any claim they cannot confirm against the code.
  // Width is mode-resolved (§M5): one checker per area in optimize, ACTIVE_LENSES.length
  // diverse checkers in full. The inner parallel() is a WITHIN-AREA lens vote, not a barrier —
  // no area waits on another area's drafts, so H2's earned-barrier test is not engaged.
  (prev) =>
    parallel(
      ACTIVE_LENSES.map((lens) => () =>
        agent(
          `Try to REFUTE this doc, don't rubber-stamp it. Re-read the source for the area, then read the drafted doc, and check every claim — signatures, return types, error conditions, defaults, example commands — against the actual code. Default accurate=false and list a correction for any claim you cannot confirm or that describes intended rather than provable behavior.\nArea: ${JSON.stringify(prev.area)}\nDrafted doc path: ${prev.draft && prev.draft.path}\n\nYour lens: ${lens.prompt}`,
          optsFor({ taskType: 'verify', phase: 'Verify', schema: ACCURACY_SCHEMA }, `verify:${lens.key}:${prev.area}`),
        ),
      ),
    ).then((votes) => {
      // Dead checkers resolve to null — filter before counting (harness policy H5).
      const live = votes.filter(Boolean)
      if (live.length < ACTIVE_LENSES.length) {
        log(`verify:${prev.area} — ${ACTIVE_LENSES.length - live.length}/${ACTIVE_LENSES.length} accuracy lens(es) died; judging on ${live.length}`)
      }
      const refutes = live.filter((v) => !v.accurate).length
      // No live checker means UNVERIFIED, which is not the same as accurate — default false (H4).
      const accurate = live.length > 0 && refutes < Math.max(1, Math.ceil(live.length / 2))
      const corrections = live.flatMap((v) => v.corrections || [])
      return { ...prev, accuracy: { accurate, corrections, votes: live.length, refutes } }
    }),
)

// Dead agents/areas resolve to null — harness policy H5. Split accurate docs from those
// that still carry unconfirmed claims so the caller knows which need a correction pass.
const documented = results.filter(Boolean)
const accurate = documented.filter((r) => r.accuracy && r.accuracy.accurate)
const needsFixes = documented.filter((r) => !(r.accuracy && r.accuracy.accurate))

log(`docs [mode=${MODE}]: ${documented.length}/${input.areas.length} areas drafted — ${accurate.length} verified accurate at width ${VERIFY_WIDTH}, ${needsFixes.length} need corrections`)

return {
  accurate: accurate.map((r) => ({ area: r.area, path: r.draft && r.draft.path })),
  needsFixes: needsFixes.map((r) => ({
    area: r.area,
    path: r.draft && r.draft.path,
    corrections: (r.accuracy && r.accuracy.corrections) || [],
  })),
}
