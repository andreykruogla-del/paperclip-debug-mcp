# MCP Playbook

This playbook provides practical, scenario-based tool sequences for incident triage.

## Quick decision matrix (under pressure)

| Dominant signal | Recommended next chain | Stop condition |
|---|---|---|
| High/critical incident pressure in snapshot or prioritization | `paperclipDebug.prioritize_incidents` -> `paperclipDebug.list_incident_clusters` -> `paperclipDebug.incident_trends` | Top high/critical set is stable, clustered, and has a clear owner path. |
| Run-linked incidents or uncertain handoff ownership | `paperclipDebug.get_run_events` -> `paperclipDebug.trace_handoff` -> `paperclipDebug.build_incident_packet` | Timeline and ownership path are explicit enough for handoff/escalation. |
| Issue-first investigation with unclear runtime impact | `paperclipDebug.get_issue_comments` -> `paperclipDebug.build_incident_packet` -> `paperclipDebug.prioritize_incidents` | Issue context, related run context, and correlated incident impact are all captured. |
| Problematic services dominate | `paperclipDebug.list_services` -> `paperclipDebug.get_service_logs` -> `paperclipDebug.prioritize_incidents` | Service-level failure signature is confirmed or ruled out as primary driver. |
| Dependency adapter health is degraded (`configured: false` or `reachable: false`) | `<adapter>_health` -> `paperclipDebug.refresh_collectors` -> `paperclipDebug.prioritize_incidents` | Adapter state is either remediated or clearly declared as current root-cause candidate. |

## Role-focused quick paths

### Incident commander (fast coordination path)

Use when you need fast scope, priority, and assignment under time pressure.

1. `paperclipDebug.system_snapshot`
2. `paperclipDebug.prioritize_incidents` with `minBand=high`
3. `paperclipDebug.list_incident_clusters`
4. `paperclipDebug.build_incident_packet` with top `issueId` or `runId` from current signals

Stop when:
- A clear top incident set, active owner, and next executable remediation path are documented.

### Implementation operator (deep execution path)

Use when you own remediation and need root-cause confirmation before changes.

1. Pick the dominant branch: run path, issue path, service path, or dependency adapter path.
2. Execute that branch end-to-end.
3. Re-run `paperclipDebug.prioritize_incidents` to confirm impact shift.

Stop when:
- Root-cause candidate is evidence-backed and either mitigation is applied or rollback/escalation is decided.

## 1) Preflight on a new environment

When to use:
- First run in a new environment or after major `.env` changes.

Suggested tool call order:
1. `paperclipDebug.get_runtime_config`
2. `paperclipDebug.list_collectors`
3. `paperclipDebug.refresh_collectors`

Look for:
- Expected collectors enabled.
- Missing configuration signals (`configured: false`, explicit errors).
- Non-zero incident collection where expected.

Next step:
- If configuration errors appear, fix `.env` first.
- If preflight is healthy, continue with fast triage.

Stop condition:
- All required collectors/dependencies are either healthy or explicitly marked as intentionally unavailable.

## 2) Fast triage

When to use:
- You need immediate operational focus across the whole system.

Suggested tool call order:
1. `paperclipDebug.system_snapshot`
2. `paperclipDebug.prioritize_incidents` with `minBand=high`
3. `paperclipDebug.list_services` with `includeHealthy=false`
4. `paperclipDebug.incident_trends` with `windowHours=24`, `bucketMinutes=60`

Look for:
- High/critical incident concentration.
- Problematic services overlapping with top incidents.
- Rising trend buckets that indicate active degradation.

Next step:
- If service signals dominate, use Service outage path.
- If one run/issue dominates, pivot to run-centered or issue-centered investigation.

Stop condition:
- You can route work to one dominant path (run, issue, service, or adapter) without ambiguity.

## 3) Failed run investigation

When to use:
- A specific run appears failed or handoff ownership is unclear.

Suggested tool call order:
1. `paperclipDebug.list_runs` (find target run)
2. `paperclipDebug.get_run_events` (selected `runId`)
3. `paperclipDebug.trace_handoff` (same `runId`)

Look for:
- Error bursts and sequence breakpoints in run events.
- Handoff gaps or repeated role transitions.

Next step:
- If run maps to an issue, build an incident packet for handoff.
- If signals point to infra dependency, run the relevant adapter path.

Stop condition:
- Run timeline, handoff boundaries, and next owner are clear enough to execute or escalate.

## 4) Issue-centered investigation

When to use:
- Investigation starts from a known Paperclip issue ID.

Suggested tool call order:
1. `paperclipDebug.list_issues`
2. `paperclipDebug.get_issue_comments` (selected `issueId`)
3. `paperclipDebug.build_incident_packet` with `issueId`

Look for:
- Timeline context from comments.
- Related run linkage and correlated incidents/clusters in the packet summary.

Next step:
- Use packet output for team handoff or archive.
- If linked run/service is clear, jump to run/service deep dive.

Stop condition:
- Issue thread context and packet evidence are sufficient for a concrete next action.

