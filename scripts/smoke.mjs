#!/usr/bin/env node
// Runtime smoke test for every *.workflow.js in the plugin.
//
// `node --check` proves a template PARSES. It does not prove the ROUTES block produces the
// intended agent() options, that WIDTH engages under --mode full, or that the script survives
// a run at all. This harness executes each template against stubbed Workflow globals and
// asserts on what it actually asked for.
//
// Templates are ES modules that use top-level await AND top-level return, and read ambient
// globals (agent, parallel, pipeline, log, phase, budget, args) that no import provides. So we
// strip `export ` and wrap the body in an AsyncFunction whose parameters ARE those globals —
// which handles top-level await and top-level return in one move.
//
// Usage: node scripts/smoke.mjs [--verbose]

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '')
const VERBOSE = process.argv.includes('--verbose')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

function templates(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === '.git' || e === 'node_modules') continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) templates(p, out)
    else if (e.endsWith('.workflow.js')) out.push(p)
  }
  return out
}

// Run one template with stubbed globals; return every agent() call it made.
async function run(file, { mode, planner } = {}) {
  const src = readFileSync(file, 'utf8').replace(/^export\s+const\s+meta/m, 'const meta')
  const calls = []
  const logs = []

  const agent = async (prompt, opts = {}) => {
    calls.push({ prompt: String(prompt).slice(0, 80), ...opts })
    // Return a shape permissive enough for post-processing: array-ish AND object-ish.
    return new Proxy(
      { findings: [], verdicts: [], bugs: [], items: [], interactions: [], results: [], errors: [], gaps: [] },
      { get: (t, k) => (k in t ? t[k] : k === Symbol.iterator ? [][Symbol.iterator].bind([]) : k === 'then' ? undefined : []) },
    )
  }
  const parallel = async (thunks) => Promise.all((thunks || []).map((t) => (typeof t === 'function' ? t() : t)))
  const pipeline = async (items, ...stages) => {
    const out = []
    for (let i = 0; i < (items || []).length; i++) {
      let v = items[i]
      for (const s of stages) v = await s(v, items[i], i)
      out.push(v)
    }
    return out
  }
  const log = (m) => logs.push(typeof m === 'string' ? m : JSON.stringify(m))
  const phase = () => {}
  const budget = { total: null, spent: () => 0, remaining: () => Infinity }
  // Generous args: a template that early-returns for want of input is not a routing defect,
  // it is a starved harness. Supply every work-list key any template in the fleet reads.
  const args = {
    mode, planner,
    repoPath: ROOT, surface: 'test surface', target: 'test target', task: 'test task',
    base: 'HEAD~1', head: 'HEAD', diff: 'x', repo: { owner: 'o', name: 'n' },
    areas: [{ id: 'a1', name: 'area', files: ['a.js'] }, { id: 'a2', name: 'area2', files: ['b.js'] }],
    items: ['a', 'b'], files: ['a.js', 'b.js'], units: [{ id: 'u1' }, { id: 'u2' }],
    skills: [{ id: 'loop-x', purpose: 'test', neighbours: [] }],
    tasks: [{ id: 't1', prompt: 'p', kind: 'k' }, { id: 't2', prompt: 'p2', kind: 'k' }],
    candidates: [{ id: 'c1' }, { id: 'c2' }], findings: [{ id: 'f1' }],
    interactions: [{ id: 'i1', what: 'w', file: 'a.js:1', trigger: 'user-direct' }],
    modules: [{ id: 'm1', path: 'a.js' }, { id: 'm2', path: 'b.js' }], kinds: ['docs', 'tests'], proposals: [{ id: 'p1' }], suite: [{ id: 's1' }],
    maxRounds: 1, floor: 0, runMode: 'dry', execution: 'dry',
    candidate: { id: 'c1', kind: 'docs', branch: 'claude/x', prNumber: 1 },
    autonomyIssueNumber: 1, ledgerIssueNumber: 2, baselineIssueNumber: 3,
    nowMs: 1753600000000, nowIso: '2026-07-27T00:00:00Z',
  }

  const fn = new AsyncFunction('agent', 'parallel', 'pipeline', 'log', 'phase', 'budget', 'args', 'console', src)
  await fn(agent, parallel, pipeline, log, phase, budget, args, { log: () => {}, error: () => {} })
  return { calls, logs }
}

const files = templates(join(ROOT, '.claude/skills')).sort()
let pass = 0
const failures = []

for (const f of files) {
  const rel = relative(ROOT, f)
  try {
    const opt = await run(f, { mode: 'optimize' })
    const full = await run(f, { mode: 'full' })

    const errs = []

    // 1. It ran and asked for at least one agent.
    if (!opt.calls.length) errs.push('made no agent() calls in optimize mode')

    // 2. Every consumed call carries a schema (H3).
    const noSchema = opt.calls.filter((c) => !c.schema)
    if (noSchema.length) errs.push(`${noSchema.length} agent() call(s) with no schema`)

    // 3. Full mode pins claude-opus-5 on every call; optimize must NOT pin it everywhere.
    const fullUnpinned = full.calls.filter((c) => c.model !== 'claude-opus-5')
    if (fullUnpinned.length) {
      errs.push(`full mode left ${fullUnpinned.length} call(s) unpinned: ${[...new Set(fullUnpinned.map((c) => c.model ?? 'inherit'))].join(', ')}`)
    }

    // 4. Optimize must route SOMETHING below the ceiling, or the mode dial is inert here.
    const optTiers = new Set(opt.calls.map((c) => c.model ?? 'inherit'))
    if (optTiers.size === 1 && optTiers.has('claude-opus-5')) {
      errs.push('optimize mode pinned opus-5 on every call — mode dial is inert')
    }

    // 5. Effort must lift in full mode wherever optimize used a non-max effort.
    const optEfforts = opt.calls.map((c) => c.effort).filter(Boolean)
    const fullEfforts = full.calls.map((c) => c.effort).filter(Boolean)
    if (optEfforts.length && fullEfforts.length) {
      const rank = { low: 1, medium: 2, high: 3, xhigh: 4, max: 5 }
      const maxOpt = Math.max(...optEfforts.map((e) => rank[e] || 0))
      const maxFull = Math.max(...fullEfforts.map((e) => rank[e] || 0))
      if (maxFull < maxOpt) errs.push('full mode used a LOWER peak effort than optimize')
    }

    // 6. --planner fable must reach a planner node if the template declares one.
    const declaresPlanner = readFileSync(f, 'utf8').includes("taskType: 'planner'")
    if (declaresPlanner) {
      const fable = await run(f, { mode: 'optimize', planner: 'fable' })
      if (!fable.calls.some((c) => c.model === 'claude-fable-5')) {
        errs.push('declares a planner node but --planner fable never routed to claude-fable-5')
      }
    }

    if (errs.length) failures.push({ rel, errs })
    else {
      pass++
      if (VERBOSE) console.log(`  ok   ${rel}  (${opt.calls.length} calls; optimize tiers: ${[...optTiers].join('/')})`)
    }
  } catch (e) {
    failures.push({ rel, errs: [`threw at runtime: ${e.message}`] })
  }
}

console.log(`\n${files.length} templates executed — ${pass} passed, ${failures.length} failed`)
for (const { rel, errs } of failures) {
  console.log(`\n  FAIL  ${rel}`)
  for (const e of errs) console.log(`        ${e}`)
}
process.exit(failures.length ? 1 : 0)
