// mcp/lib/estimate.mjs — the live §M6 reader.
//
// Zero MCP types live here, same discipline as mcp/lib/modes.mjs: this module knows nothing about
// JSON-RPC, tool schemas or envelopes — it locates and parses one document section (§M6, "The
// full-mode pre-flight") and hands back plain data plus the deterministic arithmetic §M6 defines
// over it. Testable with `node -e` alone:
//
//   node -e 'import("./mcp/lib/estimate.mjs").then(m => console.log(m.readModesM6().ok))'
//
// (double-quoted specifier above deliberately, so this doc comment does not itself match
// ADR-0002 §D2.3.6's assertNoDependencies() grep for a single-quoted import(...) specifier)
//
// mcp/ code may only import node: builtins (ADR-0002 §D2.1 — EVERY import specifier reachable
// from mcp/, not just mcp/server.mjs, must begin with `node:`; scripts/validate.mjs's own grep is
// `import\('[^']+'\)|from '[^']+'` over `mcp/**/*.mjs`, no carve-out for a relative specifier). That
// is why this file does NOT `import` mcp/lib/modes.mjs even though the two modules share several
// small helpers (toLines, sha256OfLines, relPosix, table-row splitting) and a literal ten-kind
// vocabulary — each is re-declared here, deliberately, the same way modes.mjs's own header note
// re-declares MODE_ALIAS and PLANNER_FABLE_MODEL rather than importing them from anywhere: "if this
// ever disagrees with the source line, the source line wins, and this is the defect to fix."
//
// Per ADR-0004 §D4.1's per-symbol authority table, three DIFFERENT things live under §M6 and this
// module reads each with the strategy the table assigns it, not one strategy for all three:
//
//   BAND, SIZE                                  -> table / sentence PARSE      (this file, below)
//   agents/items/width/tokens formulae           -> NOT parsed as code — §M6's formula fence
//                                                   (execution-modes.md:179-197) is pseudo-code
//                                                   (`Σ`, `for a known work-list`, wrapped prose
//                                                   descriptions), not JavaScript, and D4.1 says so
//                                                   explicitly: "must never be fed to the evaluator."
//
// The formula's ARITHMETIC SHAPE — which of the seven `width(n) = N` clauses applies, and how
// agents/tokens combine — is therefore the one place in this server where a formula is duplicated
// in code rather than evaluated live, and ADR-0004 §D4.1 requires that a parser limitation be
// SURFACED, never hidden: "a parser limitation surfaced as parsed:false is honest; the same
// limitation hidden reads as an absence of rules." This file surfaces it twice. First, the fence's
// raw text is always returned verbatim with `parsed:false` (readFormulaFence's `.text`) so a caller
// can read exactly what the server could not evaluate. Second, the seven `width(n) = N` case VALUES
// are extracted as plain text (regex over prose, never vm — nothing here is fed to node:vm) and
// checked against the exact sequence [1,1,1,3,3,3,5] the hand-coded computeWidthM6() below assumes.
// A change to that sequence — a case added, removed, reordered or renumbered — fails the shape
// assertion (EXPECTED_WIDTH_CASE_VALUES, WIDTH_CASE_SHAPE_MISMATCH) BEFORE computeWidthM6() is ever
// reachable, rather than silently computing from stale hand-coded logic. That is what "guarded by a
// shape assertion" means here: the duplication is checked against the source on every read, not
// trusted once and forgotten.
//
// Per ADR-0005 (no silent default): no function below defaults a caller's mode, nodeShape, taskType,
// fanOut or size — each is validated against an enumeration read live from this file (or, for the
// ten-kind vocabulary, the same declared literal modes.mjs carries) and rejected, named, when it
// does not match (D5.3.1/D5.3.2). §M6's own SIZE sentence is treated the same way: reworded, it is a
// HARD ERROR naming the file and the line the server expected it at — never a fallback to the last
// multipliers the server happened to have, because that is precisely how "any reword of that
// sentence silently changes every estimate" (this module's own governing instruction) would happen.
//
// Per ADR-0005 §D5.3.6: no clock, no randomness, anywhere in this file. No Date.now(), no argless
// new Date(), no Math.random(), no process.hrtime, no performance.now(), no process.env read, no
// toLocaleString/Intl formatting, no filesystem timestamp read. §M6:437's byte-identity promise —
// "the same DAG under the same mode yields byte-identical numbers on every run" — is what makes an
// approved ESTIMATE block diffable against actual spend, and one clock read destroys it permanently.
//
// Accumulation is deterministic by construction, not by convention: accumulateTotals() below sums
// its input array in the CALLER'S given order, once, with no sort/reorder anywhere in this file.
// A2/A3 (mcp/correctness-invariant.json D5_4_arithmetic) prove the total is independent of that
// order anyway — every subtotal is a non-negative integer safely under 2^53 — so "deterministic
// order" here means "one declared, auditable order," not "an order the total happens to need."

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Location constants — duplicated from mcp/lib/modes.mjs by design; see file header.
// ---------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url)) // mcp/lib
const DEFAULT_ROOT = path.resolve(HERE, '..', '..') // repo root, two levels up from mcp/lib
const MODES_DOC_REL = path.join('.claude', 'skills', 'loop-engine', 'references', 'execution-modes.md')

