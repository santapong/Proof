# The ship-time supply-chain gate

## Three moments, same standards

SLSA, SBOM formats, in-toto and Sigstore get cited from three different places in this plugin, and confusing them is the fastest way to run the wrong check. **`loop-scout` asks the adoption-time question** — should we take a dependency on this thing at all, before any code is written — and reads provenance as one axis of a build-vs-buy evaluation (`../../loop-scout/references/standards.md`). **`loop-review` asks the audit-time question** — is this dependency healthy, on a diff or across a repo — and a weak provenance story there is a *finding* with a severity and a remediation (`../../loop-review/references/standards.md`). **This file asks the ship-time question** — does *this one artifact*, right now, about to be promoted, carry valid provenance, a current inventory, and a good signature — and the answer is a **binary pass or fail on a single build**, not a judgment, not a score, and not a survey of your dependency tree. Same standards, three questions, three moments. (A fourth read exists for the harness's own build outputs: `../../loop-harness/references/standards.md`.)

Two consequences follow from being the ship-time read, and they are what make this gate cheap enough to run on every promotion. It is scoped to **one artifact digest**, so it never walks a dependency graph. And it is **differential** — it compares this release to the last one, so it only ever reasons about what changed.

## The pass/fail checklist

Run these against the exact artifact that will be promoted, identified by its digest. Version pins for every standard named here are in `standards.md`.

**1. Provenance attestation present and verified against the artifact's hash.**
An in-toto attestation carrying SLSA provenance must exist for this digest, and its `subject` digest must match the artifact you are about to promote — byte for byte, not by tag, not by name. A tag is a mutable pointer; a digest is the artifact. Verify the attestation's issuer is your expected builder identity and that the declared build level meets your floor (SLSA Build L2 is the realistic floor for anything a pipeline ships; L3 for anything with a blast radius that would justify a canary). **Fail** if the attestation is missing, if the subject digest does not match, if the issuer is not the expected builder, or if the declared level is below the floor.

**2. SBOM generated and diffed against the previous release.**
An SBOM (CycloneDX or SPDX — match whichever your pipeline already emits; do not introduce a second format at gate time) must exist for this digest and be generated *from the build*, not reconstructed afterwards from a manifest. Then **diff it against the previous release's SBOM** and resolve only the delta: components newly introduced, components whose version moved, components removed. Query the new and changed components against your advisory source. **Fail** if the SBOM is absent, if it does not correspond to this digest, or if the diff introduces a component with a known advisory at or above your blocking severity. The diff is the point — a full re-scan of every component on every promotion is a job for `loop-review`'s audit-time sweep, and running it here means the gate is too slow to run and gets skipped.

**3. Signature verified.**
The artifact and its attestation are signed, and the signature verifies against the expected identity — with Sigstore this is a `cosign verify` against the identity and issuer you expect, checking the transparency-log inclusion proof rather than merely that a signature parses. **Fail** if verification fails, if the signing identity is not on your allow-list, or if there is no transparency-log entry where your policy requires one.

**The gate outputs one record**: `pass` / `fail`, the artifact digest, which of the three checks failed, and the SBOM delta. That record is the evidence dimension 5 of `release-gates.md`'s pre-deploy checklist consumes. **A gate that "ran" without producing that record did not run.**

## Hard-block versus advisory

Not every sub-failure deserves to stop a release, but the split has to be decided in advance and written down — deciding it during an outage produces the answer whoever is most tired wants.

| Failure | Disposition | Why |
|---|---|---|
| Provenance missing entirely | **Hard block** | You cannot say where the artifact came from. Nothing downstream is meaningful. |
| Provenance subject digest ≠ artifact digest | **Hard block** | The strongest signal in the whole gate that you are about to promote something other than what you built. |
| Signature invalid, or identity not on the allow-list | **Hard block** | Same class: the artifact is not provably yours. |
| Newly introduced component with a critical/high advisory | **Hard block** | The change *added* the exposure; blocking costs one release, shipping costs an incident. |
| SBOM missing or not tied to this digest | **Hard block** for a regulated or externally distributed artifact; **advisory** for an internal service where the previous release's SBOM is available for the diff | The inventory is the input to every later question; the only tolerable gap is a temporary one with a tracked owner. |
| Pre-existing component with a newly published advisory, untouched by this release | **Advisory** | It is already in production. Blocking this release does not remove it and delays the fix. It is `loop-review`'s finding, filed as work, not this gate's veto. |
| Advisory with a documented no-reachable-path analysis (a VEX-style statement) | **Advisory** | Reachability, not presence, is the risk — but the analysis must exist as an artifact, not as someone's recollection. |
| Build level below floor but provenance otherwise valid | **Advisory**, once, with a dated exception | Raising a build level is pipeline work, not release work; blocking every release until it lands punishes the wrong change. |

**Every advisory that ships carries a tracked exception**: an owner, an expiry date, and a link from the release record. An advisory with no expiry is a permanent downgrade of the gate, and a list of them is how a gate stops meaning anything. **An exception may not be renewed by the same person twice** — the second renewal escalates to whoever owns the release process, because a finding that outlives two expiries is a decision, not a delay.

## Escalation — when the gate fails mid-promotion

The gate normally runs before the deploy starts. It can also fail *during* a promotion — a re-verification at a later rung, a newly published advisory landing between rungs, a transparency-log lookup that failed the first time and now succeeds with a bad answer. When that happens:

1. **Hold at the current rung.** Do not advance and do not roll back reflexively. The artifact at the current rung has already been exposed to a bounded slice of traffic; advancing widens a risk you have just learned about, and an unplanned abort may be the more expensive move (see `rollback-playbook.md`).
2. **Page whoever owns the release** — the named sign-off from `release-gates.md` §5, not a channel. A supply-chain failure mid-promotion is a human decision, because the trade-off between exposure and abort cost depends on facts the gate does not have.
3. **Do not silently retry.** A verification failure that succeeds on the second attempt is either an infrastructure flake or an attacker with intermittent access, and the gate cannot tell them apart. Retry at most once, log both attempts with their outcomes, and treat a differing result as a hard block until a human explains it. **A retry loop that eventually passes is indistinguishable from a gate that does not exist.**
4. **Record the outcome on the release**, whichever way it goes, including the disposition of any exception granted under pressure. Exceptions granted mid-promotion get a shorter expiry than exceptions granted at the gate, because they were decided with less information.

If the failure is escalated into a live user-facing problem — a compromised artifact already serving traffic — this stops being a release decision and becomes an incident: hand to `loop-incident` and let the mitigation sequencing be owned there.
