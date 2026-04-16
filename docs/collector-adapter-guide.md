# Collector Adapter Guide

Use this guide to connect additional systems (WordPress, scraper, media factory, tender bots, custom services).

## Goal

Map external runtime signals into normalized `Incident[]` so existing MCP tools can operate without changes.

## Fast scaffold

```bash
npm run collector:new -- --name wordpress --kind external
```

Creates:

`src/collectors/wordpress-collector.ts`

## Collector contract

Each collector must implement:

- `id: string`
- `kind: "paperclip" | "docker_service" | "wordpress" | "external"`
- `enabled: boolean`
- `collectIncidents(): Promise<Incident[]>`

## Normalization checklist

For each external event, map to:

- `id`: stable unique id
- `source`: integration source (`wordpress-api`, `scraper`, etc.)
- `service`: subsystem/service name
- `severity`: `info | warning | error | critical`
- `timestamp`: unix ms
- `summary`: short human-readable signal
- `probableCause` (optional)
- `relatedRunId` (optional, if correlated to Paperclip run)
- `rawExcerpt` (optional, redacted)

## Security baseline

- Do not return raw secrets in `summary` / `rawExcerpt`
- Reuse redaction helper: `src/core/redaction.ts`
- Keep OAuth/API keys out of logs and packet exports

## Registration

Register your collector in `src/mcp/server.ts`:

```ts
registry.register(new WordpressCollector());
```

After registration, all core tools (`list_incidents`, clusters, prioritization, packets) work automatically.
