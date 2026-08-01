# Authoring — the router, the references, and the voice

The order is **router → references → template**. It matters: the router's numbered flow determines what the references must contain, and writing references first reliably produces files that nothing points at.

## The context budget is the whole design constraint

Everything below follows from one fact: **`SKILL.md` enters the agent's context on invocation, and `references/*.md` do not.** A reference file costs nothing until the router asks for it. A router costs its full size on every single use.

A mature skill is roughly:

| Part | Size | Why |
|---|---|---|
| `SKILL.md` | **6–13 KB** | Loaded every time — it competes with the user's actual task |
| `references/` | **5–7 files, ~100 KB total** | Loaded selectively; depth is free here |
| `templates/` | **1 file, 6–10 KB** | Never loaded into context at all — executed |

The failure mode is gradual, which is why it needs a stated limit. A router grows an explanation, then a worked example, then a table — and at 30 KB it has become a reference file that also happens to load on every invocation. Open [`loop-review/SKILL.md`](../../loop-review/SKILL.md) as the exemplar: a large, technical domain covered in under 9 KB, because it refuses to explain anything it can cite.

## Thin-router discipline

The body is a **numbered flow that points at references**. Each step says what to do and which file to read; it does not restate what that file says.

**Belongs in the router:**
- The discriminating predicate, as the **first sentence**. By the time someone reads the body they have already selected the skill; the first thing they should learn is whether they chose right.
- Argument parsing and the branch table ("new skill → step 2; failing gate → step 6").
- The step sequence, each naming its reference.
- Non-negotiables the skill *enforces* — at least one accessibility, safety or correctness constraint should be visible here rather than buried three files deep. Something a reader must not miss should not be reachable only by following a link.
- The orchestration note: when to work inline, when to fan out, and which barrier is earned.
- A closing **Reference files** table.

**Belongs in a reference:**
- Any explanation longer than two sentences.
- Every table of standards, every worked example, every catalogue.
- Anything a reader needs *sometimes*.

**Test:** delete every reference file. Does the router still read as a coherent set of instructions? Then it is a router. Does it now read as a document with holes? Then it was already a reference file.

## Sizing and splitting references

Split by **the question being asked**, not by volume. One file per question a user might arrive with is a better split than four files of even length.

Signs the split is wrong:
- A file the router never names → delete it or point at it.
- A file the router names at three different steps for three different reasons → it is three files.
- Two files that must be read together, always → they are one file.
- A file over ~26 KB → usually two questions wearing one filename.

Every reference is named in the router's closing table, and every file in `references/` appears in that table. The validation gate checks both directions, because an orphan file is invisible and a dangling pointer is a broken promise.

## The house voice

Skills are read by a model under context pressure and by a human reviewing a PR. Both want the same thing: **the load-bearing claim first, the reasoning after, and no hedging.**

- **Assert, then qualify.** "Barriers must be earned" then the three cases — not "it may sometimes be preferable to consider avoiding barriers."
- **Name the failure.** Rules survive when their cost is attached: *"Two skills shipped with unparseable frontmatter and passed every gate"* is remembered; *"validate your YAML"* is not. Prefer a real incident from this repo to a hypothetical.
- **Numbers over adjectives.** "6–13 KB", "3 verifiers", "~30%" — not "small", "several", "a significant portion".
- **Say what is *not* true.** The reader's wrong assumption is worth a sentence: *"A green gate is not a clean bill"*, *"the grade is about provenance, not quality"*.
- **Admit the seams.** Where something is scaffolding rather than a proven recipe, say so in the body. `loop-operate` states plainly that without a live service its templates are gated scaffolds. That admission is what makes the rest of the file trustworthy.
- **Second person, present tense, active voice.** "Read the audit before drafting." Not "the audit should be read".

Avoid: throat-clearing preambles, restating the heading in the first line, "it's important to note", and any sentence that would survive deletion unchanged.

## The failure catalogue

Six defect classes that read as style issues and are not. Where the repo record names an incident, the row cites it; where it does not, the row says so — a catalogue that invents its incidents is committing defect 4 in its own table. This section is what to look for; the mechanisms live in the files each row names, and the checklist below is how to fix what you find.

