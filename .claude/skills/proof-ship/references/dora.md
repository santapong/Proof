# DORA — delivery measurements and release records

This is Proof's single home for delivery-metric definitions and collection
mapping. Other skills cite it instead of maintaining another table. DORA is
research guidance, not a release standard or an agent-quality score.

## Current definition and history

Checked 23 October 2026 against the [DORA metric guide](https://dora.dev/guides/dora-metrics/).
It uses five measures:

| Measure | Record needed |
| --- | --- |
| Change lead time | Commit time and successful production deployment time |
| Deployment frequency | Production deployment events within a stated window |
| Failed deployment recovery time | Failure onset and restoration for a failed deployment |
| Change fail rate | Production deployments requiring immediate intervention / production deployments |
| Deployment rework rate | Unplanned production deployments caused by production incidents / production deployments |

DORA groups recovery time with throughput; fail and rework rates describe
instability. Reliability/SLO performance remains a separate operational view.
The [official history](https://dora.dev/insights/dora-metrics-history/) dates the
recovery definition change to 2023 and the fifth delivery metric to 2024. The
older four-key and pilot wording in this repository is superseded here.

## Collection contract — proposed fields, not a shipped collector

The following record is a collection design for the target project. Proof does
not install telemetry or produce these measurements merely by loading a skill.

| Field | Capture point | Use |
| --- | --- | --- |
| `deploymentId`, `service`, `artifactDigest` | Promotion | Join one actual production deployment to its artifact and service |
| `commitShas`, per-commit `committedAt` | Build/provenance | Derive commit-to-deploy observations; state the aggregation instead of using only a merge timestamp |
| `productionDeployedAt` | Successful production deployment | Delivery timing; do not silently substitute a later feature-flag release time |
| `releasedAt` (optional) | User exposure | Separate local deployment-versus-release analysis |
| `reachedProduction`, `requiredIntervention`, `outcome` | Deployment/bake | Keep pre-production gate catches outside the production denominator |
| `failedAt`, `restoredAt`, `incidentId` | Failure and recovery | Include detection delay; remediation-start time alone omits it |
| `unplannedIncidentRework`, `causedByIncidentId` | Rework deployment | Identify incident-driven rework without classifying every refactor or rejected PR as rework |
| `strategy`, `blockingGate` (optional) | Gate/ramp | Local process analysis, not extra DORA measures |

Use one service/application, a stated time window, deduplicated event IDs and
consistent clocks. Preserve unknown timestamps and missing incident links as
unknown. A source schema or a green test is not evidence the telemetry exists.
A zero-event denominator is unavailable, not a perfect failure rate.

A production canary requiring intervention is not exempt because exposure was
small. A check that blocks an artifact before production is a gate catch; retain
it as local evidence without manufacturing a production deployment.

## Boundaries with other skills

- `proof-ship` prepares the record and deployment/rollback evidence.
- `proof-audit` consumes relevant historical outcomes when assessing a change;
  its memo is not a second metrics collector.
- `proof-operate` owns live SLIs and error budgets. An outage unrelated to a
  deployment does not automatically enter deployment-recovery measurements.
- `proof-incident` supplies an incident timeline; join it by identity rather than
  maintaining competing timestamps.
- `proof-autopilot` may track proposal count, review latency, rejection and merge
  outcomes. Those are proposal-process measurements. A draft PR is not a
  production deployment, and closing one is not deployment recovery.

Compare a team's trend under stable definitions. If quoting annual performance
clusters, cite the actual report year and application scope. These measures do
not establish Proof's routing quality, test effectiveness or token savings.
