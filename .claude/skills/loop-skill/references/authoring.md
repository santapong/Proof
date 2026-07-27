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

## Bringing an existing skill up to contract

Work in this order — each step's output feeds the next:

1. **`node scripts/validate.mjs`** — fix the mechanical failures first so the rest is readable.
2. **Frontmatter** — quoted description, `name` matching the directory, an `argument-hint` that only advertises flags the skill can actually honour. A skill with no workflow template cannot honour `--mode`, and advertising it is a promise it never keeps.
3. **Boundary** — check the description against `boundary-audit.json` and against every neighbour's reciprocal pointer.
4. **Router size** — if it is over ~15 KB, find what belongs in a reference.
5. **Shelf** — re-confirm the pins against primary sources; add or refresh the confirmation log.
6. **Template** — H10 rules, `ROUTES` byte-identity, an H2 justification comment on any barrier.
7. **Re-run the gate**, then review the three things it cannot see: pin currency, citation reality, description discrimination.
