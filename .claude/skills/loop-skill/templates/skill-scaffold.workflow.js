export const meta = {
  name: 'skill-scaffold',
  description: 'Author three or more conforming skills at once: research each standards shelf in parallel, check every draft description against the whole set at a barrier, then author each skill in its own directory.',
  phases: [
    { title: 'Research', detail: 'one scout per skill — primary-source standards, graded honestly' },
    { title: 'Boundary', detail: 'all drafts read side by side against each other and the existing set' },
    { title: 'Author', detail: 'one agent per skill — router, references, template' },
    { title: 'Verify', detail: 'conformance against the contract the gate cannot check' },
  ],
}

// EDIT ME — normalize args defensively (H10): some harnesses deliver args as a string.
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
// §M8 omission note: DRY_LIMIT is omitted — this template has no loop. The work-list is known
// (the caller names the skills), so per loop policy L6 it is a pipeline, never a discovery loop.

// EDIT ME — the skills to author, and where the plugin lives.
const REPO = (input && input.repoPath) || '.'
const SKILLS = (input && input.skills) || [] // [{ id: 'loop-x', purpose: '…', neighbours: ['loop-y'] }]

const SHELF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['skill', 'standards', 'unconfirmed'],
  properties: {
    skill: { type: 'string' },
    standards: {
      type: 'array', minItems: 3,
      items: {
        type: 'object', additionalProperties: false,
        required: ['name', 'edition', 'publisher', 'authoritative', 'governs'],
        properties: {
          name: { type: 'string' },
          edition: { type: 'string', description: 'Exact edition/version + date. Never unpinned.' },
          publisher: { type: 'string' },
          url: { type: 'string' },
          authoritative: { type: 'string', enum: ['Yes', 'Draft', 'No'] },
          governs: { type: 'string' },
        },
      },
    },
    unconfirmed: { type: 'array', items: { type: 'string' }, description: 'What you could NOT confirm. Never round an unknown up to a version.' },
  },
}

const BOUNDARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['descriptions', 'collisions', 'verdict'],
  properties: {
    descriptions: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['skill', 'description', 'discriminator'],
        properties: { skill: { type: 'string' }, description: { type: 'string' }, discriminator: { type: 'string' } },
      },
    },
    collisions: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['a', 'b', 'severity', 'resolution'],
        properties: { a: { type: 'string' }, b: { type: 'string' }, severity: { type: 'string', enum: ['high', 'medium', 'low'] }, resolution: { type: 'string' } },
      },
    },
    verdict: { type: 'string', description: 'Do all boundaries hold? If any pair is inseparable, say so and recommend a merge rather than inventing a distinction.' },
  },
}

const AUTHOR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['skill', 'filesWritten', 'deviations'],
  properties: {
    skill: { type: 'string' },
    filesWritten: { type: 'array', items: { type: 'string' } },
    deviations: { type: 'array', items: { type: 'string' }, description: 'Where you departed from the brief, and why. Empty if none.' },
  },
}

const VERIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['lens', 'findings'],
  properties: {
    lens: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['severity', 'file', 'claim'],
        properties: { severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, file: { type: 'string' }, claim: { type: 'string' } },
      },
    },
  },
}

const HOUSE = 'Plugin at ' + REPO + '. Read ' + REPO + '/docs/c4/skill-anatomy.md and ' + REPO + '/CONTRIBUTING.md first. ' +
  'Grade every standard Yes/Draft/No by provenance of authority, not quality. Confirm every edition against a PRIMARY source; ' +
  'write "unconfirmed as of <date>" rather than asserting one you could not check. Your final text IS the return value.'

if (!SKILLS.length) {
  log('No skills supplied in args.skills — nothing to do.')
  return { authored: [], note: 'args.skills was empty' }
}
log('Scaffolding ' + SKILLS.length + ' skills in --mode ' + MODE + '.')

// Stage 1: one shelf per skill. Independent — no barrier.
const shelves = await parallel(SKILLS.map((s) => () => agent(
  HOUSE + '\n\nResearch the standards shelf for `' + s.id + '`: ' + s.purpose +
  '\n\nFind the authorities this skill should reason from. Confirm each against its publisher. Grade honestly — ' +
  'an OSS project\'s own spec is a No, however good it is.',
  optsFor({ taskType: 'scout', phase: 'Research', schema: SHELF_SCHEMA }, 'shelf:' + s.id)
)))
const gotShelves = shelves.filter(Boolean)
log('Shelves: ' + gotShelves.length + '/' + SKILLS.length + (gotShelves.length < SKILLS.length ? ' — missing shelves are a gap, not a pass.' : ''))

