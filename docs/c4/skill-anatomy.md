# Anatomy of a skill

Every one of the twenty-four skills has the same shape. This document explains **why** that shape, because the constraints are not obvious and several of them were learned by shipping the wrong thing first. `CONTRIBUTING.md` tells you the mechanics — what to write and how to validate it. This tells you what each part is *for*, which is what you need before adding the next one.

The `loop-skill` skill scaffolds all of this for you. Read this to understand what it emits and why, or to review a skill someone else wrote.

```
.claude/skills/<name>/
├── SKILL.md                     ~6–13 KB   thin router, enters agent context on invocation
├── references/
│   ├── standards.md             ~8–12 KB   version-pinned authorities, three-grade honesty
│   └── <topic>.md          ~10–26 KB ea.   deep knowledge, loaded ON DEMAND
└── templates/
    └── <name>.workflow.js       ~6–10 KB   executed by the Workflow tool, never read into context
```

Typical totals: a mature skill is **one router, five to seven references (~100 KB), one template**.

## The three parts have three different loading regimes

This is the load-bearing insight, and it is why the parts cannot be merged.

| Part | When it loads | Who reads it | Consequence |
|---|---|---|---|
| `SKILL.md` | On invocation, into agent context | The model | Must stay small — every byte competes with the user's actual task |
| `references/*.md` | On demand, if the router asks | The model | Can be deep; costs nothing until needed |
| `*.workflow.js` | Never loaded into context — **executed** | The Workflow sandbox | Cannot import, cannot read files, cannot read a clock |

A skill that inlines its references into `SKILL.md` still *works* — and quietly taxes every invocation of every other skill by crowding the window. A template that assumes it can `import` a shared module does not work at all.

## The `description` field is the product's API

Skill selection happens on `description` **alone**, before any body is read. With twenty-four skills the field is doing real discriminative work, and it is the single highest-leverage text in a skill.

Three rules, each earned:

**Quote any value containing a colon.** `description: Integrate a platform: OAuth 2.0 flows…` is not valid YAML — a colon-plus-space opens a nested mapping and the parser rejects the whole block. Two skills shipped this way in 1.0.0 and passed every gate the project had, because `claude plugin validate` never opens a `SKILL.md`. Wrap the value in double quotes and it is safe by construction.

**Say what it does, when to use it, and which sibling to use instead.** The third clause is what makes twenty-four descriptions mutually exclusive rather than merely different. Every rated overlap in [`boundary-audit.json`](../design/boundary-audit.json) is resolved by a "use X instead when Y" pointer on *both* sides — a one-way pointer leaves the boundary decidable from only one direction, which is a defect the audit checks for.

**Resolve overlaps on a checkable question, never a vibe.** The four operational skills are separated by facts anyone can verify in one step: *does a runbook exist and does running it restore the SLI?* · *is the service down, or is the defect merely reproducible?* · *does answering this add a line to the dependency manifest?* · *is the deliverable a findings list or a diff?* If you cannot state the discriminator as a question with a checkable answer, the two skills are not genuinely separable and should be merged.

## `SKILL.md` is a router, not a document

The body is a numbered flow that **points at** references. It names what to read and when; it does not restate what those files say.

The failure mode is gradual: a router grows an explanation, then an example, then a table, and at 30 KB it is a reference file that also happens to be loaded on every invocation. Open [`loop-review/SKILL.md`](../../.claude/skills/loop-review/SKILL.md) as the exemplar — it covers a large domain in under 9 KB by refusing to explain anything it can cite.

Where a skill has a near neighbour, the body's **first sentence** states the discriminating predicate. That placement is deliberate: by the time someone is reading the body they have already selected the skill, so the first thing they should learn is whether they selected the right one.

## `references/standards.md` — the honesty convention

Every skill carries one. It names the authorities the skill reasons from, pinned to an exact edition, and grades each on three levels:

| Grade | Means | Cite it as |
|---|---|---|
| **Yes** | A standards body, government agency, or licensed framework owner ratified and published it | A normative requirement |
| **Draft** | Real working-group or committee output that **nothing has ratified** | A draft, naming the revision and status every time |
| **No** | Real, widely followed, and still somebody's opinion — a book, a vendor practice, an OSS project's own spec | Evidence or vocabulary, never a requirement |

The grade is about **provenance of authority, not quality**. Sigstore is graded *No* and is still the reference implementation most pipelines run; the grade only says you cannot cite "Sigstore says" the way you cite an Ecma standard.

Two rules that exist because this repo broke them:

- **If you cannot confirm an edition, write "unconfirmed as of \<date\>" rather than asserting one.** A shelf once published a confidently-worded *non-confirmation* of a book its publisher was openly selling, propped up by an invented ISBN heuristic. A stated unknown is a usable citation; a fabricated certainty discredits every pin beside it.
- **Never assert what another file currently records.** "All three skills now agree on v1.43.0" is false the moment anyone edits a sibling — and that is precisely how a version gap opened between a shelf and the file it delegated to. State your own pin, state the propagation obligation, and let the reader check the others.

Close the shelf with a **confirmation log**: what you verified against a primary source, on what date, and what you deliberately left unconfirmed.

## `templates/*.workflow.js` — written for a sandbox

The template runs where there is no filesystem, no module system, no clock, and no human to prompt. Every rule below follows from that, and the [validation gate](../../scripts/validate.mjs) enforces each one:

- `export const meta = {…}` first, a **pure literal** — the host reads it before executing anything.
- Plain JavaScript. Never TypeScript.
- No `Date.now()`, no `Math.random()`, no argless `new Date()` — resume replays from cache and must be deterministic.
- Normalize defensively: `const input = typeof args === 'string' ? JSON.parse(args) : args`.
- `.filter(Boolean)` on every `parallel()` result — a dead agent resolves to `null`, it never rejects.
- A `schema` on every `agent()` call whose result the script consumes.
- The canonical **`ROUTES` block, byte-identical**, in any template that sets `model` or `effort`. It cannot be imported — there is no module system — so it is duplicated by rule, with the gate diffing every copy against `execution-modes.md` §M8.

Shape follows the [harness policy](../../.claude/skills/loop-engine/references/harness-policy.md): `pipeline()` by default, a `parallel()` barrier only for a genuine cross-item reduce, a loop only for unknown-size discovery. Any barrier carries an inline comment justifying itself under H2.

## Adding a skill — the lifecycle

1. **Check it should exist.** Does an existing skill already cover this, or cover it *partially* in a reference file? `loop-ship` and `loop-operate` were nearly duplicates of content already living inside `loop-design` — the fix was to *move* that content, not to duplicate it. Two skills cannot share one body of knowledge and be selected reliably.
2. **Write the boundary first.** Draft the `description` and the checkable discriminator against every neighbour, and add the rows to `boundary-audit.json`. If this step is hard, the skill is wrong — fix it here, not after authoring 100 KB.
3. **Research the standards.** Confirm every version against a primary source. Grade honestly.
4. **Author** router → references → template, in that order, so the router's flow determines what the references need to contain.
5. **Validate**: `node scripts/validate.mjs`. It runs in CI on every push and PR.
6. **Re-check the neighbours.** Each added skill is more selection pressure on the other eighteen, not the same. Every overlap it touches needs its pointer on both sides.

## What the gate can and cannot check

`scripts/validate.mjs` catches frontmatter validity, `name`/directory agreement, `node --check`, H10 violations, `ROUTES` drift, and dangling reference paths.

It cannot check **whether a version pin is current**, **whether a citation is real**, or **whether two descriptions genuinely discriminate**. Those are review disciplines, and they are where every defect that survived 1.0.0's automated sweeps actually lived. Do not read a green gate as a clean bill — read it as "the mechanical failures are ruled out."

---

**See also:** [Container (Level 2)](container.md) for where these parts sit in the system · [Component (Level 3)](component.md) for the engine they author through · [the design records](../design/README.md) for the boundary contract.
