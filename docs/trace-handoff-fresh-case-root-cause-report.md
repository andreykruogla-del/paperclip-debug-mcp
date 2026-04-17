# Trace Handoff Fresh-Case Root Cause Report

## Fresh handoff-oriented scenario created

Scenario created on live authenticated deployment:

- Start time (UTC): `2026-04-17T10:45:18Z`
- Scenario title: `[TRACE-HANDOFF] fresh-case 2026-04-17T10:45:18Z`
- Issue: `fdc827b5-8e33-47a4-96f8-7d7cce7bb22e` (`SIMA-83`)
- Agents involved:
  - `agent_a`: `6072fbc8-59f9-4efe-b731-aab9b8c7cbed`
  - `agent_b`: `f4969b3d-f195-44d9-89ea-67070be67922`
- Runs observed:
  - `run_a`: `c4e35027-5cfc-4bf2-8e65-7fa03e503da5`
  - `run_b`: `36c6776a-bc7a-45e8-986c-7e9b8f81fdb1`

Handoff-oriented actions intentionally executed:

1. create issue assigned to `agent_a`
2. add comment (`step1`)
3. change status to `in_progress`
4. checkout
5. reassign to `agent_b`
6. add comment (`step2`)
7. status toggle `in_progress -> blocked -> in_progress`
8. second checkout

Expected handoff-trace-producing factors:

- two-agent participation,
- reassignment event,
- multiple status transitions,
- comments + checkouts,
- multiple runs linked to the same issue.

## Raw source evidence collected

Raw artifacts were captured under `/tmp/pdmcp_trace_handoff` on server.

1. Run payload evidence

- `run_b` payload (`/api/heartbeat-runs/:runId`) includes issue linkage in `contextSnapshot.issueId`, wake reason `issue_commented`, and full workspace context.
- `run_b` issues route (`/api/heartbeat-runs/:runId/issues`) returns `SIMA-83`.

2. Run events payload evidence

- `run_b` events (`/api/heartbeat-runs/:runId/events`) returned non-empty lifecycle/adapter events.
- DB (`heartbeat_run_events`) confirms rows for both runs (`run_a` and `run_b`).

3. Issue payload evidence

- issue shows reassigned assignee (`agent_b`) and `executionRunId=run_b`.

4. Issue comments payload evidence

- user comments: `step1`, `step2`
- agent comment present and linked to `run_a` context.

5. Issue activity payload evidence

- activity includes: `issue.created`, `issue.comment_added`, `issue.updated`, `issue.checked_out`, reassignment update, status changes.

6. DB / internal trace-like evidence

- `activity_log` exists and records issue activity.
- only one activity row had non-null `run_id`, tied to `issue.comment_added` from `run_a`.
- reassignment/status/checkout transitions did not carry `run_id` linkage.
- table search for `%handoff%|%trace%|%audit%` in public schema returned no dedicated trace/handoff tables.

Conclusion from source raw data:

- source has issue activity and run events,
- but no explicit run-linked handoff trace records were observed for this fresh scenario.

## MCP handoff-path results

Sanity (latest `main` on server: `80240bc`):

- `npm install`: PASS
- `npm run doctor`: PASS
- `npm run mcp:stdio`: PASS
- `npm run mcp:http`: DEGRADED (`EADDRINUSE` on `8802`)
- `/healthz`: PASS (`200`)

Target MCP tool calls (fresh case, using `run_b`):

1. `paperclipDebug.list_runs`
- status: PASS
- sourcePath: `/api/companies/4cb18376-e911-41f4-a531-ba33c940265f/heartbeat-runs?limit=100`
- exact payload signal: `totalRuns=100`, includes `run_b` and `run_a` entries.

2. `paperclipDebug.get_run_events`
- status: PASS
- sourcePath: `/api/heartbeat-runs/36c6776a-bc7a-45e8-986c-7e9b8f81fdb1/events`
- exact payload signal: `totalEvents=2` (for captured call), non-empty run context.

3. `paperclipDebug.trace_handoff`
- status: EMPTY
- exact payload:
  - `totalTraces=0`
  - `summary.requestedRunId=36c6776a-bc7a-45e8-986c-7e9b8f81fdb1`
  - `topSignals[0].signal=no_handoff_traces`

4. `paperclipDebug.build_incident_packet`
- status: PASS
- exact payload signals:
  - `summary.issueId=fdc827b5-8e33-47a4-96f8-7d7cce7bb22e`
  - `summary.runId=36c6776a-bc7a-45e8-986c-7e9b8f81fdb1`
  - `summary.runEvents=2`
  - `packetReadiness.checks.hasRunContext=true`
  - `packetReadiness.checks.hasRunEvents=true`
  - `packetReadiness.checks.hasRelatedIncidents=false`

## Does source actually contain handoff trace data?

For this fresh handoff-oriented scenario:

- **No explicit handoff trace data was found in source as run-linked trace records.**
- We found run events + issue activity logs, but not a dedicated handoff trace stream and not run-linked transition records that would produce non-empty handoff traces in current path.

So source contains relevant operational signals, but not a confirmed non-empty handoff-trace dataset for this case.

## Root cause classification

**Primary classification: Variant A**

`trace_handoff` is empty because source deployment did not produce handoff-linked trace data for this scenario in a form that yields non-empty traces.

Observed nuance:

- source has rich issue activity and run events,
- but those did not materialize as run-linked handoff traces for this case.

## What exactly must be fixed next

1. Upstream/source side:
- emit explicit run-linked handoff transition records (e.g., reassignment/check-out/status handoff markers with run linkage), or
- provide a dedicated handoff trace API contract.

2. Contract clarification:
- define what qualifies as handoff trace in this deployment,
- define required linkage keys (`run_id`, issue-transition binding, actor/service chain).

3. Validation follow-up:
- create one scenario intentionally producing upstream handoff records,
- confirm non-empty source trace dataset before treating empty MCP output as integration bug.

## Public beta impact

- run-centric list/events path remains operational and validated.
- `trace_handoff` cannot yet be claimed as operationally reliable on this deployment based on fresh-case evidence.
- beta messaging should continue to avoid over-claiming handoff trace availability until source emits confirmed handoff-linked trace data.
