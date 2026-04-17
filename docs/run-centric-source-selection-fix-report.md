# Run-Centric Source Selection Fix Report

## Root cause addressed

Run-centric integration selected a lossy issue-derived reconstruction path too early. In authenticated deployment this caused empty results when issue-level run linkage fields became transient or null after run progression/completion.

Fix implemented:

- prefer deployment-native heartbeat run endpoints first,
- use issue-to-runs association as secondary fallback,
- keep issue-derived reconstruction only as final fallback.

## Native run routes used

Primary routes now attempted first:

- `/api/heartbeat-runs?limit=:limit`
- `/api/heartbeat-runs?take=:limit`
- `/api/companies/:companyId/heartbeat-runs?limit=:limit`
- `/api/companies/:companyId/heartbeat-runs?take=:limit`
- `/api/heartbeat-runs/:runId/events`
- `/api/heartbeat-runs/:runId`
- `/api/companies/:companyId/heartbeat-runs/:runId/events`
- `/api/companies/:companyId/heartbeat-runs/:runId`

Validated on fresh case:

- `paperclipDebug.list_runs` sourcePath: `/api/companies/4cb18376-e911-41f4-a531-ba33c940265f/heartbeat-runs?limit=100`
- `paperclipDebug.get_run_events` sourcePath (after run completion): `/api/heartbeat-runs/1c97836a-548c-4128-b198-f33dd2cef059/events`

## Secondary association routes used

Secondary fallback route:

- `/api/issues/:issueId/runs`

Additional run->issue association route used for event reconstruction when needed:

- `/api/heartbeat-runs/:runId/issues`

Observed during fresh-case early queued phase:

- native run events were empty for queued run,
- secondary association path produced non-empty derived events and preserved explicit sourcePath suffix (`#derived_from_issue_runs_association`).

## Remaining fallback behavior

Final fallback remains available only as last resort:

- issue-derived reconstruction from company issue listing (`#derived_from_issues`).

Post-fix behavior confirms this path is no longer primary and does not shadow native heartbeat sources.

## Fresh-case revalidation results

Fresh controlled scenario:

- started: `2026-04-17T09:09:11Z`
- issue: `f890a928-6003-498e-847e-b80be49e5df9` (`SIMA-82`)
- run: `1c97836a-548c-4128-b198-f33dd2cef059`

Environment run checks:

- `npm install`: PASS
- `npm run doctor`: PASS
- `npm run smoke:live`: PASS
- `npm run mcp:stdio`: PASS (startup)
- `npm run mcp:http`: DEGRADED (`EADDRINUSE` on `8802`, existing listener still served health)
- `/healthz`: PASS (HTTP 200)

MCP tool results on fresh case:

1. `paperclipDebug.list_runs`
- PASS
- non-empty (`totalRuns: 100`)
- sourcePath: native heartbeat company runs route
- fallback used: no

2. `paperclipDebug.get_run_events`
- PASS
- non-empty (`totalEvents: 3` after run completion)
- sourcePath: native heartbeat run events route
- fallback used: no in final pass (secondary association was used only earlier while run was queued and native events were empty)

3. `paperclipDebug.trace_handoff`
- PASS (execution), EMPTY result (`totalTraces: 0`)
- no run-linked incident handoff traces found for this fresh scenario

4. `paperclipDebug.build_incident_packet`
- PASS
- includes run context and non-empty runEvents (`runEvents: 3`)
- packet readiness confirms `hasRunContext=true`, `hasRunEvents=true`

## Public beta impact

Material impact: source-selection blocker for run list/event retrieval is resolved in validated deployment.

Current caveat:

- `trace_handoff` remains empty for this fresh case because no run-linked incident traces were generated, not because runs/events are unreachable.

Public-beta implication:

- run-centric data-plane access (list + events) materially improved and now operational on authenticated deployment,
- handoff-trace usefulness still depends on incident linkage availability in live data.
