# MCP Tools Reference

This document describes the MCP tools currently exposed by `src/mcp/server.ts`.

## How to read this reference

For each tool, this reference includes:

- what the tool does,
- when to use it,
- key inputs and output shape hints.

All tools return machine-readable `structuredContent` plus a JSON text payload in `content`.

## Core runtime and collector tools

### `paperclipDebug.get_runtime_config`
- Purpose: Return sanitized runtime config and capability flags.
- Use when: You need to validate environment readiness before triage.
- Inputs/output: No inputs. Returns config flags such as collector enables, auth/config presence, and runtime limits.

### `paperclipDebug.list_collectors`
- Purpose: List collectors and their current status/kind.
- Use when: You want a quick view of what data sources are active.
- Inputs/output: No inputs. Returns `{ collectors }`.

### `paperclipDebug.refresh_collectors`
- Purpose: Execute enabled collectors and summarize collection health.
- Use when: You want fresh incident data and per-collector error/count signals.
- Inputs/output: No inputs. Returns collector summaries, total incidents, active collector count, and failed collector count.

### `paperclipDebug.system_snapshot`
- Purpose: Return one high-level operational snapshot across collectors, incidents, services, runs, and issues.
- Use when: You need fast top-level situational awareness.
- Inputs/output: Optional `runLimit`, `issueLimit`. Returns `summary`, `topIncidents`, plus detailed arrays and optional `paperclipError`.

## Incident investigation tools

### `paperclipDebug.list_incidents`
- Purpose: Return normalized incidents from all enabled collectors.
- Use when: You need raw incident entries for investigation.
- Inputs/output: Optional `limit` (max 500). Returns `{ total, incidents }`.

### `paperclipDebug.list_incident_clusters`
- Purpose: Group incidents by fingerprint and sort by impact.
- Use when: You need deduped failure patterns instead of raw event volume.
- Inputs/output: Optional `limit` (max 200). Returns `{ totalIncidents, totalClusters, clusters }`.

### `paperclipDebug.incident_trends`
- Purpose: Build time-bucketed incident trend data.
- Use when: You want to see incident rate movement over time.
- Inputs/output: Optional `windowHours`, `bucketMinutes`. Returns trend buckets and summary metrics.

### `paperclipDebug.prioritize_incidents`
- Purpose: Rank incidents by severity, recency, and likely impact.
- Use when: You need a ranked queue for action.
- Inputs/output: Optional `limit` and `minBand` (`low|medium|high|critical`). Returns counts plus prioritized `incidents`.

### `paperclipDebug.trace_handoff`
- Purpose: Build run-level handoff traces from incidents with `relatedRunId`.
- Use when: Ownership flow or multi-stage handoff is unclear.
- Inputs/output: Optional `runId`, `limit` (max 200). Returns `{ totalIncidents, totalTraces, traces }`.

### `paperclipDebug.list_runs`
- Purpose: List recent Paperclip runs.
- Use when: You need candidate runs for deeper inspection.
- Inputs/output: Optional `limit` (max 200). Returns `{ sourcePath, totalRuns, runs }`; returns an error payload if Paperclip API is not configured.

### `paperclipDebug.get_run_events`
- Purpose: Return normalized events for one run.
- Use when: You are drilling into a specific failed or suspicious run.
- Inputs/output: Required `runId`; optional `limit` (max 5000). Returns `{ sourcePath, runId, totalEvents, events }`.

### `paperclipDebug.list_issues`
- Purpose: List recent Paperclip issues.
- Use when: Investigation starts from issue backlog/state.
- Inputs/output: Optional `limit` (max 200), optional `status`. Returns `{ sourcePath, totalIssues, issues }`; requires Paperclip API and `PAPERCLIP_COMPANY_ID`.

### `paperclipDebug.get_issue_comments`
- Purpose: Fetch ordered comments for one issue.
- Use when: You need timeline/context from issue discussion.
- Inputs/output: Required `issueId`; optional `limit` (max 2000). Returns `{ issueId, sourcePath, totalComments, comments }`.

### `paperclipDebug.list_services`
- Purpose: List Docker services/containers with problematic markers.
- Use when: You suspect infra/service-layer failures.
- Inputs/output: Optional `includeHealthy`. Returns service counts plus `services` list.

### `paperclipDebug.get_service_logs`
- Purpose: Get redacted logs for one service/container.
- Use when: You need direct evidence from runtime logs.
- Inputs/output: Required `service`; optional `tail` (max 5000). Returns log payload from Docker integration.

## Incident packet and export-related tools

### `paperclipDebug.build_incident_packet`
- Purpose: Build a single investigation packet combining issue, comments, run, run events, incidents, and clusters.
- Use when: You need a handoff-ready evidence bundle for one issue/run.
- Inputs/output: Requires at least one of `issueId` or `runId`; optional `runEventLimit`, `incidentLimit`. Returns `{ packet, summary }`.

Note: This tool builds packet data. Repository scripts can export packets to files, but file export itself is outside MCP tool calls.

## Optional adapter tools

### `paperclipDebug.wordpress_health`
- Purpose: Run WordPress health checks (REST, XML-RPC, optional auth).
- Use when: Pipelines depend on WordPress endpoints.
- Inputs/output: No inputs. Returns adapter health payload or `{ configured: false, error }`.

### `paperclipDebug.caddy_health`
- Purpose: Run Caddy endpoint/log diagnostics.
- Use when: Proxy/ingress behavior may be involved.
- Inputs/output: No inputs. Returns health payload or `{ configured: false, error }`.

### `paperclipDebug.sentry_health`
- Purpose: Check unresolved Sentry issue health.
- Use when: You need production exception visibility in the same triage flow.
- Inputs/output: No inputs. Returns health payload or `{ configured: false, error }`.

### `paperclipDebug.k8s_health`
- Purpose: Run namespace-focused Kubernetes diagnostics.
- Use when: Workloads run in Kubernetes and pod/namespace health is suspect.
- Inputs/output: No inputs. Returns health payload or `{ configured: false, error }`.

### `paperclipDebug.postgres_health`
- Purpose: Run read-only PostgreSQL diagnostics.
- Use when: You suspect DB locks, long-running queries, or replication lag.
- Inputs/output: No inputs. Returns health payload or `{ configured: false, error }`.

### `paperclipDebug.redis_health`
- Purpose: Run read-only Redis diagnostics.
- Use when: Cache/queue symptoms suggest latency, memory pressure, or evictions.
- Inputs/output: No inputs. Returns health payload or `{ configured: false, error }`.

## Notes

- If Paperclip API is not configured, Paperclip-backed tools return explicit error payloads.
- Tools that support limits enforce maximum values through input schema validation.
- For first-run triage order, see `docs/mcp-playbook.md`.
