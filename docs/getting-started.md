# Your first task with Proof

Proof is a set of reusable engineering methods for a coding agent. You describe
an outcome; the agent selects a skill, works within your scope, checks the result
and leaves evidence for review. It does not guarantee a good product or make an
unconfigured host capable of every workflow.

This guide matches the **Proof 4 beta candidate**. All public skill names start
with `proof-`, with no old-name aliases. Published v3 has different names; see
[migration](migration-proof-4.md).

## Start one session

The full plugin targets Claude Code and needs a maintained Node.js installation
for `proof-mcp`. There are no npm dependencies to install. Use a reviewed Proof
checkout and your own normally configured host account. This review used Claude
Code 2.1.263 and Node 26.8.1 for offline checks; no paid host-model run was made.

From the project you want help with:

```sh
claude --plugin-dir /absolute/path/to/this-proof-checkout
```

Inside Claude Code:

```text
/proof:proof-guide I want a small tool for tracking workshop supplies. Help me define a first useful version.
```

Read the normal host trust/permission prompts. Inspect MCP connection state with
`/mcp` and discovery in the skills menu. Source files or a green manifest check
alone do not prove the installed connection. Do not disable protections to load it.

For a reduced Codex/Cursor/Antigravity knowledge pack, use [INSTALL §4](../INSTALL.md#4-other-hosts--cursor-openai-codex-antigravity-in-progress).
Those packs do not include the Workflow executor. Codex uses `$proof-guide` from
`.agents/skills`; inspect its MCP fragment before merging with existing settings.

## Describe the outcome

Provide a goal, starting state, constraints, what may change and an observable
success condition. Omit things you do not know; the guide should ask only the
questions needed to choose the next step.

Example for someone bringing an idea:

> I lose track of workshop supplies. One person should be able to add an item,
> change its quantity and see what is running low. Start with a plan, no paid
> services or deployment. Success is a small first-version brief I can review.

Expected output is a justified skill or small chain and a bounded next step.
A plan is not a built application. Restrictions continue across handoffs.

Example for a developer with a change ready:

```text
/proof:proof-review the diff from develop to this branch. Report reproducible defects with file/line evidence. Do not modify files.
```

A useful review states scope, supported findings, checked evidence, uncertainty
and next action. No supported finding is a valid result. Distinguish commands
actually run from commands suggested for later.

## Inspect one small example

The [discount fixture](examples/first-review/README.md) contains an intentional
arithmetic defect and an independent check that fails on it. It provides a
concrete review input and expected evidence. Running that check is not an AI
skill evaluation or proof of a complete host workflow.

Use the [26-skill catalog](skills.md) for the expected result and handoff of every skill.

## Larger work and troubleshooting

`proof-build` conducts an agreed software brief; `proof-orchestrate` plans a task
graph; `proof-engine` authors/runs a bounded host Workflow. Execution needs the
actual host capability and permissions. Start small; do not enable unrestricted
or automatic execution merely to try Proof. Reduced packs declare a sequential
path instead of pretending to supply the executor.

| Symptom | Check |
| --- | --- |
| Missing command | Confirm a Proof 4 checkout, plugin discovery and the plugin-qualified name |
| Old command fails | Follow migration; no aliases are provided |
| MCP cannot find source | Inspect the generated absolute path; use `PROOF_ROOT` only when overriding it |
| Workflow unavailable/denied | Check host capability/permissions; use the declared sequential path or report the unmet requirement |
| Model pin unavailable | Report the provider/account mismatch; do not silently substitute or claim a verified run |
| Copied references missing | Use the complete plugin or a generated pack rather than an incomplete folder |

Read [installation](../INSTALL.md), [overview](overview.md),
[team workflow](software-team.md) and the [launch review](reviews/developer-launch-2026-10-23.md).
