# Run Linkage Contract Validation Report

## Live issue payload shape observed

Authenticated live probes were executed against the target deployment (`/api/companies/{companyId}/issues`) with and without `projectId`, plus status-filtered slices (`done`, `in_progress`, `todo`).

Observed top-level run-like fields in issue payloads:

- `checkoutRunId`
- `executionRunId`
- `originRunId`
- `activeRun`

Observed counts from live payload slices:

- Company-wide (`limit=200`): 67 issues
- Project-scoped (`limit=200&projectId=...`): 20 issues
- Project `done`: 12 issues
- Project `in_progress`: 1 issue
- Project `todo`: 1 issue

In all slices above:

- all observed run-like fields were present in schema,
- all run-like field values were `null`,
- no nested non-null run-like path was found.

Read-only DB cross-check (same company/project) confirmed source data state:

- `issues.checkout_run_id`: 0 non-null
- `issues.execution_run_id`: 0 non-null
- `issues.origin_run_id`: 0 non-null

## Current mapping assumption

Before this change, issue mapping treated run linkage as:

- `relatedRunId <- issue.runId`

This assumption does not cover the live payload keys currently emitted by the target deployment.

## Mismatch found or confirmed absence

Finding:

- A schema mismatch existed: code assumed `runId`, while live payload schema uses `checkoutRunId` / `executionRunId` / `originRunId` / `activeRun`.

And separately:

- In this deployment, those live run-linkage fields are currently unpopulated (`null`) across all sampled issues.

Conclusion:

- Contract coverage needed expansion for compatibility.
- Operational emptiness remains because source issue-run linkage data is absent, not because of unmapped non-null live fields.

## Changes made

1. Conservative issue linkage mapping expansion in `src/integrations/paperclip-issues.ts`:

- `relatedRunId` now resolves from:
  - `relatedRunId`
  - `runId`
  - `run_id`
  - `executionRunId`
  - `checkoutRunId`
  - `originRunId`
  - `activeRun.id`
  - `activeRun.runId`

2. Regression coverage in `src/integrations/paperclip-runs.test.ts`:

- added fallback test for `executionRunId` linkage
- added fallback test for nested `activeRun.id` linkage

No new MCP tools were added. No unrelated refactor was introduced.

## Revalidation results

Post-change revalidation was run in the real authenticated target environment for:

- `paperclipDebug.list_runs`
- `paperclipDebug.get_run_events`
- `paperclipDebug.trace_handoff`
- `paperclipDebug.build_incident_packet` (sanity path)

Observed results:

- `list_runs`: still `totalRuns=0` (source path remains issue-derived fallback)
- `get_run_events`: still `totalEvents=0` (no run id available; fallback path)
- `trace_handoff`: still `totalTraces=0`
- `build_incident_packet`: still partial for run context (`hasRunContext=false`, `runEvents=0`)

Interpretation:

- Mapping compatibility is improved for deployments that populate these fields.
- This target deployment still returns no usable run-linked issue data.

## Final blocker status

Still blocked by one precise condition: the authenticated source deployment does not currently provide any non-null issue-to-run linkage values, so issue-derived run-centric fallback remains empty.
