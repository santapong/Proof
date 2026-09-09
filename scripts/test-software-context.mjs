#!/usr/bin/env node
// Behavioral checks use disposable source copies and training examples only.
import assert from 'node:assert/strict'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { DEFAULT_ROOT, rankContext, trainModel } from './lib/software-context.mjs'
import { boundaryLookup } from '../mcp/lib/boundary_lookup.mjs'

const scratch = mkdtempSync(join(tmpdir(), 'proof-context-test-'))
const root = join(scratch, 'repo')
const fixture = join(DEFAULT_ROOT, 'docs/examples/software-routing-train.jsonl')
const dataPath = join(scratch, 'train.jsonl')
let checks = 0
function check(name, action) {
  try { action(); checks++ } catch (error) { throw new Error(`${name}: ${error.message}`, { cause: error }) }
}
function fails(action, code) { assert.throws(action, (e) => e.code === code) }
function writeRows(rows) { writeFileSync(dataPath, rows.map((r) => JSON.stringify(r)).join('\n') + '\n') }
function resign(model) {
  const { modelSha256: _, ...payload } = model
  return { ...payload, modelSha256: createHash('sha256').update(JSON.stringify(payload)).digest('hex') }
}

try {
  const paths = ['docs/design/boundary-audit.json', 'mcp/boundary-match-contract.json',
    'mcp/lib/boundary.mjs', 'mcp/lib/boundary_lookup.mjs', 'scripts/lib/software-context.mjs',
    '.claude/skills/loop-engine/references/execution-modes.md',
    ...readdirSync(join(DEFAULT_ROOT, '.claude/skills'), { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^loop-/.test(e.name)).map((e) => `.claude/skills/${e.name}/SKILL.md`)]
  for (const path of paths) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    cpSync(join(DEFAULT_ROOT, path), join(root, path))
  }
  const rawTraining = readFileSync(fixture, 'utf8')
  const rows = rawTraining.trim().split('\n').map(JSON.parse)
  writeFileSync(dataPath, rawTraining)
  const artifact = join(scratch, 'model.json')
  const secondArtifact = join(scratch, 'second.json')
  check('training is explicit and deterministic', () => {
    const first = trainModel({ root, dataPath, outPath: artifact })
    const second = trainModel({ root, dataPath, outPath: secondArtifact })
    assert.equal(first.modelSha256, second.modelSha256)
    assert.equal(readFileSync(artifact, 'utf8'), readFileSync(secondArtifact, 'utf8'))
    assert.equal(first.trainingRows, 24)
    assert.equal(first.syntheticRows, first.trainingRows)
    assert.equal(first.classes.length, 8)
  })
  check('existing artifacts are never overwritten', () => fails(() => trainModel({ root, dataPath, outPath: artifact }), 'output_unavailable'))
  check('missing training source fails clearly', () => fails(() => trainModel({ root, dataPath: join(scratch, 'missing.jsonl'), outPath: join(scratch, 'missing-model.json') }), 'source_missing'))
  const task = 'Review the pull request diff for correctness defects and security vulnerabilities'
  check('lexical baseline is the unchanged normative implementation', () => {
    const actual = rankContext({ root, task })
    const expected = boundaryLookup({ query: task, limit: 3 }, { root }).result
    assert.deepEqual(actual.lexical.candidates.map((c) => [c.skill, c.score]), expected.candidates.map((c) => [c.skill, c.score]))
    assert.equal(actual.learned.status, 'disabled')
    assert.equal(actual.advisoryOnly, true)
    assert.equal(actual.outcome, 'candidates')
    assert(actual.lexical.candidates.length >= 2)
  })
  check('optional learned suggestions do not rewrite lexical candidates', () => {
    const baseline = rankContext({ root, task })
    const optional = rankContext({ root, task, modelPath: artifact })
    assert.deepEqual(optional.lexical, baseline.lexical)
    assert.equal(optional.learned.status, 'candidates')
    assert.equal(optional.learned.candidates[0].skill, 'loop-review')
    assert.match(optional.learned.scoreMeaning, /Uncalibrated/)
    assert(optional.learned.candidates.length >= 2)
  })
  check('output byte determinism for unchanged inputs', () => {
    assert.equal(JSON.stringify(rankContext({ root, task, modelPath: artifact })), JSON.stringify(rankContext({ root, task, modelPath: artifact })))
  })
  for (const empty of [undefined, '', '   ', '!!!', 'ช่วยหน่อย']) check(`empty or unsupported task ${JSON.stringify(empty)} abstains`, () => {
    const result = rankContext({ root, task: empty, modelPath: artifact })
    assert.equal(result.outcome, 'abstain')
    assert.deepEqual(result.lexical.candidates, [])
    assert.equal(result.learned.status, 'abstain')
    assert.equal(result.readPlan.entries[0].path, '.claude/skills/loop-guide/SKILL.md')
  })
  for (const unknown of ['book me a flight to Berlin', 'help me', 'what is the capital of Peru']) check(`unknown task ${unknown} falls back`, () => {
    const result = rankContext({ root, task: unknown, modelPath: artifact })
    assert.equal(result.outcome, 'abstain')
    assert.equal(result.learned.status, 'abstain')
    assert.equal(result.fallback.skill, 'loop-guide')
  })
  check('ambiguous task remains an advisory shortlist', () => {
    const result = rankContext({ root, task: 'review and debug a failing test with a runtime exception', modelPath: artifact })
    assert(result.lexical.candidates.length >= 2)
    function walk(value) {
      if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
        assert(!['owner', 'owningSkill', 'owns', 'verdict', 'decision', 'winner', 'selected', 'model', 'effort'].includes(key))
        walk(child)
      }
    }
    walk(result)
  })
  check('explicit known skill bypasses inference and keeps full entrypoint', () => {
    const result = rankContext({ root, skill: 'loop-review' })
    assert.equal(result.outcome, 'exact')
    assert.equal(result.learned.status, 'disabled')
    assert.equal(result.lexical.candidates.length, 1)
    const entry = result.readPlan.entries[0]
    const text = readFileSync(join(root, entry.path), 'utf8')
    assert.equal(entry.characters, text.length)
    assert.equal(entry.sha256, createHash('sha256').update(text).digest('hex'))
    assert.equal(entry.read, 'complete-entrypoint')
    assert.equal(result.readPlan.totalCharacters, text.length)
    assert.equal(result.readPlan.tokenProxy.entrypoints, Math.ceil(text.length / 4))
    assert(result.readPlan.allEntrypointCharacters > result.readPlan.totalCharacters)
    assert.match(result.readPlan.references, /never truncate instructions/)
  })
  check('candidate manifest is bounded, unique and correctly counted', () => {
    const result = rankContext({ root, task, modelPath: artifact })
    const entries = result.readPlan.entries
    assert(entries.length <= 6)
    assert.equal(new Set(entries.map((e) => e.path)).size, entries.length)
    assert.equal(result.readPlan.totalCharacters, entries.reduce((s, e) => s + readFileSync(join(root, e.path), 'utf8').length, 0))
  })
  check('default response is compact and omits full-fleet audit excerpts', () => {
    const compact = rankContext({ root, task: 'Review the changes on this branch for defects' })
    const full = boundaryLookup({ query: 'Review the changes on this branch for defects', limit: 3 }, { root })
    const encoded = JSON.stringify(compact)
    assert(encoded.length < 16000, `Default context response is ${encoded.length} characters`)
    assert(JSON.stringify(compact.auditIntegrity).length < JSON.stringify(full.result.auditIntegrity).length / 2)
    assert(!encoded.includes('"excerpt"'))
    assert.equal(compact.auditIntegrity.status, 'summary-only; not a passing audit')
    assert.equal(compact.auditIntegrity.fullReport, 'boundary_lookup')
    assert.equal(compact.auditIntegrity.oneWayEdges, full.result.auditIntegrity.oneWayEdges)
    for (const overlap of compact.auditIntegrity.candidateOneWayOverlaps) assert.match(overlap.pointer, /^\/overlaps\/\d+$/)
  })
  check('boundary conditions and both edge directions remain traceable', () => {
    const result = rankContext({ root, task, modelPath: artifact })
    const audit = JSON.parse(readFileSync(join(root, 'docs/design/boundary-audit.json'), 'utf8'))
    const deref = (pointer) => pointer.slice(1).split('/').reduce((value, key) => value[key], audit)
    for (const boundary of result.boundaryChecks) for (const proposition of boundary.propositions) {
      assert.equal(deref(proposition.pointer).condition, proposition.condition)
      assert.equal(deref(proposition.pointer).otherSkill, proposition.ifTrue)
    }
    for (let i = 0; i < result.learned.candidates.length - 1; i++) {
      const pair = result.learned.candidates.slice(i, i + 2).map((c) => c.skill).sort()
      assert(result.boundaryChecks.some((c) => JSON.stringify([...c.pair].sort()) === JSON.stringify(pair)))
    }
    for (const evidence of result.boundaryEvidence) {
      const row = deref(evidence.pointer)
      assert.equal(evidence.outboundPointers.length, row.useInsteadWhen.length)
      assert.equal(evidence.inboundPointers.length, audit.matrix.flatMap((r) => r.useInsteadWhen).filter((e) => e.otherSkill === evidence.skill).length)
    }
    assert.equal(result.auditIntegrity.matrixSize, audit.matrix.length)
  })
  check('unknown skill fails instead of guessing', () => fails(() => rankContext({ root, skill: 'loop-typo' }), 'not_found'))
  for (const options of [{ task, skill: 'loop-test' }, { skill: 'loop-test', modelPath: artifact },
    { task, limit: 1 }, { task, limit: 6 }, { task: 123 }, { task: 'x'.repeat(4001) },
    { task, modelPath: '' }, { task, modelPath: '   ' }, { task, root: '' }, { task, root: '   ' }]) {
    check('invalid rank options are rejected', () => fails(() => rankContext({ root, ...options }), 'invalid_argument'))
  }
  for (const options of [{ dataPath: '' }, { dataPath: ' ' }, { outPath: '' }, { outPath: ' ' }, { root: '' }]) {
    check('empty training paths are rejected', () => fails(() => trainModel({ root, dataPath, outPath: join(scratch, 'invalid.json'), ...options }), 'invalid_argument'))
  }
  for (const mutate of [
    (r) => { r[0].reviewed = false }, (r) => { delete r[0].reviewed }, (r) => { r[0].split = 'test' },
    (r) => { r[0].skill = 'loop-missing' }, (r) => { r[0].provenance.kind = 'unreviewed' },
    (r) => { r[0].provenance.reviewer = '' }, (r) => { r[0].unexpected = true },
    (r) => { r[0].task = 'the and for' }, (r) => { r[1].id = r[0].id },
    (r) => { r[1].task = r[0].task.toUpperCase() }, (r) => r.splice(3), (r) => r.splice(1, 2),
  ]) check('invalid reviewed training is rejected', () => {
    const changed = structuredClone(rows); mutate(changed); writeRows(changed)
    fails(() => trainModel({ root, dataPath, outPath: join(scratch, 'invalid.json') }), 'invalid_training')
  })
  check('malformed training is rejected', () => {
    writeFileSync(dataPath, '{bad}\n{bad}\n{bad}\n{bad}\n')
    fails(() => trainModel({ root, dataPath, outPath: join(scratch, 'invalid.json') }), 'invalid_training')
  })
  writeFileSync(dataPath, rawTraining)
  check('changed training invalidates model', () => {
    writeFileSync(dataPath, rawTraining + '\n')
    fails(() => rankContext({ root, task, modelPath: artifact }), 'stale_model')
    writeFileSync(dataPath, rawTraining)
  })
  for (const source of ['.claude/skills/loop-test/SKILL.md', '.claude/skills/loop-engine/references/execution-modes.md',
    'docs/design/boundary-audit.json']) check(`source changes invalidate model: ${source}`, () => {
    const path = join(root, source), before = readFileSync(path, 'utf8')
    writeFileSync(path, before + '\n')
    fails(() => rankContext({ root, task, modelPath: artifact }), 'stale_model')
    writeFileSync(path, before)
  })
  for (const source of ['mcp/lib/boundary.mjs', 'mcp/lib/boundary_lookup.mjs', 'scripts/lib/software-context.mjs']) {
    check(`alternate-root code cannot misattribute executed source: ${source}`, () => {
      const path = join(root, source), before = readFileSync(path, 'utf8')
      writeFileSync(path, before + '\n// alternate implementation\n')
      fails(() => rankContext({ root, task }), 'runtime_mismatch')
      fails(() => rankContext({ root, task, modelPath: artifact }), 'runtime_mismatch')
      fails(() => trainModel({ root, dataPath, outPath: join(scratch, 'wrong-runtime.json') }), 'runtime_mismatch')
      writeFileSync(path, before)
    })
  }
  check('stale model is not silently ignored for empty task', () => {
    writeFileSync(dataPath, rawTraining + '\n')
    fails(() => rankContext({ root, task: '', modelPath: artifact }), 'stale_model')
    writeFileSync(dataPath, rawTraining)
  })
  check('tampered model checksum is rejected', () => {
    const model = JSON.parse(readFileSync(artifact, 'utf8')); model.classes[0].tokens++
    writeFileSync(secondArtifact, JSON.stringify(model))
    fails(() => rankContext({ root, task, modelPath: secondArtifact }), 'invalid_model')
  })
  check('rehashed malformed statistics are still rejected', () => {
    const model = JSON.parse(readFileSync(artifact, 'utf8')); model.classes[0].tokens = -1
    writeFileSync(secondArtifact, JSON.stringify(resign(model)))
    fails(() => rankContext({ root, task, modelPath: secondArtifact }), 'invalid_model')
  })
  check('malformed model JSON is rejected', () => {
    writeFileSync(secondArtifact, '{invalid')
    fails(() => rankContext({ root, task, modelPath: secondArtifact }), 'invalid_model')
  })
  check('equal learned evidence abstains and prototype-like words stay finite', () => {
    const common = { split: 'train', reviewed: true, provenance: rows[0].provenance }
    writeRows([
      { ...common, id: 'a', task: 'constructor crash null', skill: 'loop-debug' },
      { ...common, id: 'b', task: 'stack error trace', skill: 'loop-debug' },
      { ...common, id: 'c', task: 'null crash constructor', skill: 'loop-review' },
      { ...common, id: 'd', task: 'trace error stack', skill: 'loop-review' },
    ])
    const tied = join(scratch, 'tied.json')
    trainModel({ root, dataPath, outPath: tied })
    assert.equal(rankContext({ root, task: 'constructor crash stack error', modelPath: tied }).learned.status, 'abstain')
    writeFileSync(dataPath, rawTraining)
  })
  check('CLI returns JSON for exact entrypoints', () => {
    const child = spawnSync(process.execPath, [join(DEFAULT_ROOT, 'scripts/software-context.mjs'), 'rank', '--skill', 'loop-test', '--root', root], { encoding: 'utf8' })
    assert.equal(child.status, 0, child.stderr)
    assert.equal(JSON.parse(child.stdout).outcome, 'exact')
  })
  check('CLI rejects duplicate and unknown flags', () => {
    for (const args of [['rank', '--skill', 'loop-test', '--skill', 'loop-debug'], ['rank', '--mode', 'lite'],
      ['rank', '--task', task, '--model', ''], ['rank', '--task', task, '--root', '']]) {
      const child = spawnSync(process.execPath, [join(DEFAULT_ROOT, 'scripts/software-context.mjs'), ...args], { encoding: 'utf8' })
      assert.equal(child.status, 1)
      assert.equal(JSON.parse(child.stderr).ok, false)
    }
  })
  console.log(`software-context: ${checks} behavioral checks passed; no provider calls.`)
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
