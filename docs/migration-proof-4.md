# Migrate to Proof 4 names

The owner requested `proof-*` only, without aliases, on 23 October 2026.
This is a breaking beta candidate, not a published release or Agensi approval.

Every active skill directory/frontmatter name and framework reference now uses
`proof-` followed by the same role. For example, `loop-guide` becomes
`proof-guide`, `loop-review` becomes `proof-review`, and `loop-build` becomes
`proof-build`. No duplicate folders, aliases or hidden old-name redirects are
installed. Historical release and study records keep their original identifiers.

## Update deliberately

1. Record your version and local edits. Keep v3 if you need the old API.
2. Remove the old plugin/copy through its original installation method. Preserve
   unrelated skills and local customizations.
3. Load the candidate from its reviewed checkout, or install a future published
   Proof 4. Update your own prompts/configuration to the new role-preserving names.
4. Claude Code plugin sessions use `/proof:proof-guide`; project/personal skills
   use `/proof-guide`; Codex skills use `$proof-guide`.
5. Keep `proof-mcp` and `proof://`. Replace the retired `THELOOPSKILL_ROOT` setting
   with `PROOF_ROOT`; the old setting now fails with a migration message.
6. Rebuild packs after changing source/checkouts. Inspect actual host discovery,
   MCP connection and one bounded task; offline packaging is a separate check.

The canonical local repository path is intentionally not renamed. This isolated
worktree does not alter existing released installations or machine symlinks.

## Models and historical learning artifacts

Model pins and ROUTES behavior are unchanged. A naming change is not evidence
that newer provider models improve the workflow. Check availability and evaluate
a separately proposed routing revision before changing those pins.

Old classifier labels/artifacts are not aliased. Retrain explicitly with reviewed
canonical labels. `software-routing-train-proof-v4.jsonl` is an identifier-only
derivation of the old synthetic training fixture, with a parent hash recorded.
It is not independent evaluation evidence. Frozen evaluation guards still reject
a changed normative source: reproduce from the pinned old tree or register a
new study rather than replacing its old hashes.