// The ten §M8 ROUTES / §M3 kinds. Declared here, not imported (see file header) and not re-derived
// by evaluating §M8 (that would pull node:vm into a module that has no other reason to need it, for
// a fact this module only uses to validate a caller's taskType and a BAND row's split labels — both
// closed, small, ten-element domains). If this ever disagrees with the live §M8 block, §M8 wins
// (ADR-0004 §D4.1) and this array is the defect to fix — identical posture to modes.mjs's own
// MODE_ALIAS note.
const CANONICAL_KINDS = Object.freeze([
  'scout', 'doc', 'implement', 'analyze', 'synthesize', 'verify', 'judge', 'critic', 'gating', 'planner',
])

const PRICEABLE_MODES = Object.freeze(['balanced', 'all-out']) // §M6's BAND table has exactly these
// two columns (:209) and its width(n) rules (:185-194) cover only these two — `lite` has NO §M6
// authority at all (D6.1's liteWidthAuthority: §M8's WIDTH is the SOLE source for lite width, not
// §M6). This module therefore refuses `lite` rather than guessing a value M6 never states.

const M6_NO_LITE_COLUMN_LINE_HINT = 225 // execution-modes.md:225 — the explicit "no lite column,
// deliberately" sentence D6.2's doc fix added. A hint for error messages only; the actual line is
// re-derived from the coordinate walk below, never trusted as a fixed literal for anything but text.

// The seven `width(n) = N` case values, in source order, exactly as they read at
// execution-modes.md:185,186,188,190,192,193,194. This is the shape assertion computeWidthM6()
// below is guarded by — see the file header's "guarded by a shape assertion" paragraph.
const EXPECTED_WIDTH_CASE_VALUES = Object.freeze([1, 1, 1, 3, 3, 3, 5])

const SIZE_KEYS = Object.freeze(['compact', 'standard', 'long-form'])

// A1 (mcp/correctness-invariant.json D5_4_arithmetic.A1_exactRationals): SIZE as exact rationals,
// never as the decimal literal §M6:227 states for a human ("compact ×0.4, standard ×1, long-form
// ×3"). 0.4 is not representable in IEEE-754 binary64; these three pairs are read-then-checked
// against the live sentence in readSizeMultipliers(), never asserted from this constant alone.
const SIZE_RATIONAL = Object.freeze({ compact: [2, 5], standard: [1, 1], 'long-form': [3, 1] })

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
  // each line terminated by a single \n. Byte-identical rule to mcp/lib/modes.mjs's copy.
  const slice = lines.slice(startLine - 1, endLine)
  const bytes = slice.map((l) => l + '\n').join('')
  return crypto.createHash('sha256').update(bytes, 'utf8').digest('hex')
}

// Splits one `| a | b | c |` row into trimmed cells, dropping the outer-pipe empties. No §M6 BAND
// cell contains a literal `|`, so an unescaped-pipe split is exact — same precondition modes.mjs's
// splitTableRow relies on for §M3.
function splitTableRow(line) {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map((c) => c.trim())
}

