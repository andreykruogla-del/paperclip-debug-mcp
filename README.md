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

## Quick Start

```bash
npm install
cp .env.example .env
npm run smoke:live
npm run mcp:stdio
```

Optional packet export:

```bash
npm run incident:packet -- --issue-id <issue-id>
# or
npm run incident:packet -- --run-id <run-id>
```

## Configuration

```bash
PAPERCLIP_BASE_URL=https://paperclip.example.com
PAPERCLIP_TOKEN=...
PAPERCLIP_COMPANY_ID=...
PAPERCLIP_PROJECT_ID=...         # optional
PAPERCLIP_ISSUE_IDS=...,...      # optional override
PAPERCLIP_MAX_ISSUES=25          # optional
DOCKER_COLLECTOR_ENABLED=true    # set false to disable docker collector
```

Start from [`.env.example`](.env.example).

## Core MCP Tools

- `paperclipDebug.list_collectors`
- `paperclipDebug.list_incidents`
- `paperclipDebug.list_incident_clusters`
- `paperclipDebug.trace_handoff`
- `paperclipDebug.list_runs`
- `paperclipDebug.get_run_events`
- `paperclipDebug.list_issues`
- `paperclipDebug.get_issue_comments`
- `paperclipDebug.list_services`
- `paperclipDebug.get_service_logs`
- `paperclipDebug.build_incident_packet`

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
- Incident clustering and handoff trace
- Incident packet builder and CLI export

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
