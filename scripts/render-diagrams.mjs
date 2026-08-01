// Render every diagram source in docs/c4/diagrams/src/*.mmd to docs/c4/diagrams/<name>.svg.
//
// The .mmd files are the single source of truth for the repo's diagrams (C4 model,
// mermaid C4 syntax; the autonomy ladder is deliberately a flowchart — see README).
// Edit the .mmd, run this script, commit both the source and the .svg.
//
// Stdlib-only by design, like the rest of scripts/. The renderer itself is fetched
// on demand via `npx @mermaid-js/mermaid-cli`; no dependency is added to the repo.
// A Chromium-based browser is required: set MERMAID_BROWSER, or the script probes
// the common local install paths before letting puppeteer resolve its own.
import { readdirSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SRC = join(ROOT, 'docs/c4/diagrams/src')
const OUT = join(ROOT, 'docs/c4/diagrams')

const BROWSERS = [
  process.env.MERMAID_BROWSER,
  '/opt/brave.com/brave/brave-browser',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].filter(Boolean)
const browser = BROWSERS.find((p) => existsSync(p))

const work = mkdtempSync(join(tmpdir(), 'mmdc-'))
const puppeteerConfig = join(work, 'puppeteer.json')
if (browser) writeFileSync(puppeteerConfig, JSON.stringify({ executablePath: browser }))

const sources = readdirSync(SRC).filter((f) => f.endsWith('.mmd')).sort()
if (sources.length === 0) {
  console.error(`no .mmd sources found in ${SRC}`)
  process.exit(1)
}

let failed = 0
for (const f of sources) {
  const name = f.replace(/\.mmd$/, '')
  const args = [
    '-y', '@mermaid-js/mermaid-cli',
    '-i', join(SRC, f),
    '-o', join(OUT, `${name}.svg`),
    '-b', 'white', // readable in both GitHub themes; transparent would vanish in dark mode
    '--quiet',
  ]
  if (browser) args.push('-p', puppeteerConfig)
  try {
    execFileSync('npx', args, { stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: browser ? '1' : '' } })
    console.log(`✔ ${name}.svg`)
  } catch {
    failed++
    console.error(`✘ ${name}.svg failed`)
  }
}
rmSync(work, { recursive: true, force: true })
if (failed) {
  console.error(`${failed}/${sources.length} diagram(s) failed to render`)
  process.exit(1)
}
console.log(`${sources.length} diagram(s) rendered to ${OUT}`)
