# ADR-0002: Put the dependency seam at `spawn`, keep the repo manifest-free, and make every `mcp/` boot failure legible

## Status

**Accepted**

Date: 2026-07-27 · Deciders: loop-design (D2, Phase 1 DECIDE) · Depends on: [ADR-0001](../../mcp/ADR-0001-runtime-and-dependency.md) (verdict **(c) zero-dependency**) · Binds: `mcp/**`, the golden-query gate, and `CONTRIBUTING.md:69`

ADR-0001 chose *whether* the server takes a dependency. This ADR records *where the line sits*, *what enforces it* (measured answer: nothing does today), and *what the server says when it cannot start*. It rules on `mcp/`, on the golden-query gate, and on the exact replacement text for one sentence of `CONTRIBUTING.md`. It amends no law file itself; §"The CONTRIBUTING.md:69 replacement" below is the authorised wording and §"When it lands" says when to apply it.

---

## Context

### 1. Verdict (c) removes the manifest question but not the seam question

ADR-0001 rules for a hand-rolled newline-delimited JSON-RPC 2.0 server over stdio, Node stdlib only, no `package.json` anywhere (`mcp/ADR-0001-runtime-and-dependency.md:83`, `mcp/runtime-pin.json:9-19`). That settles the server. It does **not** settle the gate: ADR-0001 also makes it a *hard requirement* that the golden-query gate drive the server through the real SDK `Client` + `StdioClientTransport` — "that is the only reason the zero-dep option is safe" (`ADR-0001:126`, `runtime-pin.json:50-53`). So one process in this system must import `@modelcontextprotocol/sdk` and one must not. Where those two meet is the seam, and until it is written down, "zero dependency" is ambiguous about a script that installs the SDK to test with.

### 2. Nothing in this repo can detect a dependency. Measured, not assumed.

All three gates were run against a planted violation on `develop` @ `4dd461a`, with `claude` **2.1.220** and Node **v24.18.0**:

| Gate | Clean tree | `mcp/package.json` + `mcp/node_modules` | ⊕ root `package.json` |
|---|---|---|---|
| `claude plugin validate . --strict` | PASS | **PASS** | **PASS** |
| `node scripts/validate.mjs` | PASS · 45252 assertions, 0 failures, 5 warnings | PASS (ADR-0001:39) | **PASS** · 45252 / 0 / 5 |
| `node scripts/smoke.mjs` | 26/27, 1 pre-existing FAIL | identical | identical |

`claude plugin validate . --strict` printed exactly one line in every configuration — `Validating marketplace manifest: /mnt/data/company/TheLoopSkill/.claude-plugin/marketplace.json` → `✔ Validation passed` — and never mentioned `package.json`, `node_modules`, or `mcp/` at all. `CONTRIBUTING.md:91-94` already warns that it "validates `.claude-plugin/*.json` only"; this measurement extends that warning to the dependency law specifically.

The other two are blind by construction:

- `scripts/validate.mjs:24` scopes its whole walk to `SKILLS_DIR = .claude/skills`, and `:600` does its `node --check` in `fs.mkdtempSync(path.join(os.tmpdir(), 'loopskill-validate-'))`, so nothing at the repo root or under `mcp/` is ever read.
- `scripts/smoke.mjs:25` — `if (e === '.git' || e === 'node_modules') continue` — skips a `node_modules` **by name**, i.e. it is the one script that would notice it and it is written to look away.

**So the "must not grow" rule at `CONTRIBUTING.md:69` and `scripts/validate.mjs:12-14` is enforced by prose and code review alone.** That is exactly the condition under which a later contributor deletes 98 hand-rolled lines, adds one import, sees three green gates, and ships. This ADR exists to make that not work.

### 3. The law is stated in five places, and one of them is already a precedent for the exemption

| File:line | Text | Kind |
|---|---|---|
| `CONTRIBUTING.md:69` | "Node stdlib only — the plugin has no `package.json` and no third-party dependencies, **and must not grow either**." | prohibition |
| `scripts/validate.mjs:12-14` | "No dependencies. Node stdlib only, deliberately: the plugin ships no package manifest and **must not grow one**." | prohibition |
| `CHANGELOG.md:42` | "**The plugin still has zero npm dependencies.** No Playwright, no `package.json`, no lockfile — `validate.mjs` and `smoke.mjs` remain stdlib-only." | observation |
| `.claude/skills/loop-frontend/references/verifying-motion.md:21` | "TheLoopSkill has **zero npm dependencies** … no `package.json` and no lockfile." | observation |
| `.claude/skills/loop-frontend/SKILL.md:109` | "Adding no dependency to the plugin is deliberate … TheLoopSkill, which is stdlib-only by design." | observation |

