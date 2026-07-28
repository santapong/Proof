// mcp/lib/modes.mjs — the live §M8 reader.
//
// Zero MCP types live here. This module knows nothing about JSON-RPC, tool schemas or envelopes —
// it locates and evaluates one document section and hands back plain data. It is testable with
// `node -e` alone:
//
//   node -e 'import("./mcp/lib/modes.mjs").then(m => console.log(m.readModesM8().ok))'
//
// (double-quoted specifier above deliberately, so this doc comment does not itself match
// ADR-0002 §D2.3.6's assertNoDependencies() grep for a single-quoted import(...) specifier)
//
// Contract: mirrors scripts/validate.mjs:446 canonicalBlock() — same heading regex, same fence
// walk, same abort-at-next-heading rule, same anchor assertion, same order of checks — per
// docs/design/ADR-0004 §D4.2 ("the locator is a coordinate, never a content search") and
// docs/design/ADR-0004 §C2 ("a naive content search matches 29 sites; the anchor is a confirmation,
// never an identifier"). See "Third-copy guard" below for how the two implementations are kept
// from silently diverging.
//
// mcp/ code may only import node: builtins (ADR-0002 §D2.1) — every specifier below begins with
// `node:`, and this file must never import scripts/validate.mjs or anything else outside `node:`.
//
// Per ADR-0004 §D4.3, evaluation should read the *whole* canonical block with a vm-constructed
// `input`. This module narrows that on purpose: it vm-evaluates ONLY the `const ROUTES = {...}`
// object literal and the single `const WIDTH = ...` arrow line, in a frozen null-prototype sandbox
// with a timeout — never the whole fence, which also carries `plannerAgent`/`fableGateAgent`
// (reference `agent`/`log`, ambient globals this module does not and must not supply) and needs an
// `input` object constructed for the block's own RAW_MODE/PLANNER lines. `MODE_ALIAS` and the
// `--planner fable` override are small enough (one 2-key object, one ternary) that this module
// re-implements them directly in JS instead, each comment-pinned to its exact §M8 source line so a
// reviewer can diff them by eye; ADR-0003's own tool-contracts.json (D3.3_mode.aliasMap) already
// hand-mirrors the identical alias map, so this is not a new pattern, and it is recorded as an open
// question in case a later phase decides the two extra lines are worth a third narrow eval instead.
//
// Per ADR-0005 (no silent default): resolveMode() and routeFor() never perform the script layer's
// own fallbacks (`RAW_MODE → 'balanced'` on anything unrecognized; `routeFor → ROUTES[MODE].analyze`
// on an unrecognized kind). Both are validated against enumerations read live from the evaluated
// block and rejected — named, not absorbed — before any lookup happens (D5.3.1/D5.3.2).

import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Location constants
// ---------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url)) // mcp/lib
const DEFAULT_ROOT = path.resolve(HERE, '..', '..') // repo root, two levels up from mcp/lib
const MODES_DOC_REL = path.join('.claude', 'skills', 'loop-engine', 'references', 'execution-modes.md')

// Mirrors §M8:312 `const MODE_ALIAS = { optimize: 'balanced', full: 'all-out' }` and §M9.6:427's
// "deprecated aliases, still accepted". Hand-mirrored, not vm-evaluated — see the file-header note.
// If this ever disagrees with the source line, the source line wins (ADR-0004 §D4.1) and this
// object is the defect to fix.
const MODE_ALIAS = Object.freeze({ optimize: 'balanced', full: 'all-out' })

// Mirrors §M8:314 `const PLANNER = (input && input.planner) === 'fable' ? 'claude-fable-5' : null`.
// Hand-mirrored for the same reason as MODE_ALIAS above.
const PLANNER_FABLE_MODEL = 'claude-fable-5'

// §M2:59 — an absent --mode resolves to balanced, silently, by design. This is a DECLARED default
// (I1's exemption for an absent argument, correctness-invariant.json D5_3_1.absentIsLegal), never a
// value substituted because a lookup failed.
const DECLARED_DEFAULT_MODE = 'balanced'

function resolveRoot(root) {
  return root ? path.resolve(root) : DEFAULT_ROOT
}

function modesDocPath(root) {
  return path.join(resolveRoot(root), MODES_DOC_REL)
}

function relPosix(root, file) {
  return path.relative(resolveRoot(root), file).split(path.sep).join('/')
}

function toLines(text) {
  return text.replace(/\r\n/g, '\n').split('\n')
}

function sha256OfLines(lines, startLine, endLine) {
  // D3.2: sha256 of the LF-normalized bytes of lines startLine..endLine inclusive (1-indexed),
  // each line terminated by a single \n.
  const slice = lines.slice(startLine - 1, endLine)
  const bytes = slice.map((l) => l + '\n').join('')
  return crypto.createHash('sha256').update(bytes, 'utf8').digest('hex')
}

// ---------------------------------------------------------------------------
// Locator — mirrors scripts/validate.mjs:446 canonicalBlock() exactly, in the same order:
// heading -> fence open (abort at next heading) -> fence close -> non-empty -> anchor.
//
// Error codes follow docs/design/ADR-0004 §D4.5's structural tier and the exact code each planted
// mutation produces per mcp/extraction-contract.json D4_7_probes.mutationMatrix — in particular an
// EMPTIED fence is reported as `source-anchor-moved` (there is no first line to test the anchor
// against), matching the measured mutation-matrix row, not a separate `source-fence-empty` path.
// ---------------------------------------------------------------------------

