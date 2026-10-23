#!/usr/bin/env node
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { checkBranchPolicy } from './check-branch-policy.mjs'

let checks = 0
for (const prefix of ['feat', 'fix', 'docs', 'chore', 'ci', 'build', 'refactor', 'perf', 'test', 'experiment', 'revert']) {
  assert.doesNotThrow(() => checkBranchPolicy(`${prefix}/123-context-advisor`, 'develop'))
  assert.throws(() => checkBranchPolicy(`${prefix}/123-context-advisor`, 'main'))
  checks += 2
}
for (const [head, base] of [
  ['develop', 'main'], ['main', 'develop'], ['release/3.1.0', 'main'],
  ['release/0.0.1', 'main'], ['hotfix/released-regression', 'main'],
]) {
  assert.doesNotThrow(() => checkBranchPolicy(head, base))
  checks++
}
for (const [head, base] of [
  ['main', 'main'], ['develop', 'develop'], ['hotfix/regression', 'develop'],
  ['release/3.1.0', 'develop'], ['release/v3.1.0', 'main'], ['release/03.1.0', 'main'],
  ['release/3.1', 'main'], ['release/3.1.0-rc1', 'main'], ['feat/example', 'staging'],
  ['feature/example', 'develop'], ['Feat/example', 'develop'], ['feat/', 'develop'],
  ['feat/UPPER', 'develop'], ['feat/two_words', 'develop'], ['feat/two--words', 'develop'],
  ['feat/-leading', 'develop'], ['feat/trailing-', 'develop'], ['feat/nested/name', 'develop'],
  ['feat/name\n', 'develop'], ['feat/two words', 'develop'], ['feat/$(echo-danger)', 'develop'],
  ['feat/name;echo-danger', 'develop'], ['feat/../main', 'develop'],
  [undefined, 'develop'], ['feat/example', undefined], ['', 'develop'],
]) {
  assert.throws(() => checkBranchPolicy(head, base))
  checks++
}

const cli = fileURLToPath(new URL('./check-branch-policy.mjs', import.meta.url))
for (const [args, expected] of [
  [['--head', 'feat/example', '--base', 'develop'], 0],
  [['--head', 'feat/example', '--base', 'main'], 1],
  [['--head', 'feat/example'], 1],
  [['--unknown'], 1],
  [[], 1],
]) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' })
  assert.equal(result.status, expected, result.stderr)
  assert(!result.error)
  checks++
}
console.log(`Branch policy: ${checks} checks passed`)
