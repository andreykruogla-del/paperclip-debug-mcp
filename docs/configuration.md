# Configuration

This project is configured through environment variables loaded from `.env` (based on `.env.example`).

## How configuration works

- Copy `.env.example` to `.env` and fill values for your environment.
- Runtime behavior is controlled by collector flags and integration-specific variables.
- Missing optional settings keep related adapters disabled or in limited mode.
- Optional adapter health tools return explicit unconfigured payloads (`configured: false`, `reachable: false`, `error`, `remediation`) when required setup is missing.
- Boolean flags accept common true/false forms (`true/false`, `1/0`, `yes/no`, `on/off`).
- `FILE_COLLECTOR_PATHS` supports both `;` and `,` separators.

## Core Paperclip settings

These variables control Paperclip API access and core incident collection:

- `PAPERCLIP_BASE_URL` (required for Paperclip API features)
- `PAPERCLIP_TOKEN` (required for Paperclip API features)
- `PAPERCLIP_COMPANY_ID` (required for issue listing features)
- `PAPERCLIP_PROJECT_ID` (optional)
- `PAPERCLIP_ISSUE_IDS` (optional override list)
- `PAPERCLIP_MAX_ISSUES` (optional, default `25`, runtime-capped)

## Collector enable flags

Collector flags determine which data sources are active:

- `PAPERCLIP_COLLECTOR_ENABLED` (default `true`)
- `DOCKER_COLLECTOR_ENABLED` (default `true`)
- `FILE_COLLECTOR_ENABLED` (default `false`)
- `WORDPRESS_COLLECTOR_ENABLED` (default `false`)
- `CADDY_COLLECTOR_ENABLED` (default `false`)
- `SENTRY_COLLECTOR_ENABLED` (default `false`)
- `K8S_COLLECTOR_ENABLED` (default `false`)
- `POSTGRES_COLLECTOR_ENABLED` (default `false`)
- `REDIS_COLLECTOR_ENABLED` (default `false`)

## HTTP transport settings

These variables affect `npm run mcp:http`:

- `MCP_HTTP_PORT` (default `8787`)
- `MCP_HTTP_AUTH_TOKEN` (optional bearer token; when set, HTTP auth is enabled)

## Optional adapter settings

Only configure adapters you actually use.

### File collector (host logs)

- `FILE_COLLECTOR_PATHS`
- `FILE_COLLECTOR_MAX_LINES` (default `300`, runtime-capped)
- `FILE_COLLECTOR_INCLUDE_PATTERN`

### WordPress adapter

- `WORDPRESS_BASE_URL` (required for WordPress checks)
- `WORDPRESS_USERNAME` (optional)
- `WORDPRESS_APP_PASSWORD` (optional; used with username for auth check)

### Caddy adapter

- `CADDY_HEALTH_URL` (optional endpoint health check)
- `CADDY_LOG_PATH` (optional log diagnostics path)
- `CADDY_LOG_TAIL_LINES` (log tail size)

### Sentry adapter

- `SENTRY_BASE_URL` (defaults to Sentry API base in `.env.example`)
- `SENTRY_ORG_SLUG`
- `SENTRY_PROJECT_SLUG`
- `SENTRY_AUTH_TOKEN`

### Kubernetes adapter

- `K8S_NAMESPACE` (namespace diagnostics target)
- `K8S_COLLECTOR_ENABLED` controls collector ingestion, while `paperclipDebug.k8s_health` diagnostics also depend on namespace availability.

### PostgreSQL adapter

- `POSTGRES_URL`

### Redis adapter

- `REDIS_URL`

## Notes and good practices

- Start from `.env.example`; avoid creating ad hoc variable names.
- Enable one optional adapter at a time during initial setup to simplify troubleshooting.
- If an adapter health tool reports `configured: false`, apply the `remediation` hint first, then rerun the same tool before broader triage.
- After configuration changes, run:
  - `npm run doctor`
  - `npm run smoke:live`
- Keep secrets (tokens/passwords) out of commits and logs.
- Treat `.env` as environment-specific; do not assume values are portable across stacks.