function normalizeColumnLabel(cell) {
  return cell.replace(/`/g, '').replace(/\*\*/g, '').trim()
}

// ---------------------------------------------------------------------------
// §M6 section locator — coordinate, never a content search (ADR-0004 §D4.2), bounding every other
// locator below to lines between the "## M6." heading and the next "^##\s" heading (or EOF).
// ---------------------------------------------------------------------------

function locateM6Section(root) {
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
    if (/^##\s+M6\./.test(ls[i])) { h = i; break }
  }
  if (h === -1) {
    return { ok: false, code: 'source-heading-missing', error: 'no "## M6." heading in execution-modes.md', file: relPosix(root, file) }
  }

  let end = ls.length
  for (let i = h + 1; i < ls.length; i++) {
    if (/^##\s/.test(ls[i])) { end = i; break }
  }

  return {
    ok: true,
    file: relPosix(root, file),
    allLines: ls,
    section: ls[h].trim(),
    headingLine0: h, // 0-indexed
    sectionStart0: h + 1, // 0-indexed, exclusive of the heading itself
    sectionEnd0: end, // 0-indexed, exclusive — first line of the NEXT heading, or ls.length
  }
}

function citeRange(m6, startLine, endLine) {
  return {
    file: m6.file,
    section: m6.section,
    startLine,
    endLine,
    sha256: sha256OfLines(m6.allLines, startLine, endLine),
  }
}

// ---------------------------------------------------------------------------
// Formula fence — execution-modes.md:179-197, the ONE untagged (no `js`) fence under §M6. Located,
// cited, returned verbatim with parsed:false (ADR-0004 §D4.1), and mined for the width(n) case
// sequence that guards computeWidthM6() below. Never fed to node:vm — it is not JavaScript.
// ---------------------------------------------------------------------------

function locateM6FormulaFence(m6) {
  if (!m6 || !m6.ok) return m6 || { ok: false, code: 'internal', error: 'locateM6Section() result required' }

  let start = -1
  for (let i = m6.sectionStart0; i < m6.sectionEnd0; i++) {
    if (/^```\s*$/.test(m6.allLines[i])) { start = i + 1; break } // bare fence — NOT ```js
  }
  if (start === -1) {
    return { ok: false, code: 'source-fence-missing', error: 'no untagged ``` fence under the §M6 heading in execution-modes.md (expected the agents/items/width/tokens formula block)', file: m6.file }
  }

  let stop = -1
  for (let i = start; i < m6.sectionEnd0; i++) {
    if (/^```\s*$/.test(m6.allLines[i])) { stop = i; break }
  }
  if (stop === -1) {
    return { ok: false, code: 'source-fence-unclosed', error: 'the §M6 formula fence is never closed', file: m6.file }
  }

  const block = m6.allLines.slice(start, stop) // fence content only
  if (!block.length || block[0].trim() === '') {
    return { ok: false, code: 'source-anchor-moved', error: 'the §M6 formula fence is empty', file: m6.file }
  }
  if (!/^agents\s*=\s*Σ\s+over\s+nodes\s+of\s+items\(n\)\s*×\s*width\(n\)\s*$/.test(block[0])) {
    return {
      ok: false,
      code: 'source-anchor-moved',
      error: `the §M6 formula fence must open with "agents = Σ over nodes of items(n) × width(n)"; found ${JSON.stringify(block[0].slice(0, 80))} at ${m6.file}:${start + 1}`,
      file: m6.file,
    }
  }

  const startLine = start + 1 // 1-indexed
  const endLine = stop // 1-indexed, inclusive of the line before the closing fence
  return {
    ok: true,
    text: block.join('\n'),
    parsed: false, // ADR-0004 §D4.1 — the whole fence is pseudo-code and is never parsed as a value
    block,
    startLine0: start,
    citation: citeRange(m6, startLine, endLine),
  }
}

// Extracts the seven `width(n) = N ...` cases from the formula fence's block lines. A case line is
// either the opening `width(n) = N ...` line or a continuation `         = N ...` line (both start,
// after leading whitespace, with `=`); any other non-blank line between the first case and the
// blank line before `tokens(n) = ...` is a WRAPPED DESCRIPTION of the previous case and is appended
// to it, never treated as a new case — exactly how execution-modes.md:186-187, :188-189 and :190-191
// read on disk (one case, two physical lines).
function extractWidthCases(fence, m6) {
  const block = fence.block
  const startIdx = block.findIndex((l) => /^width\(n\)\s*=/.test(l))
  if (startIdx === -1) {
    return { ok: false, code: 'source-shape-changed', error: `no "width(n) = ..." line in the §M6 formula fence (${m6.file}:${fence.citation.startLine}-${fence.citation.endLine})` }
  }

  const cases = []
  let i = startIdx
  for (; i < block.length; i++) {
    const raw = block[i]
    if (raw.trim() === '') break // the blank line before `tokens(n) = ...` ends the enumeration
    const m = /^\s*(?:width\(n\)\s*)?=\s*(\d+)\s*(.*)$/.exec(raw)
    if (m) {
      cases.push({ value: Number(m[1]), text: m[2].trim(), lineStart0: fence.startLine0 + i, lineEnd0: fence.startLine0 + i })
    } else {
      if (!cases.length) {
        return { ok: false, code: 'source-block-uninterpretable', error: `unrecognized line in the §M6 width(n) enumeration at ${m6.file}:${fence.startLine0 + i + 1}: ${JSON.stringify(raw)}` }
      }
      const prev = cases[cases.length - 1]
      prev.text = (prev.text + ' ' + raw.trim()).trim()
      prev.lineEnd0 = fence.startLine0 + i
    }
  }

  const values = cases.map((c) => c.value)
  const shapeOk = values.length === EXPECTED_WIDTH_CASE_VALUES.length && values.every((v, idx) => v === EXPECTED_WIDTH_CASE_VALUES[idx])
  if (!shapeOk) {
    return {
      ok: false,
      code: 'source-shape-changed',
      error: `the §M6 width(n) case sequence is ${JSON.stringify(values)}, expected exactly ${JSON.stringify(EXPECTED_WIDTH_CASE_VALUES)} — computeWidthM6()'s hand-coded cases (mcp/lib/estimate.mjs) assume this exact shape and must be re-derived from execution-modes.md:185-194 before this module answers again`,
      found: values,
      expected: EXPECTED_WIDTH_CASE_VALUES.slice(),
    }
  }

  return {
    ok: true,
    cases: cases.map((c) => ({
      value: c.value,
      text: c.text,
      citation: citeRange(m6, c.lineStart0 + 1, c.lineEnd0 + 1),
    })),
  }
}

// ---------------------------------------------------------------------------
// BAND table — execution-modes.md:209-217. Table parse (ADR-0004 §D4.1), coordinate-located under
// §M6, never a content search. Row labels are split on ' / ' (D6.3 resolver) except the one declared
// flag-selected exception, 'planner on Fable' (§M6:201), which does not split.
// ---------------------------------------------------------------------------

const BAND_CELL_RE = /^(\d+)k–(\d+)k$/ // EN DASH (U+2013), never a plain hyphen-minus — the
// table on disk uses '5k–15k', and a plain '-' appearing here would be a reformat this module must
// not paper over silently (see the row-cell parse failure below).

function parseBandCell(cellText, rowLabel, mode, m6, lineNo) {
  const m = BAND_CELL_RE.exec(cellText.trim())
  if (!m) {
    return {
      ok: false,
      code: 'source-block-uninterpretable',
      error: `§M6 BAND cell for ${JSON.stringify(rowLabel)}/${mode} at ${m6.file}:${lineNo} is ${JSON.stringify(cellText)}, expected the form "<int>k–<int>k" (EN DASH, U+2013)`,
    }
  }
  return { ok: true, low: Number(m[1]) * 1000, high: Number(m[2]) * 1000 }
}