function locateM8(root) {
  const file = modesDocPath(root)
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch (e) {
    return {
      ok: false,
      code: 'source-missing',
      error: `cannot read ${relPosix(root, file)}: ${e.code === 'ENOENT' ? 'no such file' : e.message}`,
      file: relPosix(root, file),
    }
  }
  const ls = toLines(text)

  let h = -1
  for (let i = 0; i < ls.length; i++) {
    if (/^##\s+M8\./.test(ls[i])) { h = i; break }
  }
  if (h === -1) {
    return { ok: false, code: 'source-heading-missing', error: 'no "## M8." heading in execution-modes.md', file: relPosix(root, file) }
  }

  let start = -1
  for (let i = h + 1; i < ls.length; i++) {
    if (/^```js\s*$/.test(ls[i])) { start = i + 1; break }
    if (/^##\s/.test(ls[i])) break
  }
  if (start === -1) {
    return { ok: false, code: 'source-fence-missing', error: 'no ```js fence under the §M8 heading in execution-modes.md', file: relPosix(root, file) }
  }

  let stop = -1
  for (let i = start; i < ls.length; i++) {
    if (/^```\s*$/.test(ls[i])) { stop = i; break }
  }
  if (stop === -1) {
    return { ok: false, code: 'source-fence-unclosed', error: 'the §M8 ```js fence is never closed', file: relPosix(root, file) }
  }

  const block = ls.slice(start, stop)
  if (!block.length) {
    return { ok: false, code: 'source-anchor-moved', error: 'the §M8 code fence is empty', file: relPosix(root, file) }
  }
  if (!/^\/\/ Canonical ROUTES block/.test(block[0])) {
    return {
      ok: false,
      code: 'source-anchor-moved',
      error: `the §M8 block must open with "// Canonical ROUTES block"; found ${JSON.stringify(block[0].slice(0, 60))}`,
      file: relPosix(root, file),
    }
  }

  // heading text for the citation `section` field (D3.2)
  const section = ls[h].replace(/^#+\s*/, '## ').trim() || ls[h].trim()

  return {
    ok: true,
    file: relPosix(root, file),
    absFile: file,
    block, // array of lines, fence content only (excludes the ``` delimiters)
    docLine: start + 1, // 1-indexed line of block[0] in the source file
    startLine: start + 1,
    endLine: stop, // 1-indexed, inclusive of the line before the closing fence
    section: ls[h].trim(),
    allLines: ls,
  }
}

// ---------------------------------------------------------------------------
// String- and comment-aware brace matcher (ported from scripts/validate.mjs:345 matchBraces — a
// generic bracket-counting utility, not part of the drift-prone routing table itself, so a small
// second copy here carries none of the risk ADR-0004 rules against for ROUTES/WIDTH).
// ---------------------------------------------------------------------------

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

function frozenSandbox() {
  return vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } })
}

// ---------------------------------------------------------------------------
// ROUTES extraction — vm-evaluate ONLY the `const ROUTES = {...}` object literal (ADR-0004 §D4.3,
// narrowed per this module's header note). Never the whole fence.
// ---------------------------------------------------------------------------

function extractRoutes(block) {
  const src = block.join('\n')
  const declIdx = src.search(/^const ROUTES\s*=/m)
  if (declIdx === -1) {
    return { ok: false, code: 'source-shape-changed', error: 'no `const ROUTES = ...` declaration in the §M8 block' }
  }
  const openIdx = src.indexOf('{', declIdx)
  const closeIdx = openIdx === -1 ? -1 : matchBraces(src, openIdx)
  if (openIdx === -1 || closeIdx === -1) {
    return { ok: false, code: 'source-block-uninterpretable', error: 'the `const ROUTES = {...}` object literal in §M8 is not brace-balanced' }
  }
  const literal = src.slice(openIdx, closeIdx + 1)
  const ctx = frozenSandbox()
  let routes
  try {
    routes = vm.runInContext('(' + literal + ')', ctx, { timeout: 1000, displayErrors: true })
  } catch (e) {
    return { ok: false, code: 'source-block-uninterpretable', error: `ROUTES literal failed to evaluate: ${e.message}` }
  }
  if (!routes || typeof routes !== 'object') {
    return { ok: false, code: 'source-block-uninterpretable', error: 'ROUTES literal did not evaluate to an object' }
  }
  return { ok: true, routes }
}

// ---------------------------------------------------------------------------
// WIDTH extraction — the single `const WIDTH = (kind) => (...)` line, kept as text and re-evaluated
// per call with MODE injected ahead of it, so no function value that closes over an undefined `MODE`
// ever escapes this module (ADR-0004 §D4.3's "never mutate a harvested value" read literally: there
// is nothing here to mutate because nothing is harvested as a live closure).
// ---------------------------------------------------------------------------

function extractWidthLine(block) {
  const line = block.find((l) => /^const WIDTH\b/.test(l))
  return line || null
}

function computeWidth(widthLine, mode, taskType) {
  if (!widthLine) {
    return { ok: false, code: 'source-shape-changed', error: 'no `const WIDTH = ...` line in the §M8 block' }
  }
  const ctx = frozenSandbox()
  const src = `const MODE = ${JSON.stringify(mode)};\n${widthLine}\n;WIDTH(${JSON.stringify(taskType)})`
  let result
  try {
    result = vm.runInContext(src, ctx, { timeout: 1000, displayErrors: true })
  } catch (e) {
    return { ok: false, code: 'source-block-uninterpretable', error: `WIDTH evaluation failed: ${e.message}` }
  }
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    return { ok: false, code: 'source-block-uninterpretable', error: `WIDTH(${JSON.stringify(taskType)}) under mode ${JSON.stringify(mode)} did not evaluate to a number` }
  }
  return { ok: true, width: result }
}

