# Paperclip Debug MCP

Paperclip Debug MCP is an MCP-first debugging and incident intelligence layer for Paperclip-based agent systems.

## What It Is and Why

When incidents are investigated with disconnected tools, teams lose time rebuilding context from logs, run events, issue threads, and infrastructure signals.

Paperclip Debug MCP provides one queryable interface so coding agents can retrieve structured evidence and move faster to actionable root-cause hypotheses.

Observed impact from internal tests (directional ranges, not guarantees):

- Time to first root-cause hypothesis: `-40% to -85%`
- Debug loops per incident: `-30% to -70%`
- Tokens per resolved incident: `-25% to -65%`
- Time to build evidence packet: `-60% to -95%`

What this project is not:

- It is not a replacement for a full observability platform.
- It is not a UI/dashboard product in this repository.
- It is not a non-MCP primary interface.

## Unified Control Layer

The core product idea is a single control layer with adapters, instead of a fragmented stack of standalone debugging utilities.

This layer:

- normalizes signals from multiple sources into one incident model;
- exposes a single MCP surface for investigation workflows;
- scales through adapter-based extension without rewriting core triage tooling.

Current coverage includes Paperclip API, Docker, host file logs, and optional health adapters for WordPress, Caddy, Sentry, Kubernetes, PostgreSQL, and Redis.

## What You Get

- Faster incident triage and prioritization.
- Incident clustering by fingerprint and trend analysis.
- Run-level handoff tracing for investigation continuity (deployment-data dependent).
- Unified queries for runs, events, issues, comments, services, and logs.
- Incident packet generation for handoff and audit workflows.
- Redaction of token-like secrets in returned excerpts.

## Public Beta Scope Note

Latest authenticated field validation supports a run-aware public beta scope in the validated authenticated deployment profile.

- Validated as usable now: issue-centric investigation (`list_issues`, `get_issue_comments`, prioritization, packet flow with run context when linked data exists).
- Validated as usable now: run-aware investigation (`list_runs`, `get_run_events`, `trace_handoff`) on fresh authenticated field cases after upstream linkage-contract fixes.
- Deployment caveat: run-aware outputs still depend on source deployment emitting run-linked transition data and exposing stable linkage aliases in issue payloads.

For the current release decision, see:

- `docs/run-aware-public-beta-decision.md`
- `docs/public-beta-readiness-report.md`

## Quick Start

```bash
npm install
cp .env.example .env
npm run doctor
npm run smoke:live
npm run mcp:stdio
# or
npm run mcp:http
```

Optional incident packet export:

```bash
npm run incident:packet -- --issue-id <issue-id>
# or
npm run incident:packet -- --run-id <run-id>
```

Configuration is environment-driven via `.env` (see `.env.example`). Key settings include `PAPERCLIP_BASE_URL`, `PAPERCLIP_TOKEN`, `PAPERCLIP_COMPANY_ID`, collector enable flags, and HTTP transport options.
For authenticated deployments, use the Paperclip quick-check subsection in `docs/getting-started.md` before relying on run/issue tools.

## Documentation

- [Getting Started](docs/getting-started.md): first-run setup and initial validation flow.
- [Configuration](docs/configuration.md): environment variable reference and adapter configuration behavior.
- [MCP Tools Reference](docs/mcp-tools-reference.md): current tool contracts and output-shape notes.
- [MCP Playbook](docs/mcp-playbook.md): ready-to-run diagnostic call sequences.
- [Runtime Profiles](docs/runtime-profiles.md): practical `.env` profiles for common runtime stacks.
- [Collector Adapter Guide](docs/collector-adapter-guide.md): how to add and register new adapters.
- [Release Readiness Checklist](docs/release-readiness-checklist.md): lightweight public-beta release validation.
- [Public Beta Readiness Report](docs/public-beta-readiness-report.md): latest release-candidate validation decision memo.
- [Run-Aware Public Beta Decision](docs/run-aware-public-beta-decision.md): current safe public-beta scope and deployment conditions.
- [Issue-Centric Public Beta Decision](docs/issue-centric-public-beta-decision.md): historical constrained decision note superseded by run-aware validation.

## MCP Tools

Core tools:

- `paperclipDebug.get_runtime_config`
- `paperclipDebug.list_collectors`
- `paperclipDebug.refresh_collectors`
- `paperclipDebug.list_incidents`
- `paperclipDebug.list_incident_clusters`
- `paperclipDebug.incident_trends`
- `paperclipDebug.prioritize_incidents`
- `paperclipDebug.trace_handoff`
- `paperclipDebug.list_runs`
- `paperclipDebug.get_run_events`
- `paperclipDebug.list_issues`
- `paperclipDebug.get_issue_comments`
- `paperclipDebug.list_services`
- `paperclipDebug.get_service_logs`
- `paperclipDebug.build_incident_packet`
- `paperclipDebug.system_snapshot`

Optional adapter tools:

- `paperclipDebug.wordpress_health`
- `paperclipDebug.caddy_health`
- `paperclipDebug.sentry_health`
- `paperclipDebug.k8s_health`
- `paperclipDebug.postgres_health`
- `paperclipDebug.redis_health`

## Transports

- `mcp:stdio`: local stdio mode for MCP clients.
- `mcp:http`: streamable HTTP MCP server mode.

HTTP endpoints:

- `POST /mcp`
- `GET /mcp`
- `DELETE /mcp`
- `GET /healthz`

Optional bearer auth is supported via `MCP_HTTP_AUTH_TOKEN`.

## Current Status

This project is in active beta with working collectors and investigation tooling.

Current scope:

- MCP server (`stdio` and `http`)
- Paperclip API collector (issues, comments, runs, events)
- Docker collector (services and logs)
- Filesystem log collector
- Optional ecosystem adapters: WordPress, Caddy, Sentry, Kubernetes, PostgreSQL, Redis
- Incident clustering, trends, prioritization, and handoff trace
- Incident packet builder and CLI export

Current validated public-beta posture:

- Issue-centric scope: validated for authenticated deployment.
- Run-aware scope: validated for authenticated deployment where upstream/source emits run-linked handoff transitions and issue linkage aliases.

## Public Beta Surface

- `package.json` remains `private: true` for now to prevent accidental npm publication.
- Version remains `0.1.0` until a dedicated packaging/publication decision is finalized.
- Public-beta readiness is tracked with [docs/release-readiness-checklist.md](docs/release-readiness-checklist.md).

## Development

Quality and build commands:

```bash
npm run check
npm run build
npm run test
```

Operational utility commands:

```bash
npm run doctor
npm run smoke:live
npm run benchmark:report -- --input-dir ./artifacts --output ./artifacts/benchmark.md
npm run collector:new -- --name wordpress --kind external
```

When adding a new optional adapter, update `README.md`, `.env.example`, and `docs/runtime-profiles.md` in the same PR.
