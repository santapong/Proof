// mcp/lib/run_gate.mjs — the run_gate MCP tool handler (Phase 3, S5).
//
// Every other tool in this phase (route_node S1, estimate_phase S2, boundary_lookup S3,
// standards_shelf S4) is a tool-handler layer built ON TOP OF a Phase-2 spine module
// (mcp/lib/{modes,estimate,boundary,standards}.mjs) that already parses doctrine out of the repo's
// Markdown/JSON source docs. run_gate has no such spine and composes none, because its job is not to
// PARSE a source document — it is to RUN one: `node scripts/validate.mjs --json` as a spawned child
// process. scripts/validate.mjs is never imported here. Its own main() calls process.exit() at module
// scope on every exit path (validate.mjs:631 the PASSED branch, :643 the FAILED branch, :670 the
// crash-catch branch) — importing a module that calls process.exit() at module-evaluation time would
// terminate THIS process (the MCP server) the instant the import resolved, taking the whole stdio
// connection down with it. spawn() is not an optimization here; it is the only correct seam.
//
// ============================================================================================
// DIVERGENCE FROM THE STALE mcp/tool-contracts.json §D3.6 run_gate entry, disclosed rather than
// silently reconciled — same posture route_node.mjs (S1), estimate_phase.mjs (S2), boundary_lookup.mjs
// (S3) and standards_shelf.mjs (S4) already took for their own tools. §D3.6 describes a run_gate with
// a `gate: validate|smoke|both` closed enum, a `verbose` passthrough, a caller `timeoutMs`, and a
// REQUIRED `baseline` block that separately spawns scripts/smoke.mjs and diffs its failures against
// mcp/runtime-pin.json's recorded gateBaseline (because smoke.mjs is red on develop for a pre-existing
// reason unrelated to any caller's change).
//
// The Phase 3 S5 task brief that authorises this file is narrower and more specific than §D3.6, and
// its constraints cannot be satisfied simultaneously with §D3.6's fuller shape without re-introducing
// exactly what the brief forbids:
//   - "no argument pass-through in v1" rules out a caller-supplied `gate` selector or `verbose` flag —
//     both would be strings threaded into the child's argv, which is the shape the brief's "no shell,
//     no argument pass-through" line exists to prevent becoming a caller-steerable process launcher.
//   - v1 SPAWNS ONLY `node scripts/validate.mjs --json`. It never spawns scripts/smoke.mjs. So there is
//     no `baseline` block to build — the smoke-vs-baseline comparison in §D3.6 requires running smoke,
//     which this file deliberately does not do.
//
// What v1 does instead, to keep the caller from being worse off than §D3.6 promised: the tool
// DESCRIPTION (RUN_GATE_TOOL_DESCRIPTION, exported below for mcp/server.mjs's S7 tool registration to
// use verbatim — the tool registry is static literals per ADR-0002 §D2.4/C6) states plainly that CI
// also runs scripts/smoke.mjs on every push and that a green run_gate result is therefore NOT a green
// CI. The same sentence is also placed in-band, on EVERY call (both branches), as RUN_GATE_SCOPE_NOTE
// in the envelope's `notes[]` — so a caller who never reads the tool's static description still sees it
// on every answer, not just in documentation.
//
// OPEN QUESTION for whoever reconciles mcp/tool-contracts.json next (same open-question convention
// boundary_lookup.mjs and standards_shelf.mjs already used): either add a `gate:'smoke'`/`'both'` mode
// as a SEPARATE, later-hardened tool call once smoke.mjs's own security posture (repo-root containment,
// timeout, output cap) has been reasoned through the same way this file reasons through validate.mjs's,
// or narrow §D3.6 to match what is actually safe to ship in v1. This file does not silently do the
// narrower, safer thing while a wider inputSchema advertises the fuller one — validateInput() below
// rejects every input property, so nothing in the advertised schema can promise more than this code
// does.
//
// Per ADR-0005 (no silent default / D4-D5 "locate by coordinate, fail loud naming the span"): the
// resolved gate-script path is located from THIS FILE's own on-disk location via
// fileURLToPath(import.meta.url) — never from process.cwd(), which is arbitrary for an MCP server
// (mcp/server.mjs, S7, will anchor identically, one directory up from here) — and is refused outright
// if its realpath does not resolve inside the repo root's realpath, rather than silently spawning
// whatever a symlink or a mangled checkout happens to point at. The one citation this tool attaches
// (the exit-code contract at scripts/validate.mjs's own header, see locateExitContractCitation below)
// is located by coordinate — find "// Usage:" then the very next "// Exit:" line — and fails loud,
// naming the file and the missing anchor, rather than guessing which comment is "the" contract.
//
// Unlike the four parsing tools, this file's output is NOT required to be byte-identical across calls
// (ADR-0005 §D5.3.6's determinism promise is about answers derived from static doctrine bytes that do
// not change between calls). run_gate's entire job is to measure a live child process against a repo
// tree that may itself have changed — `durationMs` reads the wall clock and `verdict` depends on the
// tree's current state. This is the disclosed, necessary exception D3.4's own annotations table already
// flags by making run_gate the one tool with `readOnlyHint:false`; "idempotent" there means repeat runs
// on an UNCHANGED tree agree, not that the clock reading is constant.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

