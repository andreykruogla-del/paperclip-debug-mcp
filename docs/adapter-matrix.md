# Adapter Matrix

This matrix summarizes the collectors and adapters currently implemented in this repository.

## How to use this matrix

- Use it to decide which integrations to enable in `.env`.
- Start with core collectors, then enable optional adapters based on your incident surface.
- Validate configuration with `npm run doctor` and `npm run smoke:live` after changes.

## Core collectors

### Paperclip API Collector
- Category: Core collector
- Primary purpose: Pull Paperclip incidents/runs/issues context into the normalized incident model.
- Main signals/data: Issues, issue comments, run summaries, run events, normalized incidents.
- Key configuration variables: `PAPERCLIP_COLLECTOR_ENABLED`, `PAPERCLIP_BASE_URL`, `PAPERCLIP_TOKEN`, `PAPERCLIP_COMPANY_ID`, `PAPERCLIP_PROJECT_ID`, `PAPERCLIP_ISSUE_IDS`, `PAPERCLIP_MAX_ISSUES`.
- When to enable: In most production use cases where Paperclip is the primary source.
- Important limitations/notes: Paperclip-backed tools return explicit error payloads when required API settings are missing.

### Docker CLI Collector
- Category: Core collector
- Primary purpose: Surface container/service-level runtime issues.
- Main signals/data: Docker service snapshots and container logs (via MCP service tools).
- Key configuration variables: `DOCKER_COLLECTOR_ENABLED`.
- When to enable: When workloads run in Docker and service state/logs matter for triage.
- Important limitations/notes: Health and log visibility depend on local Docker CLI/runtime availability.

### Filesystem Log Collector
- Category: Core collector (disabled by default)
- Primary purpose: Pull host log file signals into normalized incidents.
- Main signals/data: Pattern-matched incident excerpts from configured log files.
- Key configuration variables: `FILE_COLLECTOR_ENABLED`, `FILE_COLLECTOR_PATHS`, `FILE_COLLECTOR_MAX_LINES`, `FILE_COLLECTOR_INCLUDE_PATTERN`.
- When to enable: When important runtime logs are on host files rather than only Docker/Paperclip sources.
- Important limitations/notes: Requires valid readable file paths; path list supports `;` or `,` separators.

## Optional adapters

### WordPress Health Adapter
- Category: Optional adapter
- Primary purpose: Validate WordPress dependency health.
- Main signals/data: REST availability, XML-RPC checks, optional auth check result.
- Key configuration variables: `WORDPRESS_COLLECTOR_ENABLED`, `WORDPRESS_BASE_URL`, `WORDPRESS_USERNAME`, `WORDPRESS_APP_PASSWORD`.
- When to enable: If ingestion/content flows depend on WordPress APIs.
- Important limitations/notes: If only base URL is set, public checks can still run; auth checks need username + app password.

### Caddy Health Adapter
- Category: Optional adapter
- Primary purpose: Diagnose reverse-proxy/ingress issues.
- Main signals/data: Caddy endpoint health and optional log diagnostics.
- Key configuration variables: `CADDY_COLLECTOR_ENABLED`, `CADDY_HEALTH_URL`, `CADDY_LOG_PATH`, `CADDY_LOG_TAIL_LINES`.
- When to enable: If Caddy is in the request path and suspected during outages.
- Important limitations/notes: Returns `configured: false` when health URL/log path is not configured.

### Sentry Health Adapter
- Category: Optional adapter
- Primary purpose: Add unresolved production error visibility.
- Main signals/data: Unresolved/high-severity issue diagnostic signals from Sentry.
- Key configuration variables: `SENTRY_COLLECTOR_ENABLED`, `SENTRY_BASE_URL`, `SENTRY_ORG_SLUG`, `SENTRY_PROJECT_SLUG`, `SENTRY_AUTH_TOKEN`.
- When to enable: When Sentry should inform incident prioritization and triage.
- Important limitations/notes: Requires org/project/token setup to be fully active.

### Kubernetes Health Adapter
- Category: Optional adapter
- Primary purpose: Check Kubernetes namespace/pod health.
- Main signals/data: Namespace diagnostics and problematic pod signals.
- Key configuration variables: `K8S_COLLECTOR_ENABLED`, `K8S_NAMESPACE`.
- When to enable: When runtime components run in Kubernetes.
- Important limitations/notes: Uses kubectl-based diagnostics; useful only where cluster access exists.

### PostgreSQL Health Adapter
- Category: Optional adapter
- Primary purpose: Add database health diagnostics.
- Main signals/data: Read-only checks for locks, long-running queries, replication lag.
- Key configuration variables: `POSTGRES_COLLECTOR_ENABLED`, `POSTGRES_URL`.
- When to enable: When DB behavior may contribute to failures.
- Important limitations/notes: Returns `configured: false` if URL/enable settings are missing.

### Redis Health Adapter
- Category: Optional adapter
- Primary purpose: Add cache/queue layer diagnostics.
- Main signals/data: Read-only checks for latency, memory pressure, evictions, rejected connections.
- Key configuration variables: `REDIS_COLLECTOR_ENABLED`, `REDIS_URL`.
- When to enable: When queue/cache behavior may drive incident patterns.
- Important limitations/notes: Returns `configured: false` if URL/enable settings are missing.

## Notes

- Collector registration and tool exposure are defined in `src/mcp/server.ts`.
- Runtime enable/disable behavior and defaults are implemented in `src/core/runtime-config.ts`.
- Environment variable source of truth is `.env.example`.
- Recommended startup order: set `.env`, run checks (`doctor`, `smoke:live`), then call `paperclipDebug.list_collectors` and `paperclipDebug.refresh_collectors`.