function locateM6BandTable(m6) {
  if (!m6 || !m6.ok) return m6 || { ok: false, code: 'internal', error: 'locateM6Section() result required' }

  const isTableRow = (l) => /^\|.*\|\s*$/.test(l)
  const isSeparatorRow = (l) => /^\|[\s:|-]+\|\s*$/.test(l)

  let headerLine0 = -1
  for (let i = m6.sectionStart0; i < m6.sectionEnd0; i++) {
    if (isTableRow(m6.allLines[i]) && i + 1 < m6.sectionEnd0 && isSeparatorRow(m6.allLines[i + 1])) {
      const cells = splitTableRow(m6.allLines[i])
      if (normalizeColumnLabel(cells[0]) === 'Node kind') { headerLine0 = i; break } // anchor, not a
      // guess: §M6's only OTHER table-shaped construct in range is none — but requiring the exact
      // label keeps this locator honest if that ever changes, same discipline as §M8's anchor line.
    }
  }
  if (headerLine0 === -1) {
    return { ok: false, code: 'source-shape-changed', error: `no "| Node kind | ... |" BAND table found under the §M6 heading in ${m6.file}`, file: m6.file }
  }

  const headerCells = splitTableRow(m6.allLines[headerLine0])
  const dataColumns = headerCells.slice(1).map(normalizeColumnLabel)
  if (dataColumns.length !== 2 || dataColumns.includes('lite') || dataColumns[0] !== 'balanced' || dataColumns[1] !== 'all-out') {
    return {
      ok: false,
      code: 'source-shape-changed',
      error: `§M6 BAND table header at ${m6.file}:${headerLine0 + 1} has data columns ${JSON.stringify(dataColumns)}, expected exactly ["balanced","all-out"] in order (never "lite" — §M6:225 states there is no lite column, deliberately)`,
      found: dataColumns,
    }
  }

  const rows = []
  for (let i = headerLine0 + 2; i < m6.sectionEnd0; i++) {
    const line = m6.allLines[i]
    if (line.trim() === '') break
    if (!isTableRow(line)) break
    rows.push({ line0: i, text: line })
  }
  if (!rows.length) {
    return { ok: false, code: 'source-shape-changed', error: `the §M6 BAND table at ${m6.file}:${headerLine0 + 1} has a header and separator but no data rows`, file: m6.file }
  }

  const parsedRows = []
  const seenKinds = new Set()
  let flagRowSeen = false
  for (const row of rows) {
    const cells = splitTableRow(row.text)
    if (cells.length !== dataColumns.length + 1) {
      return {
        ok: false,
        code: 'source-shape-changed',
        error: `§M6 BAND row at ${m6.file}:${row.line0 + 1} has ${cells.length} cell(s), expected ${dataColumns.length + 1}: ${JSON.stringify(row.text)}`,
      }
    }
    const label = cells[0]
    const isFlagSelected = label === 'planner on Fable' // §M6:201 — "selected by the FLAG, not by
    // the node" and §M6:217's own row does not contain '/'. This is a DECLARED exception (mirroring
    // mcp/lib/modes.mjs's M3_VARIANT_PLANNER_FABLE_REGEX pattern), never inferred from the absence
    // of a '/' — an inferred rule would silently misclassify any future single-kind row.
    const kinds = isFlagSelected ? [] : label.split(' / ').map((s) => s.trim()).filter(Boolean)
    if (!isFlagSelected) {
      if (!kinds.length) {
        return { ok: false, code: 'crosscheck-label-unmapped', error: `§M6 BAND row at ${m6.file}:${row.line0 + 1} has an empty or unparseable label: ${JSON.stringify(label)}` }
      }
      for (const k of kinds) {
        if (!CANONICAL_KINDS.includes(k)) {
          return {
            ok: false,
            code: 'crosscheck-label-unmapped',
            error: `§M6 BAND row at ${m6.file}:${row.line0 + 1} names ${JSON.stringify(k)}, which is not one of the ten canonical kinds ${JSON.stringify(CANONICAL_KINDS)}`,
          }
        }
        seenKinds.add(k)
      }
    } else {
      flagRowSeen = true
    }

    const balancedCell = parseBandCell(cells[1], label, 'balanced', m6, row.line0 + 1)
    if (!balancedCell.ok) return balancedCell
    const allOutCell = parseBandCell(cells[2], label, 'all-out', m6, row.line0 + 1)
    if (!allOutCell.ok) return allOutCell

    parsedRows.push({
      label,
      flagSelected: isFlagSelected,
      kinds,
      balanced: balancedCell,
      allOut: allOutCell,
      citation: citeRange(m6, row.line0 + 1, row.line0 + 1),
    })
  }

  const missingKinds = CANONICAL_KINDS.filter((k) => !seenKinds.has(k))
  if (missingKinds.length) {
    return {
      ok: false,
      code: 'crosscheck-coverage',
      error: `§M6 BAND table rows do not cover every canonical kind — missing ${JSON.stringify(missingKinds)}`,
      details: [{ citation: citeRange(m6, headerLine0 + 1, rows[rows.length - 1].line0 + 1), reading: Array.from(seenKinds) }],
    }
  }
  if (!flagRowSeen) {
    return {
      ok: false,
      code: 'crosscheck-coverage',
      error: `the §M6 BAND table has no "planner on Fable" row — the flag-selected row (§M6:201) is missing`,
      details: [{ citation: citeRange(m6, headerLine0 + 1, rows[rows.length - 1].line0 + 1) }],
    }
  }

  return {
    ok: true,
    modes: dataColumns, // ['balanced', 'all-out'], read live, never hardcoded
    rows: parsedRows,
    citation: citeRange(m6, headerLine0 + 1, rows[rows.length - 1].line0 + 1),
    headerCitation: citeRange(m6, headerLine0 + 1, headerLine0 + 1),
  }
}

