# Standards — the authorities this skill reasons from

Graded per the plugin convention: **Yes** = ratified and published by a standards body or licensed framework owner · **Draft** = real working-group output nothing has ratified · **No** = real, widely followed, still somebody's opinion. The grade is provenance, not quality.

Routing is a thin domain with no standards body. This shelf is honest about that: one sense-making framework from the management literature, one vendor mechanism this skill's premise depends on, and the plugin's own normative instrument — which is internal governance, not a standard, and is listed as such.

## The shelf

| Authority | Edition / pin | Grade | What it anchors here |
|---|---|---|---|
| **Snowden & Boone, "A Leader's Framework for Decision Making"** (the Cynefin framework) | Harvard Business Review, November 2007 issue | **No** | The premise that *classifying the situation precedes choosing the response*, and that misclassification — treating one context's problem with another context's method — is the characteristic failure. Guide borrows the sense-making stance, not the five domains: the fleet's contexts are the audit's, not Cynefin's. Cite as vocabulary, never as a requirement. |
| **Claude Code skills documentation** (code.claude.com/docs — skill selection and the `description` field) | Living vendor documentation; the honest pin is the URL and the date read (2026-08-04) | **No** | The mechanism guide exists to compensate for: host-side selection happens on `description` fields alone and presumes the user's request resembles a trigger phrase. Guide is the path for requests that resemble none. Vendor docs move; re-read before quoting behavior. |
| **`docs/design/boundary-audit.json`** (this repository) | The committed revision in the working tree — always the live one, never a remembered copy | **Internal — normative within this plugin, not a standard** | The entire routing instrument: the matrix, the overlap resolutions, the checkable questions. Listed here so the shelf is complete, and flagged so nobody cites it outward as if it carried external authority. Guide reads it at routing time (trap #5 in `guide-traps.md` is the alternative). |

## What this shelf deliberately does not contain

- **No restatement of any sibling skill's scope.** The scopes live in the audit and the live `description` fields; a shelf row per skill here would be the duplicate-instrument trap wearing a citation's clothing.
- **No triage or dispatch "standard".** Medical triage and ITIL incident-priority schemes were considered and left off: the analogy is decorative — nothing in this skill applies their actual mechanisms, and a decorative citation launders authority the shelf doesn't have.

## Confirmation log — 2026-08-04

**Verified against a primary source this pass:** **Snowden & Boone 2007** (hbr.org — November 2007 issue, confirmed). **Read, dated, and pinned as living:** the **Claude Code skills documentation** (code.claude.com/docs, 2026-08-04 — its frontmatter field list was confirmed the same day for unrelated work; selection-on-description behavior read from the same source). **Internal:** `boundary-audit.json` needs no external confirmation — its authority is the repo's own governance, and the obligation it carries is freshness (read the working-tree copy, never a summary), not verification.
