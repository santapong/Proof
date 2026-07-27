# Authoritative standards — the shelf a skill author cites

Pins current as of **2026-07**. See the confirmation log at the foot for what was verified against a primary source in this pass and what was carried forward.

**The Authoritative? column uses the plugin's three grades**, identical on every standards shelf here:

- **Yes** — a recognized standards body, government agency, or licensed framework owner **ratified and published** it, or it is a versioned specification under formal governance that implementations conform to. Carries normative weight on its own.
- **Draft** — real, citable working-group or committee output that **nothing has ratified**. Name the revision and status every time.
- **No** — real, widely followed, and still somebody's opinion: a book, a website, a convention authored by an individual, an OSS project's own practice. Cite as evidence or as vocabulary, never as a requirement.

## The format specifications a skill is made of

| Standard | Issuing body | Edition (2026) | Authoritative? | What it governs here |
|---|---|---|---|---|
| **YAML** | YAML Language Development Team | **1.2, revision 1.2.2** (released **2021-10-01**). Confirmed against `yaml.org` / `spec.yaml.io` on **2026-07-27**; 1.2.2 remains the active revision — it is an editorial revision of 1.2, not a new version | **Yes** — a versioned specification under formal governance that parsers conform to | Every `SKILL.md` frontmatter block. **The colon rule lives here**: a `:` followed by whitespace in a plain scalar opens a nested mapping, so an unquoted `description` containing `": "` is not valid YAML |
| **CommonMark** | CommonMark project | **0.31.2** (**2024-01-28**). Confirmed against `spec.commonmark.org` on **2026-07-27**. Note it is still pre-1.0 and says so | **Yes** — a precisely specified, versioned, testable grammar with a conformance suite | The body of every `SKILL.md` and every reference file |
| **JSON Schema** | JSON Schema org / IETF | **2020-12** — the dialect the Workflow tool's `schema` option expects. The corresponding IETF Internet-Drafts **expired**; the specification is maintained by the JSON Schema project outside the RFC process. **Cite it as a dialect, not as an RFC** | **Draft** | Every `schema` passed to an `agent()` call in a workflow template |

## The conventions this plugin adopts

These are **opinions, widely followed**. They are graded honestly so an author does not cite a blog convention as a requirement.

| Convention | Author | Version | Authoritative? | What it governs here |
|---|---|---|---|---|
| **Semantic Versioning** | Tom Preston-Werner | **2.0.0** | **No** — an individual-authored convention, not a standards-body output, however universal | The plugin version. From 1.0.0, skill names and `argument-hint` flags are API: renaming one is a **major** bump, adding a skill is **minor** |
| **Keep a Changelog** | Olivier Lacan | **1.1.0** | **No** | `CHANGELOG.md` structure. The `Breaking` section is the one that actually protects users |
| **Diátaxis** | Daniele Procida | Living document at `diataxis.fr` — no version number to pin | **No** | The doc-type split. A `SKILL.md` is *how-to*; a `references/*.md` is usually *reference* or *explanation*. Mixing them in one file is the most common authoring smell |
| **C4 model** | Simon Brown | Living, `c4model.com` | **No** | Architecture diagrams a skill emits or documents. Levels 1–3; Level 4 is not worth maintaining |

## The plugin's own law — normative here, and not optional

These are internal, but for a skill author they bind harder than anything above, because the [validation gate](../../../../scripts/validate.mjs) enforces them in CI.

| Document | What it binds |
|---|---|
| `../../loop-engine/references/harness-policy.md` | **H1–H12.** Orchestration shape, earned barriers, adversarial verification, and **H10** — the sandbox rules every template obeys |
| `../../loop-engine/references/loop-policy.md` | **L1–L8.** Iteration, dry-round thresholds, runaway prevention |
| `../../loop-engine/references/execution-modes.md` | **M1–M9.** The `ROUTES` block (§M8) that every routed template carries byte-identically, and the reserved argument names (§M9) |
| `../../../../docs/design/boundary-audit.json` | The 18-skill scope matrix. **Normative — it outranks any plan that disagrees with it** |
| `../../../../CONTRIBUTING.md` | House conventions and the validation commands |

## Edition discipline

- **Re-check cadence.** The format specs above move slowly — YAML has been stable since 2021, CommonMark since 2024. The plugin's own law moves with every release and should be re-read, not remembered.
- **Never invent a version for an unversioned source.** Diátaxis and the C4 model have none. Cite them by name with a retrieval date.
- **If you cannot confirm an edition, write "unconfirmed as of \<date\>" rather than asserting one.** This is not decorative: a shelf in this plugin once published a confidently-worded *non-confirmation* of a book its publisher was openly selling, supported by an invented ISBN-prefix heuristic. A stated unknown is a usable citation; a fabricated certainty discredits every pin beside it.

**Confirmation log — 2026-07-27.** Verified against the primary source: **YAML 1.2 revision 1.2.2 (2021-10-01)**, still the active revision; **CommonMark 0.31.2 (2024-01-28)**, still the latest and still pre-1.0. **Not independently re-confirmed in this pass, and named rather than re-asserted with new precision:** **JSON Schema 2020-12** — the dialect name is stable but the IETF draft status should be re-read before citing it as anything other than a dialect; **Semantic Versioning 2.0.0** and **Keep a Changelog 1.1.0**, both long-stable individual-authored conventions; **Diátaxis** and the **C4 model**, both deliberately unversioned living documents where the honest pin is the name plus the date you read them.