## 5) Service outage path

When to use:
- Root cause is likely in container/service infrastructure.

Suggested tool call order:
1. `paperclipDebug.list_services` (problematic first)
2. `paperclipDebug.get_service_logs` (target service)
3. `paperclipDebug.prioritize_incidents`

Look for:
- Service-level error signatures matching high-priority incidents.
- Time overlap between log failures and incident spikes.

Next step:
- If dependency-specific symptoms appear, run the matching adapter scenario.
- If service state normalizes, return to incident clustering/trend analysis.

Stop condition:
- Service-level causality is confirmed or confidently ruled out.

## 6) Dependency adapter paths

### 6a) WordPress path

When to use:
- Ingestion/update flow depends on WordPress endpoints.

Suggested tool call order:
1. `paperclipDebug.wordpress_health`
2. `paperclipDebug.refresh_collectors`
3. `paperclipDebug.prioritize_incidents` with `minBand=medium`

Look for:
- WordPress health failures and correlated medium/high incidents.

Next step:
- If unhealthy, treat WordPress dependency as active root-cause candidate.

Stop condition:
- WordPress is either healthy enough to deprioritize or clearly part of the active incident driver set.

### 6b) Caddy path

When to use:
- Ingress, HTTPS, or reverse-proxy behavior looks suspicious.

Suggested tool call order:
1. `paperclipDebug.caddy_health`
2. `paperclipDebug.refresh_collectors`
3. `paperclipDebug.prioritize_incidents` with `minBand=medium`

Look for:
- Endpoint/log errors aligned with incident timelines.

Next step:
- If unhealthy, prioritize proxy/ingress remediation before deeper app-level analysis.

Stop condition:
- Caddy is stabilized or explicitly escalated as unresolved external blocker.

### 6c) Sentry path

When to use:
- You need production exception context during triage.

Suggested tool call order:
1. `paperclipDebug.sentry_health`
2. `paperclipDebug.refresh_collectors`
3. `paperclipDebug.prioritize_incidents` with `minBand=medium`

Look for:
- Unresolved/high-severity exception pressure matching active incidents.

Next step:
- If exception pressure is high, prioritize fixes for top recurring exception classes.

Stop condition:
- Exception pressure trend is actionable (decreasing with mitigation or escalating with clear owner).

### 6d) Kubernetes path

When to use:
- Runtime components are in Kubernetes and pod/namespace health is suspect.

Suggested tool call order:
1. `paperclipDebug.k8s_health`
2. `paperclipDebug.refresh_collectors`
3. `paperclipDebug.prioritize_incidents` with `minBand=medium`

Look for:
- Pod instability signals correlated with current failures.

Next step:
- If namespace health is degraded, prioritize cluster/pod remediation path.

Stop condition:
- Pod/namespace instability is either mitigated or confirmed as blocker for app-level triage.

### 6e) PostgreSQL path

When to use:
- DB contention, query latency, or replication lag may impact flows.

Suggested tool call order:
1. `paperclipDebug.postgres_health`
2. `paperclipDebug.refresh_collectors`
3. `paperclipDebug.prioritize_incidents` with `minBand=medium`

Look for:
- Lock/long-query/replication signals tied to incident spikes.

Next step:
- If DB health is degraded, prioritize DB-level mitigation before app-only changes.

Stop condition:
- DB pressure is either reduced to acceptable triage level or declared the primary blocker.

### 6f) Redis path

When to use:
- Cache/queue symptoms suggest memory pressure or rejected connections.

Suggested tool call order:
1. `paperclipDebug.redis_health`
2. `paperclipDebug.refresh_collectors`
3. `paperclipDebug.prioritize_incidents` with `minBand=medium`

Look for:
- Latency/eviction/rejection patterns aligned with active incidents.

Next step:
- If Redis health is degraded, prioritize cache/queue stabilization actions.

Stop condition:
- Redis pressure is normalized or explicitly declared as active blocking dependency.

## 7) Evidence export and benchmarking

When to use:
- You need a file-based packet for handoff, audit, or reporting.

Suggested command order:
```bash
npm run incident:packet -- --issue-id <issue-id> --out-dir ./artifacts
# or
npm run incident:packet -- --run-id <run-id> --out-dir ./artifacts
npm run benchmark:report -- --input-dir ./artifacts --output ./artifacts/benchmark.md
```

Look for:
- A generated packet JSON and optional benchmark markdown summary.

Next step:
- Share packet/benchmark artifacts with incident stakeholders.

## 8) HTTP transport smoke

When to use:
- You need to validate HTTP transport availability.

Suggested command order:
```bash
MCP_HTTP_PORT=8799 npm run mcp:http
curl http://localhost:8799/healthz
# if auth token is enabled
curl -H "Authorization: Bearer <token>" http://localhost:8799/healthz
```

Look for:
- Healthy HTTP response from `/healthz`.

Next step:
- If health checks fail, verify `MCP_HTTP_PORT`, auth token setup, and runtime configuration.
