#!/usr/bin/env node
// Third-copy guard for the §M8 locator.
//
// scripts/validate.mjs:446 canonicalBlock() and mcp/lib/modes.mjs's locateM8() implement the same
// locate walk by contract (docs/design/ADR-0004 §D4.2). mcp/ code may only import node: builtins
// (ADR-0002 §D2.1), so mcp/lib/modes.mjs cannot import scripts/validate.mjs to reuse it directly —
// this script lives OUTSIDE mcp/ instead, imports BOTH, and asserts they agree on the current tree.
//
// Usage: node scripts/check-modes-extraction-parity.mjs
// Exit:  0 = the two locators agree byte-for-byte; 1 = they disagree (one of the two is wrong).
//
// This is a developer/CI parity check, not one of the two required gates (validate.mjs / smoke.mjs)
// — it does not replace either and is not wired into them.

import { canonicalBlock } from './validate.mjs'
import { locateM8 } from '../mcp/lib/modes.mjs'

const a = canonicalBlock() // { ok, block, docLine } | { ok:false, error }
const b = locateM8() // { ok, block, docLine, startLine, endLine, ... } | { ok:false, code, error }

if (!a.ok || !b.ok) {
  console.error('PARITY FAIL — one locator could not find the block:')
  console.error('  validate.mjs canonicalBlock():', a.ok ? 'ok' : a.error)
  console.error('  mcp/lib/modes.mjs locateM8()   :', b.ok ? 'ok' : `${b.code}: ${b.error}`)
  process.exit(1)
}

const aText = a.block.join('\n')
const bText = b.block.join('\n')

let failed = false
if (aText !== bText) {
  failed = true
  console.error('PARITY FAIL — block text differs between the two locators.')
  console.error(`  validate.mjs: ${a.block.length} lines starting at doc line ${a.docLine}`)
  console.error(`  modes.mjs:    ${b.block.length} lines starting at doc line ${b.docLine}`)
}
if (a.docLine !== b.docLine) {
  failed = true
  console.error(`PARITY FAIL — docLine differs: validate.mjs=${a.docLine} modes.mjs=${b.docLine}`)
}
if (b.startLine !== a.docLine) {
  failed = true
  console.error(`PARITY FAIL — modes.mjs startLine (${b.startLine}) does not equal validate.mjs docLine (${a.docLine})`)
}

if (failed) {
  process.exit(1)
}

console.log(`PARITY OK — both locators agree: ${a.block.length} lines, doc line ${a.docLine}, byte-identical block text.`)
process.exit(0)
