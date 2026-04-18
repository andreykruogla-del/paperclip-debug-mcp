# Public Beta Announcement Draft

## Positioning

Paperclip Debug MCP is an MCP-first incident investigation layer for Paperclip-based agent systems. It gives operators and coding agents one queryable MCP surface for issue triage, run-aware investigation, service context, and handoff evidence.

## What is validated in this beta

- Authenticated baseline runtime path (`doctor`, `smoke:live`, `mcp:stdio`, `mcp:http`, `/healthz`).
- Issue-centric investigation workflows (`list_issues`, `get_issue_comments`, prioritization, incident packet flow).
- Run-aware investigation workflows (`list_runs`, `get_run_events`, `trace_handoff`) on fresh authenticated cases.
- Non-empty handoff tracing in validated deployment profile after upstream/source linkage-contract fixes.

## Best-fit deployment profile

- Authenticated Paperclip deployments where source APIs emit run-linked transition data.
- Deployments where issue payloads expose stable run linkage aliases (for example `runId` and `relatedRunId`).
- Teams that need practical MCP-first triage and handoff workflows.

## What is not being claimed

- Universal compatibility across all deployment shapes.
- Broad optional-adapter validation beyond the current decision surface.
- A replacement for a full observability platform.
- A dashboard/UI product in this repository.
- A broad workflow automation platform.

## Short announcement copy

Paperclip Debug MCP is now in run-aware public beta for validated authenticated Paperclip deployments. Teams can use one MCP surface for issue triage, run/event investigation, and handoff tracing, with the deployment-data caveat kept explicit.

## Medium announcement copy

We are opening a run-aware public beta for Paperclip Debug MCP.

In validated authenticated deployment profiles, this beta supports issue-centric and run-aware investigation workflows: issue/comment triage, run listing, run event investigation, non-empty handoff tracing, and packet generation with run context.

This is not a universal compatibility claim. Run-aware behavior remains deployment-data dependent on stable run-linked source data and linkage aliases.

## Long announcement copy

Paperclip Debug MCP is an MCP-first incident investigation layer for Paperclip-based agent systems.

The practical problem it addresses is context fragmentation: teams often jump between issue threads, run logs, service signals, and ad hoc notes before they can even form a reliable root-cause hypothesis. This beta focuses on reducing that fragmentation with one structured MCP investigation surface.

In the current validated posture, run-aware public beta means:

- authenticated baseline path is validated (`doctor`, `smoke:live`, `mcp:stdio`, `mcp:http`, `/healthz`)
- issue-centric workflows are usable (`list_issues`, `get_issue_comments`, prioritization, packet flow)
- run-aware workflows are usable on fresh authenticated cases (`list_runs`, `get_run_events`, `trace_handoff`)
- non-empty handoff tracing is confirmed in the validated deployment profile

This is intentionally a disciplined launch. It is validated for matching authenticated deployment profiles and remains deployment-data dependent. It is not positioned as a full observability suite, a dashboard/UI product, or a broad workflow automation platform.

## Feedback ask

If you test this beta, we are most interested in practical feedback on:

- setup clarity in authenticated environments
- whether the run-aware investigation flow reduces manual query loops
- whether handoff tracing and incident packets are useful for real escalation paths
