#!/usr/bin/env node
// scripts/pack-host.mjs — generate a per-host skill pack from .claude/skills/.
//
// GOVERNING LAW: docs/design/ADR-0008-host-packaging-seam.md
//   D8.1  .claude/skills/ is the sole source of truth. A pack is generated, never hand-edited.
//   D8.2  Output goes to dist/<host>/ — NEVER to a path a host auto-discovers, because Cursor's
//         compatibility loader would then load every skill three times out of this one checkout.
//   D8.4  Four skills are held back by name (loop-engine, loop-harness, loop-skill, loop-autopilot).
//   D8.5  Rules rewrite HOST NOUNS only. A rule may never soften a claim about engineering.
//   D8.6  *.workflow.js excluded; every skill that loses one gains a stated degradation banner.
//   D8.7  One launch contract; three emitters. Track 1 changes `launch`, not this file.
//   D8.8  Output is byte-deterministic: sorted walk, no timestamps, no randomness.
//
// Node stdlib only — CONTRIBUTING.md:69 (no package manifest, no dependency) still holds.
//
// Usage: node scripts/pack-host.mjs <cursor|codex|antigravity|--all>
// Exit:  0 = packed; 1 = a rule went stale, a descriptor is malformed, or a source path is missing.

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DESC = JSON.parse(readFileSync(join(ROOT, 'scripts/host-targets.json'), 'utf8'))

const fail = (msg) => {
  console.error(`PACK FAIL — ${msg}`)
  process.exit(1)
}

// --- source walk (sorted, deterministic per D8.8) --------------------------------------------

function walk(dir, base = dir) {
  const out = []
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) out.push(...walk(abs, base))
    else out.push(relative(base, abs).split(sep).join('/'))
  }
  return out
}

// --- rule application ------------------------------------------------------------------------