// ---------------------------------------------------------------------------
// SIZE multipliers — the single prose sentence at execution-modes.md:227. Sentence parse, not a
// table (ADR-0004 §D4.1's "table" strategy does not literally apply — this is the one §M6 value that
// lives in a sentence rather than a fence or a table — so it gets its own anchored-sentence locator,
// same discipline: coordinate first, exact-shape assertion second, HARD ERROR on any mismatch,
// NEVER a default). This is the exact "HARD ERROR naming the file and the line it expected" clause
// this module's own task names — see readSizeMultipliers()'s two failure branches below.
// ---------------------------------------------------------------------------

// `compact` ×0.4, `standard` ×1, `long-form` ×3 — in that order, each multiplier exact. × is U+00D7
// (multiplication sign), not the ASCII letter 'x'.
const SIZE_SENTENCE_RE = /`compact`\s*×0\.4.*`standard`\s*×1.*`long-form`\s*×3/

function readSizeMultipliers(m6) {
  if (!m6 || !m6.ok) return m6 || { ok: false, code: 'internal', error: 'locateM6Section() result required' }

  let sentenceLine0 = -1
  for (let i = m6.sectionStart0; i < m6.sectionEnd0; i++) {
    if (/^`SIZE`\s/.test(m6.allLines[i])) { sentenceLine0 = i; break }
  }
  if (sentenceLine0 === -1) {
    // HARD ERROR: names the file and the heading it looked under. Never a default — see file header.
    return {
      ok: false,
      code: 'source-anchor-moved',
      error: `expected a "\`SIZE\` — ..." sentence under the "## M6." heading in ${m6.file} (looked at lines ${m6.sectionStart0 + 1}-${m6.sectionEnd0}) and found none — this is the sole source of the compact/standard/long-form multipliers and this module refuses to substitute the last-known values`,
      file: m6.file,
    }
  }

  const line = m6.allLines[sentenceLine0]
  if (!SIZE_SENTENCE_RE.test(line)) {
    // HARD ERROR: names the file and the exact line the sentence was found at, but whose wording no
    // longer matches the expected multiplier clauses. This is the "any reword ... silently changes
    // every estimate" case this module's task explicitly names.
    return {
      ok: false,
      code: 'source-shape-changed',
      error: `the SIZE sentence at ${m6.file}:${sentenceLine0 + 1} no longer reads "\`compact\` ×0.4 ... \`standard\` ×1 ... \`long-form\` ×3" — found ${JSON.stringify(line)}. A reword here silently changes every estimate, so this module refuses rather than guessing at the new multipliers.`,
      file: m6.file,
      foundLine: line,
    }
  }

  // A1 — return the exact rationals, never the decimal literal the sentence states for a human.
  // Cross-check: num/den must equal the decimal the sentence names, for all three, on every read.
  const decimalCheck = { compact: 0.4, standard: 1, 'long-form': 3 }
  for (const key of SIZE_KEYS) {
    const [num, den] = SIZE_RATIONAL[key]
    if (num / den !== decimalCheck[key]) {
      return { ok: false, code: 'internal', error: `SIZE_RATIONAL[${JSON.stringify(key)}] = ${num}/${den} does not equal the published multiplier ${decimalCheck[key]} — the hand-coded rational in mcp/lib/estimate.mjs has drifted from execution-modes.md:${sentenceLine0 + 1}` }
    }
  }

  return {
    ok: true,
    size: SIZE_RATIONAL, // { compact: [2,5], standard: [1,1], 'long-form': [3,1] }
    citation: citeRange(m6, sentenceLine0 + 1, sentenceLine0 + 1),
  }
}

// ---------------------------------------------------------------------------
// Revision note — execution-modes.md:219, "**Revision 2026-07-27** — ...". Cheap, live-parsed rather
// than hardcoded so a stale calibration is visible in the answer (mirrors tool-contracts.json's
// estimate_phase.resultSchema.bandRevision). Optional: absence is reported, never invented.
// ---------------------------------------------------------------------------

function readBandRevision(m6) {
  if (!m6 || !m6.ok) return m6 || { ok: false, code: 'internal', error: 'locateM6Section() result required' }
  for (let i = m6.sectionStart0; i < m6.sectionEnd0; i++) {
    const m = /^\*\*(Revision [0-9-]+)\*\*/.exec(m6.allLines[i])
    if (m) {
      return { ok: true, revision: m[1], citation: citeRange(m6, i + 1, i + 1) }
    }
  }
  return { ok: true, revision: null, citation: null } // absent is legal and reported as such, not an error
}

// ---------------------------------------------------------------------------
// Public: readModesM6 — locate + parse everything §M6 owns, once. Everything below composes on it.
// Stops at the first structural failure (ADR-0005 I2 — exactly ok:true or a named ok:false).
// ---------------------------------------------------------------------------

