# Public Beta Adopter Notes

## Best-fit deployment profile

- Authenticated Paperclip deployment with valid API access.
- Source data that emits run-linked transition records.
- Issue payloads that expose stable run linkage aliases (`runId`, `relatedRunId`, or equivalent).
- Teams that rely on MCP-driven triage workflows and structured handoff evidence.

## What to expect from issue-centric workflows

- Reliable issue listing and issue comment retrieval in validated authenticated setups.
- Usable prioritization and packet generation for issue-first triage.
- Faster transition from initial issue signal to structured evidence for escalation.

## What to expect from run-aware workflows

- Non-empty run list and run-event retrieval in validated deployment profile.
- Non-empty `trace_handoff` on fresh authenticated cases where linkage data is present.
- Incident packets can include run context and run events when source linkage is available.

## Deployment caveats

- Run-aware behavior is deployment-data dependent, not universal.
- If upstream/source stops emitting run-linked transitions or linkage aliases regress, handoff depth can degrade.
- Optional adapters are available but were not broadly validated as part of this run-aware beta decision.

## What to verify during first setup

1. Baseline checks: `npm run doctor`, `npm run smoke:live`, `npm run mcp:stdio` (and `mcp:http` + `/healthz` if used).
2. Issue path: `list_issues`, `get_issue_comments`, `build_incident_packet`.
3. Run path: `list_runs`, `get_run_events`, `trace_handoff`.
4. Fresh-case validation: confirm at least one fresh authenticated scenario returns non-empty run-aware outputs.

## How to evaluate whether the beta fits your environment

1. Confirm your deployment exposes run linkage in source payloads, not only schema fields with null values.
2. Run a fresh controlled scenario and verify run-aware outputs are operator-usable (not only technically callable).
3. Check whether packet outputs include sufficient run context for your escalation workflow.
4. If run-aware outputs remain empty, use issue-centric path and treat run-aware scope as pending upstream/source contract alignment.
