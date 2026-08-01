# Supersession — update over recall

The measured center of long-running-agent failure is not recall. LongMemEval (ICLR 2025)
concentrates its ~30% multi-session degradation in **temporal reasoning, knowledge
updates, and abstention** — handling facts that were true and are now false, and knowing
when to say "I don't know". An append-only store makes this *worse*: stale facts retrieve
exactly as strongly as current ones. This file is the discipline for state that changes.

## Two timestamps, not one

Every fact that can change carries both **when it was true** (valid time) and **when it
was recorded** (transaction time) — the bi-temporal split (Zep, arXiv:2501.13956). A
correction does not edit the old fact; it **appends** a new one whose record points at
what it supersedes and closes the old fact's validity. This preserves both questions:
"what is true now?" and "what did we believe at the time we acted?" — the second is what
makes a past decision auditable after the fact it relied on was corrected.

## The ranking caveat — metadata is not behaviour

Storing the invalidation is necessary and **not sufficient**: with the correction present
in the store, retrieval still surfaced the superseded fact **60.5% of the time**, flagging
it in 3.3% (arXiv:2606.26511). The supersession discipline therefore has a retrieval-side
clause: whatever assembles context must **prefer the superseding fact** — filter
closed-validity facts by default, and when a superseded fact is deliberately included
(for audit), label it as superseded *in the context*, not just in the store.

## Delta discipline for accumulated config

Anything the system accumulates across rounds or runs — a credit ledger, a rubric, a
coverage map, a `seen` record — updates by **itemized delta**: add an entry, increment a
counter, deprecate an entry. Never wholesale rewrite. Rewriting is how detail vanishes:
ACE names the two textual failure modes — **context collapse** (repeated rewriting erases
detail) and **brevity bias** (each summarization pass sheds specifics) — and its
mitigation is exactly this delta-not-rewrite rule. Deprecated entries are marked, not
removed: a deprecated entry is evidence; a deleted one is amnesia.

## Abstention is part of the contract

A retrieval that finds nothing current must yield "unknown", never the most recent stale
match. The confidence-honesty rule generalizes: when the store's best answer has closed
validity, the honest answer is "this was true until X; nothing newer is recorded" — which
downstream logic can treat as unknown-with-provenance.

## The purge caveat — supersession is not deletion

Where a genuine deletion mandate applies — secrets that leaked into state, personal data
under an erasure right — supersession is **not enough**, and claiming otherwise is a
compliance defect, not a design choice. "Invalidated, never deleted" architectures keep
the old value readable by design. The discipline:

- Classify at write time: facts that could attract a deletion mandate are stored where a
  **real purge path** exists (and the purge covers backups and derived artifacts).
- Never launder a purge requirement through invalidation because the store makes
  deletion hard. If the store cannot purge, that class of fact does not go in it.
- After any purge, run the §6 invariant-3 check with the purged value as the probe: it
  must appear nowhere in later context assemblies *or* in the surviving store.

## Where this plugin already applies it

- **AP7's coverage archive** — keyed-merge with increments; blocked/triaged-out entries
  are recorded with status, never dropped (deprecate, don't delete).
- **The credit ledger and rubric** (`loop-autopilot`) — the accumulated-config case;
  their AP6 protection (frozen paths) composes with this file's delta rule: the loop may
  *append* to its history, never rewrite it.
- **`WORKLOG.md`-style records** in the conventions this plugin scaffolds — newest-first
  append, corrections as new lines. Same rule, human-scale.