ADR-0001 inventoried four; the fifth (`loop-frontend/SKILL.md:109`) is added here for completeness. None of the five needs amending for correctness under (c) — the repo genuinely has no manifest. The reason to touch `CONTRIBUTING.md:69` is different and is stated in §"Why narrow the sentence at all".

**The precedent that decides the gate's shape is `scripts/render-diagrams.mjs:7-8`:**

> "Stdlib-only by design, like the rest of `scripts/`. The renderer itself is fetched on demand via `npx @mermaid-js/mermaid-cli`; no dependency is added to the repo."

That is a third script in `scripts/`, committed, stdlib-only in its own source, that reaches a third-party tool at run time (`:52`, `execFileSync('npx', args, …)`) and is not considered a dependency by anyone in this repo. The golden-query gate is the same shape, and this ADR rules it in under the same reasoning rather than inventing a new exemption.

### 4. `npx` will not work for the gate — measured

`render-diagrams.mjs` gets to use `npx` because `@mermaid-js/mermaid-cli` has an executable. `@modelcontextprotocol/sdk` does not: its `package.json` `bin` field is **`undefined`** (checked against the 1.29.0 install). `npx -y @modelcontextprotocol/sdk` cannot run a library with no bin — this confirms the open question ADR-0001 left behind.

What does work, measured from inside this repo with no repo manifest present:

```
npm install --prefix "$(mktemp -d)" --no-audit --no-fund @modelcontextprotocol/sdk@1.29.0   # 6009 ms cold
await import('file:///<prefix>/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js')  // → Client, function
await import('file:///<prefix>/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js')  // → StdioClientTransport, function
```

The prefix directory receives `package.json`, `package-lock.json` and `node_modules`; `git status --short` in the repo afterwards showed only the untracked `mcp/` that was already there. An absolute `file://` import resolves with no `NODE_PATH`, no repo manifest, and no `"type": "module"` — ESM ignores all three for a file URL. This is the mechanism, and it is a strict superset of what `validate.mjs:600` already does with `os.tmpdir()`.

### 5. There is no `.gitignore`, and that is load-bearing

`/mnt/data/company/TheLoopSkill/.gitignore` **does not exist** (`git check-ignore -v node_modules mcp/node_modules` matches nothing; the root contains exactly `CHANGELOG.md .claude .claude-plugin CONTRIBUTING.md docs .git .github INSTALL.md LICENSE mcp README.md scripts`). Nothing in this repo is generated, so nothing needs ignoring. That means "gitignore `node_modules`" is not a neutral housekeeping choice here — it would be the first entry in a new file, and it would silently normalise a directory the law forbids.

### 6. Boot failure today is illegible, and a static ESM import cannot be rescued

All measured on Node v24.18.0, driven by the real SDK 1.29.0 `Client` + `StdioClientTransport`:

| What the server does | What stderr shows | What the **client** sees |
|---|---|---|
| static `import` of a missing package | 19 lines, 10 stack frames, `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@modelcontextprotocol/sdk' imported from …`, trailing `Node.js v24.18.0`; exit **1** | `McpError: MCP error -32000: Connection closed` |
| `process.stderr.write(one line)` then `process.exit(78)` | **1 line** | `McpError: MCP error -32000: Connection closed` |
| boots, answers `initialize` and `tools/list`, returns `isError: true` on `tools/call` | nothing | **the diagnostic text itself**, in band |

Three facts fall out of that table and they are what the contract is built on:

1. **The client is useless as a diagnostic channel on a boot failure.** It reports `-32000 Connection closed` identically whether the cause was a missing package, a missing file, or a clean `exit(78)`. Claude Code shows the user "failed to connect" and nothing more. The *only* thing that varies is stderr.
2. **stderr does reach the operator.** `StdioClientTransport` spawns with `stdio: ['pipe', 'pipe', this._serverParams.stderr ?? 'inherit']` (`dist/esm/client/stdio.js:71`), documented at `client/stdio.d.ts:23`: "The default is `inherit`, meaning messages to stderr will be printed to the parent process's stderr." So one legible line is genuinely seen; 19 lines of node internals are genuinely seen too, and are worse than useless.
3. **A static import failure is unrecoverable — you cannot print anything instead of it.** Measured: with `process.on('uncaughtException', …)` registered on the first line, a static `import` of a missing package still produced the full 19-line dump and the handler **never fired** (module resolution happens during linking, before any of your code runs). The same failure wrapped in `try { await import(…) } catch (e) { … }` was caught cleanly and printed one line. Any "legible message instead of `ERR_MODULE_NOT_FOUND`" therefore *requires* that the risky specifier never appear in a static `import`.

---

## Decision

### D2.1 — The seam is `child_process.spawn`, not a directory

We will place the dependency boundary at the **process boundary**, not at a manifest path. `@modelcontextprotocol/sdk` may exist only in the *client* process the golden-query gate spawns *around* the server, resolved from a directory outside the repo. It may never appear in the server's module graph.

Stated as the invariant an implementer and a reviewer can both check in one command:

> **Every import specifier reachable from `mcp/server.mjs` begins with `node:`.**

That is the whole rule. It is stronger than "no `package.json`" (a bare `import 'zod'` needs no manifest to resolve if a sibling `node_modules` exists) and it is decidable by grep.

### D2.2 — Manifest, lockfile and `node_modules`: the ruling table