// ---------------------------------------------------------------------------
// Shape validation — ADR-0004 §D4.7 E4/E5, narrowed to what this module needs.
// ---------------------------------------------------------------------------

const CANONICAL_MODES = ['lite', 'balanced', 'all-out'] // the vocabulary this module ACCEPTS as
// canonical is read from the evaluated ROUTES object's own keys (see validateShape below); this
// array is the EXPECTED value used only to name the mismatch, never substituted as an answer.
const CANONICAL_KINDS = [
  'scout', 'doc', 'implement', 'analyze', 'synthesize', 'verify', 'judge', 'critic', 'gating', 'planner',
]

function sameSet(a, b) {
  if (a.length !== b.length) return false
  const sb = new Set(b)
  return a.every((x) => sb.has(x))
}

function validateShape(routes) {
  const modeKeys = Object.keys(routes)
  if (!sameSet(modeKeys, CANONICAL_MODES)) {
    return {
      ok: false,
      code: 'mode-vocabulary-changed',
      error: `ROUTES keys are ${JSON.stringify(modeKeys)}, expected exactly ${JSON.stringify(CANONICAL_MODES)}`,
    }
  }
  for (const m of modeKeys) {
    const kindKeys = Object.keys(routes[m])
    if (!sameSet(kindKeys, CANONICAL_KINDS)) {
      return {
        ok: false,
        code: 'kind-vocabulary-changed',
        error: `ROUTES[${JSON.stringify(m)}] keys are ${JSON.stringify(kindKeys)}, expected exactly ${JSON.stringify(CANONICAL_KINDS)}`,
      }
    }
  }
  return { ok: true, modes: modeKeys.slice(), kinds: CANONICAL_KINDS.slice() }
}

// ---------------------------------------------------------------------------
// Public: readModesM8 — locate + extract + validate, once. Everything below composes on its result.
// ---------------------------------------------------------------------------

function readModesM8(options = {}) {
  const root = options.root
  const located = locateM8(root)
  if (!located.ok) return located

  const routesResult = extractRoutes(located.block)
  if (!routesResult.ok) return routesResult

  const shape = validateShape(routesResult.routes)
  if (!shape.ok) return shape

  const widthLine = extractWidthLine(located.block)
  if (!widthLine) return { ok: false, code: 'source-shape-changed', error: 'no `const WIDTH = ...` line in the §M8 block' }

  const sha256 = sha256OfLines(located.allLines, located.startLine, located.endLine)

  return {
    ok: true,
    routes: Object.freeze(routesResult.routes),
    widthLine,
    modes: shape.modes, // canonical modes, read live from the source, e.g. ['lite','balanced','all-out']
    kinds: shape.kinds, // the ten canonical taskType keys, read live from the source
    citation: {
      file: located.file,
      section: located.section,
      startLine: located.startLine,
      endLine: located.endLine,
      sha256,
    },
  }
}

// ---------------------------------------------------------------------------
// §M3 cross-check (ADR-0004 §D4.4, §D4.5 semantic tier, §D4.7 probe E6; machine-readable
// companion mcp/extraction-contract.json D4_4_crosscheck / D4_7_probes.E6).
//
// §M3's table (execution-modes.md:81-89) is prose written for humans, authored SEPARATELY from
// the §M8 ROUTES block this module already evaluates. It is a genuine independent witness (ADR-0004
// §C6) — cross-checking it mechanically is what makes the approved v1 line's promise "parsed LIVE …
// never a duplicated table" auditable rather than asserted (ADR-0004 §C1). §M8 is the source on any
// disagreement (§M4:102, ADR-0004 D4.6) — but D4.5/D5.3.4 forbid answering from §M8 while quietly
// discarding a §M3 reading that disagrees: a disagreement is reported, naming BOTH readings and BOTH
// line numbers, and this module never resolves it by precedence at call time.
//
// A regex over §M3 mis-parses on the next editorial reflow (ADR-0004 §C6's own checker had a bug on
// first draft: 'correctness-critical' mapping to 'gating' PLUS the literal token 'gating' in the same
// row counted gating twice — row labels must be deduped to a SET before counting, D4_4.dedupeRowKeysToSet).
// So every step below is the exact walk D4.4 specifies, not a best-effort scrape: locate by coordinate
// (never a tree-wide content search, ADR-0004 §D4.2), validate columns, map labels through a DECLARED
// alias table (an unmapped token is an error, never a silent skip), dedupe to a set, assert coverage
// is EXACTLY ONCE per §M8 kind, then compare cell-by-cell. Any shape this doesn't recognize THROWS —
// well, returns an ok:false naming the exact span — rather than coping with a best guess (ADR-0005 I1).
// ---------------------------------------------------------------------------

