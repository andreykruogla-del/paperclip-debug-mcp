# Paperclip Issue-Run Linkage Root Cause Report

## Fresh test scenario created

- Scenario start (UTC): `2026-04-17T08:20:50Z`
- Scenario title: `[DIAG][RUN-LINKAGE] fresh-case 2026-04-17T08:20:50Z`
- Created issue:
  - `issue_id`: `eeba6e52-c00d-4d3b-9880-4762609b26db`
  - `identifier`: `SIMA-80`
  - `project_id`: `a34665bd-d2fa-46df-bca8-2b5c85545a9d`
  - `assignee_agent_id`: `6072fbc8-59f9-4efe-b731-aab9b8c7cbed`
- Expected entities from this controlled scenario:
  - new issue,
  - new run,
  - comment/activity trail,
  - explicit issue-run linkage.

Observed outcome:

- New run created: `596a8250-a649-45a7-8b04-ead1eb002f01`
- Run was detected immediately (`poll #1`) and later reached `succeeded`.

## Issue raw payload observed

Fresh issue payload after creation (before run completion) included:

- `executionRunId = "596a8250-a649-45a7-8b04-ead1eb002f01"`
- `checkoutRunId = null`
- `originRunId = null`
- `status = "in_progress"`

Later payload for the same issue (after run completion) showed:

- `executionRunId = null`
- `checkoutRunId = null`
- `originRunId = null`
- issue still `in_progress`

Key observation:

- linkage existed in issue payload while run was active,
- then issue-level linkage field became null after completion.

## Run raw payload observed

Run payload (`/api/heartbeat-runs/:runId`) for `596a8250-a649-45a7-8b04-ead1eb002f01`:

- `status: succeeded`
- `invocationSource: assignment`
- `contextSnapshot.issueId: "eeba6e52-c00d-4d3b-9880-4762609b26db"`
- `contextSnapshot.commentId: "f31d0297-6513-41d8-85a3-2a1ce1dba684"`
- `contextSnapshot.projectId: "a34665bd-d2fa-46df-bca8-2b5c85545a9d"`

Run events (`/api/heartbeat-runs/:runId/events`) were non-empty:

- seq 1: `run started`
- seq 2: `adapter invocation`
- seq 3: `run succeeded`

Run -> issue association route (`/api/heartbeat-runs/:runId/issues`) returned the issue (`SIMA-80`).

## Comments/activity raw payload observed

Issue comments payload (`/api/issues/:id/comments`) contained the diagnostic comment:

- `commentId: f31d0297-6513-41d8-85a3-2a1ce1dba684`
- no direct run id field in the comment object itself.

Issue activity payload (`/api/issues/:id/activity`) contained issue actions (`created`, `updated`, `checked_out`, `comment_added`), but issue activity rows did not carry `runId` values in this case.

Important nuance:

- event-like run trail exists in heartbeat run events,
- not in issue comments/activity rows as direct run ids.

## DB/internal source check

DB access was available and used (read-only checks).

Issue row (`issues`):

- `id = eeba6e52-c00d-4d3b-9880-4762609b26db`
- `execution_run_id` was present earlier, then became null after run completion.

Run row (`heartbeat_runs`):

- `id = 596a8250-a649-45a7-8b04-ead1eb002f01`
- `status = running` then `succeeded`
- `context_snapshot.issueId = eeba6e52-c00d-4d3b-9880-4762609b26db`

Run events table (`heartbeat_run_events`) had 3 rows for the run.

Activity table (`activity_log`) for issue had 4 issue actions and no `run_id` values for these rows.

## MCP tool results on the fresh case

Repository baseline on server (`latest main`): `a5888c0`.

Command checks:

- `npm install`: PASS
- `npm run doctor`: PASS (`runs` check reported fallback source with `count: 0`)
- `npm run smoke:live`: PASS
- `npm run mcp:stdio`: PASS (startup)
- `npm run mcp:http`: DEGRADED (new process hit `EADDRINUSE` on `8802`, but `/healthz` from existing listener returned `200`)
- `/healthz`: PASS

MCP calls (fresh case `issueId=eeba...`, `runId=596a...`):

1. `paperclipDebug.list_issues`:
- PASS
- fresh issue is present (`SIMA-80`)
- no run-linked issue count (`runLinkedIssues: 0`)

2. `paperclipDebug.get_issue_comments`:
- PASS
- returns the fresh diagnostic comment

3. `paperclipDebug.list_runs`:
- EMPTY
- payload:
  - `sourcePath: /api/companies/.../issues?...#derived_from_issues`
  - `totalRuns: 0`
- fallback used: yes (issue-derived)

4. `paperclipDebug.get_run_events` (with exact fresh `runId`):
- EMPTY
- payload:
  - `sourcePath: /api/companies/.../issues?...#derived_from_issues`
  - `totalEvents: 0`
- fallback used: yes (issue-derived)

5. `paperclipDebug.trace_handoff` (with exact fresh `runId`):
- EMPTY
- payload:
  - `totalTraces: 0`
  - `totalIncidents: 22`

6. `paperclipDebug.build_incident_packet` (fresh issue):
- PASS (issue-centric)
- `packetReadiness.checks.hasRunContext = false`
- `summary.runEvents = 0`

## Where the linkage is lost

Fresh controlled case proves:

- issue-run linkage is created in source (`issues.execution_run_id` and `heartbeat_runs.context_snapshot.issueId`),
- run + run events exist and are retrievable from heartbeat run APIs/tables,
- but current MCP run-centric path relies on issue-derived fallback (`/api/companies/:companyId/issues`) for run discovery/events,
- and that fallback becomes empty when issue list payload no longer carries non-null run linkage (as seen after run completion for the fresh case).

So linkage is effectively lost for this path at the API contract surface used by current integration (issue-list-derived run fallback), not at run source generation.

## Root cause classification

**Variant D (main):** linkage exists, but run endpoints/API contract used by current integration are incompatible with the deployment surface used in practice.

Why D is primary here:

- deployment exposes usable run data through heartbeat run routes (`/heartbeat-runs/:id`, `/heartbeat-runs/:id/events`, `/heartbeat-runs/:id/issues`, `/issues/:id/runs`),
- current integration path for run-centric fallback depends on issue-list linkage fields and generic `/api/runs*` probing,
- this misses valid run data when issue-list linkage is transient/cleared.

## What exactly must be fixed next

1. Adapt run-centric data acquisition to deployment-native run surface before relying on issue-derived fallback:
- prefer heartbeat run routes where available for run/event retrieval.

2. For fallback run discovery, do not depend only on non-null run ids in company issue list rows:
- add a deployment-aware path that can resolve issue->runs from `/api/issues/:id/runs` (or equivalent run association route) for candidate issues.

3. Keep issue-derived fallback as last resort, but treat it as potentially lossy when issue linkage fields are transient.

4. Re-validate with one fresh case again after integration update and require non-empty:
- `list_runs`
- `get_run_events` (for known fresh run id)
- `trace_handoff`

No product scope change is required for this diagnosis; this is an integration-contract alignment follow-up.
