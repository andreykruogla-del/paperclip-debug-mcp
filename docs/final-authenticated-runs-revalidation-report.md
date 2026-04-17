# Final Authenticated Runs Revalidation Report

## Environment used

- Date (UTC): 2026-04-17
- Repository: `paperclip-debug-mcp`
- Git ref: `main` at `05838c873f1ebb1ec3a9ec37c2e5b650c697b39a` (after PR #27 merge)
- Validation host: real Paperclip server environment (`/opt/paperclip-debug-mcp-field-validation`)
- Runtime:
  - Node.js: `v24.14.1` (Node 22 not available in this environment)
  - npm: `11.11.0`
- Authenticated Paperclip variables configured and present:
  - `PAPERCLIP_BASE_URL`
  - `PAPERCLIP_TOKEN`
  - `PAPERCLIP_COMPANY_ID`
  - `PAPERCLIP_PROJECT_ID`

## Validation steps run

Executed in real authenticated environment:

1. `npm install` -> PASS
2. `npm run doctor` -> PASS
3. `npm run smoke:live` -> PASS
4. `npm run mcp:stdio` -> PASS (startup validated)
5. `npm run mcp:http` -> PASS
6. `GET /healthz` -> PASS (`HTTP 200`, `{"ok":true,...}`)

Doctor preflight evidence:

- `paperclipPreflight.status: "ok"`
- `paperclipPreflight.checks.runs.status: "ok"`
- `paperclipPreflight.checks.runs.sourcePath` points to issue-derived fallback:
  - `/api/companies/<companyId>/issues?...#derived_from_issues`

Interpretation:

- Previous runs-plane mismatch blocker (`endpoint_mismatch`) is no longer present in `doctor`.
- Runs path now degrades to fallback cleanly instead of failing mismatch preflight.

## Run-centric MCP results

### 1) `paperclipDebug.list_runs`

- Status: DEGRADED
- Payload:

```json
{
  "sourcePath": "/api/companies/4cb18376-e911-41f4-a531-ba33c940265f/issues?limit=100&projectId=a34665bd-d2fa-46df-bca8-2b5c85545a9d#derived_from_issues",
  "totalRuns": 0,
  "runs": []
}
```

- Data source: issue-derived fallback (not dedicated run endpoints)
- Operator-usable: limited (explicitly shows no run data, but no actionable run list)
- Machine-usable: yes (stable structure + explicit `sourcePath`)
- Misleading/implicit risk: low (fallback is explicit in `sourcePath`)

### 2) `paperclipDebug.get_run_events`

- Status: DEGRADED
- Request used: `runId="missing-run-id"` (no run id available from `list_runs`)
- Payload:

```json
{
  "sourcePath": "/api/companies/4cb18376-e911-41f4-a531-ba33c940265f/issues?limit=200&projectId=a34665bd-d2fa-46df-bca8-2b5c85545a9d#derived_from_issues",
  "runId": "missing-run-id",
  "totalEvents": 0,
  "events": [],
  "summary": {
    "runId": "missing-run-id",
    "returnedEvents": 0
  }
}
```

- Data source: issue-derived fallback (not dedicated run events endpoints)
- Operator-usable: limited (clear empty result, but no diagnostic run timeline)
- Machine-usable: yes (structured zero-result response)
- Misleading/implicit risk: low (fallback explicit via `sourcePath`)

### 3) `paperclipDebug.trace_handoff`

- Status: DEGRADED
- Payload:

```json
{
  "traces": [],
  "totalTraces": 0,
  "totalIncidents": 20,
  "summary": {
    "requestedRunId": "missing-run-id",
    "returnedTraces": 0
  }
}
```

- Data source: incident graph, with no run-linked evidence in this deployment
- Operator-usable: limited (coherent empty response, no handoff chain)
- Machine-usable: yes (stable shape + explicit counts)
- Misleading/implicit risk: low (empty trace state is explicit)

### Sanity context tools

- `paperclipDebug.system_snapshot`: PASS, but reports `runs: 0`, `issues: 20`
- `paperclipDebug.prioritize_incidents`: PASS, reports `hasRunLinkedIncidents: false`
- `paperclipDebug.build_incident_packet`: PASS for issue context, but `packetReadiness.state: "partial"` and `hasRunContext: false`

## Dedicated route vs fallback behavior

- Dedicated run-plane mismatch blocker appears resolved at preflight level:
  - No `endpoint_mismatch` in `doctor`.
- In this authenticated deployment, run-centric tools are currently served through fallback/derived paths:
  - `list_runs.sourcePath` -> `...#derived_from_issues`
  - `get_run_events.sourcePath` -> `...#derived_from_issues`
- Fallback visibility quality: acceptable (explicit in payload via `sourcePath`; no false claim of native run events).
- Practical usability quality for run-centric investigation: insufficient (no runnable run context returned).

## Remaining issues if any

1. Run-centric investigation is still not operationally useful in this deployment:
- Evidence: `list_runs.totalRuns=0`, `get_run_events.totalEvents=0`, `trace_handoff.totalTraces=0`.

2. Incident packet generation remains mostly issue-centric in this environment:
- Evidence: `build_incident_packet.packetReadiness.checks.hasRunContext=false` and `runEvents=0`.

## Final public beta recommendation

**still no-go**

Rationale:

- PR #27 successfully removed the prior runs-plane mismatch blocker signal in `doctor`.
- However, authenticated run-centric path is not yet truly usable in this target deployment; fallback is explicit and safe, but results are empty for actual run investigation.