// D4_4_crosscheck.aliasMap — DECLARED, never inferred (see file header above). `null` means the token
// is a descriptive gloss with no ROUTES key of its own (a bare gloss on a row that also carries a real
// key literally, e.g. "correctness-critical / gating") and is dropped after mapping, never counted.
const M3_ALIAS_MAP = Object.freeze({
  scout: 'scout', doc: 'doc', implement: 'implement', analyze: 'analyze',
  synthesize: 'synthesize', verify: 'verify', judge: 'judge', critic: 'critic',
  gating: 'gating', planner: 'planner',
  mechanical: null,
  'correctness-critical': null,
})

// D4_4_crosscheck.variantRows.planner@fable — matched on the row LABEL cell, never on a token split,
// because this row carries no '/' and no <br/>: "**planner** with `--planner fable`". Checked through
// applyPlannerOverride() against ROUTES[mode].planner, never counted toward the ten-key coverage
// assertion (execution-modes.md:201 — "selected by the flag, not by the node").
const M3_VARIANT_PLANNER_FABLE_REGEX = /--planner fable/

function m3DocPath(root) {
  return modesDocPath(root) // same source file as §M8 — execution-modes.md
}

// ---------------------------------------------------------------------------
// Locator — §M3's heading, then the first markdown table under it (header row + `|---|` separator +
// contiguous `|`-prefixed data rows), aborting at the next `^##\s`. Coordinate, not content search
// (ADR-0004 §D4.2) — this walk is bounded to the single already-located §M3 section, never the tree.
// ---------------------------------------------------------------------------

