#!/usr/bin/env node
import { rankContext, trainModel } from './lib/software-context.mjs'

const HELP = `Proof software context helper — local, advisory, no provider calls.

  node scripts/software-context.mjs rank --task "review this pull request for defects"
  node scripts/software-context.mjs rank --skill loop-review
  node scripts/software-context.mjs train --data docs/examples/software-routing-train.jsonl --out /tmp/proof-routing.json
  node scripts/software-context.mjs rank --task "debug an intermittent crash" --model /tmp/proof-routing.json

rank: --task TEXT or --skill NAME; optional --model FILE and --limit 2..5 (default 3).
train: --data FILE --out NEW_FILE; only reviewed train rows with provenance are accepted.
Both: --root PATH (default: repository containing this script), --help.
Outputs JSON. Model is opt-in; stale/malformed artifacts fail. Scores are uncalibrated.
Read complete SKILL.md entrypoints and required references; preserve canonical tiers/gates.
Character/4 token proxy excludes reference and execution usage; it is not billed savings.
Training records: {id,split:"train",task,skill,reviewed:true,provenance:{kind:"synthetic"|"team-reviewed",reviewer,source}}.
Synthetic fixtures demonstrate behavior only; accuracy needs independent team evaluation.`

try {
  const args = process.argv.slice(2)
  if (!args.length || args.includes('--help')) {
    console.log(HELP)
  } else {
    const command = args.shift()
    const allowed = command === 'rank' ? ['task', 'skill', 'model', 'limit', 'root']
      : command === 'train' ? ['data', 'out', 'root'] : []
    if (!allowed.length) throw new Error('Expected rank or train; see --help.')
    const options = {}
    while (args.length) {
      const flag = args.shift()
      const name = flag.startsWith('--') ? flag.slice(2) : ''
      if (!allowed.includes(name) || Object.hasOwn(options, name) || !args.length) throw new Error(`Invalid or duplicate option ${flag}; see --help.`)
      options[name] = args.shift()
    }
    const result = command === 'rank' ? rankContext({ root: options.root, task: options.task,
      skill: options.skill, modelPath: options.model, limit: options.limit === undefined ? 3 : Number(options.limit) })
      : trainModel({ root: options.root, dataPath: options.data, outPath: options.out })
    console.log(JSON.stringify(result))
  }
} catch (error) {
  console.error(JSON.stringify({ ok: false, code: error.code || 'invalid_argument', message: error.message }))
  process.exitCode = 1
}
