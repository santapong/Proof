#!/usr/bin/env node
// scripts/check-host-packs.mjs — the gate for ADR-0008 §D8.8.
//
// Packs every host twice and asserts, per host:
//   1. DETERMINISM  — two packs of one tree produce byte-identical manifests.
//   2. HELD BACK    — none of the four Claude Code-native skills (§C2/§D8.4) leaked into a pack.
//   3. NO TEMPLATES — no *.workflow.js survived (§D8.6).
//   4. NO FORBIDDEN TOKENS — no ${CLAUDE_*} expansion or .claude/settings.json reference remains.
//   5. NO DANGLING REFERENCES — every `references/*.md` a packed SKILL.md points at exists in the pack.
//   6. BANNER       — every skill that lost a template states it (§D8.6).
// Plus a non-failing report of `warnTokens` residue, which is how the next rewrite rule gets found.
//
// This is a developer/CI check, deliberately NOT folded into scripts/validate.mjs — that script
// scopes its walk to .claude/skills and must keep doing exactly that.
//
// Usage: node scripts/check-host-packs.mjs
// Exit:  0 = every host pack is clean; 1 = at least one assertion failed.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { pack, DESC, ROOT } from './pack-host.mjs'

const failures = []
const warnings = []
const fail = (host, msg) => failures.push(`[${host}] ${msg}`)

function walk(dir, base = dir) {
  const out = []
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) out.push(...walk(abs, base))
    else out.push(relative(base, abs).split(sep).join('/'))
  }
  return out
}

const held = new Set(DESC.common.heldBackSkills.map((h) => h.skill))

for (const hostKey of Object.keys(DESC.hosts)) {
  const first = pack(hostKey)
  const second = pack(hostKey)

  // 1. determinism
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    fail(hostKey, 'NON-DETERMINISTIC — two packs of the same tree differ. Something time-, order- or randomness-dependent got into the packer (D8.8).')
  }

  const outRoot = join(ROOT, DESC.outDir, hostKey)
  const files = walk(outRoot)
  const carriedPaths = new Set((first.carriedFromHeldBack ?? []).map((c) => `skills/${c.file}`))

  for (const rel of files) {
    const text = readFileSync(join(outRoot, rel), 'utf8')
    // The packer fences everything it inserts. Its own notes name "Claude Code" deliberately, so
    // strip them before scanning — otherwise every banner reports itself as residue.
    const authored = text.replace(/<!-- heimdall-generated:begin -->[\s\S]*?<!-- heimdall-generated:end -->/g, '')

    // 2. held-back skills. A carried reference file (D8.9) is allowed — it is an appendix, declared
    // in the manifest. A SKILL.md is never allowed: that is the router, and shipping it is what D8.4
    // exists to prevent.
    const skill = rel.startsWith('skills/') ? rel.split('/')[1] : null
    if (skill && held.has(skill)) {
      if (rel.endsWith('/SKILL.md')) fail(hostKey, `held-back skill's router leaked into the pack: ${rel} (D8.4)`)
      else if (!carriedPaths.has(rel)) fail(hostKey, `file from held-back skill "${skill}" is in the pack but not declared in carryFiles: ${rel} (D8.4/D8.9)`)
    }

    // 3. templates
    if (rel.endsWith('.workflow.js')) fail(hostKey, `workflow template survived packing: ${rel} (D8.6)`)

    // 4. forbidden tokens — scoped to packed skill content. The pack's own generated artefacts
    // (README.md, MANIFEST.json, the MCP config) legitimately name the tokens they exist to explain.
    if (rel.startsWith('skills/')) {
      for (const tok of DESC.common.forbiddenTokens) {
        if (authored.includes(tok)) fail(hostKey, `forbidden token ${JSON.stringify(tok)} in ${rel} (D8.5) — add a rewrite rule, drop the section, or hold the skill back`)
      }
      for (const tok of DESC.common.warnTokens) {
        const n = authored.split(tok).length - 1
        if (n > 0) warnings.push(`[${hostKey}] ${rel}: ${n}× ${JSON.stringify(tok)}`)
      }
    }

    // 5. dangling references + 6. banner
    if (rel.endsWith('/SKILL.md')) {
      const skillDir = rel.slice(0, -'/SKILL.md'.length)
      for (const m of text.matchAll(/`(references\/[a-z0-9._-]+\.md)`/g)) {
        if (!existsSync(join(outRoot, skillDir, m[1]))) {
          fail(hostKey, `${rel} points at ${m[1]}, which is not in the pack — stub it (D8.6) rather than leaving the pointer dangling`)
        }
      }
      // 5b. Cross-skill pointers. Held at warning level through H0, promoted to a failure in H1
      // once all 32 were closed by the D8.9 carry pass — a packed skill that points at a file the
      // pack does not contain is a broken skill, and the next one to appear should stop CI.
      for (const m of text.matchAll(/`(\.\.\/loop-[a-z-]+[a-z0-9._/-]*)`/g)) {
        if (!existsSync(join(outRoot, skillDir, m[1]))) {
          fail(hostKey, `${rel} points outside the pack at ${m[1]} (D8.9) — carry the file, stub it, or hold this skill back too`)
        }
      }

      const lostTemplate = first.templatesExcluded.some((p) => p.startsWith(skillDir.replace('skills/', '') + '/'))
      if (lostTemplate && !text.includes('Host note — generated pack')) {
        fail(hostKey, `${rel} lost a workflow template but carries no degradation banner (D8.6)`)
      }
    }
  }
}

if (warnings.length) {
  console.log(`\nResidual host-specific prose (${warnings.length} — informational, not a failure):`)
  for (const w of warnings.slice(0, 40)) console.log('  ' + w)
  if (warnings.length > 40) console.log(`  … and ${warnings.length - 40} more`)
  console.log('Each line is a candidate for a rewrite rule in scripts/host-targets.json.\n')
}

if (failures.length) {
  console.error(`\nHOST PACK CHECK FAILED — ${failures.length} problem(s):`)
  for (const f of failures) console.error('  ' + f)
  process.exit(1)
}

console.log(`host packs OK — ${Object.keys(DESC.hosts).length} host(s) checked, ${warnings.length} residual-prose warning(s).`)
