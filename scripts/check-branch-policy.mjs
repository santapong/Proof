#!/usr/bin/env node
// Node stdlib only. Branch names are data, never shell commands.
import { parseArgs } from 'node:util'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const topic = '[a-z0-9]+(?:-[a-z0-9]+)*'
const work = new RegExp(`^(?:feat|fix|docs|chore|ci|build|refactor|perf|test|experiment|revert)/${topic}$`)
const hotfix = new RegExp(`^hotfix/${topic}$`)
const release = /^release\/(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/

export function checkBranchPolicy(head, base) {
  for (const [name, value] of Object.entries({ head, base })) {
    if (typeof value !== 'string' || !value || /\s/.test(value)) {
      throw new Error(`${name} must be a non-empty branch name without whitespace`)
    }
  }
  if (head === base) throw new Error('Source and target branches must differ')
  if (base === 'develop' && (work.test(head) || head === 'main')) return
  if (base === 'main' && (head === 'develop' || release.test(head) || hotfix.test(head))) return
  throw new Error(
    `Branch policy rejects ${JSON.stringify(head)} -> ${JSON.stringify(base)}. ` +
    'Ordinary work targets develop; develop, release/<x.y.z>, and hotfix/<topic> target main. ' +
    'See docs/branch-policy.md.'
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({
      options: { head: { type: 'string' }, base: { type: 'string' } },
      allowPositionals: false,
    })
    checkBranchPolicy(values.head, values.base)
    console.log(`Branch policy passed: ${values.head} -> ${values.base}`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
