# Paperclip Debug MCP

`Paperclip Debug MCP` is an MCP-first debugging layer for Paperclip ecosystems.

It gives coding agents structured incident intelligence instead of raw logs and screenshot ping-pong.

## Why install this

When incidents happen, most teams lose time on:
- manually jumping between logs, dashboards, and chat
- repeating the same investigation queries
- spending extra tokens on context reconstruction

This project exposes a stable MCP tool surface for incident triage:
- collector health
- normalized incidents
- deduplicated incident clusters

Goal: reduce `time-to-root-cause` and `tokens-per-incident`.

## 60-second start

```bash
npm install
npm run mcp:stdio
```

Then connect from your MCP client (`Codex`, `Claude`, `Cursor`, etc.) and call:
- `paperclipDebug.list_collectors`
- `paperclipDebug.list_incidents`
- `paperclipDebug.list_incident_clusters`

## Current scope (v0)

- MCP `stdio` server
- pluggable collector/adaptor model
- normalized incident schema
- incident dedup clustering by fingerprint

This is intentionally UI-independent.

## Works only with one stack?

No.

This server is adaptor-based. It can support any user stack as long as a collector returns normalized incidents.

Not limited to one environment or one runtime.

## Collector contract

Each collector provides:
- `id`
- `kind` (`paperclip`, `docker_service`, `external`)
- `collectIncidents()`

This keeps MCP tools stable while integrations evolve.

## Target runtime adapters

Priority adapters:
- `Paperclip`
- `Hermes Agent`
- `OpenClaw`
- `OpenCode`
- local coding adapters (`Codex`, `Claude`, `Cursor`) via runtime signals

## Build a moat (hard to copy)

The moat is not a dashboard.

The moat is:
- normalized cross-runtime incident model
- high-quality dedup and pattern clustering
- handoff-aware diagnostics
- measurable efficiency metrics (`time_to_root_cause`, `tokens_per_incident`, `queries_per_incident`)

## Roadmap estimate

- `v0`: stdio MCP + baseline tools + clustering (`1-2 days`)
- `v1`: real Paperclip + Docker collectors (`3-5 days`)
- `v2`: Hermes/OpenClaw/OpenCode adapters + handoff trace (`1-2 weeks`)
- `v3`: HTTP mode, auth hardening, integration tests (`3-5 days`)

Production-capable baseline: around `2-3 weeks` of focused work.
