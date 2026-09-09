// Local advisory retrieval; never a workflow executor or a model-tier router.
// The lexical order is ADR-0007's unchanged order. The optional, separate classifier
// uses multinomial naive Bayes with add-one smoothing and empirical class priors.
import { readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { boundaryLookup, buildSeparatingQuestion } from '../../mcp/lib/boundary_lookup.mjs'
import { tokenize } from '../../mcp/lib/boundary.mjs'

export const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const AUDIT = 'docs/design/boundary-audit.json'
const MODES = '.claude/skills/loop-engine/references/execution-modes.md'
const SCHEMA = 'proof-software-context-v1'
const ALGORITHM = 'multinomial-naive-bayes-add-one-ascii-v1'
const STOP = new Set('a an and are as at be by can for from i in is it of on or our that the their this to we with you'.split(' '))
const lex = (text) => tokenize(text).filter((t) => t.length > 1 && !STOP.has(t))
const sha = (value) => createHash('sha256').update(value).digest('hex')
const encode = (value) => JSON.stringify(value)
const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0
const unique = (items) => [...new Set(items)]
const entryPath = (skill) => `.claude/skills/${skill}/SKILL.md`
const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x)
// These are the modules actually imported by this process. --root may relocate
// data, but must not attribute different implementation bytes to this runtime.
const RUNTIME_SOURCES = new Map(['mcp/lib/boundary.mjs', 'mcp/lib/boundary_lookup.mjs',
  'scripts/lib/software-context.mjs'].map((path) => [path, sha(readFileSync(join(DEFAULT_ROOT, path)))]))
const validPath = (value) => typeof value === 'string' && value.trim().length > 0

function fail(code, message) {
  const error = new Error(message)
  error.code = code
  throw error
}

function read(path, maxBytes = 8 * 1024 * 1024) {
  let bytes
  try { bytes = readFileSync(path) } catch { fail('source_missing', `Cannot read ${path}`) }
  if (bytes.length > maxBytes) fail('invalid_argument', `Input exceeds ${maxBytes} bytes: ${path}`)
  return bytes.toString('utf8')
}

function keysExactly(value, keys) {
  return isObject(value) && encode(Object.keys(value).sort()) === encode([...keys].sort())
}

