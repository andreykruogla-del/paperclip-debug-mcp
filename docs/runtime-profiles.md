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

## Verification sequence

After changing profile:

1. `npm run smoke:live`
2. Start MCP (`npm run mcp:stdio` or `npm run mcp:http`)
3. Call:
   - `paperclipDebug.get_runtime_config`
   - `paperclipDebug.list_collectors`
   - `paperclipDebug.refresh_collectors`
   - `paperclipDebug.prioritize_incidents`