// ---------------------------------------------------------------------------
// Location constants + tiny helpers — duplicated per the established mcp/lib convention (see the
// header notes in modes.mjs / estimate.mjs / boundary.mjs / standards.mjs / route_node.mjs /
// estimate_phase.mjs / boundary_lookup.mjs / standards_shelf.mjs): small, universal helpers are
// re-declared per file, anchored to the source file rather than to a sibling module.
// ---------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url)) // mcp/lib
const DEFAULT_ROOT = path.resolve(HERE, '..', '..') // repo root, two levels up from mcp/lib — the
// SAME arithmetic mcp/server.mjs (S7, not yet written) must use one level up from mcp/, since both
// anchor to their own file's import.meta.url rather than to process.cwd() (ADR-0002 §D2.4 C7).
const SERVER_VERSION = '0.2.0'

function resolveRoot(root) {
  return root ? path.resolve(root) : DEFAULT_ROOT
}

function relPosix(root, file) {
  return path.relative(resolveRoot(root), file).split(path.sep).join('/')
}

function toLines(text) {
  return text.replace(/\r\n/g, '\n').split('\n')
}

function sha256OfLines(lines, startLine, endLine) {
  // D3.2: sha256 of the LF-normalized bytes of lines startLine..endLine inclusive (1-indexed), each
  // line terminated by a single \n. Byte-identical rule to every other mcp/lib file's own copy.
  const slice = lines.slice(startLine - 1, endLine)
  const bytes = slice.map((l) => l + '\n').join('')
  return crypto.createHash('sha256').update(bytes, 'utf8').digest('hex')
}

function resourceUri(file) {
  return `proof://${file}`
}

