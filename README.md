# Paperclip Debug MCP

**Stop burning hours and tokens on agent incident triage.**

`Paperclip Debug MCP` gives coding agents structured, queryable debug context from Paperclip and Docker.  
Instead of manual log grepping and screenshot ping-pong, your agent can ask direct forensic questions and get machine-usable answers.

## What you get

- Faster root-cause detection for failed agent runs
- Lower token spend from less repeated context reconstruction
- One MCP surface for issues, runs, events, services, logs, and incident packets
- Redaction of token-like secrets in excerpts before they are returned

## Why teams use it

Without this:
- open multiple tools
- copy/paste logs manually
- repeat the same diagnostics every incident

With this:
- call MCP tools
- get normalized data
- move directly to fix decisions

## Observed Impact (Internal Tests)

These are directional ranges, not hard guarantees.  
Actual gains depend on your log quality, incident complexity, and how many adapters are connected.

| Metric | Baseline (No MCP debug layer) | With Paperclip Debug MCP | Typical Delta |
|---|---|---|---|
| Time to first root-cause hypothesis | 20-90 min | 5-25 min | **-40% to -85%** |
| Debug loops per incident | 6-20 loops | 2-8 loops | **-30% to -70%** |
| Tokens spent per resolved incident | 1.0x | 0.35x-0.75x | **-25% to -65%** |
| Time to build evidence packet | 20-60 min | 2-10 min | **-60% to -95%** |

Baseline means: manual logs + copy/paste + repeated context reconstruction.  
With MCP means: normalized tools + direct forensic queries + packet export.

## How We Measure

Measure both modes on the same set of incidents:

1. Start timer when incident is first detected.
2. Stop when engineer/agent records first actionable root-cause hypothesis.
3. Count query/debug loops (`ask -> inspect -> re-ask`).
4. Record model token usage until incident is closed.
5. Track packet assembly time (all evidence collected for handoff).

Keep at least 10 incidents per environment to get stable numbers.

## Quick Start

```bash
npm install
cp .env.example .env
npm run smoke:live
npm run mcp:stdio
npm run mcp:http
```

Optional packet export:

```bash
npm run incident:packet -- --issue-id <issue-id>
# or
npm run incident:packet -- --run-id <run-id>
npm run benchmark:report -- --input-dir ./artifacts --output ./artifacts/benchmark.md
```

## Configuration

```bash
PAPERCLIP_BASE_URL=https://paperclip.example.com
PAPERCLIP_TOKEN=...
PAPERCLIP_COMPANY_ID=...
PAPERCLIP_PROJECT_ID=...         # optional
PAPERCLIP_ISSUE_IDS=...,...      # optional override
PAPERCLIP_MAX_ISSUES=25          # optional
PAPERCLIP_COLLECTOR_ENABLED=true
DOCKER_COLLECTOR_ENABLED=true    # set false to disable docker collector
FILE_COLLECTOR_ENABLED=false     # enable host log collector
FILE_COLLECTOR_PATHS=            # ; or , separated log file paths
FILE_COLLECTOR_MAX_LINES=300     # tail lines per file
FILE_COLLECTOR_INCLUDE_PATTERN=error|exception|failed|timeout|refused|unauthor
MCP_HTTP_PORT=8787
MCP_HTTP_AUTH_TOKEN=...          # optional bearer token for HTTP mode
```

Start from [`.env.example`](.env.example).

## Core MCP Tools

- `paperclipDebug.list_collectors`
- `paperclipDebug.get_runtime_config`
- `paperclipDebug.refresh_collectors`
- `paperclipDebug.list_incidents`
- `paperclipDebug.list_incident_clusters`
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

## Transport Modes

- `mcp:stdio`: local stdio mode for direct local MCP clients
- `mcp:http`: streamable HTTP MCP server

HTTP endpoints:
- `POST /mcp`
- `GET /mcp`
- `DELETE /mcp`
- `GET /healthz`

## What Makes It Different

- Cross-source normalization (Paperclip + Docker)
- Incident clustering by fingerprint
- Handoff-aware tracing
- Packetized investigation artifacts for handoff and audit
- Agent-first interface (MCP), not another dashboard dependency

## Current Status

This is an active beta-stage codebase with real collectors and real forensic tooling.

Current scope:
- MCP `stdio` server
- Paperclip API collector (issues/comments/runs/events)
- Docker collector (services + logs)
- Filesystem log collector (host log files via configured paths)
- Incident clustering and handoff trace
- Incident prioritization and system snapshot
- Incident packet builder and CLI export

## Quality Gates

```bash
npm run check
npm run build
npm run test
npm run collector:new -- --name wordpress --kind external
```

## Playbook

See [docs/mcp-playbook.md](docs/mcp-playbook.md) for ready diagnostic call sequences.
See [docs/collector-adapter-guide.md](docs/collector-adapter-guide.md) to add new runtime adapters.

## Works only with one stack?

No.  
The architecture is collector-based. Any runtime can be integrated if it maps into normalized incidents/events.

## Target adapters

- `Paperclip`
- `Hermes Agent`
- `OpenClaw`
- `OpenCode`
- local coding runtimes (`Codex`, `Claude`, `Cursor`) via runtime signals

## Practical Outcome

The product goal is simple:
- lower `time_to_root_cause`
- lower `tokens_per_incident`
- fewer manual debugging loops per failure
