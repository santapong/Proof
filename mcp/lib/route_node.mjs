// mcp/lib/route_node.mjs — the route_node MCP tool handler (Phase 3, S1), composed over the
// Phase-2 spine: mcp/lib/modes.mjs (§M3/§M8 — mode resolution, per-kind routing, the literal §M8
// WIDTH() used only as a cross-check per ADR-0006) and mcp/lib/estimate.mjs (§M6 — the width(n)
// case ladder that is actually correct for width, which is the whole reason this tool cannot just
// echo modes.mjs's bare WIDTH()). Adds what neither spine file carries: the D6.1 width structure,
// §M5's DRY_LIMIT, §M4's modifier-A disclosure, and the §M7/§M7b Fable disclosure text.
//
// ============================================================================================
// ARCHITECTURE NOTE — an explicitly disclosed departure from established mcp/lib precedent, and
// the single biggest open question this file raises. READ THIS BEFORE editing the imports below.
// ============================================================================================
//
// mcp/lib/modes.mjs, mcp/lib/estimate.mjs, mcp/lib/boundary.mjs and mcp/lib/standards.mjs each
// state, in their own header comments, that they do NOT import one another, citing ADR-0002 §D2.1
// ("every import specifier reachable from mcp/, not just mcp/server.mjs, must begin with `node:`")
// and the §D2.3.6 grep, which has no carve-out for a relative specifier. Taken fully literally, that
// rule would also forbid THIS file — a tool-handler layer built explicitly ON TOP of the spine —
// from importing either spine module, which would require re-deriving several hundred lines of
// vm-sandboxed §M8 evaluation and §M3 cross-check logic a THIRD time (a fourth, counting
// scripts/validate.mjs's own canonicalBlock()). That is precisely the "eleventh drift site with no
// gate on it" ADR-0004 §C1 rejects, and precisely what ADR-0005 I1 exists to prevent: a value the
// server invented because it declined to reuse the one place the value is correctly derived.
//
// This file's task brief (theloopskill-mcp Phase 3, S1) is explicit and specific: "the Phase-2
// spine you are building on: mcp/lib/{modes,estimate,boundary,standards}.mjs — call the spine,
// never reimplement it." Read together with mcp/lib/estimate.mjs's own comment that
// `readModesM6`/`computeWidthM6` are "exported for testing/reuse", the more defensible reading is
// that D2.1's no-relative-import discipline governs SIBLING spine modules avoiding lateral coupling
// to EACH OTHER (so §M8's authority in modes.mjs and §M6's authority in estimate.mjs each stay
// independently anchored to source, never to a sibling module) — not a blanket prohibition on a
// higher tool-handler layer composing the spine it is explicitly built over.
//
// This file therefore DOES import mcp/lib/modes.mjs and mcp/lib/estimate.mjs via relative
// specifiers. Every OTHER import below is node:-only, per D2.1.
//
// OPEN QUESTION, flagged for review and for whoever builds mcp/server.mjs (S7) and the
// golden-query gate's assertNoDependencies() (ADR-0002 §D2.3.6): if the literal, no-carve-out
// reading of D2.1 is what the gate ends up enforcing, these two relative imports will show up as
// violations, and either (a) ADR-0002 needs a stated carve-out for intra-mcp/lib tool-over-spine
// imports, or (b) the tool layer needs a different composition mechanism than ES module import
// (module-graph inlining, a build step, or literal duplication accepted as the cost). Not resolved
// here — resolving it is a design decision above this task's scope, not a thing to pick silently.
//
// Per ADR-0005 (no silent default): every value below is either read straight through from the
// spine's already-validated result, or located fresh here by the same coordinate-first discipline
// (heading -> bounded section -> fence/blockquote/line, never a tree-wide content search) that
// modes.mjs and estimate.mjs already use for §M8 and §M6. No citation below is a hardcoded line
// number: every one is produced by a regex match against an already coordinate-bounded region, so a
// reformat of execution-modes.md fails loud (source_unparseable) rather than silently citing the
// wrong bytes.

import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

import {
  readModesM8,
  resolveMode,
  routeFor,
  width as m8WidthFor,
  applyPlannerOverride,
  crosscheckM3,
  locateM8,
} from './modes.mjs'

import {
  readModesM6,
  computeWidthM6,
  NODE_SHAPES,
} from './estimate.mjs'

// ---------------------------------------------------------------------------
// Location constants + tiny helpers — duplicated per the established mcp/lib convention (see the
// header notes in modes.mjs / estimate.mjs / boundary.mjs / standards.mjs): small, universal
// helpers are re-declared per file, anchored to the source file rather than to a sibling module.
// ---------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url)) // mcp/lib
const DEFAULT_ROOT = path.resolve(HERE, '..', '..') // repo root, two levels up from mcp/lib
const MODES_DOC_REL = path.join('.claude', 'skills', 'loop-engine', 'references', 'execution-modes.md')
const SERVER_VERSION = '0.1.0'

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
  // D3.2: sha256 of the LF-normalized bytes of lines startLine..endLine inclusive (1-indexed), each
  // line terminated by a single \n. Byte-identical rule to modes.mjs's / estimate.mjs's own copies.
  const slice = lines.slice(startLine - 1, endLine)
  const bytes = slice.map((l) => l + '\n').join('')
  return crypto.createHash('sha256').update(bytes, 'utf8').digest('hex')
}

