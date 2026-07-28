#!/usr/bin/env node
// TheLoopSkill validation gate.
//
// `claude plugin validate --strict` only reads .claude-plugin/*.json — it never opens a SKILL.md.
// `node --check` is parse-only. This script covers the surface those two leave uninspected:
// skill frontmatter, name/directory agreement, template syntax, harness policy H10, canonical
// ROUTES conformance, and reference-link resolution.
//
// Usage:  node scripts/validate.mjs [--verbose] [--json]
// Exit:   0 = every check passed, 1 = at least one check failed, 2 = the checker itself broke.
//
// --json suppresses the human-formatted progress/summary lines and instead prints one JSON object
// to stdout: {passed, checksRun, failures[{check,file,line,message}], warnings[]}. Exit codes are
// unchanged by --json — it is an output-format switch, not a different gate. The default (no
// --json) console output is untouched byte-for-byte.
//
// No dependencies. Node stdlib only, deliberately: the plugin ships no package manifest and must
// not grow one. The frontmatter parser below is a minimal YAML subset covering exactly what a
// SKILL.md header is allowed to be (a flat map of scalars) — it rejects anything it cannot prove
// valid rather than guessing.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SKILLS_DIR = path.join(ROOT, '.claude', 'skills')
const MODES_DOC = path.join(SKILLS_DIR, 'loop-engine', 'references', 'execution-modes.md')
const VERBOSE = process.argv.includes('--verbose')
const JSON_MODE = process.argv.includes('--json')

const failures = []
const warnings = []
let checksRun = 0

const rel = (p) => path.relative(ROOT, p) || p
function fail(check, file, line, message) {
  failures.push({ check, file: rel(file), line, message })
}
function warn(check, file, line, message) {
  warnings.push({ check, file: rel(file), line, message })
}
function note(msg) {
  if (VERBOSE) console.log(`     ${msg}`)
}
// Human-formatted progress/summary output — suppressed under --json so stdout carries only the
// JSON object. Default (no --json) behavior is unchanged: out() is exactly console.log then.
function out(msg) {
  if (!JSON_MODE) console.log(msg)
}

function read(file) {
  return fs.readFileSync(file, 'utf8')
}
function lines(text) {
  return text.replace(/\r\n/g, '\n').split('\n')
}
function walk(dir, match, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, match, out)
    else if (match(e.name)) out.push(p)
  }
  return out
}

// ---------------------------------------------------------------------------
// Minimal YAML-frontmatter parser (a flat map of scalars — nothing more).
// ---------------------------------------------------------------------------

const RESERVED_FIRST_CHARS = new Set(['[', ']', '{', '}', ',', '&', '*', '!', '%', '@', '`', '#'])

function parsePlainScalar(value, keyName) {
  if (value === '') return { ok: true, value: '' }
  if (RESERVED_FIRST_CHARS.has(value[0])) {
    return { ok: false, error: `plain scalar for \`${keyName}\` starts with the reserved YAML indicator \`${value[0]}\` — quote the value` }
  }
  // The exact defect that shipped in 1.0.0: an unquoted value containing ": " is parsed as a
  // nested mapping key and YAML reports "mapping values are not allowed here".
  if (/:(\s|$)/.test(value)) {
    return { ok: false, error: `plain scalar for \`${keyName}\` contains a colon followed by whitespace or end-of-line — YAML reads that as a nested mapping ("mapping values are not allowed here"). Wrap the whole value in double quotes` }
  }
  if (/\s#/.test(value)) {
    return { ok: false, error: `plain scalar for \`${keyName}\` contains " #", which YAML treats as a trailing comment and silently truncates the value — quote it` }
  }
  return { ok: true, value }
}

function parseQuotedScalar(value, keyName) {
  if (value[0] === '"') {
    if (!/^"(?:[^"\\]|\\.)*"$/.test(value)) {
      return { ok: false, error: `double-quoted value for \`${keyName}\` is not terminated (or has trailing content after the closing quote)` }
    }
    return { ok: true, value: value.slice(1, -1).replace(/\\(.)/g, (_, c) => (c === 'n' ? '\n' : c === 't' ? '\t' : c)) }
  }
  if (!/^'(?:[^']|'')*'$/.test(value)) {
    return { ok: false, error: `single-quoted value for \`${keyName}\` is not terminated (or has trailing content after the closing quote)` }
  }
  return { ok: true, value: value.slice(1, -1).replace(/''/g, "'") }
}

