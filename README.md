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