| Question | Ruling |
|---|---|
| Manifest location | **None.** No `package.json` at the repo root, under `scripts/`, or under `mcp/` — at any time. |
| Lockfile | **None.** No `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, or `bun.lock`. |
| `node_modules` committed? | **No.** |
| `node_modules` gitignored? | **No — and do not create a `.gitignore` for it.** The repo has none (§5). An ignore entry hides the violation from `git status`, which is currently the only place a stray install is visible at all, given that all three gates are blind (§2). Leaving it un-ignored means a contributor who runs `npm install` in the tree sees `?? node_modules/` on every `git status` until they remove it. That nuisance is the feature. |
| `node_modules` absent? | **Yes.** The only `node_modules` that exists during any operation of this repo lives under `os.tmpdir()`, is created by the gate, and is not the repo's to keep. |
| `"type": "module"` anywhere? | **No.** Not needed: every script in `scripts/` is `.mjs` and so is `mcp/server.mjs`. A root `"type"` field would be a manifest, which is the thing forbidden. |
| What `claude plugin validate . --strict` does with any of it | **Nothing.** Measured PASS with a scoped manifest, with a scoped `node_modules`, and with a root manifest; it reads `.claude-plugin/*.json` only and names only `marketplace.json` in its output. It is not evidence about dependencies and must never be cited as such. |

### D2.3 — The gate obtains the SDK the way `render-diagrams.mjs` obtains mermaid

The golden-query gate is a committed, stdlib-only script that acquires its third-party tool at run time and throws it away. Binding shape:

1. **Prefix is outside the repo.** `fs.mkdtempSync(path.join(os.tmpdir(), 'loopskill-mcpgate-'))`, mirroring `validate.mjs:600`. Never a path under `ROOT`. An env override `MCP_GATE_SDK_PREFIX` may point at a pre-warmed prefix (CI cache); if it resolves inside the repo tree the gate **fails** rather than proceeding.
2. **Install command** — `npm install --prefix <prefix> --no-audit --no-fund @modelcontextprotocol/sdk@1.29.0`, exact version, no caret, matching `runtime-pin.json:60-64` including the recorded integrity hash. ~6 s cold, network required.
3. **Import by absolute `file://` URL**, dynamically, inside `try/catch` — `file://<prefix>/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js` and `…/client/stdio.js`. Never a bare specifier, for the reason in §6.3.
4. **`npx` is not an option** for this package (§4). Do not "simplify" step 2 into an `npx` call; it has no bin.
5. **Cleanup is unconditional** — `rmSync(prefix, { recursive: true, force: true })` in a `finally`.
6. **The gate is the backstop the repo lacks.** Before it drives a single query it runs `assertNoDependencies()`, which fails the gate if any of the following is true:
   - `git ls-files` names a `package.json`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` or `bun.lock` at any path;
   - a `package.json`, lockfile or `node_modules` exists on disk under `ROOT` (excluding `.git`);
   - any `import`/`export … from`/`import(` specifier in `mcp/**/*.mjs` does not begin with `node:`.

   This puts the mechanical enforcement in new code under our control, without amending `scripts/validate.mjs`. The reviewer's manual equivalent, for a tree with no gate yet:

   ```bash
   git ls-files | grep -E '(^|/)(package(-lock)?\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lock)$' && echo VIOLATION
   grep -rhoE "from '[^']+'|import\('[^']+'" mcp --include='*.mjs' | grep -v "'node:" && echo VIOLATION
   ```

### D2.4 — Boot-failure contract

Under verdict (c) `ERR_MODULE_NOT_FOUND` is **unreachable in the server** — there is no non-`node:` specifier to fail. The contract therefore covers the failures that remain reachable, plus the one that returns the moment anyone takes ADR-0001's reversal path.

**C1 — Exit codes.** `0` clean shutdown · `78` (sysexits `EX_CONFIG`) configuration failure, **always preceded by exactly one legible stderr line** · `1` an unexpected crash, stack and all. A contributor or gate seeing `78` knows the message above it is the whole story; seeing `1` knows it is a bug in the server.

**C2 — stdout carries protocol bytes and nothing else, including on the failure path.** No `console.log` in any error branch. Diagnostics are `process.stderr.write`. (Restates `ADR-0001:87`; repeated here because the failure path is where it gets broken.)

**C3 — One-line stderr shape, fixed.** Every diagnostic is a single `\n`-terminated line:

```
theloopskill-mcp: <what failed> — <the concrete path or value> · fix: <one imperative>
```

Prefix `theloopskill-mcp: ` on every line so an operator scanning a session log can grep it out of Claude Code's own stderr. No stack, no multi-line wrap, no colour.

**C4 — The three exact strings.** These are literals, not paraphrases; the gate asserts on them.

*Source docs unreachable* (the reachable failure under (c) — a wrong `.mcp.json` path, a relocated `docs/`, a packaged plugin dir):

```
theloopskill-mcp: source docs not found — no docs/design/boundary-audit.json under <ROOT> · fix: set THELOOPSKILL_ROOT to a TheLoopSkill checkout, or correct the server path in .mcp.json
```

*Node too old:*

```
theloopskill-mcp: node 18 or newer required — running <process.version> · fix: upgrade node, or point .mcp.json "command" at a newer binary
```

*Dependencies not installed* — **unreachable today; mandated now so the reversal path cannot regress**. If ADR-0001's runner-up (a) is ever taken, this line and only this line replaces `ERR_MODULE_NOT_FOUND`:

```
theloopskill-mcp: dependencies are not installed — cannot resolve @modelcontextprotocol/sdk from <mcp dir> · fix: run `npm install --prefix mcp` (installing a plugin does not install its dependencies)
```

The parenthetical is the real diagnosis and is grounded in `ADR-0001:52-58`: the official `telegram` plugin ships `package.json` + `bun.lock` and no `node_modules`, and runs `bun install` on every launch precisely because plugin install does not install dependencies.

**C5 — How that third line is produced, since it cannot be caught.** Measured in §6.3: a static import failure bypasses `process.on('uncaughtException')` entirely. Therefore, if the server ever gains a third-party specifier, `mcp/server.mjs` must contain **no static import of it**. The entry file stays `node:`-only and does:

```js
let sdk
try { sdk = await import('@modelcontextprotocol/sdk/server/index.js') }
catch (e) {
  if (e?.code !== 'ERR_MODULE_NOT_FOUND') throw e
  process.stderr.write(`theloopskill-mcp: dependencies are not installed — cannot resolve @modelcontextprotocol/sdk from ${HERE} · fix: run \`npm install --prefix mcp\` (installing a plugin does not install its dependencies)\n`)
  process.exit(78)
}
```

**C6 — Missing source docs must degrade, not die.** This is the substantive half of the contract. Because the client sees `-32000 Connection closed` and nothing else when the server dies (§6.1), a server that `readFileSync`s its docs at module scope converts a one-word misconfiguration into "MCP server failed to connect" with no cause anywhere the user is looking. So:

- The **tool registry is static** — names, descriptions and hand-written JSON Schemas are literals in the source. Only the *answers* are parsed live from `docs/design/boundary-audit.json`, the skill `SKILL.md`s, and `execution-modes.md` §M8.
- The server therefore **always completes `initialize` and `tools/list`**, even with an unreadable source tree. It never reads a doc during startup.
- With the source tree unreachable it writes the C4 line once to stderr at startup and then answers every `tools/call` with a **successful** result carrying `isError: true` and that same text as `content[0].text`. Verified round-trip against the real SDK 1.29.0 client: `isError = true` and the full sentence arrive intact at the caller, which puts the fix instruction in front of the model and the user instead of in a log.
- Only C1's other two cases (unsupported Node, unresolvable dependency on the reversal path) exit `78`. Missing docs never exits.

**C7 — Root resolution is cwd-independent.** `ROOT` derives from `import.meta.url`, not `process.cwd()` — `path.dirname(path.dirname(fileURLToPath(import.meta.url)))` for a server at `mcp/server.mjs`. This is what `scripts/validate.mjs:23` and `scripts/render-diagrams.mjs:17` already do, and it is why the C4 "source docs" case is a genuine misconfiguration rather than a routine cwd accident. `THELOOPSKILL_ROOT` overrides it, for the packaged case where `mcp/` and `docs/` are separated.

### D2.5 — Paste this into `mcp/runtime-pin.json` as `"bootContract"` when `mcp/` is implemented

Kept as a fenced block rather than a new file so that `docs/design/README.md:3` — "**Two** machine-readable artifacts" — stays literally true (an ADR is prose, not a machine-readable artifact) and D1's `runtime-pin.json` is not edited by D2.

```json
"bootContract": {
  "adr": "docs/design/ADR-0002-dependency-seam-and-boot-contract.md",
  "exitCodes": { "clean": 0, "configError": 78, "crash": 1 },
  "stderrShape": "theloopskill-mcp: <what failed> — <concrete path or value> · fix: <one imperative>",
  "stdoutIsProtocolOnly": true,
  "messages": {
    "sourceDocsMissing": "theloopskill-mcp: source docs not found — no docs/design/boundary-audit.json under <ROOT> · fix: set THELOOPSKILL_ROOT to a TheLoopSkill checkout, or correct the server path in .mcp.json",
    "nodeTooOld": "theloopskill-mcp: node 18 or newer required — running <process.version> · fix: upgrade node, or point .mcp.json \"command\" at a newer binary",
    "depsNotInstalled": "theloopskill-mcp: dependencies are not installed — cannot resolve @modelcontextprotocol/sdk from <mcp dir> · fix: run `npm install --prefix mcp` (installing a plugin does not install its dependencies)"
  },
  "degradeNotDie": {
    "rule": "initialize and tools/list must succeed with an unreadable source tree; the tool registry is static and no document is read during startup",
    "failureShape": "successful tools/call result with isError:true and messages.sourceDocsMissing as content[0].text",
    "neverExitsOn": "missing or unreadable source documents"
  },
  "noStaticThirdPartyImport": {
    "rule": "a third-party specifier may never appear in a static import; use await import() in try/catch",
    "reason": "measured 2026-07-27 on node v24.18.0 — a static ESM resolution failure bypasses process.on('uncaughtException') and emits 19 lines / 10 frames of ERR_MODULE_NOT_FOUND that no handler can replace"
  },
  "rootResolution": "path.dirname(path.dirname(fileURLToPath(import.meta.url))), overridable by THELOOPSKILL_ROOT; never process.cwd()",
  "clientVisibleOnBootFailure": "McpError -32000 Connection closed, identical for every cause — stderr is the only diagnostic channel (SDK 1.29.0 dist/esm/client/stdio.js:71 spawns with stderr 'inherit')"
}
```

### D2.6 — The `CONTRIBUTING.md:69` replacement

#### Why narrow the sentence at all

Under (c) the sentence is not *false*. It is about to become *incomplete and misleading in a specific way*: a reader arriving after `mcp/` ships finds a directory the sentence never mentions, containing a program (not a skill, not a gate script) with a runtime of its own — the exact category of thing a dependency is normally bought for. Two readings become available, and the wrong one is the natural one: "the *plugin* has no dependencies; `mcp/` is a server, servers have dependencies." The narrowing must therefore *enumerate* the bound surfaces rather than leaving "the plugin" to be construed. It must simultaneously legalise what `scripts/render-diagrams.mjs:7-8` already does and the gate will do, in wording tight enough that it cannot be stretched into "so `mcp/` may `npm install` at startup."

Not weakened, on three counts: "must not grow" survives as "and there must not be"; the scope goes from one construable noun ("the plugin") to three named directories; and the run-time exemption is bounded to **scripts**, to **outside the repo**, and to **nothing declared, nothing committed**.

#### BEFORE — `CONTRIBUTING.md:69`, verbatim

> It exits **0** when the tree conforms and **non-zero** with a `file:line` for every violation. Node stdlib only — the plugin has no `package.json` and no third-party dependencies, and must not grow either. `scripts/validate.mjs` checks:

#### AFTER — the exact replacement for that line

> It exits **0** when the tree conforms and **non-zero** with a `file:line` for every violation. Node stdlib only, and that is a prohibition rather than a description: **no file committed to this repo may declare a dependency** — there is no `package.json`, no lockfile and no `node_modules` anywhere in the tree, not at the root, not under `scripts/`, not under `mcp/`, and there must not be. It binds all three committed surfaces: the skills in `.claude/skills/`, the gate scripts in `scripts/`, and the MCP server in `mcp/`, whose module graph is `node:` builtins only ([ADR-0002](docs/design/ADR-0002-dependency-seam-and-boot-contract.md)). What a **script** may still do is fetch a third-party tool *at run time* into a throwaway directory outside the repo and delete it afterwards — `scripts/render-diagrams.mjs` does this with `npx @mermaid-js/mermaid-cli`, and the MCP golden-query gate does it with `npm install --prefix` into `os.tmpdir()`. That is not a dependency: nothing is declared, nothing is committed, and a fresh clone still runs every gate with no install step. Note that **no gate can catch a violation of this rule** — `validate.mjs` only walks `.claude/skills`, `smoke.mjs` skips `node_modules` by name, and `claude plugin validate --strict` reads `.claude-plugin/*.json` and nothing else — so it is held up by review and by the MCP gate's own `assertNoDependencies()` preflight. `scripts/validate.mjs` checks:

Surgical properties, so the edit is unambiguous: it replaces **one sentence** inside line 69 and leaves the sentence before it and the trailing "`scripts/validate.mjs` checks:" byte-identical, so the markdown table on lines 71-81 still follows its lead-in. No other line of `CONTRIBUTING.md` changes.

#### When it lands

**In the same commit that adds `mcp/server.mjs`, not before.** Naming `mcp/` as a bound surface while `mcp/` contains only two design records advertises a rule about a directory that has no code in it. If `mcp/` is abandoned, this replacement is abandoned with it and `CONTRIBUTING.md:69` stands unchanged — which is the point of choosing (c).

If the gate's `assertNoDependencies()` (D2.3.6) is not built, delete the clause "and by the MCP gate's own `assertNoDependencies()` preflight" and end that sentence at "held up by review." Never leave the sentence claiming an enforcement that does not exist; the whole value of the paragraph is that it is honest about §2.

---

## Consequences

**Positive**

- **"Zero dependency" becomes decidable.** One grep over `mcp/**/*.mjs` for a non-`node:` specifier settles it, in a repo where all three existing gates measurably cannot (§2). The claim stops resting on nobody having looked.
- **The gate gets its SDK without contradicting the law**, under an exemption the repo already grants `render-diagrams.mjs:7-8` rather than a new one, with the mechanism measured end to end (§4) instead of assumed — including the fact that `npx` is not available for this package.
- **A misconfigured server tells the user what to do.** Today the entire vocabulary of a boot failure is `-32000 Connection closed`. C6 moves the diagnosis in band where the model reads it, verified round-trip through the real 1.29.0 client.
- **The reversal path is pre-paid.** If ADR-0001's runner-up is taken, the `ERR_MODULE_NOT_FOUND` regression is already forbidden and its replacement string already written, so the first consumer to `/plugin install` without an `npm install` gets a sentence instead of a stack.
- **`docs/design/README.md` stays true.** Its "Two machine-readable artifacts" (`:3`) counts JSON; this ADR is prose and D2.5 keeps the boot-contract JSON inside it rather than adding a third file.

**Negative**

- **The gate needs network and ~6 s.** `npm install --prefix` cold-installs 93 packages per run. Mitigation: `MCP_GATE_SDK_PREFIX` lets CI cache the prefix; the prefix must still resolve outside the repo or the gate fails. A CI job with no network cannot run this gate — it is a gate, not a unit test, and it belongs behind the same `on:` triggers as `validate.yml:3-7`, which today installs nothing at all (`:24-33`).
- **The enforcement lives in the newest, least-trusted script.** `assertNoDependencies()` sits in the gate rather than in `validate.mjs`, because D2 is not authorised to amend `validate.mjs`. So the backstop is skipped whenever the gate is skipped. Mitigation: it is a cheap pure-filesystem check with no SDK requirement, so it can run *before* the install step and still fail fast; folding it into `validate.mjs` as check 9 is the right permanent home and is named as an open question rather than done here.
- **Three literal strings are now API.** Changing the wording of a C4 message breaks a gate assertion. That is deliberate — an error message a test does not pin is an error message that rots — but it means message edits are contract edits.
- **Refusing a `.gitignore` costs a small recurring nuisance.** A contributor who runs `npm install` in the tree sees `?? node_modules/` until they clean up, and may "fix" it by adding the ignore. Mitigation: this ADR is the answer to that PR.
- **Next bottleneck:** packaging. Every ruling here assumes the server runs from a repo checkout wired by `.mcp.json`, which is the deferred-packaging assumption `ADR-0001:60` already makes. Once the plugin is installed from a marketplace, `ROOT` derived from `import.meta.url` (C7) is the only reason the docs are still findable, and `THELOOPSKILL_ROOT` is the only escape hatch if the install layout separates `mcp/` from `docs/`. Re-open at that point.

## Alternatives Considered

- **Gitignore `node_modules` and let contributors install freely** — rejected. `git status` is currently the *only* signal that a stray install exists, given that `claude plugin validate --strict`, `validate.mjs` and `smoke.mjs` all measured PASS with a planted `mcp/node_modules` (§2). Adding the ignore removes the last detector to buy tidiness, in a repo that has no `.gitignore` at all because nothing in it is generated.
- **Commit `node_modules` (vendoring) so `/plugin install` works with no install step** — rejected on the numbers in `ADR-0001:66`: 93 packages, 3,504 files, 15.4 MB, including two HTTP frameworks and a JOSE implementation, in a plugin whose HTTP transport is explicitly deferred. It also converts every SDK patch release into a repo-wide diff, and `loop-review/references/severity-model.md:78` already classes vendored trees as artifacts to report at the source, not review.
- **Scope the rule by wording it "the skills and the gate scripts", leaving `mcp/` unmentioned** — rejected: silence about `mcp/` is exactly the ambiguity that makes the sentence dangerous once a server ships. Enumerating all three surfaces costs one clause and closes the reading.
- **Amend `scripts/validate.mjs` with a check 9 for manifests and non-`node:` imports** — the *correct* long-term home, and rejected only for scope: it is a law file (`CONTRIBUTING.md:69-82` documents its eight checks by number) and D2 rules on `CONTRIBUTING.md:69` alone. Adding a ninth row means editing the check table too. Deferred deliberately, with the check specified in D2.3.6 so it can be lifted verbatim.
- **Let the server die on missing source docs, as any program would** — rejected on the measurement in §6.1: the client reports `-32000 Connection closed` for every cause, so dying converts a one-line fix into an opaque connection failure. Answering `initialize` and returning `isError` costs nothing (the tool registry is static literals anyway) and puts the fix instruction where the model can act on it.
- **Print a multi-line diagnostic with context and a stack** — rejected: stderr is inherited into Claude Code's own stream (`client/stdio.js:71`), where anything longer than a line is noise competing with the user's session. One prefixed, greppable line, and exit `78` to say the line is the whole story.
- **Do nothing — ADR-0001 already said "no dependency"** — rejected, and the measurement is the reason. ADR-0001 states the verdict; nothing on disk enforces it, `render-diagrams.mjs` already contradicts the naive reading of it, and the gate ADR-0001 mandates requires the very package the verdict forbids. Without this ADR the first contributor to notice that all three gates pass with an SDK import is right on the evidence available to them.
