---
name: loop-skill
description: "Author a new skill for this plugin, or bring an existing one up to contract: draft the discriminating description and register the boundary, research and grade the standards shelf, write the thin router, the on-demand references and the ROUTES-carrying workflow template, then prove it conforms with the validation gate. Use when the user asks to create, scaffold, add, or fix a skill, or asks how to extend the plugin. The deliverable is a skill directory that passes scripts/validate.mjs. For configuring what Claude is permitted to do — permissions, hooks, MCP servers, scheduled automation — use loop-harness, whose subject is the environment rather than a capability. For prose written for a human reader, use loop-docs. For designing the software a skill talks about, use loop-design."
argument-hint: <skill-purpose> [--mode <lite|balanced|all-out>]
---

# loop-skill

**The deliverable is a skill directory that passes `scripts/validate.mjs`.** That is the discriminator: if the output is a `SKILL.md` plus `references/` plus a `*.workflow.js` under `.claude/skills/`, it is this skill. If it changes what Claude is *permitted* to do — permissions, hooks, MCP, schedules — it is `loop-harness`. If it is prose for a human reader, it is `loop-docs`.

A skill is not a document. It is a **contract with four enforcement points**: the YAML must parse, the `description` must discriminate against every sibling, the standards must be real and pinned, and the template must survive a sandbox with no filesystem, no clock and no module system. Author against those, not against a vibe of what documentation looks like.

Read `../../../docs/c4/skill-anatomy.md` before your first skill — it explains why the shape is the shape.

## Execution flow

### 1. Parse arguments

- **skill-purpose** — everything that is not a flag. If empty, ask what the skill should do.
- **`--mode <lite|balanced|all-out>`** — parsed by `loop-engine`; pass the raw argument string through. See `../loop-engine/references/execution-modes.md`.

Establish which job this is:

| Job | Start at |
|---|---|
| New skill | Step 2 |
| Existing skill failing the gate | Step 6, then back-fill whatever is missing |
| Existing skill with a boundary collision | Step 2, then step 7 |

### 2. Justify its existence — the step most often skipped

Before writing anything, answer in one line each:

1. **What deliverable does it produce** that no existing skill produces? Name the artifact, not the activity.
2. **Does an existing skill already cover this, including inside a reference file?** Grep for it. `loop-ship` and `loop-operate` were very nearly verbatim duplicates of material already living in `loop-design/references/` — the fix was to **move** that content, not to duplicate it. Two skills cannot share one body of knowledge and be selected reliably.
3. **What is the checkable question** that separates it from each neighbour?

If (2) finds substantial overlap, stop and propose a **content migration** or a **merge** instead. Shipping the duplicate is the failure mode; catching it here costs one paragraph, catching it later costs a rewrite.

### 3. Write the boundary before the body

Read `../../../docs/design/boundary-audit.json` — it is **normative** and outranks any plan that disagrees with it.

Draft the `description` to `references/boundary-design.md`. It must:

- Be **double-quoted** if it contains a colon followed by a space. Unquoted, it is invalid YAML and the whole frontmatter block fails to parse.
- Say what it does, when to use it, **and which sibling to use instead** — for every rated overlap, on *both* sides. A one-way pointer leaves the boundary decidable from one direction only.
- Resolve each overlap on a **checkable question**, never a judgment call.

Then add the rows to `boundary-audit.json` and re-check every neighbour the new skill touches. A nineteenth skill is more selection pressure on the other eighteen, not the same.

**If you cannot state a clean discriminator, the skill is wrong.** Say so and stop. That answer is cheap here and expensive after 100 KB of authoring.

### 4. Research and grade the standards

Per `references/standards-shelves.md`. Confirm **every** version, edition, licence and date against a **primary source** — not from memory, which in this domain is reliably out of date.

Grade each on the plugin's three levels — **Yes** (a standards body ratified and published it), **Draft** (real working-group output nothing has ratified), **No** (real, widely followed, still somebody's opinion). The grade is about provenance of authority, not quality.

**If you cannot confirm an edition, write "unconfirmed as of \<date\>" rather than asserting one.** Close the shelf with a confirmation log recording what you verified, when, and what you deliberately left open.

### 5. Author router → references → template, in that order

Per `references/authoring.md`. The order matters: the router's flow determines what the references must contain, and writing references first produces files nothing points at.

- **`SKILL.md`** — a thin router, 6–13 KB. Numbered steps that *point at* references. Its **first sentence** states the discriminating predicate, because by the time someone reads the body they have already selected the skill and the first thing they need to know is whether they chose right.
- **`references/*.md`** — five to seven files, ~100 KB total, always including `standards.md`. Depth is free here; it costs nothing until the router asks for it.
- **`templates/*.workflow.js`** — per `references/template-contract.md`. Carry the canonical `ROUTES` block **byte-identically**; it cannot be imported, because the sandbox has no module system.

### 6. Prove it conforms

```
node scripts/validate.mjs
```

Non-negotiable. It checks frontmatter validity, `name`/directory agreement, `node --check`, H10 determinism, `ROUTES` byte-identity, and reference-path resolution.

**A green gate is not a clean bill.** It cannot check whether a version pin is current, whether a citation is real, or whether two descriptions genuinely discriminate — and those are exactly where the defects that survived this plugin's automated sweeps actually lived. Read green as "the mechanical failures are ruled out," then review the three things it cannot see.

### 7. Register and report

- Add the skill to `README.md`'s table under the right role group, and to `INSTALL.md`.
- Add a `CHANGELOG.md` entry. A new skill is a **minor** version bump; renaming or removing one is **major**, because skill names are API from 1.0.0.
- Report: the deliverable, the boundary decisions and what they were checked against, anything left `unconfirmed`, and the gate output.

## Orchestration

For a single skill, work inline — it is one coherent authoring job and fanning it out produces inconsistent references.

For **three or more skills at once**, use `templates/skill-scaffold.workflow.js`: it researches the shelves in parallel, then authors each skill in its own directory. Directories are disjoint, so `isolation: 'none'` is correct (H7) — but the **boundary check is a barrier**, because the descriptions must be read side by side against each other and against the existing set. That barrier is earned under H2; the authoring fan-out is not.

## Reference files

| File | What it holds |
|---|---|
| `references/boundary-design.md` | Writing a description that discriminates; the checkable-question test; registering in the boundary audit |
| `references/standards-shelves.md` | The three grades, primary-source confirmation, the confirmation log, and the two failure modes this plugin has already shipped |
| `references/authoring.md` | Thin-router discipline, progressive disclosure, reference sizing, the house voice |
| `references/template-contract.md` | H10 sandbox rules, the `ROUTES` block, orchestration shape selection |
| `references/standards.md` | The pinned authorities this skill itself reasons from |
