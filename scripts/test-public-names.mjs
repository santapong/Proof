#!/usr/bin/env node
// Offline clean-directory/stdio checks. No model or remote account is contacted.
import assert from 'node:assert/strict'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const scratch = mkdtempSync(join(tmpdir(), 'proof-public-install-'))
const installed = join(scratch, 'installed-proof')
let checks = 0
const check = async (name, fn) => { try { await fn(); checks++ } catch (e) { throw new Error(`${name}: ${e.message}`, { cause: e }) } }

function connect(root, extra = {}) {
  const child = spawn(process.execPath, [join(installed, 'mcp/server.mjs')], {
    cwd: scratch, env: { PATH: process.env.PATH, PROOF_ROOT: root, ...extra }, stdio: ['pipe', 'pipe', 'pipe'],
  })
  let id = 0, stderr = ''
  const pending = new Map()
  child.stderr.on('data', chunk => { stderr += chunk })
  const lines = createInterface({ input: child.stdout })
  lines.on('line', line => {
    let message
    try { message = JSON.parse(line) } catch (e) { for (const waiter of pending.values()) waiter.reject(e); return }
    const waiter = pending.get(message.id)
    if (waiter) { clearTimeout(waiter.timer); pending.delete(message.id); waiter.resolve(message) }
  })
  child.on('error', error => { for (const waiter of pending.values()) { clearTimeout(waiter.timer); waiter.reject(error) }; pending.clear() })
  child.on('exit', code => { for (const waiter of pending.values()) { clearTimeout(waiter.timer); waiter.reject(new Error(`Server exited ${code}: ${stderr.slice(-500)}`)) }; pending.clear() })
  return {
    request(method, params = {}) {
      const key = ++id
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(key); reject(new Error(`Timed out: ${method}`)) }, 10000)
        pending.set(key, { resolve, reject, timer })
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: key, method, params }) + '\n')
      })
    },
    notify(method) { child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n') },
    close() { child.stdin.end(); child.kill(); lines.close() },
  }
}