function readModesM6(options = {}) {
  const root = options.root
  const m6 = locateM6Section(root)
  if (!m6.ok) return m6

  const fence = locateM6FormulaFence(m6)
  if (!fence.ok) return fence

  const widthCases = extractWidthCases(fence, m6)
  if (!widthCases.ok) return widthCases

  const band = locateM6BandTable(m6)
  if (!band.ok) return band

  const size = readSizeMultipliers(m6)
  if (!size.ok) return size

  const revision = readBandRevision(m6)
  if (!revision.ok) return revision

  return {
    ok: true,
    sourceRoot: root ? path.resolve(root) : DEFAULT_ROOT,
    formulaText: fence.text,
    formulaParsed: false, // ADR-0004 §D4.1 — the fence itself is never a parsed value
    formulaCitation: fence.citation,
    widthCases: widthCases.cases, // seven { value, text, citation }, shape-asserted already
    bandRows: band.rows,
    bandModes: band.modes,
    bandCitation: band.citation,
    bandHeaderCitation: band.headerCitation,
    size: size.size,
    sizeCitation: size.citation,
    bandRevision: revision.revision,
    bandRevisionCitation: revision.citation,
  }
}

// ---------------------------------------------------------------------------
// Public: resolveBandKey — §M6:201's flag-selected-row rule (D6.3 step 1), never a value the server
// chose because a lookup failed: the rule is a two-branch total function of (taskType, planner).
// ---------------------------------------------------------------------------

function resolveBandKey({ taskType, planner } = {}) {
  if (taskType === 'planner' && planner === 'fable') return 'planner on Fable'
  return taskType
}

// ---------------------------------------------------------------------------
// Public: lookupBandRow — D6.3 step 2: the unique row whose kinds (or flag-selected identity)
// contains bandKey. Never a fallback to another row — an unmatched key is reported, not guessed
// (e.g. a hypothetical "gating on Fable" bandKey has no row today, per D6.3.1, and MUST fail here
// rather than silently pricing from the plain "gating" row).
// ---------------------------------------------------------------------------

function lookupBandRow(bandRows, bandKey) {
  if (bandKey === 'planner on Fable') {
    const row = bandRows.find((r) => r.flagSelected)
    if (!row) return { ok: false, code: 'not_found', error: '"planner on Fable" band row not found' }
    return { ok: true, row }
  }
  const row = bandRows.find((r) => !r.flagSelected && r.kinds.includes(bandKey))
  if (!row) {
    return { ok: false, code: 'not_found', error: `no §M6 BAND row covers ${JSON.stringify(bandKey)} — the ten canonical kinds are ${JSON.stringify(CANONICAL_KINDS)}, plus the declared "planner on Fable" exception` }
  }
  return { ok: true, row }
}

// ---------------------------------------------------------------------------
// Public: assertPriceableMode — §M6 has authority for balanced/all-out only (see PRICEABLE_MODES
// above). `lite` is refused here, citing the explicit absence sentence (D6.2), never substituted.
// ---------------------------------------------------------------------------

function assertPriceableMode(mode, m6ReadResult) {
  if (PRICEABLE_MODES.includes(mode)) return { ok: true }
  return {
    ok: false,
    code: 'mode_not_priceable',
    error: `mode ${JSON.stringify(mode)} has no §M6 BAND column — only "balanced" and "all-out" are priced (see execution-modes.md around line ${M6_NO_LITE_COLUMN_LINE_HINT}, "There is no \`lite\` column, deliberately")`,
    citation: m6ReadResult && m6ReadResult.ok ? m6ReadResult.sizeCitation : undefined,
  }
}

// ---------------------------------------------------------------------------
// Public: computeItems — §M6:182-183. items(n) = n.fanOut for a known work-list, or
// MAX_ROUNDS × ANGLES.length for a fanOut:"unknown" discovery loop. Never defaults fanOut, maxRounds
// or angles — absence on the "unknown" branch is invalid_argument (mirrors tool-contracts.json
// D3.5_errorEnvelope.codes.invalid_argument's own worked example, verbatim).
// ---------------------------------------------------------------------------

function computeItems(node) {
  const label = node && node.label
  if (node && node.fanOut === 'unknown') {
    const okRounds = Number.isInteger(node.maxRounds) && node.maxRounds >= 1
    const okAngles = Number.isInteger(node.angles) && node.angles >= 1
    if (!okRounds || !okAngles) {
      return {
        ok: false,
        code: 'invalid_argument',
        error: `node ${JSON.stringify(label)} has fanOut:"unknown" and requires maxRounds and angles, both positive integers (§M6:183) — got maxRounds=${JSON.stringify(node.maxRounds)}, angles=${JSON.stringify(node.angles)}`,
      }
    }
    return { ok: true, items: node.maxRounds * node.angles, isUpperBound: true }
  }
  const fanOut = node && node.fanOut === undefined ? 1 : node && node.fanOut
  if (!Number.isInteger(fanOut) || fanOut < 1) {
    return {
      ok: false,
      code: 'invalid_argument',
      error: `node ${JSON.stringify(label)}'s fanOut must be a positive integer or the literal "unknown"; got ${JSON.stringify(node && node.fanOut)}`,
    }
  }
  return { ok: true, items: fanOut, isUpperBound: false }
}

// ---------------------------------------------------------------------------
// Public: computeWidthM6 — the hand-coded arithmetic shape of execution-modes.md:185-194, reachable
// only meaningfully once extractWidthCases()'s shape assertion has passed (readModesM6() enforces
// this by construction: widthCases is absent from its result whenever the assertion fails). Every
// branch below is commented with the exact source line(s) and the caseIndex into widthCases it
// corresponds to, so a reviewer can diff this function against the fence text by eye.
// ---------------------------------------------------------------------------