function catalog(root) {
  let audit
  try { audit = JSON.parse(read(join(root, AUDIT))) } catch (error) {
    fail('source_unparseable', `Cannot read the authoritative boundary audit (${error.code || 'invalid_json'}).`)
  }
  if (!Array.isArray(audit.matrix) || audit.matrix.length < 2 ||
      audit.matrix.some((r) => !isObject(r) || !/^loop-[a-z0-9-]+$/.test(r.skill) ||
        typeof r.scope !== 'string' || !Array.isArray(r.useInsteadWhen)) ||
      new Set(audit.matrix.map((r) => r.skill)).size !== audit.matrix.length) {
    fail('source_unparseable', 'Invalid boundary matrix; restore its normative source.')
  }
  const skills = audit.matrix.map((r) => r.skill).sort(cmp)
  const installed = readdirSync(join(root, '.claude/skills'), { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^loop-/.test(e.name)).map((e) => e.name).sort(cmp)
  if (encode(skills) !== encode(installed)) fail('source_stale', 'Skill catalog and boundary matrix disagree; reconcile before routing.')
  const paths = [AUDIT, MODES, 'mcp/boundary-match-contract.json', 'mcp/lib/boundary.mjs',
    'mcp/lib/boundary_lookup.mjs', 'scripts/lib/software-context.mjs', ...skills.map(entryPath)].sort(cmp)
  const texts = new Map(paths.map((path) => [path, read(join(root, path))]))
  const sources = Object.fromEntries(paths.map((path) => [path, sha(texts.get(path))]))
  for (const [path, hash] of RUNTIME_SOURCES) if (sources[path] !== hash) {
    fail('runtime_mismatch', `Source root implementation differs from loaded runtime: ${path}. Run that checkout's own helper instead.`)
  }
  return { skills, texts, sources, sourceSha256: sha(encode(sources)) }
}

function validateRows(text, skills) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 4 || lines.length > 4096) fail('invalid_training', 'Training requires 4–4096 reviewed train rows and at least two examples per class.')
  const ids = new Set(), tasks = new Set(), counts = new Map()
  const rows = lines.map((line, index) => {
    let row
    try { row = JSON.parse(line) } catch { fail('invalid_training', `Training row ${index + 1} is invalid JSON.`) }
    if (!keysExactly(row, ['id', 'split', 'task', 'skill', 'reviewed', 'provenance']) ||
        typeof row.id !== 'string' || !row.id.trim() || row.id.length > 120 ||
        row.split !== 'train' || row.reviewed !== true || !skills.includes(row.skill) ||
        typeof row.task !== 'string' || row.task.length > 4000 || unique(lex(row.task)).length < 2 ||
        !keysExactly(row.provenance, ['kind', 'reviewer', 'source']) ||
        !['synthetic', 'team-reviewed'].includes(row.provenance.kind) ||
        ['reviewer', 'source'].some((k) => typeof row.provenance[k] !== 'string' ||
          !row.provenance[k].trim() || row.provenance[k].length > 300)) {
      fail('invalid_training', `Training row ${index + 1} needs a valid skill, train split, reviewed:true, and explicit provenance.`)
    }
    const taskKey = lex(row.task).join(' ')
    if (ids.has(row.id) || tasks.has(taskKey)) fail('invalid_training', `Training row ${index + 1} duplicates an ID or normalized task.`)
    ids.add(row.id); tasks.add(taskKey)
    counts.set(row.skill, (counts.get(row.skill) || 0) + 1)
    return row
  })
  if (counts.size < 2 || [...counts.values()].some((n) => n < 2)) {
    fail('invalid_training', 'Training requires at least two classes and two reviewed examples per class.')
  }
  return rows
}

function fit(rows) {
  const vocabulary = unique(rows.flatMap((r) => lex(r.task))).sort(cmp)
  const classes = unique(rows.map((r) => r.skill)).sort(cmp).map((skill) => {
    const samples = rows.filter((r) => r.skill === skill)
    const counts = new Map()
    for (const row of samples) for (const term of lex(row.task)) counts.set(term, (counts.get(term) || 0) + 1)
    return { skill, documents: samples.length, tokens: [...counts.values()].reduce((a, b) => a + b, 0),
      counts: Object.fromEntries([...counts].sort(([a], [b]) => cmp(a, b))) }
  })
  return { vocabulary, classes }
}

function makeModel(root, dataPath) {
  const cat = catalog(root)
  let path
  try { path = realpathSync(resolve(dataPath)) } catch { fail('source_missing', 'Reviewed training source is missing.') }
  const raw = read(path, 4 * 1024 * 1024)
  const rows = validateRows(raw, cat.skills)
  const data = fit(rows)
  const payload = { schema: SCHEMA, algorithm: ALGORITHM, sourceSha256: cat.sourceSha256,
    sources: cat.sources, training: { path, sha256: sha(raw), rows: rows.length,
      syntheticRows: rows.filter((r) => r.provenance.kind === 'synthetic').length,
      provenance: 'Review declarations are supplied labels, not authenticated human approvals.' }, ...data }
  return { ...payload, modelSha256: sha(encode(payload)) }
}

export function trainModel({ root = DEFAULT_ROOT, dataPath, outPath }) {
  if (![root, dataPath, outPath].every(validPath)) fail('invalid_argument', 'train requires non-empty root, dataPath, and outPath paths.')
  const model = makeModel(resolve(root), dataPath)
  try { writeFileSync(resolve(outPath), `${encode(model)}\n`, { flag: 'wx', mode: 0o600 }) } catch (error) {
    fail('output_unavailable', error.code === 'EEXIST' ? 'Output exists; choose a new artifact path.' : 'Cannot create model artifact.')
  }
  return { ok: true, advisoryOnly: true, artifact: resolve(outPath), algorithm: ALGORITHM,
    modelSha256: model.modelSha256, sourceSha256: model.sourceSha256, trainingSha256: model.training.sha256,
    trainingRows: model.training.rows, syntheticRows: model.training.syntheticRows,
    classes: model.classes.map((r) => r.skill), note: 'Opt-in experimental classifier. Synthetic fixtures demonstrate plumbing, not team accuracy or billed savings.' }
}