function dedupeCitations(list) {
  const seen = new Set()
  const out = []
  for (const c of list) {
    if (!c) continue
    const key = `${c.file}:${c.startLine}-${c.endLine}:${c.section}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
  }
  return out
}

// ---------------------------------------------------------------------------
// Tunables — fixed constants, not caller-configurable in v1 (see the divergence note above: no
// caller `timeoutMs`, no argument pass-through).
// ---------------------------------------------------------------------------

// Measured wall time for `node scripts/validate.mjs --json` on this tree at task start: ~2.0-2.4s
// (repeated local measurement); the Phase 3 S5 brief cites ~3.5s as "current wall time" from its own
// measurement environment. 15000ms is >4x the slower of the two figures. This repo has no on-disk
// record of Claude Code's default per-tool MCP timeout (grepped: no MCP_TIMEOUT reference anywhere in
// the tree), so rather than assert an unverified exact figure, GATE_TIMEOUT_MS is kept generous
// relative to the MEASURED cost and short enough that a genuinely hung validate.mjs is killed and
// reported as `gate_unavailable` well before any plausible client-side timeout would itself sever the
// connection with no diagnosis at all.
const GATE_TIMEOUT_MS = 15000

// Output cap on each of stdout/stderr captured from the child. validate.mjs --json prints exactly one
// line to stdout (measured 1417 bytes on this tree — JSON_MODE suppresses every other console.log);
// non-JSON mode prints ~20 lines to a few KB. 65536 bytes is ~46x the measured single-line JSON size,
// generous headroom for a much larger future tree while still bounding worst-case memory if
// validate.mjs is ever changed to print pathologically more.
const MAX_CAPTURE_BYTES = 65536

// ---------------------------------------------------------------------------
// §D3.2 citation — run_gate parses no doctrine, so (per §D3.6's own citationRule) its one attached
// citation points at the gate SCRIPT's own output-emitting driver: the exit-code contract stated in
// scripts/validate.mjs's own header comment, which is exactly what classifyRun() below maps. Located
// by coordinate (first "// Usage:" line, then the very next "// Exit:" line), never hardcoded, so a
// future edit to that header is caught rather than silently cited wrong.
// ---------------------------------------------------------------------------

function locateExitContractCitation(root) {
  const sourceRoot = resolveRoot(root)
  const scriptPath = path.join(sourceRoot, 'scripts', 'validate.mjs')
  const relFile = 'scripts/validate.mjs'
  let text
  try {
    text = fs.readFileSync(scriptPath, 'utf8')
  } catch (e) {
    return { ok: false, error: `cannot read ${relFile} to cite its exit-code contract: ${e.code === 'ENOENT' ? 'no such file' : e.message}` }
  }
  const ls = toLines(text)
  const usageIdx = ls.findIndex((l) => /^\/\/ Usage:/.test(l))
  if (usageIdx === -1) {
    return { ok: false, error: `${relFile} has no "// Usage:" header comment line — the exit-code contract this tool maps could not be located by coordinate` }
  }
  let exitIdx = -1
  for (let i = usageIdx + 1; i < ls.length; i++) {
    if (/^\/\/ Exit:/.test(ls[i])) { exitIdx = i; break }
    if (ls[i].trim() === '' || !/^\/\//.test(ls[i])) break // the contract is a contiguous comment block
  }
  if (exitIdx === -1) {
    return { ok: false, error: `${relFile}:${usageIdx + 1} opens "// Usage:" but no "// Exit:" comment line follows immediately — the exit-code contract this tool maps could not be located by coordinate` }
  }
  const startLine = usageIdx + 1
  const endLine = exitIdx + 1
  return {
    ok: true,
    citation: {
      file: relFile,
      section: 'header comment — Usage / Exit contract',
      startLine,
      endLine,
      sha256: sha256OfLines(ls, startLine, endLine),
      resourceUri: resourceUri(relFile),
      excerpt: ls.slice(startLine - 1, endLine).join('\n'),
      excerptTruncated: false,
    },
  }
}

// ---------------------------------------------------------------------------
// Path resolution + containment refusal. No caller-supplied path exists anywhere in this file's input
// surface (validateInput below rejects every property); `root` is the same internal test-only seam
// every sibling mcp/lib file accepts via `options.root`, never wired to any MCP inputSchema property.
// ---------------------------------------------------------------------------

function resolveGateScript(root) {
  const sourceRoot = resolveRoot(root)
  const candidate = path.join(sourceRoot, 'scripts', 'validate.mjs')

  let realRoot
  try {
    realRoot = fs.realpathSync(sourceRoot)
  } catch (e) {
    return {
      ok: false,
      code: 'gate_unavailable',
      message: `cannot resolve the repo root ${sourceRoot}: ${e.code === 'ENOENT' ? 'no such directory' : e.message}`,
      fix: 'Verify PROOF_ROOT (or the default two-levels-up-from-mcp/lib resolution) points at a real Proof checkout.',
    }
  }

  let realCandidate
  try {
    realCandidate = fs.realpathSync(candidate)
  } catch (e) {
    return {
      ok: false,
      code: 'gate_unavailable',
      message: `gate script not found at ${relPosix(sourceRoot, candidate)}: ${e.code === 'ENOENT' ? 'no such file' : e.message}`,
      fix: 'Verify this checkout has scripts/validate.mjs; a packaged/relocated install may need PROOF_ROOT set.',
    }
  }

  const withinRoot = realCandidate === realRoot || realCandidate.startsWith(realRoot + path.sep)
  if (!withinRoot) {
    return {
      ok: false,
      code: 'internal',
      message: `refusing to spawn ${candidate} — its resolved real path ${realCandidate} escapes the repo root ${realRoot} (symlink or misconfigured checkout)`,
      fix: 'This indicates the server itself is misconfigured, not a caller error — verify .mcp.json / PROOF_ROOT point at a genuine, unmodified TheLoopSkill checkout.',
    }
  }

  return { ok: true, path: realCandidate, sourceRoot }
}

// ---------------------------------------------------------------------------
// The spawn itself. stdio is PIPED, never inherited — this process's own stdout is the JSON-RPC
// transport (ADR-0001 §1: "Never write anything non-protocol to stdout"), so the child's stdout MUST
// be captured, never `inherit`ed, or a single `node scripts/validate.mjs --json` run would corrupt the
// wire. No shell (`shell` left at its spawn() default of false, argv passed as an array — never a
// composed command string). Interpreter is pinned to process.execPath, never a bare `'node'` resolved
// off PATH. Argv is the fixed two-element array `[scriptPath, '--json']` — no caller-supplied element,
// no pass-through.
//
// Timeout is tracked with our OWN timer rather than spawn()'s built-in `timeout` option, so `timedOut`
// below is set exactly when OUR timer fires kill() — not inferred after the fact from a signal name
// that some other cause (e.g. an external OOM kill) could also have produced.
// ---------------------------------------------------------------------------

function makeCollector(capBytes) {
  const chunks = []
  let total = 0
  let truncated = false
  return {
    onData(chunk) {
      if (total >= capBytes) { truncated = true; return }
      const remaining = capBytes - total
      if (chunk.length > remaining) {
        chunks.push(chunk.subarray(0, remaining))
        total += remaining
        truncated = true
      } else {
        chunks.push(chunk)
        total += chunk.length
      }
    },
    result() {
      return { text: Buffer.concat(chunks).toString('utf8'), truncated }
    },
  }
}

function spawnValidateJson(scriptPath, cwd, timeoutMs) {
  return new Promise((resolve) => {
    const startedAtMs = Date.now() // see file header: a live-process measurement, not the H10
    // workflow-template clock ban and not ADR-0005 §D5.3.6's parsing-tool determinism promise.
    const stdoutCollector = makeCollector(MAX_CAPTURE_BYTES)
    const stderrCollector = makeCollector(MAX_CAPTURE_BYTES)
    let timedOut = false
    let settled = false

    let child
    try {
      child = spawn(process.execPath, [scriptPath, '--json'], {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'], // PIPED, never inherited
        shell: false, // no shell
      })
    } catch (e) {
      resolve({ spawnError: e, exitCode: null, signal: null, timedOut: false, stdout: '', stdoutTruncated: false, stderr: '', stderrTruncated: false, durationMs: Date.now() - startedAtMs })
      return
    }

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)
    if (typeof timer.unref === 'function') timer.unref()

    child.stdout.on('data', (c) => stdoutCollector.onData(c))
    child.stderr.on('data', (c) => stderrCollector.onData(c))

    child.on('error', (e) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      const stdout = stdoutCollector.result()
      const stderr = stderrCollector.result()
      resolve({ spawnError: e, exitCode: null, signal: null, timedOut, stdout: stdout.text, stdoutTruncated: stdout.truncated, stderr: stderr.text, stderrTruncated: stderr.truncated, durationMs: Date.now() - startedAtMs })
    })

    child.on('close', (code, signal) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      const stdout = stdoutCollector.result()
      const stderr = stderrCollector.result()
      resolve({
        spawnError: null,
        exitCode: code,
        signal,
        timedOut,
        stdout: stdout.text,
        stdoutTruncated: stdout.truncated,
        stderr: stderr.text,
        stderrTruncated: stderr.truncated,
        durationMs: Date.now() - startedAtMs,
      })
    })
  })
}

// ---------------------------------------------------------------------------
// The three-way exit contract (scripts/validate.mjs:10, cited live above): 0 = pass, 1 = at least one
// finding, 2 = the checker itself broke before producing a verdict. Exit 2 — and a timeout, and a
// spawn failure — all map to the SAME error code, `gate_unavailable`, and are returned as ok:false.
// They are NEVER reported as verdict:'FAIL': a checker that never finished its job did not "fail the
// gate", it failed to ANSWER the question, which is the distinction D3.5's own codes table draws
// ("Distinct from a gate that ran and FAILED — a failing gate is ok:true with verdict:'FAIL'").
// ---------------------------------------------------------------------------

function classifyRun(spawnResult, timeoutMs) {
  if (spawnResult.spawnError) {
    const e = spawnResult.spawnError
    return {
      errorCode: 'gate_unavailable',
      message: `could not spawn ${process.execPath} to run scripts/validate.mjs: ${e.code ? `${e.code} — ` : ''}${e.message}`,
      fix: 'Verify the node interpreter at process.execPath is intact and scripts/validate.mjs is present in this checkout; run `node scripts/validate.mjs` directly in Bash to confirm.',
    }
  }
  if (spawnResult.timedOut) {
    return {
      errorCode: 'gate_unavailable',
      message: `node scripts/validate.mjs --json did not complete within ${timeoutMs}ms and was killed (SIGKILL) — a timeout is the checker failing to answer, never a gate FAILURE`,
      fix: 'Run `node scripts/validate.mjs --json` directly in Bash to see whether it is genuinely hanging or just slower than usual on this machine.',
    }
  }
  if (spawnResult.exitCode === 0 || spawnResult.exitCode === 1) {
    return { errorCode: null }
  }
  if (spawnResult.exitCode === 2) {
    return {
      errorCode: 'gate_unavailable',
      message: `scripts/validate.mjs exited 2 — the checker itself crashed before producing a verdict, distinct from and never reported as a gate FAILURE. Captured stderr (last 2000 chars): ${(spawnResult.stderr || '(empty)').slice(-2000)}`,
      fix: 'Run `node scripts/validate.mjs --json` directly in Bash to see the crash; this is a bug in validate.mjs or its environment, not a repo finding.',
    }
  }
  return {
    errorCode: 'gate_unavailable',
    message: `scripts/validate.mjs did not exit normally (exitCode=${JSON.stringify(spawnResult.exitCode)}, signal=${JSON.stringify(spawnResult.signal)}) — only 0 (pass), 1 (findings) and 2 (checker crashed) are documented at scripts/validate.mjs:10`,
    fix: 'Run `node scripts/validate.mjs --json` directly in Bash to reproduce and investigate.',
  }
}

// Return the final non-empty line, verbatim, as evidence — validate.mjs --json prints exactly one
// stdout line on both the pass and the fail path (JSON_MODE suppresses every other console.log), so
// "the final line" and "the summary line" are the same line. On the crash path (exit 2, handled by
// classifyRun above before this is ever called) stdout is empty and the diagnostic is on stderr
// instead, which classifyRun already captures in its own error message.
function extractSummaryLine(stdout, stderr) {
  const outLines = stdout.split('\n').filter((l) => l.trim() !== '')
  if (outLines.length > 0) return { line: outLines[outLines.length - 1], source: 'stdout' }
  const errLines = stderr.split('\n').filter((l) => l.trim() !== '')
  if (errLines.length > 0) return { line: errLines[errLines.length - 1], source: 'stderr' }
  return { line: null, source: null }
}

// Per-failure citation — points into the OFFENDING file at the offending line, not into the gate
// script (§D3.6's own citationRule: "Each entry carries a citation into the OFFENDING file"). Some
// validate.mjs fail() calls report line 0 for a whole-file/whole-directory issue (e.g. `fail('skills',
// SKILLS_DIR, 0, ...)`), which is not a valid 1-indexed line per D3.2's schema — those degrade to an
// explained note rather than a fabricated citation (ADR-0005 I1).
function citeFailure(sourceRoot, failure) {
  if (!Number.isInteger(failure.line) || failure.line < 1) {
    return { citation: null, note: `no line-level citation for ${failure.file} (check '${failure.check}') — validate.mjs reported line ${failure.line}, a whole-file issue rather than a specific line` }
  }
  const abs = path.join(sourceRoot, failure.file)
  let text
  try {
    text = fs.readFileSync(abs, 'utf8')
  } catch (e) {
    return { citation: null, note: `could not re-read ${failure.file}:${failure.line} to cite it: ${e.code === 'ENOENT' ? 'no such file' : e.message}` }
  }
  const ls = toLines(text)
  if (failure.line > ls.length) {
    return { citation: null, note: `could not cite ${failure.file}:${failure.line} — the file now has only ${ls.length} line(s) (tree changed since validate.mjs ran?)` }
  }
  return {
    citation: {
      file: failure.file,
      section: `[${failure.check}] failure`,
      startLine: failure.line,
      endLine: failure.line,
      sha256: sha256OfLines(ls, failure.line, failure.line),
      resourceUri: resourceUri(failure.file),
      excerpt: ls[failure.line - 1],
      excerptTruncated: false,
    },
    note: null,
  }
}

// ---------------------------------------------------------------------------
// Envelope constants (ADR-0003 §D3.8's fallback for run_gate, verbatim from
// docs/design/ADR-0003-tool-contracts-and-call-sites.md:163 — "Run `node scripts/validate.mjs` in
// Bash. Identical result." — same grammar as every sibling tool file's own FALLBACK_TEXT constant).
//
// RUN_GATE_SCOPE_NOTE is placed in the envelope's notes[] on EVERY call (both branches) — see the
// DIVERGENCE header note above for why this exists and where its sibling copy (the tool DESCRIPTION)
// lives.
// ---------------------------------------------------------------------------

const RUN_GATE_FALLBACK_TEXT = 'Run `node scripts/validate.mjs` in Bash. Identical result.'

const RUN_GATE_SCOPE_NOTE =
  'run_gate v1 spawns ONLY `node scripts/validate.mjs --json`. CI additionally runs `node scripts/smoke.mjs` on every push, which this tool does not run — a green run_gate result is NOT a green CI. Run scripts/smoke.mjs yourself (or check CI) to know smoke\'s status.'

// Exported for mcp/server.mjs (S7) to use verbatim when registering the tool — the tool registry is
// static literals per ADR-0002 §D2.4/C6, so the description text and annotations live in the source as
// constants rather than being re-derived at startup.
const RUN_GATE_TOOL_DESCRIPTION =
  'Run `node scripts/validate.mjs --json` as a spawned child process (never imported — its main() calls process.exit() at module scope on every path, so importing it would terminate this server) and return the parsed verdict: PASS (exit 0), FAIL with every failure record (exit 1), or a distinct gate_unavailable error when the checker process itself could not produce a verdict (exit 2 — the checker crashed; a timeout; or a spawn failure) — a checker crash or timeout is NEVER reported as a gate FAILURE. v1 runs validate.mjs only: no caller-supplied path, no shell, no argument pass-through, and no gate-selection parameter. CI additionally runs `node scripts/smoke.mjs` on every push, which this tool does NOT run — a green run_gate result is NOT a green CI.'

const RUN_GATE_ANNOTATIONS = Object.freeze({ readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false })

// ---------------------------------------------------------------------------
// Input validation. inputSchema in v1 is `{ type: 'object', additionalProperties: false }` — no
// properties at all. Any supplied property (a `gate` selector, a `timeoutMs` override, a `path`, a
// `verbose` flag — anything) is refused loud at -32602 rather than silently ignored, so the security
// posture ("no argument pass-through") cannot be quietly widened by a caller who guesses a property
// name the advertised schema never promised.
// ---------------------------------------------------------------------------

function protocolError(field, message) {
  return { protocolError: true, jsonRpcCode: -32602, field, message }
}

function validateInput(input) {
  if (input === null || input === undefined) return { ok: true }
  if (typeof input !== 'object' || Array.isArray(input)) {
    return protocolError(null, 'run_gate requires an object argument (or no arguments)')
  }
  const keys = Object.keys(input)
  if (keys.length > 0) {
    return protocolError(keys[0], `run_gate takes no input properties in v1 (no gate selection, no timeout override, no argument pass-through) — unexpected property '${keys[0]}'`)
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Public: runGate — the run_gate tool handler. Unlike every sibling handler this is ASYNC: spawning a
// child process is inherently asynchronous, and there is no synchronous alternative that keeps stdout
// PIPED (spawnSync would still be PIPED and non-shell, but blocks the whole single-threaded server —
// including the stdio read loop that must keep servicing OTHER tool calls and `ping` — for the full
// gate duration; async spawn does not).
// ---------------------------------------------------------------------------

async function runGate(rawInput, options = {}) {
  const root = options.root
  const sourceRoot = resolveRoot(root)

  const validation = validateInput(rawInput)
  if (validation.protocolError) return validation // -32602 seam — never the isError envelope

  const citations = []
  const notes = [RUN_GATE_SCOPE_NOTE]

  const exitContract = locateExitContractCitation(root)
  if (exitContract.ok) citations.push(exitContract.citation)
  else notes.push(`could not attach the exit-code-contract citation: ${exitContract.error}`)

  const resolved = resolveGateScript(root)
  if (!resolved.ok) {
    return {
      ok: false,
      tool: 'run_gate',
      authoringTimeOnly: true,
      serverVersion: SERVER_VERSION,
      sourceRoot,
      // May legitimately be empty when the same unreadable scripts/validate.mjs also defeated the
      // exit-contract citation above — same disclosed-empty-citations posture boundary_lookup.mjs's and
      // standards_shelf.mjs's own unreadable-source branches already take (ADR-0005 I1: never fabricate
      // a citation over bytes that were never successfully read).
      citations,
      deprecations: [],
      notes,
      error: {
        code: resolved.code,
        message: resolved.message,
        fix: resolved.fix,
        fallback: RUN_GATE_FALLBACK_TEXT,
      },
    }
  }

  const spawnResult = await spawnValidateJson(resolved.path, resolved.sourceRoot, GATE_TIMEOUT_MS)
  const classification = classifyRun(spawnResult, GATE_TIMEOUT_MS)

  if (classification.errorCode) {
    return {
      ok: false,
      tool: 'run_gate',
      authoringTimeOnly: true,
      serverVersion: SERVER_VERSION,
      sourceRoot,
      citations,
      deprecations: [],
      notes,
      error: {
        code: classification.errorCode,
        message: classification.message,
        fix: classification.fix,
        fallback: RUN_GATE_FALLBACK_TEXT,
      },
    }
  }

  // exitCode is 0 or 1 here — validate.mjs ran to completion and printed its one --json line.
  const evidence = extractSummaryLine(spawnResult.stdout, spawnResult.stderr)

  let parsed = null
  let parseError = null
  try {
    parsed = JSON.parse(spawnResult.stdout.trim())
  } catch (e) {
    parseError = e.message
  }

  if (!parsed || typeof parsed.checksRun !== 'number' || !Array.isArray(parsed.failures) || !Array.isArray(parsed.warnings)) {
    return {
      ok: false,
      tool: 'run_gate',
      authoringTimeOnly: true,
      serverVersion: SERVER_VERSION,
      sourceRoot,
      citations,
      deprecations: [],
      notes,
      error: {
        code: 'internal',
        message: `validate.mjs --json exited ${spawnResult.exitCode} but its stdout did not parse as the expected {passed, checksRun, failures, warnings} object${parseError ? `: ${parseError}` : ''}${spawnResult.stdoutTruncated ? ' (stdout was truncated at the output cap — this may be the cause)' : ''}`,
        fix: 'Run `node scripts/validate.mjs --json` directly in Bash and inspect the raw output; this is a run_gate parser mismatch, not necessarily a repo defect.',
        fallback: RUN_GATE_FALLBACK_TEXT,
      },
    }
  }

  const failuresOut = []
  for (const f of parsed.failures) {
    const { citation, note } = citeFailure(resolved.sourceRoot, f)
    if (citation) citations.push(citation)
    if (note) notes.push(note)
    failuresOut.push({ check: f.check, file: f.file, line: f.line, message: f.message, citation })
  }

  const result = {
    command: `${process.execPath} ${relPosix(resolved.sourceRoot, resolved.path)} --json`,
    interpreter: process.execPath,
    scriptPath: relPosix(resolved.sourceRoot, resolved.path),
    exitCode: spawnResult.exitCode,
    verdict: spawnResult.exitCode === 0 ? 'PASS' : 'FAIL',
    timedOut: false,
    timeoutMs: GATE_TIMEOUT_MS,
    durationMs: spawnResult.durationMs,
    assertions: parsed.checksRun,
    failureCount: failuresOut.length,
    warningCount: parsed.warnings.length,
    failures: failuresOut,
    warnings: parsed.warnings,
    evidence: evidence.line, // the final summary line, verbatim
    evidenceSource: evidence.source,
    stdoutTruncatedByCap: spawnResult.stdoutTruncated,
    stderrTruncatedByCap: spawnResult.stderrTruncated,
  }

  return {
    ok: true,
    tool: 'run_gate',
    authoringTimeOnly: true,
    serverVersion: SERVER_VERSION,
    sourceRoot,
    result,
    citations: dedupeCitations(citations),
    deprecations: [],
    notes,
  }
}

// ---------------------------------------------------------------------------
// node -e 'import("./mcp/lib/run_gate.mjs").then(m => m.runGate({}).then(r => console.log(JSON.stringify(r, null, 2))))'
// (double-quoted specifier above deliberately, so this doc comment does not itself match
// ADR-0002 §D2.3.6's assertNoDependencies() grep for a single-quoted import(...) specifier)
// ---------------------------------------------------------------------------

export {
  runGate,
  validateInput,
  resolveGateScript,
  spawnValidateJson,
  classifyRun,
  extractSummaryLine,
  citeFailure,
  locateExitContractCitation,
  DEFAULT_ROOT,
  GATE_TIMEOUT_MS,
  MAX_CAPTURE_BYTES,
  RUN_GATE_FALLBACK_TEXT,
  RUN_GATE_SCOPE_NOTE,
  RUN_GATE_TOOL_DESCRIPTION,
  RUN_GATE_ANNOTATIONS,
}
