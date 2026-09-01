# Hooks

Hooks are shell commands Claude Code runs automatically at lifecycle events — to inject context, enforce policy, or react to actions. They turn "remember to do X" into "X happens on its own."

## Structure in settings.json

```json
{
  "hooks": {
    "<EventName>": [
      {
        "matcher": "<pattern>",
        "hooks": [
          { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/my-hook.sh" }
        ]
      }
    ]
  }
}
```

Nesting: `hooks` → event name → array of matcher objects → each has a `matcher` and a `hooks` array of `{ "type": "command", "command": ... }`. Optional per-hook fields include `timeout` (seconds) and `statusMessage`.

- **matcher** — for tool events it matches the tool name (`"Bash"`, `"Edit|Write"`, `"*"`); for `SessionStart` it matches the source (`startup`, `resume`, `clear`, `compact`); empty/omitted matches all.
- Reference project files with **`${CLAUDE_PROJECT_DIR}`** and keep scripts under `.claude/hooks/`, marked executable (`chmod +x`).

## The events you'll use most

| Event | Fires | Typical use |
|---|---|---|
| `SessionStart` | session begins/resumes | inject context, run setup, load env |
| `UserPromptSubmit` | user submits a prompt | add context, validate input |
| `PreToolUse` | before a tool runs | guard/deny dangerous actions |
| `PostToolUse` | after a tool succeeds | format, lint, test edited files |
| `Notification` | Claude sends a notification | desktop/OS notify |
| `Stop` | Claude finishes responding | summarize, remind, check state |
| `SubagentStop` | a subagent finishes | aggregate subagent output |
| `PreCompact` | before context compaction | persist state |
| `SessionEnd` | session terminates | cleanup |

## The full event surface — 33 events, and the nine above are not most of them

The table above is the working set, not the catalogue. Claude Code exposes **33 hook events**;
this reference documented **9** until the list below was confirmed against the primary source
(`code.claude.com/docs/en/hooks`, 1 Sep 2026). Several of the missing 24 are squarely harness
business, which is why the omission mattered rather than being a completeness quibble.

**Permission and failure — the ones most often wanted and not found:**

| Event | Fires | Why a harness cares |
|---|---|---|
| `PermissionRequest` | a permission is about to be asked for | shape or pre-answer prompts instead of interrupting a run |
| `PermissionDenied` | a permission was refused | record what the harness could not do, rather than losing it in scrollback |
| `PostToolUseFailure` | **after a tool call fails** | the counterpart to `PostToolUse`, which fires only on success — a formatter hung off `PostToolUse` silently never runs on the failure path |
| `StopFailure` | a response ends in failure | distinguish a failed turn from a completed one |

**Session and configuration lifecycle:**

| Event | Fires |
|---|---|
| `Setup` | initial setup |
| `InstructionsLoaded` | CLAUDE.md / instructions have loaded |
| `ConfigChange` | configuration changed mid-session |
| `CwdChanged` · `DirectoryAdded` | working directory moved or a directory was added |
| `FileChanged` | a file changed on disk |
| `WorktreeCreate` · `WorktreeRemove` | git worktree lifecycle |
| `PostCompact` | after compaction — the partner to `PreCompact`, for restoring what was persisted |
| `PreModelSwitch` · `PostModelSwitch` | around a model change |

**Agents, tasks and interaction:**

| Event | Fires |
|---|---|
| `SubagentStart` | a subagent begins — the partner to `SubagentStop` |
| `TaskCreated` · `TaskCompleted` | task lifecycle |
| `TeammateIdle` | a teammate goes idle |
| `UserPromptExpansion` | a prompt is expanded |
| `MessageDisplay` | a message is displayed |
| `PostToolBatch` | after a batch of tool calls |
| `Elicitation` · `ElicitationResult` | around an elicitation request |

**Two asymmetries worth internalising**, because both produce hooks that appear to work and
silently do not: `PostToolUse` fires on **success only** — the failure path is
`PostToolUseFailure`, a separate event — and `PreCompact` has a partner, `PostCompact`, so a
hook that persists state before compaction has somewhere to restore it afterwards.

**Confirmation log:** the 33-event list was read from `code.claude.com/docs/en/hooks` on
1 Sep 2026. This surface moves; re-confirm before relying on a specific event, and treat a
missing event as "check the docs", never as "does not exist".

## Input: JSON on stdin

Every hook receives a JSON event on stdin. Common fields:

```json
{
  "session_id": "…",
  "transcript_path": "/…/transcript.jsonl",
  "cwd": "/…",
  "hook_event_name": "PreToolUse"
}
```

Tool events add `tool_name` and `tool_input` (e.g. `tool_input.command` for Bash, `tool_input.file_path` for Edit/Write). `SessionStart` adds `source`; `UserPromptSubmit` adds `prompt`. Read it with `INPUT=$(cat)` then `jq -r '.tool_input.file_path' <<<"$INPUT"`.

## Output: control by exit code

| Exit | Effect |
|---|---|
| `0` | Proceed. If stdout is JSON, its fields apply (see below); otherwise stdout is shown/ignored per event. |
| `2` | **Block.** stderr is fed back to Claude as feedback. Blocks `PreToolUse`, `UserPromptSubmit`, etc. |
| other | Non-blocking error: stderr shown as a warning; the action proceeds. |

On exit `0`, a hook may print JSON to control flow:

- Add context (any event): `{ "additionalContext": "…" }` — injected into Claude's context. For `SessionStart`, use `{ "hookSpecificOutput": { "hookEventName": "SessionStart", "additionalContext": "…" } }`.
- Gate a tool (`PreToolUse`): `{ "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "allow|deny|ask", "permissionDecisionReason": "…" } }`.
- Stop the turn: `{ "continue": false, "stopReason": "…" }`.

