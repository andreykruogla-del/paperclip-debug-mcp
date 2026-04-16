# Runtime Profiles

This guide gives ready `.env` profiles for common Paperclip-adjacent stacks.

## 1) Paperclip + Docker only

```bash
PAPERCLIP_COLLECTOR_ENABLED=true
DOCKER_COLLECTOR_ENABLED=true
FILE_COLLECTOR_ENABLED=false
```

Use this baseline first.

## 2) Add Hermes/OpenClaw/OpenCode host logs

```bash
PAPERCLIP_COLLECTOR_ENABLED=true
DOCKER_COLLECTOR_ENABLED=true
FILE_COLLECTOR_ENABLED=true
FILE_COLLECTOR_PATHS=/var/log/hermes/agent.log;/var/log/openclaw/runtime.log;/var/log/opencode/worker.log
FILE_COLLECTOR_MAX_LINES=500
FILE_COLLECTOR_INCLUDE_PATTERN=error|exception|failed|timeout|panic|fatal|unauthor|refused
```

Use this when part of your runtime emits logs outside Docker.

## 3) File-only diagnostics mode

```bash
PAPERCLIP_COLLECTOR_ENABLED=false
DOCKER_COLLECTOR_ENABLED=false
FILE_COLLECTOR_ENABLED=true
FILE_COLLECTOR_PATHS=/srv/debug/app.log;/srv/debug/bridge.log
```

Use this for isolated debugging when Paperclip API or Docker is unavailable.

## 4) Add WordPress health checks

```bash
WORDPRESS_COLLECTOR_ENABLED=true
WORDPRESS_BASE_URL=https://site.example.com
WORDPRESS_USERNAME=wp_admin
WORDPRESS_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

Use this when your pipeline depends on WordPress (catalog updates/media flows).
If auth fields are omitted, collector still validates public REST + XML-RPC surface.

## 5) Add Caddy reverse-proxy checks

```bash
CADDY_COLLECTOR_ENABLED=true
CADDY_HEALTH_URL=https://paperclip.example.com/healthz
CADDY_LOG_PATH=/var/log/caddy/error.log
CADDY_LOG_TAIL_LINES=300
```

Use this when your stack depends on Caddy and you need fast proxy-layer diagnostics.

## 6) Add Sentry production-error checks

```bash
SENTRY_COLLECTOR_ENABLED=true
SENTRY_BASE_URL=https://sentry.io/api/0
SENTRY_ORG_SLUG=your-org
SENTRY_PROJECT_SLUG=your-project
SENTRY_AUTH_TOKEN=sntrys_xxx
```

Use this when you need read-only production error context in the same MCP flow.

## 7) Add Kubernetes namespace checks

```bash
K8S_COLLECTOR_ENABLED=true
K8S_NAMESPACE=paperclip
```

Use this when part of your stack is deployed in Kubernetes and you need pod-level health signals.

## 8) Add PostgreSQL diagnostics

```bash
POSTGRES_COLLECTOR_ENABLED=true
POSTGRES_URL=postgres://user:password@db-host:5432/database
```

Use this for read-only DB health checks (locks, long-running queries, replication lag).

## 9) Add Redis diagnostics

```bash
REDIS_COLLECTOR_ENABLED=true
REDIS_URL=redis://localhost:6379/0
```

Use this for read-only cache-layer diagnostics (latency, evictions, rejected connections).

## Verification sequence

After changing profile:

1. `npm run smoke:live`
2. Start MCP (`npm run mcp:stdio` or `npm run mcp:http`)
3. Call:
   - `paperclipDebug.get_runtime_config`
   - `paperclipDebug.list_collectors`
   - `paperclipDebug.caddy_health`
   - `paperclipDebug.wordpress_health`
   - `paperclipDebug.k8s_health`
   - `paperclipDebug.sentry_health`
   - `paperclipDebug.postgres_health`
   - `paperclipDebug.redis_health`
   - `paperclipDebug.refresh_collectors`
   - `paperclipDebug.prioritize_incidents`
