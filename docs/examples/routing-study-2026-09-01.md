# Routing study — `loop-experiment`'s first live run

**1 Sep 2026.** The first real execution of `loop-experiment`, run against Proof itself.
Two studies, both pre-registered before any data existed. **Study 1 was refuted by its own
baseline. Study 2 returned an inconclusive result.** Both are recorded here in full, because a
study that only gets written up when it wins is not a method.

## What prompted it

An audit of `affaan-m/ECC` (286 skills) found 15 HIGH routing collisions across 12 of
Proof's 26 skills, and every one resolved the same way: the competitor was predicted to win
the picker because it names concrete nouns and leads with trigger conditions, while Proof's
descriptions lead with methodology. The proposed fix was to rewrite all 26 descriptions
trigger-first. **That claim was never measured** — it was inferred by reading descriptions.

## Study 1 — refuted by ceiling effect

**Hypothesis:** trigger-first descriptions route requests to the intended skill more often.
**Design:** 12 realistic requests, each with a pre-registered intended skill authored by hand
before any run; directed selection among Proof's 26 skills.

**Arm A (current descriptions): 12/12.**

The prediction required Arm B to score *strictly more* than Arm A. At the ceiling that is
impossible, so the hypothesis was refuted by construction. **The design could not detect
improvement**, which is a flaw in the harness, not in the descriptions — and it is exactly what
running the baseline arm first exists to catch.

The substantive finding: **among themselves, Proof's descriptions already route perfectly.**
That is what the boundary audit bought. The audit's claim was never about internal separation;
it was about losing to *another plugin's* skills, and study 1 contained no competitors.

### Instrument failure, and the amendment

The original oracle — a spontaneous `Skill` tool call — never fired. A pilot run showed the
model answering the request directly in one turn with zero tool calls, despite all 26 skills
being present in the session.

The oracle was amended to **directed selection** ("choose exactly one skill; do not answer").
**No arm data existed when this was changed** — the instrument was found broken, not
unfavourable, and the original oracle is preserved unedited in the pre-registration. This is
the line between fixing an instrument and tuning an oracle to a result.

The amendment weakens the claim, and the weakening is real: this measures whether a description
makes a skill **selectable when a choice is forced**, not whether it is chosen in ordinary use.

## Study 2 — contested picker, inconclusive

**Design:** the same 12 requests against a field of **46 skills** — Proof's 26 plus 20 ECC
skills (every HIGH-collision competitor from the audit, plus MEDIUMs touching these requests),
in an isolated scratch project. Nothing was installed into `~/.claude`.

**Pre-registered refutation condition:** Arm A scoring 12/12 again would mean the audit's
inference does not survive contact with a real picker, and would end the rewrite.

**Arm A (contested): 11/12.** One loss — request 1, `loop-review` → ECC's `security-review`.

Validity check passed: request 9 (`loop-incident`), which has no HIGH competitor in the field,
routed correctly, so the field was not simply confusing the picker.

### The audit substantially over-predicted

Its scorers predicted ECC would win all 15 HIGH collisions. **In a real picker Proof held 11
of 12**, including `loop-scout` vs `search-first` and `loop-comprehend` vs `codebase-onboarding`
— both rated HIGH. Reading two descriptions and predicting which one a picker selects is a poor
substitute for measuring it. Treat description-reading audits as hypothesis generators, not as
results.

### The one real loss, measured properly

Request 1 was repeated to test whether a single observation was stable:

| Arm | Correct | Result |
|---|---|---|
| A — current description | **2 / 6** (33%) | unstable, leaning to ECC |
| B — trigger-first rewrite | **4 / 6** (67%) | favourable direction |

**Fisher exact, two-sided: p = 0.567. Not significant.** Detecting a shift of this size at the
5% level needs roughly **35–40 runs per arm**; this study had 6.

Arm B also produced one outcome Arm A never did — `CHOSEN: none` — so the rewrite may trade a
wrong pick for no pick. One observation; not established either.

**Verdict: INCONCLUSIVE, direction favourable.**

## What was actually changed, and on what basis

**Only `loop-review`'s description was rewritten.** All four reciprocal pointers preserved
verbatim; no skill `name` touched.

**This change is not evidence-backed.** It ships on judgment — the direction is favourable, the
change is one description, and the risk is low. The fleet-wide rewrite of all 26 descriptions
was **abandoned**: 11 of 12 requests already routed correctly against concrete competitors, and
a large routing-affecting change justified by one contested request would be exactly the kind
of unproven work this skill exists to prevent.

## What this cost, and what it bought

~30 headless runs, roughly $2.50. It prevented a 26-description rewrite, corrected an audit
that over-predicted its own conclusion, and produced two negative results.

`loop-experiment`'s scorecard entry for "proven in use" was **0/5** before this run, on the
grounds that a skill which has never executed is a well-argued document rather than a tool. It
has now executed twice, and both times the honest output was *don't do the thing*.

## Reusable lessons

1. **Run the baseline arm first.** Study 1's ceiling was invisible until Arm A was scored, and
   would have been hidden entirely if both arms had run together.
2. **A perfect baseline is a design failure, not a triumph.** 12/12 means the instrument cannot
   see improvement.
3. **Pilot the instrument before spending the runs.** One pilot caught an oracle that never
   fires, before 24 runs were wasted on it.
4. **Repeat the interesting cell.** One loss looked like a finding; six observations showed a
   coin flip. `n` beside the number, always.
5. **Audits predict; pickers decide.** An audit that reads descriptions produces hypotheses,
   and this one over-predicted by a wide margin.
