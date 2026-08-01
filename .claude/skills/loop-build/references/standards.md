# Standards this skill applies

Graded on the plugin's three levels — **Yes** (ratified by a standards body), **Draft** (real working-group output, unratified), **No** (real and widely followed, still somebody's opinion). The grade is provenance of authority, not quality.

| Authority | Version / edition | Grade | What this skill takes from it |
|---|---|---|---|
| Semantic Versioning | **2.0.0** | No — de-facto specification (Tom Preston-Werner), never ratified by a standards body | The meaning of "version one": 1.0.0 is the release at which the public API becomes a promise — which is why §1 of `conduct.md` scopes v1 as the smallest contract worth promising, not the largest buildable feature set |
| ISO/IEC/IEEE 12207 | 2017 edition | Yes — ratified, published | The sanity frame that a lifecycle is processes with defined outcomes, not a checklist of documents; the conductor's phase-gate-deliverable shape is consistent with its process view |
| DORA (DevOps Research and Assessment) | Four keys as popularized by *Accelerate* (2018) and annual State of DevOps reports | No — research program, not a standard | The release phase reports lead time and change-failure framing via `loop-ship`, which owns the DORA shelf; this skill cites it only through that skill |
| AIDLC | This plugin's `loop-engine/frameworks/AIDLC.md` | Not a standard — internal framework | The default phase/gate structure the conductor maps the DAG onto; pluggable per `--framework` |

## Confirmation log

- **2026-07-27** — SemVer **2.0.0** confirmed against the primary source (semver.org fetched; title and normative MUST-clauses present).
- **2026-07-27** — ISO/IEC/IEEE 12207:**2017** asserted from training knowledge; **unconfirmed against iso.org as of this date** — confirm before citing the edition outward.
- **2026-07-27** — DORA/Accelerate dates asserted from training knowledge; **unconfirmed as of this date**. The authoritative shelf for DORA lives in `../../loop-ship/references/standards.md` — defer to it on conflict.
- Deliberately left open: no claim is made about any lifecycle standard mandating gates or phases; AIDLC is internal and graded accordingly.
