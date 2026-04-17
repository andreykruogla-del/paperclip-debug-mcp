# Public Beta Announcement Draft

## What this product does

Paperclip Debug MCP provides a single MCP investigation layer for Paperclip-based systems. It unifies issue, run, event, and service context so operators and coding agents can triage faster and produce clearer handoff evidence.

## What is validated in this beta

- Authenticated baseline runtime path (`doctor`, `smoke:live`, `mcp:stdio`, `mcp:http`, `/healthz`).
- Issue-centric investigation workflows (`list_issues`, `get_issue_comments`, prioritization, incident packet flow).
- Run-aware investigation workflows (`list_runs`, `get_run_events`, `trace_handoff`) on fresh authenticated cases.
- Non-empty handoff tracing in validated deployment profile after upstream/source linkage-contract fixes.

## What environments this beta is best suited for

- Authenticated Paperclip deployments where source APIs emit run-linked transition data.
- Deployments where issue payloads expose stable run linkage aliases (for example `runId` / `relatedRunId`).
- Teams that need practical MCP-first triage and handoff workflows rather than dashboard-first operations.

## What is intentionally not promised

- Universal compatibility across all deployment shapes.
- Broad optional-adapter guarantees beyond current validated scope.
- A replacement for full observability platforms or a dashboard/UI product in this repository.

## Why this beta is useful now

- It closes the gap between issue-centric and run-aware investigation in one queryable interface.
- It reduces manual context stitching across issue threads, run events, and handoff paths.
- It gives teams a practical way to produce run-aware incident packets for escalation and audit workflows.

## Suggested short announcement copy

Paperclip Debug MCP is now in run-aware public beta for validated authenticated Paperclip deployments. Teams can use one MCP surface for issue triage, run/event investigation, and handoff tracing, with practical deployment caveats kept explicit.

## Suggested longer announcement copy

We are opening a run-aware public beta for Paperclip Debug MCP.  
In validated authenticated deployment profiles, this beta supports both issue-centric and run-aware investigation workflows: issue and comment triage, run listing, run event analysis, non-empty handoff tracing, and incident packet assembly with run context.

This is a practical operations beta, not a broad "works everywhere" launch.  
Run-aware behavior depends on source deployments exposing stable run-linkage data contracts, and we keep that caveat explicit in release materials. For teams that match the validated profile, the beta is ready for real triage and handoff workflows.