function loadModel(root, modelPath, cat) {
  let model
  try { model = JSON.parse(read(resolve(modelPath))) } catch { fail('invalid_model', 'Cannot parse model artifact; retrain from reviewed train data.') }
  if (!keysExactly(model, ['schema', 'algorithm', 'sourceSha256', 'sources', 'training', 'vocabulary', 'classes', 'modelSha256']) ||
      model.schema !== SCHEMA || model.algorithm !== ALGORITHM ||
      !keysExactly(model.training, ['path', 'sha256', 'rows', 'syntheticRows', 'provenance']) ||
      typeof model.training.path !== 'string') fail('invalid_model', 'Unsupported or malformed model artifact.')
  const { modelSha256, ...payload } = model
  if (sha(encode(payload)) !== modelSha256) fail('invalid_model', 'Model checksum mismatch; retrain instead of editing artifacts.')
  if (model.sourceSha256 !== cat.sourceSha256 || encode(model.sources) !== encode(cat.sources)) {
    fail('stale_model', 'Skill, boundary, routing contract, or algorithm sources changed; review labels and retrain.')
  }
  let expected
  try { expected = makeModel(root, model.training.path) } catch { fail('stale_model', 'Reviewed training source is missing or no longer valid; review labels and retrain.') }
  if (expected.training.sha256 !== model.training.sha256) fail('stale_model', 'Training source changed; review labels and retrain.')
  if (encode(expected) !== encode(model)) fail('invalid_model', 'Artifact statistics do not match reviewed training data; retrain.')
  return model
}

function learnedCandidates(model, task, limit) {
  const terms = lex(task)
  const vocabulary = new Set(model.vocabulary)
  const known = terms.filter((t) => vocabulary.has(t))
  const df = (term) => model.classes.filter((c) => Object.hasOwn(c.counts, term)).length
  const dfMax = Math.max(1, Math.floor(model.classes.length / 4))
  const scored = model.classes.map((c) => {
    const supportingTerms = unique(known).filter((t) => Object.hasOwn(c.counts, t) && df(t) <= dfMax)
    const rawScore = Math.log(c.documents / model.training.rows) + known.reduce((sum, term) =>
      sum + Math.log(((Object.hasOwn(c.counts, term) ? c.counts[term] : 0) + 1) / (c.tokens + model.vocabulary.length)), 0)
    return { skill: c.skill, rawScore, supportingTerms }
  }).sort((a, b) => b.rawScore - a.rawScore || cmp(a.skill, b.skill))
  // Evidence gate is term-based, never a probability/confidence threshold.
  // Ties and near-exact floating-point ties abstain; a large margin is not correctness.
  const lacksEvidence = unique(known).length < 2 || scored[0].supportingTerms.length < 2 ||
    Math.abs(scored[0].rawScore - scored[1].rawScore) < 1e-12
  return { algorithm: ALGORITHM, modelSha256: model.modelSha256, trainingSha256: model.training.sha256,
    syntheticRows: model.training.syntheticRows, status: lacksEvidence ? 'abstain' : 'candidates',
    scoreMeaning: 'Uncalibrated log score, not a probability, confidence, or boundary ruling; separate from lexical scores.',
    reason: lacksEvidence ? 'Fewer than two distinct class-discriminating terms or tied scores.' : 'Reviewed training vocabulary supplies at least two class-discriminating terms; inspect boundaries.',
    knownTerms: unique(known), candidates: lacksEvidence ? [] : scored.slice(0, limit).map((c) => ({
      skill: c.skill, path: entryPath(c.skill), score: Number(c.rawScore.toFixed(6)), reasons: c.supportingTerms })) }
}

