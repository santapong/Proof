# Documentation artwork

These assets serve different reading levels. The overview is a small map for
the README; the detailed C4 and skill diagrams remain in `../c4/diagrams/`.

| Asset | Source and purpose |
| --- | --- |
| `proof-banner.png` | Original project banner; [generation prompt](proof-banner-prompt.md) |
| `proof-architecture.svg` | Dual-theme README SVG generated from the same architecture specification with larger type |
| `proof-architecture.html` | Explorable architecture, generated with Archify 2.17 |
| `proof-architecture.architecture.json` | Editable architecture specification and pinned source references |
| `proof-workflow.svg` | Native, hand-authored SVG explaining one software-team phase |
| `proof-architecture-verification.json` | Artifact hashes and bounded validation/visual-review evidence |

The new SVGs contain vector text and shapes, with light/dark palettes and no
scripts, external images, or `foreignObject`. Markdown alt text and adjacent
prose preserve the meaning when an image cannot load. Click an embedded SVG to
inspect it at full size. The workflow SVG is its own editable source; the
architecture SVG is generated and should be rerendered after a spec change.

## Architecture evidence

The overview was checked against commit
`2b24538454c72618a3d7ef077c21170ddde17694` of Proof. It links 11 source references
covering manifests, the guide/engine entrypoints, harness and routing policies,
lifecycle gates, the MCP server/contracts, and host packaging.

The arrows show loading, execution, return, governance, authoring advice, and
pack generation. They do not imply that MCP is callable inside the workflow
sandbox, that a workflow result merges code, or that portable packs include the
Claude-specific execution engine. Optional local ML is described separately in
the [software-team guide](../software-team.md); it is not a required runtime
component and is disabled by default.

## Reproduce the overview

Use an installed copy of [Archify](https://github.com/tt-a1i/archify), version
2.17 for these exact artifacts. It is a documentation authoring tool, not a
Proof runtime dependency. From the repository root, set `PROOF_ARCHIFY` to that
installation and run:

```sh
node "$PROOF_ARCHIFY/bin/archify.mjs" validate architecture docs/assets/proof-architecture.architecture.json --repo-root . --quality showcase --json
node "$PROOF_ARCHIFY/bin/archify.mjs" deliver architecture docs/assets/proof-architecture.architecture.json docs/assets/proof-architecture.html --repo-root . --quality showcase --json
node "$PROOF_ARCHIFY/bin/archify.mjs" visual-check docs/assets/proof-architecture.html --json
```

If browser discovery needs help, set `ARCHIFY_CHROME` to the actual Chrome,
Chromium, or Brave executable. On the verified Linux environment, the direct
`/opt/brave.com/brave/brave` binary completed and closed cleanly; its
`brave-browser` launcher left the temporary check browser running after capture.

For the README companion, run `node scripts/render-readme-architecture.mjs`.
This small Node-stdlib renderer reads the same JSON nodes and relationships,
uses larger typography for embedded images, and rejects layouts it cannot
represent. The HTML viewer also offers **Export → SVG** for its own canonical
presentation (the suggested filename is `proof.svg`). Keep the JSON, HTML,
README SVG, and verification record together. A source change requires a new inspection,
revision pin, validation, and visual review. Do not overwrite a failed export
with an old successful image.

The automated viewer check covers 1440×900, 1600×1000, 1920×1080, and 2048×1320,
plus light/dark captures at the two endpoint sizes. That is browser evidence,
not a substitute for inspecting labels, arrows, clipping, and contrast. The
SVGs also need inspection as embedded images at README and mobile widths.

## Detailed C4 diagrams

Edit `docs/c4/diagrams/src/<name>.mmd`, then run
`node scripts/render-diagrams.mjs` and commit source/output together. The ten
updated detailed diagrams in this change were rendered with Mermaid CLI
11.17.0 and a local Brave browser. The existing script obtains Mermaid through
`npx`; it does not install dependencies into this repository.

## Credits

The generated architecture viewer and export include the MIT-licensed Archify
runtime, by tt-a1i and Cocoon AI. Its [license notice](ARCHIFY-LICENSE.txt) is
included alongside the artifacts. Proof's original artwork and documentation
follow the repository [MIT license](../../LICENSE).
