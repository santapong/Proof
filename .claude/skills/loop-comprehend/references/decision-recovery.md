# Decision recovery — reverse-engineering the ADRs nobody wrote

Most decisions in most codebases were never recorded. The code still contains them: every place an alternative visibly lost is a decision *made*, whether or not anyone made it consciously. Decision recovery finds those sites, reconstructs the decision in ADR form, and — the part that keeps it honest — **grades how much of the reconstruction is evidence and how much is inference**.

The failure mode this file exists to prevent: a recovered ADR that reads as confident history and is actually a plausible story. A fabricated rationale is worse than a missing one, because it forecloses the re-examination a missing one invites.

## Decision sites — where to look

| Site | The decision it embodies | First evidence to pull |
|---|---|---|
| A dependency in the manifest | This capability is bought, not built — and from this vendor | The commit that added it; what it replaced, if anything |
| A schema shape (normalization choice, denormalized copy, JSON column, soft delete) | A consistency/performance/flexibility trade | The migration that introduced it |
| An architectural seam (queue between two components, service boundary, plugin interface) | Coupling was spent or saved here deliberately | Both sides' registration code; the commit range where the seam appeared |
| A pattern applied repo-wide (repository layer, CQRS split, error-as-value) | A convention was chosen and enforced | The oldest instance; CONTRIBUTING or lint rules that enforce it |
| A config default, timeout, retry count, pool size | Someone tuned this — or someone never did | `git log -L` on the value; whether it ever changed |
| A conspicuous absence (no ORM, no framework, no tests in one area) | Rejection is also a decision — or neglect; the grade must say which | Search issues/PRs for the rejected option's name |
| A version pin held back while siblings advanced | A known incompatibility | The commit that pinned it; its message usually says why |

For a dossier, do not enumerate exhaustively — recover the decisions a newcomer would otherwise **trip over**: the surprising ones, the expensive-to-reverse ones, the ones a reasonable engineer would re-litigate next quarter without a record.

## Mine the record before the code

The repo's history is primary-source material, and it is read *before* inventing rationale:

1. **`git log --follow` / `git log -L`** on the decision site — the introducing commit and every revision since.
2. **The commit message and PR description** — a stated reason here is *evidence*, quotable as such.
3. **The issue the PR closed** — often carries the alternatives that were actually considered.
4. **Timing** — what else changed in the same commit or the same week; decisions travel in packs (a queue appears alongside the outage its retry storm caused).
5. **The people** — a name on the commit is a lead if they are reachable; note it, do not require it.

Only after the record is exhausted does inference start — and everything from step-zero reading of the code's *shape* ("this looks like it was chosen for X") is inference, however compelling.

## The recovered-ADR format

Use the repo's ADR convention where one exists; otherwise Nygard's fields (context / decision / consequences), or MADR where the repo already uses MADR (see `standards.md` for both pins). Two additions make it a *recovered* ADR rather than a normal one:

```markdown
# ADR-R003 — Events between billing and provisioning go through the queue

**Status:** recovered (never originally recorded) · **Confidence: evidenced**
**Recovered:** 2026-08-04, from the artifacts cited below

## What the code shows            <- cited, every line
- billing publishes `InvoiceSettled` (src/billing/events.py:41); provisioning
  subscribes (src/provisioning/consumers.py:12); no direct import crosses the seam.
- Introduced in a1b2c3d (2024-03-11), same PR as incident follow-up #482.

## Reconstructed decision         <- the ADR proper, written from the evidence
Decouple provisioning from billing's availability; accept eventual consistency
on activation in exchange.

## What is inferred, and from what   <- marked, separately
- That #482's retry storm was the motivating incident — inferred from timing
  and the PR link; the PR text does not state it.

## What re-deciding would involve
The consequence surface a future loop-design pass should weigh.
```

**The confidence grade is per-ADR and load-bearing:**

| Grade | Means |
|---|---|
| `evidenced` | The rationale is stated in a commit, PR, issue, or comment — quoted, not paraphrased into more certainty than the source carries |
| `inferred` | The rationale is reconstructed from code shape and timing; the evidence section shows the inputs, the inference is marked as such |
| `speculative` | The decision site is real but the rationale is a guess; the honest deliverable may be "decision found, rationale unrecoverable — re-decide deliberately" |

Never promote a grade to make the dossier read better. This is the shelf convention's rule transposed: *"could not confirm" and "confirmed absent" are different claims* — and "the record states why" and "the shape suggests why" are different claims too.

## Handoffs

- **`loop-docs`** owns the recovered ADRs once written: numbering them into the repo's ADR set, the immutability/supersession discipline, keeping them found. This file produces content; that skill produces the maintained document.
- **`loop-design`** owns any *re-deciding*. A recovery that concludes "this decision no longer holds" ends there — the recovered ADR (especially its consequence surface) is the context document the new decision starts from, and the new ADR supersedes the recovered one rather than overwriting it.
- **`loop-debug`**, occasionally: a recovered decision whose stated rationale contradicts current behavior ("this retry exists to prevent X" while X happens anyway) is a defect lead, not a comprehension result.