// Returns { ok, data, keyLines } or { ok:false, line, error }.
function parseFrontmatter(text) {
  const ls = lines(text)
  if (ls.length === 0 || ls[0].replace(/^﻿/, '') !== '---') {
    return { ok: false, line: 1, error: 'file does not open with a `---` frontmatter fence on line 1' }
  }
  let end = -1
  for (let i = 1; i < ls.length; i++) {
    if (ls[i] === '---' || ls[i] === '...') { end = i; break }
  }
  if (end === -1) return { ok: false, line: 1, error: 'the `---` frontmatter fence is never closed' }

  const data = Object.create(null)
  const keyLines = Object.create(null)
  let i = 1
  while (i < end) {
    const raw = ls[i]
    if (raw.trim() === '') { i++; continue }
    if (/^#/.test(raw)) { i++; continue }
    if (/^\s/.test(raw)) {
      return { ok: false, line: i + 1, error: `unexpected indented line with no block scalar open: ${JSON.stringify(raw.slice(0, 70))}` }
    }
    const m = /^([A-Za-z0-9_.-]+):(?:[ \t]+(.*))?$/.exec(raw)
    if (!m) {
      return { ok: false, line: i + 1, error: `not a \`key: value\` mapping entry: ${JSON.stringify(raw.slice(0, 70))}` }
    }
    const key = m[1]
    const rawVal = (m[2] === undefined ? '' : m[2]).trim()
    if (key in data) return { ok: false, line: i + 1, error: `duplicate key \`${key}\`` }
    keyLines[key] = i + 1

    // Block scalar: | or > with optional chomping/indent indicator.
    const block = /^([|>])([+-]?)(\d*)$/.exec(rawVal)
    if (block) {
      const body = []
      let j = i + 1
      while (j < end && (ls[j].trim() === '' || /^\s/.test(ls[j]))) { body.push(ls[j]); j++ }
      const indents = body.filter((l) => l.trim() !== '').map((l) => l.match(/^\s*/)[0].length)
      const base = indents.length ? Math.min(...indents) : 0
      const text2 = body.map((l) => l.slice(base))
      data[key] = block[1] === '|' ? text2.join('\n') : text2.join(' ').replace(/\s+/g, ' ').trim()
      i = j
      continue
    }

    if (rawVal === '') {
      // An empty value followed by indented lines is a nested map or sequence. A SKILL.md header
      // is a flat map of scalars; refuse rather than half-parse it.
      if (i + 1 < end && /^\s/.test(ls[i + 1])) {
        return { ok: false, line: i + 1, error: `\`${key}\` opens a nested block; SKILL.md frontmatter must be a flat map of scalar values` }
      }
      data[key] = ''
      i++
      continue
    }

    // Flow sequence, e.g. allowed-tools: [Read, Grep]
    if (rawVal[0] === '[') {
      if (!/^\[[^\]]*\]$/.test(rawVal)) {
        return { ok: false, line: i + 1, error: `flow sequence for \`${key}\` is not closed on the same line` }
      }
      data[key] = rawVal.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean)
      i++
      continue
    }

    const parsed = rawVal[0] === '"' || rawVal[0] === "'"
      ? parseQuotedScalar(rawVal, key)
      : parsePlainScalar(rawVal, key)
    if (!parsed.ok) return { ok: false, line: i + 1, error: parsed.error }
    data[key] = parsed.value
    i++
  }
  return { ok: true, data, keyLines, endLine: end + 1 }
}

// ---------------------------------------------------------------------------
// Tiny JS line lexer: split a source line into (code, comment).
// Used so a real violation carrying a trailing `// comment` is still caught — the grep this
// replaced excluded the whole LINE whenever it contained "// ", which suppressed exactly that case.
// ---------------------------------------------------------------------------

function splitCodeComment(line) {
  let q = null
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '\\') { i++; continue }
      if (c === q) q = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') { q = c; continue }
    if (c === '/' && line[i + 1] === '/') return { code: line.slice(0, i), comment: line.slice(i) }
    if (c === '/' && line[i + 1] === '*') return { code: line.slice(0, i), comment: line.slice(i) }
  }
  return { code: line, comment: '' }
}

