# Model routing — rationale and a worked planning case

The executable contract is
[`execution-modes.md`](../../proof-engine/references/execution-modes.md): §M3
routes, §M4 modifiers, §M5 verifier widths, §M6 estimates, §M7 opt-ins and §M8
ROUTES. This file explains decisions; it does not reproduce those tables or
approval prompts. If a rationale conflicts with that contract, correct the
rationale rather than forking the runtime policy.

## Resolve a node

1. Name the output and task type before selecting a model. Formatting is not
   implementation simply because it touches code; a gate is not a mechanical
   check simply because it returns a Boolean.
2. Select `lite`, `balanced` or explicitly chosen `all-out`, then read the
   corresponding canonical route. `balanced` is the default.
3. Account for fan-out and downstream error cost using §M4. A cheap wrong answer
   at a gate can invalidate every dependent node. A large mechanical fan-out
   can dominate cost even when each item is easy.
4. Record why the route fits. Check actual host/model availability. Repository
   pins describe this implementation; they are not a live provider catalog or
   evidence that the account can run them.
5. Keep the authored script's ROUTES block byte-identical to §M8. No second
   routing table, model substitution or verifier-width branch belongs here.

## Worked case: improve an upload path

| Node | Output | Planning rationale | Handoff |
| --- | --- | --- | --- |
| Characterize upload constraints | Source-backed limits and failure cases | Analysis of existing contracts; no implementation yet | `proof-comprehend` or bounded inline reading |
| Implement the agreed change | Scoped diff | Production edit; resolve `implement` in §M3 | Domain work through `proof-engine` when authorized |
| Add a regression check | Executed behavior assertion | `proof-test` owns test conventions; a generated file is not a passing test | `proof-test` |
| Evaluate change risk | Impact/coverage memo | `proof-audit` consumes the same resolved diff | `proof-audit` |
| Gate the result | Evidence-backed decision | Gating classification is explicit; use §M5 width and §M6 budget rules | `proof-engine` |

The plan stores estimates and expected checks. After an authorized execution,
the engine records what actually ran. A missing call, dead verifier or unknown
usage count does not become a zero-cost success.

## Reuse and limits

Use `proof-mcp`'s `route_node` for source-cited authoring advice when available;
its result does not execute a node or replace ROUTES. Provider/model migration
needs a separate compatibility and outcome check. The local smoke runner proves
behavior under stubs, not model quality, real spend or native host acceptance.
