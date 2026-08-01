// mcp/lib/resources.mjs — the read-only MCP resource layer (Phase 3, S6): resources/list and
// resources/read over the skill tree the five tools parse, per ADR-0003 §D3.7.
//
// This module is NOT a tool handler (no envelope, no citations[], no `tool:` field — D3.7's own
// hardRules: "A missing file is an MCP resource error, NOT the isError tool envelope — that
// envelope is a tools/call shape and does not exist on resources/read"). It has no spine to compose
// (unlike route_node/estimate_phase/boundary_lookup/standards_shelf), because its job is not to
// extract structured data out of a source doc — it is to serve the doc's own bytes back, verified.
//
// ============================================================================================
// THE URI SCHEME AND WHY IT IS NOT DECODED INTO A PATH
// ============================================================================================
//
// heimdall://<repo-relative-posix-path> — chosen over file:// per D3.7 ("A file:// URI hardcodes
// an absolute machine-specific path into every citation ... two checkouts disagree about the
// identity of the same file"). Every citation the four parsing tools already emit
// (mcp/lib/boundary.mjs:212, mcp/lib/route_node.mjs's resourceUri(), etc.) already builds this exact
// string — `heimdall://${relPosix}` — so this module's URIs are byte-identical to what a caller
// already holds from a tool answer; there is no separate encoding to reconcile.
//
// This task's brief is explicit about the security shape: "Build the served set by walking the tree
// at startup into an explicit allow-list keyed by URI rather than decoding arbitrary URIs into
// paths." So readResource() below never strips the scheme prefix off a caller-supplied URI and joins
// the remainder onto sourceRoot. It does the opposite: buildResourceIndex() walks the real
// filesystem first, and every URI that will ever be recognized is MINTED by this module from a file
// it already found — never accepted from outside and turned into a path. A lookup is then an exact
// string match against that self-minted set. A URI this module never produced — a traversal attempt,
// a scripts/*.mjs path (excluded from the surface), a percent-encoded variant, anything — simply
// is not a KEY in the map, and comes back not_found without ever touching fs with caller input.
// "Guard anyway" (the brief's own words) is the second, independent layer below: every entry's real
// path is re-verified against the root's real path with path.relative()/path.isAbsolute() at BOTH
// index-build time and read time, so a TOCTOU swap between the two is caught too.
//
// ============================================================================================
// D3 RESOURCE-SURFACE DECISION — docs/design/boundary-audit.json joins; the C4 set and the rest of
// docs/design/ do not. This is the one point this task's brief asks S6 to decide; see the file-
// bottom comment "DECISION RATIONALE" for the full reasoning and the measured counts behind it.
// ============================================================================================
//
// Per ADR-0002 §D2.1, every import specifier reachable from mcp/ must begin with `node:` — all
// three below do. Per ADR-0005 (no silent default): a file this module cannot classify (unrecognized
// extension) or cannot safely serve (escapes root, unreadable, oversized) is recorded in `skipped`
// with a stated reason, never dropped without a trace and never guessed at.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Location constants + tiny helpers — duplicated per the established mcp/lib convention (see the
// header notes in modes.mjs / estimate.mjs / boundary.mjs / standards.mjs / route_node.mjs /
// estimate_phase.mjs / boundary_lookup.mjs / standards_shelf.mjs / run_gate.mjs): small, universal
// helpers are re-declared per file, anchored to the source file rather than to a sibling module.
// ---------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url)) // mcp/lib
const DEFAULT_ROOT = path.resolve(HERE, '..', '..') // repo root, two levels up from mcp/lib

const RESOURCE_URI_SCHEME = 'heimdall://'

function resolveRoot(root) {
  return root ? path.resolve(root) : DEFAULT_ROOT
}

function relPosix(root, file) {
  return path.relative(resolveRoot(root), file).split(path.sep).join('/')
}

