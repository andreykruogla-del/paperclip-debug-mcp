# MCP Playbook

This playbook provides practical, scenario-based tool sequences for incident triage.

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
