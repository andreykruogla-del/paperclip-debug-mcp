# Paperclip Triage

`Paperclip Triage` is an MCP-first diagnostics layer for Paperclip systems.

Core idea:
- no UI dependency for debugging
- structured incident data for coding agents
- lower time-to-root-cause and fewer tokens per incident

## Why this project exists

Raw logs and chat ping-pong are too slow for incident debugging.
This project exposes a stable MCP tool surface so agents can query:
- failed runs
- run timelines
- collector health
- service incidents

## Scope (v0)

- `stdio` MCP server
- pluggable collector model
- normalized incident schema
- baseline tools for run/event triage
- incident clustering (dedup by fingerprint)

## Install

```bash
npm install
```

## Run MCP server

```bash
npm run mcp:stdio
```

## Can it work only with your services?

No. The architecture is adapter-based:
- built-in collectors for your current services are just one set of adapters
- any user can add their own collector as long as it returns normalized incidents

## Collector model

Each collector implements:
- `id`
- `kind` (`paperclip`, `docker_service`, `external`)
- `collectIncidents()`

This keeps the MCP API stable while service integrations remain pluggable.

## Runtime adapters (roadmap)

From your current Paperclip environment, these runtimes can be integrated by adapters:
- `Paperclip`
- `Hermes Agent`
- `OpenClaw`
- `OpenCode`
- `Codex (local)`
- `Claude (local)`
- `Cursor (local)`

Important:
- this server is not limited to your personal stack
- any user can plug in any runtime/service if they implement the collector contract

## MCP tools (current)

- `paperclipTriage.list_collectors`
- `paperclipTriage.list_incidents`
- `paperclipTriage.list_incident_clusters`

## Build a moat (hard to copy)

The moat is not UI.
The moat is:
- stable normalized incident schema across runtimes
- high-quality dedup clustering and root-cause ranking
- cross-runtime handoff tracing
- measurable efficiency metrics (`time_to_root_cause`, `tokens_per_incident`)

## Realistic implementation time

- `v0` (stdio MCP + collectors + incidents + clusters): `1-2 days`
- `v1` (real Paperclip + Docker collectors, no samples): `3-5 days`
- `v2` (Hermes/OpenClaw/OpenCode adapters + handoff trace): `1-2 weeks`
- `v3` (HTTP mode, auth hardening, production docs/tests): `3-5 days`

Total to strong production baseline: around `2-3 weeks` of focused work.
