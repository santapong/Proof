# ADR-0001: Build `theloopskill-mcp` on hand-rolled JSON-RPC over stdio, with no dependency and no package manifest

## Status

**Accepted**

Date: 2026-07-27 · Deciders: loop-scout (D1, Phase 1 DECIDE) · Blocks: all `mcp/` implementation

This ADR settles both halves of D1: **whether** the server takes a dependency, and **which SDK surface** it would use if it ever did. It rules on `mcp/` only. It amends no law file, because the option it selects requires no amendment.

---

## Context

The approved v1 line puts a stdio MCP server at `mcp/` in this repo: five tools (`route_node`, `boundary_lookup`, `estimate_phase`, `run_gate`, `standards_shelf`) parsed live from the source docs, skill files as read-only resources, `.mcp.json` wiring, four consumer skill routers, and a golden-query gate — with `scripts/validate.mjs` staying green. HTTP transport, deeper integration, journal tools, packaging and caching are deferred.

### The collision

Four places on disk assert the plugin has no manifest and no third-party dependency. Two of them are prohibitions, not observations:

| File:line | Text |
|---|---|
| `CONTRIBUTING.md:69` | "Node stdlib only — the plugin has no `package.json` and no third-party dependencies, **and must not grow either**." |
| `scripts/validate.mjs:12-14` | "No dependencies. Node stdlib only, deliberately: the plugin ships no package manifest and **must not grow one**." |
| `CHANGELOG.md:42` | "**The plugin still has zero npm dependencies.** No Playwright, no `package.json`, no lockfile…" |
| `.claude/skills/loop-frontend/references/verifying-motion.md:21` | "TheLoopSkill has **zero npm dependencies**… no `package.json` and no lockfile." |

The last two carry the *reason*, which is what makes this law rather than an accident: a library of skill definitions has no runtime of its own, so a dependency buys capability for something that never runs against this repo.

The plugin's own doctrine says the same thing about this exact subject. `.claude/skills/loop-harness/references/mcp.md:76` ends "…**no MCP involved, and no dependency added to this plugin**"; `:78` calls an MCP server "a real cost: a browser binary, a running server, and a broad tool surface." And `.claude/skills/loop-scout/SKILL.md:13` makes the dependency manifest the discriminator that decides whether a question is even a build-vs-buy question. Adding one here is not a neutral act inside this repo; it is the repo's own worked example of the thing it tells users to avoid.

### What the gates actually say

Measured on this tree, `develop` @ `4dd461a`, 2026-07-27:

| Configuration | `node scripts/validate.mjs` | `node scripts/smoke.mjs` | `claude plugin validate . --strict` |
|---|---|---|---|
| Baseline (clean tree) | **PASS** — 45252 assertions, 0 failures, 5 warnings | 27 executed, 26 passed, **1 pre-existing FAIL** | PASS |
| Scoped `mcp/package.json` + `mcp/node_modules` (93 pkgs) | **PASS** — 45252 assertions, 0 failures, 5 warnings | identical: 26 passed, same 1 FAIL | (unchanged) |
| Root `package.json` with `"type": "module"` | **PASS** — 45252 assertions, 0 failures, 5 warnings | identical: 26 passed, same 1 FAIL | **PASS** |

`validate.mjs` scopes its walk to `.claude/skills` (`SKILLS_DIR`, line 24) and does its `node --check` in `os.tmpdir()` (line 287), so a repo-root `"type"` field cannot reach it. `smoke.mjs` walks `ROOT` but skips `node_modules` by name (line 25) and only collects `*.workflow.js`.

**So the gates do not decide this.** All three options are mechanically green. The decision rests on the law text, the distribution model, and the measured cost — not on CI.

> The single `smoke.mjs` failure (`loop-v1/templates/v1-conductor.workflow.js` — "declares a planner node but `--planner fable` never routed to `claude-fable-5`") is **pre-existing on `develop` before any `mcp/` work**. It is recorded here as a baseline fact so the implementer is not blamed for it, and is out of scope for D1.

### What distribution actually does

`.claude-plugin/plugin.json` declares `"skills": ["./.claude/skills"]` and `marketplace.json` declares `"source": "./"` — the whole repo becomes the plugin root on install. The decisive evidence is in the official marketplace already on this machine:

`~/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/telegram/` ships `package.json`, `bun.lock`, `.npmrc`, `server.ts` and a `.mcp.json` — and **no `node_modules`**. Its start script is:

```json
"start": "bun install --no-summary && bun server.ts"
```

It reinstalls its dependencies on every launch because **plugin install does not install dependencies**. Three sibling plugins (`discord`, `fakechat`, `imessage`) do the same. There is no npm equivalent of that trick that does not add a visible install step or a vendored tree to every session start. A dependency-bearing node server at `mcp/` is dead on arrival after `/plugin install` until a human runs `npm install`.

Packaging is deferred for v1, so the server will first run from a repo checkout via `.mcp.json`, where this does not bite. But the manifest decision is the hard-to-reverse one: it is far cheaper to never take the dependency than to take it and unwind it once four skill routers point at the server.

### Measured cost of the dependency

Installed fresh into a scratch tree, `@modelcontextprotocol/sdk@1.29.0`:

- **93 packages** in the lockfile, 3,504 files, **15.4 MB** of content (25 MiB on disk).
- Direct dependencies of the SDK itself: **17** — `express@^5.2.1`, `hono`, `@hono/node-server`, `jose`, `ajv@^8`, `ajv-formats`, `cors`, `raw-body`, `cross-spawn`, `eventsource`, `eventsource-parser`, `content-type`, `pkce-challenge`, `express-rate-limit`, `json-schema-typed`, `zod`, `zod-to-json-schema`. "One dependency" is one *line*, not one *package*: it drags two HTTP frameworks and a JOSE implementation into a plugin whose approved v1 line explicitly **defers HTTP transport**.
- **Module load:** `import('@modelcontextprotocol/sdk/server/index.js')` = **137 ms** best-of-5, against 14 ms for `node:fs`.
- **Spawn-to-connected:** **290 ms** best-of-3, against **133 ms** for the hand-rolled server. ~157 ms added to every Claude Code session that has this server wired.

### Measured cost of *not* taking it

A hand-rolled server was written and driven by the **real SDK client** (`Client` + `StdioClientTransport` from `@modelcontextprotocol/sdk@1.29.0`) through `initialize` → `tools/list` → `tools/call` → `resources/list` → `resources/read`. It answered all five correctly, returned its hand-written JSON Schema byte-identical (including `additionalProperties: false`), and connected in 133 ms.

- **98 code lines total** (109 with comments) for framing + dispatch + errors + a two-tool, one-resource registry. The protocol layer alone is **~55 code lines**; the rest is registry that any option pays. The original D1 estimate of 150-200 lines is roughly double the measured figure.
- The thing being replaced is small on purpose: the SDK's entire stdio framing (`dist/esm/shared/stdio.js`) is **29 code lines** — newline-delimited JSON, `\r` tolerated, no Content-Length framing. There is no hidden complexity in the transport.
- The live-parse machinery the five tools need **already exists in this repo, dependency-free**: `scripts/validate.mjs` has `read()` (line 43), `walk()` (line 49), `parseFrontmatter()` (line 94) and `canonicalBlock()` (line 446, which already extracts `execution-modes.md` §M8 live rather than hardcoding it). The sources are `docs/design/boundary-audit.json` (743 lines, `JSON.parse` is free) and Markdown with the frontmatter shape that parser already handles. No parsing dependency is needed either.

---

## Decision

**We will implement `theloopskill-mcp` as a hand-rolled, newline-delimited JSON-RPC 2.0 server over stdio, using Node stdlib only — option (c).** No `package.json` anywhere in the repo, no lockfile, no `node_modules`, no amendment to `CONTRIBUTING.md:69`, `scripts/validate.mjs:12-14`, `CHANGELOG.md:42`, or `verifying-motion.md:21`. Those four assertions stay literally true after `mcp/` ships.

Binding constraints on the implementation:

1. **Framing** — read stdin as bytes, split on `\n`, strip a trailing `\r`, `JSON.parse` each line, write `JSON.stringify(msg) + '\n'` to stdout. Never write anything non-protocol to **stdout**; diagnostics go to **stderr**.
2. **Protocol version** — **echo the client's requested `protocolVersion` back verbatim** when it is one of the five frozen below, and reply `2025-06-18` otherwise. Verified negotiation behaviour of the 1.29.0 client: it requests `2025-11-25` and accepts any of `2025-11-25`, `2025-06-18`, `2025-03-26`, `2024-11-05`; it hard-rejects an unknown version with "Server's protocol version is not supported". Echo-back is unconditionally safe because a client's own version is by definition in its own supported set, and the four methods we implement are stable across all five versions.
3. **Methods** — `initialize`, `notifications/initialized` (swallow), `ping`, `tools/list`, `tools/call`, `resources/list`, `resources/read`. Everything else returns JSON-RPC `-32601`. Notifications (`id` absent or `null`) must never produce a response. Accept a JSON-RPC batch array.
4. **Schemas** — hand-written JSON Schema literals. This is not a compromise forced by the zero-dep choice; it is what the SDK's own low-level surface does too (see below).
5. **Errors** — `-32700` parse, `-32601` method not found, `-32602` bad params, `-32603` internal. A tool that fails at the domain level returns `isError: true` in a *successful* `tools/call` result, not a JSON-RPC error.
6. **Determinism** — `mcp/` is not scanned by `validate.mjs` check 4, but H10's spirit applies to anything the golden-query gate compares: no clock or randomness in tool output.

### Runner-up

**Option (a) — a scoped `mcp/package.json`, repo root left manifest-free.** This is the reversal path, not a rejected option: if the deferred HTTP transport, or a capability the hand-rolled server would have to grow into (sampling, elicitation, progress notifications, the experimental tasks surface), makes the SDK worth its cost, take it *scoped to `mcp/`*. It measured gate-neutral, it confines the blast radius, and it keeps `CONTRIBUTING.md:69`'s "the plugin has no `package.json`" true at the root where the sentence is read. Be honest that it is still an amendment — a scoped carve-out ("`scripts/` is stdlib-only; `mcp/` may declare exactly one dependency") — just a far smaller one than (b) demands.

### Second half — which SDK surface, if the runner-up is ever taken

**Use the low-level `Server` + `setRequestHandler` with hand-written JSON Schema. Never `McpServer` / `registerTool`.** Pin `@modelcontextprotocol/sdk` at exactly `1.29.0` — no caret.

Verified **2026-07-27** against a fresh install of the package that would actually ship, not the copy on this machine:

- **The local copy is stale and must not be developed against.** `/home/santapong/node_modules/@modelcontextprotocol/sdk` is **1.12.0**; npm `latest` is **1.29.0**, published 2026-03-30. That is 17 minor releases of drift.
- **One premise flipped between the two versions.** 1.12.0 genuinely has no `registerResource` — only the four `resource()` overloads. **1.29.0 has `registerResource`** (`dist/esm/server/mcp.d.ts:102-103`) and marks all four `resource()` overloads `@deprecated` (`:80`, `:85`, `:90`, `:95`). Writing against the installed 1.12.0 would have produced code targeting a surface that is deprecated on the version that ships. This is exactly why the pin is against a verified install.
- **The premise that matters did *not* flip.** 1.29.0's `registerTool` (`mcp.d.ts:150`) takes `InputArgs extends undefined | ZodRawShapeCompat | AnySchema`. `AnySchema` reads like a JSON Schema escape hatch and is not one: `dist/esm/server/zod-compat.d.ts:3` declares `export type AnySchema = z3.ZodTypeAny | z4.$ZodType`. Both branches are Zod. **The high-level `McpServer` cannot express a tool's input schema without authoring Zod**, which makes "one runtime dep" false — importing the SDK's hoisted `zod` without declaring it is a phantom dependency that breaks the moment anyone installs with pnpm or `--install-strategy=nested`.
- **The low-level surface holds the count at exactly one.** `Server` (`dist/esm/server/index.d.ts:73`), `registerCapabilities` (`:107`), `StdioServerTransport` (`dist/esm/server/stdio.d.ts:9`), and `setRequestHandler<T extends AnyObjectSchema>` (`dist/esm/shared/protocol.d.ts:389`). The schemas you hand it are **exported by the SDK itself** — `ListToolsRequestSchema` (`types.d.ts:2423`), `CallToolRequestSchema` (`:2749`), `ListResourcesRequestSchema` (`:1445`), `ReadResourceRequestSchema` (`:1607`) — so your source never imports `zod`. Measured: a 45-code-line low-level server passed hand-written JSON Schema straight through to the client unmodified.
- **Pin and provenance** — resolved `https://registry.npmjs.org/@modelcontextprotocol/sdk/-/sdk-1.29.0.tgz`, integrity `sha512-zo37mZA9hJWpULgkRpowewez1y6ML5GsXJPY8FI0tBBCd77HEvza4jDqRKOXgHNn867PVGCyTdzqpz0izu5ZjQ==`, `engines.node >= 18`. Recorded machine-readably in `mcp/runtime-pin.json`.

