#!/usr/bin/env python3
# Ask-before-editing-the-harness (skill-hooks.md Tier 1, loop-harness row):
# edits to .claude/settings.json or .claude/hooks/ are one-way doors — surface
# an explicit ask. Also asks on `git push origin main` (releases are deliberate,
# and legitimate, so ask — never deny).
import json,sys
try: d=json.load(sys.stdin)
except Exception: sys.exit(0)
tool=d.get("tool_name",""); ti=d.get("tool_input",{})
def ask(reason):
    print(json.dumps({"hookSpecificOutput":{"hookEventName":"PreToolUse",
        "permissionDecision":"ask","permissionDecisionReason":reason}})); sys.exit(0)
if tool in ("Edit","Write"):
    p=ti.get("file_path","")
    if "/.claude/settings.json" in p or "/.claude/hooks/" in p:
        ask("harness config is a one-way door (skill-hooks.md): confirm this edit to "+p.split('/.claude/')[-1])
if tool=="Bash":
    c=ti.get("command","")
    if "push" in c and "origin main" in c.replace("  "," "):
        ask("pushing main is a release act — confirm deliberately (H11-adjacent)")
sys.exit(0)