// ---------------------------------------------------------------------------
// CHECK 1+2+6 — SKILL.md frontmatter, name/directory agreement, reference paths.
// ---------------------------------------------------------------------------

const REQUIRED_KEYS = ['name', 'description', 'argument-hint']
const MAX_DESCRIPTION = 1024
// A reference path is an inline-code span rooted in the skill directory. Anything containing a
// placeholder (`<name>`) or a glob is skipped — it is documentation, not a link.
const REF_PATH = /^(?:\.\.\/|references\/|templates\/|frameworks\/|hooks\/|scaffolds\/)[A-Za-z0-9._/-]*\.(?:md|js|mjs|sh|json|ya?ml|toml)$/

function checkSkills() {
  if (!fs.existsSync(SKILLS_DIR)) {
    fail('skills', SKILLS_DIR, 0, 'no .claude/skills directory found')
    return
  }
  const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
  if (dirs.length === 0) fail('skills', SKILLS_DIR, 0, 'no skill directories found')

  for (const dir of dirs) {
    const skillDir = path.join(SKILLS_DIR, dir)
    const file = path.join(skillDir, 'SKILL.md')
    checksRun++
    if (!fs.existsSync(file)) {
      fail('frontmatter', file, 0, `skill directory \`${dir}\` has no SKILL.md`)
      continue
    }
    const text = read(file)
    const fm = parseFrontmatter(text)
    if (!fm.ok) {
      fail('frontmatter', file, fm.line, `YAML frontmatter does not parse: ${fm.error}`)
      continue
    }
    for (const key of REQUIRED_KEYS) {
      if (!(key in fm.data) || String(fm.data[key]).trim() === '') {
        fail('frontmatter', file, 1, `frontmatter is missing required key \`${key}\``)
      }
    }
    const name = fm.data.name
    if (typeof name === 'string' && name !== '') {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
        fail('frontmatter', file, fm.keyLines.name, `\`name: ${name}\` must be lowercase letters, numbers and hyphens`)
      }
      if (name !== dir) {
        fail('name-matches-dir', file, fm.keyLines.name, `\`name: ${name}\` does not match its directory \`${dir}\` — the skill will not resolve`)
      }
    }
    const desc = fm.data.description
    if (typeof desc === 'string' && desc.length > MAX_DESCRIPTION) {
      fail('frontmatter', file, fm.keyLines.description, `description is ${desc.length} characters; the limit is ${MAX_DESCRIPTION}`)
    }

    // CHECK 6 — every relative reference path in the body resolves on disk.
    const ls = lines(text)
    for (let i = 0; i < ls.length; i++) {
      for (const m of ls[i].matchAll(/`([^`\n]+)`/g)) {
        const token = m[1].trim()
        if (!REF_PATH.test(token)) continue
        checksRun++
        const target = path.resolve(skillDir, token)
        if (fs.existsSync(target)) continue
        // Prose routinely names a sibling skill and then quotes a path rooted in THAT skill —
        // "the `loop-engine` skill (see its `templates/parallel.workflow.js`)". Accept the path if
        // it resolves under a skill named on the same line. `../`-rooted paths are explicit and
        // get no such latitude, so the ../ vs ../../ depth error from 0.4.0 is still caught.
        let ownerResolved = null
        if (!token.startsWith('../')) {
          for (const om of ls[i].matchAll(/\b(loop-[a-z0-9-]+)\b/g)) {
            const owner = om[1]
            if (owner === dir || !dirs.includes(owner)) continue
            if (fs.existsSync(path.resolve(SKILLS_DIR, owner, token))) { ownerResolved = owner; break }
          }
        }
        if (ownerResolved) {
          note(`${rel(file)}:${i + 1} \`${token}\` resolves under the co-named skill ${ownerResolved}`)
          continue
        }
        fail('reference-path', file, i + 1, `reference \`${token}\` does not resolve (looked for ${rel(target)})`)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// CHECK 3 — every *.workflow.js parses, wrapped exactly as the Workflow runtime wraps it.
// ---------------------------------------------------------------------------

const WRAP_HEAD = 'async function wf(agent,parallel,pipeline,phase,log,args,budget,workflow){\n'
const WRAP_TAIL = '\n}\n'

