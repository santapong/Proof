#!/usr/bin/env node
// Readable static companion to the validated Archify source. No runtime dependencies.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = new URL('../docs/assets/proof-architecture.architecture.json', import.meta.url)
const output = new URL('../docs/assets/proof-architecture.svg', import.meta.url)
const spec = JSON.parse(readFileSync(source, 'utf8'))
const escape = (value) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])
const nodes = new Map(spec.components.map(node => [node.id, node]))
const parts = []
const width = Math.max(...spec.components.map(n => n.pos[0] + n.size[0])) + 40
const height = Math.max(...spec.components.map(n => n.pos[1] + n.size[1])) + 64
parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
<title id="title">${escape(spec.meta.title)}</title>
<desc id="description">Skills load into an authoring session governed by shared policies and assisted by MCP tools. The host executes the workflow and returns evidence to a human gate. Portable packs are generated separately.</desc>
<style>
:root{color-scheme:light dark;--bg:#f7fafc;--card:#fff;--ink:#102838;--muted:#4c6373;--stroke:#bfd3df;--accent:#007c83;--support:#61748d;--policy:#a6491c;--policy-bg:#fff2e8}
@media(prefers-color-scheme:dark){:root{--bg:#101c28;--card:#172b3b;--ink:#edf7fa;--muted:#aec4d0;--stroke:#466479;--accent:#65e2d2;--support:#9aaed0;--policy:#ffbe8c;--policy-bg:#3a2d29}}
text{font-family:Arial,sans-serif;fill:var(--ink)}
.node-title{font-size:20px;font-weight:700}.node-detail{font-size:13px;fill:var(--muted)}
.edge-label{font-size:14px;fill:var(--muted)}.note{font-size:14px;fill:var(--muted)}
.card{fill:var(--card);stroke:var(--stroke);stroke-width:1.5}.governance{fill:var(--policy-bg);stroke:var(--policy);stroke-width:1.5}
.edge{fill:none;stroke:var(--accent);stroke-width:2;marker-end:url(#arrow)}.support{stroke:var(--support);stroke-dasharray:6 5;marker-end:url(#support-arrow)}
</style>
<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="var(--accent)"/></marker><marker id="support-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="var(--support)"/></marker></defs>
<rect width="${width}" height="${height}" rx="18" fill="var(--bg)"/>`)

for (const edge of spec.connections) {
  const a = nodes.get(edge.from), b = nodes.get(edge.to)
  if (!a || !b) throw new Error(`Unknown edge endpoint: ${edge.id}`)
  const [ax, ay] = a.pos, [aw, ah] = a.size, [bx, by] = b.pos, [bw, bh] = b.size
  let start, end
  if (ay === by) {
    const forward = bx > ax
    start = [ax + (forward ? aw : 0), ay + ah / 2]
    end = [bx + (forward ? 0 : bw), by + bh / 2]
  } else if (ax === bx) {
    const down = by > ay
    start = [ax + aw / 2, ay + (down ? ah : 0)]
    end = [bx + bw / 2, by + (down ? 0 : bh)]
  } else throw new Error(`Static overview requires aligned endpoints; review layout for ${edge.id}`)
  const x = (start[0] + end[0]) / 2, y = (start[1] + end[1]) / 2
  const labelWidth = edge.label.length * 8 + 16
  const labelY = ay === by ? y - 18 : y
  parts.push(`<g data-edge-id="${escape(edge.id)}"><path class="edge${edge.variant === 'emphasis' ? '' : ' support'}" d="M${start}L${end}"/><rect x="${x-labelWidth/2}" y="${labelY-16}" width="${labelWidth}" height="22" rx="4" fill="var(--bg)"/><text class="edge-label" x="${x}" y="${labelY}" text-anchor="middle">${escape(edge.label)}</text></g>`)
}
for (const node of spec.components) {
  const [x,y] = node.pos, [w,h] = node.size
  parts.push(`<g data-node-id="${escape(node.id)}"><rect class="${node.type === 'security' ? 'governance' : 'card'}" x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/><text class="node-title" x="${x+w/2}" y="${y+35}" text-anchor="middle">${escape(node.label)}</text><text class="node-detail" x="${x+w/2}" y="${y+59}" text-anchor="middle">${escape(node.sublabel)}</text></g>`)
}
parts.push(`<text class="note" x="40" y="${height-24}">Solid arrows: task path. Dashed arrows: supporting inputs and pack generation.</text></svg>\n`)
writeFileSync(output, parts.join('\n'))
console.log(`Rendered ${nodes.size} nodes and ${spec.connections.length} relationships to ${fileURLToPath(output)}`)