function resourceUri(file) {
  return `theloopskill://${file}`
}

function withResourceUri(citation) {
  if (!citation) return citation
  return { ...citation, resourceUri: resourceUri(citation.file) }
}

function dedupeCitations(list) {
  const seen = new Set()
  const out = []
  for (const c of list) {
    if (!c) continue
    const key = `${c.file}:${c.startLine}-${c.endLine}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
  }
  return out
}

// ---------------------------------------------------------------------------
// Whole-document read + generic coordinate section locator — used for §M4, §M5 and §M7, none of
// which modes.mjs or estimate.mjs locate (their concerns are §M8 and §M6 respectively). Same
// heading -> bounded-region discipline as modes.mjs's §M8 walk and estimate.mjs's locateM6Section
// (ADR-0004 §D4.2 — coordinate first, never a tree-wide content search).
// ---------------------------------------------------------------------------

function readWholeDoc(root) {
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
  return { ok: true, file: relPosix(root, file), allLines: toLines(text) }
}

function locateSection(doc, headingRegex, boundaryRegex) {
  if (!doc.ok) return doc
  const ls = doc.allLines
  let h = -1
  for (let i = 0; i < ls.length; i++) {
    if (headingRegex.test(ls[i])) { h = i; break }
  }
  if (h === -1) {
    return { ok: false, code: 'source-heading-missing', error: `heading matching ${headingRegex} not found in ${doc.file}`, file: doc.file }
  }
  let end = ls.length
  for (let i = h + 1; i < ls.length; i++) {
    if (boundaryRegex.test(ls[i])) { end = i; break }
  }
  return { ok: true, file: doc.file, allLines: ls, section: ls[h].trim(), headingLine0: h, start0: h + 1, end0: end }
}

function citeRange(sec, startLine, endLine) {
  return { file: sec.file, section: sec.section, startLine, endLine, sha256: sha256OfLines(sec.allLines, startLine, endLine) }
}

// ---------------------------------------------------------------------------
// §M5's own fence — DRY_LIMIT. ADR-0004 §D4.1: DRY_LIMIT's sole authority is §M5's own ```js fence
// (execution-modes.md:152-154), NOT §M8, which does not carry it (confirmed live: modes.mjs's own
// extractWidthLine/extractRoutes never see a DRY_LIMIT line because it is not in the §M8 block).
// Separate locate, separate evaluate, exactly as D4.1's per-symbol authority table requires.
// ---------------------------------------------------------------------------

function locateM5Section(doc) {
  return locateSection(doc, /^##\s+M5\./, /^##\s/)
}

function locateDryLimitFence(m5) {
  if (!m5.ok) return m5
  let start = -1
  for (let i = m5.start0; i < m5.end0; i++) {
    if (/^```js\s*$/.test(m5.allLines[i])) { start = i + 1; break }
  }
  if (start === -1) {
    return { ok: false, code: 'source-fence-missing', error: 'no ```js fence under the §M5 heading in execution-modes.md (expected the DRY_LIMIT line)', file: m5.file }
  }
  let stop = -1
  for (let i = start; i < m5.end0; i++) {
    if (/^```\s*$/.test(m5.allLines[i])) { stop = i; break }
  }
  if (stop === -1) {
    return { ok: false, code: 'source-fence-unclosed', error: 'the §M5 DRY_LIMIT fence is never closed', file: m5.file }
  }
  const block = m5.allLines.slice(start, stop)
  const idx = block.findIndex((l) => /^const DRY_LIMIT\b/.test(l))
  if (idx === -1) {
    return { ok: false, code: 'source-anchor-moved', error: 'no `const DRY_LIMIT = ...` line in the §M5 fence in execution-modes.md', file: m5.file }
  }
  const startLine = start + idx + 1 // 1-indexed
  return { ok: true, line: block[idx], citation: citeRange(m5, startLine, startLine) }
}

function computeDryLimit(dryLimitLine, mode) {
  const ctx = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } })
  // Mirrors modes.mjs's computeWidth() shape: inject the already-resolved, already-validated MODE
  // ahead of the located line and evaluate in a frozen null-prototype sandbox with a timeout.
  const src = `const MODE = ${JSON.stringify(mode)};\n${dryLimitLine}\n;DRY_LIMIT`
  let result
  try {
    result = vm.runInContext(src, ctx, { timeout: 1000, displayErrors: true })
  } catch (e) {
    return { ok: false, code: 'source-block-uninterpretable', error: `DRY_LIMIT evaluation failed: ${e.message}` }
  }
  if (typeof result !== 'number' || !Number.isInteger(result)) {
    return { ok: false, code: 'source-block-uninterpretable', error: `DRY_LIMIT did not evaluate to an integer (got ${JSON.stringify(result)})` }
  }
  return { ok: true, dryLimit: result }
}

// §M5:150 — the dispatch-shape sentence, cited when the effective width is >= 3.
function readDispatchClause(m5) {
  if (!m5.ok) return { ok: false }
  for (let i = m5.start0; i < m5.end0; i++) {
    if (/dispatch same-model verify fan-outs of width/.test(m5.allLines[i])) {
      return {
        ok: true,
        text: 'Templates dispatch same-model verify fan-outs of width ≥ 3 staggered or sequentially — the vote is over verdicts, not wall-clock, and a same-model width-5 all-out burst dispatched all at once has died whole to API 529 overload before.',
        citation: citeRange(m5, i + 1, i + 1),
      }
    }
  }
  return { ok: false }
}

// ---------------------------------------------------------------------------
// §M4 — modifier A's active / disabled-logged state, and the log() line all-out mode must emit.
// ---------------------------------------------------------------------------

function locateM4Section(doc) {
  return locateSection(doc, /^##\s+M4\./, /^##\s/)
}

function locateModifierAClause(m4) {
  if (!m4.ok) return m4
  let stateLine = -1
  for (let i = m4.start0; i < m4.end0; i++) {
    if (/^\*\*Modifier A/.test(m4.allLines[i])) { stateLine = i; break }
  }
  if (stateLine === -1) {
    return { ok: false, code: 'source-anchor-moved', error: 'no "**Modifier A" clause under §M4 in execution-modes.md', file: m4.file }
  }
  let logLine = -1
  for (let i = stateLine; i < m4.end0; i++) {
    if (/^\*\*Modifier B/.test(m4.allLines[i])) break
    if (/^log\(`modifier-A/.test(m4.allLines[i])) { logLine = i; break }
  }
  return {
    ok: true,
    stateText: m4.allLines[stateLine].trim(),
    stateCitation: citeRange(m4, stateLine + 1, stateLine + 1),
    logText: logLine === -1 ? null : m4.allLines[logLine].trim(),
    logCitation: logLine === -1 ? null : citeRange(m4, logLine + 1, logLine + 1),
  }
}

// ---------------------------------------------------------------------------
// §M7 — the two mandatory-disclosure blockquotes, read LIVE, never hardcoded (ADR-0005 I1), located
// by anchor text within the already coordinate-bounded §M7 region — same discipline modes.mjs's
// crosscheckM3 already uses for §M3's rows (bounded scan, never a tree-wide search).
// ---------------------------------------------------------------------------

function locateM7Section(doc) {
  return locateSection(doc, /^##\s+M7\./, /^##\s/)
}

function extractBlockquote(m7, anchorRegex) {
  if (!m7.ok) return m7
  for (let i = m7.start0; i < m7.end0; i++) {
    if (anchorRegex.test(m7.allLines[i])) {
      return { ok: true, text: m7.allLines[i].replace(/^>\s?/, ''), citation: citeRange(m7, i + 1, i + 1) }
    }
  }
  return { ok: false, code: 'source-anchor-moved', error: `no blockquote line matching ${anchorRegex} found under §M7 in execution-modes.md`, file: m7.file }
}

function readM7aDisclosure(m7) {
  return extractBlockquote(m7, /^>\s*`--planner fable`\s+routes the decompose node/)
}

function readM7bDisclosure(m7) {
  return extractBlockquote(m7, /^>\s*`--fable-gate`\s+routes one lens/)
}

// ---------------------------------------------------------------------------
// Envelope constants (ADR-0003 §D3.6, §D3.8; ADR-0006 §D6.1.3).
// ---------------------------------------------------------------------------

const TEMPLATE_RULE =
  'Authoring-time answer. Do NOT write these values into the template as literals: scripts/validate.mjs check 5 fails any bare model:/effort: literal outside the ROUTES block (CONTRIBUTING.md:77). Carry the canonical §M8 block verbatim and let optsFor(node, label) compute this at run time. Copy the block from execution-modes.md and prove it with `node scripts/validate.mjs`.'

const DEPRECATION_MESSAGE =
  'The v1.1 mode names are a deprecated compatibility shim (§M9.6). Prefer lite|balanced|all-out; the aliases are removed in the next major.'

const FALLBACK_TEXT =
  'Read .claude/skills/loop-engine/references/execution-modes.md §M3 (:77) for the routing table and §M5 (:126) for width, and copy the §M8 block (:303) verbatim. This is the instruction those two files already carry; the tool changes nothing about it.'

const PLANNER_VALUES = Object.freeze(['opus', 'fable'])

// ---------------------------------------------------------------------------
// Input validation — ADR-0005 D5.2's precondition, enforced in code because ADR-0001's hand-rolled
// zero-dependency server supplies no JSON-Schema validation of its own: the enum tool-contracts.json
// advertises is documentation until something actually checks it. Absence of an OPTIONAL field is
// legal and takes the declared default (never an error); presence of an unrecognized value is always
// an error naming the valid set, never a guess (ADR-0005 D5.3.1). A missing REQUIRED field
// (taskType, nodeShape — ADR-0006 §D6.1.1: nodeShape is required and NEVER defaulted from taskType)
// is a shape violation and maps to JSON-RPC -32602 per ADR-0003 §D3.5's protocolSeam, not the
// in-band isError envelope — represented here as a distinct `{protocolError:true}` shape so the
// eventual JSON-RPC shell (S7) can tell the two seams apart without parsing message text.
// ---------------------------------------------------------------------------

function protocolError(field, message) {
  return { protocolError: true, jsonRpcCode: -32602, field, message }
}

function validateInput(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return protocolError(null, 'route_node requires an object argument')
  }
  if (typeof input.taskType !== 'string') {
    return protocolError('taskType', 'taskType is required and must be a string — the ten valid values are scout, doc, implement, analyze, synthesize, verify, judge, critic, gating, planner')
  }
  if (input.nodeShape === undefined || input.nodeShape === null) {
    return protocolError('nodeShape', `nodeShape is required — one of ${JSON.stringify(NODE_SHAPES)} (§M5:141-148: "DECIDED — what width applies to"). It is never defaulted from taskType: taskType:'gating' alone does not say whether this is the DECISION shape (width 1 in every mode) or the VERIFY shape (width 3 balanced / 5 all-out) — ADR-0006 §C1.`)
  }
  if (typeof input.nodeShape !== 'string' || !NODE_SHAPES.includes(input.nodeShape)) {
    return protocolError('nodeShape', `nodeShape must be one of ${JSON.stringify(NODE_SHAPES)}; got ${JSON.stringify(input.nodeShape)}`)
  }
  if (input.mode !== undefined && input.mode !== null && typeof input.mode !== 'string') {
    return protocolError('mode', `mode must be a string; got ${typeof input.mode}`)
  }
  if (input.planner !== undefined && !PLANNER_VALUES.includes(input.planner)) {
    return protocolError('planner', `planner must be one of ${JSON.stringify(PLANNER_VALUES)}; got ${JSON.stringify(input.planner)}`)
  }
  if (input.fableGate !== undefined && typeof input.fableGate !== 'boolean') {
    return protocolError('fableGate', `fableGate must be a boolean; got ${typeof input.fableGate}`)
  }
  if (input.askIsThorough !== undefined && typeof input.askIsThorough !== 'boolean') {
    return protocolError('askIsThorough', `askIsThorough must be a boolean; got ${typeof input.askIsThorough}`)
  }
  if (input.declaredLenses !== undefined && !(Number.isInteger(input.declaredLenses) && input.declaredLenses >= 0)) {
    return protocolError('declaredLenses', `declaredLenses must be a non-negative integer; got ${JSON.stringify(input.declaredLenses)}`)
  }
  if (input.includeCanonicalBlock !== undefined && typeof input.includeCanonicalBlock !== 'boolean') {
    return protocolError('includeCanonicalBlock', `includeCanonicalBlock must be a boolean; got ${typeof input.includeCanonicalBlock}`)
  }
  return { ok: true }
}

// Maps ADR-0004's fine-grained structural/semantic internal codes onto ADR-0003 §D3.5's CLOSED
// public error-code enum (invalid_argument | unknown_mode | not_found | source_missing |
// source_unparseable | gate_unavailable | internal). OPEN QUESTION, disclosed rather than papered
// over: D4.5's semantic-tier codes (crosscheck-disagreement, crosscheck-coverage,
// crosscheck-label-unmapped, crosscheck-columns-changed, mode-vocabulary-changed,
// kind-vocabulary-changed) have NO member in D3.5's closed enum — D5's and D6's
// requiredAdditionsToD3Enum add exactly three codes (unknown_task_kind, width_undetermined,
// mode_not_priceable) and none of them is a cross-check code. Until D3.5's enum is amended with a
// dedicated code, `internal` is the closest sanctioned catch-all; nothing is actually lost, because
// the specific ADR-0004 code, both readings and both citations survive in `message`/`details`.
function mapStructuralOrCrosscheckCode(internalCode) {
  if (internalCode === 'source-missing') return 'source_missing'
  if (internalCode === 'unknown_task_kind' || internalCode === 'unknown_mode' || internalCode === 'width_undetermined' || internalCode === 'invalid_argument') {
    return internalCode
  }
  if (
    internalCode === 'source-heading-missing' ||
    internalCode === 'source-fence-missing' ||
    internalCode === 'source-fence-unclosed' ||
    internalCode === 'source-anchor-moved' ||
    internalCode === 'source-block-uninterpretable' ||
    internalCode === 'source-shape-changed'
  ) {
    return 'source_unparseable'
  }
  return 'internal' // crosscheck-*, mode-vocabulary-changed, kind-vocabulary-changed — see note above
}

function structuralError({ sourceRoot, internalResult, citations = [], fixText, fallbackText }) {
  return {
    ok: false,
    tool: 'route_node',
    authoringTimeOnly: true,
    serverVersion: SERVER_VERSION,
    sourceRoot,
    citations,
    deprecations: [],
    notes: [],
    error: {
      code: mapStructuralOrCrosscheckCode(internalResult.code),
      message: internalResult.error,
      fix: fixText,
      details: internalResult.details,
      fallback: fallbackText || FALLBACK_TEXT,
    },
  }
}

// ---------------------------------------------------------------------------
// Public: routeNode — the route_node tool handler. Composes the spine (modes.mjs for §M3/§M8,
// estimate.mjs for §M6's width(n) ladder) plus this file's own §M4/§M5/§M7 locators into the
// ADR-0003 §D3.6 envelope as amended by ADR-0006 §D6.1-§D6.4. Stops at the first error rather than
// returning a partial result (ADR-0005 I2 — exactly ok:true or a named ok:false).
// ---------------------------------------------------------------------------

function routeNode(rawInput, options = {}) {
  const root = options.root
  const sourceRoot = resolveRoot(root)

  const validation = validateInput(rawInput)
  if (validation.protocolError) return validation // -32602 seam — never the isError envelope
  const input = rawInput

  // --- §M8: locate + evaluate ROUTES/WIDTH, live, every call (ADR-0005 §D5.3.7 — no caching) ---
  const m8 = readModesM8({ root })
  if (!m8.ok) {
    return structuralError({
      sourceRoot,
      internalResult: m8,
      citations: [], // OPEN QUESTION: D3.1 requires citations minItems:1 on both branches ("an
      // error with no citation is indistinguishable from the server not having tried"), but a
      // totally unreadable source file has no real bytes to cite a sha256 over. Fabricating a hash
      // would be a silent default in the exact sense ADR-0005 I1 forbids. Left empty and disclosed
      // rather than faked; ADR-0002's degrade-not-die C4/C6 message is what actually reaches the
      // user in this case, at the server layer (S7), not here.
      fixText: 'set THELOOPSKILL_ROOT to a TheLoopSkill checkout, or correct the server path in .mcp.json',
    })
  }

  // --- ADR-0004 §D4.5 semantic tier: §M3 vs §M8 disagreement fails the WHOLE call. Never resolved
  // by precedence at call time (ADR-0005 §D5.3.4). Runs before taskType-specific work because a
  // disagreement anywhere in the ten-kind table means the reader of either file is misinformed,
  // regardless of which kind was asked about. ---
  const cross = crosscheckM3(m8, { root })
  if (!cross.ok) {
    const crossCitations = (cross.details || [])
      .flatMap((d) => (d.citations ? d.citations : d.citation ? [d.citation] : []))
      .map(withResourceUri)
    return structuralError({
      sourceRoot,
      internalResult: cross,
      citations: crossCitations.length ? dedupeCitations(crossCitations) : [withResourceUri(m8.citation)],
      fixText: cross.fix,
      fallbackText: 'Do not trust either file in isolation until this is fixed. Read .claude/skills/loop-engine/references/execution-modes.md §M3 (:77) AND §M8 (:303) and compare them by hand.',
    })
  }

  // --- mode: accept five, advertise three, canonicalize, reject an unrecognized value naming the
  // three (§M2:59, ADR-0005 §D5.3.1). Absence is the declared default, not a failed lookup. ---
  const modeResult = resolveMode(input.mode, m8.modes)
  if (!modeResult.ok) {
    return {
      ok: false,
      tool: 'route_node',
      authoringTimeOnly: true,
      serverVersion: SERVER_VERSION,
      sourceRoot,
      citations: [withResourceUri(m8.citation)],
      deprecations: [],
      notes: [],
      error: {
        code: 'unknown_mode',
        message: modeResult.error,
        fix: `pass one of ${modeResult.valid.join(', ')} (or omit mode for the balanced default)`,
        fallback: 'Read .claude/skills/loop-engine/references/execution-modes.md §M2:59 for the mode grammar.',
      },
    }
  }
  const mode = modeResult.mode

  // --- taskType: validated against the ten keys READ FROM §M8, not a hardcoded literal. An
  // unrecognized taskType is FLAGGED, never silently resolved through §M8:351's
  // `|| ROUTES[MODE].analyze` fallback arm (ADR-0005 §D5.3.2 — that arm stays intact in the block
  // for the 27 templates that need it, and is unreachable from this server). ---
  const routeResult = routeFor(m8.routes, mode, input.taskType, m8.kinds)
  if (!routeResult.ok) {
    return {
      ok: false,
      tool: 'route_node',
      authoringTimeOnly: true,
      serverVersion: SERVER_VERSION,
      sourceRoot,
      citations: [withResourceUri(m8.citation)],
      deprecations: [],
      notes: [],
      error: {
        code: 'unknown_task_kind',
        message: routeResult.error,
        fix: `pass one of ${routeResult.valid.join(', ')}`,
        fallback: 'Read .claude/skills/loop-engine/references/execution-modes.md §M3 (:77) for the ten node kinds.',
      },
    }
  }

  const planner = input.planner === undefined ? 'opus' : input.planner
  // §M7a — planner-node-only override: optsFor() applies PLANNER only when node.taskType==='planner'
  // (§M8:360) and applyPlannerOverride() mirrors that scope exactly; on any other taskType this is a
  // pure pass-through, and the inertness is disclosed below rather than silently doing nothing.
  const withPlanner = applyPlannerOverride(routeResult, input.taskType, planner)

  // --- §M8's bare WIDTH(kind) — used ONLY as the D6.1.3 cross-check pair (m8WidthWouldSay /
  // agreesWithM8), never as the tool's own answer (ADR-0006 §C1: WIDTH is a partial function whose
  // domain is adversarial-verify nodes; §M5/§M6 are the general answer). ---
  const m8WidthResult = m8WidthFor(m8.widthLine, mode, input.taskType, m8.kinds)
  if (!m8WidthResult.ok) {
    return structuralError({ sourceRoot, internalResult: m8WidthResult, citations: [withResourceUri(m8.citation)], fixText: 'restore the `const WIDTH = ...` line in execution-modes.md §M8' })
  }

  const citations = [withResourceUri(m8.citation)]
  const notes = []
  const deprecations = []

  // --- §M4, §M5, §M7 — this file's own locators (neither spine module reads these sections). ---
  const doc = readWholeDoc(root)
  if (!doc.ok) {
    return structuralError({ sourceRoot, internalResult: doc, citations, fixText: 'set THELOOPSKILL_ROOT to a TheLoopSkill checkout, or correct the server path in .mcp.json' })
  }
  const m4sec = locateM4Section(doc)
  const m5sec = locateM5Section(doc)
  const m7sec = locateM7Section(doc)

  // --- D6.1: width as a structure, never a bare integer. `lite` has no §M5/§M6 authority at all
  // (D6's liteWidthAuthority): §M8's WIDTH is the SOLE source there, and it is 1 for every kind. ---
  let widthValue
  let widthCitation
  let governingClauseText

  if (mode === 'lite') {
    widthValue = m8WidthResult.width
    widthCitation = withResourceUri(m8.citation)
    governingClauseText =
      "lite has no §M5/§M6 width authority — neither table carries a `lite` column (measured: §M5's width table and §M6's BAND table both have exactly two data columns, `balanced` and `all-out`). execution-modes.md §M8's `const WIDTH = (kind) => ...` line is therefore the SOLE source for lite width, and it evaluates to 1 for every kind (ADR-0006 §D6.1 liteWidthAuthority)."
  } else {
    const m6 = readModesM6({ root })
    if (!m6.ok) {
      return structuralError({ sourceRoot, internalResult: m6, citations, fixText: "restore execution-modes.md §M6's width(n) formula fence" })
    }
    const wm6 = computeWidthM6({ nodeShape: input.nodeShape, mode, taskType: input.taskType, askIsThorough: input.askIsThorough }, m6.widthCases)
    if (!wm6.ok) {
      if (wm6.code === 'width_undetermined') {
        return {
          ok: false,
          tool: 'route_node',
          authoringTimeOnly: true,
          serverVersion: SERVER_VERSION,
          sourceRoot,
          citations: dedupeCitations([...citations, withResourceUri(m6.formulaCitation)]),
          deprecations: [],
          notes: [],
          error: {
            code: 'width_undetermined',
            message: wm6.error,
            fix: 'pass askIsThorough:true or askIsThorough:false',
            details: [{ field: 'askIsThorough', issue: wm6.error }],
            fallback: 'Read .claude/skills/loop-engine/references/execution-modes.md §M6:188-191 and decide by hand whether the ask is thorough / audit / comprehensive.',
          },
        }
      }
      return structuralError({
        sourceRoot,
        internalResult: wm6,
        citations,
        fixText: 'confirm nodeShape and mode, or restore execution-modes.md §M6\'s width(n) case ladder (:185-194)',
      })
    }
    widthValue = wm6.value
    widthCitation = withResourceUri(wm6.citation)
    const wc = m6.widthCases[wm6.caseIndex]
    governingClauseText = `width(n) = ${wc.value} ${wc.text}`.replace(/\s+/g, ' ').trim()
  }

  const effective = input.declaredLenses !== undefined ? Math.min(widthValue, input.declaredLenses) : widthValue
  const cappedBy = input.declaredLenses !== undefined && input.declaredLenses < widthValue ? 'declared-lenses' : null
  const agreesWithM8 = widthValue === m8WidthResult.width
  citations.push(widthCitation)

  if (!agreesWithM8) {
    notes.push(
      `width disagrees with the literal §M8 WIDTH('${input.taskType}') under mode '${mode}': the §M5/§M6-correct width is ${widthValue} (width.value), but the ROUTES block's own WIDTH() function would compute ${m8WidthResult.width} (width.m8WidthWouldSay). This is a KNOWN, disclosed gap, not a bug in this answer — ADR-0006 §C1/§C2: WIDTH's domain is adversarial-verify nodes only and it is wrong when called outside that domain, which is exactly what four live template call sites do today (loop-orchestrate/templates/project-plan.workflow.js:290,420 and loop-build/templates/v1-conductor.workflow.js:208,332, both in their cast-ledger and JSON-ledger rows). This tool reports the §M5/§M6-correct value in width.value and the literal block's answer in width.m8WidthWouldSay precisely so the two can be told apart.`
    )
  }

  let dispatchRule
  if (effective >= 3) {
    const disp = readDispatchClause(m5sec)
    if (disp.ok) {
      dispatchRule = disp.text
      citations.push(withResourceUri(disp.citation))
    }
  }

  const width = {
    value: widthValue,
    effective,
    shape: input.nodeShape,
    governingClause: { text: governingClauseText, citation: widthCitation },
    cappedBy,
    m8WidthWouldSay: m8WidthResult.width,
    agreesWithM8,
  }
  if (dispatchRule !== undefined) width.dispatch = dispatchRule

  // --- §M5's DRY_LIMIT — separate authority, separate locate (ADR-0004 §D4.1). ---
  const dryFence = locateDryLimitFence(m5sec)
  if (!dryFence.ok) {
    return structuralError({ sourceRoot, internalResult: dryFence, citations, fixText: "restore execution-modes.md §M5's `const DRY_LIMIT = ...` fence" })
  }
  const dryComputed = computeDryLimit(dryFence.line, mode)
  if (!dryComputed.ok) {
    return structuralError({ sourceRoot, internalResult: dryComputed, citations, fixText: "restore execution-modes.md §M5's `const DRY_LIMIT = ...` line" })
  }
  citations.push(withResourceUri(dryFence.citation))
  const dryLimit = dryComputed.dryLimit

  // --- §M4's modifier A — active in lite/balanced, disabled-and-logged in all-out. ---
  const modClause = locateModifierAClause(m4sec)
  if (!modClause.ok) {
    return structuralError({ sourceRoot, internalResult: modClause, citations, fixText: "restore execution-modes.md §M4's Modifier A clause" })
  }
  const modifierA = mode === 'all-out' ? 'disabled-logged' : 'active'
  citations.push(withResourceUri(modClause.stateCitation))
  if (modifierA === 'disabled-logged' && modClause.logText) {
    citations.push(withResourceUri(modClause.logCitation))
    notes.push(`§M4: modifier A is disabled in all-out mode and the suppression MUST be log()ged so a transcript reader can tell a wide fan-out ran at full tier by design, not by oversight. Template line: ${modClause.logText}`)
  }

  // --- §M7a `--planner fable` — planner-node-only override; §M7b `--fable-gate` — legal only under
  // all-out and only lens 0 of a gating VERIFY fan-out. Both disclosures are printed VERBATIM,
  // located live, when the flag is actually live; both are reported as inert (never silently
  // dropped) when the precondition that would make them live is not met. ---
  if (planner === 'fable') {
    if (input.taskType === 'planner') {
      const m7a = readM7aDisclosure(m7sec)
      if (m7a.ok) {
        citations.push(withResourceUri(m7a.citation))
        notes.push(`§M7 mandatory disclosure (printed verbatim, before the planner spawns): ${m7a.text}`)
      } else {
        notes.push(`planner:'fable' is live on this planner node, but the §M7 disclosure text could not be extracted live: ${m7a.error}`)
      }
    } else {
      notes.push(`planner:'fable' is inert on a '${input.taskType}' node — §M8's optsFor() applies the PLANNER override only to taskType:'planner' nodes ("Affects taskType:'planner' nodes and nothing else"). route.model/route.effort above are this node's ordinary ${mode} routing, unaffected by the flag.`)
    }
  }

  if (input.fableGate === true) {
    if (mode !== 'all-out') {
      notes.push("fableGate is inert outside --mode all-out (§M2:61): \"legal only under --mode all-out: anywhere else it is accepted, ignored, and log()ged as inert\" — because the width-3-or-wider majority vote it depends on does not exist in the cheaper modes (§M7b).")
    } else if (!(input.taskType === 'gating' && input.nodeShape === 'adversarial-verify')) {
      notes.push(`fableGate only applies to one lens of a gating VERIFY fan-out (§M7b precondition 2: "Exactly one lens of one gating VERIFY fan-out — never a majority, never a second node, never a decision or measurement node"). This node is taskType:'${input.taskType}' / nodeShape:'${input.nodeShape}', so the flag has no effect here.`)
    } else {
      const m7b = readM7bDisclosure(m7sec)
      if (m7b.ok) {
        citations.push(withResourceUri(m7b.citation))
        notes.push(`§M7b mandatory disclosure (printed verbatim, before the fan-out spawns): ${m7b.text}`)
        notes.push(`This applies to exactly lens index 0 of the ${effective}-wide fan-out — §M8's fableGateAgent(): "if (!FABLE_GATE || lensIndex !== 0) return agent(prompt, opts)". The other ${Math.max(effective - 1, 0)} lens(es) run this node's ordinary route.model/route.effort (claude-opus-5, unaffected); route above describes the node's default routing, not the lens-0 override.`)
      } else {
        notes.push(`fableGate is live on this all-out gating-verify node, but the §M7b disclosure text could not be extracted live: ${m7b.error}`)
      }
    }
  }

  // --- deprecations[] — the alias echo (D3.3): the SUPPLIED alias appears only here, never as
  // result.mode's value. Cited against the `const MODE_ALIAS = ...` line inside the already-located
  // §M8 block (coordinate-bounded scan, not a hardcoded line number). ---
  if (modeResult.alias) {
    const m8loc = locateM8(root)
    let aliasCitation = withResourceUri(m8.citation)
    if (m8loc.ok) {
      const idx = m8loc.block.findIndex((l) => /^const MODE_ALIAS\b/.test(l))
      if (idx !== -1) {
        const absLine = m8loc.startLine + idx
        aliasCitation = withResourceUri(citeRange({ file: m8loc.file, section: m8loc.section, allLines: m8loc.allLines }, absLine, absLine))
      }
    }
    citations.push(aliasCitation)
    deprecations.push({
      field: 'mode',
      supplied: modeResult.supplied,
      canonical: modeResult.mode,
      removedIn: 'next major',
      message: DEPRECATION_MESSAGE,
      citation: aliasCitation,
    })
  }

  // --- opts — exactly the keys optsFor() would set, omitted keys ABSENT rather than null. ---
  const opts = {}
  if (withPlanner.model) opts.model = withPlanner.model
  if (withPlanner.effort) opts.effort = withPlanner.effort

  const result = {
    mode,
    planner,
    route: { model: withPlanner.model, effort: withPlanner.effort, pinning: withPlanner.pinning },
    opts,
    width,
    dryLimit,
    modifierA,
    templateRule: TEMPLATE_RULE,
  }
  if (dispatchRule !== undefined) result.dispatchRule = dispatchRule
  if (input.includeCanonicalBlock) {
    result.canonicalBlock = {
      text: m8loc_block_text(m8, root),
      sha256: m8.citation.sha256,
      citation: withResourceUri(m8.citation),
    }
  }

  return {
    ok: true,
    tool: 'route_node',
    authoringTimeOnly: true,
    serverVersion: SERVER_VERSION,
    sourceRoot,
    result,
    citations: dedupeCitations(citations),
    deprecations,
    notes,
  }
}

// Small helper kept at the bottom so routeNode() above reads top-to-bottom without a forward
// reference: re-locates §M8 (cheap — 1.98ms measured by ADR-0004 §C5) to get the block TEXT for
// includeCanonicalBlock. Not folded into the earlier `m8` read because readModesM8() intentionally
// does not expose the raw block text (only routes/widthLine/citation) — locateM8() is the one that
// does, and it is already exported by modes.mjs for exactly this kind of reuse.
function m8loc_block_text(m8, root) {
  const loc = locateM8(root)
  if (loc.ok) return loc.block.join('\n')
  // Extremely unlikely (m8 already succeeded moments ago and nothing re-reads the file in between
  // except this call), but per ADR-0005 I2 never silently substitute — fall back to an empty string
  // is wrong too, so surface the mismatch in the text itself rather than hide it.
  return `<< could not re-read the §M8 block for includeCanonicalBlock: ${loc.error} >>`
}

// ---------------------------------------------------------------------------
// node -e 'import("./mcp/lib/route_node.mjs").then(m => console.log(JSON.stringify(m.routeNode({taskType:"scout", nodeShape:"non-verify"}), null, 2)))'
// (double-quoted specifier above deliberately, so this doc comment does not itself match
// ADR-0002 §D2.3.6's assertNoDependencies() grep for a single-quoted import(...) specifier)
// ---------------------------------------------------------------------------

export {
  routeNode,
  validateInput,
  mapStructuralOrCrosscheckCode,
  locateM4Section,
  locateM5Section,
  locateM7Section,
  locateModifierAClause,
  locateDryLimitFence,
  computeDryLimit,
  readM7aDisclosure,
  readM7bDisclosure,
  readDispatchClause,
  DEFAULT_ROOT,
  TEMPLATE_RULE,
  DEPRECATION_MESSAGE,
  FALLBACK_TEXT,
}
