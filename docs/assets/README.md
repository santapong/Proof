# Proof artwork and architecture sources

Updated 23 October 2026 for the reviewed Proof 4 candidate. The banner follows
[Proof's identity](../identity.md). The architecture now makes inline work,
authorized optional Workflow, authoring-time MCP and reduced packs explicit.

## Current assets

| Asset | Editable source / purpose |
| --- | --- |
| `proof-banner-v4.png` | New identity illustration; [exact generation prompt](proof-banner-v4-prompt.md) |
| `proof-architecture.html` | Explorable source-pinned overview, delivered with Archify |
| `proof-architecture.architecture.json` | Editable overview geometry, text, relationships and source references |
| `proof-architecture.svg` / `.png` | README companion and light-theme raster alternative |
| `proof-workflow.svg` / `.png` | Native editable task story and raster alternative |
| `../c4/diagrams/*.svg` | All 18 detailed architecture/skill/4+1 views |
| `../c4/diagrams/src/*.mmd` | Their editable sources |
| `proof-architecture-verification-2026-10-23.json` | Current artifact identities and bounded check scopes |

The original `proof-banner.png`, [September prompt](proof-banner-prompt.md) and
`proof-architecture-verification.json` remain historical. Their old hashes and
checks do not describe newly rendered bytes. Earlier review/inventory receipts
remain snapshots of their pinned candidates.

## Source and semantic scope

The overview pins local source commit
`5ff9786a9ef8eae9440fd2b547f522880a0f1396`; its 15 source references are checked
against local Git blobs. GitHub source links require that commit to be published.
Nothing in this visual refresh pushes it.

The main path is skill library → agent session → evidence/next step. The
Workflow branch is conditional on a supported host and authorization. MCP is
source-backed authoring advice, not an executable tool inside the sandbox.
Reduced packs are a packaging branch and exclude the Workflow executor.
Detailed views preserve the remaining role, lifecycle and development facts.
The brand banner is an illustration, not another architecture diagram or an
execution record.

## Reproduce the overview

Archify 2.17.0-dev.1 is the installed documentation tool used here; it is not a
Proof runtime dependency. Set `PROOF_ARCHIFY` to that installation:

```sh
node "$PROOF_ARCHIFY/bin/archify.mjs" validate architecture docs/assets/proof-architecture.architecture.json --repo-root . --quality showcase --json
node "$PROOF_ARCHIFY/bin/archify.mjs" deliver architecture docs/assets/proof-architecture.architecture.json docs/assets/proof-architecture.html --repo-root . --quality showcase --json
node scripts/render-readme-architecture.mjs
```

Use the direct `/opt/brave.com/brave/brave` executable when available. The older
launcher can leave capture processes alive. For bounded browser evidence, run
Archify `visual-check` on the delivered HTML or a byte-identical copy under
ignored `dist/`; retain the artifact hash and copy identity. Raw screenshot/check
sidecars belong in that ignored run directory, not in the public source tree.

The native README generator uses the same JSON relationships with larger type;
it is a companion view, not a native HTML export. The PNG alternatives are
browser renders of those exact SVGs. Inspect the SVG in both themes and the
README at desktop/mobile widths after changes.

## Reproduce all detailed diagrams

```sh
node scripts/render-diagrams.mjs
```

The script uses Mermaid CLI **11.17.0**, a Chromium-based browser and deterministic
IDs. A stadium-shaped front-door node initially varied its Bezier control points despite seeded IDs; the atlas uses the same labeled role as a rectangle, verified by two identical renders. This is a renderer-specific recovery, not a general ban on that shape. It does not add a package manifest or a shipped dependency to Proof. Edit
the `.mmd`, rerender, and commit source and SVG together. The content/runtime
view labels instruction artifacts honestly; it is C4-inspired rather than a
claim that every reference document is a deployable application.

## Renderer recovery notes

These observations are scoped to this pinned rendering setup:

- Unquoted sequence-diagram messages treat a semicolon as a statement delimiter.
  The review-flow diagram uses `<br/>` for the affected label breaks.
- Independent scenario panels needed explicit inner directions and invisible
  subgraph links to keep reading order. Those links are layout controls, not
  task dependencies; the source comment states that distinction.
- A seed for element IDs does not alone establish byte-identical geometry.
  Inspect a differing SVG and verify the corrected source with repeated renders.

## Verification and licenses

The dated verification record distinguishes deterministic artifact checks,
bounded browser behavior, image-capable visual review and untested native host
execution. A local visual pass is not owner acceptance or marketplace approval.
Raw baseline, failed attempts, render logs and captures are under ignored
`dist/identity-architecture-20261023/`.

The HTML viewer includes the MIT-licensed Archify runtime by tt-a1i and Cocoon AI;
its [notice](ARCHIFY-LICENSE.txt) is retained. Proof's original source/artwork
follows the repository [MIT license](../../LICENSE). External method citations
are attributed in their guides; no third-party logo was adopted for the banner.
