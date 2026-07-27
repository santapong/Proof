# Boundary design — writing a description that discriminates

Skill selection happens on the `description` field **alone**, before any body is read. With eighteen skills the field is doing real discriminative work, and it is the highest-leverage text in a skill. This file is how to write one that holds.

## The failure this prevents

Adding a skill does not just add a capability — it adds **selection pressure on every existing skill**. Two skills whose descriptions both plausibly match "clean up this code" will be selected arbitrarily, and the user will experience it as the plugin being unreliable rather than as a boundary bug.

The plugin has already been here. At eighteen skills an audit found **22 rated overlaps** — 7 of them HIGH — and two pairs that could not be separated by wording at all, because the *content* genuinely overlapped. Description surgery cannot fix a content overlap; only moving the content can.

## The three rules

### 1. Quote any value containing a colon

```yaml
# BROKEN — the frontmatter block does not parse
description: Integrate a platform: OAuth 2.0 flows, webhooks, idempotency

# CORRECT
description: "Integrate a platform: OAuth 2.0 flows, webhooks, idempotency"
```

A `:` followed by whitespace in a plain YAML scalar opens a nested mapping; the parser reports `mapping values are not allowed here` and the **entire** frontmatter block fails. Two skills shipped this way in 1.0.0 and passed every gate the project then had, because `claude plugin validate` never opens a `SKILL.md`.

Double-quote by default. It is safe by construction and costs nothing.

### 2. Three clauses: what, when, and what-instead

| Clause | Purpose |
|---|---|
| **What it does** | The deliverable, named as an artifact — "emits a diff", "returns a findings list", "produces a task DAG" |
| **When to use it** | The trigger phrases a user would actually type |
| **Which sibling instead** | One pointer per rated overlap, **on both sides** |

The third clause is what makes eighteen descriptions mutually exclusive rather than merely different. A pointer that exists on only one side leaves the boundary decidable from one direction — the audit checks for exactly this, and it found four one-way boundaries in 1.0.0.

### 3. Resolve every overlap on a checkable question

Not a vibe. A question whose answer anyone can verify in one step.

| Pair | The question |
|---|---|
| `loop-operate` / `loop-incident` | Does a runbook exist for this condition **and** does running it restore the SLI? |
| `loop-incident` / `loop-debug` | Is the service currently down with users affected, or is the defect merely reproducible? |
| `loop-ship` / `loop-operate` | Is the rollout still in flight, or has it baked? |
| `loop-scout` / `loop-pattern` | Does answering this add a line to the dependency manifest? |
| `loop-review` / `loop-pattern` | Is the deliverable a findings list, or a diff? |
| `loop-debug` / `loop-algo` | Did it *get* slower, or was it never fast enough? |
| `loop-design` / `loop-algo` | Is the deliverable a box-and-arrow diagram, or a Big-O and an invariant? |
| `loop-skill` / `loop-harness` | Does it change what Claude **knows how to do**, or what Claude is **permitted** to do? |

**If you cannot state the discriminator as a checkable question, the two skills are not genuinely separable.** Say so and propose a merge. That answer is cheap now and expensive after 100 KB of authoring.

## Content overlap outranks wording

Before drafting anything, **grep for the subject matter across existing `references/`**, not just across skill names. The two HIGH overlaps in 1.0.0 were invisible at the description layer:

- `loop-design/references/deployment.md` was **100% of `loop-ship`'s declared scope**, already written and already shipped.
- `loop-design/references/nfr.md` already owned `loop-operate`'s SLI/SLO/error-budget core.

Neither could be fixed by rewording. The resolution was to **move the content** — `deployment.md` collapsed to a 19-line design-time stub and its mechanics moved to `loop-ship`. Two skills cannot share one body of knowledge and be selected reliably.

The rule: **if the new skill's charter is already written down inside another skill, you are not adding a skill — you are proposing a migration.** Say that plainly and get it approved before authoring.

## Registering the boundary

`../../../../docs/design/boundary-audit.json` is **normative** and outranks any build plan that disagrees with it. Add:

- A **matrix row** — the skill, its one-line mutually-exclusive scope, and a `useInsteadWhen` entry per neighbour.
- An **overlap entry** for every pair a reasonable person could confuse, with a severity and the checkable resolution.
- The **description text**, verbatim, so a reviewer can diff the file against the shipped frontmatter.

Then re-check every neighbour the new skill touches and add the reciprocal pointer to *their* descriptions. This is the step that gets skipped, and it is the one that makes the set hold.

## The probation pattern

Sometimes two skills are separable *today* but only just. `loop-incident` and `loop-operate` are the thinnest boundary in the set: both fire on "production is unhealthy," and they are kept apart by one predicate.

When that happens, do three things rather than pretending the boundary is comfortable:

1. Put the predicate in the **first sentence of both bodies**, not buried in a reference.
2. Write the pair into the audit as an explicit overlap with its resolution.
3. Arm a **merge tripwire** at review: if either skill's body spends more than roughly 30% of its length restating the other's phase, they are not separable and should be merged, with the smaller folded in as a mode of the larger.

One honest skill beats two that fight for the same trigger.
