# Standards shelves — the honesty convention

Every skill carries `references/standards.md`. It names the authorities the skill reasons from, pinned to an exact edition, and grades each one's **provenance of authority**. This file is how to build one that does not rot or lie.

The shelves are the plugin's actual value proposition: a skill that reasons from a cited, edition-pinned standard is doing something a general-purpose model cannot reliably do from memory. A shelf with a fabricated pin is worse than no shelf at all, because it launders a guess into an authority.

## The three grades

| Grade | Means | Cite it as |
|---|---|---|
| **Yes** | A standards body, government agency, or licensed framework owner **ratified and published** it — or it is a versioned specification under formal governance that implementations conform to | A normative requirement |
| **Draft** | Real, citable working-group or committee output that **nothing has ratified** | A draft, naming the revision *and* its status, every time |
| **No** | Real, widely followed, and still somebody's opinion — a book, a vendor practice, a convention authored by an individual, an OSS project's own spec | Evidence or vocabulary, **never** a requirement |

**The grade is about provenance, not quality.** Sigstore is graded *No* and is still the reference implementation most pipelines run; the grade only says you cannot write "Sigstore requires…" the way you write "ECMA-424 requires…". Fowler's *Refactoring* is graded *No* and is still the definitive catalogue. Grading honestly is what makes the *Yes* rows mean something.

The line that catches people: **an OSS project's own specification is a `No`.** If the project that wrote the spec is the only one implementing it, that is a practice, not a standard.

## Confirm against a primary source. Every time.

Not from memory. Memory in this domain is reliably out of date, and the failure is silent — a wrong version number looks exactly like a right one.

**Primary source** means the publisher's own page: the RFC on `rfc-editor.org`, the spec on the standards body's own site, the release page on the project's own repository, the publisher's catalogue entry for a book. A summary article is not a primary source and neither is a well-regarded blog.

What to pin: the **exact edition or revision**, the **date**, and for software the **licence**. Licences in particular change, and a wrong licence claim in a shelf a developer relies on is a real liability rather than a cosmetic error.

## The two failure modes this plugin has already shipped

Both are recorded here because they are the ones that survive review — they *look* like diligence.

**1. A fabricated non-confirmation.** A shelf stated that a second edition of a book "could not be confirmed to exist", supported that with an invented ISBN-prefix heuristic, and then elevated the false claim to a standing rule other files cited. The book was real and its publisher was openly selling it. A confidently-worded absence is still a fabrication.

> *"Could not confirm"* and *"confirmed absent"* are **different claims**. Say which one you mean.

**2. Asserting what another file currently records.** Three shelves each claimed "all three skills now agree on v1.43.0". That claim is false the moment anyone edits a sibling — and it duly went false, opening a version gap between a shelf and the very file it delegated to.

> **Never state what a sibling file currently says.** State your own pin, state the propagation obligation, and let the reader check the others.

The propagation obligation itself is fine and worth keeping:

```markdown
**Propagation obligation — three skills pin this spec.** `../../loop-incident/references/standards.md`
for timeline correlation, `../../loop-debug/references/standards.md` for evidence reading, and this file
for the naming layer. **When any one advances its pin, the other two advance in the same commit.**
Do not assert here what the other two currently record — read them.
```

## When you cannot confirm

Write it down as unknown. Do not round up to a version.

```markdown
**Edition.** Unconfirmed as of 2026-07-27 — the publisher's catalogue was unreachable.
Cite the standard by name with a retrieval date and re-check before quoting a clause number.
```

A stated unknown is a usable citation: a reader knows to verify. A fabricated certainty discredits every pin beside it, including the correct ones.

For genuinely unversioned sources — a living document, a method, a manifesto — the honest pin is **the name, the originator, and the date you read it**. Never invent a version for something that has none.

## The confirmation log

Close every shelf with one. It is the artifact that makes the next author's job possible, and it is the difference between a shelf that ages well and one that quietly rots:

```markdown
**Confirmation log — 2026-07-27.** Verified against the primary source: **X v1.2** (date, and what
it supersedes); **Y 3rd edition** (date). **Not independently re-confirmed in this pass, and named
rather than re-asserted with new precision:** **Z**, carried forward from prior research — check the
publisher before quoting a section; **W**, deliberately unversioned, so the honest pin is the name
plus the date you read it.
```

Two categories, always: **what you verified**, and **what you deliberately did not**. The second is not an admission of sloppiness — it is the scope of the claim you are making.

## Cadence

Different shelves rot at different speeds, and the file should say which kind it is:

| Kind | Re-check |
|---|---|
| ISO / Ecma / W3C editions, dated textbooks | Rarely — years |
| RFCs | On supersession; check for an updating RFC |
| OSS tool versions, framework idioms | Fast — months. Say so in the file |
| Near-monthly releases (e.g. OpenTelemetry Semantic Conventions) | Treat the pin as a starting point for verification, not a durable fact — and say that in the row |

A row whose subject moves monthly should carry that warning inline. A reader who trusts a pinned patch number as current, six months on, was misled by the file's silence.