function compactCandidate(c) {
  return { skill: c.skill, path: entryPath(c.skill), ...(c.score === undefined ? {} : { score: c.score }),
    scope: c.scope, reasons: c.matchedTerms || ['Explicit skill supplied by caller; no classifier used.'],
    boundaryPointer: c.citation.section, descriptionStatus: c.descriptionIsStale }
}

function auditSummary(audit, skills) {
  return { status: 'summary-only; not a passing audit', source: AUDIT, fullReport: 'boundary_lookup',
    matrixSize: audit.matrixSize, edgeCount: audit.edgeCount, reciprocalEdges: audit.reciprocalEdges,
    oneWayEdges: audit.oneWayEdges, overlapCount: audit.overlapCount,
    ratedOverlapsOneWayInMatrix: audit.ratedOverlapsOneWayInMatrix.length,
    zeroInDegreeSkills: audit.zeroInDegreeSkills.length,
    skillsWithNoApprovedDescription: audit.skillsWithNoApprovedDescription.length,
    skillsWithNoRatedOverlap: audit.skillsWithNoRatedOverlap.length,
    pairsWithNoStoredDiscriminator: audit.pairsWithNoStoredDiscriminator,
    descriptionDrift: audit.descriptionDrift.length,
    candidateFindings: skills.map((skill) => ({ skill,
      findings: ['zeroInDegreeSkills', 'skillsWithNoApprovedDescription', 'skillsWithNoRatedOverlap', 'descriptionDrift']
        .filter((key) => audit[key].includes(skill)) })).filter((row) => row.findings.length),
    candidateOneWayOverlaps: audit.ratedOverlapsOneWayInMatrix
      .filter((row) => row.pair.split('|').some((skill) => skills.includes(skill)))
      .map((row) => ({ pair: row.pair, severity: row.severity, storedOnlyOn: row.storedOnlyOn, pointer: row.citation.section })) }
}

function readPlan(cat, skills, outcome) {
  const entries = skills.map((skill) => {
    const path = entryPath(skill)
    return { path, characters: cat.texts.get(path).length, sha256: cat.sources[path], read: 'complete-entrypoint' }
  })
  const totalCharacters = entries.reduce((sum, entry) => sum + entry.characters, 0)
  const allEntrypointCharacters = cat.skills.reduce((sum, skill) => sum + cat.texts.get(entryPath(skill)).length, 0)
  return { purpose: outcome === 'exact' ? 'Read the explicitly requested complete skill entrypoint.' : outcome === 'abstain'
    ? 'Start with loop-guide to clarify scope; do not assign the highest score by default.'
    : 'Adjudicate candidates with the boundary audit, then read the chosen complete entrypoint; the listed union is a cost ceiling for candidate entrypoints.',
    entries, totalCharacters, allEntrypointCharacters,
    tokenProxy: { label: 'ceil(UTF-16 character count / 4); proxy only, not tokenizer output or billed savings',
      entrypoints: Math.ceil(totalCharacters / 4), allEntrypoints: Math.ceil(allEntrypointCharacters / 4) },
    references: 'Follow required reads in the full SKILL.md. Load references, policies, templates, and repository instructions when required; never truncate instructions or skip gates to fit a budget.',
    scope: 'Counts cover SKILL.md entrypoints only; references, boundary evidence, task data, host discovery, output, and execution usage are excluded.' }
}