function toUri(relPath) {
  return RESOURCE_URI_SCHEME + relPath
}

function statSafely(p) {
  try {
    return fs.statSync(p)
  } catch {
    return null
  }
}

function realpathSafely(p) {
  try {
    return fs.realpathSync(p)
  } catch {
    return null
  }
}

// The brief's exact rule: "guard anyway with realpath plus a prefix check, rejecting anything where
// path.relative(root,target) starts with '..' or is absolute." rel === '' (target === root itself)
// is also rejected — every served resource is a FILE strictly inside root, never the root directory.
function isWithinRoot(root, target) {
  const rel = path.relative(root, target)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

// ---------------------------------------------------------------------------
// mimeType per extension. text/markdown, application/json and text/javascript are the three D3.7's
// hardRules names explicitly ("Every resources/read result carries mimeType (text/markdown,
// application/json, text/javascript)"). .mjs is added alongside .js for the same ES-module-source
// reason (none exist under .claude/skills today, but a future template could be one). .sh is added
// because .claude/skills/loop-harness/templates/hooks/{guard-secrets,session-start}.sh are real,
// walked files with no entry in D3.7's three-type list — omitting them would silently exclude two
// real template files from the surface rather than serving them, which is the exact silent drop
// ADR-0005 forbids for a tool answer and this module holds itself to the same standard for. No IANA
// type is registered for .sh; text/x-sh is the freedesktop shared-mime-info registration and is what
// this module uses. An extension with NO entry here is not guessed at — see buildResourceIndex()'s
// `skipped` handling below.
const MIME_TYPES = new Map([
  ['.md', 'text/markdown'],
  ['.json', 'application/json'],
  ['.js', 'text/javascript'],
  ['.mjs', 'text/javascript'],
  ['.sh', 'text/x-sh'],
])

// Size guard. execution-modes.md — the largest single file this task's brief names — is 49983 bytes
// (~48.8 KiB), MEASURED via `ls -la .claude/skills/loop-engine/references/execution-modes.md` at
// task start, not assumed. 262144 (256 KiB) is >5x that: comfortable headroom for the largest
// legitimate file in the surface while still bounding what a single resources/read pulls into
// memory and onto the wire. Enforced on READ, not on LIST — listing only stat()s a file (cheap, no
// content read), so an oversized file still appears in resources/list with its true size; only
// resources/read refuses it, so a caller sees the file exists and WHY it cannot be fetched rather
// than the file silently vanishing from the surface.
const MAX_RESOURCE_BYTES = 262144

// Declared MCP capability object for S7's `initialize` response. D3.7 hardRules: "Read-only. No
// resources/write, no subscribe, no listChanged. The declared capability is `resources: {}`." This
// constant IS that object — S7 should use it verbatim rather than reconstruct or guess the shape.
// There genuinely is no write handler anywhere in this file (not one that refuses — none exists):
// "read-only" is met by omission, not by a guarded no-op.
const RESOURCES_CAPABILITY = Object.freeze({})

// Suggested JSON-RPC error code for S7 to use when translating a readResource() failure into a wire-
// level response. NOT applied by this module — like every other mcp/lib file, this one knows nothing
// about JSON-RPC framing (that is S7's layer). -32002 is the code MCP reference implementations use
// for "Resource not found"; ADR-0001's frozen error-code table (mcp/runtime-pin.json) only names the
// four JSON-RPC-standard codes and does not rule on this one, so this is a recommendation, not a law
// this file enforces.
const SUGGESTED_JSONRPC_ERROR_CODE = -32002

// ---------------------------------------------------------------------------
// Surface definition.
// ---------------------------------------------------------------------------

const SKILLS_DIR_REL = path.join('.claude', 'skills')
const SKILL_SUBDIRS = ['references', 'templates', 'frameworks']

// D3 resource-surface decision's one extra file, named as a single explicit relative path — never a
// directory walk of docs/design/, which would also pick up the 6 ADRs, execution-mode-spec.json and
// README.md that no tool parses. See "DECISION RATIONALE" at the file bottom.
const EXTRA_FILES_REL = [path.join('docs', 'design', 'boundary-audit.json')]

// ---------------------------------------------------------------------------
// Recursive file walk. .claude/skills/loop-harness/templates/hooks/ is a real, MEASURED one-level-
// deep subdirectory (the only such case in the tree at task start) — this walker does not assume
// depth 1 is the only depth that will ever exist, and recurses arbitrarily. A directory symlink that
// resolves outside sourceRootReal is refused and not descended into (D3.7 hardRules: "a symlink
// escaping the root is refused").
// ---------------------------------------------------------------------------

function walkFilesRecursive(absDir, sourceRootReal, skipped) {
  let dirents
  try {
    dirents = fs.readdirSync(absDir, { withFileTypes: true })
  } catch (e) {
    skipped.push({ path: absDir, reason: `cannot list directory: ${e.message}` })
    return []
  }

  const names = dirents.map((d) => d.name).sort()
  const files = []
  for (const name of names) {
    const abs = path.join(absDir, name)
    const st = statSafely(abs) // follows symlinks
    if (!st) {
      skipped.push({ path: abs, reason: 'broken symlink or unstatable entry' })
      continue
    }
    if (st.isDirectory()) {
      const real = realpathSafely(abs)
      if (!real || !isWithinRoot(sourceRootReal, real)) {
        skipped.push({ path: abs, reason: 'directory symlink escapes repo root, refused' })
        continue
      }
      files.push(...walkFilesRecursive(abs, sourceRootReal, skipped))
    } else if (st.isFile()) {
      files.push(abs)
    } else {
      skipped.push({ path: abs, reason: 'not a regular file or directory (device/fifo/socket), refused' })
    }
  }
  return files
}

// ---------------------------------------------------------------------------
// Public: buildResourceIndex — walks the surface LIVE on every call (never cached at module scope).
// D3.7 hardRules: "resources/list is generated by walking the surface at request time, not cached
// (caching is deferred by D1), so a file added mid-session appears." Every OTHER mcp/lib spine module
// makes the identical choice for the identical reason (boundary.mjs / standards.mjs's own "READ
// LIVE, NEVER SNAPSHOT" headers) — this module extends that discipline to the resource surface
// itself, not just to the content of any one file within it.
// ---------------------------------------------------------------------------

function buildResourceIndex(root) {
  const sourceRoot = resolveRoot(root)
  const skipped = []

  const sourceRootReal = realpathSafely(sourceRoot)
  if (!sourceRootReal) {
    return {
      ok: false,
      code: 'source_missing',
      error: `cannot resolve repo root ${sourceRoot}`,
      fix: 'Verify the server was started against a real Heimdall checkout.',
    }
  }

  const skillsDirAbs = path.join(sourceRoot, SKILLS_DIR_REL)
  let skillDirNames
  try {
    skillDirNames = fs
      .readdirSync(skillsDirAbs, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
  } catch (e) {
    return {
      ok: false,
      code: 'source_missing',
      error: `cannot read ${relPosix(sourceRoot, skillsDirAbs)}: ${e.code === 'ENOENT' ? 'no such directory' : e.message}`,
      fix: `Restore ${SKILLS_DIR_REL.split(path.sep).join('/')} — it is the root of the resource surface (ADR-0003 §D3.7).`,
    }
  }

  const candidateAbsPaths = []

  for (const skillName of skillDirNames) {
    const skillAbs = path.join(skillsDirAbs, skillName)

    const skillMdAbs = path.join(skillAbs, 'SKILL.md')
    const skillMdSt = statSafely(skillMdAbs)
    if (skillMdSt && skillMdSt.isFile()) {
      candidateAbsPaths.push(skillMdAbs)
    } else {
      skipped.push({ path: skillMdAbs, reason: `no SKILL.md found for skill directory '${skillName}'` })
    }

    for (const sub of SKILL_SUBDIRS) {
      const subAbs = path.join(skillAbs, sub)
      const subSt = statSafely(subAbs)
      if (subSt && subSt.isDirectory()) {
        candidateAbsPaths.push(...walkFilesRecursive(subAbs, sourceRootReal, skipped))
      }
      // A missing references/templates/frameworks subdirectory is normal — not every skill has all
      // three (only 3 of 21 have frameworks/) — so this is not recorded as skipped: nothing was
      // found there to skip.
    }
  }

  for (const rel of EXTRA_FILES_REL) {
    const abs = path.join(sourceRoot, rel)
    const st = statSafely(abs)
    if (st && st.isFile()) {
      candidateAbsPaths.push(abs)
    } else {
      skipped.push({ path: abs, reason: 'named in the D3-resolved resource surface but not found on disk' })
    }
  }

  const entries = []
  for (const abs of candidateAbsPaths) {
    const real = realpathSafely(abs)
    if (!real || !isWithinRoot(sourceRootReal, real)) {
      skipped.push({ path: abs, reason: 'resolved real path escapes repo root, refused (symlink)' })
      continue
    }
    const ext = path.extname(real).toLowerCase()
    const mimeType = MIME_TYPES.get(ext)
    if (!mimeType) {
      skipped.push({ path: real, reason: `unrecognized extension '${ext}' — no mimeType mapping, refusing to guess one (ADR-0005)` })
      continue
    }
    const st = statSafely(real)
    if (!st) {
      skipped.push({ path: real, reason: 'file disappeared between walk and stat' })
      continue
    }
    const relPath = relPosix(sourceRoot, real)
    entries.push({
      uri: toUri(relPath),
      relPath,
      absPath: real,
      mimeType,
      sizeBytes: st.size,
    })
  }

  entries.sort((a, b) => (a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0))

  return { ok: true, sourceRoot, sourceRootReal, entries, skipped }
}

// ---------------------------------------------------------------------------
// Category + description — cosmetic, for resources/list's `name`/`description` fields only; carries
// no authority and is derived purely from the already-verified relPath string.
// ---------------------------------------------------------------------------

function categoryFor(relPath) {
  if (relPath.startsWith('docs/design/')) return 'design'
  if (/(^|\/)SKILL\.md$/.test(relPath)) return 'skill-manual'
  if (relPath.includes('/references/')) return 'reference'
  if (relPath.includes('/templates/')) return 'template'
  if (relPath.includes('/frameworks/')) return 'framework'
  return 'other'
}

const CATEGORY_LABELS = {
  'skill-manual': 'Skill entry point (SKILL.md)',
  reference: 'On-demand reference file',
  template: 'Workflow/config template file',
  framework: 'Lifecycle framework document',
  design: 'Normative design record',
  other: 'Repository file',
}

function describeEntry(relPath) {
  return `${CATEGORY_LABELS[categoryFor(relPath)]} — ${relPath}`
}

// ---------------------------------------------------------------------------
// Public: listResources — the resources/list handler's data. MCP resource object shape:
// {uri, name, description, mimeType, size}. `name` is the repo-relative posix path (unique, stable,
// and already what every citation's `file` field carries — no separate naming scheme to reconcile).
// ---------------------------------------------------------------------------

function listResources(root) {
  const idx = buildResourceIndex(root)
  if (!idx.ok) return idx

  const resources = idx.entries.map((e) => ({
    uri: e.uri,
    name: e.relPath,
    description: describeEntry(e.relPath),
    mimeType: e.mimeType,
    size: e.sizeBytes,
  }))

  return { ok: true, sourceRoot: idx.sourceRoot, resources, skipped: idx.skipped }
}

// ---------------------------------------------------------------------------
// Public: readResource — the resources/read handler's data. Looks the URI up in a FRESHLY built
// index (allow-list-first, per the file header) rather than decoding it into a path, then re-verifies
// containment independently before reading (TOCTOU / defense-in-depth, per the brief's "guard
// anyway"). Returns {ok:false, code, message, fix} on any failure — this is an MCP RESOURCE error,
// never the tools/call isError envelope (D3.7 hardRules; see SUGGESTED_JSONRPC_ERROR_CODE above for
// S7's wire-level mapping).
// ---------------------------------------------------------------------------

function readResource(root, uri) {
  if (typeof uri !== 'string' || !uri.startsWith(RESOURCE_URI_SCHEME)) {
    return {
      ok: false,
      code: 'invalid_uri',
      message: `resource URI must start with '${RESOURCE_URI_SCHEME}'; got ${JSON.stringify(uri)}`,
      fix: `Use a URI returned by resources/list, e.g. '${RESOURCE_URI_SCHEME}.claude/skills/loop-design/SKILL.md'.`,
    }
  }

  const idx = buildResourceIndex(root)
  if (!idx.ok) return idx

  const entry = idx.entries.find((e) => e.uri === uri)
  if (!entry) {
    return {
      ok: false,
      code: 'not_found',
      message: `${uri} is not in the served resource surface (${idx.entries.length} resources at this call)`,
      fix: 'Call resources/list to see the current surface, or check the URI against heimdall://<repo-relative-posix-path>.',
    }
  }

  // Second, independent containment check — the entry's absPath was already realpath-verified
  // inside buildResourceIndex() moments ago; this re-checks it now, catching a symlink swap between
  // index build and this read (TOCTOU) rather than trusting the first check to still hold.
  const realNow = realpathSafely(entry.absPath)
  if (!realNow || !isWithinRoot(idx.sourceRootReal, realNow) || realNow !== entry.absPath) {
    return {
      ok: false,
      code: 'traversal_rejected',
      message: `refusing to read ${uri} — its resolved path changed or escapes the repo root between listing and reading`,
      fix: 'This indicates the checkout changed underneath the server (a symlink swap or a race) — restart the server against a clean checkout.',
    }
  }

  const st = statSafely(realNow)
  if (!st) {
    return {
      ok: false,
      code: 'not_found',
      message: `${uri} was in the index but disappeared before it could be read`,
      fix: 'Call resources/list again — the file may have been removed.',
    }
  }
  if (st.size > MAX_RESOURCE_BYTES) {
    return {
      ok: false,
      code: 'resource_too_large',
      message: `${uri} is ${st.size} bytes, over the ${MAX_RESOURCE_BYTES}-byte resource size guard`,
      fix: 'This file is larger than any legitimate resource in the surface (the largest known, execution-modes.md, is ~48 KB) — investigate why before raising the guard.',
    }
  }

  let text
  try {
    text = fs.readFileSync(realNow, 'utf8')
  } catch (e) {
    return {
      ok: false,
      code: 'read_failed',
      message: `could not read ${uri}: ${e.message}`,
      fix: 'Verify file permissions on the checkout.',
    }
  }

  return {
    ok: true,
    uri,
    mimeType: entry.mimeType,
    text,
    size: st.size,
    sourceRoot: idx.sourceRoot,
  }
}

// ---------------------------------------------------------------------------
// node -e 'import("./mcp/lib/resources.mjs").then(m => console.log(JSON.stringify(m.listResources().resources.length)))'
// node -e 'import("./mcp/lib/resources.mjs").then(m => console.log(JSON.stringify(m.readResource(undefined, "heimdall://.claude/skills/loop-design/SKILL.md").mimeType)))'
// (double-quoted specifiers above deliberately, so this doc comment does not itself match
// ADR-0002 §D2.3.6's assertNoDependencies() grep for a single-quoted import(...) specifier)
// ---------------------------------------------------------------------------
//
// ============================================================================================
// DECISION RATIONALE — docs/design/boundary-audit.json joins the surface; the C4 set and the rest
// of docs/design/ do not.
// ============================================================================================
//
// This task's brief asks S6 to "decide per D3 whether docs/design/boundary-audit.json and the C4
// set join the surface." ADR-0003 §D3.7 already rules on part of this directly and unambiguously:
//
//   - The C4 set is explicitly named in D3.7's OWN exclusion list: `excluded: [...,  "docs/c4/*", ...]`
//     (mcp/tool-contracts.json D3.7_resources.surface.excluded). No new reasoning is needed here —
//     docs/c4/ stays out because D3.7 already put it out, and this module's EXTRA_FILES_REL simply
//     never names anything under docs/c4/.
//
//   - D3.7's `included` list names `"docs/design/* (4)"` without saying which 4, and its own
//     `exclusionRationale` states the actual test to apply: "The resource surface is exactly what
//     the five tools parse, plus the skill tree they parse it from. A surface wider than the tool
//     surface is unaudited reach for no benefit." Applying that test to docs/design/'s 9 files
//     (MEASURED at task start: 6 ADRs, boundary-audit.json, execution-mode-spec.json, README.md):
//
//       * boundary-audit.json — PARSED, live, by mcp/lib/boundary.mjs, on every boundary_lookup
//         call (readBoundaryAudit()). This is also the file this task's brief itself names: "the
//         four consumer routers already point at ../../../docs/design/boundary-audit.json, so
//         stopping at .claude/skills leaves the most-referenced file outside it." Joins.
//       * execution-mode-spec.json — NOT parsed by any tool. docs/design/README.md says it is
//         "Superseded at the point of use by .claude/skills/loop-engine/references/execution-
//         modes.md, which is what the skills actually load" — and execution-modes.md is what
//         route_node/estimate_phase actually read, and is already IN the surface as one of the 105
//         references/*.md files. Including the superseded design record too would be reach beyond
//         what any tool parses. Excluded.
//       * The 6 ADRs and docs/design/README.md — these are law/documentation ABOUT the MCP server's
//         own design, not source material any tool extracts data from. They sit in the identical
//         category as the repo-root files D3.7 already excludes by name for the identical reason
//         (CONTRIBUTING.md, README.md, CHANGELOG.md — none of which any tool parses either).
//         Excluded, for consistency with how D3.7 already treats their repo-root siblings.
//
//   So this module's EXTRA_FILES_REL is exactly one entry: docs/design/boundary-audit.json.
//
// DISCLOSED DISCREPANCY, same posture every sibling S1-S5 file already took toward a stale number in
// its own governing document: D3.7's header table gives `"docs/design/* (4)"`,
// `".claude/skills/*/templates/* (39)"` and `countAtHead: 172`. A fresh walk at this task's start
// (MEASURED, `find .claude/skills -path '*/SKILL.md' | wc -l` etc.) finds 21 SKILL.md + 105
// references + 37 templates + 3 frameworks = 166 — matching this task's brief's own "counts
// verified" figure, and 2 templates short of D3.7's "39". D3.7 is therefore stale on this exact
// number, the same class of drift ADR-0003 §2 itself demonstrates about execution-modes.md's mode
// vocabulary ("already provably stale, and no gate catches it"). This module does not hardcode 172,
// 166 or any other total anywhere as an assertion — buildResourceIndex() walks live and returns
// however many files it actually finds, which is the only way this class of staleness cannot recur
// here. Measured total at task start: 166 (.claude/skills) + 1 (boundary-audit.json) = 167.

export {
  listResources,
  readResource,
  buildResourceIndex,
  RESOURCE_URI_SCHEME,
  RESOURCES_CAPABILITY,
  MIME_TYPES,
  MAX_RESOURCE_BYTES,
  SUGGESTED_JSONRPC_ERROR_CODE,
  DEFAULT_ROOT,
}
