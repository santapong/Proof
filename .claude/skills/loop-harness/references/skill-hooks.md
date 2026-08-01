# The skill-hook catalogue — mechanizing the fleet's rules, per project

Every Heimdall skill states rules; a rule Claude *follows* is persuasion, a rule the
harness *executes* is physics. This catalogue walks all twenty-two skills and names, for
each, the hook that would turn its sharpest rule into enforcement — or states honestly
that no hook applies and where that skill's enforcement actually lives.

**Read the deployment rule first.** These are **per-project scaffolds to install
selectively** with the rest of this skill's machinery — never plugin-global hooks. A hook
fires on every matching event in every session of the project that installs it; twenty-two
always-on hooks would be twenty-two taxes on every session. Install the two or three rows
whose failure mode your project has actually exhibited (the harness-engineering rule:
*every time the agent makes a mistake, engineer the environment so it can't make that
specific mistake the same way again*) — not the whole table. Mechanics — events, stdin
JSON, exit codes — are in `hooks.md`; script skeletons in `templates/hooks/`.

## Tier 1 — rules worth mechanizing (install when the risk is live)

| Skill | Rule being mechanized | Hook |
|---|---|---|
| **loop-autopilot** | AP6: protected paths — the loop must never touch what measures it | `PreToolUse` on Edit/Write: **deny** writes under the held-out suite, rubric, canary, and CI-gate paths. The one hook this catalogue recommends unconditionally wherever the improvement loop runs live. |
| **loop-autopilot** | H11: propose-only — never merge, never push `main` | `PreToolUse` on Bash: deny `git push origin main`, `gh pr merge`, `merge_pull_request`. Belt-and-braces under the Routine's own branch restrictions. |
| **loop-ship** | Weekly tags / releases are cut from the main checkout, gates green | `PreToolUse` on Bash: deny `git tag v*` unless the working tree is clean and the gate script exited 0 (check a marker file the gate writes). |
| **loop-review** | No secrets in diffs | `PreToolUse` on Edit/Write: scan the content payload for key/token patterns; deny with the match named. Cheaper than post-hoc scanning and fires before the secret exists on disk. |
| **loop-test** | A regression test fails before the fix and passes after | `Stop`: if the session touched `src/` but no test file, exit 2 with "name the test or say why none" — the never-end-red pattern generalized. |
| **loop-context** | Trace invariant 3 — a purged value appears nowhere after the purge | `PostToolUse` on Edit/Write: grep the written content for values listed in the project's `purged.txt`; flag on hit. Only meaningful in projects that maintain a purge list. |
| **loop-harness** (itself) | Settings changes are deliberate | `PreToolUse` on Edit/Write to `.claude/settings.json` / `hooks/`: **ask** — the harness's own config is the one file class where silent edits are never routine. |

## Tier 2 — mechanizable, but usually better left to CI or the engine

| Skill | Why the hook is second-best |
|---|---|
| **loop-engine** | Its rules (H1–H12) govern workflow *scripts*, and `validate.mjs` + `smoke.mjs` already enforce them at commit time — CI is the right event, not the session. |
| **loop-skill** | Same: the validation gate *is* the hook, anchored to the repo. |
| **loop-audit** / **loop-docs** | "Update the audit/docs in the same commit" is a CI diff-check (files A changed without files B), which sees the whole commit; a session hook sees one write at a time. |
| **loop-pattern** | "Behavior-preserving diff backed by tests" is the test suite's job; a Stop hook can only nag, CI can block. |
| **loop-frontend** | The gates that matter (reduced-motion, flash limits) need a rendered browser — a runtime check catalogue, not a session event. |
| **loop-orchestrate** / **loop-build** | Their gates are *inside* the workflow (sequential gating, repair rounds) where they can see cross-task state; a session hook cannot. |

## Tier 3 — no hook applies, and that is correct

**loop-design, loop-algo, loop-debug, loop-research, loop-scout, loop-integrate,
loop-operate, loop-incident.** Their rules are judgment under standards (is this
architecture sound, is this root cause proven, is this claim sourced) — exactly what a
deterministic command cannot evaluate. Their enforcement lives in their own verify
stages and gating votes. Writing a hook here would mechanize the *ritual* (a file was
touched) while missing the *rule* (the thinking was done), which is worse than nothing:
a green ritual reads as a checked rule.

## Composition rules

- **Deny-hooks name what they blocked and why** — a silent denial reads as a tool
  failure and burns a session on debugging the harness.
- **Ask-hooks are for one-way doors only** (settings edits, tag cuts). An ask on a
  routine action trains reflexive approval, which is AP1 with extra steps.
- **Every hook this catalogue installs is itself a protected path** for any project
  running loop-autopilot live — a self-improvement loop that can edit the hooks that
  constrain it is the DGM logging-deletion incident with a config file.
- Re-run this catalogue against a project **when a new failure occurs**, not on a
  schedule: hooks accrete one mistake at a time, each traceable to the incident that
  earned it.