function locateM3(root) {
  const file = m3DocPath(root)
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch (e) {
    return {
      ok: false,
      code: 'source-missing',
      error: `cannot read ${relPosix(root, file)}: ${e.code === 'ENOENT' ? 'no such file' : e.message}`,
      file: relPosix(root, file),
    }
  }
  const ls = toLines(text)

  let h = -1
  for (let i = 0; i < ls.length; i++) {
    if (/^##\s+M3\./.test(ls[i])) { h = i; break }
  }
  if (h === -1) {
    return { ok: false, code: 'source-heading-missing', error: 'no "## M3." heading in execution-modes.md', file: relPosix(root, file) }
  }
  const section = ls[h].trim()

  const isTableRow = (l) => /^\|.*\|\s*$/.test(l)
  const isSeparatorRow = (l) => /^\|[\s:|-]+\|\s*$/.test(l)

  let headerLine = -1 // 0-indexed
  for (let i = h + 1; i < ls.length; i++) {
    if (/^##\s/.test(ls[i])) break
    if (isTableRow(ls[i]) && i + 1 < ls.length && isSeparatorRow(ls[i + 1])) { headerLine = i; break }
  }
  if (headerLine === -1) {
    return { ok: false, code: 'source-shape-changed', error: 'no markdown table found under the §M3 heading in execution-modes.md', file: relPosix(root, file) }
  }

  const rows = []
  for (let i = headerLine + 2; i < ls.length; i++) {
    if (/^##\s/.test(ls[i])) break
    if (!isTableRow(ls[i])) break
    rows.push({ line: i + 1, text: ls[i] }) // 1-indexed
  }
  if (!rows.length) {
    return { ok: false, code: 'source-shape-changed', error: 'the §M3 table has a header and separator but no data rows', file: relPosix(root, file) }
  }

  return {
    ok: true,
    file: relPosix(root, file),
    section,
    headerLine: headerLine + 1, // 1-indexed
    headerText: ls[headerLine],
    rows,
    allLines: ls,
  }
}

// Splits one `| a | b | c |` line into trimmed cells, dropping the leading/trailing empty produced by
// the outer pipes. No cell in §M3's table contains a literal `|`, so an unescaped-pipe split is exact.
function splitTableRow(line) {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map((c) => c.trim())
}

// D4_4_crosscheck.columnNormalization — "strip **, strip backticks, strip '(default)', trim".
function normalizeM3ColumnLabel(cell) {
  return cell.replace(/`/g, '').replace(/\*\*/g, '').replace(/\(default\)/i, '').trim()
}

function parseM3Header(headerText, expectedModes) {
  const cells = splitTableRow(headerText)
  const dataCols = cells.slice(1).map(normalizeM3ColumnLabel)
  const orderedMatch = dataCols.length === expectedModes.length && dataCols.every((c, i) => c === expectedModes[i])
  if (!orderedMatch) {
    return {
      ok: false,
      code: 'crosscheck-columns-changed',
      error: `§M3 header data columns are ${JSON.stringify(dataCols)}, expected exactly ${JSON.stringify(expectedModes)} in order`,
      found: dataCols,
      expected: expectedModes,
    }
  }
  return { ok: true, columns: dataCols }
}

// D4_4_crosscheck.labelNormalization — "take text before '<br/>', strip **, trim, split on '/'".
function normalizeM3RowLabel(cell) {
  return cell.split(/<br\s*\/?>/i)[0].replace(/\*\*/g, '').trim()
}

function tokenizeM3Label(normalizedLabel) {
  return normalizedLabel.split('/').map((t) => t.trim()).filter((t) => t.length > 0)
}

// D4_4_crosscheck.cellParse — form "<model>, <effort>"; `inherit` -> model:null, `omit` -> effort:null.
function parseM3Cell(cellText) {
  const raw = cellText.trim()
  const commaIdx = raw.indexOf(',')
  if (commaIdx === -1) {
    return { ok: false, code: 'source-block-uninterpretable', error: `§M3 cell ${JSON.stringify(raw)} does not match the "<model>, <effort>" form` }
  }
  const modelPart = raw.slice(0, commaIdx).trim()
  const effortPart = raw.slice(commaIdx + 1).trim()
  if (!modelPart || !effortPart) {
    return { ok: false, code: 'source-block-uninterpretable', error: `§M3 cell ${JSON.stringify(raw)} does not match the "<model>, <effort>" form` }
  }
  const model = modelPart === 'inherit' ? null : modelPart.replace(/`/g, '').trim()
  const effort = effortPart === 'omit' ? null : effortPart.replace(/`/g, '').trim()
  return { ok: true, model, effort }
}

// Best-effort line index into the already-located §M8 block, `{ mode: { kind: absoluteLine } }`, used
// only to cite the SPECIFIC line of a disagreeing ROUTES entry rather than the whole block range. Every
// `ROUTES[mode][kind]` entry is single-line in the current formatting (§M8:317-351), so a bounded scan
// of the already-located block (not a tree search — the block itself was found by coordinate, D4.2)
// is exact today; if a reformat breaks the pattern this simply finds nothing and callers fall back to
// the whole-block citation (m8.citation) — never a hard failure over a citation nicety.
function indexRouteLines(block, blockStartLine) {
  const index = {}
  let currentMode = null
  const modeLineRe = /^\s*(lite|balanced|'all-out')\s*:\s*\{/
  const kindLineRe = /^\s*(scout|doc|implement|analyze|synthesize|verify|judge|critic|gating|planner)\s*:\s*\{/
  for (let i = 0; i < block.length; i++) {
    const line = block[i]
    const mm = modeLineRe.exec(line)
    if (mm) {
      currentMode = mm[1].replace(/'/g, '')
      index[currentMode] = index[currentMode] || {}
      continue
    }
    if (currentMode) {
      const km = kindLineRe.exec(line)
      if (km) index[currentMode][km[1]] = blockStartLine + i
    }
  }
  return index
}

function m3RangeCitation(m3, startLine, endLine) {
  return { file: m3.file, section: m3.section, startLine, endLine, sha256: sha256OfLines(m3.allLines, startLine, endLine) }
}

function m8LineCitation(m8Located, line) {
  return { file: m8Located.file, section: m8Located.section, startLine: line, endLine: line, sha256: sha256OfLines(m8Located.allLines, line, line) }
}

// ---------------------------------------------------------------------------
// Public: crosscheckM3 — the E6 probe. Takes an already-`readModesM8()`-successful result (so mode and
// kind vocabulary are already validated, D4_7.E4/E5 — E6 does not re-derive them) and independently
// parses §M3, then asserts agreement per D4.4: columns, declared alias mapping (unmapped -> error),
// dedupe-to-set, coverage-exactly-once over m8.kinds, cell-by-cell agreement including the
// `--planner fable` variant row checked through applyPlannerOverride(). Returns ok:true only when
// every one of those holds; otherwise ok:false naming the tier-appropriate code, both readings and
// both citations (D4.5 semantic tier, D5.3.4 — never resolved by precedence at call time).
// ---------------------------------------------------------------------------

function crosscheckM3(m8, options = {}) {
  if (!m8 || !m8.ok) return m8 || { ok: false, code: 'internal', error: 'readModesM8() result required' }
  const root = options.root

  const m3 = locateM3(root)
  if (!m3.ok) return m3

  const m8Located = locateM8(root) // re-located, not cached, per D5.3.7 — needed for per-line citations
  if (!m8Located.ok) return m8Located

  const headerResult = parseM3Header(m3.headerText, m8.modes)
  if (!headerResult.ok) {
    return {
      ok: false,
      code: headerResult.code,
      error: `${headerResult.error} (§M3:${m3.headerLine})`,
      details: [
        { citation: m3RangeCitation(m3, m3.headerLine, m3.headerLine), reading: headerResult.found },
        { citation: m8.citation, reading: headerResult.expected },
      ],
      fix: 'edit execution-modes.md §M3\'s header row so its data columns are exactly `lite` | `balanced` (default) | `all-out`, in that order, matching §M8\'s ROUTES keys — §M4:102 makes §M8 the source',
    }
  }
  const modeColumns = headerResult.columns

  const routeLines = indexRouteLines(m8Located.block, m8Located.startLine)
  const coverage = {}
  for (const k of m8.kinds) coverage[k] = 0

  const disagreements = []
  let variantRowSeen = false

  for (const row of m3.rows) {
    const cells = splitTableRow(row.text)
    if (cells.length !== modeColumns.length + 1) {
      return {
        ok: false,
        code: 'source-shape-changed',
        error: `§M3 row at line ${row.line} has ${cells.length} cell(s), expected ${modeColumns.length + 1} (one label plus one per mode column): ${JSON.stringify(row.text)}`,
        details: [{ citation: m3RangeCitation(m3, row.line, row.line) }],
        fix: `edit execution-modes.md §M3's row at line ${row.line} so it has exactly one label cell plus one cell per mode column`,
      }
    }
    const labelCell = cells[0]
    const isVariant = M3_VARIANT_PLANNER_FABLE_REGEX.test(labelCell)

    if (isVariant) {
      variantRowSeen = true
      for (let i = 0; i < modeColumns.length; i++) {
        const mode = modeColumns[i]
        const parsed = parseM3Cell(cells[i + 1])
        if (!parsed.ok) {
          return {
            ok: false,
            code: parsed.code,
            error: `${parsed.error} (§M3:${row.line}, the --planner fable row, ${mode} column)`,
            details: [{ citation: m3RangeCitation(m3, row.line, row.line) }],
            fix: `edit execution-modes.md §M3's --planner fable row (line ${row.line}) so the ${mode} cell is the "<model>, <effort>" form`,
          }
        }
        const baseEntry = m8.routes[mode] && m8.routes[mode].planner
        if (!baseEntry) {
          return { ok: false, code: 'source-shape-changed', error: `ROUTES[${JSON.stringify(mode)}] has no planner entry to check the --planner fable row against` }
        }
        const expected = applyPlannerOverride(
          { model: baseEntry.model === undefined ? null : baseEntry.model, effort: baseEntry.effort === undefined ? null : baseEntry.effort },
          'planner',
          'fable',
        )
        if (parsed.model !== expected.model || parsed.effort !== expected.effort) {
          const m8Line = routeLines[mode] && routeLines[mode].planner
          disagreements.push({
            key: 'planner@fable', mode,
            m3: { model: parsed.model, effort: parsed.effort, line: row.line },
            m8: { model: expected.model, effort: expected.effort, line: m8Line || null },
          })
        }
      }
      continue
    }

    const normalizedLabel = normalizeM3RowLabel(labelCell)
    const tokens = tokenizeM3Label(normalizedLabel)
    if (!tokens.length) {
      return {
        ok: false,
        code: 'crosscheck-label-unmapped',
        error: `§M3 row at line ${row.line} has an empty or unparseable label cell: ${JSON.stringify(labelCell)}`,
        details: [{ citation: m3RangeCitation(m3, row.line, row.line) }],
        fix: `edit execution-modes.md §M3's row at line ${row.line} so its label names at least one node kind`,
      }
    }

    const mappedKeys = new Set() // D4_4_crosscheck.dedupeRowKeysToSet — dedupe BEFORE counting
    for (const tok of tokens) {
      if (!Object.prototype.hasOwnProperty.call(M3_ALIAS_MAP, tok)) {
        return {
          ok: false,
          code: 'crosscheck-label-unmapped',
          error: `§M3 row at line ${row.line} has an unmapped label token ${JSON.stringify(tok)} — the declared alias map (mcp/lib/modes.mjs M3_ALIAS_MAP) has no entry for it`,
          details: [
            { citation: m3RangeCitation(m3, row.line, row.line), reading: tok },
            { citation: m8.citation, reading: m8.kinds },
          ],
          fix: `edit execution-modes.md §M3's row at line ${row.line}, or add ${JSON.stringify(tok)} to M3_ALIAS_MAP in mcp/lib/modes.mjs — an unmapped token is an error, never a silent skip (ADR-0004 §D4.4)`,
        }
      }
      const mapped = M3_ALIAS_MAP[tok]
      if (mapped) mappedKeys.add(mapped)
    }

    for (const key of mappedKeys) {
      coverage[key] = (coverage[key] || 0) + 1
      for (let i = 0; i < modeColumns.length; i++) {
        const mode = modeColumns[i]
        const parsed = parseM3Cell(cells[i + 1])
        if (!parsed.ok) {
          return {
            ok: false,
            code: parsed.code,
            error: `${parsed.error} (§M3:${row.line}, ${key}/${mode})`,
            details: [{ citation: m3RangeCitation(m3, row.line, row.line) }],
            fix: `edit execution-modes.md §M3's row at line ${row.line} so the ${mode} cell is the "<model>, <effort>" form`,
          }
        }
        const entry = m8.routes[mode] && m8.routes[mode][key]
        if (!entry) {
          return { ok: false, code: 'source-shape-changed', error: `ROUTES[${JSON.stringify(mode)}] has no entry for ${JSON.stringify(key)} to cross-check §M3:${row.line} against` }
        }
        const m8Model = entry.model === undefined ? null : entry.model
        const m8Effort = entry.effort === undefined ? null : entry.effort
        if (parsed.model !== m8Model || parsed.effort !== m8Effort) {
          const m8Line = routeLines[mode] && routeLines[mode][key]
          disagreements.push({
            key, mode,
            m3: { model: parsed.model, effort: parsed.effort, line: row.line },
            m8: { model: m8Model, effort: m8Effort, line: m8Line || null },
          })
        }
      }
    }
  }

  if (disagreements.length) {
    const parts = disagreements.map((d) => {
      const m8LineText = d.m8.line ? `:${d.m8.line}` : `:${m8.citation.startLine}-${m8.citation.endLine}`
      return `${d.key}/${d.mode} — §M3:${d.m3.line} says {model:${JSON.stringify(d.m3.model)}, effort:${JSON.stringify(d.m3.effort)}}, §M8${m8LineText} says {model:${JSON.stringify(d.m8.model)}, effort:${JSON.stringify(d.m8.effort)}}`
    })
    return {
      ok: false,
      code: 'crosscheck-disagreement',
      error: `§M3 and §M8 disagree on ${disagreements.length} cell(s): ${parts.join('; ')}`,
      details: disagreements.map((d) => ({
        key: d.key,
        mode: d.mode,
        m3Reading: d.m3,
        m8Reading: d.m8,
        citations: [
          m3RangeCitation(m3, d.m3.line, d.m3.line),
          d.m8.line ? m8LineCitation(m8Located, d.m8.line) : m8.citation,
        ],
      })),
      fix: 'edit execution-modes.md §M3 to match §M8 — §M4:102 makes §M8 the source, never the reverse',
    }
  }

  const miscounted = Object.entries(coverage).filter(([, n]) => n !== 1)
  if (miscounted.length) {
    const lastRow = m3.rows[m3.rows.length - 1]
    return {
      ok: false,
      code: 'crosscheck-coverage',
      error: `§M3 does not claim every §M8 kind exactly once: ${JSON.stringify(miscounted)}`,
      details: [
        { citation: m3RangeCitation(m3, m3.rows[0].line, lastRow.line), reading: coverage },
        { citation: m8.citation, reading: m8.kinds },
      ],
      fix: 'edit execution-modes.md §M3 so every one of the ten §M8 ROUTES kinds is named by exactly one row label — §M4:102 makes §M8 the source',
    }
  }

  if (!variantRowSeen) {
    const lastRow = m3.rows[m3.rows.length - 1]
    return {
      ok: false,
      code: 'crosscheck-coverage',
      error: 'no §M3 row matches the "--planner fable" variant (a row containing the text "--planner fable") — the planner-on-Fable row is missing',
      details: [{ citation: m3RangeCitation(m3, m3.rows[0].line, lastRow.line) }],
      fix: 'edit execution-modes.md §M3 to restore the row "**planner** with `--planner fable`"',
    }
  }

  const lastRow = m3.rows[m3.rows.length - 1]
  return {
    ok: true,
    modes: modeColumns,
    kinds: m8.kinds,
    coverage,
    rowsChecked: m3.rows.length,
    citation: m3RangeCitation(m3, m3.headerLine, lastRow.line),
  }
}

// ---------------------------------------------------------------------------
// Public: resolveMode — never folds case, never guesses. Surfaces §M8's own silent fallback
// (RAW_MODE -> 'balanced' for anything unrecognized) as an error instead of performing it
// (ADR-0005 §D5.3.1, correctness-invariant.json G5.1-G5.3).
// ---------------------------------------------------------------------------

function resolveMode(rawMode, modes) {
  const canonical = modes || CANONICAL_MODES
  if (rawMode === undefined || rawMode === null || rawMode === '') {
    return { ok: true, mode: DECLARED_DEFAULT_MODE, supplied: null, alias: false, isDefault: true }
  }
  if (typeof rawMode !== 'string') {
    return {
      ok: false,
      code: 'unknown_mode',
      error: `mode must be a string; got ${typeof rawMode} — the three valid values are ${canonical.join(', ')}`,
      valid: canonical.slice(),
    }
  }
  if (Object.prototype.hasOwnProperty.call(MODE_ALIAS, rawMode)) {
    return { ok: true, mode: MODE_ALIAS[rawMode], supplied: rawMode, alias: true, isDefault: false }
  }
  if (canonical.includes(rawMode)) {
    return { ok: true, mode: rawMode, supplied: rawMode, alias: false, isDefault: false }
  }
  // Deliberately NOT case-folded — §M2:59 promises case-insensitivity but §M8:311's own indexOf is
  // case-sensitive (a layer split, ADR-0005 §2 finding 2 / correctness-invariant.json D5_6). This
  // module folds nothing and accepts nothing unfolded (D5_6_notRuledHere item 3).
  return {
    ok: false,
    code: 'unknown_mode',
    error: `unrecognized mode ${JSON.stringify(rawMode)} — the three valid values are ${canonical.join(', ')}`,
    valid: canonical.slice(),
  }
}

// ---------------------------------------------------------------------------
// Public: routeFor — never falls back to ROUTES[mode].analyze on an unrecognized taskType
// (ADR-0005 §D5.3.2, correctness-invariant.json G5.4/G5.5). `mode` MUST already be a canonical
// value returned by resolveMode — this function does not itself validate mode.
// ---------------------------------------------------------------------------

function routeFor(routes, mode, taskType, kinds) {
  const canonicalKinds = kinds || CANONICAL_KINDS
  if (typeof taskType !== 'string' || !canonicalKinds.includes(taskType)) {
    return {
      ok: false,
      code: 'unknown_task_kind',
      error: `unrecognized taskType ${JSON.stringify(taskType)} — the ten valid values are ${canonicalKinds.join(', ')}`,
      valid: canonicalKinds.slice(),
    }
  }
  const modeTable = routes[mode]
  if (!modeTable || !Object.prototype.hasOwnProperty.call(modeTable, taskType)) {
    return { ok: false, code: 'source-shape-changed', error: `ROUTES[${JSON.stringify(mode)}] has no entry for ${JSON.stringify(taskType)}` }
  }
  const entry = modeTable[taskType]
  return {
    ok: true,
    model: entry.model === undefined ? null : entry.model,
    effort: entry.effort === undefined ? null : entry.effort,
    pinning: entry.model ? 'pinned' : 'inherit',
  }
}

// ---------------------------------------------------------------------------
// Public: width — thin wrapper over computeWidth, symmetric validation to routeFor.
// ---------------------------------------------------------------------------

function width(widthLine, mode, taskType, kinds) {
  const canonicalKinds = kinds || CANONICAL_KINDS
  if (typeof taskType !== 'string' || !canonicalKinds.includes(taskType)) {
    return {
      ok: false,
      code: 'unknown_task_kind',
      error: `unrecognized taskType ${JSON.stringify(taskType)} — the ten valid values are ${canonicalKinds.join(', ')}`,
      valid: canonicalKinds.slice(),
    }
  }
  return computeWidth(widthLine, mode, taskType)
}

// ---------------------------------------------------------------------------
// Public: applyPlannerOverride — mirrors §M8:353-360 optsFor()'s
// `if (PLANNER && node.taskType === 'planner') opts.model = PLANNER`, scoped to taskType==='planner'
// and nothing else. `planner` is the tool's own input vocabulary ('opus' | 'fable'), matching
// mcp/tool-contracts.json D3.6_tools[0].inputSchema.properties.planner.
// ---------------------------------------------------------------------------

function applyPlannerOverride(route, taskType, planner) {
  if (planner === 'fable' && taskType === 'planner') {
    return { ...route, model: PLANNER_FABLE_MODEL, pinning: 'pinned', plannerOverride: true }
  }
  return { ...route, plannerOverride: false }
}

// ---------------------------------------------------------------------------
// Public: route — composes resolveMode + routeFor + width + applyPlannerOverride in one call,
// stopping at the first error rather than silently substituting anything (ADR-0005 I2 totality:
// exactly ok:true or a named ok:false, no partial result).
// ---------------------------------------------------------------------------

function route(m8, { mode: rawMode, taskType, planner } = {}) {
  if (!m8 || !m8.ok) return m8 || { ok: false, code: 'internal', error: 'readModesM8() result required' }

  const modeResult = resolveMode(rawMode, m8.modes)
  if (!modeResult.ok) return modeResult

  const routeResult = routeFor(m8.routes, modeResult.mode, taskType, m8.kinds)
  if (!routeResult.ok) return routeResult

  const widthResult = width(m8.widthLine, modeResult.mode, taskType, m8.kinds)
  if (!widthResult.ok) return widthResult

  const withPlanner = applyPlannerOverride(routeResult, taskType, planner)

  return {
    ok: true,
    mode: modeResult.mode,
    modeSupplied: modeResult.supplied,
    modeIsAlias: modeResult.alias,
    modeIsDefault: modeResult.isDefault,
    taskType,
    route: withPlanner,
    width: widthResult.width,
    citation: m8.citation,
  }
}

// ---------------------------------------------------------------------------
// Third-copy guard
// ---------------------------------------------------------------------------
//
// scripts/validate.mjs:446 canonicalBlock() implements this exact same locate() walk and cannot be
// imported here — mcp/ code may only import node: builtins (ADR-0002 §D2.1), and validate.mjs's
// main() runs at module scope (behind an isMainModule() guard added alongside this change so it CAN
// be imported safely from outside mcp/). The two implementations are kept from silently diverging by
// scripts/check-modes-extraction-parity.mjs, a standalone script OUTSIDE mcp/ (so it is exempt from
// D2's node:-only rule, which binds mcp/**/*.mjs, not scripts/) that imports BOTH
// scripts/validate.mjs's canonicalBlock() and this file's locateM8(), and asserts they return
// byte-identical block text and the identical docLine/startLine for the current tree. Run it with
// `node scripts/check-modes-extraction-parity.mjs`.

export {
  readModesM8,
  resolveMode,
  routeFor,
  width,
  applyPlannerOverride,
  route,
  locateM8,
  extractRoutes,
  extractWidthLine,
  computeWidth,
  validateShape,
  CANONICAL_MODES,
  CANONICAL_KINDS,
  MODE_ALIAS,
  DEFAULT_ROOT,
  // §M3 cross-check (E6) — ADR-0004 §D4.4/§D4.5/§D4.7
  crosscheckM3,
  locateM3,
  parseM3Header,
  normalizeM3RowLabel,
  tokenizeM3Label,
  parseM3Cell,
  splitTableRow,
  indexRouteLines,
  M3_ALIAS_MAP,
  M3_VARIANT_PLANNER_FABLE_REGEX,
}