const NODE_SHAPES = Object.freeze(['adversarial-verify', 'gating-decision', 'deterministic-measurement', 'non-verify'])

function computeWidthM6({ nodeShape, mode, taskType, askIsThorough }, widthCases) {
  if (!NODE_SHAPES.includes(nodeShape)) {
    return { ok: false, code: 'invalid_argument', error: `nodeShape must be one of ${JSON.stringify(NODE_SHAPES)}; got ${JSON.stringify(nodeShape)} — never defaulted from taskType (§M5:141-148, ADR-0006 C1)` }
  }
  if (!PRICEABLE_MODES.includes(mode)) {
    return { ok: false, code: 'mode_not_priceable', error: `mode ${JSON.stringify(mode)} has no §M6 width(n) rule — only "balanced" and "all-out" are covered` }
  }
  if (!widthCases || widthCases.length !== EXPECTED_WIDTH_CASE_VALUES.length) {
    return { ok: false, code: 'internal', error: 'computeWidthM6() called with unshaped widthCases — call readModesM6() first and pass its .widthCases through unchanged' }
  }

  // case 0 — execution-modes.md:185 — "1 for a non-verify node"
  if (nodeShape === 'non-verify') return { ok: true, value: 1, caseIndex: 0, citation: widthCases[0].citation }

  // case 1 — execution-modes.md:186-187 — "1 for a gating DECISION or a deterministic measurement,
  // in BOTH modes (§M5 carve-outs)"
  if (nodeShape === 'gating-decision' || nodeShape === 'deterministic-measurement') {
    return { ok: true, value: 1, caseIndex: 1, citation: widthCases[1].citation }
  }

  // nodeShape === 'adversarial-verify' from here. "correctness-critical/gating VERIFY" (§M6:192,194)
  // is taskType === 'gating' on THIS shape — a gating DECISION never reaches this branch (case 1
  // above already returned for it), matching §M5:141-146's split of taskType:'gating' into two
  // shapes with two different widths.
  const isGatingVerify = taskType === 'gating'

  if (mode === 'balanced') {
    if (isGatingVerify) {
      // case 4 — execution-modes.md:192 — "3, balanced, correctness-critical/gating VERIFY"
      return { ok: true, value: 3, caseIndex: 4, citation: widthCases[4].citation }
    }
    if (typeof askIsThorough !== 'boolean') {
      // §M6:188-191 — this is the one cell where the ask decides (D6.1.2). Absent here is
      // shape-valid but unanswerable — in-band, never a guessed width.
      return {
        ok: false,
        code: 'width_undetermined',
        error: 'askIsThorough is required when mode is "balanced" and nodeShape is "adversarial-verify" on a non-gating node — it selects between execution-modes.md:188-189 (width 1) and :190-191 (width 3)',
        field: 'askIsThorough',
      }
    }
    return askIsThorough
      ? { ok: true, value: 3, caseIndex: 3, citation: widthCases[3].citation } // :190-191
      : { ok: true, value: 1, caseIndex: 2, citation: widthCases[2].citation } // :188-189
  }

  // mode === 'all-out' from here (PRICEABLE_MODES admits only these two)
  if (isGatingVerify) {
    // case 6 — execution-modes.md:194 — "5, all-out mode, correctness-critical/gating VERIFY"
    return { ok: true, value: 5, caseIndex: 6, citation: widthCases[6].citation }
  }
  // case 5 — execution-modes.md:193 — "3, all-out mode, standard verify/judge/critic"
  return { ok: true, value: 3, caseIndex: 5, citation: widthCases[5].citation }
}

// ---------------------------------------------------------------------------
// Public: computeNodeTokens — §M6:196, tokens(n) = agents(n) × BAND[kind][mode] × SIZE[n.size],
// using D5.4's A1/A2 exact-rational, round-at-the-node, integer-domain rule so the total is
// order-independent (A3) and reproducible byte-for-byte (§M6:437) rather than accidentally so.
// ---------------------------------------------------------------------------

function roundHalfUpFraction(numerator, denominator) {
  // round-half-up on the exact rational numerator/denominator, all-integer arithmetic — A2.
  return Math.floor((2 * numerator + denominator) / (2 * denominator))
}

function computeNodeTokens({ agents, bandLow, bandHigh, size }) {
  const rational = SIZE_RATIONAL[size]
  if (!rational) {
    return { ok: false, code: 'invalid_argument', error: `size must be one of ${JSON.stringify(SIZE_KEYS)}; got ${JSON.stringify(size)}` }
  }
  if (!Number.isInteger(agents) || agents < 0 || !Number.isInteger(bandLow) || !Number.isInteger(bandHigh)) {
    return { ok: false, code: 'internal', error: `computeNodeTokens() requires integer agents/bandLow/bandHigh; got ${JSON.stringify({ agents, bandLow, bandHigh })}` }
  }
  const [num, den] = rational
  const lowNumerator = agents * bandLow * num
  const highNumerator = agents * bandHigh * num
  const low = roundHalfUpFraction(lowNumerator, den)
  const high = roundHalfUpFraction(highNumerator, den)
  if (!Number.isSafeInteger(low) || !Number.isSafeInteger(high)) {
    // A4(i) — a violation is `internal`, never a rounded-anyway answer.
    return { ok: false, code: 'internal', error: `token subtotal exceeded Number.isSafeInteger for agents=${agents}, band=[${bandLow},${bandHigh}], size=${JSON.stringify(size)} — arithmetic guard A4 tripped` }
  }
  const exact = lowNumerator % den === 0 && highNumerator % den === 0 // A4(ii) — derived, not defaulted
  return { ok: true, low, high, exact }
}

