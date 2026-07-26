// Template: TEST-GENERATION — generate automated tests across many modules.
// Built on the workflow skill patterns: a per-module pipeline (harness policy H1,
// pipeline is the DEFAULT and there is NO barrier between modules) with two stages:
// design cases -> write the test file to repo conventions.
// Running and verifying the generated tests is deliberately NOT a stage here — it is
// delegated to the Claude Code built-in `verify` skill after the run (see the note at
// the bottom and the skill, step 5). This keeps the workflow a pure generation pipeline.
//
// Model/effort come from the canonical ROUTES block — source of truth:
// ../../loop-engine/references/execution-modes.md §M8. Never inline a bare model:/effort: literal.
//
// Invoke with: Workflow({ script, args: { modules: [...], framework: "...", mode: "optimize" } })
// input.modules   — the modules/files/units to test (discover the work-list BEFORE authoring; loop policy L6)
// input.framework — one-line hint about the repo's test stack (e.g. "vitest", "pytest", "go test");
//                   agents still detect and MATCH the repo's real conventions (see references/framework-conventions.md)
// input.mode      — 'optimize' (default) or 'full' (execution-modes.md §M2)

export const meta = {
  name: 'test-generation-template', // EDIT ME: kebab-case name for this run
  description: 'Per module: design test cases, then write the test file to repo conventions — no barrier between modules',
  phases: [
    { title: 'Design', detail: 'characterize the unit + design cases, one agent per module' }, // EDIT ME: mirror phase names
    { title: 'Write', detail: 'write the test file to repo conventions per module' },
  ],
}

// Some harnesses deliver args as a JSON-encoded string — normalize before use.
const input = typeof args === 'string' ? JSON.parse(args) : args

// Canonical ROUTES block — single source of truth: loop-engine/references/execution-modes.md §M8.
// Duplicated verbatim into every template that sets model or effort. H10 gives scripts no module
// access, so duplication is intentional; drift is a defect (see CONTRIBUTING's ROUTES grep).
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
function optsFor(node, label) {
  const r = routeFor(node.taskType)
  const opts = { label: label || node.label, phase: node.phase, schema: node.schema }
  if (r.model) opts.model = r.model     // omit → inherit session model (H8)
  if (r.effort) opts.effort = r.effort  // omit → inherit session effort
  if (PLANNER && node.taskType === 'planner') opts.model = PLANNER // §M7 override — planner nodes only
  return opts
}
// No WIDTH / DRY_LIMIT: the fails-for-the-right-reason check is delegated OUT of this script to
// the built-in `verify` skill (see the closing note), so there is no in-script verify stage to widen.
// No plannerAgent: no node in this template carries taskType 'planner', so §M8's third
// optional member is dropped too. `PLANNER` and its `optsFor()` line stay — they are invariant
// core, and the flag is simply inert here.

// EDIT ME: framework hint threaded into every agent prompt. Agents MUST still detect and match
// the repo's real stack (framework, runner, file naming, fixtures, assertion style) — never
// introduce a new one (see the skill, step 2, and references/framework-conventions.md).
const FRAMEWORK =
  (input && input.framework) ||
  'Detect the repo test stack (framework, runner, file naming, fixtures, assertion style) and MATCH it exactly. Do not introduce a new framework.'

// Design stage returns a structured case list per module (harness policy H3 — schema on every consumed agent).
const CASES_SCHEMA = {
  type: 'object',
  properties: {
    unitSummary: { type: 'string' }, // behavior, inputs, outputs, side effects, contracts
    cases: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' }, // behavior the test pins down, phrased as a sentence
          kind: { type: 'string' }, // happy | edge | error | property
          setup: { type: 'string' }, // arrange: inputs and world state
          assertion: { type: 'string' }, // expected observable output or side effect
        },
        required: ['name', 'kind', 'assertion'],
      },
    },
  },
  required: ['cases'],
}

// Write stage returns the path written and how many tests it contains (harness policy H3).
const WRITE_SCHEMA = {
  type: 'object',
  properties: {
    path: { type: 'string' }, // the test file the agent wrote
    testCount: { type: 'number' },
    notes: { type: 'string' },
  },
  required: ['path'],
}

// H5-adjacent guard: nothing to do without a work-list. Discover modules before running.
if (!input || !input.modules || input.modules.length === 0) {
  return { generated: 0, note: 'No modules provided; discover the work-list before running (loop policy L6).' }
}

// Per-module pipeline: Design -> Write, NO barrier between modules (harness policy H1, pipeline default).
// Module A can be in Write while module B is still in Design; wall-clock is the slowest single chain.
const results = await pipeline(
  input.modules,
  // Stage 1: characterize the unit and design cases (skill steps 1 + 3).
  // opts.phase per call (not global phase()) inside a pipeline stage — harness policy H9.
  (mod) =>
    agent(
      `Characterize the unit under test and design its test cases. Read the module and its contract first.\n` +
        `Module: ${JSON.stringify(mod)}\n` +
        `Cover happy path, edge/boundary, error/exception, and property-based cases where valuable. ` +
        `Test BEHAVIOR (observable outputs and side effects), not implementation. Return the case list as raw data.`,
      optsFor({ taskType: 'analyze', phase: 'Design', schema: CASES_SCHEMA }, `design:${mod}`),
    ).then((d) => ({ mod, design: d })),
  // Stage 2: write the test file as soon as ITS design completes (no barrier).
  // Stage callbacks receive (prevResult, originalItem, index) — use originalItem here, not threaded context.
  (designed, mod) => {
    if (!designed || !designed.design || !designed.design.cases || designed.design.cases.length === 0) {
      return null // empty/dead design resolves to null and is filtered downstream — harness policy H5
    }
    return agent(
      `Write automated tests for this module and save the file with the Write tool.\n` +
        `Framework hint: ${FRAMEWORK}\n` +
        `Module: ${JSON.stringify(mod)}\n` +
        `Cases to implement (JSON): ${JSON.stringify(designed.design.cases)}\n` +
        `Follow AAA (arrange-act-assert); keep tests deterministic, fast, isolated; mock ONLY at trust boundaries. ` +
        `Name each test after the behavior it checks, matching the repo's file naming and location conventions. ` +
        `Write the file, then return its path and the number of tests it contains as raw data.`,
      optsFor({ taskType: 'implement', phase: 'Write', schema: WRITE_SCHEMA }, `write:${mod}`),
    ).then((w) => ({ mod, write: w }))
  },
)

// Dead agents / skipped modules resolve to null — harness policy H5. Always filter before consuming.
const written = results.filter(Boolean).filter((r) => r.write && r.write.path)
log(`write [mode=${MODE}]: ${written.length}/${input.modules.length} modules produced a test file`)

// NOTE: this workflow generates tests; it does NOT run or verify them. After it returns,
// exercise the new files with the Claude Code built-in `verify` skill (skill, step 5):
// confirm each test was actually collected and executed (a skipped/uncollected test is a
// silent no-op) and passes for real, and that every regression test went red on the
// unfixed code first. That is the earned adversarial check (harness policy H4) for this task.
return {
  generated: written.length,
  modules: input.modules.length,
  verifyNext: 'Run the generated tests with the built-in `verify` skill; they are unverified until then.',
  results: written.map((r) => ({
    module: r.mod,
    path: r.write.path,
    testCount: r.write.testCount || null,
  })),
}