try {
  mkdirSync(installed)
  for (const name of ['mcp', '.claude/skills', 'docs/design']) cpSync(join(ROOT, name), join(installed, name), { recursive: true })
  const names = readdirSync(join(installed, '.claude/skills')).sort()
  await check('only canonical Proof skills are installed', () => {
    assert.equal(names.length, 26)
    assert(names.every(name => name.startsWith('proof-')))
    for (const name of names) assert(readFileSync(join(installed, '.claude/skills', name, 'SKILL.md'), 'utf8').includes(`name: ${name}\n`))
  })
  await check('server and all tool handlers share the advertised version', () => {
    const expected = JSON.parse(readFileSync(join(ROOT, 'mcp/runtime-pin.json'), 'utf8')).serverInfo.version
    for (const file of ['route_node', 'estimate_phase', 'boundary_lookup', 'standards_shelf', 'run_gate']) {
      const code = readFileSync(join(ROOT, `mcp/lib/${file}.mjs`), 'utf8')
      assert.equal(code.match(/const SERVER_VERSION = '([^']+)'/)?.[1], expected, file)
    }
  })

  const client = connect(installed)
  try {
    await check('installed server initializes from another working directory', async () => {
      const reply = await client.request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'proof-clean-install-test', version: '1.0' } })
      assert.equal(reply.result.serverInfo.name, 'proof-mcp')
      assert.equal(reply.result.serverInfo.version, '0.3.0-beta.1')
      client.notify('notifications/initialized')
    })
    await check('installed server exposes its five actual tools', async () => {
      const reply = await client.request('tools/list')
      assert.deepEqual(reply.result.tools.map(t => t.name).sort(), ['boundary_lookup', 'estimate_phase', 'route_node', 'run_gate', 'standards_shelf'])
    })
    await check('canonical public name resolves through real stdio', async () => {
      const reply = await client.request('tools/call', { name: 'boundary_lookup', arguments: { skill: 'proof-review' } })
      assert(!reply.error && !reply.result.isError)
      assert(JSON.stringify(reply.result).includes('proof-review'))
      assert.equal(JSON.parse(reply.result.content[0].text).serverVersion, '0.3.0-beta.1')
    })
    await check('legacy public name is rejected, not aliased', async () => {
      const reply = await client.request('tools/call', { name: 'boundary_lookup', arguments: { skill: 'loop-review' } })
      assert(reply.result.isError)
      assert(JSON.stringify(reply.result).includes('not_found'))
    })
    await check('installed standards resolve the new directory', async () => {
      const reply = await client.request('tools/call', { name: 'standards_shelf', arguments: { skill: 'proof-review', query: 'OWASP' } })
      assert(!reply.error && !reply.result.isError)
      assert(JSON.stringify(reply.result).includes('proof-review'))
      assert.equal(JSON.parse(reply.result.content[0].text).serverVersion, '0.3.0-beta.1')
    })
    await check('resource content matches installed canonical source', async () => {
      const reply = await client.request('resources/list')
      const resource = reply.result.resources.find(r => r.uri.includes('proof-review') && r.uri.endsWith('SKILL.md'))
      assert(resource, 'Missing canonical skill resource')
      const read = await client.request('resources/read', { uri: resource.uri })
      assert(read.result.contents.some(c => c.text?.includes('name: proof-review')))
    })
  } finally { client.close() }

  const incomplete = join(scratch, 'incomplete-root'); mkdirSync(incomplete)
  const boundary = connect(incomplete)
  try {
    await check('an incomplete installation never reports a successful lookup', async () => {
      await boundary.request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'proof-incomplete-test', version: '1.0' } })
      const reply = await boundary.request('tools/call', { name: 'boundary_lookup', arguments: { skill: 'proof-review' } })
      assert(reply.result.isError)
    })
  } finally { boundary.close() }

  await check('legacy root setting fails with an actionable migration message', () => {
    const result = spawnSync(process.execPath, [join(installed, 'mcp/server.mjs')], { cwd: scratch, env: { PATH: process.env.PATH, THELOOPSKILL_ROOT: installed }, encoding: 'utf8', timeout: 10000 })
    assert.notEqual(result.status, 0); assert(result.stderr.includes('configure PROOF_ROOT'))
  })
  await check('generated Codex installation uses current paths and portable metadata', () => {
    const descriptor = JSON.parse(readFileSync(join(ROOT, 'scripts/host-targets.json'), 'utf8')).hosts.codex
    assert.equal(descriptor.skillsInstallPaths.project, '.agents/skills/')
    assert.equal(descriptor.skillsInstallPaths.global, '~/.agents/skills/')
    const target = join(scratch, 'consumer/.agents/skills'); mkdirSync(target, { recursive: true })
    cpSync(join(ROOT, 'dist/codex/skills'), target, { recursive: true })
    const entries = readdirSync(target).filter(name => { try { return readFileSync(join(target, name, 'SKILL.md'), 'utf8') } catch { return false } })
    assert.equal(entries.length, 22)
    for (const name of entries) {
      assert(name.startsWith('proof-'))
      const header = readFileSync(join(target, name, 'SKILL.md'), 'utf8').split('---')[1]
      assert(!header.includes('argument-hint:'))
    }
  })
  await check('teaching fixture exposes its intentional defect independently', () => {
    const result = spawnSync(process.execPath, [join(ROOT, 'docs/examples/first-review/check.mjs')], { encoding: 'utf8', timeout: 10000 })
    assert.equal(result.status, 1)
    assert(result.stderr.includes('190') && result.stderr.includes('180'))
  })
  console.log(`public-names: ${checks} clean-directory/protocol checks passed; no host model or marketplace validation claimed.`)
} finally { rmSync(scratch, { recursive: true, force: true }) }