function checkTemplatesParse(templates, tmpDir) {
  for (const f of templates) {
    checksRun++
    const body = read(f).replace(/^export const meta/m, 'const meta')
    const tmp = path.join(tmpDir, path.basename(f).replace(/\.js$/, '') + '.check.js')
    fs.writeFileSync(tmp, WRAP_HEAD + body + WRAP_TAIL)
    const r = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' })
    if (r.status !== 0) {
      const msg = (r.stderr || '').split('\n').filter(Boolean).slice(0, 4).join(' | ')
      fail('template-parse', f, 0, `node --check failed: ${msg}`)
    } else {
      note(`parse OK ${rel(f)}`)
    }
  }
}

// ---------------------------------------------------------------------------
// CHECK 4 — harness policy H10: no clock, no randomness in template code.
// ---------------------------------------------------------------------------

const H10_BANNED = [
  { re: /\bDate\.now\s*\(/, what: 'Date.now()' },
  { re: /\bMath\.random\s*\(/, what: 'Math.random()' },
  { re: /\bnew\s+Date\s*\(\s*\)/, what: 'argless new Date()' },
  { re: /\bperformance\.now\s*\(/, what: 'performance.now()' },
  { re: /\bcrypto\.randomUUID\s*\(/, what: 'crypto.randomUUID()' },
]

function checkH10(templates) {
  for (const f of templates) {
    const ls = lines(read(f))
    for (let i = 0; i < ls.length; i++) {
      const { code, comment } = splitCodeComment(ls[i])
      for (const b of H10_BANNED) {
        checksRun++
        if (b.re.test(code)) {
          fail('h10-determinism', f, i + 1, `${b.what} is forbidden in workflow scripts (H10) — it throws at runtime and breaks resume: ${ls[i].trim().slice(0, 90)}`)
        } else if (b.re.test(comment)) {
          warn('h10-determinism', f, i + 1, `${b.what} appears in a comment (not executed, so not a failure): ${ls[i].trim().slice(0, 90)}`)
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// CHECK 7 — `export const meta` is a parseable pure literal with the required keys, and its
// declared `phases` titles line up with the `phase:` strings the script actually uses (H10/H9).
// ---------------------------------------------------------------------------

// String- and comment-aware brace matcher, so a `{` inside a string literal does not confuse it.
function matchBraces(src, openIdx) {
  let depth = 0
  let q = null
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i]
    if (q) {
      if (c === '\\') { i++; continue }
      if (c === q) q = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') { q = c; continue }
    if (c === '/' && src[i + 1] === '/') { const nl = src.indexOf('\n', i); if (nl === -1) return -1; i = nl; continue }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); if (e === -1) return -1; i = e + 1; continue }
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) return i }
  }
  return -1
}

async function checkMeta(templates) {
  const vm = await import('node:vm')
  for (const f of templates) {
    const src = read(f)
    const ls = lines(src)
    checksRun++
    const decl = src.indexOf('export const meta')
    if (decl === -1) {
      fail('template-meta', f, 1, 'template has no `export const meta = {...}` declaration (required by H10)')
      continue
    }
    const metaLine = src.slice(0, decl).split('\n').length
    const open = src.indexOf('{', decl)
    const close = open === -1 ? -1 : matchBraces(src, open)
    if (close === -1) {
      fail('template-meta', f, metaLine, '`export const meta` literal is not brace-balanced')
      continue
    }
    let meta
    try {
      meta = vm.runInNewContext('(' + src.slice(open, close + 1) + ')', Object.create(null), { timeout: 1000 })
    } catch (e) {
      fail('template-meta', f, metaLine, `\`export const meta\` is not a pure literal — it must evaluate with no variables, calls or interpolation (H10): ${e.message}`)
      continue
    }
    for (const key of ['name', 'description']) {
      checksRun++
      if (typeof meta[key] !== 'string' || meta[key].trim() === '') {
        fail('template-meta', f, metaLine, `\`meta.${key}\` is missing or empty`)
      }
    }
    if (!Array.isArray(meta.phases)) continue
    const declared = meta.phases.map((p) => (typeof p === 'string' ? p : p && p.title)).filter((t) => typeof t === 'string')
    // Only count `phase:` strings that sit in an agent-opts object — i.e. on a line that also
    // carries `label:`/`schema:`, or a standalone `phase:` line inside such an object. A `phase:`
    // key on a returned summary object is not a run phase.
    const used = new Set()
    for (let i = 0; i < ls.length; i++) {
      const { code } = splitCodeComment(ls[i])
      const m = /\bphase:\s*(['"])([^'"]*)\1/.exec(code)
      if (!m) continue
      const near = [ls[i - 1] || '', ls[i], ls[i + 1] || ''].join('\n')
      if (!/\b(label|schema)\s*:/.test(near)) continue
      used.add(m[2])
    }
    for (const t of declared) {
      checksRun++
      if (used.size && !used.has(t)) {
        warn('template-meta', f, metaLine, `meta.phases declares "${t}" but no node uses \`phase: '${t}'\` — H10 requires the titles to match the phase strings used`)
      }
    }
    for (const u of used) {
      checksRun++
      if (declared.length && !declared.includes(u)) {
        fail('template-meta', f, metaLine, `a node uses \`phase: '${u}'\` but meta.phases does not declare it — H10 requires the titles to match`)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// CHECK 8 — nothing under references/ templates/ frameworks/ is orphaned: the SKILL.md
// "Reference files" list must name every file, so no shipped file is undiscoverable.
// ---------------------------------------------------------------------------

function checkOrphans() {
  if (!fs.existsSync(SKILLS_DIR)) return
  for (const dir of fs.readdirSync(SKILLS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)) {
    const skillDir = path.join(SKILLS_DIR, dir)
    const sk = path.join(skillDir, 'SKILL.md')
    if (!fs.existsSync(sk)) continue
    const txt = read(sk)
    for (const sub of ['references', 'templates', 'frameworks']) {
      const p = path.join(skillDir, sub)
      if (!fs.existsSync(p)) continue
      for (const f of walk(p, () => true)) {
        checksRun++
        const relToSkill = path.relative(skillDir, f)
        if (!txt.includes(relToSkill) && !txt.includes(path.basename(f))) {
          fail('orphan-file', sk, 1, `${relToSkill} ships but is named nowhere in SKILL.md — every reference/template must appear in the "Reference files" list`)
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// CHECK 5 — canonical ROUTES conformance.
//
// The expected block is READ FROM execution-modes.md §M8 at runtime, never hardcoded here, so the
// gate follows the single source of truth when that block changes.
// ---------------------------------------------------------------------------

function canonicalBlock() {
  const ls = lines(read(MODES_DOC))
  let h = -1
  for (let i = 0; i < ls.length; i++) {
    if (/^##\s+M8\./.test(ls[i])) { h = i; break }
  }
  if (h === -1) return { ok: false, error: 'no "## M8." heading in execution-modes.md' }
  let start = -1
  for (let i = h + 1; i < ls.length; i++) {
    if (/^```js\s*$/.test(ls[i])) { start = i + 1; break }
    if (/^##\s/.test(ls[i])) break
  }
  if (start === -1) return { ok: false, error: 'no ```js fence under the §M8 heading in execution-modes.md' }
  let stop = -1
  for (let i = start; i < ls.length; i++) {
    if (/^```\s*$/.test(ls[i])) { stop = i; break }
  }
  if (stop === -1) return { ok: false, error: 'the §M8 ```js fence is never closed' }
  const block = ls.slice(start, stop)
  if (!block.length) return { ok: false, error: 'the §M8 code fence is empty' }
  if (!/^\/\/ Canonical ROUTES block/.test(block[0])) {
    return { ok: false, error: `the §M8 block must open with "// Canonical ROUTES block"; found ${JSON.stringify(block[0].slice(0, 60))}` }
  }
  return { ok: true, block, docLine: start + 1 }
}

// §M8 sanctions exactly four omissions: WIDTH, DRY_LIMIT, the plannerAgent helper, and the
// FABLE_GATE + fableGateAgent pair (§M7b). Everything
// else is the invariant core. Segment extents are derived from the canonical text, not listed here,
// so this survives edits to the block.
function optionalMask(block) {
  const mask = new Array(block.length).fill(false)
  const markLine = (pred) => {
    for (let i = 0; i < block.length; i++) if (pred(block[i])) mask[i] = true
  }
  markLine((l) => /^const WIDTH\b/.test(l))
  markLine((l) => /^const DRY_LIMIT\b/.test(l))
  markLine((l) => /^const FABLE_GATE\b/.test(l))

  const segments = []
  const fnStart = block.findIndex((l) => /^(?:async\s+)?function plannerAgent\b/.test(l))
  if (fnStart !== -1) {
    let s = fnStart
    while (s > 0 && /^\s*\/\//.test(block[s - 1])) s--
    let e = fnStart
    while (e < block.length && block[e] !== '}') e++
    for (let i = s; i <= e && i < block.length; i++) mask[i] = true
    segments.push({ name: 'plannerAgent', start: s, end: Math.min(e, block.length - 1), signature: /^(?:async\s+)?function plannerAgent\b/ })
  }
  const fgStart = block.findIndex((l) => /^(?:async\s+)?function fableGateAgent\b/.test(l))
  if (fgStart !== -1) {
    let s = fgStart
    while (s > 0 && /^\s*\/\//.test(block[s - 1])) s--
    let e = fgStart
    while (e < block.length && block[e] !== '}') e++
    for (let i = s; i <= e && i < block.length; i++) mask[i] = true
    segments.push({ name: 'fableGateAgent', start: s, end: Math.min(e, block.length - 1), signature: /^(?:async\s+)?function fableGateAgent\b/ })
  }
  const fgIdx = block.findIndex((l) => /^const FABLE_GATE\b/.test(l))
  if (fgIdx !== -1) segments.push({ name: 'FABLE_GATE', start: fgIdx, end: fgIdx, signature: /^const FABLE_GATE\b/ })
  const widthIdx = block.findIndex((l) => /^const WIDTH\b/.test(l))
  if (widthIdx !== -1) segments.push({ name: 'WIDTH', start: widthIdx, end: widthIdx, signature: /^const WIDTH\b/ })
  const dryIdx = block.findIndex((l) => /^const DRY_LIMIT\b/.test(l))
  if (dryIdx !== -1) segments.push({ name: 'DRY_LIMIT', start: dryIdx, end: dryIdx, signature: /^const DRY_LIMIT\b/ })
  return { mask, segments }
}

function checkRoutes(templates) {
  const canon = canonicalBlock()
  if (!canon.ok) {
    fail('routes-drift', MODES_DOC, 0, `cannot read the canonical ROUTES block: ${canon.error}`)
    return
  }
  const block = canon.block
  const { mask, segments } = optionalMask(block)
  note(`canonical block: ${block.length} lines from ${rel(MODES_DOC)}:${canon.docLine}; optional segments: ${segments.map((s) => s.name).join(', ') || 'none'}`)

  for (const f of templates) {
    const ls = lines(read(f))
    const hdr = ls.findIndex((l) => /^\/\/ Canonical ROUTES block/.test(l))
    const declaresRoutes = ls.some((l) => /^const ROUTES\s*=/.test(l))

    // Does this template set model or effort at all? If not, it needs no block.
    let inlineLiteral = false
    for (const l of ls) {
      if (/(?:\bmodel|\beffort)\s*:\s*['"]/.test(splitCodeComment(l).code)) { inlineLiteral = true; break }
    }
    checksRun++
    if (hdr === -1) {
      if (declaresRoutes || inlineLiteral) {
        fail('routes-drift', f, 1, 'template sets model/effort but does not carry the canonical ROUTES block header (`// Canonical ROUTES block — ...`) from execution-modes.md §M8')
      }
      continue
    }

    // Two-pointer walk: the template must reproduce the canonical lines in order; only lines
    // inside a §M8-sanctioned optional segment may be absent.
    let ci = 0
    let ti = hdr
    let drifted = false
    while (ci < block.length) {
      if (ti < ls.length && ls[ti] === block[ci]) { ci++; ti++; continue }
      if (mask[ci]) { ci++; continue }
      fail('routes-drift', f, ti + 1, `ROUTES block drifts from execution-modes.md §M8 (canonical line ${canon.docLine + ci}).\n        expected: ${JSON.stringify(block[ci])}\n        found:    ${JSON.stringify(ti < ls.length ? ls[ti] : '<end of file>')}`)
      drifted = true
      break
    }
    if (drifted) continue
    const blockEnd = ti // exclusive

    // A segment the template DOES carry must be carried verbatim and whole — the walk above would
    // otherwise skip a mangled optional segment as if it were absent.
    const fileText = ls.join('\n')
    for (const seg of segments) {
      checksRun++
      if (!ls.some((l) => seg.signature.test(l))) continue
      const want = block.slice(seg.start, seg.end + 1).join('\n')
      if (!fileText.includes(want)) {
        const at = ls.findIndex((l) => seg.signature.test(l))
        fail('routes-drift', f, at + 1, `the optional \`${seg.name}\` segment is present but does not match execution-modes.md §M8 verbatim`)
      }
    }

    // Range-aware inline-literal scan. Any bare model:/effort: literal OUTSIDE the canonical block
    // is a violation of the "routing lives in ROUTES" rule. Matches inside a trailing comment are
    // reported as warnings; matches in executable code fail. (The grep this replaces dropped any
    // line containing "// ", which silently hid a real violation carrying a trailing comment.)
    for (let i = 0; i < ls.length; i++) {
      if (i >= hdr && i < blockEnd) continue
      const { code, comment } = splitCodeComment(ls[i])
      checksRun++
      if (/(?:\bmodel|\beffort)\s*:\s*['"]/.test(code)) {
        fail('inline-routing-literal', f, i + 1, `bare model/effort literal outside the ROUTES block — route it through optsFor(): ${ls[i].trim().slice(0, 90)}`)
      } else if (/(?:\bmodel|\beffort)\s*:\s*['"]/.test(comment)) {
        warn('inline-routing-literal', f, i + 1, `model/effort literal in a comment (prose, not executed): ${ls[i].trim().slice(0, 90)}`)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

async function main() {
  const templates = fs.existsSync(SKILLS_DIR)
    ? walk(SKILLS_DIR, (n) => n.endsWith('.workflow.js')).sort()
    : []

  out('TheLoopSkill validation gate')
  out(`  root: ${ROOT}`)
  out(`  skills: ${fs.existsSync(SKILLS_DIR) ? fs.readdirSync(SKILLS_DIR).filter((d) => fs.statSync(path.join(SKILLS_DIR, d)).isDirectory()).length : 0}   workflow templates: ${templates.length}`)
  out('')

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loopskill-validate-'))
  try {
    out('  [1/8] SKILL.md frontmatter parses and carries name/description/argument-hint')
    out('  [2/8] frontmatter `name` matches its directory')
    out('  [6/8] relative reference paths in SKILL.md resolve on disk')
    checkSkills()
    out('  [3/8] every *.workflow.js parses under node --check (runtime wrapping)')
    checkTemplatesParse(templates, tmpDir)
    out('  [4/8] no H10-banned clock/random calls in template code')
    checkH10(templates)
    out('  [5/8] canonical ROUTES block reproduced verbatim; no inline routing literals')
    checkRoutes(templates)
    out('  [7/8] export const meta is a pure literal; phases match the phase: strings used')
    await checkMeta(templates)
    out('  [8/8] every reference/template file is named in its SKILL.md')
    checkOrphans()
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }

  out('')
  if (warnings.length) {
    out(`${warnings.length} warning(s) — reported, not fatal:`)
    for (const w of warnings) out(`  warn  ${w.file}:${w.line}  [${w.check}] ${w.message}`)
    out('')
  }
  if (failures.length) {
    out(`${failures.length} failure(s):`)
    for (const f of failures) out(`  FAIL  ${f.file}:${f.line}  [${f.check}] ${f.message}`)
    out('')
    out(`FAILED — ${failures.length} failure(s) across ${checksRun} assertions.`)
    if (JSON_MODE) console.log(JSON.stringify({ passed: false, checksRun, failures, warnings }))
    process.exit(1)
  }
  out(`PASSED — ${checksRun} assertions, 0 failures, ${warnings.length} warning(s).`)
  if (JSON_MODE) console.log(JSON.stringify({ passed: true, checksRun, failures, warnings }))
  process.exit(0)
}

// Main-guard: run the gate when this file is executed directly (`node scripts/validate.mjs`),
// but stay side-effect-free when imported as a module — e.g. by
// scripts/check-modes-extraction-parity.mjs, which reuses canonicalBlock() rather than risking a
// third, silently-diverging copy of the §M8 locator in mcp/lib/modes.mjs. Behavior of the CLI
// invocation is unchanged: process.argv[1] equals this file's own path in that case, exactly as
// before this guard existed.
function isMainModule() {
  if (!process.argv[1]) return false
  try {
    return fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])
  } catch {
    return fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  }
}

export { canonicalBlock, MODES_DOC, read, lines }

if (isMainModule()) {
  main().catch((e) => {
    console.error('validate.mjs crashed:', e && e.stack ? e.stack : e)
    process.exit(2)
  })
}
