# Proof for a software team

Start with the deliverable. A reproducible bug belongs to `loop-debug`; a diff to assess belongs to `loop-review`; a request for tests belongs to `loop-test`. Use `loop-guide` when the owner is unclear. Carry the issue, relevant revision, acceptance evidence and current work to the next person or agent so each handoff can resume without rediscovering the task.

The focused instructions live in [software-team intake](../.claude/skills/loop-guide/references/software-team.md), [context efficiency](../.claude/skills/loop-context/references/software-efficiency.md), and [skill improvement](../.claude/skills/loop-autopilot/references/skill-improvement.md). Read the reference for the current task. Small work should not expand into a full lifecycle or an agent team by default.

## Get a small reading plan

Run these commands from a Proof source checkout with Node installed:

```sh
node scripts/software-context.mjs rank --skill loop-review
node scripts/software-context.mjs rank --task "Review the changes on this branch for defects"
```

The JSON response suggests candidate skills and complete entrypoints to read. Follow their instructions and load the relevant references as needed. It does not execute the skills, determine approval, or choose a cheaper execution model. An unclear task can produce an abstention; consult the boundary questions or ask for the missing deliverable.

The helper reports characters and a rough token proxy for an explicit reading-surface comparison. A lower number than loading every skill does not establish savings against Proof's existing progressive loading. Record actual input/output/cache usage and retries during comparable team tasks before claiming billed-token savings.

## Try a small local ML model

```sh
node scripts/software-context.mjs train \
  --data docs/examples/software-routing-train.jsonl \
  --out /tmp/proof-routing.json
node scripts/software-context.mjs rank \
  --task "Review the changes on this branch for defects" \
  --model /tmp/proof-routing.json
```

The supplied training records are English synthetic demonstrations reviewed by an agent. They are not production feedback or user endorsements; multilingual routing has not been evaluated. Training creates a local model artifact; passing `--model` explicitly enables its advisory candidate list. The lexical result and normative boundaries remain available. Model scores are not calibrated confidence, and the command does not change the existing model-tier routing.

Use reviewed, sanitized team examples for a subsequent trial, with the task, correct skill, provenance and review recorded in the training schema shown by `--help`. Keep evaluation examples separate. A missing, malformed or stale model requires correction/retraining, not silent acceptance. Store models outside the source tree; omit `--model` to return to the baseline.

## Improve from evidence

Use one observed failure or user correction to propose a narrow skill change. Record the task and source revision, before/after behavior, independent acceptance evidence, observed usage (or explicitly missing usage), and a rollback reference. Trial the candidate against a frozen evaluation. Promote only the claims the evidence supports; preserve negative results and retain the evaluator when the candidate fails.

This is a task-time procedure. No learner, scheduler, provider telemetry collector, or automatic deployment is enabled by these changes. The [design decision](design/ADR-0011-software-context-advisor.md) defines the experiment and its limits.

## Local trial result — 2026-09-09

The [48-request synthetic evaluation](examples/software-efficiency-evaluation-final.md)
keeps the optional ML model experimental. Across 40 requests with a known owner,
the lexical baseline's first candidate was correct on 29, versus 23 for ML. Within
the eight trained skill types, ML scored 23/32 versus 21/32, but its top-three recall
was lower. It abstained on all eight ambiguous/unrelated cases; lexical abstained
on five. These candidate metrics do not establish successful dispatch or delivery.

Output compaction reduced the helper's mean lexical response from 33,902 to 8,181
characters with identical candidate results. Enabling ML increased the mean
candidate-entrypoint inventory from 26,594 to 37,442 characters. Neither measure is
billed-token savings; the ML result does not justify making it the default.

Reproduce the study with a new output basename:

```sh
node scripts/evaluate-software-context.mjs --out /tmp/proof-evaluation-trial
```

The runner preserves prior reports and rejects overwrites. Its published fixture is
now a regression/demo set; use fresh independently labelled team tasks for a future
improvement claim. The [forward-check record](examples/software-prose-forward-evaluation.json)
separately covers a review-only task and a handoff whose previously passing evidence
became stale after a source change.
