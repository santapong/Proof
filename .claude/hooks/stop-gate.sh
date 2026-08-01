#!/usr/bin/env bash
# Never-end-red (skill-hooks.md Tier 1, loop-test row, adapted to this repo):
# if the session leaves skills/mcp/scripts dirty, the validation gate must pass
# before the session may stop. Clean tree -> instant exit; gate green -> exit 0;
# gate red -> exit 2 with the failure lines, which blocks the stop and hands
# Claude the reason.
cd "$(dirname "$0")/../.." || exit 0
git status --porcelain -- .claude/skills mcp scripts 2>/dev/null | grep -q . || exit 0
OUT=$(node scripts/validate.mjs 2>&1) && exit 0
echo "validation gate is RED — fix before ending the session (never-end-red):" >&2
echo "$OUT" | grep -E '^  fail|FAILED' | head -10 >&2
exit 2