| # | Defect | What actually breaks | The record | The check that prevents it |
|---|---|---|---|---|
| 1 | **The feature-list description** — the `description` lists what the skill contains ("covers X, Y, Z") instead of when to choose it | A **routing defect**, not a style issue: the field stops discriminating, siblings collide on the same trigger, and which one fires becomes chance | The 1.0.0 boundary audit: **22 rated overlaps, 7 HIGH**, across eighteen descriptions | No script reads meaning — discrimination is one of the three things step 7 says the gate cannot see. The controls are [`boundary-design.md`](boundary-design.md)'s three rules and its registration step, which is built to be diffed at review |
| 2 | **The one-way boundary** — skill A says "for X, use B instead"; B never points back | Reading either file alone shows nothing wrong; the gap appears only when the pair is read side by side, which is exactly what nobody does | The 1.0.0 audit found **four** of these | No mechanical gate reads descriptions at all, let alone in pairs. The control is the reciprocal-pointer re-check in [`boundary-design.md`](boundary-design.md)'s registration step — the step that file itself says gets skipped |
| 3 | **The orphan reference** — a file in `references/` that nothing points at | Unreachable knowledge: it costs maintenance on every edit and pays nothing back | No orphan-file incident on record. The nearest neighbour is the **inverse** defect: 0.4.0 hand-fixed a dangling cross-link (`../` → `../../` in `loop-orchestrate/references/standards.md`) two releases before the gate existed | [`scripts/validate.mjs`](../../../../scripts/validate.mjs): CHECK 8 fails any file under `references/`, `templates/` or `frameworks/` named nowhere in `SKILL.md`; CHECK 6 resolves every reference path **in `SKILL.md`**. Narrower than it sounds — see the scope corrections below |
| 4 | **The unverified shelf pin** — a standards edition asserted from memory | A wrong pin is invisible on the page, and one exposed fabrication costs the reader's trust in the shelf's genuine rows | 1.0.0 fixed a batch of citation-currency errors and one **fabricated non-confirmation** of a book its publisher was openly selling — [`standards-shelves.md`](standards-shelves.md) owns the full account | None mechanical: pin currency is another of step 7's gate-blind spots. Apply [`standards-shelves.md`](standards-shelves.md)'s primary-source rule, its unconfirmed-as-of-date form, and its confirmation log |
| 5 | **The smoke-green, mode-inert template** — parses, executes under stubs, ignores `input.mode` | Every run silently costs the same regardless of the dial the user set. `node --check` proves syntax and nothing else | **Four** templates shipped this way — every one parsed. The 1.3.0 changelog names the class: green static checks over behavior nothing ever ran | [`scripts/smoke.mjs`](../../../../scripts/smoke.mjs) — it **executes** every template against stubbed globals in each mode and fails on the symptoms: `balanced` pinning the ceiling model on every call ("mode dial is inert"), `all-out` leaving a call unpinned, `lite` inheriting the session model, the deprecated alias routing differently from its replacement |
| 6 | **The router that re-explains** — a `SKILL.md` that inlines reference content instead of pointing at it | The full cost lands on **every invocation**; the drift toward it is gradual, which is why it survives review | No single incident on record — "Thin-router discipline" above exists because the drift is universal, not because it happened once | Step 4's ~15 KB tripwire and the delete-the-references test above. This row adds no new rule; it exists so a reviewer can name the class instead of calling the file "a bit long" |

### Two scope corrections the table cannot carry

**The orphan gate is narrower than "checks both directions."** CHECK 6 scans only `SKILL.md` — a dangling or stale path inside a `references/*.md` survives a green gate, and that is exactly the class 0.4.0 fixed by hand. And CHECK 8 accepts a bare basename match anywhere in `SKILL.md`, so "named" is weaker than "routed to": a file mentioned in passing prose is not an orphan to the gate, and still is one to a reader. Re-resolve cross-links between reference files at review; nothing else will.

**`check-modes-extraction-parity.mjs` does not catch defect 5.** Despite the name, it is a third-copy guard: it asserts that `validate.mjs` and `mcp/lib/modes.mjs` locate the same §M8 block byte-for-byte, and its own header says it is not one of the two required gates. Attribute mode-inertness to `smoke.mjs`, or you will run the wrong gate and call the template proven.

## Bringing an existing skill up to contract

Work in this order — each step's output feeds the next:

1. **`node scripts/validate.mjs`** — fix the mechanical failures first so the rest is readable.
2. **Frontmatter** — quoted description, `name` matching the directory, an `argument-hint` that only advertises flags the skill can actually honour. A skill with no workflow template cannot honour `--mode`, and advertising it is a promise it never keeps.
3. **Boundary** — check the description against `boundary-audit.json` and against every neighbour's reciprocal pointer.
4. **Router size** — if it is over ~15 KB, find what belongs in a reference.
5. **Shelf** — re-confirm the pins against primary sources; add or refresh the confirmation log.
6. **Template** — H10 rules, `ROUTES` byte-identity, an H2 justification comment on any barrier.
7. **Re-run the gate**, then review the three things it cannot see: pin currency, citation reality, description discrimination.