export function rankContext({ root = DEFAULT_ROOT, task, skill, modelPath, limit = 3 } = {}) {
  if (!validPath(root) || !Number.isInteger(limit) || limit < 2 || limit > 5 || (task !== undefined && typeof task !== 'string') ||
      (skill !== undefined && typeof skill !== 'string') || (modelPath !== undefined && typeof modelPath !== 'string') ||
      (modelPath !== undefined && !validPath(modelPath)) ||
      (task !== undefined && skill !== undefined) || (skill !== undefined && modelPath !== undefined) ||
      (typeof task === 'string' && task.length > 4000)) {
    fail('invalid_argument', 'Use task (up to 4000 characters) or exact skill, limit 2–5; a model is only valid with task.')
  }
  root = resolve(root)
  const cat = catalog(root)
  const model = modelPath !== undefined ? loadModel(root, modelPath, cat) : null
  const base = { ok: true, advisoryOnly: true, sourceSha256: cat.sourceSha256,
    authority: { boundaries: AUDIT, executionRouting: MODES,
      rule: 'Ranks suggest candidates only. Normative boundaries, canonical model tiers, verifier widths, and human gates remain authoritative.' } }
  const fallback = { skill: 'loop-guide', path: entryPath('loop-guide'), boundaryPath: AUDIT,
    instruction: 'If the task is unclear or evidence conflicts, inspect the audit and clarify the deliverable before dispatch.' }
  if (skill === undefined && (!task?.trim() || !tokenize(task).length)) {
    return { ...base, outcome: 'abstain', reason: 'No usable task terms; provide a deliverable or explicit --skill.',
      lexical: { status: 'abstain', candidates: [] },
      learned: model ? learnedCandidates(model, task || '', limit) : { status: 'disabled' },
      fallback, readPlan: readPlan(cat, ['loop-guide'], 'abstain') }
  }
  const lookup = boundaryLookup(skill === undefined ? { query: task, limit } : { skill }, { root })
  if (!lookup.ok) fail(lookup.error?.code || 'source_unparseable', lookup.error?.message || 'Boundary lookup failed.')
  const result = lookup.result
  const exact = result.outcome === 'exact'
  const outcome = exact ? 'exact' : result.outcome === 'unowned' ? 'abstain' : 'candidates'
  const raw = exact ? [result.candidate] : result.candidates
  const learned = model ? learnedCandidates(model, task, limit) : { status: 'disabled' }
  const union = unique([...raw.map((c) => c.skill), ...(learned.candidates || []).map((c) => c.skill)])
  // Include learned candidates' actual stored boundary evidence without changing lexical order.
  const bySkill = new Map(raw.map((c) => [c.skill, c]))
  for (const name of union) if (!bySkill.has(name)) {
    const extra = boundaryLookup({ skill: name }, { root })
    if (!extra.ok) fail('source_stale', 'Candidate boundary lookup failed; reconcile source before retrying.')
    bySkill.set(name, extra.result.candidate)
  }
  const checks = [], pairs = new Set()
  for (const shortlist of [union, (learned.candidates || []).map((c) => c.skill)]) {
    for (let i = 0; i < shortlist.length - 1; i++) {
      const pair = [shortlist[i], shortlist[i + 1]]
      const key = [...pair].sort(cmp).join('|')
      if (pairs.has(key)) continue
      pairs.add(key)
      const check = buildSeparatingQuestion(bySkill.get(pair[0]), bySkill.get(pair[1]))
      checks.push({ pair: check.pair, storedDiscriminator: check.storedDiscriminator,
        propositions: check.propositions.map((p) => ({ condition: p.proposition, ifTrue: p.ifTrue, ifFalse: p.ifFalse, pointer: p.pointer })) })
    }
  }
  return { ...base, outcome, lexical: { status: result.outcome,
    scoreMeaning: 'Uncalibrated ADR-0007 retrieval score, not confidence or a ruling.', candidates: raw.map(compactCandidate) },
    learned, boundaryChecks: checks, auditIntegrity: auditSummary(result.auditIntegrity, union),
    boundaryEvidence: union.map((name) => {
      const c = bySkill.get(name)
      return { skill: name, pointer: c.citation.section,
        outboundPointers: c.useInsteadWhen.map((e) => e.citation.section),
        inboundPointers: c.pointedAtBy.map((e) => e.citation.section),
        overlapPointers: c.overlapsTouching.map((e) => e.citation.section) }
    }),
    reason: outcome === 'abstain' ? 'The authoritative lexical lookup found insufficient discriminating terms; optional learned suggestions do not override that fallback.'
      : exact ? 'Explicit caller choice; read the full skill and applicable boundaries.' : 'Compare candidates and stored conditions before dispatch; missing discriminators require manual boundary inspection.',
    fallback, readPlan: readPlan(cat, outcome === 'abstain' ? ['loop-guide'] : union, outcome) }
}