const matchesGlob = (relPath, glob) => {
  // Only the one shape the descriptor uses: "<dir>/<*>.<ext>", matched against a skill-relative path.
  const rx = new RegExp('^' + glob.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$')
  return rx.test(relPath)
}

// Everything this file writes that was not in the source is fenced by these sentinels, so
// check-host-packs.mjs can scan packed prose for host-specific residue without counting the
// packer's own explanatory text (which names "Claude Code" on purpose).
const GEN_BEGIN = '<!-- heimdall-generated:begin -->'
const GEN_END = '<!-- heimdall-generated:end -->'
const fenced = (body) => `${GEN_BEGIN}\n${body}\n${GEN_END}`

/** Drop a heading and everything under it, down to the next heading of the same or higher level. */
function dropSection(text, heading, why) {
  const lines = text.split('\n')
  const start = lines.indexOf(heading)
  if (start === -1) return { ok: false }
  const level = heading.match(/^#+/)[0].length
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#+) /)
    if (m && m[1].length <= level) {
      end = i
      break
    }
  }
  const note = [heading, '', fenced(`> **Removed from this pack.** ${why}`), '']
  return { ok: true, text: [...lines.slice(0, start), ...note, ...lines.slice(end)].join('\n') }
}

/** Insert the degradation banner directly after the YAML frontmatter block. */
function insertBanner(text, banner) {
  const lines = text.split('\n')
  if (lines[0] !== '---') return banner + '\n\n' + text
  const close = lines.indexOf('---', 1)
  if (close === -1) fail('a SKILL.md has an unterminated frontmatter block')
  return [...lines.slice(0, close + 1), '', banner, ...lines.slice(close + 1)].join('\n')
}

// --- MCP config emitters (D8.7) ---------------------------------------------------------------

const tomlString = (s) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'

function emitMcpConfig(format, serverId, launch) {
  if (format === 'json-mcpServers') {
    return JSON.stringify({ mcpServers: { [serverId]: { command: launch.command, args: launch.args } } }, null, 2) + '\n'
  }
  if (format === 'toml-mcp-servers') {
    return [
      `# Append to ~/.codex/config.toml (or run: codex mcp add ${serverId} -- ${launch.command} ${launch.args.join(' ')})`,
      `[mcp_servers.${serverId}]`,
      `command = ${tomlString(launch.command)}`,
      `args = [${launch.args.map(tomlString).join(', ')}]`,
      '',
    ].join('\n')
  }
  return fail(`unknown mcp config format: ${format}`)
}

// --- the pack ---------------------------------------------------------------------------------

function pack(hostKey) {
  const host = DESC.hosts[hostKey]
  if (!host) fail(`unknown host "${hostKey}" — known: ${Object.keys(DESC.hosts).join(', ')}`)

  const c = DESC.common
  const srcRoot = join(ROOT, DESC.source)
  const outRoot = join(ROOT, DESC.outDir, hostKey)
  const held = new Set(c.heldBackSkills.map((h) => h.skill))
  const stubs = new Map(c.stubFiles.map((s) => [s.file, s]))
  const drops = c.dropSections
  const banner = fenced(c.banner.join('\n').replaceAll('{{HOST_NAME}}', host.displayName))
  const launch = { command: DESC.launch.command, args: DESC.launch.args.map((a) => a.replaceAll('{{REPO}}', ROOT)) }

  rmSync(outRoot, { recursive: true, force: true })

  const rewriteHits = new Map(c.rewrites.map((r) => [r.find, 0]))
  const dropHits = new Map(drops.map((d) => [d.file + '::' + d.heading, 0]))
  const written = []
  const skippedSkills = []
  const droppedFiles = []
  let totalSkills = 0

  for (const skill of readdirSync(srcRoot).sort()) {
    if (!statSync(join(srcRoot, skill)).isDirectory()) continue
    totalSkills++
    if (held.has(skill)) {
      skippedSkills.push(skill)
      continue
    }

    const files = walk(join(srcRoot, skill))
    const lostTemplate = files.some((f) => c.excludeGlobs.some((g) => matchesGlob(f, g.glob)))

    for (const rel of files) {
      const key = `${skill}/${rel}`
      if (c.excludeGlobs.some((g) => matchesGlob(rel, g.glob))) {
        droppedFiles.push(key)
        continue
      }

      let text
      const stub = stubs.get(key)
      if (stub) {
        text = fenced(c.stubBody.join('\n').replaceAll('{{HOST_NAME}}', host.displayName).replaceAll('{{FILE}}', key)) + '\n'
      } else {
        text = readFileSync(join(srcRoot, skill, rel), 'utf8')

        for (const d of drops.filter((d) => d.file === key)) {
          const r = dropSection(text, d.heading, d.why)
          if (r.ok) {
            text = r.text
            dropHits.set(d.file + '::' + d.heading, dropHits.get(d.file + '::' + d.heading) + 1)
          }
        }

        for (const r of c.rewrites) {
          const n = text.split(r.find).length - 1
          if (n > 0) {
            rewriteHits.set(r.find, rewriteHits.get(r.find) + n)
            text = text.replaceAll(r.find, r.replace)
          }
        }

        if (rel === 'SKILL.md' && lostTemplate) text = insertBanner(text, banner)
      }

      const dest = join(outRoot, 'skills', skill, rel)
      mkdirSync(dirname(dest), { recursive: true })
      writeFileSync(dest, text)
      written.push({ path: `skills/${skill}/${rel}`, sha256: createHash('sha256').update(text).digest('hex') })
    }
  }

  // A rule that stopped matching is a rule pointing at prose that moved — D8.5's closed list has rotted.
  for (const r of c.rewrites) {
    if (rewriteHits.get(r.find) < (r.minHits ?? 1)) {
      fail(`stale rewrite rule (${rewriteHits.get(r.find)} hits, expected >= ${r.minHits ?? 1}): "${r.find}"\n  fix: update or remove the rule in scripts/host-targets.json — ${r.why}`)
    }
  }
  for (const d of drops) {
    if (dropHits.get(d.file + '::' + d.heading) < 1) {
      fail(`stale dropSection rule — heading not found in ${d.file}:\n  "${d.heading}"\n  fix: the heading moved or was reworded; update scripts/host-targets.json`)
    }
  }

  // Host artefacts.
  const mcpText = emitMcpConfig(host.mcp.format, DESC.serverId, launch)
  writeFileSync(join(outRoot, host.mcp.file), mcpText)
  written.push({ path: host.mcp.file, sha256: createHash('sha256').update(mcpText).digest('hex') })

  const readme = [
    `# Heimdall — ${host.displayName} pack (generated)`,
    '',
    `Generated by \`scripts/pack-host.mjs\` from \`.claude/skills/\`. **Do not edit these files** — edit the source and re-pack (ADR-0008 §D8.1).`,
    '',
    `- **Skills:** ${totalSkills - skippedSkills.length} of ${totalSkills}. Held back as Claude Code-native (ADR-0008 §C2): ${skippedSkills.join(', ')}.`,
    `- **Tier:** ${host.tier} — skills load (A) and the \`${DESC.serverId}\` MCP tools are reachable (B). Multi-agent execution (C) is Claude Code-only; see the host note in each affected skill.`,
    `- **Excluded:** ${droppedFiles.length} \`*.workflow.js\` templates (ADR-0008 §D8.6).`,
    '',
    '## Install',
    '',
    '```sh',
    `# skills — project scope`,
    `mkdir -p <your-project>/${host.skillsInstallPaths.project}`,
    `cp -r skills/* <your-project>/${host.skillsInstallPaths.project}`,
    '',
    `# skills — global scope`,
    `mkdir -p ${host.skillsInstallPaths.global}`,
    `cp -r skills/* ${host.skillsInstallPaths.global}`,
    '```',
    '',
    `Then wire the MCP server: merge \`${host.mcp.file}\` into \`${host.mcp.installPath}\`.`,
    '',
    `> The launch command is an **absolute path resolved at pack time** (\`${launch.command} ${launch.args.join(' ')}\`), because no target host expands \`\${CLAUDE_PROJECT_DIR}\` (ADR-0008 §C5). Re-pack if the checkout moves. Requires \`node\` on PATH until Track 1 ships a binary.`,
    '',
    `**Known friction:** ${host.friction}`,
    host.note ? `\n**Note:** ${host.note}` : '',
    '',
    `Host paths verified ${DESC.verifiedOn} against vendor docs, not by installation — re-confirm before relying on them.`,
    '',
  ].join('\n')
  writeFileSync(join(outRoot, 'README.md'), readme)
  written.push({ path: 'README.md', sha256: createHash('sha256').update(readme).digest('hex') })

  // No timestamp in the manifest, deliberately — D8.8 wants two packs of one tree to be identical.
  const manifest = {
    host: hostKey,
    displayName: host.displayName,
    descriptorVersion: DESC.version,
    source: DESC.source,
    skillsPacked: totalSkills - skippedSkills.length,
    skillsInSource: totalSkills,
    heldBack: skippedSkills,
    templatesExcluded: droppedFiles.sort(),
    files: written.sort((a, b) => (a.path < b.path ? -1 : 1)),
  }
  writeFileSync(join(outRoot, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n')

  console.log(`packed ${hostKey}: ${manifest.skillsPacked} skills, ${written.length} files → ${relative(ROOT, outRoot)}/`)
  return manifest
}

// CLI only when invoked directly — scripts/check-host-packs.mjs imports pack() and must not
// trigger a run (or a process.exit) merely by importing this file.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = process.argv[2]
  if (!arg) fail(`usage: node scripts/pack-host.mjs <${Object.keys(DESC.hosts).join('|')}|--all>`)
  for (const h of arg === '--all' ? Object.keys(DESC.hosts) : [arg]) pack(h)
}

export { pack, DESC, ROOT }
