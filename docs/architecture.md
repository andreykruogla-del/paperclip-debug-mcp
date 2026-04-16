# Architecture Overview

## System purpose

Paperclip Debug MCP provides one MCP-facing investigation layer over multiple runtime sources.
Its purpose is to convert heterogeneous operational signals (API data, service state, logs, dependency health) into incident-oriented outputs that agents can query consistently during triage.

## Main architectural layers

1. Source and integration layer (`src/integrations`)
   - Connects to external systems such as Paperclip API, Docker, WordPress, Caddy, Sentry, Kubernetes, PostgreSQL, and Redis.
2. Collector layer (`src/collectors`)
   - Pulls source data and maps it into normalized incident signals.
3. Core incident layer (`src/core`)
   - Normalization support (fingerprints), collector orchestration, prioritization, clustering, trends, handoff tracing, packet building, and runtime config parsing.
4. MCP exposure layer (`src/mcp/server.ts`)
   - Registers MCP tools and exposes all investigation capabilities through a consistent tool contract.
5. Transport/runtime entrypoints (`scripts/mcp-stdio.ts`, `scripts/mcp-http.ts`)
   - Runs the same MCP server over stdio or streamable HTTP.

## Collectors and adapters

The server builds a `CollectorRegistry` and registers enabled collectors at startup.

Core collectors:
- Paperclip API collector
- Docker CLI collector
- Filesystem log collector

Optional dependency adapters (registered as collectors, enabled via config):
- WordPress health
- Caddy health
- Sentry health
- Kubernetes health
- PostgreSQL health
- Redis health

Operationally, each collector contributes either normalized incidents, health diagnostics, or both, depending on the source and enabled tool path.

## Incident normalization and analysis

The core model is an `Incident` (`src/core/types.ts`) with fields like source, service, severity, timestamp, summary, probable cause, and related run ID.

Normalization and orchestration:
- `CollectorRegistry` runs collectors, captures collector status/errors, and returns a unified incident list.
- Missing fingerprints are derived via `computeFingerprint` (`src/core/incident-analysis.ts`) using incident content.

Analysis capabilities:
- Clustering: groups incidents by fingerprint (`clusterIncidents`).
- Prioritization: scores incidents by severity, recency, and contextual signals (`prioritizeIncidents`).
- Trends: builds time buckets over an incident window (`buildIncidentTrends`).
- Handoff tracing: groups run-linked incidents into ordered traces (`buildHandoffTraces`).
- Packet building: composes a handoff-ready packet around issue/run context (`buildIncidentPacket`).

## MCP exposure layer

`createMcpServer()` in `src/mcp/server.ts` binds runtime, collectors, clients, and analysis functions into MCP tools.

Tool groups exposed by the server:
- Runtime/collector control: runtime config, collector listing, refresh, system snapshot.
- Investigation: incidents, clusters, trends, prioritization, handoff trace, runs/events, issues/comments, services/logs.
- Packet construction: incident packet build endpoint.
- Adapter health tools: WordPress, Caddy, Sentry, Kubernetes, PostgreSQL, Redis.

The MCP layer returns structured JSON payloads and explicit configuration errors when required integration settings are missing.

## Runtime and transport modes

Configuration:
- Environment-driven (`.env`, `.env.example`) via `readRuntimeConfig`.
- Collector and adapter behavior is controlled by enable flags and source-specific variables.
- HTTP auth is optional through `MCP_HTTP_AUTH_TOKEN`.

Transport modes:
- `mcp:stdio` script: local stdio MCP transport.
- `mcp:http` script: streamable HTTP MCP transport with:
  - `POST /mcp`
  - `GET /mcp`
  - `DELETE /mcp`
  - `GET /healthz`

Both modes use the same MCP server factory, so tool behavior is consistent across transports.

## Notes and boundaries

- This architecture is collector-first: new sources should map into the existing incident model.
- Optional adapters remain inactive unless enabled/configured in environment settings.
- Some tools are dependency-gated (for example, Paperclip-backed tools require Paperclip API settings).
- Packet export to files is handled by scripts in `scripts/`, while MCP tools provide packet data for interactive workflows.
