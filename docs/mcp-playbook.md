# MCP Playbook

This playbook gives ready-to-run diagnostic sequences for coding agents.

## 1) Fast triage (3 calls)

1. `paperclipDebug.system_snapshot`
2. `paperclipDebug.prioritize_incidents` with `minBand=high`
3. `paperclipDebug.list_services` with `includeHealthy=false`
4. `paperclipDebug.incident_trends` with `windowHours=24`, `bucketMinutes=60`

Use this when you need immediate operational focus.

Before triage on new installs:

1. `paperclipDebug.get_runtime_config`
2. `paperclipDebug.list_collectors`
3. `paperclipDebug.refresh_collectors`

## 2) Failed run investigation

1. `paperclipDebug.list_runs` (find failed run)
2. `paperclipDebug.get_run_events` (target run id)
3. `paperclipDebug.trace_handoff` (same run id)

Use this when agent handoff chain is unclear.

## 3) Issue-centered investigation

1. `paperclipDebug.list_issues`
2. `paperclipDebug.get_issue_comments`
3. `paperclipDebug.build_incident_packet` with `issueId`

Use this for structured handoff between CTO/Coder/QA/Observer.

## 4) Service outage path

1. `paperclipDebug.list_services` (problematic containers)
2. `paperclipDebug.get_service_logs` (target service)
3. `paperclipDebug.prioritize_incidents` (to correlate with top failures)

Use this when root cause likely comes from infrastructure/service layer.

## 4b) WordPress dependency path

1. `paperclipDebug.wordpress_health`
2. `paperclipDebug.refresh_collectors`
3. `paperclipDebug.prioritize_incidents` with `minBand=warning`

Use this when ingestion/update flow depends on WordPress API availability.

## 4c) Caddy reverse-proxy path

1. `paperclipDebug.caddy_health`
2. `paperclipDebug.refresh_collectors`
3. `paperclipDebug.prioritize_incidents` with `minBand=warning`

Use this when ingress/HTTPS/proxy behavior is suspicious.

## 5) Evidence export

```bash
npm run incident:packet -- --issue-id <issue-id> --out-dir ./artifacts
```

or

```bash
npm run incident:packet -- --run-id <run-id> --out-dir ./artifacts
```

Use exported JSON packet for incident archive or team handoff.

To summarize packet quality/volume over time:

```bash
npm run benchmark:report -- --input-dir ./artifacts --output ./artifacts/benchmark.md
```

## 6) HTTP transport smoke

```bash
MCP_HTTP_PORT=8799 npm run mcp:http
```

Then check:

```bash
curl http://localhost:8799/healthz
```

If auth token is enabled, send:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8799/healthz
```