## High-value recipes (shipped as templates)

- **SessionStart context/setup** (`templates/hooks/session-start.sh`) — print project reminders, current branch, and recent commits as `additionalContext`; the model starts each session oriented.
- **PreToolUse secret/danger guard** (`templates/hooks/guard-secrets.sh`) — inspect `tool_input`; `exit 2` if a command or file path touches `.env`, `.ssh`, `.aws`, or a destructive `rm -rf`. A belt-and-suspenders backstop to the `deny` permission rules.
- **PostToolUse formatter** — on `Edit|Write`, pipe the changed `file_path` to your formatter: `jq -r '.tool_input.file_path' | xargs npx prettier --write 2>/dev/null || true`. Keep it non-fatal so a missing formatter never blocks work.

## Testing a hook

Pipe it a sample event and check the exit code:

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | .claude/hooks/guard-secrets.sh; echo "exit=$?"
```

## The misuse catalogue — guardrails that cost more than they save

The sections above tell you how to write a hook; this one tells you which guardrails not to install. Four rows are hook designs; two (allowlist rot, the untraceable deny) reach into the `permissions` layer, catalogued here because the failure presents identically in-session. Every entry has the same shape: the guard still reads as installed, the protection it implies has quietly stopped existing, and the operator pays for both. Per-skill rows live in `skill-hooks.md`; these are design-level and skill-agnostic.

| Misuse | Why it fails | Detection signal | Fix — and the rule it extends |
|---|---|---|---|
| **Deny on a sometimes-legitimate action** | A hard block the user must occasionally get past trains them to disable the hook — and a disabled hook protects nothing while still reading as installed. | The deny appears in transcripts followed by a workaround; the user edits settings or re-runs the action outside the harness to finish normal work. | Reserve `deny` for actions never legitimate in this project; a one-way door that is occasionally legitimate gets `ask` with a reason string — the line `permissions.md` draws (deny is the never-allow floor, ask is for the irreversible). Extends the ask-hooks composition rule in `skill-hooks.md` from the deny side — that rule stops asks becoming denials of attention; this one stops denies becoming asks nobody configured. |
| **Hook that duplicates CI** | Two implementations of one check drift apart, and the session copy is the weaker one: a `PreToolUse` hook judges a single tool call with no view of the whole change. When the copies disagree, the operator debugs the disagreement instead of the work. | The hook script and a CI step assert the same rule in different code, and one has been updated without the other. In this repo, `scripts/validate.mjs` and `scripts/smoke.mjs` own their checks — a session hook restating either in its own code would be a duplicate on day one. | One implementation per check, invoked from every point that needs it: this repo's `stop-gate.sh` runs `scripts/validate.mjs` at `Stop`, the same script CI runs, so the two firing points can never disagree. What genuinely splits is the check itself — whole-commit invariants (file A changed without file B, suite green) belong to CI; single-action guards (secrets, protected paths) belong to the session, which fires before the damage exists. `skill-hooks.md` Tier 2 is the worked version of this rule. |
| **Slow `SessionStart` hook** | A tax on every session for a rarely-needed benefit. SessionStart is the one event whose whole cost the operator feels directly — it runs before the first prompt, on every startup, resume, clear, and compact — so it taxes the session before any work exists to justify it. | Perceptible session-open lag; the hook makes network calls, installs dependencies, or runs a build before the first prompt. | Budget hooks like alerts: cost per firing × firing rate. SessionStart gets cheap local reads only (branch, reminders, marker files); expensive setup moves behind an explicit command or a rarer matcher (`startup`, not all four sources). Extends the deployment rule in `skill-hooks.md` — "twenty-two taxes on every session" — with the formula that prices each tax. |
| **Ask that fires routinely** | Trains reflexive approval — AP1 with extra steps, already named in the `skill-hooks.md` composition rules. The extension here is the metric. | Asks-per-session climbing; approvals arriving faster than the ask text can be read. | Track asks-per-session per rule. Any ask approved near-always is either safe (promote to `allow`) or mis-scoped (tighten the matcher until only the genuinely rare case prompts). An ask that no longer produces a decision produces only delay. |
| **Allowlist rot** | Permission entries naming tools or commands that renamed or vanished are silent no-ops that still read as protection — the list looks maintained precisely because nothing ever fires. | An `allow`/`deny` entry no transcript has matched since the tool it names was renamed; `mcp__<server>__*` rules for servers no longer in `.mcp.json`. | Prune when a tool renames or a server is removed, not on a schedule — the accretion discipline `skill-hooks.md` sets for hooks, applied to `permissions` (syntax in `permissions.md`). A deny whose target you cannot name is a deny you cannot trust. |
| **Deny nobody can trace** | A block with no reason string reads as a tool failure, so the operator debugs the harness instead of the work — the exact cost hooks exist to avoid, now inflicted by one. | A blocked action retried verbatim; a session that pivots to diagnosing "why is Bash broken" instead of routing around the rule. | Every block carries its reason: `permissionDecisionReason` on JSON output, stderr on `exit 2`, naming what matched and which rule owns it. Generalizes the first composition rule in `skill-hooks.md` from deny-hooks to every deny the harness emits — permission rules included. |

Two of these are measurable before they hurt: asks-per-session (rising means an ask is mis-scoped) and SessionStart wall-time (anything the operator can feel is over budget). Instrument both when installing a hook, not after the complaint.