// ---------------------------------------------------------------------------
// Public: accumulateTotals — sums an array of { agents, low, high } subtotals in the CALLER'S given
// order (no sort, ever — see file header). A3 proves the total does not depend on that order; this
// function still commits to exactly one, auditable order rather than relying on the proof to excuse
// picking one arbitrarily.
// ---------------------------------------------------------------------------

function accumulateTotals(subtotals) {
  let agents = 0
  let low = 0
  let high = 0
  for (const s of subtotals) {
    agents += s.agents
    low += s.low
    high += s.high
    if (!Number.isSafeInteger(agents) || !Number.isSafeInteger(low) || !Number.isSafeInteger(high)) {
      return { ok: false, code: 'internal', error: 'running total exceeded Number.isSafeInteger — arithmetic guard A4 tripped' }
    }
  }
  return { ok: true, agents, low, high }
}

// ---------------------------------------------------------------------------
// Public: estimateNode — composes resolveBandKey + lookupBandRow + computeItems + computeWidthM6 +
// computeNodeTokens for one node under one mode. Stops at the first error (ADR-0005 I2 — exactly
// ok:true or a named ok:false, never a partial per-node result).
// ---------------------------------------------------------------------------

function estimateNode(m6, node, { mode, planner } = {}) {
  if (!m6 || !m6.ok) return m6 || { ok: false, code: 'internal', error: 'readModesM6() result required' }

  const modeCheck = assertPriceableMode(mode, m6)
  if (!modeCheck.ok) return modeCheck

  const taskType = node && node.taskType
  if (typeof taskType !== 'string' || !CANONICAL_KINDS.includes(taskType)) {
    return { ok: false, code: 'unknown_task_kind', error: `unrecognized taskType ${JSON.stringify(taskType)} — the ten valid values are ${CANONICAL_KINDS.join(', ')}` }
  }

  const bandKey = resolveBandKey({ taskType, planner })
  const bandLookup = lookupBandRow(m6.bandRows, bandKey)
  if (!bandLookup.ok) return bandLookup
  const band = mode === 'balanced' ? bandLookup.row.balanced : bandLookup.row.allOut

  const itemsResult = computeItems(node)
  if (!itemsResult.ok) return itemsResult

  const widthResult = computeWidthM6({ nodeShape: node && node.nodeShape, mode, taskType, askIsThorough: node && node.askIsThorough }, m6.widthCases)
  if (!widthResult.ok) return widthResult

  const agents = itemsResult.items * widthResult.value
  if (!Number.isSafeInteger(agents)) {
    return { ok: false, code: 'internal', error: `agents (items × width) exceeded Number.isSafeInteger for node ${JSON.stringify(node && node.label)}` }
  }

  const size = (node && node.size) || 'standard'
  const tokens = computeNodeTokens({ agents, bandLow: band.low, bandHigh: band.high, size })
  if (!tokens.ok) return tokens

  return {
    ok: true,
    label: node.label,
    taskType,
    mode,
    bandKey,
    items: itemsResult.items,
    isUpperBound: itemsResult.isUpperBound,
    width: widthResult.value,
    widthCitation: widthResult.citation,
    agents,
    tokensLow: tokens.low,
    tokensHigh: tokens.high,
    exact: tokens.exact,
    bandCitation: bandLookup.row.citation,
    formulaCitation: m6.formulaCitation,
  }
}

// ---------------------------------------------------------------------------
// Public: estimatePhaseTotals — runs estimateNode over every node, in the CALLER'S given array
// order, for one mode, and accumulates. Stops at the first per-node error rather than returning a
// partial phase total (ADR-0005 I2).
// ---------------------------------------------------------------------------

function estimatePhaseTotals(m6, nodes, { mode, planner } = {}) {
  if (!Array.isArray(nodes) || !nodes.length) {
    return { ok: false, code: 'invalid_argument', error: 'nodes must be a non-empty array' }
  }
  const perNode = []
  for (const node of nodes) {
    const result = estimateNode(m6, node, { mode, planner })
    if (!result.ok) return result
    perNode.push(result)
  }
  const totals = accumulateTotals(perNode.map((n) => ({ agents: n.agents, low: n.tokensLow, high: n.tokensHigh })))
  if (!totals.ok) return totals
  return { ok: true, mode, perNode, total: totals }
}

// ---------------------------------------------------------------------------
export {
  readModesM6,
  resolveBandKey,
  lookupBandRow,
  assertPriceableMode,
  computeItems,
  computeWidthM6,
  computeNodeTokens,
  accumulateTotals,
  estimateNode,
  estimatePhaseTotals,
  // Lower-level locators, exported for testing/reuse — mirrors mcp/lib/modes.mjs's own export style.
  locateM6Section,
  locateM6FormulaFence,
  locateM6BandTable,
  readSizeMultipliers,
  readBandRevision,
  extractWidthCases,
  parseBandCell,
  splitTableRow,
  CANONICAL_KINDS,
  PRICEABLE_MODES,
  NODE_SHAPES,
  SIZE_RATIONAL,
  EXPECTED_WIDTH_CASE_VALUES,
  DEFAULT_ROOT,
}
