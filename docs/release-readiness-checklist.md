# Release Readiness Checklist

This checklist is a lightweight gate for preparing a public beta release surface.
It is intentionally repository-focused and does not assume package publishing automation.

## 1) Release-surface decisions

- [ ] Confirm current package posture:
  - `private: true` remains intentional until package publication strategy is explicitly approved.
- [ ] Confirm version string is appropriate for current maturity (`0.x` beta posture).
- [ ] Confirm repository metadata (`repository`, `homepage`, `bugs`) points to the canonical project.
- [ ] Confirm no unreviewed release-surface change is bundled with unrelated feature work.

## 2) Setup and environment preflight

- [ ] `npm install`
- [ ] `cp .env.example .env`
- [ ] Fill required Paperclip settings for your target environment.
- [ ] Keep optional adapters disabled unless specifically validated for this release.

## 3) Baseline diagnostics

- [ ] `npm run doctor`
- [ ] `npm run smoke:live`
- [ ] Verify no blocking config errors in baseline flow.
- [ ] If adapter tools are tested, verify unconfigured behavior is explicit and actionable (`configured: false`, `reachable: false`, `error`, `remediation`).

## 4) MCP transport validation

### stdio transport
- [ ] `npm run mcp:stdio`
- [ ] Confirm MCP client can connect and call basic tools.

### HTTP transport
- [ ] `npm run mcp:http`
- [ ] Verify `/healthz` returns healthy response.
- [ ] If default port `8787` is already occupied in your environment, rerun with a temporary override (for example `MCP_HTTP_PORT=8799`) and record the chosen port in the validation note.
- [ ] If auth is enabled, verify token-protected access behavior.

## 5) Core triage-path sanity check

- [ ] Run a quick flow:
  1. `paperclipDebug.get_runtime_config`
  2. `paperclipDebug.list_collectors`
  3. `paperclipDebug.refresh_collectors`
  4. `paperclipDebug.system_snapshot`
  5. `paperclipDebug.prioritize_incidents`
- [ ] Confirm outputs are machine-usable and include current triage guidance fields where expected.
- [ ] Confirm run/issue/service and packet paths remain callable and coherent.

## 6) Quality gates

- [ ] `npm run check`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] CI `build-and-test` equivalent checks are green for the PR branch.

## 7) Documentation/runtime alignment

- [ ] README reflects current scope and constraints (what the project is and is not).
- [ ] `docs/getting-started.md` matches current first-run commands.
- [ ] `docs/configuration.md` matches current `.env.example` and runtime behavior.
- [ ] `docs/mcp-tools-reference.md` matches currently exposed tool names and key output-shape notes.
- [ ] No doc claims exceed current repository capabilities.

## 8) Pre-merge release decision note

- [ ] Add a short PR note confirming:
  - what is ready for public beta now,
  - what remains intentionally out of scope for this release,
  - whether package publication is explicitly deferred.
- [ ] For every skipped validation item, record a concrete reason (for example missing credentials, unavailable external source, or not-enabled optional adapter).