// EARNED BARRIER (H2): the descriptions must be read SIDE BY SIDE — against each other and against the
// existing set — to prove mutual exclusivity. That is a cross-item reduce; a per-item hand-off cannot express it.
const boundary = await agent(
  HOUSE + '\n\nDraft the `description` for each skill below and prove the whole set is mutually exclusive.\n' +
  'Read every existing description in ' + REPO + '/.claude/skills/*/SKILL.md and ' + REPO + '/docs/design/boundary-audit.json.\n' +
  'Each description: what it does + when to use it + which sibling instead, on BOTH sides of every overlap.\n' +
  'Double-quote any value containing a colon-space, or the YAML will not parse.\n' +
  'Resolve every overlap on a CHECKABLE QUESTION. If a pair cannot be separated, say so and recommend a merge.\n\n' +
  'SKILLS: ' + JSON.stringify(SKILLS),
  optsFor({ taskType: 'analyze', phase: 'Boundary', schema: BOUNDARY_SCHEMA }, 'boundary')
)
if (!boundary) {
  log('FATAL: boundary analysis returned nothing. Authoring without agreed descriptions would ship colliding skills — aborting.')
  return { authored: [], aborted: 'no boundary analysis' }
}
log('Boundary verdict recorded; ' + (boundary.collisions || []).length + ' collision(s) resolved.')

// Stage 3: author each skill. Disjoint directories → isolation 'none' is correct (H7).
const authored = await parallel(SKILLS.map((s, i) => () => agent(
  HOUSE + '\n\nAuthor the complete `' + s.id + '` skill under ' + REPO + '/.claude/skills/' + s.id + '/.\n' +
  'Write SKILL.md (thin router, 6–13KB, discriminating predicate as its FIRST sentence), references/*.md ' +
  '(5–7 files incl. standards.md), and templates/' + s.id.replace('loop-', '') + '.workflow.js.\n' +
  'Take your description VERBATIM from the boundary analysis. Carry the ROUTES block byte-identically from ' +
  REPO + '/.claude/skills/loop-engine/references/execution-modes.md §M8.\n' +
  'Touch ONLY your own directory — siblings are being authored concurrently.\n\n' +
  'YOUR SHELF: ' + JSON.stringify(gotShelves.filter((x) => x && x.skill === s.id)) + '\n' +
  'YOUR DESCRIPTION: ' + JSON.stringify((boundary.descriptions || []).filter((d) => d.skill === s.id)),
  optsFor({ taskType: 'implement', phase: 'Author', schema: AUTHOR_SCHEMA }, 'author:' + s.id)
)))
const done = authored.filter(Boolean)
log('Authored ' + done.length + '/' + SKILLS.length + ' skills.')

// Stage 4: verify what the gate cannot. Width is mode-resolved (§M5).
const LENSES = [
  'Citation reality: is every pinned edition real and current? Check the ones you doubt against the publisher.',
  'Boundary discrimination: read all descriptions side by side. Is any pair decidable from only one direction?',
  'Router discipline: is each SKILL.md a thin router, or has it swollen into a reference file that loads every time?',
]
const lensSet = LENSES.slice(0, Math.max(1, Math.min(LENSES.length, WIDTH('verify'))))
if (lensSet.length < LENSES.length) log('Width cap: running ' + lensSet.length + '/' + LENSES.length + ' verify lenses in ' + MODE + ' mode.')

const checks = await parallel(lensSet.map((lens, i) => () => agent(
  HOUSE + '\n\nVerify the skills just written under ' + REPO + '/.claude/skills/. READ-ONLY.\n' +
  'The validation gate already covers frontmatter, node --check, ROUTES drift and path resolution — do NOT re-check those.\n' +
  'Your lens is the thing the gate CANNOT see:\n\n' + lens + '\n\nDefault to reporting a finding when uncertain.',
  optsFor({ taskType: 'verify', phase: 'Verify', schema: VERIFY_SCHEMA }, 'verify:' + i)
)))
const findings = checks.filter(Boolean).flatMap((c) => (c && c.findings) || [])
log('Verify: ' + findings.length + ' finding(s) the gate could not have caught.')

return {
  mode: MODE,
  authored: done,
  boundary,
  findings,
  dropped: { shelves: SKILLS.length - gotShelves.length, authors: SKILLS.length - done.length },
  next: 'Run `node scripts/validate.mjs`, then register each skill in README.md, INSTALL.md, CHANGELOG.md and docs/design/boundary-audit.json.',
}