---

## Consequences

**Positive**

- **No law changes.** All four assertions survive verbatim; `CHANGELOG.md`'s "Not changed, deliberately" section gains a second worked example rather than a retraction.
- **The plugin stays installable with zero post-install steps** — the failure mode the official `telegram` plugin works around with `bun install` on every launch simply does not exist.
- **~157 ms faster session start** and 15.4 MB / 93 packages not carried, for a server whose whole job is to read files this repo already contains.
- **The repo keeps practising `loop-scout`'s own dependency-manifest test** (`loop-scout/SKILL.md:13`) instead of quietly failing it in its own tree.
- **Supply-chain surface is zero.** No transitive Express 5, Hono, JOSE, or Ajv in a process Claude Code spawns on every session.

**Negative**

- **We own the protocol.** Every future MCP spec revision is our maintenance, not the SDK's. Mitigated by scope: four methods, all stable across the five protocol versions in `SUPPORTED_PROTOCOL_VERSIONS`, and echo-back negotiation that does not need us to track which is latest. Trigger to revisit: the first time a *required* capability lands that we would have to hand-implement (elicitation, sampling, tasks).
- **No schema validation for free.** The SDK's Zod path would validate `tools/call` arguments before our handler sees them; hand-rolled means we check `required` ourselves. Mitigated: 5 tools with flat scalar inputs, and the golden-query gate covers the missing-argument cases by construction.
- **Manual conformance risk.** Nothing proves we are spec-correct except tests. Mitigated concretely: the golden-query gate **must** drive the server through `@modelcontextprotocol/sdk`'s real `Client` + `StdioClientTransport`, exactly as the D1 probe did — that is the only reason the zero-dep option is safe, and it is a hard requirement on the gate, not a suggestion. Running the SDK as a *test-time* tool via `npx`/a scratch tree adds no shipped dependency.
- **Next bottleneck:** the deferred HTTP/streamable transport. Hand-rolling SSE + session management + resumability is a genuinely larger job than hand-rolling stdio framing. If HTTP is un-deferred, re-open this ADR and take runner-up (a) rather than extending the hand-rolled server.

## Alternatives Considered

- **(a) Scoped `mcp/package.json`, root left manifest-free** — the runner-up, and the designated reversal path. Rejected for v1 because it still requires a law carve-out and still ships 93 packages that install does not install, to buy a 29-line framing routine we measured at 133 ms without it. Its real merit is blast-radius containment, which only matters once the dependency is actually needed.
- **(b) Root manifest plus an amended law** — rejected outright. Measured **identical** to (a) on `validate.mjs` (45252 assertions, 0 failures), on `smoke.mjs`, and on `claude plugin validate --strict`, so it buys nothing mechanical over (a). It costs strictly more: four law files amended including one that says "must not grow either", a manifest at the plugin root that install still will not act on, and the loss of the root-level sentence that makes the guarantee legible in `CONTRIBUTING.md`. Amending law for zero mechanical difference is the worst trade of the three.
- **High-level `McpServer` / `registerTool` on either (a) or (b)** — rejected on verified fact, not preference: `AnySchema` is `z3.ZodTypeAny | z4.$ZodType` (`zod-compat.d.ts:3`), so a declared `zod` is unavoidable and "one runtime dep" becomes two. The ergonomic win is small — 45 low-level lines vs a comparable high-level figure — and hand-written JSON Schema is what the tool contract wants anyway.
- **Pinning `1.12.0` because it is what is installed locally** — rejected: it is 17 minors stale and its resource API is deprecated on the shipping version. Pin against what you install, and install what ships.
- **Do nothing / defer the whole server** — rejected: the promise is approved and D1 exists precisely to unblock it. But note that (c) is the option that keeps deferral cheap — nothing to unwind if v1 is abandoned.
